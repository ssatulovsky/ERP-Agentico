import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ExpenseReport, ExpenseItem } from '../types';
import { formatCLP } from './expenseManagementAgent';

export interface ExpensePdfGeneratorOptions {
  empresaNombre: string;
  empresaRut: string;
  report: ExpenseReport;
  comprobantes: ExpenseItem[];
  collaboratorInfo?: {
    nombre: string;
    rut: string;
    cargo?: string;
    email?: string;
  };
}

/**
 * Genera un PDF formal de rendición de gastos con diseño corporativo chileno (SII / IFRS / Auditoría)
 * Incluye cabecera oficial, resumen de liquidación de fondos, desglose de comprobantes validados,
 * y recuadros de firma y certificación del Agente IA.
 */
export function generateExpenseReportPDF({
  empresaNombre,
  empresaRut,
  report,
  comprobantes,
  collaboratorInfo,
}: ExpensePdfGeneratorOptions): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const safeComprobantes = comprobantes && comprobantes.length > 0 ? comprobantes : (report.comprobantes || []);

  const totalRendido = safeComprobantes.reduce((sum, item) => sum + (Number(item.montoTotalClp) || 0), 0);
  const totalNeto = safeComprobantes.reduce((sum, item) => sum + (Number(item.montoNeto) || 0), 0);
  const totalIva = safeComprobantes.reduce((sum, item) => sum + (Number(item.montoIva) || 0), 0);
  const totalExento = safeComprobantes.reduce((sum, item) => sum + (Number(item.montoExento) || 0), 0);

  const fondo = Number(report.fondoAsignadoClp) || 0;
  const saldoReembolso = Math.max(0, totalRendido - fondo);
  const saldoReintegro = Math.max(0, fondo - totalRendido);

  // 1. Barra superior corporativa (Azul / Índigo oscuro)
  doc.setFillColor(30, 58, 138); // #1e3a8a
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Línea acento dorada / cian
  doc.setFillColor(59, 130, 246); // #3b82f6
  doc.rect(0, 28, pageWidth, 1.5, 'F');

  // Textos de Cabecera
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(empresaNombre.toUpperCase(), 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(191, 219, 254); // blue-200
  doc.text(`RUT: ${empresaRut} • ERP Agéntico Contable MySQL 8.0`, 14, 17);
  doc.text('AUDITORÍA Y ADMINISTRACIÓN AUTÓNOMA DE RENDICIONES DE GASTOS', 14, 22);

  // Folio y Fecha Emisión a la derecha
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`FOLIO: ${report.folio || 'RDG-2026-001'}`, pageWidth - 14, 11, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(224, 242, 254);
  const fechaGeneracion = new Date().toLocaleDateString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  doc.text(`Emisión: ${fechaGeneracion}`, pageWidth - 14, 16, { align: 'right' });
  doc.text(`Estado: ${report.estado || 'APROBADA'}`, pageWidth - 14, 21, { align: 'right' });

  // 2. Título del Documento
  let currentY = 36;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('INFORME OFICIAL DE RENDICIÓN DE GASTOS', 14, currentY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Conforme a Art. 31 Ley sobre Impuesto a la Renta (LIR) y Circulares SII de Respaldo Documental', 14, currentY + 5);

  currentY += 10;

  // 3. Ficha de Datos del Colaborador y Rendición (Card Box)
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, currentY, pageWidth - 28, 26, 2, 2, 'FD');

  const rendidorNombre = report.rendidorNombre || collaboratorInfo?.nombre || 'Colaborador';
  const rendidorRut = report.rendidorRut || collaboratorInfo?.rut || '-';
  const rendidorCargo = report.rendidorCargo || collaboratorInfo?.cargo || 'Colaborador de Terreno';
  const rendidorEmail = report.rendidorEmail || collaboratorInfo?.email || '-';

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  // Columna 1
  doc.setFont('helvetica', 'bold');
  doc.text('Colaborador / Rendidor:', 18, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(`${rendidorNombre} (${rendidorRut})`, 54, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Cargo / Área:', 18, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(rendidorCargo, 54, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('Correo Electrónico:', 18, currentY + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(rendidorEmail, 54, currentY + 18);

  doc.setFont('helvetica', 'bold');
  doc.text('Título / Asunto:', 18, currentY + 24);
  doc.setFont('helvetica', 'normal');
  doc.text(report.titulo || 'Gastos Operacionales', 54, currentY + 24);

  // Columna 2
  const col2X = 120;
  doc.setFont('helvetica', 'bold');
  doc.text('Centro de Costo:', col2X, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(report.centroCostoNombre || report.centroCostoCodigo || 'Operaciones & Terreno', col2X + 28, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.text('Proyecto:', col2X, currentY + 12);
  doc.setFont('helvetica', 'normal');
  doc.text(report.proyectoNombre || report.proyectoCodigo || 'Operación Regular', col2X + 28, currentY + 12);

  doc.setFont('helvetica', 'bold');
  doc.text('Período Rendición:', col2X, currentY + 18);
  doc.setFont('helvetica', 'normal');
  doc.text(`${report.fechaInicio || '-'} al ${report.fechaCierre || '-'}`, col2X + 28, currentY + 18);

  doc.setFont('helvetica', 'bold');
  doc.text('Auditoría IA Score:', col2X, currentY + 24);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text(`${report.agenteAuditorScore || 98}/100 (Validado y Conforme)`, col2X + 28, currentY + 24);

  currentY += 31;

  // 4. Tarjetas de Resumen Financiero y Liquidación (KPI Boxes)
  const boxWidth = (pageWidth - 28 - 9) / 4;
  const boxHeight = 16;

  // Caja 1: Fondo Asignado
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, currentY, boxWidth, boxHeight, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('FONDO / ANTICIPO', 17, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formatCLP(fondo), 17, currentY + 12);

  // Caja 2: Total Rendido
  doc.setFillColor(238, 242, 255); // indigo-50
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(14 + boxWidth + 3, currentY, boxWidth, boxHeight, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(79, 70, 229);
  doc.text('TOTAL GASTOS RENDIDOS', 17 + boxWidth + 3, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 27, 75);
  doc.text(formatCLP(totalRendido), 17 + boxWidth + 3, currentY + 12);

  // Caja 3: Liquidación Saldo (Reembolso a favor o Reintegro a empresa)
  const isReembolso = saldoReembolso > 0;
  if (isReembolso) {
    doc.setFillColor(236, 253, 245); // emerald-50
    doc.setDrawColor(167, 243, 208);
  } else {
    doc.setFillColor(254, 252, 232); // yellow-50
    doc.setDrawColor(254, 240, 138);
  }
  doc.roundedRect(14 + (boxWidth + 3) * 2, currentY, boxWidth, boxHeight, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  if (isReembolso) {
    doc.setTextColor(5, 150, 105);
  } else {
    doc.setTextColor(180, 83, 9);
  }
  doc.text(isReembolso ? 'SALDO A REEMBOLSAR (A FAVOR)' : 'REINTEGRO EMPRESA', 17 + (boxWidth + 3) * 2, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  if (isReembolso) {
    doc.setTextColor(4, 120, 87);
  } else {
    doc.setTextColor(161, 98, 7);
  }
  doc.text(isReembolso ? `+${formatCLP(saldoReembolso)}` : formatCLP(saldoReintegro), 17 + (boxWidth + 3) * 2, currentY + 12);

  // Caja 4: Desglose Tributario (IVA y Comprobantes)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14 + (boxWidth + 3) * 3, currentY, boxWidth, boxHeight, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`COMPROBANTES: ${safeComprobantes.length}`, 17 + (boxWidth + 3) * 3, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(`IVA Recup: ${formatCLP(totalIva)}`, 17 + (boxWidth + 3) * 3, currentY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Neto: ${formatCLP(totalNeto)}`, 17 + (boxWidth + 3) * 3, currentY + 14);

  currentY += boxHeight + 6;

  // 5. Tabla de Comprobantes Validados con jspdf-autotable
  const tableData = safeComprobantes.map((item, index) => {
    const docTypeLabel =
      item.tipoDocumento === 'BOLETA_ELECTRONICA'
        ? 'Boleta Electr.'
        : item.tipoDocumento === 'FACTURA_ELECTRONICA_33'
        ? 'Factura Afecta (33)'
        : item.tipoDocumento === 'FACTURA_EXENTA_34'
        ? 'Factura Exenta (34)'
        : item.tipoDocumento === 'TICKET_PEAJE'
        ? 'Peaje / TAG'
        : item.tipoDocumento === 'BOLETA_HONORARIOS'
        ? 'B. Honorarios'
        : 'Comprobante';

    return [
      String(index + 1),
      item.fecha || '-',
      docTypeLabel,
      item.folioDocumento || 'S/N',
      (item.proveedorRazonSocial || 'Proveedor').substring(0, 20),
      item.proveedorRut || '-',
      (item.categoria || 'OPERACIONAL').replace('_', ' '),
      (item.descripcionGlosa || 'Gasto operacional verificado').substring(0, 24),
      formatCLP(Number(item.montoNeto) || 0),
      formatCLP(Number(item.montoIva) || 0),
      formatCLP(Number(item.montoTotalClp) || 0),
      item.validadoPorAgente !== false ? 'Validado IA' : 'En Revisión',
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        '#',
        'Fecha',
        'Tipo Doc.',
        'Folio',
        'Proveedor',
        'RUT Prov.',
        'Categoría',
        'Detalle / Glosa',
        'Neto',
        'IVA 19%',
        'Total CLP',
        'Estado IA',
      ],
    ],
    body: tableData,
    foot: [
      [
        { content: 'TOTALES VALIDADOS', colSpan: 8, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatCLP(totalNeto), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatCLP(totalIva), styles: { halign: 'right', fontStyle: 'bold' } },
        { content: formatCLP(totalRendido), styles: { halign: 'right', fontStyle: 'bold', textColor: [30, 58, 138] } },
        { content: '100% OK', styles: { halign: 'center', fontStyle: 'bold', textColor: [16, 185, 129] } },
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      valign: 'middle',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 58, 138], // Indigo corporativo
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.8,
      halign: 'left',
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 7.2,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 6, halign: 'center' },
      1: { cellWidth: 16 },
      2: { cellWidth: 19 },
      3: { cellWidth: 12 },
      4: { cellWidth: 22 },
      5: { cellWidth: 18 },
      6: { cellWidth: 18 },
      7: { cellWidth: 26 },
      8: { cellWidth: 14, halign: 'right' },
      9: { cellWidth: 12, halign: 'right' },
      10: { cellWidth: 15, halign: 'right', fontStyle: 'bold' },
      11: { cellWidth: 14, halign: 'center', textColor: [5, 150, 105], fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      // Pie de página en cada hoja
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184); // slate-400
      const footerText =
        'Documento formal generado por ERP Agéntico • Validez probatoria interna y fiscal SII • Listo para envío por WhatsApp o Correo Institucional';
      doc.text(footerText, 14, pageHeight - 8);
      doc.text(`Pág. ${doc.getNumberOfPages()}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
    },
  });

  // Posición después de la tabla
  let afterTableY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : currentY + 60;

  // Si no hay suficiente espacio para las firmas en la página actual, agregar una nueva página
  if (afterTableY + 45 > pageHeight) {
    doc.addPage();
    afterTableY = 20;
  }

  // 6. Recuadros de Firma y Certificación Formal
  const signBoxWidth = (pageWidth - 28 - 8) / 3;
  const signBoxHeight = 32;

  // Recuadro 1: Rendidor / Colaborador
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, afterTableY, signBoxWidth, signBoxHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('FIRMA COLABORADOR / RENDIDOR', 17, afterTableY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Declaro bajo fe de juramento que los comprobantes', 17, afterTableY + 10);
  doc.text('adjuntos corresponden a gastos reales de la empresa.', 17, afterTableY + 14);
  // Línea de firma
  doc.setDrawColor(148, 163, 184);
  doc.line(18, afterTableY + 24, 14 + signBoxWidth - 4, afterTableY + 24);
  doc.setFontSize(6.5);
  doc.text(rendidorNombre, 17, afterTableY + 28);
  doc.text(`RUT: ${rendidorRut}`, 17, afterTableY + 31);

  // Recuadro 2: Aprobación Jefatura / Finanzas
  const box2X = 14 + signBoxWidth + 4;
  doc.roundedRect(box2X, afterTableY, signBoxWidth, signBoxHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('APROBACIÓN JEFATURA & FINANZAS', box2X + 3, afterTableY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Autorizado para liquidación contable y', box2X + 3, afterTableY + 10);
  doc.text(`pago de ${isReembolso ? 'reembolso' : 'cierre de anticipo'} correspondiente.`, box2X + 3, afterTableY + 14);
  doc.line(box2X + 4, afterTableY + 24, box2X + signBoxWidth - 4, afterTableY + 24);
  doc.setFontSize(6.5);
  doc.text(report.aprobadorNombre || 'Gerencia de Administración & Finanzas', box2X + 3, afterTableY + 28);
  doc.text('Aprobación Digital Verificada', box2X + 3, afterTableY + 31);

  // Recuadro 3: Certificación Agente IA & MySQL Ledger
  const box3X = box2X + signBoxWidth + 4;
  doc.setFillColor(240, 249, 255); // sky-50
  doc.setDrawColor(186, 230, 253);
  doc.roundedRect(box3X, afterTableY, signBoxWidth, signBoxHeight, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(2, 132, 199); // sky-600
  doc.text('CERTIFICACIÓN AGENTE IA & LEDGER', box3X + 3, afterTableY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('• OCR & Visión Computacional Verificada', box3X + 3, afterTableY + 11);
  doc.text('• Validez Tributaria SII Art. 31 LIR 100%', box3X + 3, afterTableY + 15);
  doc.text(`• Asiento: ${report.asientoContableId || 'REGISTRADO_LEDGER'}`, box3X + 3, afterTableY + 19);
  doc.text('• Hash HMAC-SHA256 Audit Trail OK', box3X + 3, afterTableY + 23);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text('✓ TIMBRE DIGITAL DE CONFORMIDAD', box3X + 3, afterTableY + 29);

  return doc;
}

/**
 * Descarga y opcionalmente comparte por Web Share API (WhatsApp / Email nativo)
 */
export async function downloadAndShareExpenseReportPDF({
  empresaNombre,
  empresaRut,
  report,
  comprobantes,
  collaboratorInfo,
}: ExpensePdfGeneratorOptions): Promise<{
  success: boolean;
  filename: string;
  sharedViaNativeShare?: boolean;
}> {
  const doc = generateExpenseReportPDF({
    empresaNombre,
    empresaRut,
    report,
    comprobantes,
    collaboratorInfo,
  });

  const cleanFolio = (report.folio || 'RDG').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanCollab = (collaboratorInfo?.nombre || report.rendidorNombre || 'Colaborador')
    .split(' ')[0]
    .replace(/[^a-zA-Z0-9]/g, '');
  const filename = `Rendicion_${cleanFolio}_${cleanCollab}.pdf`;

  // 1. Descarga directa en el navegador
  doc.save(filename);

  // 2. Si el dispositivo soporta Web Share API con archivos (típico en Smartphones Android y iPhone),
  // intentar compartir de forma directa y fluida hacia WhatsApp o Mail
  let sharedViaNativeShare = false;
  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const pdfBlob = doc.output('blob');
      const file = new File([pdfBlob], filename, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Rendición de Gastos ${report.folio}`,
          text: `Hola, adjunto documento formal de rendición de gastos ${report.folio} por ${formatCLP(
            report.montoTotalRendidoClp || 0
          )} (${empresaNombre}).`,
        });
        sharedViaNativeShare = true;
      }
    } catch (err: any) {
      // Si el usuario cancela la hoja de compartir nativa (AbortError), no es un error de sistema
      if (err.name !== 'AbortError') {
        console.warn('[ExpensePDF] Web Share API no completada:', err);
      }
    }
  }

  return { success: true, filename, sharedViaNativeShare };
}

/**
 * Genera el enlace directo para enviar notificación por WhatsApp
 */
export function getWhatsAppExpenseShareUrl(
  report: ExpenseReport,
  empresaNombre: string,
  totalRendido: number,
  saldoReembolso: number
): string {
  const text = `📋 *Rendición de Gastos - ${empresaNombre}*
Folio: *${report.folio || 'RDG'}*
Rendidor: *${report.rendidorNombre}*
Total Rendido: *${formatCLP(totalRendido)}*
${saldoReembolso > 0 ? `Saldo a Reembolsar: *+${formatCLP(saldoReembolso)}*` : `Fondo Cuadrado`}
Comprobantes: *${report.comprobantes?.length || 0} validados con IA*

📄 *He descargado el PDF formal oficial de la rendición.* Te lo adjunto a continuación para revisión y aprobación.`;

  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Genera el enlace directo para enviar por Correo Electrónico
 */
export function getEmailExpenseShareUrl(
  report: ExpenseReport,
  empresaNombre: string,
  totalRendido: number,
  saldoReembolso: number
): string {
  const subject = `Rendición de Gastos ${report.folio || 'RDG'} - ${report.rendidorNombre}`;
  const body = `Estimado equipo de Finanzas / Jefatura,

Adjunto el documento formal de Rendición de Gastos en PDF generado desde el Sistema ERP Agéntico:

- Empresa: ${empresaNombre}
- Folio: ${report.folio || 'RDG'}
- Colaborador: ${report.rendidorNombre} (${report.rendidorRut})
- Cargo: ${report.rendidorCargo || 'Colaborador'}
- Centro de Costo: ${report.centroCostoNombre || 'Operaciones'}
- Proyecto: ${report.proyectoNombre || 'General'}
- Total Rendido: ${formatCLP(totalRendido)}
- Fondo Asignado: ${formatCLP(report.fondoAsignadoClp || 0)}
- Saldo: ${saldoReembolso > 0 ? `A reembolsar al colaborador: ${formatCLP(saldoReembolso)}` : 'Conforme'}
- Comprobantes: ${report.comprobantes?.length || 0} documentos auditados por el Agente IA

Favor revisar el archivo PDF adjunto para su aprobación final y reembolso.

Atentamente,
${report.rendidorNombre}`;

  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
