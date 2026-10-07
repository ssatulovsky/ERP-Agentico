import ExcelJS from 'exceljs';
import {
  CashFlowExcelThemeConfig,
  CashFlowMovement,
  CompanyProfile,
  CashFlowCategory,
} from '../types';

// ============================================================================
// TEMAS CORPORATIVOS PREESTABLECIDOS PARA PLANILLAS EXCEL
// ============================================================================

export const EXCEL_PRESET_THEMES: Record<string, CashFlowExcelThemeConfig> = {
  NAVY_CORPORATE: {
    id: 'NAVY_CORPORATE',
    name: 'Azul Ejecutivo Corporativo',
    description: 'Estilo C-Level sobrio con azul marino profundo, blanco y azul hielo. Ideal para Directorios y Bancos.',
    fontFamily: 'Calibri',
    fontSizeHeader: 11,
    fontSizeData: 10,
    headerBgColor: '#1E3A8A', // Deep Navy
    headerTextColor: '#FFFFFF',
    kpiBannerBgColor: '#0F172A', // Slate dark
    kpiBannerTextColor: '#F8FAFC',
    summaryRowBgColor: '#DBEAFE', // Ice blue
    summaryRowTextColor: '#1E3A8A',
    ingresosSectionColor: '#047857', // Forest green
    ingresosRowBgColor: '#F0FDF4', // Mint light
    ingresosTextColor: '#064E3B',
    egresosSectionColor: '#B91C1C', // Strong red
    egresosRowBgColor: '#FEF2F2', // Rose light
    egresosTextColor: '#7F1D1D',
    saldosAcumRowBgColor: '#1E40AF', // Blue 700
    saldosAcumRowTextColor: '#FFFFFF',
    numberFormat: 'CLP_NO_DECIMALS',
    negativeFormat: 'PARENTHESIS_RED',
    enableZebraStripes: true,
    zebraBgColor: '#F8FAFC',
    enableDoubleUnderlineTotals: true,
    enableFreezePanes: true,
    enableKpiCards: true,
    enableCompanyHeader: true,
    includeFlatMovementsSheet: true,
    autoColumnWidths: true,
  },
  FOREST_EMERALD: {
    id: 'FOREST_EMERALD',
    name: 'Verde Esmeralda Tesorería',
    description: 'Paleta inspirada en banca y flujos monetarios. Tonos esmeralda, menta y salmón suave.',
    fontFamily: 'Segoe UI',
    fontSizeHeader: 11,
    fontSizeData: 10,
    headerBgColor: '#065F46', // Emerald dark
    headerTextColor: '#FFFFFF',
    kpiBannerBgColor: '#064E3B',
    kpiBannerTextColor: '#ECFDF5',
    summaryRowBgColor: '#D1FAE5', // Mint
    summaryRowTextColor: '#064E3B',
    ingresosSectionColor: '#059669',
    ingresosRowBgColor: '#ECFDF5',
    ingresosTextColor: '#065F46',
    egresosSectionColor: '#BE123C', // Rose
    egresosRowBgColor: '#FFF1F2',
    egresosTextColor: '#881337',
    saldosAcumRowBgColor: '#047857',
    saldosAcumRowTextColor: '#FFFFFF',
    numberFormat: 'CLP_NO_DECIMALS',
    negativeFormat: 'PARENTHESIS_RED',
    enableZebraStripes: true,
    zebraBgColor: '#F0FDF4',
    enableDoubleUnderlineTotals: true,
    enableFreezePanes: true,
    enableKpiCards: true,
    enableCompanyHeader: true,
    includeFlatMovementsSheet: true,
    autoColumnWidths: true,
  },
  BORDEAUX_AUDITOR: {
    id: 'BORDEAUX_AUDITOR',
    name: 'Burdeos Auditor / Prestigio',
    description: 'Elegancia institucional con tonos burdeos y vino tinto. Típico de informes de auditoría externa Big Four.',
    fontFamily: 'Arial',
    fontSizeHeader: 11,
    fontSizeData: 10,
    headerBgColor: '#831843', // Deep Wine
    headerTextColor: '#FFFFFF',
    kpiBannerBgColor: '#701A75',
    kpiBannerTextColor: '#FDF2F8',
    summaryRowBgColor: '#FCE7F3', // Soft pink
    summaryRowTextColor: '#831843',
    ingresosSectionColor: '#0D9488', // Teal
    ingresosRowBgColor: '#F0FDFA',
    ingresosTextColor: '#134E4A',
    egresosSectionColor: '#9F1239',
    egresosRowBgColor: '#FFF1F2',
    egresosTextColor: '#881337',
    saldosAcumRowBgColor: '#831843',
    saldosAcumRowTextColor: '#FFFFFF',
    numberFormat: 'CLP_NO_DECIMALS',
    negativeFormat: 'PARENTHESIS_RED',
    enableZebraStripes: true,
    zebraBgColor: '#FAF5FF',
    enableDoubleUnderlineTotals: true,
    enableFreezePanes: true,
    enableKpiCards: true,
    enableCompanyHeader: true,
    includeFlatMovementsSheet: true,
    autoColumnWidths: true,
  },
  GRAPHITE_MODERN: {
    id: 'GRAPHITE_MODERN',
    name: 'Grafito & Pizarra FinTech',
    description: 'Aspecto moderno, minimalista de alta tecnología. Cabeceras gris pizarra oscuro y contrastes limpios.',
    fontFamily: 'Aptos',
    fontSizeHeader: 11,
    fontSizeData: 10,
    headerBgColor: '#0F172A', // Slate 900
    headerTextColor: '#FFFFFF',
    kpiBannerBgColor: '#1E293B',
    kpiBannerTextColor: '#F8FAFC',
    summaryRowBgColor: '#E2E8F0', // Slate 200
    summaryRowTextColor: '#0F172A',
    ingresosSectionColor: '#10B981', // Emerald modern
    ingresosRowBgColor: '#F8FAFC',
    ingresosTextColor: '#0F172A',
    egresosSectionColor: '#F43F5E', // Rose modern
    egresosRowBgColor: '#FFF1F2',
    egresosTextColor: '#0F172A',
    saldosAcumRowBgColor: '#334155', // Slate 700
    saldosAcumRowTextColor: '#FFFFFF',
    numberFormat: 'CLP_NO_DECIMALS',
    negativeFormat: 'MINUS_RED',
    enableZebraStripes: true,
    zebraBgColor: '#F1F5F9',
    enableDoubleUnderlineTotals: true,
    enableFreezePanes: true,
    enableKpiCards: true,
    enableCompanyHeader: true,
    includeFlatMovementsSheet: true,
    autoColumnWidths: true,
  },
  CLASSIC_ACCOUNTANT: {
    id: 'CLASSIC_ACCOUNTANT',
    name: 'Clásico Contador Auditor',
    description: 'Tonos cálidos ámbar/dorado y gris financiero. Borde doble de cuadratura contable y máxima legibilidad.',
    fontFamily: 'Calibri',
    fontSizeHeader: 11,
    fontSizeData: 10,
    headerBgColor: '#78350F', // Warm Amber
    headerTextColor: '#FFFFFF',
    kpiBannerBgColor: '#451A03',
    kpiBannerTextColor: '#FEF3C7',
    summaryRowBgColor: '#FEF3C7', // Amber light
    summaryRowTextColor: '#78350F',
    ingresosSectionColor: '#15803D',
    ingresosRowBgColor: '#F0FDF4',
    ingresosTextColor: '#14532D',
    egresosSectionColor: '#C2410C', // Orange/Rust
    egresosRowBgColor: '#FFF7ED',
    egresosTextColor: '#7C2D12',
    saldosAcumRowBgColor: '#78350F',
    saldosAcumRowTextColor: '#FFFFFF',
    numberFormat: 'CLP_NO_DECIMALS',
    negativeFormat: 'PARENTHESIS_RED',
    enableZebraStripes: true,
    zebraBgColor: '#FFFBEB',
    enableDoubleUnderlineTotals: true,
    enableFreezePanes: true,
    enableKpiCards: true,
    enableCompanyHeader: true,
    includeFlatMovementsSheet: true,
    autoColumnWidths: true,
  },
};

// ============================================================================
// UTILITARIOS DE COLOR Y FORMATO EXCELJS
// ============================================================================

export function hexToArgb(hex: string): string {
  if (!hex) return 'FFFFFFFF';
  let cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (cleanHex.length === 6) {
    return 'FF' + cleanHex.toUpperCase();
  }
  if (cleanHex.length === 8) {
    return cleanHex.toUpperCase();
  }
  return 'FFFFFFFF';
}

export function getExcelNumberFormat(
  numberFormat: CashFlowExcelThemeConfig['numberFormat'],
  negativeFormat: CashFlowExcelThemeConfig['negativeFormat']
): string {
  const redTag = negativeFormat.includes('RED') ? '[Red]' : '';
  const isParen = negativeFormat === 'PARENTHESIS_RED';

  switch (numberFormat) {
    case 'CLP_NO_DECIMALS':
      if (isParen) {
        return `"$"#,##0;${redTag}("$"#,##0);"-"`;
      }
      return `"$"#,##0;${redTag}-"$"#,##0;"-"`;

    case 'CLP_WITH_DECIMALS':
      if (isParen) {
        return `"$"#,##0.00;${redTag}("$"#,##0.00);"-"`;
      }
      return `"$"#,##0.00;${redTag}-"$"#,##0.00;"-"`;

    case 'USD_STANDARD':
      if (isParen) {
        return `"US$"#,##0.00;${redTag}("US$"#,##0.00);"-"`;
      }
      return `"US$"#,##0.00;${redTag}-"US$"#,##0.00;"-"`;

    case 'EUR_STANDARD':
      if (isParen) {
        return `"€"#,##0.00;${redTag}("€"#,##0.00);"-"`;
      }
      return `"€"#,##0.00;${redTag}-"€"#,##0.00;"-"`;

    default:
      return `"$"#,##0;${redTag}("$"#,##0);"-"`;
  }
}

export interface DayColumnMatrix {
  dateStr: string;
  dayDisplay: string;
  index: number;
}

export interface ConceptRowMatrix {
  id: string;
  nombre: string;
  grupo: 'INGRESO' | 'EGRESO';
  cuentaContableRef?: string;
}

export interface MatrixExportData {
  daysColumns: DayColumnMatrix[];
  conceptRows: ConceptRowMatrix[];
  dailyTotals: Record<
    string,
    {
      totalIngresos: number;
      totalEgresos: number;
      saldoDiario: number;
      saldoArrastrado: number;
    }
  >;
  cellMap: Record<
    string,
    Record<
      string,
      {
        total: number;
        count: number;
      }
    >
  >;
  rowTotals: Record<string, { total: number; count: number }>;
  grandTotalIngresos: number;
  grandTotalEgresos: number;
  grandNetFlow: number;
  finalSaldo: number;
  initialBalance: number;
  scenario: string;
  baseDateStr: string;
  rawMovements: CashFlowMovement[];
}

export interface GenerateStyledExcelOptions {
  company: CompanyProfile;
  theme: CashFlowExcelThemeConfig;
  matrixData: MatrixExportData;
  authorName?: string;
}

/**
 * Genera un archivo XLSX nativo de Microsoft Excel con estilo corporativo profesional,
 * colores de cabecera, filas de ingresos y egresos, números contables reales, congelación
 * de paneles y tabla plana de detalle para auditoría o tablas dinámicas.
 */
export async function generateStyledCashFlowExcel({
  company,
  theme,
  matrixData,
  authorName = 'Auditor Senior ERP Agéntico',
}: GenerateStyledExcelOptions): Promise<Blob> {
  const wb = new ExcelJS.Workbook();
  wb.creator = authorName;
  wb.lastModifiedBy = authorName;
  wb.created = new Date();
  wb.modified = new Date();

  const numFmt = getExcelNumberFormat(theme.numberFormat, theme.negativeFormat);
  const headerFont = {
    name: theme.fontFamily,
    size: theme.fontSizeHeader,
    bold: true,
    color: { argb: hexToArgb(theme.headerTextColor) },
  };
  const regularFont = {
    name: theme.fontFamily,
    size: theme.fontSizeData,
    color: { argb: 'FF1E293B' },
  };
  const boldFont = {
    name: theme.fontFamily,
    size: theme.fontSizeData,
    bold: true,
    color: { argb: 'FF0F172A' },
  };

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };

  const doubleUnderlineBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'double', color: { argb: 'FF0F172A' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };

  // ==========================================================================
  // HOJA 1: MATRIZ DE FLUJO DIARIO (30 DÍAS)
  // ==========================================================================
  const ws = wb.addWorksheet('Matriz Flujo Diario', {
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9, // A4
    },
    views: [{ showGridLines: true }],
  });

  let currentRowIdx = 1;

  // 1. Cabecera Corporativa de la Empresa
  if (theme.enableCompanyHeader) {
    ws.mergeCells(currentRowIdx, 1, currentRowIdx, matrixData.daysColumns.length + 3);
    const titleCell = ws.getCell(currentRowIdx, 1);
    titleCell.value = `${company.razonSocial.toUpperCase()} • RUT: ${company.rut} — MATRIZ DE TESORERÍA Y FLUJO DE CAJA PROYECTADO (${matrixData.daysColumns.length} DÍAS DIARIOS)`;
    titleCell.font = {
      name: theme.fontFamily,
      size: 13,
      bold: true,
      color: { argb: hexToArgb(theme.headerTextColor) },
    };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: hexToArgb(theme.headerBgColor) },
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(currentRowIdx).height = 28;
    currentRowIdx++;

    // Subtítulo con metadata
    ws.mergeCells(currentRowIdx, 1, currentRowIdx, matrixData.daysColumns.length + 3);
    const subCell = ws.getCell(currentRowIdx, 1);
    subCell.value = `Fecha Base: ${matrixData.baseDateStr} | Proyección Diaria: ${matrixData.daysColumns.length} Días Corridos | Escenario: ${matrixData.scenario} | Moneda Base: CLP | Auditor a Cargo: ${authorName} | Generado: ${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL')}`;
    subCell.font = {
      name: theme.fontFamily,
      size: 9.5,
      italic: true,
      color: { argb: 'FFCBD5E1' },
    };
    subCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: hexToArgb(theme.headerBgColor) },
    };
    subCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(currentRowIdx).height = 20;
    currentRowIdx++;

    currentRowIdx++; // Fila vacía separadora
  }

  // 2. Banner de Tarjetas KPIs Ejecutivos
  if (theme.enableKpiCards) {
    const kpiStartRow = currentRowIdx;
    ws.getRow(kpiStartRow).height = 22;
    ws.getRow(kpiStartRow + 1).height = 24;

    const totalCols = matrixData.daysColumns.length + 3;
    const kpis = [
      { label: 'SALDO INICIAL BANCOS', val: matrixData.initialBalance, colStart: 1, colEnd: 2 },
      { label: 'TOTAL COBRANZAS (+)', val: matrixData.grandTotalIngresos, colStart: 3, colEnd: 5 },
      { label: 'TOTAL PAGOS (-)', val: -matrixData.grandTotalEgresos, colStart: 6, colEnd: 8 },
      { label: 'SALDO FINAL PROYECTADO', val: matrixData.finalSaldo, colStart: 9, colEnd: 11 },
      {
        label: 'FLUJO NETO PERÍODO',
        val: matrixData.grandNetFlow,
        colStart: 12,
        colEnd: Math.max(13, Math.min(totalCols, 15)),
      },
    ];

    kpis.forEach((kpi) => {
      ws.mergeCells(kpiStartRow, kpi.colStart, kpiStartRow, kpi.colEnd);
      ws.mergeCells(kpiStartRow + 1, kpi.colStart, kpiStartRow + 1, kpi.colEnd);

      const labelCell = ws.getCell(kpiStartRow, kpi.colStart);
      labelCell.value = kpi.label;
      labelCell.font = {
        name: theme.fontFamily,
        size: 8.5,
        bold: true,
        color: { argb: hexToArgb(theme.kpiBannerTextColor) },
      };
      labelCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: hexToArgb(theme.kpiBannerBgColor) },
      };
      labelCell.alignment = { horizontal: 'center', vertical: 'middle' };

      const valCell = ws.getCell(kpiStartRow + 1, kpi.colStart);
      valCell.value = kpi.val;
      valCell.numFmt = numFmt;
      valCell.font = {
        name: theme.fontFamily,
        size: 11,
        bold: true,
        color: { argb: kpi.val < 0 ? 'FFE11D48' : 'FFFFFFFF' },
      };
      valCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: hexToArgb(theme.kpiBannerBgColor) },
      };
      valCell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    currentRowIdx += 3;
  }

  const tableHeaderRowStart = currentRowIdx;

  // 3. Encabezados de Columnas de la Matriz (Día 1..30)
  const headerRow1 = ws.getRow(currentRowIdx);
  const headerRow2 = ws.getRow(currentRowIdx + 1);

  headerRow1.height = 22;
  headerRow2.height = 18;

  headerRow1.getCell(1).value = 'CONCEPTO FINANCIERO';
  headerRow1.getCell(2).value = 'CUENTA CONTABLE';
  headerRow2.getCell(1).value = 'Rubro / Clasificación';
  headerRow2.getCell(2).value = 'Código IFRS';

  matrixData.daysColumns.forEach((c, idx) => {
    const colNumber = idx + 3;
    headerRow1.getCell(colNumber).value = `DÍA ${c.index}`;
    headerRow2.getCell(colNumber).value = c.dayDisplay;
  });

  const totalColNumber = matrixData.daysColumns.length + 3;
  headerRow1.getCell(totalColNumber).value = 'TOTAL PERÍODO';
  headerRow2.getCell(totalColNumber).value = 'Consolidado';

  // Aplicar estilos a la cabecera
  for (let c = 1; c <= totalColNumber; c++) {
    const cell1 = headerRow1.getCell(c);
    const cell2 = headerRow2.getCell(c);

    [cell1, cell2].forEach((cell) => {
      cell.font = headerFont;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: hexToArgb(theme.headerBgColor) },
      };
      cell.border = thinBorder;
      cell.alignment = {
        horizontal: c <= 2 ? 'left' : 'center',
        vertical: 'middle',
      };
    });
  }

  currentRowIdx += 2;

  // 4. Bloque Superior de Resumen y Saldos Diarios
  // Fila: TOTAL EGRESOS (en negativo)
  const rowEgresos = ws.getRow(currentRowIdx);
  rowEgresos.height = 20;
  rowEgresos.getCell(1).value = '(-) TOTAL EGRESOS';
  rowEgresos.getCell(2).value = 'PAGOS DIARIOS';
  matrixData.daysColumns.forEach((c, idx) => {
    const colNumber = idx + 3;
    const val = -matrixData.dailyTotals[c.dateStr].totalEgresos;
    rowEgresos.getCell(colNumber).value = val;
    rowEgresos.getCell(colNumber).numFmt = numFmt;
  });
  rowEgresos.getCell(totalColNumber).value = -matrixData.grandTotalEgresos;
  rowEgresos.getCell(totalColNumber).numFmt = numFmt;

  for (let c = 1; c <= totalColNumber; c++) {
    const cell = rowEgresos.getCell(c);
    cell.font = { ...boldFont, color: { argb: hexToArgb(theme.egresosTextColor) } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: hexToArgb(theme.egresosRowBgColor) },
    };
    cell.border = thinBorder;
    if (c > 2) cell.alignment = { horizontal: 'right', vertical: 'middle' };
  }
  currentRowIdx++;

  // Fila: TOTAL INGRESOS
  const rowIngresos = ws.getRow(currentRowIdx);
  rowIngresos.height = 20;
  rowIngresos.getCell(1).value = '(+) TOTAL INGRESOS';
  rowIngresos.getCell(2).value = 'COBROS DIARIOS';
  matrixData.daysColumns.forEach((c, idx) => {
    const colNumber = idx + 3;
    const val = matrixData.dailyTotals[c.dateStr].totalIngresos;
    rowIngresos.getCell(colNumber).value = val;
    rowIngresos.getCell(colNumber).numFmt = numFmt;
  });
  rowIngresos.getCell(totalColNumber).value = matrixData.grandTotalIngresos;
  rowIngresos.getCell(totalColNumber).numFmt = numFmt;

  for (let c = 1; c <= totalColNumber; c++) {
    const cell = rowIngresos.getCell(c);
    cell.font = { ...boldFont, color: { argb: hexToArgb(theme.ingresosTextColor) } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: hexToArgb(theme.ingresosRowBgColor) },
    };
    cell.border = thinBorder;
    if (c > 2) cell.alignment = { horizontal: 'right', vertical: 'middle' };
  }
  currentRowIdx++;

  // Fila: SALDO DIARIO NETO
  const rowSaldoDiario = ws.getRow(currentRowIdx);
  rowSaldoDiario.height = 20;
  rowSaldoDiario.getCell(1).value = '(=) SALDO NETO DIARIO';
  rowSaldoDiario.getCell(2).value = 'Flujo del Día';
  matrixData.daysColumns.forEach((c, idx) => {
    const colNumber = idx + 3;
    const val = matrixData.dailyTotals[c.dateStr].saldoDiario;
    rowSaldoDiario.getCell(colNumber).value = val;
    rowSaldoDiario.getCell(colNumber).numFmt = numFmt;
  });
  rowSaldoDiario.getCell(totalColNumber).value = matrixData.grandNetFlow;
  rowSaldoDiario.getCell(totalColNumber).numFmt = numFmt;

  for (let c = 1; c <= totalColNumber; c++) {
    const cell = rowSaldoDiario.getCell(c);
    cell.font = boldFont;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: hexToArgb(theme.summaryRowBgColor) },
    };
    cell.border = thinBorder;
    if (c > 2) cell.alignment = { horizontal: 'right', vertical: 'middle' };
  }
  currentRowIdx++;

  // Fila: SALDO ACUMULADO ARRASTRADO
  const rowSaldoAcum = ws.getRow(currentRowIdx);
  rowSaldoAcum.height = 24;
  rowSaldoAcum.getCell(1).value = 'SALDO ACUMULADO ARRASTRADO';
  rowSaldoAcum.getCell(2).value = 'Posición Final';
  matrixData.daysColumns.forEach((c, idx) => {
    const colNumber = idx + 3;
    const val = matrixData.dailyTotals[c.dateStr].saldoArrastrado;
    rowSaldoAcum.getCell(colNumber).value = val;
    rowSaldoAcum.getCell(colNumber).numFmt = numFmt;
  });
  rowSaldoAcum.getCell(totalColNumber).value = matrixData.finalSaldo;
  rowSaldoAcum.getCell(totalColNumber).numFmt = numFmt;

  for (let c = 1; c <= totalColNumber; c++) {
    const cell = rowSaldoAcum.getCell(c);
    cell.font = {
      name: theme.fontFamily,
      size: theme.fontSizeHeader,
      bold: true,
      color: { argb: hexToArgb(theme.saldosAcumRowTextColor) },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: hexToArgb(theme.saldosAcumRowBgColor) },
    };
    cell.border = theme.enableDoubleUnderlineTotals ? doubleUnderlineBorder : thinBorder;
    if (c > 2) cell.alignment = { horizontal: 'right', vertical: 'middle' };
  }
  currentRowIdx++;

  // Espacio
  currentRowIdx++;

  // 5. Sección Detallada: INGRESOS OPERACIONALES
  ws.mergeCells(currentRowIdx, 1, currentRowIdx, totalColNumber);
  const secIngCell = ws.getCell(currentRowIdx, 1);
  secIngCell.value = '1. DETALLE DE INGRESOS Y COBRANZAS OPERACIONALES';
  secIngCell.font = {
    name: theme.fontFamily,
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  secIngCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: hexToArgb(theme.ingresosSectionColor) },
  };
  secIngCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(currentRowIdx).height = 22;
  currentRowIdx++;

  const ingresoRows = matrixData.conceptRows.filter((r) => r.grupo === 'INGRESO');
  ingresoRows.forEach((r, idx) => {
    const row = ws.getRow(currentRowIdx);
    row.height = 19;
    row.getCell(1).value = r.nombre;
    row.getCell(2).value = r.cuentaContableRef || '';

    matrixData.daysColumns.forEach((c, cIdx) => {
      const colNum = cIdx + 3;
      const cellVal = matrixData.cellMap[r.id]?.[c.dateStr]?.total || 0;
      row.getCell(colNum).value = cellVal;
      row.getCell(colNum).numFmt = numFmt;
    });

    row.getCell(totalColNumber).value = matrixData.rowTotals[r.id]?.total || 0;
    row.getCell(totalColNumber).numFmt = numFmt;

    const isZebra = theme.enableZebraStripes && idx % 2 === 1;
    for (let c = 1; c <= totalColNumber; c++) {
      const cell = row.getCell(c);
      cell.font = regularFont;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isZebra ? hexToArgb(theme.zebraBgColor) : 'FFFFFFFF' },
      };
      cell.border = thinBorder;
      if (c > 2) cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
    currentRowIdx++;
  });

  // Espacio
  currentRowIdx++;

  // 6. Sección Detallada: EGRESOS OPERACIONALES
  ws.mergeCells(currentRowIdx, 1, currentRowIdx, totalColNumber);
  const secEgrCell = ws.getCell(currentRowIdx, 1);
  secEgrCell.value = '2. DETALLE DE EGRESOS, PROVEEDORES Y OBLIGACIONES';
  secEgrCell.font = {
    name: theme.fontFamily,
    size: 11,
    bold: true,
    color: { argb: 'FFFFFFFF' },
  };
  secEgrCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: hexToArgb(theme.egresosSectionColor) },
  };
  secEgrCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(currentRowIdx).height = 22;
  currentRowIdx++;

  const egresoRows = matrixData.conceptRows.filter((r) => r.grupo === 'EGRESO');
  egresoRows.forEach((r, idx) => {
    const row = ws.getRow(currentRowIdx);
    row.height = 19;
    row.getCell(1).value = r.nombre;
    row.getCell(2).value = r.cuentaContableRef || '';

    matrixData.daysColumns.forEach((c, cIdx) => {
      const colNum = cIdx + 3;
      const cellVal = matrixData.cellMap[r.id]?.[c.dateStr]?.total || 0;
      row.getCell(colNum).value = cellVal > 0 ? -cellVal : 0;
      row.getCell(colNum).numFmt = numFmt;
    });

    const tot = matrixData.rowTotals[r.id]?.total || 0;
    row.getCell(totalColNumber).value = tot > 0 ? -tot : 0;
    row.getCell(totalColNumber).numFmt = numFmt;

    const isZebra = theme.enableZebraStripes && idx % 2 === 1;
    for (let c = 1; c <= totalColNumber; c++) {
      const cell = row.getCell(c);
      cell.font = regularFont;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isZebra ? hexToArgb(theme.zebraBgColor) : 'FFFFFFFF' },
      };
      cell.border = thinBorder;
      if (c > 2) cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
    currentRowIdx++;
  });

  // Ajustar anchos de columnas
  ws.getColumn(1).width = 40; // Concepto
  ws.getColumn(2).width = 16; // Cuenta
  matrixData.daysColumns.forEach((_, idx) => {
    ws.getColumn(idx + 3).width = 15;
  });
  ws.getColumn(totalColNumber).width = 20;

  // Inmovilizar paneles (Freeze panes)
  if (theme.enableFreezePanes) {
    ws.views = [
      {
        state: 'frozen',
        xSplit: 2, // Fija columnas Concepto y Cuenta
        ySplit: tableHeaderRowStart + 1, // Fija las cabeceras de días
      },
    ];
  }

  // ==========================================================================
  // HOJA 2: TABLA PLANA DE PARTIDAS (PARA AUDITORÍA Y TABLAS DINÁMICAS)
  // ==========================================================================
  if (theme.includeFlatMovementsSheet && Array.isArray(matrixData.rawMovements)) {
    const wsFlat = wb.addWorksheet('Detalle de Partidas', {
      views: [{ showGridLines: true }],
    });

    // Encabezado de la tabla plana
    const flatHeaders = [
      'ID Partida',
      'Fecha Estimada',
      'Fecha Real',
      'Tipo Flujo',
      'Categoría',
      'Concepto / Glosa',
      'Contraparte (Cliente/Prov)',
      'RUT Contraparte',
      'Monto Divisa Original',
      'Moneda',
      'Tasa de Cambio',
      'Monto CLP Equivalente',
      'Estado Cobro/Pago',
      'Folio DTE Asociado',
      'Documento Referencia',
      'Probabilidad (%)',
      'Reprogramado',
      'Fecha Original',
      'Motivo Reprogramación',
    ];

    const fHeaderRow = wsFlat.getRow(1);
    fHeaderRow.height = 24;
    flatHeaders.forEach((h, idx) => {
      const cell = fHeaderRow.getCell(idx + 1);
      cell.value = h;
      cell.font = headerFont;
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: hexToArgb(theme.headerBgColor) },
      };
      cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    matrixData.rawMovements.forEach((m, rowIdx) => {
      const row = wsFlat.getRow(rowIdx + 2);
      row.height = 18;
      row.getCell(1).value = m.id;
      row.getCell(2).value = m.fechaEstimada;
      row.getCell(3).value = m.fechaReal || '-';
      row.getCell(4).value = m.tipo;
      row.getCell(5).value = m.categoria;
      row.getCell(6).value = m.concepto;
      row.getCell(7).value = m.contraparte;
      row.getCell(8).value = m.rutContraparte || '-';
      row.getCell(9).value = m.montoTotal;
      row.getCell(9).numFmt = numFmt;
      row.getCell(10).value = m.moneda || 'CLP';
      row.getCell(11).value = m.tipoCambio || 1;
      row.getCell(12).value = m.montoCLPEquivalente || m.montoTotal;
      row.getCell(12).numFmt = numFmt;
      row.getCell(13).value = m.estado;
      row.getCell(14).value = m.dteFolioAsociado || '-';
      row.getCell(15).value = m.documentoReferencia || '-';
      row.getCell(16).value = (m.probabilidadCobroPct || 100) / 100;
      row.getCell(16).numFmt = '0.0%';
      row.getCell(17).value = m.reprogramado ? 'SÍ' : 'NO';
      row.getCell(18).value = m.fechaOriginal || '-';
      row.getCell(19).value = m.motivoReprogramacion || '-';

      const isZebra = theme.enableZebraStripes && rowIdx % 2 === 1;
      for (let c = 1; c <= flatHeaders.length; c++) {
        const cell = row.getCell(c);
        cell.font = regularFont;
        cell.border = thinBorder;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isZebra ? hexToArgb(theme.zebraBgColor) : 'FFFFFFFF' },
        };
      }
    });

    // Autoajustar anchos
    const colWidths = [16, 14, 14, 12, 22, 35, 28, 14, 18, 10, 14, 20, 14, 16, 20, 14, 14, 14, 28];
    colWidths.forEach((w, idx) => {
      wsFlat.getColumn(idx + 1).width = w;
    });

    // Congelar encabezados
    wsFlat.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  }

  // Generar Buffer Binario
  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/**
 * Función que dispara la descarga directa del archivo XLSX en el navegador.
 */
export function downloadBlobAsFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
