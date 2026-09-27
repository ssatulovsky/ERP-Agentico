import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { 
  DteDocument, 
  AccountingEntry, 
  F29Declaration, 
  EmployeePayroll, 
  BankAccountConfig, 
  BankStatementMovement, 
  Warehouse, 
  InventoryItem, 
  CashFlowMovement, 
  LeaseContract, 
  ClientCompany,
  ChileIndicators,
  Balance8ColumnasReport,
  WarehouseWithdrawal 
} from '../types';

// Helper to format Chilean Peso
export function fmtClp(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '$0';
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0
  }).format(num);
}

// Helper to format general numbers
export function fmtNum(num: number | undefined | null): string {
  if (num === undefined || num === null || isNaN(num)) return '0';
  return new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(num);
}

// Helper to trigger browser CSV download
export function triggerCsvDownload(csvString: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Helper to add standard official header to jsPDF
function addPdfHeader(
  doc: jsPDF, 
  company: ClientCompany, 
  title: string, 
  subtitle: string,
  isLandscape = false
) {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header background bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), 14, 11);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(subtitle, 14, 18);

  // Date / Timestamp top right
  const nowStr = new Date().toLocaleString('es-CL');
  doc.text(`Fecha Emisión: ${nowStr}`, pageWidth - 14, 11, { align: 'right' });
  doc.text(`Norma: Ley Tributaria y CMF Chile`, pageWidth - 14, 18, { align: 'right' });

  // Company info bar
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Razón Social: ${company.razonSocial || company.nombreCorto}`, 14, 32);
  doc.text(`R.U.T.: ${company.rut}`, pageWidth - 14, 32, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const giro = company.giro || 'Servicios y Actividades Comerciales';
  doc.text(`Giro Comercial: ${giro.substring(0, 75)}`, 14, 37);
  doc.text(`Régimen: ${company.regimenTributario || '14 D3 ProPyme General'}`, pageWidth - 14, 37, { align: 'right' });

  // Divider line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(14, 41, pageWidth - 14, 41);
}

// Helper to add standard official footer and signatures
function addPdfFooterAndSignatures(
  doc: jsPDF, 
  showSignatures = true,
  startYOverride?: number
) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Bottom page footer
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
    
    doc.text(
      'Documento Oficial Generado Electrónicamente - Válido para Fiscalización SII y Auditorías Financieras',
      14,
      pageHeight - 7
    );
    doc.text(`Página ${i} de ${pageCount}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }

  // Add signature section on the last page if space permits
  if (showSignatures) {
    doc.setPage(pageCount);
    const sigY = startYOverride || (pageHeight - 35);
    if (sigY < pageHeight - 20) {
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      
      // Signature 1
      const sig1X = 25;
      const sigWidth = 65;
      doc.setDrawColor(148, 163, 184);
      doc.line(sig1X, sigY + 12, sig1X + sigWidth, sigY + 12);
      doc.text('Firma y Timbre Contador General', sig1X + sigWidth / 2, sigY + 16, { align: 'center' });
      doc.text('Reg. Colegio de Contadores de Chile', sig1X + sigWidth / 2, sigY + 20, { align: 'center' });

      // Signature 2
      const sig2X = pageWidth - 25 - sigWidth;
      doc.line(sig2X, sigY + 12, sig2X + sigWidth, sigY + 12);
      doc.text('Representante Legal / Gerencia', sig2X + sigWidth / 2, sigY + 16, { align: 'center' });
      doc.text('Aprobación Estados y Registros', sig2X + sigWidth / 2, sigY + 20, { align: 'center' });
    }
  }
}

// ============================================================================
// 1. REGISTRO COMPRA - VENTA - HONORARIOS (RCV / DTE)
// ============================================================================

export function downloadRcvCsv(
  dtes: DteDocument[] = [], 
  tipoFilter: 'ALL' | 'VENTA' | 'COMPRA' | 'HONORARIOS' = 'ALL'
) {
  const safeDtes = Array.isArray(dtes) ? dtes : [];
  const filtered = safeDtes.filter(d => tipoFilter === 'ALL' || d.tipoOperacion === tipoFilter);

  const headers = [
    'Tipo Operacion',
    'Tipo DTE',
    'Folio',
    'Fecha Emision',
    'RUT Contraparte',
    'Razon Social Contraparte',
    'Monto Exento',
    'Monto Neto',
    'Monto IVA',
    'Retencion Tasa',
    'Retencion Monto',
    'Monto Total',
    'Estado Pago',
    'Estado SII',
    'Imputacion Contable'
  ];

  const rows = filtered.map(d => [
    d.tipoOperacion,
    d.tipoDte,
    d.folio,
    d.fechaEmision,
    d.rutContraparte,
    `"${(d.razonSocialContraparte || '').replace(/"/g, '""')}"`,
    d.montoExento || 0,
    d.montoNeto || 0,
    d.montoIva || 0,
    d.retencionTasa ? `${(d.retencionTasa * 100).toFixed(1)}%` : '0%',
    d.retencionMonto || 0,
    d.montoTotal || 0,
    d.estadoPago || 'PENDIENTE',
    d.estadoSii || 'ACEPTADO',
    d.asientoCentralizacionId ? 'CENTRALIZADO' : 'PENDIENTE'
  ]);

  const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
  triggerCsvDownload(csvContent, `RCV_${tipoFilter}_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function downloadRcvExcel(dtes: DteDocument[] = [], company: ClientCompany) {
  const safeDtes = Array.isArray(dtes) ? dtes : [];
  const wb = XLSX.utils.book_new();

  const createSheetData = (list: DteDocument[]) => {
    return list.map(d => ({
      'Tipo Operación': d.tipoOperacion,
      'Tipo DTE': d.tipoDte,
      'Folio': d.folio,
      'Fecha Emisión': d.fechaEmision,
      'RUT Contraparte': d.rutContraparte,
      'Razón Social Contraparte': d.razonSocialContraparte,
      'Monto Exento': d.montoExento || 0,
      'Monto Neto': d.montoNeto || 0,
      'Monto IVA': d.montoIva || 0,
      'Retención': d.retencionMonto || 0,
      'Monto Total': d.montoTotal || 0,
      'Estado Pago': d.estadoPago || 'PENDIENTE',
      'Centralizado': d.asientoCentralizacionId ? 'SÍ' : 'NO'
    }));
  };

  // 1. Resumen
  const ventas = safeDtes.filter(d => d.tipoOperacion === 'VENTA');
  const compras = safeDtes.filter(d => d.tipoOperacion === 'COMPRA');
  const honorarios = safeDtes.filter(d => d.tipoOperacion === 'HONORARIOS');

  const resumenData = [
    { 'Concepto Fiscal': 'Empresa', 'Valor': `${company.razonSocial} (${company.rut})` },
    { 'Concepto Fiscal': 'Régimen Tributario', 'Valor': company.regimenTributario },
    { 'Concepto Fiscal': 'Total Documentos Venta', 'Valor': ventas.length },
    { 'Concepto Fiscal': 'Total Ventas Neto', 'Valor': ventas.reduce((s, d) => s + (d.tipoDte === '61' ? -d.montoNeto : d.montoNeto), 0) },
    { 'Concepto Fiscal': 'Total Débito Fiscal IVA', 'Valor': ventas.reduce((s, d) => s + (d.tipoDte === '61' ? -d.montoIva : d.montoIva), 0) },
    { 'Concepto Fiscal': 'Total Documentos Compra', 'Valor': compras.length },
    { 'Concepto Fiscal': 'Total Compras Neto', 'Valor': compras.reduce((s, d) => s + d.montoNeto, 0) },
    { 'Concepto Fiscal': 'Total Crédito Fiscal IVA', 'Valor': compras.reduce((s, d) => s + d.montoIva, 0) },
    { 'Concepto Fiscal': 'Total Boletas Honorarios', 'Valor': honorarios.length },
    { 'Concepto Fiscal': 'Total Retención 2da Cat. (14.5%)', 'Valor': honorarios.reduce((s, d) => s + (d.retencionMonto || Math.round(d.montoTotal * 0.145)), 0) }
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenData), 'Resumen Fiscal');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(createSheetData(ventas)), 'Registro Ventas');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(createSheetData(compras)), 'Registro Compras');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(createSheetData(honorarios)), 'Registro Honorarios');

  XLSX.writeFile(wb, `RCV_Consolidado_${company.rut}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function downloadRcvPdf(
  dtes: DteDocument[] = [], 
  company: ClientCompany, 
  periodo = '2026-08'
) {
  const safeDtes = Array.isArray(dtes) ? dtes : [];
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  
  addPdfHeader(
    doc, 
    company, 
    'Registro de Compras, Ventas y Honorarios (RCV Oficial)', 
    `Período Tributario: ${periodo} - Conciliado con el Servicio de Impuestos Internos (SII)`,
    true
  );

  const ventas = safeDtes.filter(d => d.tipoOperacion === 'VENTA');
  const compras = safeDtes.filter(d => d.tipoOperacion === 'COMPRA');
  const honorarios = safeDtes.filter(d => d.tipoOperacion === 'HONORARIOS');

  const totalVentasNeto = ventas.reduce((s, d) => s + (d.tipoDte === '61' ? -d.montoNeto : d.montoNeto), 0);
  const totalDebitoIva = ventas.reduce((s, d) => s + (d.tipoDte === '61' ? -d.montoIva : d.montoIva), 0);
  const totalComprasNeto = compras.reduce((s, d) => s + d.montoNeto, 0);
  const totalCreditoIva = compras.reduce((s, d) => s + d.montoIva, 0);
  const totalRetencionBhe = honorarios.reduce((s, d) => s + (d.retencionMonto || Math.round(d.montoTotal * 0.145)), 0);

  // Table Data
  const tableData = safeDtes.map(d => [
    d.tipoOperacion,
    d.tipoDte,
    d.folio.toString(),
    d.fechaEmision,
    d.rutContraparte || '-',
    (d.razonSocialContraparte || '-').substring(0, 24),
    fmtClp(d.montoExento || 0),
    fmtClp(d.montoNeto || 0),
    fmtClp(d.montoIva || 0),
    fmtClp(d.retencionMonto || 0),
    fmtClp(d.montoTotal || 0),
    d.estadoPago || 'PENDIENTE',
    d.asientoCentralizacionId ? 'CENTRALIZADO' : 'PENDIENTE'
  ]);

  autoTable(doc, {
    startY: 45,
    head: [[
      'Op.', 'Tipo', 'Folio', 'Fecha', 'RUT Contraparte', 'Razón Social',
      'Exento', 'Neto', 'IVA', 'Retención', 'Total', 'Pago', 'Contabilidad'
    ]],
    body: tableData,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5, lineColor: [226, 232, 240], lineWidth: 0.2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 10, halign: 'center' },
      2: { cellWidth: 14, halign: 'right' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 20 },
      5: { cellWidth: 44 },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 22, halign: 'right' },
      8: { cellWidth: 20, halign: 'right' },
      9: { cellWidth: 20, halign: 'right' },
      10: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      11: { cellWidth: 18, halign: 'center' },
      12: { cellWidth: 20, halign: 'center' }
    },
    foot: [[
      'TOTALES', `${safeDtes.length} docs`, '', '', '', '',
      '', fmtClp(totalVentasNeto + totalComprasNeto), fmtClp(totalDebitoIva + totalCreditoIva),
      fmtClp(totalRetencionBhe), fmtClp(safeDtes.reduce((s, d) => s + d.montoTotal, 0)), '', ''
    ]],
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'right' }
  });

  addPdfFooterAndSignatures(doc, true);
  doc.save(`RCV_Oficial_${company.rut}_${periodo}.pdf`);
}

// ============================================================================
// 2. BALANCE TRIBUTARIO DE 8 COLUMNAS (EXCEL & PDF)
// ============================================================================

export function downloadBalance8ColExcel(
  balance8Col: Balance8ColumnasReport, 
  company: ClientCompany,
  periodo = '2026-08'
) {
  const wb = XLSX.utils.book_new();

  const data = (balance8Col?.cuentas || []).map(c => ({
    'Código': c.codigo,
    'Nombre de la Cuenta': c.nombre,
    'Clase': c.clase,
    'Débitos': c.debitos,
    'Créditos': c.creditos,
    'Saldo Deudor': c.saldo_deudor,
    'Saldo Acreedor': c.saldo_acreedor,
    'Activo': c.activo,
    'Pasivo': c.pasivo,
    'Pérdida': c.perdida,
    'Ganancia': c.ganancia
  }));

  const totales = balance8Col?.totales || {
    total_debitos: 0, total_creditos: 0, total_saldo_deudor: 0, total_saldo_acreedor: 0,
    total_activo: 0, total_pasivo: 0, total_perdida: 0, total_ganancia: 0
  };

  data.push({
    'Código': 'TOTALES',
    'Nombre de la Cuenta': 'SUMAS IGUALES DEL PERÍODO',
    'Clase': 0,
    'Débitos': totales.total_debitos,
    'Créditos': totales.total_creditos,
    'Saldo Deudor': totales.total_saldo_deudor,
    'Saldo Acreedor': totales.total_saldo_acreedor,
    'Activo': totales.total_activo,
    'Pasivo': totales.total_pasivo,
    'Pérdida': totales.total_perdida,
    'Ganancia': totales.total_ganancia
  });

  const res = balance8Col?.resultado_del_ejercicio || { tipo: 'EQUILIBRIO', monto: 0 };
  data.push({
    'Código': 'RESULTADO',
    'Nombre de la Cuenta': `RESULTADO DEL EJERCICIO (${res.tipo})`,
    'Clase': 0,
    'Débitos': 0,
    'Créditos': 0,
    'Saldo Deudor': 0,
    'Saldo Acreedor': 0,
    'Activo': res.tipo === 'PERDIDA' ? res.monto : 0,
    'Pasivo': res.tipo === 'UTILIDAD' ? res.monto : 0,
    'Pérdida': res.tipo === 'UTILIDAD' ? res.monto : 0,
    'Ganancia': res.tipo === 'PERDIDA' ? res.monto : 0
  });

  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Balance 8 Columnas');
  XLSX.writeFile(wb, `Balance_8_Columnas_${company.rut}_${periodo}.xlsx`);
}

export function downloadBalance8ColPdf(
  balance8Col: Balance8ColumnasReport, 
  company: ClientCompany,
  periodo = '2026-08'
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  
  addPdfHeader(
    doc, 
    company, 
    'Balance Tributario y Financiero de 8 Columnas', 
    `Período: ${periodo} - Cumplimiento Artículo 35 Ley sobre Impuesto a la Renta y CMF Chile`,
    true
  );

  const tableBody = (balance8Col?.cuentas || []).map(c => [
    c.codigo,
    c.nombre.substring(0, 32),
    fmtClp(c.debitos),
    fmtClp(c.creditos),
    fmtClp(c.saldo_deudor),
    fmtClp(c.saldo_acreedor),
    fmtClp(c.activo),
    fmtClp(c.pasivo),
    fmtClp(c.perdida),
    fmtClp(c.ganancia)
  ]);

  const tot = balance8Col?.totales;
  const res = balance8Col?.resultado_del_ejercicio;

  // Subtotal row
  tableBody.push([
    'SUMAS', 'TOTALES DE CONTROL',
    fmtClp(tot?.total_debitos), fmtClp(tot?.total_creditos),
    fmtClp(tot?.total_saldo_deudor), fmtClp(tot?.total_saldo_acreedor),
    fmtClp(tot?.total_activo), fmtClp(tot?.total_pasivo),
    fmtClp(tot?.total_perdida), fmtClp(tot?.total_ganancia)
  ]);

  // Result row
  tableBody.push([
    'RES.', `RESULTADO DEL EJERCICIO (${res?.tipo})`,
    '', '', '', '',
    res?.tipo === 'PERDIDA' ? fmtClp(res.monto) : '',
    res?.tipo === 'UTILIDAD' ? fmtClp(res.monto) : '',
    res?.tipo === 'UTILIDAD' ? fmtClp(res.monto) : '',
    res?.tipo === 'PERDIDA' ? fmtClp(res.monto) : ''
  ]);

  // Final balanced row
  const activoFinal = Math.max(tot?.total_activo || 0, (tot?.total_pasivo || 0) + (res?.tipo === 'UTILIDAD' ? res.monto : 0));
  const pasivoFinal = activoFinal;
  const resultadoFinal = Math.max(tot?.total_ganancia || 0, tot?.total_perdida || 0);

  tableBody.push([
    'IGUALES', 'TOTALES BALANCEADOS',
    fmtClp(tot?.total_debitos), fmtClp(tot?.total_creditos),
    fmtClp(tot?.total_saldo_deudor), fmtClp(tot?.total_saldo_acreedor),
    fmtClp(activoFinal),
    fmtClp(pasivoFinal),
    fmtClp(resultadoFinal),
    fmtClp(resultadoFinal)
  ]);

  autoTable(doc, {
    startY: 45,
    head: [[
      'Código', 'Cuenta Contable', 'Débitos', 'Créditos', 'Deudor', 'Acreedor', 'Activo', 'Pasivo', 'Pérdida', 'Ganancia'
    ]],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.4, lineColor: [226, 232, 240], lineWidth: 0.2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold', halign: 'center' },
    columnStyles: {
      0: { cellWidth: 16, halign: 'center' },
      1: { cellWidth: 54 },
      2: { cellWidth: 24, halign: 'right' },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 24, halign: 'right' },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 24, halign: 'right' },
      8: { cellWidth: 24, halign: 'right' },
      9: { cellWidth: 24, halign: 'right' }
    },
    didParseCell: (data) => {
      if (data.row.index >= (balance8Col?.cuentas?.length || 0)) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.textColor = [15, 23, 42];
      }
    }
  });

  addPdfFooterAndSignatures(doc, true);
  doc.save(`Balance_8_Columnas_${company.rut}_${periodo}.pdf`);
}

export function downloadBalance8ColCsv(balance8Col: Balance8ColumnasReport) {
  const headers = ['Codigo;Nombre;Clase;Debitos;Creditos;Deudor;Acreedor;Activo;Pasivo;Perdida;Ganancia'];
  const rows = (balance8Col?.cuentas || []).map(c => 
    `${c.codigo};"${c.nombre.replace(/"/g, '""')}";${c.clase};${c.debitos};${c.creditos};${c.saldo_deudor};${c.saldo_acreedor};${c.activo};${c.pasivo};${c.perdida};${c.ganancia}`
  );
  triggerCsvDownload(headers.concat(rows).join('\r\n'), `Balance_8_Columnas_${new Date().toISOString().slice(0, 10)}.csv`);
}

// ============================================================================
// 3. ESTADOS FINANCIEROS IFRS (PDF & EXCEL)
// ============================================================================

export function downloadFinancialStatementsPdf(
  ifrs: any, 
  company: ClientCompany,
  periodo = '2026-08'
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  addPdfHeader(
    doc, 
    company, 
    'Estados Financieros IFRS Clasificados', 
    `Período al 31 de Agosto de ${periodo.split('-')[0]} - Normas Internacionales de Información Financiera (NIIF / IFRS)`,
    false
  );

  const sit = ifrs?.estadoSituacion || {};
  const res = ifrs?.estadoResultados || {};

  // 1. Estado de Situación Financiera Table
  const sitBody: any[] = [];
  
  // Activos Corrientes
  sitBody.push([{ content: 'ACTIVOS CORRIENTES', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]);
  (sit.activoCorriente?.items || []).forEach((item: any) => {
    sitBody.push([`   ${item.nombre}`, fmtClp(item.saldo)]);
  });
  sitBody.push([{ content: 'Total Activos Corrientes', styles: { fontStyle: 'bold' } }, { content: fmtClp(sit.activoCorriente?.total || 0), styles: { fontStyle: 'bold' } }]);

  // Activos No Corrientes
  sitBody.push([{ content: 'ACTIVOS NO CORRIENTES', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]);
  (sit.activoNoCorriente?.items || []).forEach((item: any) => {
    sitBody.push([`   ${item.nombre}`, fmtClp(item.saldo)]);
  });
  sitBody.push([{ content: 'Total Activos No Corrientes', styles: { fontStyle: 'bold' } }, { content: fmtClp(sit.activoNoCorriente?.total || 0), styles: { fontStyle: 'bold' } }]);
  sitBody.push([{ content: 'TOTAL ACTIVOS', styles: { fontStyle: 'bold', fillColor: [226, 232, 240] } }, { content: fmtClp(sit.totalActivos || 0), styles: { fontStyle: 'bold', fillColor: [226, 232, 240] } }]);

  // Pasivos Corrientes
  sitBody.push([{ content: 'PASIVOS CORRIENTES', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]);
  (sit.pasivoCorriente?.items || []).forEach((item: any) => {
    sitBody.push([`   ${item.nombre}`, fmtClp(item.saldo)]);
  });
  sitBody.push([{ content: 'Total Pasivos Corrientes', styles: { fontStyle: 'bold' } }, { content: fmtClp(sit.pasivoCorriente?.total || 0), styles: { fontStyle: 'bold' } }]);

  // Pasivos No Corrientes
  sitBody.push([{ content: 'PASIVOS NO CORRIENTES', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]);
  (sit.pasivoNoCorriente?.items || []).forEach((item: any) => {
    sitBody.push([`   ${item.nombre}`, fmtClp(item.saldo)]);
  });
  sitBody.push([{ content: 'Total Pasivos No Corrientes', styles: { fontStyle: 'bold' } }, { content: fmtClp(sit.pasivoNoCorriente?.total || 0), styles: { fontStyle: 'bold' } }]);

  // Patrimonio Neto
  sitBody.push([{ content: 'PATRIMONIO NETO', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }]);
  (sit.patrimonio?.items || []).forEach((item: any) => {
    sitBody.push([`   ${item.nombre}`, fmtClp(item.saldo)]);
  });
  sitBody.push([{ content: 'Total Patrimonio Neto', styles: { fontStyle: 'bold' } }, { content: fmtClp(sit.patrimonio?.total || 0), styles: { fontStyle: 'bold' } }]);
  sitBody.push([{ content: 'TOTAL PASIVO Y PATRIMONIO', styles: { fontStyle: 'bold', fillColor: [226, 232, 240] } }, { content: fmtClp(sit.totalPasivoYPatrimonio || 0), styles: { fontStyle: 'bold', fillColor: [226, 232, 240] } }]);

  autoTable(doc, {
    startY: 45,
    head: [['1. Estado de Situación Financiera Clasificado (Balance General)', 'Monto CLP']],
    body: sitBody,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 50, halign: 'right' }
    }
  });

  // 2. Estado de Resultados Integral por Función
  const finalY = (doc as any).lastAutoTable.finalY + 8;
  const resBody = [
    ['Ingresos de Actividades Ordinarias (Ventas Netas)', fmtClp(res.ingresosOperacionales || 0)],
    ['(-) Costo de Ventas y Explotación', `(${fmtClp(res.costoVentas || 0)})`],
    ['MARGEN BRUTO OPERACIONAL', fmtClp(res.margenBruto || 0)],
    ['(-) Gastos de Administración, Ventas y Personal', `(${fmtClp(res.gastosAdminVentas || 0)})`],
    ['RESULTADO OPERACIONAL ANTES DE DEPRECIACIÓN (EBITDA)', fmtClp(res.ebitda || 0)],
    ['(-) Depreciación y Amortización de Activos / IFRS 16', `(${fmtClp(res.depreciacionAmortizacion || 0)})`],
    ['RESULTADO OPERACIONAL (EBIT)', fmtClp(res.resultadoOperacional || 0)],
    ['(+) Otros Ingresos Fuera de la Explotación', fmtClp(res.otrosIngresos || 0)],
    ['(-) Gastos e Intereses Financieros', `(${fmtClp(res.otrosGastosFinancieros || 0)})`],
    ['RESULTADO ANTES DE IMPUESTO A LA RENTA', fmtClp(res.resultadoAntesImpuesto || 0)],
    ['(-) Provisión Impuesto a la Renta Primera Categoría', `(${fmtClp(res.impuestoRenta || 0)})`],
    ['RESULTADO INTEGRAL NETO DEL EJERCICIO', fmtClp(res.resultadoNeto || 0)]
  ];

  if (finalY > 195) {
    doc.addPage();
  }
  const nextStartY = finalY > 195 ? 25 : finalY;

  autoTable(doc, {
    startY: nextStartY,
    head: [['2. Estado de Resultados por Función (Estado de Ganancias y Pérdidas)', 'Monto CLP']],
    body: resBody,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 1.8 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 50, halign: 'right' }
    },
    didParseCell: (data) => {
      const idx = data.row.index;
      if (idx === 2 || idx === 4 || idx === 6 || idx === 9 || idx === 11) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = idx === 11 ? [220, 252, 231] : [241, 245, 249];
      }
    }
  });

  addPdfFooterAndSignatures(doc, true);
  doc.save(`Estados_Financieros_IFRS_${company.rut}_${periodo}.pdf`);
}

export function downloadFinancialStatementsExcel(ifrs: any, company: ClientCompany) {
  const wb = XLSX.utils.book_new();

  // Situación Financiera
  const sit = ifrs?.estadoSituacion || {};
  const sitData = [
    { 'Grupo': 'ACTIVO CORRIENTE', 'Concepto': 'Total Activos Corrientes', 'Monto CLP': sit.activoCorriente?.total || 0 },
    ...(sit.activoCorriente?.items || []).map((i: any) => ({ 'Grupo': 'Activo Corriente', 'Concepto': i.nombre, 'Monto CLP': i.saldo })),
    { 'Grupo': 'ACTIVO NO CORRIENTE', 'Concepto': 'Total Activos No Corrientes', 'Monto CLP': sit.activoNoCorriente?.total || 0 },
    ...(sit.activoNoCorriente?.items || []).map((i: any) => ({ 'Grupo': 'Activo No Corriente', 'Concepto': i.nombre, 'Monto CLP': i.saldo })),
    { 'Grupo': 'TOTAL', 'Concepto': 'TOTAL ACTIVOS', 'Monto CLP': sit.totalActivos || 0 },
    { 'Grupo': 'PASIVO CORRIENTE', 'Concepto': 'Total Pasivos Corrientes', 'Monto CLP': sit.pasivoCorriente?.total || 0 },
    ...(sit.pasivoCorriente?.items || []).map((i: any) => ({ 'Grupo': 'Pasivo Corriente', 'Concepto': i.nombre, 'Monto CLP': i.saldo })),
    { 'Grupo': 'PASIVO NO CORRIENTE', 'Concepto': 'Total Pasivos No Corrientes', 'Monto CLP': sit.pasivoNoCorriente?.total || 0 },
    ...(sit.pasivoNoCorriente?.items || []).map((i: any) => ({ 'Grupo': 'Pasivo No Corriente', 'Concepto': i.nombre, 'Monto CLP': i.saldo })),
    { 'Grupo': 'PATRIMONIO', 'Concepto': 'Total Patrimonio Neto', 'Monto CLP': sit.patrimonio?.total || 0 },
    ...(sit.patrimonio?.items || []).map((i: any) => ({ 'Grupo': 'Patrimonio Neto', 'Concepto': i.nombre, 'Monto CLP': i.saldo })),
    { 'Grupo': 'TOTAL', 'Concepto': 'TOTAL PASIVO Y PATRIMONIO', 'Monto CLP': sit.totalPasivoYPatrimonio || 0 }
  ];

  const res = ifrs?.estadoResultados || {};
  const resData = [
    { 'Línea de Resultado': 'Ingresos Operacionales (Ventas Netas)', 'Monto CLP': res.ingresosOperacionales || 0 },
    { 'Línea de Resultado': '(-) Costo de Ventas', 'Monto CLP': -(res.costoVentas || 0) },
    { 'Línea de Resultado': 'MARGEN BRUTO', 'Monto CLP': res.margenBruto || 0 },
    { 'Línea de Resultado': '(-) Gastos de Administración y Ventas', 'Monto CLP': -(res.gastosAdminVentas || 0) },
    { 'Línea de Resultado': 'EBITDA (Resultado Operacional antes de Depreciación)', 'Monto CLP': res.ebitda || 0 },
    { 'Línea de Resultado': '(-) Depreciación y Amortización', 'Monto CLP': -(res.depreciacionAmortizacion || 0) },
    { 'Línea de Resultado': 'RESULTADO OPERACIONAL (EBIT)', 'Monto CLP': res.resultadoOperacional || 0 },
    { 'Línea de Resultado': '(+) Otros Ingresos', 'Monto CLP': res.otrosIngresos || 0 },
    { 'Línea de Resultado': '(-) Gastos Financieros', 'Monto CLP': -(res.otrosGastosFinancieros || 0) },
    { 'Línea de Resultado': 'RESULTADO ANTES DE IMPUESTOS', 'Monto CLP': res.resultadoAntesImpuesto || 0 },
    { 'Línea de Resultado': '(-) Impuesto a la Renta Primera Categoría', 'Monto CLP': -(res.impuestoRenta || 0) },
    { 'Línea de Resultado': 'RESULTADO NETO DEL EJERCICIO', 'Monto CLP': res.resultadoNeto || 0 }
  ];

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sitData), 'Situación Financiera');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resData), 'Estado de Resultados');

  XLSX.writeFile(wb, `EEFF_IFRS_${company.rut}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ============================================================================
// 4. LIBRO DIARIO Y LIBRO MAYOR (PDF & EXCEL)
// ============================================================================

export function downloadLibroDiarioPdf(entries: AccountingEntry[] = [], company: ClientCompany) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  addPdfHeader(
    doc, 
    company, 
    'Libro Diario Legal Oficial Foliado', 
    'Registros Contables Cronológicos Partida Doble - Cumplimiento Código de Comercio de Chile',
    false
  );

  const tableBody: any[] = [];
  let totalDebeGlobal = 0;
  let totalHaberGlobal = 0;

  safeEntries.forEach((entry, idx) => {
    tableBody.push([
      { 
        content: `ASIENTO N° ${idx + 1} | Fecha: ${entry.fecha} | Folio: ${entry.id.substring(0, 14)} | Ref: ${entry.documento || 'Comprobante'}`, 
        colSpan: 4, 
        styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [30, 41, 59] } 
      }
    ]);
    tableBody.push([
      { 
        content: `Concepto / Glosa: ${entry.concepto}`, 
        colSpan: 4, 
        styles: { fontStyle: 'italic', fontSize: 7, textColor: [71, 85, 105] } 
      }
    ]);

    (entry.lineas || []).forEach(m => {
      totalDebeGlobal += m.debe;
      totalHaberGlobal += m.haber;
      tableBody.push([
        m.cuentaCodigo,
        m.cuentaNombre,
        m.debe > 0 ? fmtClp(m.debe) : '-',
        m.haber > 0 ? fmtClp(m.haber) : '-'
      ]);
    });
  });

  // Grand totals row
  tableBody.push([
    { content: 'SUMAS IGUALES DEL LIBRO DIARIO', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [226, 232, 240] } },
    { content: fmtClp(totalDebeGlobal), styles: { fontStyle: 'bold', halign: 'right', fillColor: [226, 232, 240] } },
    { content: fmtClp(totalHaberGlobal), styles: { fontStyle: 'bold', halign: 'right', fillColor: [226, 232, 240] } }
  ]);

  autoTable(doc, {
    startY: 45,
    head: [['Código Cuenta', 'Nombre de la Cuenta / Partida', 'Debe (CLP)', 'Haber (CLP)']],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 26, halign: 'center' },
      1: { cellWidth: 94 },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' }
    }
  });

  addPdfFooterAndSignatures(doc, true);
  doc.save(`Libro_Diario_${company.rut}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function downloadLibroDiarioExcel(entries: AccountingEntry[] = [], company: ClientCompany) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const wb = XLSX.utils.book_new();

  const rows: any[] = [];
  safeEntries.forEach((entry, idx) => {
    (entry.lineas || []).forEach(m => {
      rows.push({
        'N° Asiento': idx + 1,
        'ID Asiento': entry.id,
        'Fecha': entry.fecha,
        'Concepto': entry.concepto,
        'Documento Ref': entry.documento,
        'Código Cuenta': m.cuentaCodigo,
        'Nombre Cuenta': m.cuentaNombre,
        'Debe': m.debe,
        'Haber': m.haber
      });
    });
  });

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Libro Diario');
  XLSX.writeFile(wb, `Libro_Diario_${company.rut}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function downloadLibroMayorPdf(entries: AccountingEntry[] = [], company: ClientCompany) {
  const safeEntries = Array.isArray(entries) ? entries : [];
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  addPdfHeader(
    doc, 
    company, 
    'Libro Mayor Analítico General', 
    'Movimientos y Saldos por Cuenta Contable - Partida Doble',
    false
  );

  const accountMap: Record<string, { codigo: string; nombre: string; debitos: number; creditos: number; movs: any[] }> = {};

  safeEntries.forEach(entry => {
    (entry.lineas || []).forEach(m => {
      if (!accountMap[m.cuentaCodigo]) {
        accountMap[m.cuentaCodigo] = {
          codigo: m.cuentaCodigo,
          nombre: m.cuentaNombre,
          debitos: 0,
          creditos: 0,
          movs: []
        };
      }
      accountMap[m.cuentaCodigo].debitos += m.debe;
      accountMap[m.cuentaCodigo].creditos += m.haber;
      accountMap[m.cuentaCodigo].movs.push({
        fecha: entry.fecha,
        concepto: entry.concepto,
        debe: m.debe,
        haber: m.haber
      });
    });
  });

  const tableBody: any[] = [];
  Object.values(accountMap).sort((a, b) => a.codigo.localeCompare(b.codigo)).forEach(acc => {
    const saldo = acc.debitos - acc.creditos;
    const tipoSaldo = saldo >= 0 ? `Deudor: ${fmtClp(saldo)}` : `Acreedor: ${fmtClp(Math.abs(saldo))}`;
    
    tableBody.push([
      { 
        content: `CUENTA: ${acc.codigo} - ${acc.nombre} | Saldo ${tipoSaldo}`, 
        colSpan: 4, 
        styles: { fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [15, 23, 42] } 
      }
    ]);

    acc.movs.forEach(m => {
      tableBody.push([
        m.fecha,
        m.concepto.substring(0, 48),
        m.debe > 0 ? fmtClp(m.debe) : '-',
        m.haber > 0 ? fmtClp(m.haber) : '-'
      ]);
    });

    tableBody.push([
      { content: `Total Movimientos ${acc.nombre}`, colSpan: 2, styles: { fontStyle: 'bold' } },
      { content: fmtClp(acc.debitos), styles: { fontStyle: 'bold', halign: 'right' } },
      { content: fmtClp(acc.creditos), styles: { fontStyle: 'bold', halign: 'right' } }
    ]);
  });

  autoTable(doc, {
    startY: 45,
    head: [['Fecha', 'Glosa / Concepto Operación', 'Débito (Debe)', 'Crédito (Haber)']],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 24, halign: 'center' },
      1: { cellWidth: 96 },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 30, halign: 'right' }
    }
  });

  addPdfFooterAndSignatures(doc, true);
  doc.save(`Libro_Mayor_${company.rut}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ============================================================================
// 5. FORMULARIO 29 (F29 - DECLARACIÓN MENSUAL SII)
// ============================================================================

export function downloadF29Pdf(
  f29: F29Declaration, 
  company: ClientCompany, 
  indicators?: ChileIndicators
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  addPdfHeader(
    doc, 
    company, 
    'Declaración Mensual y Pago Simultáneo de Impuestos (F29)', 
    `Período Tributario: ${f29.periodo} - Servicio de Impuestos Internos de Chile (SII)`,
    false
  );

  const f29Rows = [
    // Débitos
    [{ content: '1. DÉBITOS FISCALES DEL MES (VENTAS Y SERVICIOS)', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
    ['Facturas Emitidas y Notas de Débito Afectas', '[503 / 511]', fmtClp(f29.debitoFiscalIva)],
    ['Ventas Exentas / Exportaciones', '[020 / 028]', fmtClp(f29.ventasExentasTotal || 0)],
    [{ content: 'TOTAL DÉBITO FISCAL', styles: { fontStyle: 'bold' } }, '[538]', { content: fmtClp(f29.debitoFiscalIva), styles: { fontStyle: 'bold' } }],

    // Créditos
    [{ content: '2. CRÉDITOS FISCALES DEL MES (COMPRAS Y SERVICIOS RECIBIDOS)', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
    ['Facturas de Proveedores del Giro', '[528 / 534]', fmtClp(f29.creditoFiscalIva)],
    ['Remanente de Crédito Fiscal Mes Anterior', '[504]', fmtClp(f29.remanenteMesAnterior || 0)],
    [{ content: 'TOTAL CRÉDITO FISCAL', styles: { fontStyle: 'bold' } }, '[537]', { content: fmtClp((f29.creditoFiscalIva || 0) + (f29.remanenteMesAnterior || 0)), styles: { fontStyle: 'bold' } }],

    // Impuesto Determinado IVA
    [{ content: '3. DETERMINACIÓN DEL IVA LÍQUIDO', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
    ['IVA Determinado a Pagar', '[539]', fmtClp(f29.impuestoDeterminadoIva || 0)],
    ['Remanente para el Mes Siguiente', '[077]', fmtClp(f29.nuevoRemanenteCredito || 0)],

    // Retenciones
    [{ content: '4. RETENCIONES DE IMPUESTOS', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
    ['Retención Boletas de Honorarios (Tasa 14.5%)', '[151]', fmtClp(f29.retencionHonorariosSegundaCat || 0)],
    ['Impuesto Único a los Trabajadores (Sueldos)', '[048]', fmtClp(f29.retencionImpuestoUnicoSueldos || 0)],

    // PPM
    [{ content: '5. PAGOS PROVISIONALES MENSUALES (PPM)', colSpan: 3, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
    [`PPM Obligatorio Primera Categoría (Tasa ${(f29.tasaPpm * 100).toFixed(2)}%)`, '[062]', fmtClp(f29.montoPpm || 0)],

    // Total General
    [{ content: 'TOTAL A PAGAR AL FISCO (CÓDIGO 091)', styles: { fontStyle: 'bold', fillColor: [220, 252, 231], fontSize: 9 } }, '[091]', { content: fmtClp(f29.totalAPagar || 0), styles: { fontStyle: 'bold', fillColor: [220, 252, 231], fontSize: 9 } }]
  ];

  autoTable(doc, {
    startY: 45,
    head: [['Concepto / Glosa Tributaria Formulario 29', 'Código SII', 'Monto a Declarar (CLP)']],
    body: f29Rows as any,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 30, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 35, halign: 'right' }
    }
  });

  addPdfFooterAndSignatures(doc, true);
  doc.save(`Formulario_29_${company.rut}_${f29.periodo}.pdf`);
}

export function downloadF29Csv(f29: F29Declaration) {
  const lines = [
    'CODIGO_SII;CONCEPTO;MONTO_CLP',
    `503;DEBITO_FISCAL_IVA;${f29.debitoFiscalIva}`,
    `020;VENTAS_EXENTAS;${f29.ventasExentasTotal || 0}`,
    `528;CREDITO_FISCAL_IVA;${f29.creditoFiscalIva}`,
    `504;REMANENTE_MES_ANTERIOR;${f29.remanenteMesAnterior || 0}`,
    `539;IVA_DETERMINADO_A_PAGAR;${f29.impuestoDeterminadoIva || 0}`,
    `077;REMANENTE_MES_SIGUIENTE;${f29.nuevoRemanenteCredito || 0}`,
    `151;RETENCION_HONORARIOS;${f29.retencionHonorariosSegundaCat || 0}`,
    `048;IMPUESTO_UNICO_SUELDOS;${f29.retencionImpuestoUnicoSueldos || 0}`,
    `062;PPM_OBLIGATORIO;${f29.montoPpm || 0}`,
    `091;TOTAL_A_PAGAR;${f29.totalAPagar || 0}`
  ];
  triggerCsvDownload(lines.join('\r\n'), `F29_SII_Codigos_${f29.periodo}.csv`);
}

// ============================================================================
// 6. REMUNERACIONES Y NÓMINA (RRHH / PREVIRED)
// ============================================================================

export function downloadPayrollPdf(payrolls: EmployeePayroll[] = [], company: ClientCompany, periodo = '2026-08') {
  const safePayrolls = Array.isArray(payrolls) ? payrolls : [];
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  
  addPdfHeader(
    doc, 
    company, 
    'Libro Oficial de Remuneraciones', 
    `Período: ${periodo} - Cumplimiento Artículo 62 Código del Trabajo de Chile y Dirección del Trabajo (DT)`,
    true
  );

  const tableBody = safePayrolls.map(p => [
    p.rut,
    p.nombreCompleto.substring(0, 24),
    p.cargo.substring(0, 20),
    p.afpNombre,
    p.saludTipo,
    fmtClp(p.sueldoBase),
    fmtClp(p.totalHaberesImponibles),
    fmtClp(p.totalHaberesNoImponibles),
    fmtClp(p.afpMonto),
    fmtClp(p.saludMonto),
    fmtClp(p.impuestoUnicoMonto),
    fmtClp(p.totalDescuentos),
    fmtClp(p.sueldoLiquido),
    fmtClp(p.costoTotalEmpresa)
  ]);

  const totalImponible = safePayrolls.reduce((s, p) => s + p.totalHaberesImponibles, 0);
  const totalLiquido = safePayrolls.reduce((s, p) => s + p.sueldoLiquido, 0);
  const totalCostoEmpresa = safePayrolls.reduce((s, p) => s + p.costoTotalEmpresa, 0);

  tableBody.push([
    'TOTALES', `${safePayrolls.length} colaboradores`, '', '', '',
    '', fmtClp(totalImponible), '', '', '', '', '', fmtClp(totalLiquido), fmtClp(totalCostoEmpresa)
  ]);

  autoTable(doc, {
    startY: 45,
    head: [[
      'RUT', 'Nombre Trabajador', 'Cargo', 'AFP', 'Salud', 'S. Base', 'Tot. Imponible', 'No Impon.', 'AFP', 'Salud', 'Imp. Único', 'Tot. Desc.', 'Líquido', 'Costo Total'
    ]],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 18 },
      1: { cellWidth: 32 },
      2: { cellWidth: 26 },
      3: { cellWidth: 16 },
      4: { cellWidth: 16 },
      5: { cellWidth: 18, halign: 'right' },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 16, halign: 'right' },
      8: { cellWidth: 16, halign: 'right' },
      9: { cellWidth: 16, halign: 'right' },
      10: { cellWidth: 16, halign: 'right' },
      11: { cellWidth: 18, halign: 'right' },
      12: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
      13: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.row.index === safePayrolls.length) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [241, 245, 249];
      }
    }
  });

  addPdfFooterAndSignatures(doc, true);
  doc.save(`Libro_Remuneraciones_${company.rut}_${periodo}.pdf`);
}

export function downloadPayrollExcel(payrolls: EmployeePayroll[] = [], company: ClientCompany) {
  const safePayrolls = Array.isArray(payrolls) ? payrolls : [];
  const wb = XLSX.utils.book_new();

  const data = safePayrolls.map(p => ({
    'RUT': p.rut,
    'Nombre Completo': p.nombreCompleto,
    'Cargo': p.cargo,
    'Tipo Contrato': p.tipoContrato,
    'AFP': p.afpNombre,
    'Salud': p.saludTipo,
    'Sueldo Base': p.sueldoBase,
    'Gratificación': p.gratificacionMonto,
    'Total Imponible': p.totalHaberesImponibles,
    'Total No Imponible': p.totalHaberesNoImponibles,
    'Total Haberes': p.totalHaberesBrutos,
    'Descuento AFP': p.afpMonto,
    'Descuento Salud': p.saludMonto,
    'Descuento AFC': p.afcTrabajadorMonto,
    'Impuesto Único': p.impuestoUnicoMonto,
    'Total Descuentos': p.totalDescuentos,
    'Sueldo Líquido a Pagar': p.sueldoLiquido,
    'Aporte SIS Empleador': p.sisEmpleadorMonto,
    'Aporte Mutual Empleador': p.mutualEmpleadorMonto,
    'Aporte AFC Empleador': p.afcEmpleadorMonto,
    'Costo Total Empresa': p.costoTotalEmpresa
  }));

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Planilla Remuneraciones');
  XLSX.writeFile(wb, `Nomina_Remuneraciones_${company.rut}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function downloadPreviredCsv(payrolls: EmployeePayroll[] = [], company: ClientCompany) {
  const safePayrolls = Array.isArray(payrolls) ? payrolls : [];
  const headers = ['RUT_TRABAJADOR;NOMBRE;DIAS_TRABAJADOS;RENTA_IMPONIBLE;COD_AFP;COTIZACION_AFP;COD_SALUD;COTIZACION_SALUD;SIS;MUTUAL;AFC'];
  
  const rows = safePayrolls.map(p => {
    return [
      p.rut.replace(/\./g, ''),
      `"${p.nombreCompleto}"`,
      p.diasTrabajados || 30,
      p.totalHaberesImponibles,
      p.afpNombre,
      p.afpMonto,
      p.saludTipo,
      p.saludMonto,
      p.sisEmpleadorMonto,
      p.mutualEmpleadorMonto,
      p.afcTrabajadorMonto + p.afcEmpleadorMonto
    ].join(';');
  });

  triggerCsvDownload(headers.concat(rows).join('\r\n'), `Previred_105_${company.rut}_${new Date().toISOString().slice(0, 10)}.csv`);
}

// ============================================================================
// 7. CONCILIACIÓN BANCARIA (PDF & EXCEL)
// ============================================================================

export function downloadBankReconciliationPdf(
  account: BankAccountConfig,
  movements: BankStatementMovement[] = [],
  bookBalance: number,
  company: ClientCompany
) {
  const safeMovs = Array.isArray(movements) ? movements : [];
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  addPdfHeader(
    doc, 
    company, 
    'Certificado de Conciliación Bancaria Mensual', 
    `Banco: ${account.banco} - Cuenta Cte N° ${account.numeroCuenta} | Moneda: ${account.moneda}`,
    false
  );

  const cartolaBalance = account.saldoEnLinea || 0;
  const diferencia = Math.abs(cartolaBalance - bookBalance);

  const reconSummary = [
    [{ content: '1. SALDO SEGÚN CARTOLA BANCARIA OFICIAL', styles: { fontStyle: 'bold' } }, fmtClp(cartolaBalance)],
    ['(+) Depósitos y Abonos en Tránsito', fmtClp(0)],
    ['(-) Cheques y Giros no Cobrados en Tránsito', fmtClp(0)],
    [{ content: 'SALDO CARTOLA BANCARIA AJUSTADO', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }, { content: fmtClp(cartolaBalance), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
    [{ content: '2. SALDO SEGÚN LIBRO MAYOR (CUENTA 1.1.01)', styles: { fontStyle: 'bold' } }, fmtClp(bookBalance)],
    ['(+/-) Novedades Bancarias Pendientes de Asiento', fmtClp(diferencia)],
    [{ content: 'SALDO LIBRO MAYOR AJUSTADO', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }, { content: fmtClp(bookBalance + diferencia), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }],
    [{ 
      content: diferencia === 0 ? 'ESTADO: CUENTA 100% CONCILIADA Y CUADRADA ($0 DIFERENCIA)' : `DIFERENCIA TRANSITORIA: ${fmtClp(diferencia)}`, 
      styles: { fontStyle: 'bold', fillColor: diferencia === 0 ? [220, 252, 231] : [254, 226, 226] } 
    }, { 
      content: fmtClp(diferencia), 
      styles: { fontStyle: 'bold', fillColor: diferencia === 0 ? [220, 252, 231] : [254, 226, 226] } 
    }]
  ];

  autoTable(doc, {
    startY: 45,
    head: [['Concepto de Auditoría Bancaria', 'Monto CLP']],
    body: reconSummary as any,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 135 },
      1: { cellWidth: 45, halign: 'right' }
    }
  });

  // Details of movements
  const movBody = safeMovs.map(m => [
    m.fecha,
    m.glosaBancaria.substring(0, 38),
    m.cargo ? fmtClp(m.cargo) : '-',
    m.abono ? fmtClp(m.abono) : '-',
    fmtClp(m.saldo),
    m.estado === 'CONCILIADO' ? 'CONCILIADO' : 'PENDIENTE'
  ]);

  const nextY = (doc as any).lastAutoTable.finalY + 8;
  autoTable(doc, {
    startY: nextY,
    head: [['Fecha', 'Descripción Movimiento Cartola', 'Cargo (-)', 'Abono (+)', 'Saldo', 'Estado']],
    body: movBody,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.4 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 70 },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 22, halign: 'right' },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 22, halign: 'center', fontStyle: 'bold' }
    }
  });

  addPdfFooterAndSignatures(doc, true);
  doc.save(`Conciliacion_${account.banco}_${account.numeroCuenta}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function downloadBankReconciliationExcel(
  account: BankAccountConfig,
  movements: BankStatementMovement[] = [],
  company: ClientCompany
) {
  const safeMovs = Array.isArray(movements) ? movements : [];
  const wb = XLSX.utils.book_new();

  const rows = safeMovs.map(m => ({
    'Fecha': m.fecha,
    'Número Operación': m.numeroReferencia || '-',
    'Descripción': m.glosaBancaria,
    'Cargo (-)': m.cargo || 0,
    'Abono (+)': m.abono || 0,
    'Saldo Cartola': m.saldo,
    'Estado': m.estado,
    'Asiento ID': m.asientoGeneradoId || 'PENDIENTE'
  }));

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Cartola y Conciliación');
  XLSX.writeFile(wb, `Conciliacion_${account.banco}_${account.numeroCuenta}.xlsx`);
}

// ============================================================================
// 8. INVENTARIOS Y BODEGAS (PDF & EXCEL)
// ============================================================================

export function downloadInventoryPdf(
  items: InventoryItem[] = [],
  warehousesOrCompany?: Warehouse[] | ClientCompany,
  maybeCompany?: ClientCompany
) {
  const safeItems = Array.isArray(items) ? items : [];
  let company: ClientCompany;

  if (warehousesOrCompany && 'rut' in warehousesOrCompany) {
    company = warehousesOrCompany as ClientCompany;
  } else if (maybeCompany && 'rut' in maybeCompany) {
    company = maybeCompany;
  } else {
    company = { rut: '76.999.888-7', razonSocial: 'Empresa de Demostración SpA' } as ClientCompany;
  }

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  addPdfHeader(
    doc, 
    company, 
    'Informe de Existencias y Valorización de Inventario', 
    'Método de Valorización: Precio Medio Ponderado (PMP) - Norma NIC 2 / IFRS',
    false
  );

  const tableBody = safeItems.map(i => {
    const totalVal = i.stockGeneral * i.costoUnitarioPMP;
    return [
      i.sku,
      i.nombre.substring(0, 26),
      i.categoria,
      i.unidadMedida,
      fmtNum(i.stockGeneral),
      fmtClp(i.costoUnitarioPMP),
      fmtClp(totalVal),
      i.diasCoberturaEstimados ? `${i.diasCoberturaEstimados} d` : '-',
      i.estadoStock
    ];
  });

  const totalValorInventario = safeItems.reduce((s, i) => s + (i.stockGeneral * i.costoUnitarioPMP), 0);

  tableBody.push([
    'TOTAL', `${safeItems.length} SKUs`, '', '', '', '', fmtClp(totalValorInventario), '', ''
  ]);

  autoTable(doc, {
    startY: 45,
    head: [['SKU', 'Artículo', 'Categoría', 'U.M.', 'Stock', 'Costo PMP', 'Valor Total', 'Cob.', 'Estado']],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center' },
      1: { cellWidth: 42 },
      2: { cellWidth: 24 },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 12, halign: 'center' },
      8: { cellWidth: 16, halign: 'center' }
    }
  });

  addPdfFooterAndSignatures(doc, true);
  doc.save(`Inventario_Valorizado_${company.rut}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function downloadInventoryExcel(items: InventoryItem[] = [], company: ClientCompany) {
  const safeItems = Array.isArray(items) ? items : [];
  const wb = XLSX.utils.book_new();

  const data = safeItems.map(i => ({
    'SKU': i.sku,
    'Nombre': i.nombre,
    'Categoría': i.categoria,
    'Unidad Medida': i.unidadMedida,
    'Stock Físico': i.stockGeneral,
    'Stock Mínimo': i.stockMinimo,
    'Stock Crítico': i.stockCritico,
    'Costo Unitario PMP': i.costoUnitarioPMP,
    'Valor Total Inventario': i.stockGeneral * i.costoUnitarioPMP,
    'Consumo Promedio': i.consumoMensualPromedio,
    'Días Cobertura': i.diasCoberturaEstimados,
    'Estado Stock': i.estadoStock
  }));

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Inventario');
  XLSX.writeFile(wb, `Inventario_${company.rut}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ============================================================================
// 9. FLUJO DE CAJA Y TESORERÍA (PDF & EXCEL)
// ============================================================================

export function downloadCashFlowPdf(
  movements: CashFlowMovement[] = [], 
  company: ClientCompany,
  options?: {
    saldoInicialBancos?: number;
    saldoInicialCajas?: number;
    saldoInicialTotal?: number;
    horizonteLabel?: string;
    scenario?: string;
    timeline?: any[];
    monthlyPoints?: any[];
  }
) {
  const safeMovs = Array.isArray(movements) ? movements : [];
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  const horizonText = options?.horizonteLabel ? ` | Horizonte: ${options.horizonteLabel}` : '';
  const scenarioText = options?.scenario ? ` [Escenario: ${options.scenario}]` : '';

  addPdfHeader(
    doc, 
    company, 
    'Informe de Flujo de Caja y Posición de Tesorería', 
    `Consolidación de Bancos, Cajas y Proyecciones Operacionales${horizonText}${scenarioText}`,
    false
  );

  let currentY = 44;

  // Resumen de Posición Inicial si está disponible
  if (options?.saldoInicialTotal !== undefined) {
    const totalIng = safeMovs.filter(m => m.tipo === 'INGRESO').reduce((s, m) => s + m.montoTotal, 0);
    const totalEgr = safeMovs.filter(m => m.tipo === 'EGRESO').reduce((s, m) => s + m.montoTotal, 0);
    const saldoFinalEst = (options.saldoInicialTotal || 0) + totalIng - totalEgr;

    const summaryData = [
      [
        { content: '1. SALDO INICIAL EN CUENTAS BANCARIAS', styles: { fontStyle: 'bold' } },
        fmtClp(options.saldoInicialBancos || 0)
      ],
      [
        { content: '2. SALDO INICIAL EN EFECTIVO (CAJAS Y FONDOS FIJOS)', styles: { fontStyle: 'bold' } },
        fmtClp(options.saldoInicialCajas || 0)
      ],
      [
        { content: 'DISPONIBILIDAD TOTAL INICIAL CONSOLIDADA', styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
        { content: fmtClp(options.saldoInicialTotal || 0), styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } }
      ],
      [
        '(+) Total Ingresos Operacionales y Cobranzas Proyectadas',
        fmtClp(totalIng)
      ],
      [
        '(-) Total Egresos Operacionales, Nómina, Impuestos y Proveedores',
        fmtClp(totalEgr)
      ],
      [
        { 
          content: 'SALDO FINAL DE TESORERÍA PROYECTADO', 
          styles: { fontStyle: 'bold', fillColor: saldoFinalEst >= 0 ? [220, 252, 231] : [254, 226, 226] } 
        },
        { 
          content: fmtClp(saldoFinalEst), 
          styles: { fontStyle: 'bold', fillColor: saldoFinalEst >= 0 ? [220, 252, 231] : [254, 226, 226] } 
        }
      ]
    ];

    autoTable(doc, {
      startY: currentY,
      head: [['Resumen de Posición Consolidada y Proyección', 'Monto CLP']],
      body: summaryData as any,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 1.6 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 135 },
        1: { cellWidth: 45, halign: 'right' }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  // Cronograma Mensual (si es proyección a 1 año o mensual)
  if (options?.monthlyPoints && options.monthlyPoints.length > 0) {
    if (currentY > 200) {
      doc.addPage();
      currentY = 25;
    }

    const monthlyBody = options.monthlyPoints.map((m: any) => [
      m.mesLabel || m.periodo,
      fmtClp(m.saldoInicial),
      fmtClp(m.ingresosTotales),
      fmtClp(m.ventasHistoria || 0),
      fmtClp(m.egresosTotales),
      fmtClp(m.nomina || 0),
      fmtClp(m.f29 || 0),
      fmtClp(m.flujoNeto),
      fmtClp(m.saldoFinal),
      m.estaEnDeficit ? 'DÉFICIT' : 'OK'
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [['Mes', 'Saldo Inicial', 'Ingresos Tot.', 'Vtas Hist.', 'Egresos Tot.', 'Nómina', 'F29', 'Flujo Neto', 'Saldo Final', 'Est.']],
      body: monthlyBody,
      theme: 'grid',
      styles: { fontSize: 6.5, cellPadding: 1.2 },
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 18, halign: 'right' },
        2: { cellWidth: 18, halign: 'right' },
        3: { cellWidth: 18, halign: 'right' },
        4: { cellWidth: 18, halign: 'right' },
        5: { cellWidth: 16, halign: 'right' },
        6: { cellWidth: 16, halign: 'right' },
        7: { cellWidth: 18, halign: 'right' },
        8: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
        9: { cellWidth: 14, halign: 'center' }
      },
      didParseCell: (data) => {
        if (data.column.index === 9 && data.cell.raw === 'DÉFICIT') {
          data.cell.styles.fillColor = [254, 226, 226];
          data.cell.styles.textColor = [185, 28, 28];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  if (currentY > 210) {
    doc.addPage();
    currentY = 25;
  }

  // Detalle de Movimientos
  const tableBody = safeMovs.map(m => [
    m.fechaEstimada,
    m.concepto.substring(0, 36),
    m.tipo,
    m.categoria,
    m.tipo === 'INGRESO' ? fmtClp(m.montoTotal) : '-',
    m.tipo === 'EGRESO' ? fmtClp(m.montoTotal) : '-',
    m.estado
  ]);

  const totalIngresos = safeMovs.filter(m => m.tipo === 'INGRESO').reduce((s, m) => s + m.montoTotal, 0);
  const totalEgresos = safeMovs.filter(m => m.tipo === 'EGRESO').reduce((s, m) => s + m.montoTotal, 0);
  const flujoNeto = totalIngresos - totalEgresos;

  tableBody.push([
    'TOTALES', `${safeMovs.length} partidas`, '', '',
    fmtClp(totalIngresos), fmtClp(totalEgresos), flujoNeto >= 0 ? `Neto: +${fmtClp(flujoNeto)}` : `Déficit: ${fmtClp(flujoNeto)}`
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['Fecha', 'Concepto / Destinatario', 'Tipo', 'Categoría', 'Ingresos (+)', 'Egresos (-)', 'Estado']],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 1.4 },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 54 },
      2: { cellWidth: 18, halign: 'center' },
      3: { cellWidth: 26 },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 24, halign: 'right' },
      6: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }
    }
  });

  addPdfFooterAndSignatures(doc, true);
  doc.save(`Flujo_Caja_${company.rut}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function downloadCashFlowExcel(
  movements: CashFlowMovement[] = [], 
  company: ClientCompany,
  options?: {
    saldoInicialBancos?: number;
    saldoInicialCajas?: number;
    saldoInicialTotal?: number;
    horizonteLabel?: string;
    scenario?: string;
    timeline?: any[];
    monthlyPoints?: any[];
  }
) {
  const safeMovs = Array.isArray(movements) ? movements : [];
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen de Posición Consolidada
  if (options?.saldoInicialTotal !== undefined) {
    const totalIng = safeMovs.filter(m => m.tipo === 'INGRESO').reduce((s, m) => s + m.montoTotal, 0);
    const totalEgr = safeMovs.filter(m => m.tipo === 'EGRESO').reduce((s, m) => s + m.montoTotal, 0);
    const saldoFinalEst = (options.saldoInicialTotal || 0) + totalIng - totalEgr;

    const resumenData = [
      { 'Concepto': 'Empresa', 'Valor': company.razonSocial || company.nombreCorto },
      { 'Concepto': 'RUT', 'Valor': company.rut },
      { 'Concepto': 'Fecha de Emisión', 'Valor': new Date().toLocaleString('es-CL') },
      { 'Concepto': 'Horizonte de Proyección', 'Valor': options.horizonteLabel || '60 Días' },
      { 'Concepto': 'Escenario Evaluado', 'Valor': options.scenario || 'BASE' },
      { 'Concepto': '1. Saldo Inicial Bancos (Cuentas Corrientes)', 'Valor': options.saldoInicialBancos || 0 },
      { 'Concepto': '2. Saldo Inicial Cajas y Fondos Fijos (Efectivo)', 'Valor': options.saldoInicialCajas || 0 },
      { 'Concepto': 'Disponibilidad Total Inicial Consolidada', 'Valor': options.saldoInicialTotal || 0 },
      { 'Concepto': 'Total Ingresos y Cobranzas Proyectadas', 'Valor': totalIng },
      { 'Concepto': 'Total Egresos Proyectados', 'Valor': totalEgr },
      { 'Concepto': 'Flujo Neto del Período', 'Valor': totalIng - totalEgr },
      { 'Concepto': 'Saldo Final Proyectado de Tesorería', 'Valor': saldoFinalEst }
    ];

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumenData), 'Resumen Tesorería');
  }

  // Hoja 2: Cronograma Mensual a 12 Meses (si existe)
  if (options?.monthlyPoints && options.monthlyPoints.length > 0) {
    const monthlyData = options.monthlyPoints.map((m: any) => ({
      'Período / Mes': m.periodo || m.mesLabel,
      'Mes': m.mesLabel,
      'Saldo Inicial': m.saldoInicial,
      'Ingresos Totales': m.ingresosTotales,
      'Ventas Proyectadas Historia RCV': m.ventasHistoria || 0,
      'Cobranzas DTEs Pendientes': m.cobranzasDtes || 0,
      'Hitos Producción': m.hitosProduccion || 0,
      'Egresos Totales': m.egresosTotales,
      'Nómina y Sueldos': m.nomina || 0,
      'Previred e Imposiciones': m.previred || 0,
      'Impuestos F29': m.f29 || 0,
      'Proveedores e Insumos': m.proveedores || 0,
      'Arriendos IFRS 16': m.arriendos || 0,
      'Cajas y Fondo Fijo': m.cajasFondoFijo || 0,
      'Flujo Neto del Mes': m.flujoNeto,
      'Saldo Final Proyectado': m.saldoFinal,
      'Condición': m.estaEnDeficit ? 'DEFICIT / QUIEBRE' : 'SUPERÁVIT'
    }));

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthlyData), 'Proyección 12 Meses');
  }

  // Hoja 3: Cronograma Diario / Temporal
  if (options?.timeline && options.timeline.length > 0) {
    const timelineData = options.timeline.map((point: any) => ({
      'Fecha / Período': point.fecha || point.periodo || point.mesLabel,
      'Día / Mes': point.diaSemana || point.mesLabel || `Día ${point.diaNumero || 1}`,
      'Saldo Inicial': point.saldoInicialDia ?? point.saldoInicial ?? 0,
      'Ingresos Totales': point.ingresosDia ?? point.ingresosTotales ?? 0,
      'Egresos Totales': point.egresosDia ?? point.egresosTotales ?? 0,
      'Flujo Neto': point.flujoNetoDia ?? point.flujoNeto ?? 0,
      'Saldo Proyectado': point.saldoProyectado ?? point.saldoFinal ?? 0,
      'Estado Déficit': (point.estaEnDeficit ? 'DEFICIT / QUIEBRE' : 'SUPERÁVIT')
    }));

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(timelineData), 'Cronograma Temporal');
  }

  // Hoja 4: Partidas y Movimientos Detallados
  const data = safeMovs.map(m => ({
    'Fecha Estimada': m.fechaEstimada,
    'Fecha Real': m.fechaReal || '-',
    'Concepto': m.concepto,
    'Contraparte': m.contraparte,
    'RUT Contraparte': m.rutContraparte || '-',
    'Tipo': m.tipo,
    'Categoría': m.categoria,
    'Monto Neto': m.montoNeto,
    'Monto IVA': m.montoIva,
    'Ingreso Total': m.tipo === 'INGRESO' ? m.montoTotal : 0,
    'Egreso Total': m.tipo === 'EGRESO' ? m.montoTotal : 0,
    'Estado': m.estado,
    'Origen': m.origenModulo,
    'Folio DTE': m.dteFolioAsociado || '-',
    'Ref Interna': m.documentoReferencia || '-'
  }));

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Partidas de Flujo');

  XLSX.writeFile(wb, `Flujo_Caja_${company.rut}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ============================================================================
// 9. VALES DE SALIDA DE BODEGA / CONSUMO INTERNO (PDF & EXCEL)
// ============================================================================

export function downloadWarehouseWithdrawalsPdf(
  withdrawals: WarehouseWithdrawal[] = [],
  company: ClientCompany
) {
  const safeWithdrawals = Array.isArray(withdrawals) ? withdrawals : [];
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  addPdfHeader(
    doc,
    company,
    'Registro Oficial de Vales de Salida y Consumo de Bodega',
    'Imputación de Materiales a Órdenes de Producción y Centros de Costo - NIC 2 Inventarios',
    true
  );

  const tableBody: any[] = [];
  safeWithdrawals.forEach(w => {
    const destino = w.tipoRetiro === 'ORDEN_PRODUCCION' 
      ? `OP: ${w.ordenProduccionFolio || w.ordenProduccionId || '-'}` 
      : `CC: ${w.centroCostoNombre || w.centroCostoId || '-'}`;

    tableBody.push([
      w.folioVale,
      w.fecha,
      w.bodegaOrigenNombre || w.bodegaOrigenId,
      destino,
      w.solicitanteNombre,
      w.responsableBodegaNombre || w.responsableBodega,
      w.items?.length || 0,
      fmtClp(w.costoTotalVale || w.costoTotalRetiro || 0),
      w.alertaSobreconsumo ? 'ALERTA SOBRECONSUMO' : 'NORMAL'
    ]);
  });

  const totalCosto = safeWithdrawals.reduce((s, w) => s + (w.costoTotalVale || w.costoTotalRetiro || 0), 0);
  tableBody.push([
    'TOTALES', `${safeWithdrawals.length} vales`, '', '', '', '', '',
    fmtClp(totalCosto), ''
  ]);

  autoTable(doc, {
    startY: 45,
    head: [['Folio Vale', 'Fecha', 'Bodega Origen', 'Destino (OP / CC)', 'Solicitante', 'Responsable Bodega', 'Ítems', 'Costo Total', 'Estado']],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.5 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 32 },
      3: { cellWidth: 46 },
      4: { cellWidth: 36 },
      5: { cellWidth: 36 },
      6: { cellWidth: 14, halign: 'center' },
      7: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      8: { cellWidth: 32, halign: 'center' }
    },
    didParseCell: (data) => {
      if (data.column.index === 8 && String(data.cell.raw).includes('ALERTA')) {
        data.cell.styles.textColor = [220, 38, 38];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  addPdfFooterAndSignatures(doc, true);
  doc.save(`Vales_Salida_Bodega_${company.rut}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function downloadWarehouseWithdrawalsExcel(
  withdrawals: WarehouseWithdrawal[] = [],
  company: ClientCompany
) {
  const safeWithdrawals = Array.isArray(withdrawals) ? withdrawals : [];
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen de Vales
  const resumen = safeWithdrawals.map(w => ({
    'Folio Vale': w.folioVale,
    'Fecha': w.fecha,
    'Tipo': w.tipoRetiro || 'ORDEN_PRODUCCION',
    'Bodega': w.bodegaOrigenNombre || w.bodegaOrigenId,
    'OP Destino': w.ordenProduccionFolio || w.ordenProduccionId || '-',
    'Centro Costo Destino': w.centroCostoNombre || w.centroCostoId || '-',
    'Solicitante': w.solicitanteNombre,
    'Responsable Bodega': w.responsableBodegaNombre || w.responsableBodega,
    'Cantidad Ítems': w.items?.length || 0,
    'Costo Total Vale': w.costoTotalVale || w.costoTotalRetiro || 0,
    'Sobreconsumo Detectado': w.alertaSobreconsumo ? 'SÍ' : 'NO',
    'Guía Despacho N° 52': w.folioGuiaDespacho52 || '-',
    'Asiento Centralización': w.asientoId || 'PENDIENTE'
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Vales de Salida');

  // Hoja 2: Detalle por Ítem de Material
  const detalleItems: any[] = [];
  safeWithdrawals.forEach(w => {
    (w.items || []).forEach(item => {
      detalleItems.push({
        'Folio Vale': w.folioVale,
        'Fecha': w.fecha,
        'Bodega': w.bodegaOrigenNombre,
        'Destino': w.tipoRetiro === 'ORDEN_PRODUCCION' ? (w.ordenProduccionFolio || w.ordenProduccionId) : (w.centroCostoNombre || w.centroCostoId),
        'Item SKU': item.insumoCodigo || (item as any).itemSku || '-',
        'Nombre Material': item.insumoNombre || (item as any).itemNombre || '-',
        'Cantidad Despachada': item.cantidadSolicitada ?? (item as any).cantidadDespachada ?? 0,
        'Unidad': item.unidadMedida,
        'Costo Unitario PMP': item.costoUnitarioPMP ?? 0,
        'Costo Total': item.costoTotal ?? 0,
        'Sobreconsumo': item.haySobreconsumo ? 'SÍ' : 'NO',
        'Desvío Cantidad': item.desvioCantidad || 0,
        'Impacto en Margen': item.impactoEstimadoEnMargenClp || 0
      });
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalleItems), 'Detalle Insumos Despachados');

  XLSX.writeFile(wb, `Vales_Salida_Bodega_${company.rut}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ============================================================================
// 10. CONTRATOS DE ARRIENDO (IFRS 16 - PDF & EXCEL)
// ============================================================================

export function downloadLeasesPdf(leases: LeaseContract[] = [], company?: ClientCompany, indicators?: ChileIndicators) {
  const safeLeases = Array.isArray(leases) ? leases : [];
  const safeCompany = company || { rut: '76.123.456-7', razonSocial: 'Empresa Contribuyente SpA' } as ClientCompany;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  
  addPdfHeader(
    doc, 
    safeCompany, 
    'Cartera de Arrendamientos y Pasivos Financieros IFRS 16', 
    'Activos por Derecho de Uso y Pasivos por Arrendamiento Financiero',
    false
  );

  const tableBody = safeLeases.map(l => [
    l.id.substring(0, 10),
    (l.arrendadorNombre || l.arrendadorRut).substring(0, 24),
    (l.nombreBien || l.inmuebleDescripcion || 'Inmueble').substring(0, 24),
    `${l.plazoMeses || 36} m`,
    fmtClp(l.montoMensualClp || l.montoCanonMensual || (indicators && l.montoMensualMoneda === 'UF' ? l.montoMensualValor * indicators.uf : l.montoMensualValor) || 0),
    `${((l.tasaDescuentoAnualPct || (l.tasaDescuentoAnual ? l.tasaDescuentoAnual * 100 : 5.5))).toFixed(1)}%`,
    fmtClp(l.activoDerechoUso || 0),
    fmtClp(l.pasivoArrendamiento || 0)
  ]);

  autoTable(doc, {
    startY: 45,
    head: [['ID Contrato', 'Arrendador', 'Bien Arrendado', 'Plazo', 'Canon', 'Tasa Desc.', 'Activo DDU', 'Pasivo IFRS 16']],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 7.5, cellPadding: 1.6 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 36 },
      2: { cellWidth: 36 },
      3: { cellWidth: 14, halign: 'center' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 24, halign: 'right' },
      7: { cellWidth: 24, halign: 'right', fontStyle: 'bold' }
    }
  });

  addPdfFooterAndSignatures(doc, true);
  doc.save(`Arriendos_IFRS16_${safeCompany.rut}.pdf`);
}

export function downloadLeasesExcel(leases: LeaseContract[] = [], company?: ClientCompany, indicators?: ChileIndicators) {
  const safeLeases = Array.isArray(leases) ? leases : [];
  const safeCompany = company || { rut: '76.123.456-7', razonSocial: 'Empresa Contribuyente SpA' } as ClientCompany;
  const wb = XLSX.utils.book_new();

  const data = safeLeases.map(l => ({
    'ID Contrato': l.id,
    'Arrendador': l.arrendadorNombre,
    'RUT Arrendador': l.arrendadorRut,
    'Bien Arrendado': l.nombreBien || l.inmuebleDescripcion,
    'Fecha Inicio': l.fechaInicio,
    'Plazo Meses': l.plazoMeses,
    'Canon Mensual': l.montoMensualClp || l.montoCanonMensual || (indicators && l.montoMensualMoneda === 'UF' ? l.montoMensualValor * indicators.uf : l.montoMensualValor),
    'Moneda': l.moneda || l.montoMensualMoneda || 'CLP',
    'Tasa Descuento': l.tasaDescuentoAnualPct || (l.tasaDescuentoAnual ? l.tasaDescuentoAnual * 100 : 5.5),
    'Activo ROU': l.activoDerechoUso || 0,
    'Pasivo Financiero': l.pasivoArrendamiento || 0,
    'Amortización Mensual': l.amortizacionMensual || 0,
    'Interés Mensual': l.interesMensual || 0,
    'Tratamiento': l.esIfrs16 ? 'IFRS 16 (ROU / Pasivo)' : 'Gasto Operacional'
  }));

  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Arriendos IFRS 16');
  XLSX.writeFile(wb, `Arriendos_IFRS16_${safeCompany.rut}.xlsx`);
}

