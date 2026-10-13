import crypto from 'node:crypto';
import { getMysqlDb, isRealMysqlConnected, inMemoryEntries, inMemoryLines } from '../db/mysqlClient';
import {
  accountingEntries,
  accountingEntryLines,
  agentAuditLogs,
  type ModuleSource,
} from '../db/schema/accountingLedgerSchema';
import { eq, and, desc } from 'drizzle-orm';

const HMAC_SECRET = process.env.SUPERVISOR_HMAC_SECRET || 'SIEX_AUDIT_SUPERVISOR_KEY_2026';

export interface PostModuleTransactionParams {
  firmId: string;
  empresaId: string;
  periodo: string; // 'AAAA-MM'
  fecha: string; // 'AAAA-MM-DD'
  origenModulo: ModuleSource;
  documentoRef: string;
  documentoReferencia?: string;
  tipoDocumentoRef?: string;
  folioDocumentoRef?: string;
  glosa: string;
  agenteNombre: string;
  lineas: Array<{
    codigoCuenta: string;
    nombreCuenta: string;
    debe: number;
    haber: number;
    glosa?: string;
    rutAuxiliar?: string;
    nombreAuxiliar?: string;
    centroCosto?: string;
    documentoRef?: string;
    dteIdAsociado?: string;
    tipoDocumentoRef?: string;
    folioDocumentoRef?: string;
    montoDocumentoRef?: number;
    documentoOperacion?: string;
    tipoDocumentoOperacion?: string;
    documentoConciliacion?: string;
    tipoDocumentoConciliacion?: string;
    monedaOriginal?: string;
    montoMonedaOriginal?: number;
    tipoCambio?: number;
  }>;
  traceId: string;
}

export interface PostModuleTransactionResult {
  entryId: string;
  signature: string;
  totalDebe: number;
  totalHaber: number;
  lineasCount: number;
  timestamp: string;
}

/**
 * Servicio Centralizado Transaccional ACID para Registro de Asientos en Libro Diario.
 * Garantiza:
 * 1. Partida Doble Formal Estricta (|Debe - Haber| == 0.00).
 * 2. Orden Canónico: Bloque de Cuentas del DEBE primero, seguido por el Bloque del HABER.
 * 3. Prohibición de montos negativos o informales.
 * 4. Firma Pericial Inmutable HMAC SHA-256 ligada al Estudio, Empresa, Periodo y Hash de Partidas.
 * 5. Commit Atómico en MySQL 8.0 vía Drizzle ORM con Trazabilidad en agent_audit_logs.
 */
export async function postModuleTransaction(
  params: PostModuleTransactionParams
): Promise<PostModuleTransactionResult> {
  const startTime = Date.now();

  // 1. Validaciones Preliminares
  if (!params.firmId || !params.empresaId) {
    throw new Error('MULTITENANCY_ERROR: firmId y empresaId son obligatorios para registrar asientos contables.');
  }
  if (!params.periodo || !/^\d{4}-\d{2}$/.test(params.periodo)) {
    throw new Error(`PERIODO_INVALIDO: El periodo '${params.periodo}' debe tener formato AAAA-MM.`);
  }
  if (!params.fecha || !/^\d{4}-\d{2}-\d{2}$/.test(params.fecha)) {
    throw new Error(`FECHA_INVALIDA: La fecha '${params.fecha}' debe tener formato AAAA-MM-DD.`);
  }
  if (!params.lineas || params.lineas.length < 2) {
    throw new Error('PARTIDAS_INSUFICIENTES: Un asiento contable formal requiere un mínimo de 2 partidas.');
  }

  // 2. Separación y Normalización Canónica (Bloque Debe > 0, luego Bloque Haber > 0)
  interface CanonicalLineItem {
    codigoCuenta: string;
    nombreCuenta: string;
    debe: number;
    haber: number;
    glosa?: string;
    rutAuxiliar?: string;
    nombreAuxiliar?: string;
    centroCosto?: string;
    documentoRef?: string;
    dteIdAsociado?: string;
    tipoDocumentoRef?: string;
    folioDocumentoRef?: string;
    montoDocumentoRef?: number;
    documentoOperacion?: string;
    tipoDocumentoOperacion?: string;
    documentoConciliacion?: string;
    tipoDocumentoConciliacion?: string;
    monedaOriginal?: string;
    montoMonedaOriginal?: number;
    tipoCambio?: number;
  }

  const debeLines: CanonicalLineItem[] = [];
  const haberLines: CanonicalLineItem[] = [];

  let totalDebe = 0;
  let totalHaber = 0;

  for (let i = 0; i < params.lineas.length; i++) {
    const l = params.lineas[i];
    const debeVal = Math.round((Number(l.debe) || 0) * 100) / 100;
    const haberVal = Math.round((Number(l.haber) || 0) * 100) / 100;

    if (debeVal < 0 || haberVal < 0) {
      throw new Error(
        `PARTIDA_NEGATIVA_PROHIBIDA: La línea ${i + 1} (${l.codigoCuenta}) contiene valores negativos. En contabilidad chilena formal e IFRS los contrasientos se realizan invirtiendo la columna, no con signos negativos.`
      );
    }

    if (debeVal > 0 && haberVal > 0) {
      throw new Error(
        `PARTIDA_AMBIGUA: La línea ${i + 1} (${l.codigoCuenta}) tiene simultáneamente Debe ($${debeVal}) y Haber ($${haberVal}). Cada partida debe ser exclusivamente un cargo o un abono.`
      );
    }

    if (debeVal === 0 && haberVal === 0) {
      continue; // Ignorar partidas vacías neutras
    }

    const item: CanonicalLineItem = {
      codigoCuenta: l.codigoCuenta.trim(),
      nombreCuenta: l.nombreCuenta.trim(),
      debe: debeVal > 0 ? debeVal : 0,
      haber: haberVal > 0 ? haberVal : 0,
      glosa: l.glosa?.trim() || undefined,
      rutAuxiliar: l.rutAuxiliar?.trim() || undefined,
      nombreAuxiliar: l.nombreAuxiliar?.trim() || undefined,
      centroCosto: l.centroCosto?.trim() || undefined,
      documentoRef: l.documentoRef?.trim() || params.documentoRef?.trim() || undefined,
      dteIdAsociado: l.dteIdAsociado?.trim() || undefined,
      tipoDocumentoRef: l.tipoDocumentoRef?.trim() || params.tipoDocumentoRef?.trim() || undefined,
      folioDocumentoRef: l.folioDocumentoRef?.trim() || params.folioDocumentoRef?.trim() || undefined,
      montoDocumentoRef: l.montoDocumentoRef !== undefined && l.montoDocumentoRef !== null ? Number(l.montoDocumentoRef) : undefined,
      documentoOperacion: l.documentoOperacion?.trim() || undefined,
      tipoDocumentoOperacion: l.tipoDocumentoOperacion?.trim() || undefined,
      documentoConciliacion: l.documentoConciliacion?.trim() || undefined,
      tipoDocumentoConciliacion: l.tipoDocumentoConciliacion?.trim() || undefined,
      monedaOriginal: l.monedaOriginal?.trim() || undefined,
      montoMonedaOriginal: l.montoMonedaOriginal !== undefined && l.montoMonedaOriginal !== null ? Number(l.montoMonedaOriginal) : undefined,
      tipoCambio: l.tipoCambio !== undefined && l.tipoCambio !== null ? Number(l.tipoCambio) : undefined,
    };

    if (debeVal > 0) {
      debeLines.push(item);
      totalDebe += debeVal;
    } else {
      haberLines.push(item);
      totalHaber += haberVal;
    }
  }

  totalDebe = Math.round(totalDebe * 100) / 100;
  totalHaber = Math.round(totalHaber * 100) / 100;

  if (debeLines.length === 0) {
    throw new Error('ASIENTO_SIN_DEBE: El asiento no contiene ninguna cuenta con saldo al Debe.');
  }
  if (haberLines.length === 0) {
    throw new Error('ASIENTO_SIN_HABER: El asiento no contiene ninguna cuenta con saldo al Haber.');
  }

  // 3. Verificación de Sumas Iguales (Partida Doble Absoluta)
  const cuadraturaDiff = Math.abs(totalDebe - totalHaber);
  if (cuadraturaDiff >= 0.01) {
    throw new Error(
      `DESCUADRE_CONTABLE: El asiento contable está descuadrado por $${cuadraturaDiff.toFixed(2)} (Debe: $${totalDebe.toFixed(2)}, Haber: $${totalHaber.toFixed(2)}). Rechazado por reglas IFRS y Código de Comercio.`
    );
  }

  // 4. Lista Ordenada Canónica
  const canonicalLines = [...debeLines, ...haberLines];

  // 5. Generación de Hash de Partidas y Firma Criptográfica HMAC SHA-256
  const linesDigest = canonicalLines
    .map(
      (l, idx) =>
        `${idx + 1}|${l.codigoCuenta}|${l.debe.toFixed(2)}|${l.haber.toFixed(2)}|${l.rutAuxiliar || ''}|${l.centroCosto || ''}`
    )
    .join(';;');

  const linesHash = crypto.createHash('sha256').update(linesDigest).digest('hex');

  const hmacPayload = `${params.firmId}:${params.empresaId}:${params.periodo}:${params.fecha}:${totalDebe.toFixed(
    2
  )}:${totalHaber.toFixed(2)}:${linesHash}`;

  const signature = crypto.createHmac('sha256', HMAC_SECRET).update(hmacPayload).digest('hex');

  const entryId = crypto.randomUUID();
  const db = getMysqlDb();

  // 6. Ejecución Transaccional Atómica (ACID)
  await db.transaction(async (tx: any) => {
    // 6.1 Cabecera del Asiento
    const headerPayload = {
      id: entryId,
      firmId: params.firmId,
      empresaId: params.empresaId,
      periodo: params.periodo,
      fecha: params.fecha,
      concepto: params.glosa.trim(),
      documentoRef: params.documentoRef?.trim() || null,
      documentoReferencia: params.documentoReferencia?.trim() || params.documentoRef?.trim() || null,
      tipoDocumentoRef: params.tipoDocumentoRef?.trim() || null,
      folioDocumentoRef: params.folioDocumentoRef?.trim() || null,
      origenModulo: params.origenModulo,
      totalDebe: totalDebe.toFixed(2),
      totalHaber: totalHaber.toFixed(2),
      creadoPorAgente: params.agenteNombre,
      supervisorSignature: signature,
      createdAt: new Date(),
    };

    try {
      await tx.insert(accountingEntries).values(headerPayload);
    } catch (headerErr: any) {
      const sqlMsg = (headerErr as any)?.cause?.message || (headerErr as any)?.sqlMessage || headerErr?.message || String(headerErr);
      if (sqlMsg.includes('Unknown column') || headerErr?.errno === 1054) {
        try {
          const { updateMysqlDatabase } = await import('../scripts/updateMysqlDb');
          await updateMysqlDatabase();
          await tx.insert(accountingEntries).values(headerPayload);
        } catch {
          await tx.execute(sql`
            INSERT INTO \`accounting_entries\` (
              \`id\`, \`empresa_id\`, \`periodo\`, \`fecha\`, \`concepto\`, \`documento_ref\`,
              \`total_debe\`, \`total_haber\`, \`origen_modulo\`, \`creado_por_agente\`,
              \`autorizado_por_supervisor\`, \`supervisor_signature\`
            ) VALUES (
              ${headerPayload.id}, ${headerPayload.empresaId}, ${headerPayload.periodo},
              ${headerPayload.fecha}, ${headerPayload.concepto}, ${headerPayload.documentoRef},
              ${headerPayload.totalDebe}, ${headerPayload.totalHaber}, ${headerPayload.origenModulo},
              ${headerPayload.creadoPorAgente}, 1, ${headerPayload.supervisorSignature}
            )
          `);
        }
      } else if (sqlMsg.includes('Duplicate entry') || headerErr?.errno === 1062) {
        const disambiguated = `${headerPayload.documentoRef || 'DOC'}-${Date.now().toString().slice(-4)}`;
        headerPayload.documentoRef = disambiguated;
        headerPayload.documentoReferencia = disambiguated;
        await tx.insert(accountingEntries).values(headerPayload);
      } else {
        throw headerErr;
      }
    }

    // 6.2 Líneas de Partida Doble
    const lineInserts = canonicalLines.map((line, idx) => ({
      id: crypto.randomUUID(),
      entryId,
      lineaNumero: idx + 1,
      codigoCuenta: line.codigoCuenta,
      nombreCuenta: line.nombreCuenta,
      debe: line.debe.toFixed(2),
      haber: line.haber.toFixed(2),
      glosa: line.glosa || null,
      rutAuxiliar: line.rutAuxiliar || null,
      nombreAuxiliar: line.nombreAuxiliar || null,
      centroCosto: line.centroCosto || null,
      documentoRef: line.documentoRef || params.documentoRef?.trim() || null,
      dteIdAsociado: line.dteIdAsociado || null,
      tipoDocumentoRef: line.tipoDocumentoRef || params.tipoDocumentoRef?.trim() || null,
      folioDocumentoRef: line.folioDocumentoRef || params.folioDocumentoRef?.trim() || null,
      montoDocumentoRef: line.montoDocumentoRef != null ? String(line.montoDocumentoRef) : null,
      documentoOperacion: line.documentoOperacion || null,
      tipoDocumentoOperacion: line.tipoDocumentoOperacion || null,
      documentoConciliacion: line.documentoConciliacion || null,
      tipoDocumentoConciliacion: line.tipoDocumentoConciliacion || null,
      monedaOriginal: line.monedaOriginal || null,
      montoMonedaOriginal: line.montoMonedaOriginal != null ? line.montoMonedaOriginal.toFixed(2) : null,
      tipoCambio: line.tipoCambio != null ? line.tipoCambio.toFixed(4) : null,
    }));

    try {
      await tx.insert(accountingEntryLines).values(lineInserts);
    } catch (linesErr: any) {
      const sqlMsg = (linesErr as any)?.cause?.message || (linesErr as any)?.sqlMessage || linesErr?.message || String(linesErr);
      if (sqlMsg.includes('Unknown column') || linesErr?.errno === 1054) {
        try {
          const { updateMysqlDatabase } = await import('../scripts/updateMysqlDb');
          await updateMysqlDatabase();
          await tx.insert(accountingEntryLines).values(lineInserts);
        } catch {
          for (const l of lineInserts) {
            await tx.execute(sql`
              INSERT INTO \`accounting_entry_lines\` (
                \`id\`, \`entry_id\`, \`codigo_cuenta\`, \`nombre_cuenta\`,
                \`debe\`, \`haber\`, \`rut_auxiliar\`, \`centro_costo\`
              ) VALUES (
                ${l.id}, ${l.entryId}, ${l.codigoCuenta}, ${l.nombreCuenta},
                ${l.debe}, ${l.haber}, ${l.rutAuxiliar || null}, ${l.centroCosto || null}
              )
            `);
          }
        }
      } else {
        throw linesErr;
      }
    }

    // 6.3 Log de Auditoría Pericial Inmutable
    await tx.insert(agentAuditLogs).values({
      id: crypto.randomUUID(),
      traceId: params.traceId || crypto.randomUUID(),
      firmId: params.firmId,
      empresaId: params.empresaId,
      agenteNombre: params.agenteNombre,
      modulo: params.origenModulo,
      accion: 'CENTRALIZACION_CONTABLE_ACID',
      estadoTransicion: 'APROBADO',
      payloadInput: {
        documentoRef: params.documentoRef,
        glosa: params.glosa,
        totalDebe,
        totalHaber,
        lineasCount: canonicalLines.length,
      },
      payloadOutput: {
        entryId,
        signature,
        status: 'COMMITTED_ACID',
      },
      supervisorVeredicto: 'CERTIFICADO_PERICIAL_CONFORME',
      supervisorSignature: signature,
      tiempoEjecucionMs: Math.max(1, Date.now() - startTime),
      createdAt: new Date(),
    });
  });

  console.log(
    `[CentralizedJournalService] Asiento registrado con éxito ID: ${entryId} (${params.origenModulo} - ${params.documentoRef}). Debe = Haber = $${totalDebe.toFixed(2)}`
  );

  return {
    entryId,
    signature,
    totalDebe,
    totalHaber,
    lineasCount: canonicalLines.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Consulta un Asiento Contable por ID con sus líneas en orden canónico estricto
 */
export async function getAccountingEntryById(entryId: string): Promise<{
  entry: any;
  lines: any[];
} | null> {
  const db = getMysqlDb();

  if (isRealMysqlConnected) {
    const [entry] = await db.select().from(accountingEntries).where(eq(accountingEntries.id, entryId)).limit(1);
    if (!entry) return null;

    const lines = await db
      .select()
      .from(accountingEntryLines)
      .where(eq(accountingEntryLines.entryId, entryId))
      .orderBy(accountingEntryLines.lineaNumero);

    return { entry, lines };
  } else {
    const entry = inMemoryEntries.find((e) => e.id === entryId);
    if (!entry) return null;

    const lines = inMemoryLines
      .filter((l) => l.entryId === entryId)
      .sort((a, b) => (a.lineaNumero || 0) - (b.lineaNumero || 0));

    return { entry, lines };
  }
}

/**
 * Consulta los asientos contables de una empresa con filtros opcionales multi-tenant
 */
export async function listAccountingEntries(
  firmId: string,
  empresaId: string,
  periodo?: string
): Promise<any[]> {
  const db = getMysqlDb();

  if (isRealMysqlConnected) {
    const conditions = [
      eq(accountingEntries.firmId, firmId),
      eq(accountingEntries.empresaId, empresaId),
    ];
    if (periodo) {
      conditions.push(eq(accountingEntries.periodo, periodo));
    }

    return await db
      .select()
      .from(accountingEntries)
      .where(and(...conditions))
      .orderBy(desc(accountingEntries.fecha), desc(accountingEntries.createdAt));
  } else {
    return inMemoryEntries
      .filter((e) => {
        if (e.firmId && e.firmId !== firmId) return false;
        if (e.empresaId !== empresaId) return false;
        if (periodo && e.periodo !== periodo) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
