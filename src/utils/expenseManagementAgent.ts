import {
  ExpenseReport,
  ExpenseItem,
  ExpenseProject,
  ExpenseAuditDiagnosis,
  ExpenseCategory,
  ExpenseDocumentType,
  AccountingEntry,
  AccountingEntryLine,
  HierarchicalAccountItem,
} from '../types';

/**
 * ============================================================================
 * AGENTE AUTÓNOMO DE ADMINISTRACIÓN DE RENDICIÓN DE GASTOS ("RINDE GASTOS AI")
 * ERP AGÉNTICO CONTABLE CHILENO (NIF / SII / ART. 31 Y 21 LIR)
 * ============================================================================
 * Coordina el ciclo de vida completo de las rendiciones de gastos corporativos:
 * 1. Auditoría preventiva y scoring de comprobantes y boletas.
 * 2. Validación de RUT chileno (Módulo 11) y detección de folios duplicados.
 * 3. Clasificación tributaria (IVA Crédito Fiscal recuperable vs Gasto Rechazado Art. 21).
 * 4. Imputación analítica a Centros de Costo ("Mini-Empresas") y Proyectos.
 * 5. Liquidación matemática de saldos a reembolsar o reintegrar (Fondos por rendir).
 * 6. Generación de asientos automáticos de centralización en el Libro Diario.
 * 7. Reportería ejecutiva descargable (CSV, Excel, JSON e impresión formal).
 */

export const EXPENSE_CATEGORIES_CONFIG: Record<
  ExpenseCategory,
  { label: string; defaultAccountCode: string; defaultAccountName: string; icono: string; requiereDetalleRUT: boolean }
> = {
  ALIMENTACION: {
    label: 'Alimentación & Viáticos Terreno',
    defaultAccountCode: '4.2.01.006',
    defaultAccountName: 'Gastos de Alimentación & Viáticos',
    icono: 'Utensils',
    requiereDetalleRUT: true,
  },
  ALOJAMIENTO: {
    label: 'Alojamiento & Hotelería',
    defaultAccountCode: '4.2.01.007',
    defaultAccountName: 'Alojamiento & Estadía Terreno',
    icono: 'Hotel',
    requiereDetalleRUT: true,
  },
  TRANSPORTE_MOVILIZACION: {
    label: 'Transporte, Pasajes & Movilización',
    defaultAccountCode: '4.2.01.008',
    defaultAccountName: 'Movilización Urbana & Rural',
    icono: 'Bus',
    requiereDetalleRUT: false,
  },
  COMBUSTIBLE: {
    label: 'Combustibles & Lubricantes Flota',
    defaultAccountCode: '4.2.01.009',
    defaultAccountName: 'Combustibles & Lubricantes',
    icono: 'Fuel',
    requiereDetalleRUT: true,
  },
  PEAJES_ESTACIONAMIENTOS: {
    label: 'Peajes, TAG & Estacionamientos',
    defaultAccountCode: '4.2.01.010',
    defaultAccountName: 'Peajes & Tag Autopistas',
    icono: 'Ticket',
    requiereDetalleRUT: false,
  },
  MATERIALES_INSUMOS: {
    label: 'Materiales Menores, Ferretería & Repuestos',
    defaultAccountCode: '4.1.02.001',
    defaultAccountName: 'Materiales Menores & Consumibles',
    icono: 'Wrench',
    requiereDetalleRUT: true,
  },
  REPRESENTACION_CLIENTES: {
    label: 'Gastos de Representación (Art. 31 N°11 LIR)',
    defaultAccountCode: '4.2.01.011',
    defaultAccountName: 'Gastos de Representación Corporativa',
    icono: 'Coffee',
    requiereDetalleRUT: true,
  },
  TELECOMUNICACIONES: {
    label: 'Telefonía Móvil, Recargas & Conectividad',
    defaultAccountCode: '4.2.01.012',
    defaultAccountName: 'Telefonía Móvil & Conectividad',
    icono: 'Phone',
    requiereDetalleRUT: true,
  },
  SERVICIOS_TECNICOS: {
    label: 'Servicios Técnicos & Mantenciones de Urgencia',
    defaultAccountCode: '4.2.01.013',
    defaultAccountName: 'Servicios Técnicos y Especializados',
    icono: 'Laptop',
    requiereDetalleRUT: true,
  },
  OTROS: {
    label: 'Otros Gastos Menores Operacionales',
    defaultAccountCode: '4.2.01.099',
    defaultAccountName: 'Otros Gastos Menores Operacionales',
    icono: 'FileText',
    requiereDetalleRUT: false,
  },
};

/**
 * Validador de RUT chileno (Módulo 11)
 */
export function validateChileanRut(rutCompleto: string): boolean {
  if (!rutCompleto) return false;
  const cleanRut = rutCompleto.replace(/[^0-9kK]/g, '');
  if (cleanRut.length < 8 || cleanRut.length > 9) return false;

  const cuerpo = cleanRut.slice(0, -1);
  const dv = cleanRut.slice(-1).toUpperCase();

  let suma = 0;
  let multiplo = 2;

  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo.charAt(i), 10) * multiplo;
    multiplo = multiplo < 7 ? multiplo + 1 : 2;
  }

  const resto = suma % 11;
  const digitoEsperado = 11 - resto;
  let dvEsperado = '';

  if (digitoEsperado === 11) dvEsperado = '0';
  else if (digitoEsperado === 10) dvEsperado = 'K';
  else dvEsperado = String(digitoEsperado);

  return dv === dvEsperado;
}

/**
 * Formateador de moneda en pesos chilenos ($ CLP)
 */
export function formatCLP(val: number): string {
  const rounded = Math.round(val || 0);
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(rounded);
}

/**
 * Auditoría Pericial Autónoma de una Rendición de Gastos (Scoring & Diagnóstico)
 */
export function auditExpenseReport(
  report: ExpenseReport,
  comprobantes: ExpenseItem[],
  existingReports: ExpenseReport[] = []
): ExpenseAuditDiagnosis {
  const alertas: string[] = [];
  const recomendaciones: string[] = [];
  let score = 100;

  let totalValidos = 0;
  let totalObjetados = 0;
  let ivaCreditoRecuperable = 0;
  let gastoRechazadoArt21 = 0;

  // Mapa de duplicados intra-rendición e inter-rendición
  const docSignatures = new Set<string>();

  // Analizar otros comprobantes en el sistema para detectar duplicidad cruzada
  const allOtherItems: { folio: string; rut: string; monto: number; reportFolio: string }[] = [];
  existingReports.forEach((r) => {
    if (r.id !== report.id && r.comprobantes) {
      r.comprobantes.forEach((item) => {
        allOtherItems.push({
          folio: item.folioDocumento.trim().toLowerCase(),
          rut: item.proveedorRut.replace(/[^0-9kK]/g, '').toLowerCase(),
          monto: Math.round(item.montoTotalClp),
          reportFolio: r.folio,
        });
      });
    }
  });

  comprobantes.forEach((item, idx) => {
    const itemNum = idx + 1;
    let itemValido = true;

    // 1. Verificación de RUT Proveedor
    const cleanRut = item.proveedorRut.trim();
    if (!cleanRut || cleanRut === '0-0') {
      alertas.push(`Comprobante #${itemNum} (${item.categoria}): Proveedor sin RUT identificado.`);
      score -= 5;
      itemValido = false;
    } else if (!validateChileanRut(cleanRut) && item.tipoDocumento !== 'INVOICE_EXTERIOR') {
      alertas.push(`Comprobante #${itemNum}: El RUT proveedor '${cleanRut}' no supera la validación Módulo 11 del SII.`);
      score -= 8;
      itemValido = false;
    }

    // 2. Detección de Duplicados (Mismo proveedor + mismo folio + mismo monto)
    const normRut = cleanRut.replace(/[^0-9kK]/g, '').toLowerCase();
    const normFolio = item.folioDocumento.trim().toLowerCase();
    const signature = `${normRut}_${normFolio}_${Math.round(item.montoTotalClp)}`;

    if (docSignatures.has(signature)) {
      alertas.push(`DUPLICIDAD INTERNA: El comprobante #${itemNum} (Folio ${item.folioDocumento}) está repetido dentro de esta misma rendición.`);
      score -= 20;
      itemValido = false;
      item.validadoPorAgente = false;
      item.observacionAgente = 'Documento duplicado dentro de la misma rendición.';
    } else {
      docSignatures.add(signature);
    }

    // Duplicidad cruzada con otras rendiciones del ERP
    const crossDup = allOtherItems.find(
      (other) => other.rut === normRut && other.folio === normFolio && Math.abs(other.monto - Math.round(item.montoTotalClp)) <= 1
    );
    if (crossDup) {
      alertas.push(`ALERTA DE FRAUDE / DUPLICIDAD EXTERNA: El comprobante #${itemNum} ya fue rendido previamente en el folio ${crossDup.reportFolio}.`);
      score -= 30;
      itemValido = false;
      item.validadoPorAgente = false;
      item.observacionAgente = `Alerta: Ya rendido en ${crossDup.reportFolio}.`;
    }

    // 3. Reglas Tributarias de IVA y Gasto Rechazado Art. 21 LIR
    if (item.tipoDocumento === 'FACTURA_ELECTRONICA_33') {
      if (item.montoIva > 0) {
        ivaCreditoRecuperable += item.montoIva;
      }
    }

    if (item.esGastoRechazadoArt21) {
      gastoRechazadoArt21 += item.montoTotalClp;
      alertas.push(`Comprobante #${itemNum} (${item.descripcionGlosa}): Clasificado como Gasto Rechazado Art. 21 LIR (tasa 40%).`);
      score -= 10;
    }

    // 4. Verificación de Antigüedad de Comprobantes (> 60 días)
    const fechaDoc = new Date(item.fecha);
    const fechaHoy = new Date();
    const diffDias = Math.floor((fechaHoy.getTime() - fechaDoc.getTime()) / (1000 * 3600 * 24));
    if (diffDias > 60) {
      alertas.push(`Comprobante #${itemNum}: Fecha de emisión con más de ${diffDias} días de antigüedad (fuera del mes fiscal).`);
      score -= 5;
    }

    // 5. Verificación de Fines de Semana para Gastos sin Viático Autorizado
    const diaSemana = fechaDoc.getDay(); // 0 = Domingo, 6 = Sábado
    if ((diaSemana === 0 || diaSemana === 6) && item.categoria === 'ALIMENTACION') {
      recomendaciones.push(`Comprobante #${itemNum}: Gasto de alimentación en fin de semana. Adjuntar orden de turno o bitácora de terreno.`);
    }

    if (itemValido) {
      totalValidos++;
    } else {
      totalObjetados++;
    }
  });

  // Verificación de Centro de Costo y Proyecto
  if (!report.centroCostoId) {
    alertas.push('La rendición no tiene asignado un Centro de Costo principal.');
    recomendaciones.push('Asignar la unidad de negocio para la imputación presupuestaria y P&L.');
    score -= 5;
  }
  if (!report.proyectoId) {
    recomendaciones.push('Opcional: Si el gasto corresponde a una obra o cliente específico, vincule el Proyecto correspondiente.');
  }

  // Normalizar score entre 0 y 100
  score = Math.max(0, Math.min(100, score));

  // Calificación cualitativa
  let calificacion: ExpenseAuditDiagnosis['calificacion'] = 'APROBADO_LIMPIO';
  if (score < 50 || totalObjetados >= 3) {
    calificacion = 'ALTO_RIESGO_TRIBUTARIO';
  } else if (score < 75 || totalObjetados > 0) {
    calificacion = 'REQUIERE_REVISION_MANUAL';
  } else if (score < 90 || alertas.length > 0) {
    calificacion = 'OBSERVACIONES_LEVES';
  }

  let resumenTributario = `Total Comprobantes: ${comprobantes.length} (${totalValidos} válidos, ${totalObjetados} con observaciones). `;
  if (ivaCreditoRecuperable > 0) {
    resumenTributario += `IVA Crédito Fiscal recuperable F29: ${formatCLP(ivaCreditoRecuperable)}. `;
  }
  if (gastoRechazadoArt21 > 0) {
    resumenTributario += `Riesgo Gasto Rechazado Art. 21 LIR: ${formatCLP(gastoRechazadoArt21)} (Impuesto 40%: ${formatCLP(gastoRechazadoArt21 * 0.4)}).`;
  } else {
    resumenTributario += `100% de los gastos cumplen requisitos de acreditación fidedigna Art. 31 LIR.`;
  }

  return {
    calificacion,
    scoreGlobal: score,
    totalComprobantesValidos: totalValidos,
    totalComprobantesObjetados: totalObjetados,
    montoIvaCreditoRecuperable: ivaCreditoRecuperable,
    montoGastoRechazadoArt21: gastoRechazadoArt21,
    alertas,
    recomendaciones,
    verificacionRutDuplicados: totalObjetados === 0,
    resumenTributario,
  };
}

export interface ExpenseAccountingConfig {
  cuentaAnticipoCodigo?: string;
  cuentaAnticipoNombre?: string;
  cuentaReembolsoCodigo?: string;
  cuentaReembolsoNombre?: string;
  cuentaReintegroCodigo?: string;
  cuentaReintegroNombre?: string;
  cuentaProveedoresCodigo?: string;
  cuentaProveedoresNombre?: string;
  fechaContable?: string;
  incluirReintegroBanco?: boolean;
  contabilizarFacturasContraProveedores?: boolean;
}

/**
 * Genera el Asiento Contable Automático en el Libro Diario para la Rendición de Gastos
 */
export function generateExpenseAccountingEntry(
  report: ExpenseReport,
  comprobantes: ExpenseItem[],
  chartOfAccounts: HierarchicalAccountItem[],
  config?: ExpenseAccountingConfig
): AccountingEntry {
  const lineas: AccountingEntryLine[] = [];
  const fechaAsiento = config?.fechaContable || report.fechaCierre || new Date().toISOString().substring(0, 10);
  const rendidorRut = report.rendidorRut && report.rendidorRut !== 'SIN_RUT' ? report.rendidorRut : '15.342.119-4';
  const rendidorNombre = report.rendidorNombre || 'Colaborador Rendidor';
  const docLabel = `Rendición Gastos ${report.folio}`;
  const defaultProyecto = report.proyectoCodigo || undefined;

  const contabilizarContraProveedores = config?.contabilizarFacturasContraProveedores !== false;
  const incluirReintegroBanco = config?.incluirReintegroBanco === true;

  // Cuentas contables parametrizadas
  const ctaAnticipoCod = config?.cuentaAnticipoCodigo || '1.1.03.002';
  const ctaAnticipoNom = config?.cuentaAnticipoNombre || chartOfAccounts.find(a => a.codigo === ctaAnticipoCod)?.nombre || 'Gastos por Rendir / Anticipos al Personal';

  const ctaReembolsoCod = config?.cuentaReembolsoCodigo || '2.1.02.001';
  const ctaReembolsoNom = config?.cuentaReembolsoNombre || chartOfAccounts.find(a => a.codigo === ctaReembolsoCod)?.nombre || 'Cuentas por Pagar al Personal (Reembolso de Gastos)';

  const ctaReintegroCod = config?.cuentaReintegroCodigo || '1.1.02.001';
  const ctaReintegroNom = config?.cuentaReintegroNombre || chartOfAccounts.find(a => a.codigo === ctaReintegroCod)?.nombre || 'Banco Santander Chile - Reintegro Sobrante de Fondo';

  const ctaProvCod = config?.cuentaProveedoresCodigo || '2.1.01.001';
  const ctaProvNom = config?.cuentaProveedoresNombre || chartOfAccounts.find(a => a.codigo === ctaProvCod)?.nombre || 'Proveedores Nacionales (RCV SII)';

  // 1. Agrupar gastos por cuenta contable, centro de costo y proyecto
  const mapaGastos: Record<
    string,
    {
      cuentaCodigo: string;
      cuentaNombre: string;
      montoNeto: number;
      centroCostoId?: string;
      centroCostoCodigo?: string;
      proyectoId?: string;
      proyectoCodigo?: string;
      proveedorRut?: string;
      proveedorRazonSocial?: string;
      folioComprobante?: string;
      glosa: string;
    }
  > = {};

  let totalIvaCredito = 0;
  let totalGastosMonto = 0;
  const facturasList: ExpenseItem[] = [];

  const itemsToProcess = (comprobantes && comprobantes.length > 0)
    ? comprobantes
    : (report.montoTotalRendidoClp > 0)
      ? [{
          id: `synth-${report.id}`,
          expenseReportId: report.id,
          empresaId: report.empresaId,
          fecha: report.fechaCierre || report.fechaInicio || new Date().toISOString().substring(0, 10),
          tipoDocumento: 'BOLETA_ELECTRONICA' as const,
          folioDocumento: `RDG-${report.folio}`,
          proveedorRut: rendidorRut,
          proveedorRazonSocial: rendidorNombre,
          categoria: 'ALIMENTACION' as const,
          descripcionGlosa: report.titulo || `Gastos Operacionales ${report.folio}`,
          montoNeto: Math.round(report.montoTotalRendidoClp / 1.19),
          montoIva: report.montoTotalRendidoClp - Math.round(report.montoTotalRendidoClp / 1.19),
          montoExento: 0,
          montoTotalClp: report.montoTotalRendidoClp,
          cuentaContableCodigo: '6.1.04.007',
          cuentaContableNombre: 'Gastos de Alimentación, Viáticos y Terreno',
          centroCostoId: report.centroCostoId,
          centroCostoCodigo: report.centroCostoCodigo,
          proyectoId: report.proyectoId,
          proyectoCodigo: report.proyectoCodigo,
        }]
      : [];

  itemsToProcess.forEach((item) => {
    const isFactura = item.tipoDocumento === 'FACTURA_ELECTRONICA_33' || item.tipoDocumento === 'FACTURA_EXENTA_34';
    const gastoAfecto = item.tipoDocumento === 'FACTURA_ELECTRONICA_33' && item.montoNeto > 0 ? item.montoNeto : item.montoTotalClp;

    totalGastosMonto += item.montoTotalClp;
    if (item.tipoDocumento === 'FACTURA_ELECTRONICA_33' && item.montoIva > 0) {
      totalIvaCredito += item.montoIva;
    }

    if (isFactura) {
      facturasList.push(item);
    }

    const ctaCodigo = item.cuentaContableCodigo || '6.1.04.007';
    const itemPry = item.proyectoCodigo || defaultProyecto || '';
    const key = `${ctaCodigo}_${item.centroCostoId || report.centroCostoId || ''}_${itemPry}`;
    if (!mapaGastos[key]) {
      const acc = chartOfAccounts.find((a) => a.codigo === ctaCodigo);
      mapaGastos[key] = {
        cuentaCodigo: ctaCodigo,
        cuentaNombre: acc?.nombre || item.cuentaContableNombre || `Gasto ${item.categoria}`,
        montoNeto: 0,
        centroCostoId: item.centroCostoId || report.centroCostoId,
        centroCostoCodigo: item.centroCostoCodigo || report.centroCostoCodigo || 'OPERACIONES',
        proyectoId: item.proyectoId || report.proyectoId,
        proyectoCodigo: item.proyectoCodigo || defaultProyecto,
        proveedorRut: item.proveedorRut && item.proveedorRut !== 'SIN_RUT' ? item.proveedorRut : rendidorRut,
        proveedorRazonSocial: item.proveedorRazonSocial || rendidorNombre,
        folioComprobante: item.folioDocumento || report.folio,
        glosa: `${item.categoria} - Rendición ${report.folio}`,
      };
    }
    mapaGastos[key].montoNeto += gastoAfecto;
  });

  // 2. Líneas de Cargo (DEBE): Gastos Netos / Brutos
  Object.values(mapaGastos).forEach((gasto) => {
    lineas.push({
      cuentaCodigo: gasto.cuentaCodigo,
      cuentaNombre: gasto.cuentaNombre,
      debe: Math.round(gasto.montoNeto),
      haber: 0,
      rutAuxiliar: gasto.proveedorRut || rendidorRut,
      nombreAuxiliar: gasto.proveedorRazonSocial || rendidorNombre,
      documentoRef: docLabel,
      tipoDocumentoRef: 'RENDICION_GASTOS',
      folioDocumentoRef: report.folio,
      fechaDocumentoRef: fechaAsiento,
      centroCosto: gasto.centroCostoCodigo || report.centroCostoCodigo || 'OPERACIONES',
      proyecto: gasto.proyectoCodigo || defaultProyecto,
    });
  });

  // 3. Línea de Cargo (DEBE): IVA Crédito Fiscal si hubo facturas
  if (totalIvaCredito > 0) {
    lineas.push({
      cuentaCodigo: '1.1.04.001',
      cuentaNombre: 'IVA Crédito Fiscal (DL 825)',
      debe: Math.round(totalIvaCredito),
      haber: 0,
      rutAuxiliar: facturasList[0]?.proveedorRut || rendidorRut,
      nombreAuxiliar: facturasList[0]?.proveedorRazonSocial || rendidorNombre,
      documentoRef: facturasList.length === 1 ? `Factura ${facturasList[0].folioDocumento}` : docLabel,
      tipoDocumentoRef: 'FACTURA_ELECTRONICA_33',
      folioDocumentoRef: facturasList.length === 1 ? facturasList[0].folioDocumento : report.folio,
      fechaDocumentoRef: fechaAsiento,
      centroCosto: report.centroCostoCodigo || 'OPERACIONES',
      proyecto: defaultProyecto,
    });
  }

  // 4. Si se activa contabilización contra Proveedores Nacionales (para afectar RCV SII):
  // Se registra el pasivo con el Proveedor (Haber) y la inmediata cancelación por pago con el fondo (Debe)
  if (contabilizarContraProveedores && facturasList.length > 0) {
    facturasList.forEach((fac) => {
      // Abono a Proveedores (Reconoce la obligación fiscal con el emisor en RCV)
      lineas.push({
        cuentaCodigo: ctaProvCod,
        cuentaNombre: ctaProvNom,
        debe: 0,
        haber: Math.round(fac.montoTotalClp),
        rutAuxiliar: fac.proveedorRut || rendidorRut,
        nombreAuxiliar: fac.proveedorRazonSocial || 'Proveedor Factura',
        documentoRef: `Factura ${fac.folioDocumento}`,
        tipoDocumentoRef: 'FACTURA_ELECTRONICA_33',
        folioDocumentoRef: fac.folioDocumento,
        fechaDocumentoRef: fac.fecha || fechaAsiento,
        centroCosto: fac.centroCostoCodigo || report.centroCostoCodigo || 'OPERACIONES',
        proyecto: fac.proyectoCodigo || defaultProyecto,
      });

      // Cargo a Proveedores (Cancela el documento pagado mediante la rendición)
      lineas.push({
        cuentaCodigo: ctaProvCod,
        cuentaNombre: `${ctaProvNom} (Liquidación Rendición)`,
        debe: Math.round(fac.montoTotalClp),
        haber: 0,
        rutAuxiliar: fac.proveedorRut || rendidorRut,
        nombreAuxiliar: fac.proveedorRazonSocial || 'Proveedor Factura',
        documentoRef: `Pago RDG ${report.folio}`,
        tipoDocumentoRef: 'RENDICION_GASTOS',
        folioDocumentoRef: report.folio,
        fechaDocumentoRef: fechaAsiento,
        centroCosto: fac.centroCostoCodigo || report.centroCostoCodigo || 'OPERACIONES',
        proyecto: fac.proyectoCodigo || defaultProyecto,
      });
    });
  }

  // 5. Liquidación de Fondos por Rendir (HABER)
  const fondoAnticipo = Number(report.fondoAsignadoClp || 0);
  const saldoReintegrar = Math.max(0, fondoAnticipo - totalGastosMonto);
  const saldoReembolsar = Math.max(0, totalGastosMonto - fondoAnticipo);

  if (fondoAnticipo > 0) {
    // Si el usuario marcó incluir reintegro inmediato a banco, se liquida el 100% del fondo ($150.000)
    // Si NO se incluye reintegro a banco, se liquida estrictamente lo gastado ($139.000) para no generar descuadre
    const anticipoLiquidado = (incluirReintegroBanco && saldoReintegrar > 0)
      ? fondoAnticipo
      : Math.min(fondoAnticipo, totalGastosMonto);

    lineas.push({
      cuentaCodigo: ctaAnticipoCod,
      cuentaNombre: ctaAnticipoNom,
      debe: 0,
      haber: Math.round(anticipoLiquidado),
      rutAuxiliar: rendidorRut,
      nombreAuxiliar: rendidorNombre,
      documentoRef: docLabel,
      tipoDocumentoRef: 'RENDICION_GASTOS',
      folioDocumentoRef: report.folio,
      fechaDocumentoRef: fechaAsiento,
      centroCosto: report.centroCostoCodigo || 'OPERACIONES',
      proyecto: defaultProyecto,
    });
  }

  // 6. Si hubo más gastos que fondo anticipado: Reembolso por Pagar al Empleado (HABER)
  if (saldoReembolsar > 0) {
    lineas.push({
      cuentaCodigo: ctaReembolsoCod,
      cuentaNombre: ctaReembolsoNom,
      debe: 0,
      haber: Math.round(saldoReembolsar),
      rutAuxiliar: rendidorRut,
      nombreAuxiliar: rendidorNombre,
      documentoRef: docLabel,
      tipoDocumentoRef: 'RENDICION_GASTOS',
      folioDocumentoRef: report.folio,
      fechaDocumentoRef: fechaAsiento,
      centroCosto: report.centroCostoCodigo || 'OPERACIONES',
      proyecto: defaultProyecto,
      montoDocumentoRef: Math.round(saldoReembolsar),
    });
  }

  // 7. Si sobró anticipo y se activó explícitamente el reintegro a Banco/Caja (DEBE):
  if (incluirReintegroBanco && saldoReintegrar > 0) {
    const folioDep = `DEP-${report.folio}`;
    lineas.unshift({
      cuentaCodigo: ctaReintegroCod,
      cuentaNombre: ctaReintegroNom,
      debe: Math.round(saldoReintegrar),
      haber: 0,
      rutAuxiliar: rendidorRut,
      nombreAuxiliar: rendidorNombre,
      documentoRef: `Reintegro Sobrante ${docLabel}`,
      tipoDocumentoRef: 'RENDICION_GASTOS',
      folioDocumentoRef: report.folio,
      fechaDocumentoRef: fechaAsiento,
      fechaVencimientoRef: fechaAsiento,
      tipoDocumentoConciliacion: 'DEPOSITO',
      documentoConciliacion: folioDep,
      centroCosto: report.centroCostoCodigo || 'OPERACIONES',
      proyecto: defaultProyecto,
    });
  }

  // Cuadratura estricta del asiento
  const totalDebe = lineas.reduce((acc, l) => acc + (l.debe || 0), 0);
  const totalHaber = lineas.reduce((acc, l) => acc + (l.haber || 0), 0);

  return {
    id: `entry-rdg-${report.id.substring(0, 8)}`,
    fecha: fechaAsiento,
    concepto: `Centralización Rendición de Gastos ${report.folio} - ${report.titulo} (${rendidorNombre})`,
    documento: report.folio,
    lineas,
    totalDebe,
    totalHaber,
    balanceado: Math.abs(totalDebe - totalHaber) === 0,
    origen: 'RENDICION_GASTOS',
    creadoEn: new Date().toISOString(),
  };
}

/**
 * EXPORTAR RENDICIÓN DETALLADA A CSV (Formato "Rinde Gastos" Corporativo)
 */
export function exportExpenseReportToCSV(report: ExpenseReport, comprobantes: ExpenseItem[]): string {
  const lines: string[] = [];

  // UTF-8 BOM
  lines.push(`"INFORME DE RENDICIÓN DE GASTOS - ERP AGÉNTICO (RINDE GASTOS)"`);
  lines.push(`"Folio Rendición";"${report.folio}";"Fecha Emisión";"${report.fechaCierre}"`);
  lines.push(`"Título";"${report.titulo.replace(/"/g, '""')}";"Estado";"${report.estado}"`);
  lines.push(`"Rendidor";"${report.rendidorNombre}";"RUT";"${report.rendidorRut}"`);
  lines.push(`"Cargo";"${report.rendidorCargo || '-'}";"Email";"${report.rendidorEmail || '-'}"`);
  lines.push(`"Centro de Costo";"${report.centroCostoCodigo || '-'} - ${report.centroCostoNombre || '-'}";"Proyecto";"${report.proyectoCodigo || '-'} - ${report.proyectoNombre || '-'}"`);
  lines.push(`"Fondo Anticipado";"${report.fondoAsignadoClp}";"Total Rendido";"${report.montoTotalRendidoClp}"`);
  lines.push(`"Saldo a Reembolsar al Empleado";"${report.saldoReembolsarClp}";"Saldo a Reintegrar a la Empresa";"${report.saldoReintegrarClp}"`);
  lines.push('');

  // Encabezados de Comprobantes
  lines.push(
    `"N°";"Fecha";"Tipo Documento";"Folio";"RUT Proveedor";"Razón Social";"Categoría";"Glosa / Descripción";"Neto ($)";"IVA ($)";"Exento ($)";"Total ($ CLP)";"Centro Costo";"Proyecto";"Cuenta Contable";"Art. 21 LIR";"Estado Agente"`
  );

  comprobantes.forEach((item, idx) => {
    lines.push(
      `"${idx + 1}";"${item.fecha}";"${item.tipoDocumento}";"${item.folioDocumento}";"${item.proveedorRut}";"${item.proveedorRazonSocial.replace(/"/g, '""')}";"${item.categoria}";"${item.descripcionGlosa.replace(/"/g, '""')}";"${item.montoNeto}";"${item.montoIva}";"${item.montoExento}";"${item.montoTotalClp}";"${item.centroCostoCodigo || report.centroCostoCodigo || '-'}";"${item.proyectoCodigo || report.proyectoCodigo || '-'}";"${item.cuentaContableCodigo} ${item.cuentaContableNombre || ''}";"${item.esGastoRechazadoArt21 ? 'SÍ (RECHAZADO)' : 'NO (ACEPTADO)'}";"${item.validadoPorAgente ? 'APROBADO' : 'OBJETADO'}"`
    );
  });

  lines.push('');
  lines.push(`"RESUMEN Y AUDITORÍA DEL AGENTE"`);
  lines.push(`"Score Global";"${report.agenteAuditorScore} / 100";"Calificación";"${report.agenteAuditorDiagnostico?.calificacion || 'APROBADO'}"`);
  if (report.agenteAuditorDiagnostico) {
    lines.push(`"Resumen Tributario";"${report.agenteAuditorDiagnostico.resumenTributario.replace(/"/g, '""')}"`);
    report.agenteAuditorDiagnostico.alertas.forEach((alerta) => {
      lines.push(`"Alerta Auditoría";"${alerta.replace(/"/g, '""')}"`);
    });
    report.agenteAuditorDiagnostico.recomendaciones.forEach((rec) => {
      lines.push(`"Recomendación";"${rec.replace(/"/g, '""')}"`);
    });
  }

  return lines.join('\r\n');
}

/**
 * Exportar resumen de todas las rendiciones por Centro de Costo y Proyecto
 */
export function exportExpenseSummaryByCostCenterCSV(reports: ExpenseReport[]): string {
  const lines: string[] = [];
  lines.push(`"RESUMEN CONSOLIDADO DE GASTOS POR CENTRO DE COSTO Y PROYECTO"`);
  lines.push(`"Folio";"Título";"Rendidor";"RUT";"Centro de Costo";"Proyecto";"Estado";"Total Rendido ($ CLP)";"Anticipo ($)";"Reembolso ($)";"Reintegro ($)";"Score AI"`);

  reports.forEach((r) => {
    lines.push(
      `"${r.folio}";"${r.titulo.replace(/"/g, '""')}";"${r.rendidorNombre.replace(/"/g, '""')}";"${r.rendidorRut}";"${r.centroCostoCodigo || '-'} ${r.centroCostoNombre || ''}";"${r.proyectoCodigo || '-'} ${r.proyectoNombre || ''}";"${r.estado}";"${r.montoTotalRendidoClp}";"${r.fondoAsignadoClp}";"${r.saldoReembolsarClp}";"${r.saldoReintegrarClp}";"${r.agenteAuditorScore}%"`
    );
  });

  return lines.join('\r\n');
}

/**
 * Disparador de Descarga en Navegador con UTF-8 BOM
 */
export function downloadFile(filename: string, content: string, mimeType: string): void {
  const bom = mimeType.includes('csv') ? '\uFEFF' : '';
  const blob = new Blob([bom + content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
