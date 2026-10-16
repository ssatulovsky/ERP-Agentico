/**
 * Interfaces TypeScript Canónicas y Estrictas para Asientos de Libro Diario
 * Cumplimiento del Código de Comercio de Chile (Art. 25 a 44), IFRS/NIIF y Normativa SII.
 * 
 * Reglas Formales:
 * 1. Partida Doble estricta (Total Debe == Total Haber, diferencia == 0.00).
 * 2. Cero valores negativos en columnas 'debe' y 'haber' (montos >= 0.00).
 * 3. Orden canónico: cuentas deudoras (cargos al Debe) seguidas de cuentas acreedoras (abonos al Haber).
 */

export type JournalEntryOrigin =
  | 'MANUAL'
  | 'F29_CENTRALIZACION'
  | 'REMUNERACIONES'
  | 'RCV_COMPRAS'
  | 'RCV_VENTAS'
  | 'AJUSTE'
  | 'HONORARIOS'
  | 'ARRIENDOS'
  | 'COBRANZAS'
  | 'INVENTARIO'
  | 'BANCOS_CONCILIACION'
  | 'CIERRE_EJERCICIO';

export interface JournalEntryLine {
  linea: number; // Correlativo secuencial: 1, 2, 3...
  codigoCuenta: string; // ej: '1.1.01.01', '2.1.03.01'
  nombreCuenta: string; // Nombre oficial en Plan de Cuentas
  rutAuxiliar?: string | null; // RUT entidad analítica (proveedor, cliente, empleado, SII)
  centroCosto?: string | null; // Centro de costo (ej: 'ADMINISTRACION', 'VENTAS', 'OPERACIONES')
  proyecto?: string | null; // Centro de Proyecto / Obra (WIP / IFRS Art. 31)
  glosaDetalle?: string | null; // Glosa particular de la línea
  debe: number; // Siempre >= 0.00 (Decimal 15,2)
  haber: number; // Siempre >= 0.00 (Decimal 15,2)
}

export interface JournalEntry {
  id?: string;
  folio?: number; // Correlativo numérico oficial del Libro Diario
  empresaId: string; // RUT de la empresa mandante (ej: '76.892.410-K')
  periodo: string; // Formato 'AAAA-MM' (ej: '2026-09')
  fecha: string; // Formato 'AAAA-MM-DD' (ej: '2026-09-07')
  glosaGeneral: string; // Explicación descriptiva y legal de la operación económica
  documentoRef?: string | null; // N° Factura, Boleta, Liquidación N°, F29 Folio, etc.
  origenModulo: JournalEntryOrigin;
  lineas: JournalEntryLine[]; // Líneas ordenadas canónicamente (Debe primero, Haber después)
  totalDebe: number; // Sumatoria de cargos
  totalHaber: number; // Sumatoria de abonos
  diferencia: number; // Sumatoria Debe - Sumatoria Haber (Debe ser estrictamente 0.00)
  creadoPorAgente: string; // Agente emisor (ej: 'Agente Fiscal F29', 'Agente RRHH', 'Agente Auditor')
  supervisorSignature?: string; // Firma criptográfica HMAC-SHA256 del Agente Supervisor
  timestamp?: string; // Marca temporal ISO de registro
}

/**
 * Representación simplificada o de entrada (sin requerir totales ni correlativos calculados)
 */
export interface RawJournalEntryInput {
  id?: string;
  folio?: number;
  empresaId: string;
  periodo?: string;
  fecha: string;
  glosaGeneral: string;
  documentoRef?: string | null;
  origenModulo?: JournalEntryOrigin | string;
  lineas: Array<{
    linea?: number;
    codigoCuenta?: string;
    nombreCuenta?: string;
    cuenta?: string; // Soporte para estructuras heredadas { cuenta: 'IVA Débito', debe: 100, haber: 0 }
    rutAuxiliar?: string | null;
    centroCosto?: string | null;
    proyecto?: string | null;
    glosaDetalle?: string | null;
    debe?: number | string | null;
    haber?: number | string | null;
  }>;
  creadoPorAgente?: string;
  supervisorSignature?: string;
}
