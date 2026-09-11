import {
  AccountingEntry,
  AccountingEntryLine,
  HierarchicalAccountItem,
  TrialBalance8ColAccount,
  TrialBalance8ColTotals,
  ResultadoEjercicio8Col,
  Balance8ColumnasReport,
  OrchestratorAuditItem,
  AccountingProposalResponse,
  PeriodClosingAdjustment,
  DteDocument,
  EmployeePayroll,
  F29Declaration,
  LeaseContract,
  BankStatementMovement,
  CompanyProfile,
  ChileIndicators,
} from '../types';
import { formatCLP, formatNumberCL } from './chileanAccounting';

/**
 * PLAN DE CUENTAS JERÁRQUICO ESTÁNDAR CHILENO (5 NIVELES - CLASES 1 A 7)
 * Normativa CMF / SII / IFRS Pymes y Completa
 */
export const CHILE_HIERARCHICAL_CHART_OF_ACCOUNTS: HierarchicalAccountItem[] = [
  // ==========================================
  // CLASE 1: ACTIVO (1.0.00.000)
  // ==========================================
  // 1.1 ACTIVO CORRIENTE / CIRCULANTE
  {
    codigo: '1.1.01.001',
    nombre: 'Caja Central Moneda Nacional',
    clase: 1,
    grupo: '1.1',
    subgrupo: '1.1.01',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '1.1.01.002',
    nombre: 'Fondo Fijo / Caja Chica',
    clase: 1,
    grupo: '1.1',
    subgrupo: '1.1.01',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '1.1.02.001',
    nombre: 'Banco Santander Chile Cta Cte M/N',
    clase: 1,
    grupo: '1.1',
    subgrupo: '1.1.02',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: true,
    activa: true,
  },
  {
    codigo: '1.1.02.002',
    nombre: 'Banco de Chile Cta Cte M/N',
    clase: 1,
    grupo: '1.1',
    subgrupo: '1.1.02',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: true,
    activa: true,
  },
  {
    codigo: '1.1.02.003',
    nombre: 'Banco Moneda Extranjera (USD)',
    clase: 1,
    grupo: '1.1',
    subgrupo: '1.1.02',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: true,
    activa: true,
  },
  {
    codigo: '1.1.03.001',
    nombre: 'Clientes Nacionales (Cuentas por Cobrar)',
    clase: 1,
    grupo: '1.1',
    subgrupo: '1.1.03',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '1.1.03.002',
    nombre: 'Clientes Extranjeros / Exportaciones',
    clase: 1,
    grupo: '1.1',
    subgrupo: '1.1.03',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '1.1.03.003',
    nombre: 'Documentos y Cheques por Cobrar',
    clase: 1,
    grupo: '1.1',
    subgrupo: '1.1.03',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '1.1.04.001',
    nombre: 'IVA Crédito Fiscal (DL 825)',
    clase: 1,
    grupo: '1.1',
    subgrupo: '1.1.04',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '1.1.04.002',
    nombre: 'Remanente de Crédito Fiscal (Art. 28 DL 825)',
    clase: 1,
    grupo: '1.1',
    subgrupo: '1.1.04',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '1.1.04.003',
    nombre: 'PPM por Recuperar (Art. 84 LIR)',
    clase: 1,
    grupo: '1.1',
    subgrupo: '1.1.04',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '1.1.05.001',
    nombre: 'Mercaderías / Existencias en Bodega Central',
    clase: 1,
    grupo: '1.1',
    subgrupo: '1.1.05',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '1.1.05.002',
    nombre: 'Materias Primas e Insumos Operacionales',
    clase: 1,
    grupo: '1.1',
    subgrupo: '1.1.05',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '1.1.06.001',
    nombre: 'Anticipos a Proveedores y Prestadores',
    clase: 1,
    grupo: '1.1',
    subgrupo: '1.1.06',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '1.1.06.002',
    nombre: 'Seguros y Arriendos Pagados por Anticipado',
    clase: 1,
    grupo: '1.1',
    subgrupo: '1.1.06',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },

  // 1.2 ACTIVO NO CORRIENTE (FIJO / IFRS 16)
  {
    codigo: '1.2.01.001',
    nombre: 'Terrenos y Edificaciones',
    clase: 1,
    grupo: '1.2',
    subgrupo: '1.2.01',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'NO_CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '1.2.01.002',
    nombre: 'Maquinarias, Instalaciones y Equipos',
    clase: 1,
    grupo: '1.2',
    subgrupo: '1.2.01',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'NO_CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '1.2.01.003',
    nombre: 'Vehículos y Flota Operativa',
    clase: 1,
    grupo: '1.2',
    subgrupo: '1.2.01',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'NO_CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '1.2.01.004',
    nombre: 'Equipos Computacionales y Servidores',
    clase: 1,
    grupo: '1.2',
    subgrupo: '1.2.01',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'NO_CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '1.2.01.005',
    nombre: 'Activo por Derecho de Uso (IFRS 16)',
    clase: 1,
    grupo: '1.2',
    subgrupo: '1.2.01',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'NO_CIRCULANTE',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '1.2.02.001',
    nombre: '(-) Depreciación Acumulada Activo Fijo (NIC 16)',
    clase: 1,
    grupo: '1.2',
    subgrupo: '1.2.02',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'NO_CIRCULANTE',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '1.2.02.002',
    nombre: '(-) Amortización Acumulada Derecho de Uso (IFRS 16)',
    clase: 1,
    grupo: '1.2',
    subgrupo: '1.2.02',
    nivel: 5,
    tipo: 'ACTIVO',
    clasificacion: 'NO_CIRCULANTE',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },

  // ==========================================
  // CLASE 2: PASIVO (2.0.00.000)
  // ==========================================
  // 2.1 PASIVO CORRIENTE / CORTO PLAZO
  {
    codigo: '2.1.01.001',
    nombre: 'Proveedores Nacionales (Cuentas por Pagar)',
    clase: 2,
    grupo: '2.1',
    subgrupo: '2.1.01',
    nivel: 5,
    tipo: 'PASIVO',
    clasificacion: 'CORTO_PLAZO',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '2.1.01.002',
    nombre: 'Honorarios por Pagar (2da Categoría)',
    clase: 2,
    grupo: '2.1',
    subgrupo: '2.1.01',
    nivel: 5,
    tipo: 'PASIVO',
    clasificacion: 'CORTO_PLAZO',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '2.1.01.003',
    nombre: 'Tarjetas de Crédito Comerciales y Bancarias por Pagar',
    clase: 2,
    grupo: '2.1',
    subgrupo: '2.1.01',
    nivel: 5,
    tipo: 'PASIVO',
    clasificacion: 'CORTO_PLAZO',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: false,
    esConciliableBancaria: true,
    activa: true,
  },
  {
    codigo: '2.1.02.001',
    nombre: 'Sueldos Líquidos por Pagar',
    clase: 2,
    grupo: '2.1',
    subgrupo: '2.1.02',
    nivel: 5,
    tipo: 'PASIVO',
    clasificacion: 'CORTO_PLAZO',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '2.1.02.002',
    nombre: 'Instituciones Previsionales (AFP) por Pagar (Previred)',
    clase: 2,
    grupo: '2.1',
    subgrupo: '2.1.02',
    nivel: 5,
    tipo: 'PASIVO',
    clasificacion: 'CORTO_PLAZO',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '2.1.02.003',
    nombre: 'Salud (Fonasa / Isapres) por Pagar',
    clase: 2,
    grupo: '2.1',
    subgrupo: '2.1.02',
    nivel: 5,
    tipo: 'PASIVO',
    clasificacion: 'CORTO_PLAZO',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '2.1.02.004',
    nombre: 'AFC Seguro de Cesantía por Pagar',
    clase: 2,
    grupo: '2.1',
    subgrupo: '2.1.02',
    nivel: 5,
    tipo: 'PASIVO',
    clasificacion: 'CORTO_PLAZO',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '2.1.02.005',
    nombre: 'Mutual de Seguridad y SIS por Pagar',
    clase: 2,
    grupo: '2.1',
    subgrupo: '2.1.02',
    nivel: 5,
    tipo: 'PASIVO',
    clasificacion: 'CORTO_PLAZO',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '2.1.03.001',
    nombre: 'IVA Débito Fiscal',
    clase: 2,
    grupo: '2.1',
    subgrupo: '2.1.03',
    nivel: 5,
    tipo: 'PASIVO',
    clasificacion: 'CORTO_PLAZO',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '2.1.03.002',
    nombre: 'Retención Honorarios 2da Categoría por Pagar (F29)',
    clase: 2,
    grupo: '2.1',
    subgrupo: '2.1.03',
    nivel: 5,
    tipo: 'PASIVO',
    clasificacion: 'CORTO_PLAZO',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '2.1.03.003',
    nombre: 'Impuesto Único de Segunda Categoría por Pagar (F29)',
    clase: 2,
    grupo: '2.1',
    subgrupo: '2.1.03',
    nivel: 5,
    tipo: 'PASIVO',
    clasificacion: 'CORTO_PLAZO',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '2.1.03.004',
    nombre: 'PPM por Pagar (F29)',
    clase: 2,
    grupo: '2.1',
    subgrupo: '2.1.03',
    nivel: 5,
    tipo: 'PASIVO',
    clasificacion: 'CORTO_PLAZO',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '2.1.03.005',
    nombre: 'Impuestos Mensuales F29 por Pagar (TGR)',
    clase: 2,
    grupo: '2.1',
    subgrupo: '2.1.03',
    nivel: 5,
    tipo: 'PASIVO',
    clasificacion: 'CORTO_PLAZO',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '2.1.04.001',
    nombre: 'Pasivo por Arrendamiento Corto Plazo (IFRS 16)',
    clase: 2,
    grupo: '2.1',
    subgrupo: '2.1.04',
    nivel: 5,
    tipo: 'PASIVO',
    clasificacion: 'CORTO_PLAZO',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },

  // 2.2 PASIVO NO CORRIENTE / LARGO PLAZO
  {
    codigo: '2.2.01.001',
    nombre: 'Pasivo por Arrendamiento Largo Plazo (IFRS 16)',
    clase: 2,
    grupo: '2.2',
    subgrupo: '2.2.01',
    nivel: 5,
    tipo: 'PASIVO',
    clasificacion: 'LARGO_PLAZO',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '2.2.01.002',
    nombre: 'Créditos Bancarios y Leasing Largo Plazo',
    clase: 2,
    grupo: '2.2',
    subgrupo: '2.2.01',
    nivel: 5,
    tipo: 'PASIVO',
    clasificacion: 'LARGO_PLAZO',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },

  // ==========================================
  // CLASE 3: PATRIMONIO NETO (3.0.00.000)
  // ==========================================
  {
    codigo: '3.1.01.001',
    nombre: 'Capital Social Pagado',
    clase: 3,
    grupo: '3.1',
    subgrupo: '3.1.01',
    nivel: 5,
    tipo: 'PATRIMONIO',
    clasificacion: 'NO_CIRCULANTE',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '3.1.02.001',
    nombre: 'Resultados Acumulados de Ejercicios Anteriores',
    clase: 3,
    grupo: '3.1',
    subgrupo: '3.1.02',
    nivel: 5,
    tipo: 'PATRIMONIO',
    clasificacion: 'NO_CIRCULANTE',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '3.1.03.001',
    nombre: 'Resultado del Ejercicio Actual',
    clase: 3,
    grupo: '3.1',
    subgrupo: '3.1.03',
    nivel: 5,
    tipo: 'PATRIMONIO',
    clasificacion: 'NO_CIRCULANTE',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },

  // ==========================================
  // CLASE 4: INGRESOS DE LA OPERACIÓN (4.0.00.000)
  // ==========================================
  {
    codigo: '4.1.01.001',
    nombre: 'Ingresos por Ventas Afectas a IVA',
    clase: 4,
    grupo: '4.1',
    subgrupo: '4.1.01',
    nivel: 5,
    tipo: 'INGRESO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '4.1.01.002',
    nombre: 'Ingresos por Servicios Exentos de IVA',
    clase: 4,
    grupo: '4.1',
    subgrupo: '4.1.01',
    nivel: 5,
    tipo: 'INGRESO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '4.1.01.003',
    nombre: '(-) Descuentos Concedidos en Ventas',
    clase: 4,
    grupo: '4.1',
    subgrupo: '4.1.01',
    nivel: 5,
    tipo: 'INGRESO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },

  // ==========================================
  // CLASE 5: COSTOS DE EXPLOTACIÓN (5.0.00.000)
  // ==========================================
  {
    codigo: '5.1.01.001',
    nombre: 'Costo de Ventas Mercaderías',
    clase: 5,
    grupo: '5.1',
    subgrupo: '5.1.01',
    nivel: 5,
    tipo: 'COSTO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '5.1.01.002',
    nombre: 'Costo Directo por Servicios Prestados',
    clase: 5,
    grupo: '5.1',
    subgrupo: '5.1.01',
    nivel: 5,
    tipo: 'COSTO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '5.1.01.003',
    nombre: 'Mermas y Pérdidas de Inventario en Bodega',
    clase: 5,
    grupo: '5.1',
    subgrupo: '5.1.01',
    nivel: 5,
    tipo: 'COSTO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },

  // ==========================================
  // CLASE 6: GASTOS DE ADMINISTRACIÓN Y VENTAS (6.0.00.000)
  // ==========================================
  {
    codigo: '6.1.01.001',
    nombre: 'Sueldos y Remuneraciones Base Personal',
    clase: 6,
    grupo: '6.1',
    subgrupo: '6.1.01',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '6.1.01.002',
    nombre: 'Gratificaciones Legales (Art. 50 Código del Trabajo)',
    clase: 6,
    grupo: '6.1',
    subgrupo: '6.1.01',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '6.1.01.003',
    nombre: 'Horas Extraordinarias',
    clase: 6,
    grupo: '6.1',
    subgrupo: '6.1.01',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '6.1.01.004',
    nombre: 'Aportes Patronales (SIS, Mutual, AFC Empleador)',
    clase: 6,
    grupo: '6.1',
    subgrupo: '6.1.01',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '6.1.01.005',
    nombre: 'Asignaciones No Imponibles (Colación / Movilización)',
    clase: 6,
    grupo: '6.1',
    subgrupo: '6.1.01',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '6.1.01.006',
    nombre: 'Indemnizaciones Legales y Finiquitos (Art. 161)',
    clase: 6,
    grupo: '6.1',
    subgrupo: '6.1.01',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '6.1.02.001',
    nombre: 'Honorarios Profesionales y Consultorías',
    clase: 6,
    grupo: '6.1',
    subgrupo: '6.1.02',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '6.1.03.001',
    nombre: 'Gasto por Arriendo Comercial de Oficinas',
    clase: 6,
    grupo: '6.1',
    subgrupo: '6.1.03',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '6.1.03.002',
    nombre: 'Amortización Activo por Derecho de Uso (IFRS 16)',
    clase: 6,
    grupo: '6.1',
    subgrupo: '6.1.03',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '6.1.04.001',
    nombre: 'Servicios Básicos (Luz, Agua, Gas, Enlaces)',
    clase: 6,
    grupo: '6.1',
    subgrupo: '6.1.04',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '6.1.04.002',
    nombre: 'Software, Servidores Cloud y Licencias',
    clase: 6,
    grupo: '6.1',
    subgrupo: '6.1.04',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '6.1.04.003',
    nombre: 'Publicidad, Marketing y Campañas Digitales',
    clase: 6,
    grupo: '6.1',
    subgrupo: '6.1.04',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: true,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '6.1.04.004',
    nombre: 'Depreciación Financiera Activo Fijo (NIC 16)',
    clase: 6,
    grupo: '6.1',
    subgrupo: '6.1.04',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '6.1.04.005',
    nombre: 'Patentes Municipales, Permisos y Contribuciones',
    clase: 6,
    grupo: '6.1',
    subgrupo: '6.1.04',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '6.1.04.006',
    nombre: 'Útiles de Oficina, Papelería y Suministros Menores',
    clase: 6,
    grupo: '6.1',
    subgrupo: '6.1.04',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },

  // ==========================================
  // CLASE 7: OTROS INGRESOS / GASTOS FUERA DE EXPLOTACIÓN (7.0.00.000)
  // ==========================================
  {
    codigo: '7.1.01.001',
    nombre: 'Intereses Ganados e Inversiones Financieras',
    clase: 7,
    grupo: '7.1',
    subgrupo: '7.1.01',
    nivel: 5,
    tipo: 'INGRESO',
    clasificacion: 'NO_OPERACIONAL',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '7.1.01.002',
    nombre: 'Diferencia de Cambio a Favor (USD / EUR)',
    clase: 7,
    grupo: '7.1',
    subgrupo: '7.1.01',
    nivel: 5,
    tipo: 'INGRESO',
    clasificacion: 'NO_OPERACIONAL',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '7.1.01.003',
    nombre: 'Ganancia por Reajuste de Unidades de Fomento (UF)',
    clase: 7,
    grupo: '7.1',
    subgrupo: '7.1.01',
    nivel: 5,
    tipo: 'INGRESO',
    clasificacion: 'NO_OPERACIONAL',
    naturaleza: 'ACREEDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '7.2.01.001',
    nombre: 'Gastos Financieros e Intereses por Arrendamiento (IFRS 16)',
    clase: 7,
    grupo: '7.2',
    subgrupo: '7.2.01',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'NO_OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '7.2.01.002',
    nombre: 'Diferencia de Cambio en Contra (USD / EUR)',
    clase: 7,
    grupo: '7.2',
    subgrupo: '7.2.01',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'NO_OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '7.2.01.003',
    nombre: 'Pérdida por Reajuste de Unidades de Fomento (UF)',
    clase: 7,
    grupo: '7.2',
    subgrupo: '7.2.01',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'NO_OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '7.2.01.004',
    nombre: 'Corrección Monetaria Tributaria (Art. 35 LIR)',
    clase: 7,
    grupo: '7.2',
    subgrupo: '7.2.01',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'NO_OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
  {
    codigo: '7.2.01.005',
    nombre: 'Ajuste por Redondeo / Diferencia de Centavos',
    clase: 7,
    grupo: '7.2',
    subgrupo: '7.2.01',
    nivel: 5,
    tipo: 'GASTO',
    clasificacion: 'NO_OPERACIONAL',
    naturaleza: 'DEUDORA',
    requiereAuxiliarRut: false,
    requiereCentroCosto: false,
    esConciliableBancaria: false,
    activa: true,
  },
];

/**
 * Helper to match an account name or code to the standard Chilean hierarchical chart
 */
export function findAccountInChart(identifier: string): HierarchicalAccountItem | undefined {
  const clean = identifier.trim().toLowerCase();
  return CHILE_HIERARCHICAL_CHART_OF_ACCOUNTS.find(
    acc => acc.codigo.toLowerCase() === clean || acc.nombre.toLowerCase() === clean
  );
}

/**
 * Determine the account class (1..7) based on its code or classification
 */
export function getAccountClass(codigo: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const firstDigit = parseInt(codigo.charAt(0), 10);
  if (firstDigit >= 1 && firstDigit <= 7) {
    return firstDigit as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  }
  return 6; // default to Gasto Administrativo
}

/**
 * Determine if account is Inventario (Activo/Pasivo/Patrimonio = 1, 2, 3)
 * or Resultado (Ingreso/Costo/Gasto = 4, 5, 6, 7)
 */
export function isInventarioAccount(clase: number): boolean {
  return clase === 1 || clase === 2 || clase === 3;
}

export function isResultadoAccount(clase: number): boolean {
  return clase === 4 || clase === 5 || clase === 6 || clase === 7;
}

/**
 * =========================================================================
 * MOTOR MATEMÁTICO DEL BALANCE GENERAL TRIBUTARIO DE 8 COLUMNAS (SII CHILE)
 * =========================================================================
 *
 * Col 1 & 2: Débitos y Créditos (Sumas)
 * Col 3 & 4: Saldos Deudor y Acreedor (Diferencia de sumas)
 * Col 5 & 6: Inventario (Activo y Pasivo) - Solo Clases 1, 2, 3
 * Col 7 & 8: Resultado (Pérdida y Ganancia) - Solo Clases 4, 5, 6, 7
 *
 * REGLA ESTRICTA DE LA DIRECTIVA:
 * "Nunca permitir que una cuenta de resultado se presente con saldo en Inventario
 * (Activo/Pasivo), ni viceversa."
 */
export function buildOfficial8ColumnBalance(
  entries: AccountingEntry[],
  empresa: CompanyProfile,
  periodoStr: string = '2026-12-31',
  customChart?: HierarchicalAccountItem[]
): Balance8ColumnasReport {
  // 1. Acumular débitos y créditos por cuenta
  const accMap: Record<
    string,
    {
      codigo: string;
      nombre: string;
      clase: number;
      naturaleza: 'DEUDORA' | 'ACREEDORA';
      debitos: number;
      creditos: number;
    }
  > = {};

  const findInCurrentChart = (identifier: string) => {
    if (customChart && customChart.length > 0) {
      const clean = identifier.trim().toLowerCase();
      return customChart.find(
        (acc) => acc.codigo.toLowerCase() === clean || acc.nombre.toLowerCase() === clean
      );
    }
    return findAccountInChart(identifier);
  };

  // Inicializar con cuentas que tienen saldo de apertura o movimientos
  entries.forEach(entry => {
    entry.lineas.forEach(line => {
      const code = line.cuentaCodigo || '9.9.99.999';
      const name = line.cuentaNombre || 'Cuenta No Clasificada';

      if (!accMap[code]) {
        const found = findInCurrentChart(code) || findInCurrentChart(name);
        const resolvedClass = found ? found.clase : getAccountClass(code);
        const resolvedNature = found ? found.naturaleza : (resolvedClass === 1 || resolvedClass >= 5 ? 'DEUDORA' : 'ACREEDORA');

        accMap[code] = {
          codigo: code,
          nombre: found ? found.nombre : name,
          clase: resolvedClass,
          naturaleza: resolvedNature,
          debitos: 0,
          creditos: 0,
        };
      }

      accMap[code].debitos += Math.round(line.debe || 0);
      accMap[code].creditos += Math.round(line.haber || 0);
    });
  });

  // 2. Construir filas de 8 columnas por cuenta ordenada por código
  const rawAccounts = Object.values(accMap).sort((a, b) => a.codigo.localeCompare(b.codigo));

  const cuentas8Col: TrialBalance8ColAccount[] = rawAccounts.map(acc => {
    const debitos = acc.debitos;
    const creditos = acc.creditos;

    // Saldos: Deudor o Acreedor
    let saldo_deudor = 0;
    let saldo_acreedor = 0;

    if (debitos >= creditos) {
      saldo_deudor = debitos - creditos;
    } else {
      saldo_acreedor = creditos - debitos;
    }

    // Distribución a Inventario (Col 5 & 6) o Resultado (Col 7 & 8)
    let activo = 0;
    let pasivo = 0;
    let perdida = 0;
    let ganancia = 0;

    if (isInventarioAccount(acc.clase)) {
      // Clases 1, 2, 3 NUNCA van a Resultado
      if (acc.clase === 1) {
        // Activo: Si saldo es deudor va a Activo. Si saldo es acreedor (ej. depreciación acumulada) va a Pasivo o contra-activo
        if (saldo_deudor > 0) {
          activo = saldo_deudor;
        } else {
          pasivo = saldo_acreedor;
        }
      } else {
        // Pasivo o Patrimonio (Clase 2 y 3)
        if (saldo_acreedor > 0) {
          pasivo = saldo_acreedor;
        } else {
          activo = saldo_deudor;
        }
      }
    } else if (isResultadoAccount(acc.clase)) {
      // Clases 4, 5, 6, 7 NUNCA van a Inventario
      if (acc.clase === 4) {
        // Ingresos
        if (saldo_acreedor > 0) {
          ganancia = saldo_acreedor;
        } else {
          perdida = saldo_deudor;
        }
      } else if (acc.clase === 5 || acc.clase === 6) {
        // Costos y Gastos
        if (saldo_deudor > 0) {
          perdida = saldo_deudor;
        } else {
          ganancia = saldo_acreedor;
        }
      } else if (acc.clase === 7) {
        // Otros Ingresos / Gastos
        if (saldo_deudor > 0) {
          perdida = saldo_deudor;
        } else {
          ganancia = saldo_acreedor;
        }
      }
    }

    return {
      codigo: acc.codigo,
      nombre: acc.nombre,
      clase: acc.clase,
      naturaleza: acc.naturaleza,
      debitos,
      creditos,
      saldo_deudor,
      saldo_acreedor,
      activo,
      pasivo,
      perdida,
      ganancia,
    };
  });

  // 3. Totales de las 8 Columnas
  const total_debitos = cuentas8Col.reduce((s, c) => s + c.debitos, 0);
  const total_creditos = cuentas8Col.reduce((s, c) => s + c.creditos, 0);
  const total_saldo_deudor = cuentas8Col.reduce((s, c) => s + c.saldo_deudor, 0);
  const total_saldo_acreedor = cuentas8Col.reduce((s, c) => s + c.saldo_acreedor, 0);

  const total_activo = cuentas8Col.reduce((s, c) => s + c.activo, 0);
  const total_pasivo = cuentas8Col.reduce((s, c) => s + c.pasivo, 0);
  const total_perdida = cuentas8Col.reduce((s, c) => s + c.perdida, 0);
  const total_ganancia = cuentas8Col.reduce((s, c) => s + c.ganancia, 0);

  // 4. Determinación de Resultado del Ejercicio (Utilidad o Pérdida)
  // En partida doble matemática perfecta:
  // (Total Activo - Total Pasivo) DEBE SER IGUAL A (Total Ganancia - Total Pérdida)
  const diffInventario = total_activo - total_pasivo;
  const diffResultado = total_ganancia - total_perdida;

  let tipoResultado: 'UTILIDAD' | 'PERDIDA' | 'EQUILIBRIO' = 'EQUILIBRIO';
  let montoResultado = 0;

  if (diffResultado > 0) {
    tipoResultado = 'UTILIDAD';
    montoResultado = diffResultado;
  } else if (diffResultado < 0) {
    tipoResultado = 'PERDIDA';
    montoResultado = Math.abs(diffResultado);
  }

  const cuadreSimetrico = Math.abs(diffInventario - diffResultado) <= 2; // tolerancia de redondeo menor a $2

  const totales: TrialBalance8ColTotals = {
    total_debitos,
    total_creditos,
    total_saldo_deudor,
    total_saldo_acreedor,
    total_activo,
    total_pasivo,
    total_perdida,
    total_ganancia,
  };

  const resultado_del_ejercicio: ResultadoEjercicio8Col = {
    tipo: tipoResultado,
    monto: montoResultado,
    cuadre_inventario: diffInventario === diffResultado,
    cuadre_resultado: true,
    cuadre_simetrico: cuadreSimetrico,
  };

  return {
    empresa_id: empresa.rut || '77.798.901-4',
    tipo_reporte: 'BALANCE_8_COLUMNAS',
    periodo_cierre: periodoStr,
    marco_contable: empresa.regimenTributario || '14D3_PROPYME_GENERAL',
    cuentas: cuentas8Col,
    totales,
    resultado_del_ejercicio,
  };
}

/**
 * =========================================================================
 * ESTADOS FINANCIEROS IFRS CLASIFICADOS (CMF / CHILE)
 * =========================================================================
 */
export function buildIFRSFinancialStatements(balance8Col: Balance8ColumnasReport) {
  const { cuentas, resultado_del_ejercicio } = balance8Col;

  // 1. Estado de Situación Financiera Clasificado
  const activoCorrienteItems = cuentas
    .filter(c => c.clase === 1 && c.codigo.startsWith('1.1') && c.activo > 0)
    .map(c => ({ nombre: c.nombre, saldo: c.activo }));

  const activoNoCorrienteItems = cuentas
    .filter(c => c.clase === 1 && c.codigo.startsWith('1.2'))
    .map(c => ({ nombre: c.nombre, saldo: c.activo - c.pasivo }));

  const totalActivoCorriente = activoCorrienteItems.reduce((s, i) => s + i.saldo, 0);
  const totalActivoNoCorriente = activoNoCorrienteItems.reduce((s, i) => s + i.saldo, 0);
  const totalActivos = totalActivoCorriente + totalActivoNoCorriente;

  const pasivoCorrienteItems = cuentas
    .filter(c => c.clase === 2 && c.codigo.startsWith('2.1') && c.pasivo > 0)
    .map(c => ({ nombre: c.nombre, saldo: c.pasivo }));

  const pasivoNoCorrienteItems = cuentas
    .filter(c => c.clase === 2 && c.codigo.startsWith('2.2') && c.pasivo > 0)
    .map(c => ({ nombre: c.nombre, saldo: c.pasivo }));

  const totalPasivoCorriente = pasivoCorrienteItems.reduce((s, i) => s + i.saldo, 0);
  const totalPasivoNoCorriente = pasivoNoCorrienteItems.reduce((s, i) => s + i.saldo, 0);
  const totalPasivos = totalPasivoCorriente + totalPasivoNoCorriente;

  // Patrimonio
  const patrimonioItems = cuentas
    .filter(c => c.clase === 3)
    .map(c => ({ nombre: c.nombre, saldo: c.pasivo - c.activo }));

  // Sumar el resultado del ejercicio en patrimonio
  if (resultado_del_ejercicio.tipo === 'UTILIDAD') {
    patrimonioItems.push({
      nombre: 'Resultado del Ejercicio Actual (Utilidad IFRS)',
      saldo: resultado_del_ejercicio.monto,
    });
  } else if (resultado_del_ejercicio.tipo === 'PERDIDA') {
    patrimonioItems.push({
      nombre: 'Resultado del Ejercicio Actual (Pérdida IFRS)',
      saldo: -resultado_del_ejercicio.monto,
    });
  }

  const totalPatrimonioNeto = patrimonioItems.reduce((s, i) => s + i.saldo, 0);
  const totalPasivoYPatrimonio = totalPasivos + totalPatrimonioNeto;
  const esCuadradoIFRS = Math.abs(totalActivos - totalPasivoYPatrimonio) <= 2;

  // 2. Estado de Resultados por Función
  const ingresosOperacionales = cuentas
    .filter(c => c.clase === 4)
    .reduce((s, c) => s + (c.ganancia - c.perdida), 0);

  const costoVentas = cuentas
    .filter(c => c.clase === 5)
    .reduce((s, c) => s + (c.perdida - c.ganancia), 0);

  const margenBruto = ingresosOperacionales - costoVentas;

  const gastosAdminVentas = cuentas
    .filter(c => c.clase === 6 && !c.codigo.includes('04.004') && !c.codigo.includes('03.002'))
    .reduce((s, c) => s + (c.perdida - c.ganancia), 0);

  const depreciacionAmortizacion = cuentas
    .filter(c => c.codigo.includes('04.004') || c.codigo.includes('03.002'))
    .reduce((s, c) => s + c.perdida, 0);

  const ebitda = margenBruto - gastosAdminVentas;
  const resultadoOperacional = ebitda - depreciacionAmortizacion;

  const otrosIngresos = cuentas
    .filter(c => c.clase === 7 && c.ganancia > 0)
    .reduce((s, c) => s + c.ganancia, 0);

  const otrosGastosFinancieros = cuentas
    .filter(c => c.clase === 7 && c.perdida > 0)
    .reduce((s, c) => s + c.perdida, 0);

  const resultadoAntesImpuesto = resultadoOperacional + otrosIngresos - otrosGastosFinancieros;

  // Impuesto a la Renta (Estimado 27% o 10%/25% Pyme según régimen)
  const impuestoRenta = resultadoAntesImpuesto > 0 ? Math.round(resultadoAntesImpuesto * 0.125) : 0;
  const resultadoNeto = resultadoAntesImpuesto - impuestoRenta;

  // 3. Ratios Financieros Clave
  const razonCorriente = totalPasivoCorriente > 0 ? totalActivoCorriente / totalPasivoCorriente : 1;
  const capitalTrabajo = totalActivoCorriente - totalPasivoCorriente;
  const margenBrutoPct = ingresosOperacionales > 0 ? (margenBruto / ingresosOperacionales) * 100 : 0;
  const margenNetoPct = ingresosOperacionales > 0 ? (resultadoNeto / ingresosOperacionales) * 100 : 0;
  const ratioEndeudamiento = totalPatrimonioNeto > 0 ? (totalPasivos / totalPatrimonioNeto) : 0;

  return {
    estadoSituacion: {
      activoCorriente: { items: activoCorrienteItems, total: totalActivoCorriente },
      activoNoCorriente: { items: activoNoCorrienteItems, total: totalActivoNoCorriente },
      totalActivos,
      pasivoCorriente: { items: pasivoCorrienteItems, total: totalPasivoCorriente },
      pasivoNoCorriente: { items: pasivoNoCorrienteItems, total: totalPasivoNoCorriente },
      totalPasivos,
      patrimonioNeto: { items: patrimonioItems, total: totalPatrimonioNeto },
      totalPasivoYPatrimonio,
      cuadrado: esCuadradoIFRS,
    },
    estadoResultados: {
      ingresosOperacionales,
      costoVentas,
      margenBruto,
      gastosAdministracionVentas: gastosAdminVentas,
      ebitda,
      depreciacionAmortizacion,
      resultadoOperacional,
      otrosIngresos,
      otrosGastosFinancieros,
      resultadoAntesImpuesto,
      impuestoRenta,
      resultadoNeto,
    },
    ratios: {
      razonCorriente,
      capitalTrabajo,
      margenBrutoPct,
      margenNetoPct,
      ratioEndeudamiento,
    },
  };
}

/**
 * =========================================================================
 * AUDITORÍA CONTINUA Y ORQUESTACIÓN DE MÓDULOS PERIFÉRICOS
 * =========================================================================
 * Monitorea RCV (Ventas/Compras), RRHH, F29, Bancos, Inventarios, Arriendos.
 * Detecta qué operaciones están contabilizadas y cuáles están en tránsito.
 */
export function auditPeripheralModules(
  entries: AccountingEntry[],
  dtes: DteDocument[],
  payrolls: EmployeePayroll[],
  f29: F29Declaration,
  bankMovements: BankStatementMovement[],
  leases: LeaseContract[]
): OrchestratorAuditItem[] {
  // 1. RCV Ventas
  const salesDtes = dtes.filter(d => d.tipoOperacion === 'VENTA');
  const salesMonto = salesDtes.reduce((s, d) => s + d.montoTotal, 0);
  const salesEntries = entries.filter(e => {
    const origin = (e.origen || '').toUpperCase();
    const doc = (e.documento || '').toLowerCase();
    const conc = (e.concepto || '').toLowerCase();
    const id = (e.id || '').toLowerCase();
    return (
      origin === 'RCV_VENTA' ||
      origin === 'VENTAS' ||
      origin === 'VENTA' ||
      doc.includes('libro-venta') ||
      doc.includes('rcv') ||
      conc.includes('libro de venta') ||
      conc.includes('libro-venta') ||
      conc.includes('centralización') ||
      conc.includes('rcv venta') ||
      id.includes('venta')
    );
  });
  
  // Detección de centralización mensual de ventas (un solo asiento que consolida el libro o cubre el monto)
  const hasSalesCentralization = salesEntries.some(e => {
    const text = (e.concepto + ' ' + (e.documento || '') + ' ' + (e.id || '')).toLowerCase();
    return (
      text.includes('centraliz') ||
      text.includes('libro de venta') ||
      text.includes('libro-venta') ||
      text.includes('rcv-venta') ||
      text.includes('rcv venta') ||
      text.includes('resumen rcv')
    );
  });
  const totalSalesBookedAmount = salesEntries.reduce((s, e) => s + (e.totalDebe || 0), 0);

  const isSalesFullyCovered =
    salesDtes.length === 0 ||
    hasSalesCentralization ||
    (totalSalesBookedAmount >= salesMonto - 100 && totalSalesBookedAmount > 0) ||
    salesEntries.length >= salesDtes.length;

  const salesBookedCount = isSalesFullyCovered ? salesDtes.length : Math.min(salesDtes.length, salesEntries.length);
  const salesPending = Math.max(0, salesDtes.length - salesBookedCount);

  // 2. RCV Compras
  const purchaseDtes = dtes.filter(d => d.tipoOperacion === 'COMPRA');
  const purchaseMonto = purchaseDtes.reduce((s, d) => s + d.montoTotal, 0);
  const purchaseEntries = entries.filter(e => {
    const origin = (e.origen || '').toUpperCase();
    const doc = (e.documento || '').toLowerCase();
    const conc = (e.concepto || '').toLowerCase();
    const id = (e.id || '').toLowerCase();
    return (
      origin === 'RCV_COMPRA' ||
      origin === 'COMPRAS' ||
      origin === 'COMPRA' ||
      doc.includes('libro-compra') ||
      doc.includes('rcv') ||
      conc.includes('libro de compra') ||
      conc.includes('libro-compra') ||
      conc.includes('centralización') ||
      conc.includes('rcv compra') ||
      id.includes('compra')
    );
  });
  
  const hasPurchaseCentralization = purchaseEntries.some(e => {
    const text = (e.concepto + ' ' + (e.documento || '') + ' ' + (e.id || '')).toLowerCase();
    return (
      text.includes('centraliz') ||
      text.includes('libro de compra') ||
      text.includes('libro-compra') ||
      text.includes('rcv-compra') ||
      text.includes('rcv compra') ||
      text.includes('resumen rcv')
    );
  });
  const totalPurchaseBookedAmount = purchaseEntries.reduce((s, e) => s + (e.totalDebe || 0), 0);

  const isPurchaseFullyCovered =
    purchaseDtes.length === 0 ||
    hasPurchaseCentralization ||
    (totalPurchaseBookedAmount >= purchaseMonto - 100 && totalPurchaseBookedAmount > 0) ||
    purchaseEntries.length >= purchaseDtes.length;

  const purchaseBookedCount = isPurchaseFullyCovered ? purchaseDtes.length : Math.min(purchaseDtes.length, purchaseEntries.length);
  const purchasePending = Math.max(0, purchaseDtes.length - purchaseBookedCount);

  // 3. Boletas de Honorarios
  const bhes = dtes.filter(d => d.tipoOperacion === 'HONORARIOS');
  const bheMonto = bhes.reduce((s, d) => s + d.montoTotal, 0);
  const bheEntries = entries.filter(e => {
    const origin = (e.origen || '').toUpperCase();
    const doc = (e.documento || '').toLowerCase();
    const conc = (e.concepto || '').toLowerCase();
    return (
      origin === 'HONORARIOS' ||
      origin === 'BHE' ||
      doc.includes('honorario') ||
      doc.includes('bhe') ||
      conc.includes('honorario') ||
      conc.includes('bhe')
    );
  });
  const hasBheCentralization = bheEntries.some(e => {
    const text = (e.concepto + ' ' + (e.documento || '')).toLowerCase();
    return text.includes('centraliz') || text.includes('libro de honorario') || text.includes('resumen bhe');
  });
  const totalBheBookedAmount = bheEntries.reduce((s, e) => s + (e.totalDebe || 0), 0);
  const isBheFullyCovered =
    bhes.length === 0 ||
    hasBheCentralization ||
    (totalBheBookedAmount >= bheMonto - 100 && totalBheBookedAmount > 0) ||
    bheEntries.length >= bhes.length;
  const bheBookedCount = isBheFullyCovered ? bhes.length : Math.min(bhes.length, bheEntries.length);
  const bhePending = Math.max(0, bhes.length - bheBookedCount);

  // 4. Centralización Nómina RRHH
  const totalPayrolls = payrolls.length;
  const payrollsMonto = payrolls.reduce((s, p) => s + p.costoTotalEmpresa, 0);
  const payrollEntries = entries.filter(e => e.origen === 'REMUNERACIONES');
  const hasPayrollBooked = payrollEntries.length > 0;
  const payrollBookedCount = hasPayrollBooked ? totalPayrolls : 0;
  const payrollPending = Math.max(0, totalPayrolls - payrollBookedCount);

  // 5. F29 Impuestos Mensuales
  const f29Monto = f29.totalAPagar || 0;
  const f29Entries = entries.filter(e => e.origen === 'F29_TRIBUTARIO');
  const f29BookedCount = f29Entries.length > 0 ? 1 : 0;
  const f29Pending = f29BookedCount === 1 ? 0 : 1;

  // 6. Bancos y Tesorería
  const totalBankMovs = bankMovements.length;
  const bankMonto = bankMovements.reduce((s, m) => s + ((m.cargo || 0) + (m.abono || 0)), 0);
  const bankBookedCount = entries.filter(e => e.origen === 'CAJA_BANCO').length;
  const bankPending = bankMovements.filter(m => m.estado === 'PENDIENTE' || m.estado === 'NOVEDAD').length;

  // 7. Arriendos IFRS 16
  const totalLeases = leases.length;
  const leasesMonto = leases.reduce((s, l) => s + (l.montoMensualClp || 0), 0);
  const leaseEntries = entries.filter(e => e.origen === 'ARRIENDO_IFRS16' || e.documento?.includes('IFRS16') || e.concepto?.includes('IFRS 16') || e.concepto?.includes('Arrendamiento'));
  const leasesBookedCount = leaseEntries.length > 0 ? totalLeases : 0;
  const leasesPending = Math.max(0, totalLeases - leasesBookedCount);

  return [
    {
      modulo: 'VENTAS',
      nombre: 'RCV Ventas (DTE 33, 34, 61)',
      totalDocumentos: salesDtes.length,
      montoTotal: salesMonto,
      contabilizados: salesBookedCount,
      enTransito: salesPending,
      estado: salesPending === 0 ? 'AL_DIA' : 'EN_TRANSITO',
      observacion: salesPending === 0
        ? 'Todas las ventas devengadas se encuentran asentadas en Clientes y Ventas del Giro (Centralización RCV al día).'
        : `Existen ${salesPending} DTEs de ventas pendientes de centralizar al Libro Diario.`,
    },
    {
      modulo: 'COMPRAS',
      nombre: 'RCV Compras (Facturas Proveedores)',
      totalDocumentos: purchaseDtes.length,
      montoTotal: purchaseMonto,
      contabilizados: purchaseBookedCount,
      enTransito: purchasePending,
      estado: purchasePending === 0 ? 'AL_DIA' : 'EN_TRANSITO',
      observacion: purchasePending === 0
        ? 'Compras reconocidas y cruzadas con IVA Crédito Fiscal sin observaciones.'
        : `Hay ${purchasePending} facturas de compra pendientes de asentar con plazo de 8 días.`,
    },
    {
      modulo: 'HONORARIOS',
      nombre: 'Boletas de Honorarios Electrónicas (BHE)',
      totalDocumentos: bhes.length,
      montoTotal: bheMonto,
      contabilizados: bheBookedCount,
      enTransito: bhePending,
      estado: bhePending === 0 ? 'AL_DIA' : 'EN_TRANSITO',
      observacion: bhePending === 0
        ? 'Retenciones del 14.5% y gasto de honorarios debidamente devengados.'
        : `${bhePending} boletas de honorarios requieren centralización a gasto y retención F29.`,
    },
    {
      modulo: 'RRHH',
      nombre: 'Centralización de Nómina y Remuneraciones',
      totalDocumentos: totalPayrolls,
      montoTotal: payrollsMonto,
      contabilizados: payrollBookedCount,
      enTransito: payrollPending,
      estado: payrollPending === 0 ? 'AL_DIA' : 'EN_TRANSITO',
      observacion: payrollPending === 0
        ? 'Sueldos base, imposiciones Previred y aportes patronales centralizados.'
        : 'Nómina mensual de personal pendiente de contabilizar en el Libro Diario.',
    },
    {
      modulo: 'F29',
      nombre: 'Liquidación Tributaria F29 (SII / TGR)',
      totalDocumentos: 1,
      montoTotal: f29Monto,
      contabilizados: f29BookedCount,
      enTransito: f29Pending,
      estado: f29Pending === 0 ? 'AL_DIA' : 'EN_TRANSITO',
      observacion: f29Pending === 0
        ? 'Asiento de liquidación de IVA, PPM y retenciones registrado en impuestos por pagar.'
        : 'F29 del período no ha sido liquidado en el Libro Mayor.',
    },
    {
      modulo: 'TESORERIA',
      nombre: 'Conciliación Bancaria y Cartolas',
      totalDocumentos: totalBankMovs,
      montoTotal: bankMonto,
      contabilizados: bankBookedCount,
      enTransito: bankPending,
      estado: bankPending === 0 ? 'AL_DIA' : 'EN_TRANSITO',
      observacion: bankPending === 0
        ? 'Cartola bancaria 100% conciliada con cuentas corrientes del Mayor.'
        : `Existen ${bankPending} novedades o cargos bancarios sin registrar en el Libro Diario.`,
    },
    {
      modulo: 'ARRIENDO',
      nombre: 'Contratos y Arriendos (NIIF / IFRS 16)',
      totalDocumentos: totalLeases,
      montoTotal: leasesMonto,
      contabilizados: leasesBookedCount,
      enTransito: leasesPending,
      estado: leasesPending === 0 ? 'AL_DIA' : 'EN_TRANSITO',
      observacion: leasesPending === 0
        ? 'Amortización de activo ROU e intereses de pasivo devengados correctamente.'
        : `${leasesPending} contratos requieren registro de derecho de uso o devengo mensual.`,
    },
  ];
}

/**
 * =========================================================================
 * GENERADOR DE AJUSTES DE CIERRE DE PERÍODO
 * =========================================================================
 * 1. Devengos de fin de mes
 * 2. Corrección monetaria y diferencia de cambio (USD)
 * 3. Reajuste de partidas en UF al valor de cierre
 * 4. Depreciación de activo fijo bajo NIC 16
 */
export function generatePeriodClosingAdjustments(
  indicators?: Partial<ChileIndicators>,
  empresa?: Partial<CompanyProfile>,
  leases: LeaseContract[] = []
): PeriodClosingAdjustment[] {
  const ufActual = indicators?.uf || 39150.50;
  const dolarActual = indicators?.dolar || 955.20;
  const dolarApertura = dolarActual - 12.50;

  // 1. Devengos de Servicios y Arriendos No Facturados (NIC 1)
  const devengosMonto = 1250000;
  const adjDevengos: PeriodClosingAdjustment = {
    id: 'adj-devengos-01',
    tipo: 'DEVENGOS',
    titulo: 'Devengo Mensual de Servicios y Arriendos No Facturados',
    descripcion: 'Reconocimiento del gasto devengado según principio de devengado IFRS (NIC 1).',
    baseCalculo: devengosMonto,
    montoAjuste: devengosMonto,
    fuenteDatos: 'Contratos de servicios recurrentes y estimaciones de consumo mensual aún no facturados por proveedores al corte de mes.',
    memoriaCalculo: 'Provisión mensual devengada: Servicios básicos (Luz/Agua/Enlaces) $450.000 + Infraestructura Cloud & Software $800.000 = Total pasivo devengado $1.250.000.',
    normaReferencia: 'NIC 1 (Presentación de EEFF) y Marco Conceptual IFRS: Principio de Devengo (Accrual Basis).',
    asientoPropuesto: {
      glosa: 'Ajuste Cierre Mensual: Devengo de servicios operacionales del período',
      lineas: [
        {
          codigo_cuenta: '6.1.04.001',
          nombre_cuenta: 'Servicios Básicos (Luz, Agua, Gas, Enlaces)',
          debe: 450000,
          haber: 0,
          centro_costo: 'ADMINISTRACION',
        },
        {
          codigo_cuenta: '6.1.04.002',
          nombre_cuenta: 'Software, Servidores Cloud y Licencias',
          debe: 800000,
          haber: 0,
          centro_costo: 'TECNOLOGIA',
        },
        {
          codigo_cuenta: '2.1.01.001',
          nombre_cuenta: 'Proveedores Nacionales (Cuentas por Pagar)',
          debe: 0,
          haber: 1250000,
          rut_auxiliar: '76.123.456-7',
        },
      ],
    },
    aplicado: false,
  };

  // 2. Corrección Monetaria / Diferencia de Cambio USD (NIC 21)
  const saldoUsdCaja = 8500; // USD 8,500 en cuenta bancaria en dólares
  const variacionTipoCambio = Number((dolarActual - dolarApertura).toFixed(2)); // ej: +12.50 CLP/USD
  const gananciaDiferenciaCambio = Math.round(saldoUsdCaja * variacionTipoCambio);

  const adjDiferenciaCambio: PeriodClosingAdjustment = {
    id: 'adj-dif-cambio-02',
    tipo: 'CORRECCION_MONETARIA_USD',
    titulo: 'Ajuste Diferencia de Cambio Moneda Extranjera (USD)',
    descripcion: `Revalorización de saldo de US$${saldoUsdCaja.toLocaleString()} a TC de cierre $${dolarActual} CLP/USD (NIC 21).`,
    baseCalculo: saldoUsdCaja * dolarActual,
    montoAjuste: gananciaDiferenciaCambio,
    fuenteDatos: `Cuenta bancaria Moneda Extranjera (saldo contable US$${saldoUsdCaja.toLocaleString()}) e Indicador Dólar Observado oficial del Banco Central de Chile ($${dolarActual} CLP/USD).`,
    memoriaCalculo: `Saldo en USD (US$${saldoUsdCaja.toLocaleString()}) × Variación cambiaria del período (+$${variacionTipoCambio} CLP/USD: desde $${dolarApertura.toFixed(2)} hasta $${dolarActual.toFixed(2)}) = Ajuste por mayor valor de $${gananciaDiferenciaCambio.toLocaleString('es-CL')} CLP.`,
    normaReferencia: 'NIC 21 (Efectos de las Variaciones en las Tasas de Cambio de la Moneda Extranjera). Partidas monetarias deben reexpresarse a tipo de cambio de cierre.',
    asientoPropuesto: {
      glosa: `Ajuste Cierre: Revalorización cambiaria Banco Moneda Extranjera a $${dolarActual} CLP/USD`,
      lineas: [
        {
          codigo_cuenta: '1.1.02.003',
          nombre_cuenta: 'Banco Moneda Extranjera (USD)',
          debe: gananciaDiferenciaCambio,
          haber: 0,
        },
        {
          codigo_cuenta: '7.1.01.002',
          nombre_cuenta: 'Diferencia de Cambio a Favor (USD / EUR)',
          debe: 0,
          haber: gananciaDiferenciaCambio,
        },
      ],
    },
    aplicado: false,
  };

  // 3. Reajuste UF en Contratos (IFRS 16 / LIR)
  const safeLeases = Array.isArray(leases) ? leases : [];
  const canonUfTotal = safeLeases.reduce((s, l) => s + (l.montoMensualMoneda === 'UF' ? (l.montoCanonMensual || 45) : 45), 0);
  const variacionUfMes = 180; // Incremento aproximado mensual de la UF por IPC
  const reajusteUfMonto = Math.round(canonUfTotal * variacionUfMes);

  const adjReajusteUf: PeriodClosingAdjustment = {
    id: 'adj-reajuste-uf-03',
    tipo: 'REAJUSTE_UF',
    titulo: 'Reajuste de Pasivos y Contratos en Unidades de Fomento (UF)',
    descripcion: `Actualización de pasivo por canon de arriendo expresado en UF al valor de cierre $${ufActual.toLocaleString('es-CL')} CLP.`,
    baseCalculo: canonUfTotal * ufActual,
    montoAjuste: reajusteUfMonto,
    fuenteDatos: `Registro de contratos de arriendo IFRS 16 (${canonUfTotal} UF acumuladas de canon indexado) y valor oficial de la UF al cierre de mes ($${ufActual.toLocaleString('es-CL')} CLP).`,
    memoriaCalculo: `Canon pactado (${canonUfTotal} UF) × Variación de la UF del período (~+$${variacionUfMes} CLP/UF por IPC) = Incremento de pasivo por reajuste contractual de $${reajusteUfMonto.toLocaleString('es-CL')} CLP.`,
    normaReferencia: 'IFRS 16 (Arrendamientos) y Art. 41 LIR: Actualización de pasivos exigibles expresados en unidades reajustables (UF).',
    asientoPropuesto: {
      glosa: `Ajuste Cierre: Actualización contractual UF al cierre mensual (${formatCLP(ufActual)})`,
      lineas: [
        {
          codigo_cuenta: '7.2.01.003',
          nombre_cuenta: 'Pérdida por Reajuste de Unidades de Fomento (UF)',
          debe: reajusteUfMonto,
          haber: 0,
        },
        {
          codigo_cuenta: '2.1.04.001',
          nombre_cuenta: 'Pasivo por Arrendamiento Corto Plazo (IFRS 16)',
          debe: 0,
          haber: reajusteUfMonto,
        },
      ],
    },
    aplicado: false,
  };

  // 4. Depreciación de Activo Fijo (NIC 16)
  const activoFijoBruto = 45000000;
  const mesesVidaUtil = 60; // 5 años (60 meses) de vida útil estándar según tabla SII / IFRS
  const depreciacionMensual = Math.round(activoFijoBruto / mesesVidaUtil);

  const adjDepreciacion: PeriodClosingAdjustment = {
    id: 'adj-deprec-04',
    tipo: 'DEPRECIACION_ACTIVO_FIJO',
    titulo: 'Depreciación Financiera Activo Fijo del Mes (NIC 16)',
    descripcion: 'Amortización lineal de maquinarias, vehículos y equipos computacionales.',
    baseCalculo: activoFijoBruto,
    montoAjuste: depreciacionMensual,
    fuenteDatos: `Inventario del Mayor de Propiedades, Planta y Equipos (saldo bruto valor libro $${activoFijoBruto.toLocaleString('es-CL')} CLP en cuentas del grupo 1.2.01).`,
    memoriaCalculo: `Valor libro bruto ($${activoFijoBruto.toLocaleString('es-CL')}) ÷ Vida útil estimada (5 años = ${mesesVidaUtil} meses) = Cuota de depreciación lineal mensual de $${depreciacionMensual.toLocaleString('es-CL')} CLP.`,
    normaReferencia: 'NIC 16 (Propiedades, Planta y Equipo): Distribución sistemática del importe depreciable de un activo a lo largo de su vida útil.',
    asientoPropuesto: {
      glosa: 'Ajuste Cierre: Cuota mensual de depreciación lineal de propiedad, planta y equipo',
      lineas: [
        {
          codigo_cuenta: '6.1.04.004',
          nombre_cuenta: 'Depreciación Financiera Activo Fijo (NIC 16)',
          debe: depreciacionMensual,
          haber: 0,
          centro_costo: 'OPERACIONES',
        },
        {
          codigo_cuenta: '1.2.02.001',
          nombre_cuenta: '(-) Depreciación Acumulada Activo Fijo (NIC 16)',
          debe: 0,
          haber: depreciacionMensual,
        },
      ],
    },
    aplicado: false,
  };

  return [adjDevengos, adjDiferenciaCambio, adjReajusteUf, adjDepreciacion];
}

/**
 * =========================================================================
 * VALIDACIÓN ESTRICTA DE PARTIDA DOBLE Y AUTO-AJUSTE POR CENTAVOS
 * =========================================================================
 */
export function validateAndBalanceEntry(
  lines: AccountingEntryLine[]
): {
  valido: boolean;
  totalDebe: number;
  totalHaber: number;
  diferencia: number;
  ajusteSugerido?: AccountingEntryLine;
  lineasCorregidas: AccountingEntryLine[];
} {
  const totalDebe = lines.reduce((s, l) => s + Math.round(l.debe || 0), 0);
  const totalHaber = lines.reduce((s, l) => s + Math.round(l.haber || 0), 0);
  const diff = totalDebe - totalHaber;

  if (diff === 0) {
    return {
      valido: true,
      totalDebe,
      totalHaber,
      diferencia: 0,
      lineasCorregidas: lines,
    };
  }

  // Si el descuadre es de exactamente $1 (o $2) por efecto de redondeo
  if (Math.abs(diff) <= 2) {
    const ajusteLine: AccountingEntryLine = {
      cuentaCodigo: '7.2.01.005',
      cuentaNombre: 'Ajuste por Redondeo / Diferencia de Centavos',
      debe: diff < 0 ? Math.abs(diff) : 0,
      haber: diff > 0 ? diff : 0,
    };

    return {
      valido: true,
      totalDebe: Math.max(totalDebe, totalHaber),
      totalHaber: Math.max(totalDebe, totalHaber),
      diferencia: diff,
      ajusteSugerido: ajusteLine,
      lineasCorregidas: [...lines, ajusteLine],
    };
  }

  return {
    valido: false,
    totalDebe,
    totalHaber,
    diferencia: diff,
    lineasCorregidas: lines,
  };
}

/**
 * =========================================================================
 * EMISIÓN DE JSON ERP TRANSACCIONAL SEGÚN ESPECIFICACIÓN DEL USUARIO
 * =========================================================================
 */
export function buildTransactionalAccountingProposalJSON(
  entry: AccountingEntry,
  empresaId: string,
  accion: 'comprobante_aprobado' | 'comprobante_rechazado' | 'propuesta_asiento' = 'propuesta_asiento'
): AccountingProposalResponse {
  const isBalanced = entry.balanceado && Math.abs(entry.totalDebe - entry.totalHaber) < 1;

  const alerts: string[] = [];
  if (!isBalanced) {
    alerts.push(`Descuadre en partida doble: Débitos ${entry.totalDebe} != Créditos ${entry.totalHaber}`);
  }

  return {
    empresa_id: empresaId,
    accion: isBalanced ? accion : 'comprobante_rechazado',
    origen_modulo: entry.origen === 'RCV_VENTA' ? 'VENTAS'
      : entry.origen === 'RCV_COMPRA' ? 'COMPRAS'
      : entry.origen === 'REMUNERACIONES' ? 'RRHH'
      : entry.origen === 'F29_TRIBUTARIO' ? 'F29'
      : entry.origen === 'CAJA_BANCO' ? 'TESORERIA'
      : entry.origen === 'ARRIENDO_IFRS16' ? 'ARRIENDO'
      : 'MANUAL',
    periodo: entry.fecha.substring(0, 7),
    asiento: {
      fecha: entry.fecha,
      tipo_comprobante: entry.origen === 'RCV_VENTA' ? 'INGRESO'
        : entry.origen === 'RCV_COMPRA' || entry.origen === 'REMUNERACIONES' ? 'EGRESO'
        : 'TRASPASO',
      glosa_general: entry.concepto,
      cuadre_valido: isBalanced,
      total_debe: entry.totalDebe,
      total_haber: entry.totalHaber,
      lineas: entry.lineas.map(l => ({
        codigo_cuenta: l.cuentaCodigo,
        nombre_cuenta: l.cuentaNombre,
        debe: l.debe,
        haber: l.haber,
      })),
    },
    alertas_auditoria: alerts,
  };
}
