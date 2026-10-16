import {
  FinancialStatementNote,
  FinancialStatementNoteItem,
  HierarchicalAccountItem,
  Balance8ColumnasReport,
  ClientCompany,
} from '../types';

/**
 * Catálogo Maestro Estándar de Notas a los Estados Financieros
 * Basado en Normas Internacionales de Información Financiera (NIIF / IFRS)
 * y Circular N° 1.501 de la Comisión para el Mercado Financiero (CMF Chile).
 */
export const DEFAULT_FINANCIAL_NOTES_CATALOG: Omit<FinancialStatementNote, 'id' | 'empresaRut'>[] = [
  {
    numero: 1,
    titulo: 'Identificación de la Sociedad y Objeto Social',
    categoria: 'IDENTIFICACION_EMPRESA',
    normaReferencia: 'NIC_1',
    cuentasAsociadas: [],
    estado: 'DICTAMINADA',
    contenido:
      'La entidad es una sociedad legalmente constituida en la República de Chile, regida por sus estatutos sociales y la legislación mercantil y tributaria chilena vigente. Su domicilio principal se encuentra radicado en Santiago de Chile. El objeto social de la compañía comprende el desarrollo de actividades comerciales, prestación de servicios especializados y enajenación de bienes corporales muebles del giro. Los presentes estados financieros han sido preparados sobre la base de empresa en marcha, asumiendo que la entidad continuará en operaciones durante el futuro previsible.',
  },
  {
    numero: 2,
    titulo: 'Resumen de Principales Políticas y Criterios Contables',
    categoria: 'POLITICAS_CONTABLES',
    normaReferencia: 'NIC_1',
    cuentasAsociadas: [],
    estado: 'DICTAMINADA',
    contenido:
      'Los estados financieros adjuntos han sido preparados de acuerdo con las Normas Internacionales de Información Financiera (NIIF / IFRS) emitidas por el International Accounting Standards Board (IASB) y las disposiciones e instrucciones dictadas por la Comisión para el Mercado Financiero (CMF) de Chile. La moneda funcional y de presentación de la entidad es el Peso Chileno (CLP), la cual refleja el entorno económico principal en que opera. Las estimaciones contables y juicios críticos son revisados periódicamente por la administración superior y se basan en la experiencia histórica y mejores prácticas de auditoría.',
  },
  {
    numero: 3,
    titulo: 'Efectivo y Equivalentes al Efectivo',
    categoria: 'ACTIVO_CORRIENTE',
    normaReferencia: 'NIC_7',
    cuentasAsociadas: ['1.1.01.001', '1.1.01.002', '1.1.02.001', '1.1.02.002', '1.1.02.003'],
    estado: 'DICTAMINADA',
    contenido:
      'El efectivo y equivalentes al efectivo comprende los saldos mantenidos en caja en efectivo, fondos fijos operacionales y depósitos a la vista en instituciones bancarias fiscalizadas por la CMF. Los fondos en moneda extranjera (USD) se valorizan al tipo de cambio de cierre informado por el Banco Central de Chile. Al cierre del periodo, todos los recursos son de inmediata y libre disponibilidad, no existiendo embargos, garantías de terceros ni restricciones sobre los fondos monetarios.',
  },
  {
    numero: 4,
    titulo: 'Deudores Comerciales y Otras Cuentas por Cobrar',
    categoria: 'ACTIVO_CORRIENTE',
    normaReferencia: 'NIIF_9',
    cuentasAsociadas: ['1.1.03.001', '1.1.03.002', '1.1.03.003'],
    estado: 'DICTAMINADA',
    contenido:
      'Los deudores comerciales corresponden a créditos otorgados a clientes nacionales y del exterior por concepto de ventas y servicios prestados en el curso ordinario de los negocios. Se registran inicialmente al precio de la transacción y con posterioridad al costo amortizado, deduciendo la estimación por deterioro bajo el modelo de pérdidas crediticias esperadas (NIIF 9). Las condiciones promedio de crédito son de 30 a 60 días sin interés devengado. La administración evalúa trimestralmente la solvencia y comportamiento histórico de la cartera.',
  },
  {
    numero: 5,
    titulo: 'Existencias e Inventarios de Mercaderías',
    categoria: 'ACTIVO_CORRIENTE',
    normaReferencia: 'NIC_2',
    cuentasAsociadas: ['1.1.05.001', '1.1.05.002'],
    estado: 'DICTAMINADA',
    contenido:
      'Las existencias se valorizan al costo de adquisición o al Valor Neto Realizable (VNR), el que resulte menor. El costo de los inventarios se determina mediante la fórmula de Precio Medio Ponderado (PMP). El costo incluye el precio de compra, aranceles aduaneros, fletes y otros costos directamente atribuibles a la adquisición. La entidad realiza tomas de inventario físico periódicas. Al cierre, no existen existencias gravadas en prenda o garantía ni provisiones por obsolescencia material.',
  },
  {
    numero: 6,
    titulo: 'Impuestos Corrientes y Créditos Fiscales Recuperables',
    categoria: 'ACTIVO_CORRIENTE',
    normaReferencia: 'NIC_12',
    cuentasAsociadas: ['1.1.04.001', '1.1.04.002', '1.1.04.003'],
    estado: 'DICTAMINADA',
    contenido:
      'Los créditos fiscales recuperables representan saldos a favor de la empresa ante el Servicio de Impuestos Internos (SII) y la Tesorería General de la República (TGR). Incluyen principalmente el remanente de Crédito Fiscal del Impuesto al Valor Agregado (IVA Art. 23 DL 825) originado por adquisiciones respaldadas en el Registro de Compras (RCV), los Pagos Provisionales Mensuales (PPM) acumulados del ejercicio para imputar al Impuesto de Primera Categoría (F22), y retenciones tributarias a favor.',
  },
  {
    numero: 7,
    titulo: 'Propiedades, Planta y Equipo (Activo Fijo Físico)',
    categoria: 'ACTIVO_NO_CORRIENTE',
    normaReferencia: 'NIC_16',
    cuentasAsociadas: ['1.2.01.001', '1.2.01.002', '1.2.01.003', '1.2.02.001', '1.2.02.002'],
    estado: 'DICTAMINADA',
    contenido:
      'Los activos fijos se miden al costo de adquisición histórico menos la depreciación acumulada y cualquier pérdida por deterioro acumulada, de acuerdo al modelo del costo de la NIC 16. La depreciación se reconoce linealmente sobre la base de la vida útil técnica estimada de los bienes (Equipos computacionales: 3 años; Muebles e instalaciones: 7 años; Maquinarias: 10 años). Los desembolsos posteriores por mantenimiento menor se imputan directamente a resultados del periodo.',
  },
  {
    numero: 8,
    titulo: 'Activos y Pasivos por Derecho de Uso (Arrendamientos)',
    categoria: 'ACTIVO_NO_CORRIENTE',
    normaReferencia: 'NIIF_16',
    cuentasAsociadas: ['1.2.03.001', '2.1.04.001', '2.2.02.001'],
    estado: 'DICTAMINADA',
    contenido:
      'En aplicación de la NIIF 16 sobre Arrendamientos, la sociedad reconoce al inicio del contrato un activo por derecho de uso que representa el derecho a utilizar el bien subyacente y un pasivo por arrendamiento por el valor presente de los pagos futuros. La tasa de descuento aplicada es la tasa incremental de endeudamiento del arrendatario en UF/CLP. Se amortizan de forma sistemática durante el plazo contractual pactado.',
  },
  {
    numero: 9,
    titulo: 'Cuentas por Pagar Comerciales y Proveedores',
    categoria: 'PASIVO_CORRIENTE',
    normaReferencia: 'NIIF_9',
    cuentasAsociadas: ['2.1.01.001', '2.1.01.002'],
    estado: 'DICTAMINADA',
    contenido:
      'Las cuentas por pagar comerciales corresponden a obligaciones contraídas con proveedores nacionales y extranjeros por adquisiciones de bienes y servicios vinculados al giro ordinario de la empresa. Se registran al valor nominal de las facturas debidamente recepcionadas y aceptadas en el RCV del SII. La entidad mantiene una estricta política de cumplimiento conforme a la Ley N° 21.131 de Pago Oportuno a 30 Días, no registrándose intereses ni recargos por mora al cierre del periodo.',
  },
  {
    numero: 10,
    titulo: 'Obligaciones Laborales y con el Personal',
    categoria: 'PASIVO_CORRIENTE',
    normaReferencia: 'NIC_19',
    cuentasAsociadas: ['2.1.02.001', '2.1.02.002', '2.1.02.003', '2.1.02.004'],
    estado: 'DICTAMINADA',
    contenido:
      'Comprende las remuneraciones mensuales devengadas a favor de los colaboradores, gratificaciones legales obligatorias (Art. 50 Código del Trabajo), imposiciones de seguridad social por enterar a través de Previred (AFP, Fonasa/Isapre, AFC, Mutual de Seguridad), y la provisión por feriado anual o proporcional (vacaciones) devengado por el personal de acuerdo a la NIC 19 de Beneficios a los Empleados.',
  },
  {
    numero: 11,
    titulo: 'Impuestos Fiscales y Retenciones F29 por Pagar',
    categoria: 'PASIVO_CORRIENTE',
    normaReferencia: 'NIC_12',
    cuentasAsociadas: ['2.1.03.001', '2.1.03.002', '2.1.03.003'],
    estado: 'DICTAMINADA',
    contenido:
      'Registra las deudas tributarias corrientes exigibles ante el Fisco por concepto de Impuesto al Valor Agregado (IVA Débito Fiscal sobre ventas facturadas y boletas emitidas), retenciones sobre honorarios profesionales de segunda categoría (tasa vigente 14.5% para el ejercicio 2026), retenciones del Impuesto Único de Segunda Categoría a las remuneraciones, e impuesto de retención sobre remesas.',
  },
  {
    numero: 12,
    titulo: 'Obligaciones con Bancos e Instituciones Financieras',
    categoria: 'PASIVO_CORRIENTE',
    normaReferencia: 'NIIF_9',
    cuentasAsociadas: ['2.1.05.001', '2.2.01.001'],
    estado: 'DICTAMINADA',
    contenido:
      'Los pasivos financieros representan créditos comerciales, líneas de sobregiro y préstamos en cuotas pactados con entidades bancarias fiscalizadas en Chile. Se contabilizan a su costo amortizado utilizando la tasa de interés efectiva. La porción exigible dentro de los 12 meses siguientes se clasifica en el pasivo corriente, en tanto las obligaciones a plazo superior a un año se presentan en el pasivo no corriente.',
  },
  {
    numero: 13,
    titulo: 'Patrimonio Neto y Estructura de Capital',
    categoria: 'PATRIMONIO_NETO',
    normaReferencia: 'NIC_1',
    cuentasAsociadas: ['3.1.01.001', '3.1.02.001', '3.1.03.001'],
    estado: 'DICTAMINADA',
    contenido:
      'El capital social de la compañía se encuentra íntegramente suscrito y pagado según consta en la escritura pública de constitución e inscripciones en el Registro de Comercio del Conservador de Bienes Raíces. Los resultados acumulados corresponden a las utilidades retenidas o pérdidas tributarias/financieras de ejercicios anteriores. El resultado del ejercicio actual refleja la utilidad o pérdida neta devengada al cierre, antes o después de la provisión de impuesto a la renta.',
  },
  {
    numero: 14,
    titulo: 'Ingresos de Actividades Ordinarias',
    categoria: 'INGRESOS_OPERACIONALES',
    normaReferencia: 'NIIF_15',
    cuentasAsociadas: ['4.1.01.001', '4.1.02.001'],
    estado: 'DICTAMINADA',
    contenido:
      'Los ingresos procedentes de contratos con clientes se reconocen cuando se satisfacen las obligaciones de desempeño mediante la entrega y transferencia de control de los productos o la prestación de los servicios contratados, aplicando el modelo de 5 pasos prescrito por la NIIF 15. Los ingresos se presentan netos de descuentos comerciales, devoluciones e Impuesto al Valor Agregado (IVA).',
  },
  {
    numero: 15,
    titulo: 'Costos de Explotación y Ventas',
    categoria: 'COSTOS_Y_GASTOS',
    normaReferencia: 'NIC_2',
    cuentasAsociadas: ['5.1.01.001', '5.1.01.002'],
    estado: 'DICTAMINADA',
    contenido:
      'El costo de ventas incluye el costo directo de adquisición de las mercaderías vendidas y los costos directamente incurridos en la prestación de los servicios comerciales que generaron los ingresos operacionales del periodo. Dicho costo se asocia directamente a la facturación de acuerdo al principio contable de correlación entre ingresos y gastos.',
  },
  {
    numero: 16,
    titulo: 'Gastos de Administración y Ventas (Operacionales)',
    categoria: 'COSTOS_Y_GASTOS',
    normaReferencia: 'NIC_1',
    cuentasAsociadas: ['6.1.01.001', '6.1.01.002', '6.1.02.001', '6.1.03.001', '6.1.04.001'],
    estado: 'DICTAMINADA',
    contenido:
      'Los gastos de administración y comercialización corresponden a los desembolsos necesarios para la gestión corporativa, dirección ejecutiva, honorarios profesionales por auditoría y asesorías jurídicas, consumo de suministros, servicios de telecomunicaciones, arriendos operativos y depreciaciones operacionales de soporte.',
  },
  {
    numero: 17,
    titulo: 'Resultados Financieros, Reajustes y Diferencias de Cambio',
    categoria: 'RESULTADO_FINANCIERO',
    normaReferencia: 'NIC_21',
    cuentasAsociadas: ['7.1.01.001', '7.2.01.001'],
    estado: 'DICTAMINADA',
    contenido:
      'Comprende los ingresos y gastos financieros generados en el periodo por concepto de comisiones bancarias, intereses devengados en colocaciones y créditos, reajustes por variación de la Unidad de Fomento (UF) o Índice de Precios al Consumidor (IPC), y las diferencias de cambio netas originadas por activos y pasivos monetarios pactados en moneda extranjera (USD / EUR) conforme a la NIC 21.',
  },
  {
    numero: 18,
    titulo: 'Contingencias, Litigios y Hechos Posteriores al Cierre',
    categoria: 'CONTINGENCIAS_Y_HECHOS_POSTERIORES',
    normaReferencia: 'NIC_10',
    cuentasAsociadas: [],
    estado: 'DICTAMINADA',
    contenido:
      'A la fecha de cierre de los presentes estados financieros, la administración de la sociedad manifiesta que no existen litigios, reclamos laborales, controversias tributarias ante el Tribunal Tributario y Aduanero (TTA) ni contingencias de cuantía relevante que no se encuentren debidamente cubiertas por provisiones técnicas. Asimismo, entre la fecha de cierre del periodo y la fecha de autorización para la emisión de los presentes estados financieros, no han acaecido hechos posteriores de orden financiero, económico o legal que ameriten ajuste o revelación adicional.',
  },
];

/**
 * Storage key helper
 */
function getNotesStorageKey(empresaRut: string): string {
  const cleanRut = (empresaRut || 'default').replace(/[^a-zA-Z0-9]/g, '_');
  return `senior_orchestrator_financial_notes_${cleanRut}`;
}

/**
 * Sugerir números de notas para una cuenta contable según su código y nombre
 */
export function inferDefaultNoteNumbers(account: { codigo: string; nombre?: string; manejaMultimoneda?: boolean }): number[] {
  const code = account.codigo;
  const name = (account.nombre || '').toLowerCase();
  const notes: number[] = [];

  if (code.startsWith('1.1.01') || code.startsWith('1.1.02') || name.includes('caja') || (name.includes('banco') && !name.includes('credito'))) {
    notes.push(3);
  }
  if (code.startsWith('1.1.03') || name.includes('cliente') || name.includes('deudor')) {
    notes.push(4);
  }
  if (code.startsWith('1.1.05') || name.includes('existencia') || name.includes('inventario') || name.includes('mercader')) {
    notes.push(5);
  }
  if (code.startsWith('1.1.04') || name.includes('iva credito') || name.includes('iva crédito') || name.includes('ppm') || name.includes('remanente')) {
    notes.push(6);
  }
  if (code.startsWith('1.2.01') || code.startsWith('1.2.02') || (code.startsWith('1.2') && !code.startsWith('1.2.03'))) {
    notes.push(7);
  }
  if (code.startsWith('1.2.03') || code.startsWith('2.1.04') || code.startsWith('2.2.02') || name.includes('derecho de uso') || name.includes('ifrs 16') || name.includes('arrendamiento lp')) {
    notes.push(8);
  }
  if (code.startsWith('2.1.01') || name.includes('proveedor') || name.includes('cuentas por pagar')) {
    notes.push(9);
  }
  if (code.startsWith('2.1.02') || name.includes('sueldo') || name.includes('remuneraci') || name.includes('leyes sociales') || name.includes('honorarios por pagar')) {
    notes.push(10);
  }
  if (code.startsWith('2.1.03') || name.includes('iva debito') || name.includes('iva débito') || name.includes('retenci')) {
    notes.push(11);
  }
  if (code.startsWith('2.1.05') || code.startsWith('2.2.01') || name.includes('prestamo') || name.includes('préstamo') || name.includes('credito bancario') || name.includes('crédito bancario')) {
    notes.push(12);
  }
  if (code.startsWith('3.') || name.includes('capital social') || name.includes('patrimonio') || name.includes('resultado acumulado') || name.includes('utilidad del ejercicio')) {
    notes.push(13);
  }
  if (code.startsWith('4.') || name.includes('ingreso') || name.includes('venta')) {
    notes.push(14);
  }
  if (code.startsWith('5.') || name.includes('costo de venta') || name.includes('costo directo')) {
    notes.push(15);
  }
  if (code.startsWith('6.') || name.includes('gasto') || name.includes('administraci') || name.includes('asesoria') || name.includes('publicidad')) {
    notes.push(16);
  }
  if (code.startsWith('7.') || name.includes('diferencia de cambio') || name.includes('interes') || name.includes('interés') || name.includes('financier') || account.manejaMultimoneda) {
    if (!notes.includes(17)) {
      notes.push(17);
    }
  }

  return notes;
}

/**
 * Cargar notas a los estados financieros de una empresa
 */
export function loadCompanyFinancialNotes(empresaRut: string, chart?: HierarchicalAccountItem[]): FinancialStatementNote[] {
  const key = getNotesStorageKey(empresaRut);
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error leyendo notas a los EE.FF. desde localStorage:', e);
  }

  // Generar notas iniciales estándar personalizadas para la empresa
  const initialNotes: FinancialStatementNote[] = DEFAULT_FINANCIAL_NOTES_CATALOG.map((base) => {
    // Si tenemos el plan de cuentas, enriquecer cuentasAsociadas con las cuentas existentes que apliquen
    let cuentas = [...base.cuentasAsociadas];
    if (chart && chart.length > 0) {
      const matchingCodes = chart
        .filter((acc) => {
          if (acc.notasExplicativas && acc.notasExplicativas.includes(base.numero)) {
            return true;
          }
          const inferred = inferDefaultNoteNumbers(acc);
          return inferred.includes(base.numero);
        })
        .map((a) => a.codigo);

      cuentas = Array.from(new Set([...cuentas, ...matchingCodes]));
    }

    return {
      ...base,
      id: `note-${base.numero}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      empresaRut,
      cuentasAsociadas: cuentas,
      ultimaModificacion: new Date().toISOString(),
      modificadoPor: 'Agente Orquestador Contable Senior (NIIF/CMF)',
    };
  });

  saveCompanyFinancialNotes(empresaRut, initialNotes);
  return initialNotes;
}

/**
 * Guardar notas a los estados financieros de la empresa (Sincronización Local + Servidor Multi-Usuario)
 */
export function saveCompanyFinancialNotes(empresaRut: string, notes: FinancialStatementNote[]): void {
  const key = getNotesStorageKey(empresaRut);
  try {
    localStorage.setItem(key, JSON.stringify(notes));
  } catch (e) {
    console.error('Error guardando notas a los EE.FF. en localStorage:', e);
  }

  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(
        new CustomEvent('companyFinancialNotesUpdated', {
          detail: { empresaRut, notes },
        })
      );
    } catch {}
  }

  if (typeof fetch !== 'undefined') {
    fetch('/api/accounting/financial-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ empresaId: empresaRut, notes }),
    }).catch(() => {});
  }
}

/**
 * Obtener notas a los estados financieros actualizadas desde el Servidor
 */
export async function fetchCompanyFinancialNotes(empresaRut: string, chart?: HierarchicalAccountItem[]): Promise<FinancialStatementNote[]> {
  try {
    const res = await fetch(`/api/accounting/financial-notes?empresaId=${encodeURIComponent(empresaRut)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        const key = getNotesStorageKey(empresaRut);
        try {
          localStorage.setItem(key, JSON.stringify(json.data));
        } catch {}
        return json.data;
      }
    }
  } catch (err) {
    console.warn('[FinancialNotesService] Error al obtener notas del servidor:', err);
  }
  return loadCompanyFinancialNotes(empresaRut, chart);
}

/**
 * Sincronizar bidireccionalmente el plan de cuentas y las notas explicativas
 */
export function syncChartWithNotes(
  chart: HierarchicalAccountItem[],
  notes: FinancialStatementNote[]
): {
  syncedChart: HierarchicalAccountItem[];
  syncedNotes: FinancialStatementNote[];
} {
  // 1. Construir mapa de cuentas -> números de notas desde las notas
  const accountToNotesMap = new Map<string, Set<number>>();
  notes.forEach((note) => {
    note.cuentasAsociadas.forEach((code) => {
      if (!accountToNotesMap.has(code)) {
        accountToNotesMap.set(code, new Set());
      }
      accountToNotesMap.get(code)!.add(note.numero);
    });
  });

  // 2. Si alguna cuenta tiene notasExplicativas explícitas, asegurar que la nota correspondiente la tenga
  const noteToAccountsMap = new Map<number, Set<string>>();
  notes.forEach((n) => noteToAccountsMap.set(n.numero, new Set(n.cuentasAsociadas)));

  const syncedChart = chart.map((acc) => {
    const existingExplicitNotes = acc.notasExplicativas || [];
    existingExplicitNotes.forEach((num) => {
      if (noteToAccountsMap.has(num)) {
        noteToAccountsMap.get(num)!.add(acc.codigo);
      }
    });

    const notesFromNotes = accountToNotesMap.get(acc.codigo)
      ? Array.from(accountToNotesMap.get(acc.codigo)!)
      : [];

    const mergedNotes = Array.from(new Set([...existingExplicitNotes, ...notesFromNotes])).sort((a, b) => a - b);

    return {
      ...acc,
      notasExplicativas: mergedNotes.length > 0 ? mergedNotes : undefined,
    };
  });

  const syncedNotes = notes.map((n) => ({
    ...n,
    cuentasAsociadas: Array.from(noteToAccountsMap.get(n.numero) || []).sort(),
  }));

  return { syncedChart, syncedNotes };
}

/**
 * Calcular en tiempo real el desglose de partidas auditadas para una Nota
 */
export function computeNoteBreakdown(
  note: FinancialStatementNote,
  balance8Col: Balance8ColumnasReport,
  chart: HierarchicalAccountItem[]
): {
  items: FinancialStatementNoteItem[];
  totalDebe: number;
  totalHaber: number;
  totalSaldoFinal: number;
} {
  const chartMap = new Map(chart.map((a) => [a.codigo, a]));
  const balanceMap = new Map(balance8Col.cuentas.map((c) => [c.codigo, c]));

  const rawItems: FinancialStatementNoteItem[] = note.cuentasAsociadas.map((codigo) => {
    const chartAcc = chartMap.get(codigo);
    const balAcc = balanceMap.get(codigo);

    const nombre = chartAcc?.nombre || balAcc?.nombre || `Cuenta ${codigo}`;
    const clase = chartAcc?.clase || balAcc?.clase || 1;
    const naturaleza = chartAcc?.naturaleza || balAcc?.naturaleza || (clase === 1 || clase === 5 || clase === 6 ? 'DEUDORA' : 'ACREEDORA');

    const debe = balAcc?.debitos || 0;
    const haber = balAcc?.creditos || 0;
    const saldoDeudor = balAcc?.saldo_deudor || 0;
    const saldoAcreedor = balAcc?.saldo_acreedor || 0;

    // Saldo Final según la naturaleza contable
    let saldoFinal = 0;
    if (naturaleza === 'DEUDORA') {
      saldoFinal = saldoDeudor > 0 ? saldoDeudor : (debe - haber);
    } else {
      saldoFinal = saldoAcreedor > 0 ? saldoAcreedor : (haber - debe);
    }

    return {
      codigoCuenta: codigo,
      nombreCuenta: nombre,
      clase,
      naturaleza,
      debe,
      haber,
      saldoDeudor,
      saldoAcreedor,
      saldoFinal,
      porcentajeDelTotal: 0,
    };
  });

  const totalDebe = rawItems.reduce((acc, i) => acc + i.debe, 0);
  const totalHaber = rawItems.reduce((acc, i) => acc + i.haber, 0);
  const totalSaldoFinal = rawItems.reduce((acc, i) => acc + i.saldoFinal, 0);

  const items = rawItems.map((item) => ({
    ...item,
    porcentajeDelTotal: totalSaldoFinal !== 0 ? (item.saldoFinal / totalSaldoFinal) * 100 : 0,
  }));

  return {
    items,
    totalDebe,
    totalHaber,
    totalSaldoFinal,
  };
}

/**
 * Asistente Agente Senior: Redactar o actualizar borrador de Nota con cifras exactas
 */
export function generateAgentNoteDraft(
  note: FinancialStatementNote,
  breakdown: { items: FinancialStatementNoteItem[]; totalSaldoFinal: number },
  company: ClientCompany,
  periodo = '2026-12'
): string {
  const formatClp = (val: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(val);

  const topItems = [...breakdown.items]
    .sort((a, b) => Math.abs(b.saldoFinal) - Math.abs(a.saldoFinal))
    .slice(0, 4);

  const topItemsDesc =
    topItems.length > 0
      ? topItems.map((i) => `${i.nombreCuenta} (${formatClp(i.saldoFinal)})`).join(', ')
      : 'sin partidas imputadas al cierre';

  switch (note.categoria) {
    case 'IDENTIFICACION_EMPRESA':
      return `La sociedad "${company.razonSocial || company.nombreCorto}", R.U.T. N° ${company.rut}, con domicilio tributario en ${company.direccion || 'Santiago, Chile'}, registra giro de "${company.giro || 'Servicios y Actividades Comerciales'}" bajo el régimen tributario ${company.regimenTributario || '14 D3 ProPyme General'}. Los presentes Estados Financieros comprenden el ejercicio terminado al cierre del periodo ${periodo} y han sido formulados bajo hipótesis de negocio en marcha de conformidad con las NIIF / IFRS y circulares CMF vigentes.`;

    case 'POLITICAS_CONTABLES':
      return `Las políticas contables aplicadas en la preparación de estos estados financieros son consistentes con las emitidas por el International Accounting Standards Board (IASB) y adoptadas por el Colegio de Contadores de Chile A.G. y la Comisión para el Mercado Financiero (CMF). La moneda funcional es el Peso Chileno (CLP). Las transacciones en moneda extranjera se convierten a la tasa de cambio oficial de la fecha de transacción y los saldos monetarios de cierre se ajustan al tipo de cambio de cierre (NIC 21).`;

    case 'ACTIVO_CORRIENTE':
      return `Al 31 de diciembre de ${periodo.split('-')[0]}, el total acumulado en ${note.titulo} asciende a ${formatClp(breakdown.totalSaldoFinal)}. Las principales partidas que integran este rubro corresponden a: ${topItemsDesc}. Los activos de este grupo son realizables o exigibles en un plazo inferior a 12 meses y no presentan gravámenes ni prohibiciones de enajenar.`;

    case 'ACTIVO_NO_CORRIENTE':
      return `Al cierre del periodo contable, el rubro ${note.titulo} presenta un saldo neto total de ${formatClp(breakdown.totalSaldoFinal)}, compuesto primordialmente por ${topItemsDesc}. La depreciación y amortización del ejercicio se determinaron aplicando vidas útiles técnicas consistentes bajo el método lineal (NIC 16 / NIIF 16). No se evidencian indicios de deterioro de valor en los activos de larga duración (NIC 36).`;

    case 'PASIVO_CORRIENTE':
      return `Las obligaciones a corto plazo comprendidas en ${note.titulo} ascienden a ${formatClp(breakdown.totalSaldoFinal)} al cierre de ${periodo.split('-')[0]}. Se componen de compromisos comerciales y fiscales devengados exigibles dentro de los próximos doce meses, destacando: ${topItemsDesc}. La entidad se encuentra al día en el pago regular de sus obligaciones comerciales y laborales, cumpliendo con la Ley N° 21.131 de Pago Oportuno.`;

    case 'PASIVO_NO_CORRIENTE':
      return `Las obligaciones a largo plazo totalizan ${formatClp(breakdown.totalSaldoFinal)}. Corresponden a compromisos financieros e institucionales con vencimiento superior a un año calendario, medidos al costo amortizado conforme a la NIIF 9.`;

    case 'PATRIMONIO_NETO':
      return `El patrimonio neto de la entidad asciende a ${formatClp(breakdown.totalSaldoFinal)} al cierre del ejercicio. Dicho monto refleja el capital efectivamente aportado por los socios y/o accionistas, los resultados retenidos de ejercicios precedentes y el resultado neto de explotación del ejercicio actual.`;

    case 'INGRESOS_OPERACIONALES':
      return `Los ingresos de actividades ordinarias acumulados en el ejercicio alcanzan a ${formatClp(breakdown.totalSaldoFinal)}. Fueron reconocidos de conformidad con la NIIF 15 de Ingresos de Actividades Ordinarias procedentes de Contratos con Clientes, netos de Impuesto al Valor Agregado (IVA) y descuentos comerciales.`;

    case 'COSTOS_Y_GASTOS':
      return `Los costos y gastos operacionales registrados en ${note.titulo} suman ${formatClp(breakdown.totalSaldoFinal)} para el periodo examinado. El reconocimiento contable se efectúa sobre base devengada y con estricta sujeción al principio de correlación con los ingresos del giro regular.`;

    case 'RESULTADO_FINANCIERO':
      return `Los resultados financieros y diferencias de cambio arrojan un saldo neto de ${formatClp(breakdown.totalSaldoFinal)} al cierre. Reflejan el impacto de comisiones bancarias, reajustes en Unidades de Fomento (UF) y fluctuaciones de divisas en activos y pasivos monetarios en moneda extranjera según la NIC 21.`;

    default:
      return `Al cierre del ejercicio contable ${periodo}, el rubro ${note.titulo} registra un saldo consolidado de ${formatClp(breakdown.totalSaldoFinal)}, compuesto por las partidas: ${topItemsDesc}. La administración declara el pleno cumplimiento de las disposiciones normativas de la CMF y las NIIF/IFRS pertinentes.`;
  }
}
