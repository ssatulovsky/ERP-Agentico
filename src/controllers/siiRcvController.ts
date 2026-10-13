import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { sql, eq, and } from 'drizzle-orm';
import { dtesRcv } from '../db/schema/dtesSchema';
import { getMysqlDb, isRealMysqlConnected, inMemoryDtesRcv } from '../db/mysqlClient';
import { diskPersistence } from '../services/diskPersistenceService';
import { SiiRcvService, SiiGatewayError } from '../services/siiRcvService';
import { RcvIngestionService } from '../services/rcvIngestionService';

export const siiRcvRouter = Router();

const syncApiSchema = z.object({
  empresaRut: z.string().min(3, 'RUT de empresa mandante requerido'),
  periodo: z.string().regex(/^\d{4}-\d{2}$/, 'Período debe ser AAAA-MM'),
  tipo: z.enum(['COMPRA', 'VENTA']),
});

const uploadCsvSchema = z.object({
  empresaRut: z.string().min(3, 'RUT de empresa mandante requerido'),
  periodo: z.string().regex(/^\d{4}-\d{2}$/, 'Período debe ser AAAA-MM'),
  tipo: z.enum(['COMPRA', 'VENTA']),
  fileBase64: z.string().min(10, 'Contenido base64 del archivo CSV es requerido'),
});

/**
 * POST /api/rcv/sync-api
 * Sincronización oficial por API Gateway del SII.
 * Si falla la conexión o falta la pasarela, lanza SiiGatewayError con código HTTP correspondiente.
 */
siiRcvRouter.post('/sync-api', async (req: Request, res: Response) => {
  try {
    const validated = syncApiSchema.parse(req.body);
    const cleanRut = validated.empresaRut.replace(/\./g, '').trim().toUpperCase();

    const remoteRecords = await SiiRcvService.fetchRemoteRcv(
      cleanRut,
      validated.periodo,
      validated.tipo
    );

    // Mapear e ingestar en MySQL
    const parsedRows = remoteRecords.map((r) => ({
      empresaId: cleanRut,
      periodo: validated.periodo,
      tipoOperacion: validated.tipo,
      tipoDte: r.tipoDte,
      folio: r.folio,
      rutContraparte: r.rutContraparte,
      razonSocialContraparte: r.razonSocialContraparte,
      fechaEmision: r.fechaEmision,
      montoExento: r.montoExento,
      montoNeto: r.montoNeto,
      montoIvaRecuperable: r.montoIvaRecuperable,
      montoIvaNoRecuperable: r.montoIvaNoRecuperable,
      montoTotal: r.montoTotal,
      estadoAcuse: r.estadoAcuse || null,
    }));

    const traceId = `trace-sync-${Date.now()}`;
    const ingestResult = await RcvIngestionService.ingestDteBatch(cleanRut, parsedRows, traceId);

    res.status(200).json({
      success: true,
      message: `Sincronización API RCV exitosa para ${cleanRut}`,
      data: {
        empresaId: cleanRut,
        periodo: validated.periodo,
        tipo: validated.tipo,
        documentosRecibidos: remoteRecords.length,
        documentosIngestados: ingestResult.insertedCount,
        totalNeto: ingestResult.totalNeto,
        totalIvaRecuperable: ingestResult.totalIvaRecuperable,
        totalMonto: ingestResult.totalMonto,
      },
    });
  } catch (error: any) {
    if (error instanceof SiiGatewayError) {
      return res.status(error.statusCode || 502).json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Datos de solicitud inválidos',
        details: error.format(),
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Error en sincronización API RCV',
    });
  }
});

/**
 * POST /api/rcv/upload-csv
 * Ingesta pericial de archivo exportado oficial desde el portal del SII
 */
siiRcvRouter.post('/upload-csv', async (req: Request, res: Response) => {
  try {
    const validated = uploadCsvSchema.parse(req.body);
    const cleanRut = validated.empresaRut.replace(/\./g, '').trim().toUpperCase();
    const fileBuffer = Buffer.from(validated.fileBase64, 'base64');

    const summary = await SiiRcvService.parseAndIngestRcvCsv(
      fileBuffer,
      cleanRut,
      validated.periodo,
      validated.tipo
    );

    res.status(200).json({
      success: true,
      message: `Archivo CSV RCV procesado e ingestado exitosamente`,
      data: summary,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Parámetros de carga inválidos',
        details: error.format(),
      });
    }

    res.status(422).json({
      success: false,
      error: error.message || 'Error al procesar archivo CSV del RCV',
    });
  }
});

/**
 * GET /api/rcv/dtes
 * Consulta los documentos reales persistidos en MySQL 8.0 para una empresa y período
 */
siiRcvRouter.get('/dtes', async (req: Request, res: Response) => {
  try {
    const empresaRut = String(req.query.empresaRut || req.query.empresaId || '').replace(/\./g, '').trim().toUpperCase();
    const periodo = String(req.query.periodo || '');
    const tipo = req.query.tipo ? String(req.query.tipo).toUpperCase() : undefined;

    if (!empresaRut || !periodo) {
      return res.status(400).json({
        success: false,
        error: 'Parámetros obligatorios: empresaRut y periodo (AAAA-MM)',
      });
    }

    const db = getMysqlDb();
    let records: any[] = [];

    if (isRealMysqlConnected) {
      const conditions = [
        eq(dtesRcv.empresaId, empresaRut),
        eq(dtesRcv.periodo, periodo),
      ];

      if (tipo && (tipo === 'COMPRA' || tipo === 'VENTA')) {
        conditions.push(eq(dtesRcv.tipoOperacion, tipo));
      }

      records = await db
        .select()
        .from(dtesRcv)
        .where(and(...conditions));
    } else {
      // Búsqueda en almacén de contingencia
      records = inMemoryDtesRcv.filter((d) => {
        const matchEmpresa = d.empresaId === empresaRut;
        const matchPeriodo = d.periodo === periodo;
        const matchTipo = tipo ? d.tipoOperacion === tipo : true;
        return matchEmpresa && matchPeriodo && matchTipo;
      });
    }

    if (records.length === 0) {
      const diskRecords = diskPersistence.getDtes(empresaRut, periodo);
      if (diskRecords.length > 0) {
        records = diskRecords.filter((d: any) => (tipo ? d.tipoOperacion === tipo : true));
      }
    }

    res.status(200).json({
      success: true,
      empresaId: empresaRut,
      periodo,
      totalRegistros: records.length,
      data: records,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error al consultar DTEs en base de datos',
    });
  }
});
