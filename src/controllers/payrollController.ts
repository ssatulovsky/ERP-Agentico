import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { payrollSettlements, employees } from '../db/mysqlSchema';
import { getMysqlDb, isRealMysqlConnected } from '../db/mysqlClient';
import { PayrollCalculationService } from '../services/payrollCalculationService';

export const payrollRouter = Router();

const calculatePayrollSchema = z.object({
  empresaId: z.string().min(3, 'RUT de empresa mandante requerido'),
  periodo: z.string().regex(/^\d{4}-\d{2}$/, 'Período debe ser AAAA-MM'),
});

/**
 * POST /api/payroll/calculate
 * Procesa la liquidación masiva de remuneraciones de los contratos de la empresa:
 * - Indicadores reales UF y UTM
 * - Leyes sociales (AFP, Salud, AFC, SIS, Mutual)
 * - Impuesto Único de Segunda Categoría
 * - Persistencia en `payroll_settlements` y generación de asiento de centralización
 */
payrollRouter.post('/calculate', async (req: Request, res: Response) => {
  try {
    const validated = calculatePayrollSchema.parse(req.body);
    const summary = await PayrollCalculationService.calculateRealPayroll(
      validated.empresaId,
      validated.periodo
    );

    res.status(200).json({
      success: true,
      message: `Nómina calculada exitosamente para ${validated.empresaId} (${validated.periodo})`,
      data: summary,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Parámetros de nómina inválidos',
        details: error.format(),
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Error al procesar cálculo de nómina',
    });
  }
});

/**
 * GET /api/payroll/settlements
 * Consulta las liquidaciones individuales persistidas en la tabla `payroll_settlements`
 */
payrollRouter.get('/settlements', async (req: Request, res: Response) => {
  try {
    const empresaId = String(req.query.empresaId || '').replace(/\./g, '').trim().toUpperCase();
    const periodo = String(req.query.periodo || '');

    if (!empresaId || !periodo) {
      return res.status(400).json({
        success: false,
        error: 'empresaId y periodo (AAAA-MM) son requeridos',
      });
    }

    const db = getMysqlDb();
    if (isRealMysqlConnected) {
      const records = await db
        .select()
        .from(payrollSettlements)
        .where(
          and(
            eq(payrollSettlements.empresaId, empresaId),
            eq(payrollSettlements.periodo, periodo)
          )
        );

      return res.status(200).json({
        success: true,
        empresaId,
        periodo,
        totalLiquidaciones: records.length,
        data: records,
      });
    }

    // Modo contingencia: calcular sobre la marcha
    const summary = await PayrollCalculationService.calculateRealPayroll(empresaId, periodo);
    res.status(200).json({
      success: true,
      empresaId,
      periodo,
      totalLiquidaciones: summary.detalles.length,
      data: summary.detalles,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error al obtener liquidaciones',
    });
  }
});

/**
 * GET /api/payroll/employees
 * Lista los colaboradores de la empresa
 */
payrollRouter.get('/employees', async (req: Request, res: Response) => {
  try {
    const empresaId = String(req.query.empresaId || '').replace(/\./g, '').trim().toUpperCase();
    if (!empresaId) {
      return res.status(400).json({
        success: false,
        error: 'empresaId es requerido',
      });
    }

    const records = await PayrollCalculationService.getOrSeedEmployees(empresaId);
    res.status(200).json({
      success: true,
      empresaId,
      totalEmpleados: records.length,
      data: records,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Error al listar colaboradores',
    });
  }
});
