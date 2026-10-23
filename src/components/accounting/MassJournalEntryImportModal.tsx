import React, { useState, useMemo } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Layers,
  ArrowRight,
  Database,
  Search,
  Check,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Eye,
  Plus
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  AccountingEntry,
  AccountingEntryLine,
  CompanyProfile,
  HierarchicalAccountItem,
} from '../../types';
import { formatCLP } from '../../utils/chileanAccounting';

interface MassJournalEntryImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: CompanyProfile;
  chartOfAccounts: HierarchicalAccountItem[];
  onCommitEntries: (entries: AccountingEntry[]) => Promise<any> | void;
  onAutoAddAccounts?: (accounts: HierarchicalAccountItem[]) => void;
}

interface ParsedEntryCandidate {
  tempId: string;
  numeroAsiento: string;
  fecha: string;
  tipo: string;
  concepto: string;
  documentoRef?: string;
  lineas: AccountingEntryLine[];
  totalDebe: number;
  totalHaber: number;
  diferencia: number;
  balanceado: boolean;
  hasUnknownAccounts: boolean;
  unknownAccountCodes: string[];
}

export const MassJournalEntryImportModal: React.FC<MassJournalEntryImportModalProps> = ({
  isOpen,
  onClose,
  company,
  chartOfAccounts = [],
  onCommitEntries,
  onAutoAddAccounts,
}) => {
  const [activeTab, setActiveTab] = useState<'PASTE' | 'FILE' | 'TEMPLATE'>('PASTE');
  const [pastedText, setPastedText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'UNBALANCED' | 'NEW_ACCOUNTS'>('ALL');
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // Options
  const [autoCreateAccounts, setAutoCreateAccounts] = useState(true);
  const [normalizeDates, setNormalizeDates] = useState(true);

  // Execution state
  const [isProcessing, setIsProcessing] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; count: number } | null>(null);

  if (!isOpen) return null;

  // Chart code lookup
  const accountMap = useMemo(() => {
    const map = new Map<string, HierarchicalAccountItem>();
    chartOfAccounts.forEach((acc) => {
      const clean = acc.codigo.trim().replace(/\s+/g, '');
      map.set(clean, acc);
      // Also map without dots (e.g. "1101001")
      const withoutDots = clean.replace(/\./g, '');
      if (withoutDots !== clean) {
        map.set(withoutDots, acc);
      }
    });
    return map;
  }, [chartOfAccounts]);

  // Clean numbers
  const parseAmount = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const str = String(val).trim();
    if (!str) return 0;
    // Remove currency symbols, spaces, quotes
    let clean = str.replace(/[$"'\s]/g, '');
    // Check if Chilean format with dots as thousands and comma as decimal
    if (clean.includes('.') && clean.includes(',')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes('.') && !clean.includes(',')) {
      // Could be thousands or decimals. If 3 digits after dot, it's typically thousands in CLP
      const parts = clean.split('.');
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
        clean = clean.replace(/\./g, '');
      }
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    }
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : Math.round(num);
  };

  // Clean date
  const parseDate = (val: any): string => {
    if (!val) return new Date().toISOString().split('T')[0];
    if (typeof val === 'number') {
      // Excel serial date number
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
    const str = String(val).trim().split(' ')[0]; // remove time if any
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        // DD/MM/YYYY or YYYY/MM/DD
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    if (str.includes('-')) {
      const parts = str.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return new Date().toISOString().split('T')[0];
  };

  // Parse Raw Tabular Data into Candidates
  const parseRawRows = (rows: any[][]): ParsedEntryCandidate[] => {
    if (!rows || rows.length < 2) return [];

    // Header detection
    const headers = rows[0].map((h) => String(h || '').trim().toLowerCase());
    
    // Column indices
    let colAsiento = -1;
    let colFecha = -1;
    let colTipo = -1;
    let colGlosa = -1;
    let colCuenta = -1;
    let colCuentaNom = -1;
    let colDebe = -1;
    let colHaber = -1;
    let colGlosaLin = -1;
    let colRut = -1;
    let colAuxiliar = -1;
    let colTipoDoc = -1;
    let colFolioDoc = -1;
    let colCc = -1;

    headers.forEach((h, idx) => {
      if (/^(numero|nro|asiento|comprobante|folio|num_asiento|id_asiento)/i.test(h)) colAsiento = idx;
      else if (/^(fecha|date|fec)/i.test(h)) colFecha = idx;
      else if (/^(tipo|tipo_asiento|origen|tipo_comp)/i.test(h)) colTipo = idx;
      else if (/^(glosa|concepto|descripcion|glosa_asiento|detalle_general)/i.test(h)) colGlosa = idx;
      else if (/^(cuenta|codigo|cod_cuenta|cuenta_codigo|codigo_cuenta|cuenta_contable)/i.test(h)) colCuenta = idx;
      else if (/^(nombre_cuenta|cuenta_nombre|nombre|descripcion_cuenta)/i.test(h)) colCuentaNom = idx;
      else if (/^(debe|cargo|cargos|debito|debitos|debit)/i.test(h)) colDebe = idx;
      else if (/^(haber|abono|abonos|credito|creditos|credit)/i.test(h)) colHaber = idx;
      else if (/^(glosa_linea|detalle_linea|glosa_detalle|item_glosa)/i.test(h)) colGlosaLin = idx;
      else if (/^(rut|rut_auxiliar|rut_cliente|rut_proveedor)/i.test(h)) colRut = idx;
      else if (/^(auxiliar|nombre_auxiliar|razon_social|cliente_proveedor)/i.test(h)) colAuxiliar = idx;
      else if (/^(doc|tipo_doc|tipo_documento|tipo_doc_ref)/i.test(h)) colTipoDoc = idx;
      else if (/^(folio_doc|nro_doc|numero_doc|folio_ref)/i.test(h)) colFolioDoc = idx;
      else if (/^(cc|centro_costo|centro_de_costo|c_costo)/i.test(h)) colCc = idx;
    });

    // Fallback if headers were not named standardly: guess by position
    if (colCuenta === -1) colCuenta = 4;
    if (colDebe === -1) colDebe = 6;
    if (colHaber === -1) colHaber = 7;
    if (colFecha === -1) colFecha = 1;
    if (colGlosa === -1) colGlosa = 3;

    // Grouping container
    const entryGroups = new Map<string, {
      numeroAsiento: string;
      fecha: string;
      tipo: string;
      concepto: string;
      documentoRef?: string;
      lines: AccountingEntryLine[];
    }>();

    let currentAutoAsientoNum = 1;
    let lastSeenAsiento = '';

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === '')) {
        continue;
      }

      // Check Asiento identifier
      let rawAsientoId = colAsiento !== -1 && row[colAsiento] ? String(row[colAsiento]).trim() : '';
      const rawFecha = colFecha !== -1 && row[colFecha] ? parseDate(row[colFecha]) : new Date().toISOString().split('T')[0];
      const rawTipo = colTipo !== -1 && row[colTipo] ? String(row[colTipo]).trim().toUpperCase() : 'TRASPASO';
      const rawGlosa = colGlosa !== -1 && row[colGlosa] ? String(row[colGlosa]).trim() : 'Migración Asiento Contable';

      if (!rawAsientoId) {
        // If no explicit asiento number, group by fecha + glosa, or consecutive lines
        rawAsientoId = lastSeenAsiento ? `${lastSeenAsiento}` : `MIG-${currentAutoAsientoNum}`;
      } else {
        lastSeenAsiento = rawAsientoId;
      }

      // Read line values
      const rawCodCuenta = colCuenta !== -1 && row[colCuenta] ? String(row[colCuenta]).trim() : '5.1.99';
      const cleanCod = rawCodCuenta.replace(/\s+/g, '');
      const rawNomCuenta = colCuentaNom !== -1 && row[colCuentaNom] ? String(row[colCuentaNom]).trim() : '';
      const debe = colDebe !== -1 ? parseAmount(row[colDebe]) : 0;
      const haber = colHaber !== -1 ? parseAmount(row[colHaber]) : 0;
      const glosaLinea = colGlosaLin !== -1 && row[colGlosaLin] ? String(row[colGlosaLin]).trim() : undefined;
      const rutAux = colRut !== -1 && row[colRut] ? String(row[colRut]).trim() : undefined;
      const nomAux = colAuxiliar !== -1 && row[colAuxiliar] ? String(row[colAuxiliar]).trim() : undefined;
      const tipoDoc = colTipoDoc !== -1 && row[colTipoDoc] ? String(row[colTipoDoc]).trim() : undefined;
      const folioDoc = colFolioDoc !== -1 && row[colFolioDoc] ? String(row[colFolioDoc]).trim() : undefined;
      const centroCosto = colCc !== -1 && row[colCc] ? String(row[colCc]).trim() : undefined;

      // Lookup chart account
      const foundAccount = accountMap.get(cleanCod) || accountMap.get(cleanCod.replace(/\./g, ''));
      const finalNombre = rawNomCuenta || foundAccount?.nombre || `Cuenta ${cleanCod}`;

      const lineItem: AccountingEntryLine = {
        cuentaCodigo: cleanCod,
        cuentaNombre: finalNombre,
        debe,
        haber,
        glosa: glosaLinea,
        rutAuxiliar: rutAux,
        nombreAuxiliar: nomAux,
        tipoDocumentoRef: tipoDoc,
        folioDocumentoRef: folioDoc,
        centroCosto,
        montoDocumentoRef: (debe || haber) || undefined,
      };

      if (!entryGroups.has(rawAsientoId)) {
        entryGroups.set(rawAsientoId, {
          numeroAsiento: rawAsientoId,
          fecha: rawFecha,
          tipo: rawTipo,
          concepto: rawGlosa,
          documentoRef: folioDoc ? `${tipoDoc || 'DOC'} ${folioDoc}` : undefined,
          lines: [lineItem],
        });
      } else {
        entryGroups.get(rawAsientoId)!.lines.push(lineItem);
      }
    }

    // Convert map to candidate entries
    const candidates: ParsedEntryCandidate[] = [];

    entryGroups.forEach((grp, key) => {
      const totalDebe = grp.lines.reduce((s, l) => s + l.debe, 0);
      const totalHaber = grp.lines.reduce((s, l) => s + l.haber, 0);
      const diff = totalDebe - totalHaber;
      const balanceado = Math.abs(diff) === 0;

      const unknownAccountCodes: string[] = [];
      grp.lines.forEach((l) => {
        const clean = l.cuentaCodigo.replace(/\s+/g, '');
        if (!accountMap.has(clean) && !accountMap.has(clean.replace(/\./g, ''))) {
          if (!unknownAccountCodes.includes(l.cuentaCodigo)) {
            unknownAccountCodes.push(l.cuentaCodigo);
          }
        }
      });

      candidates.push({
        tempId: `cand-${key}-${Date.now()}`,
        numeroAsiento: grp.numeroAsiento,
        fecha: grp.fecha,
        tipo: grp.tipo,
        concepto: grp.concepto,
        documentoRef: grp.documentoRef,
        lineas: grp.lines,
        totalDebe,
        totalHaber,
        diferencia: diff,
        balanceado,
        hasUnknownAccounts: unknownAccountCodes.length > 0,
        unknownAccountCodes,
      });
    });

    return candidates;
  };

  // Handle Pasted Text Parsing
  const parsedCandidatesFromPaste = useMemo(() => {
    if (!pastedText.trim()) return [];
    const rawLines = pastedText.trim().split('\n');
    const table: any[][] = rawLines.map((l) => {
      const delimiter = l.includes('\t') ? '\t' : l.includes(';') ? ';' : ',';
      return l.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
    });
    return parseRawRows(table);
  }, [pastedText, accountMap]);

  // Handle File Upload Parsing
  const [fileCandidates, setFileCandidates] = useState<ParsedEntryCandidate[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();

    if (file.name.endsWith('.json')) {
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          if (Array.isArray(json)) {
            // Either array of entries or array of rows
            if (json[0]?.lineas && Array.isArray(json[0].lineas)) {
              // Direct AccountingEntry[]
              const converted: ParsedEntryCandidate[] = json.map((en, idx) => {
                const totalDebe = en.lineas.reduce((s: number, l: any) => s + (l.debe || 0), 0);
                const totalHaber = en.lineas.reduce((s: number, l: any) => s + (l.haber || 0), 0);
                return {
                  tempId: en.id || `json-${idx}`,
                  numeroAsiento: String(idx + 1),
                  fecha: en.fecha || new Date().toISOString().split('T')[0],
                  tipo: en.tipo || 'TRASPASO',
                  concepto: en.concepto || 'Asiento Migrado JSON',
                  lineas: en.lineas,
                  totalDebe,
                  totalHaber,
                  diferencia: totalDebe - totalHaber,
                  balanceado: totalDebe === totalHaber,
                  hasUnknownAccounts: false,
                  unknownAccountCodes: [],
                };
              });
              setFileCandidates(converted);
            } else {
              // Matrix rows
              const rows = json.map((item) => Object.values(item));
              setFileCandidates(parseRawRows([Object.keys(json[0]), ...rows]));
            }
          }
        } catch (err: any) {
          alert('Error al leer archivo JSON: ' + err.message);
        }
      };
      reader.readAsText(file);
    } else {
      // Excel or CSV via XLSX
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rawMatrix = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          const parsed = parseRawRows(rawMatrix);
          setFileCandidates(parsed);
        } catch (err: any) {
          alert('Error al procesar archivo Excel/CSV: ' + err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  // Active candidates depending on active tab
  const activeCandidates = activeTab === 'FILE' ? fileCandidates : parsedCandidatesFromPaste;

  // Filtered view
  const displayedCandidates = useMemo(() => {
    if (filterMode === 'UNBALANCED') {
      return activeCandidates.filter((c) => !c.balanceado);
    }
    if (filterMode === 'NEW_ACCOUNTS') {
      return activeCandidates.filter((c) => c.hasUnknownAccounts);
    }
    return activeCandidates;
  }, [activeCandidates, filterMode]);

  // Global summary statistics
  const stats = useMemo(() => {
    const totalEntries = activeCandidates.length;
    const totalLines = activeCandidates.reduce((s, c) => s + c.lineas.length, 0);
    const sumDebe = activeCandidates.reduce((s, c) => s + c.totalDebe, 0);
    const sumHaber = activeCandidates.reduce((s, c) => s + c.totalHaber, 0);
    const unbalancedCount = activeCandidates.filter((c) => !c.balanceado).length;
    const unknownAccountsSet = new Set<string>();
    activeCandidates.forEach((c) => {
      c.unknownAccountCodes.forEach((cod) => unknownAccountsSet.add(cod));
    });

    return {
      totalEntries,
      totalLines,
      sumDebe,
      sumHaber,
      unbalancedCount,
      unknownAccountsCount: unknownAccountsSet.size,
      unknownAccountsList: Array.from(unknownAccountsSet),
      isGlobalBalanced: sumDebe === sumHaber && unbalancedCount === 0,
    };
  }, [activeCandidates]);

  // Load sample demo data
  const handleLoadSampleData = () => {
    const sample = `NumeroAsiento\tFecha\tTipo\tGlosa\tCuentaCodigo\tCuentaNombre\tDebe\tHaber\tGlosaLinea\tRutAuxiliar\tNombreAuxiliar\tTipoDoc\tFolioDoc\tCentroCosto
1\t2026-01-01\tAPERTURA\tAsiento de Apertura Ejercicio 2026\t1.1.01.001\tCaja Central\t15000000\t0\tSaldo inicial caja\t\t\t\t\tADMIN
1\t2026-01-01\tAPERTURA\tAsiento de Apertura Ejercicio 2026\t1.1.02.001\tBanco Santander M/N\t45000000\t0\tSaldo inicial cuenta corriente\t\t\t\t\tFINANZAS
1\t2026-01-01\tAPERTURA\tAsiento de Apertura Ejercicio 2026\t1.1.04.001\tExistencias / Mercaderías\t28000000\t0\tInventario inicial valorizado PMP\t\t\t\t\tOPERACIONES
1\t2026-01-01\tAPERTURA\tAsiento de Apertura Ejercicio 2026\t2.1.01.001\tProveedores Nacionales\t0\t18000000\tFacturas por pagar año anterior\t76.123.456-7\tDistribuidora del Pacífico SpA\tFactura\t4820\tOPERACIONES
1\t2026-01-01\tAPERTURA\tAsiento de Apertura Ejercicio 2026\t3.1.01.001\tCapital Pagado\t0\t70000000\tAporte inicial socios\t\t\t\t\tADMIN
2\t2026-01-15\tTRASPASO\tDevengo Factura de Compra Insumos Planta\t5.1.01.001\tCosto Insumos y Repuestos\t5000000\t0\tFiltros y válvulas hidráulicas\t96.554.210-K\tParker Hannifin Chile S.A.\tFactura\t8920\tPLANTA
2\t2026-01-15\tTRASPASO\tDevengo Factura de Compra Insumos Planta\t1.1.08.001\tIVA Crédito Fiscal\t950000\t0\tIVA DTE 33 Folio 8920\t96.554.210-K\tParker Hannifin Chile S.A.\tFactura\t8920\tPLANTA
2\t2026-01-15\tTRASPASO\tDevengo Factura de Compra Insumos Planta\t2.1.01.001\tProveedores Nacionales\t0\t5950000\tTotal Factura crédito 30 días\t96.554.210-K\tParker Hannifin Chile S.A.\tFactura\t8920\tPLANTA
3\t2026-01-20\tEGRESO\tPago Factura 8920 Parker Transferencia\t2.1.01.001\tProveedores Nacionales\t5950000\t0\tPago transferencia bancaria TEF\t96.554.210-K\tParker Hannifin Chile S.A.\tComprobante\t10294\tFINANZAS
3\t2026-01-20\tEGRESO\tPago Factura 8920 Parker Transferencia\t1.1.02.001\tBanco Santander M/N\t0\t5950000\tCargo en cuenta corriente\t\t\tTransferencia\t10294\tFINANZAS`;
    setPastedText(sample);
    setActiveTab('PASTE');
  };

  // Download migration template
  const handleDownloadTemplate = (format: 'XLSX' | 'CSV') => {
    const templateHeaders = [
      'NumeroAsiento',
      'Fecha',
      'Tipo',
      'Glosa',
      'CuentaCodigo',
      'CuentaNombre',
      'Debe',
      'Haber',
      'GlosaLinea',
      'RutAuxiliar',
      'NombreAuxiliar',
      'TipoDoc',
      'FolioDoc',
      'CentroCosto',
    ];

    const sampleRows = [
      ['1', '2026-01-01', 'APERTURA', 'Asiento Apertura Ejercicio 2026', '1.1.01.001', 'Caja Central', 10000000, 0, 'Saldo inicial', '', '', '', '', 'ADMIN'],
      ['1', '2026-01-01', 'APERTURA', 'Asiento Apertura Ejercicio 2026', '3.1.01.001', 'Capital Pagado', 0, 10000000, 'Capital suscrito', '', '', '', '', 'ADMIN'],
      ['2', '2026-01-10', 'TRASPASO', 'Factura Compra Insumos', '5.1.01.001', 'Costo Mercaderías', 2000000, 0, 'Insumos lote 01', '76.123.456-7', 'Proveedor Uno SpA', 'Factura', '1240', 'OPERACIONES'],
      ['2', '2026-01-10', 'TRASPASO', 'Factura Compra Insumos', '1.1.08.001', 'IVA Crédito Fiscal', 380000, 0, 'IVA DTE 33', '76.123.456-7', 'Proveedor Uno SpA', 'Factura', '1240', 'OPERACIONES'],
      ['2', '2026-01-10', 'TRASPASO', 'Factura Compra Insumos', '2.1.01.001', 'Proveedores Nacionales', 0, 2380000, 'Total por pagar', '76.123.456-7', 'Proveedor Uno SpA', 'Factura', '1240', 'OPERACIONES'],
    ];

    if (format === 'CSV') {
      const csvContent = '\uFEFF' + [templateHeaders, ...sampleRows].map((r) => r.join(';')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Plantilla_Migracion_Asientos_${company.rut.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([templateHeaders, ...sampleRows]);
      XLSX.utils.book_append_sheet(wb, ws, 'Plantilla_Asientos');

      // Instructions sheet
      const wsInstrucciones = XLSX.utils.aoa_to_sheet([
        ['INSTRUCCIONES PARA LA MIGRACIÓN MASIVA DE ASIENTOS CONTABLES'],
        [''],
        ['1. NumeroAsiento: Identificador único del comprobante. Todas las líneas con el mismo número pertenecen al mismo asiento.'],
        ['2. Fecha: Formato YYYY-MM-DD o DD/MM/YYYY.'],
        ['3. Tipo: APERTURA, INGRESO, EGRESO, TRASPASO o AJUSTE.'],
        ['4. Glosa: Concepto general del asiento contable.'],
        ['5. CuentaCodigo: Código de la cuenta contable (ej: 1.1.01.001 o 1101001).'],
        ['6. Debe y Haber: Montos en pesos chilenos ($ CLP). En cada asiento, la suma de Debe debe ser idéntica a la suma de Haber.'],
        ['7. RutAuxiliar: RUT con guión y dígito verificador del cliente o proveedor (ej: 76.123.456-7).'],
        ['8. CentroCosto: Código o nombre del Centro de Costo (ej: ADMIN, PLANTA, VENTAS).'],
      ]);
      XLSX.utils.book_append_sheet(wb, wsInstrucciones, 'Instrucciones');

      XLSX.writeFile(wb, `Plantilla_Migracion_Asientos_${company.rut.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
    }
  };

  // Execute Mass Import
  const handleExecuteImport = async () => {
    if (activeCandidates.length === 0) {
      alert('No hay asientos contables detectados para importar.');
      return;
    }

    if (stats.unbalancedCount > 0) {
      const proceed = window.confirm(
        `Atención: Existen ${stats.unbalancedCount} asiento(s) descuadrado(s) donde el Debe no coincide con el Haber.\n\n¿Desea omitir los asientos descuadrados e importar solo los ${activeCandidates.length - stats.unbalancedCount} asientos correctamente balanceados?`
      );
      if (!proceed) return;
    }

    setIsProcessing(true);
    setImportProgress({ current: 0, total: activeCandidates.length });

    try {
      // 1. Auto-create missing chart accounts if enabled
      if (autoCreateAccounts && stats.unknownAccountsCount > 0 && onAutoAddAccounts) {
        const newAccountsToCreate: HierarchicalAccountItem[] = stats.unknownAccountsList.map((cod) => {
          const firstDigit = parseInt(cod[0], 10) || 5;
          const claseNum = (firstDigit >= 1 && firstDigit <= 7 ? firstDigit : 5) as any;
          const tipo = claseNum === 1 ? 'ACTIVO' : claseNum === 2 ? 'PASIVO' : claseNum === 3 ? 'PATRIMONIO' : claseNum === 4 ? 'INGRESO' : 'GASTO';

          return {
            codigo: cod,
            nombre: `Cuenta Migrada ${cod}`,
            clase: claseNum,
            grupo: cod.split('.').slice(0, 2).join('.'),
            subgrupo: cod.split('.').slice(0, 3).join('.'),
            nivel: 5,
            tipo,
            clasificacion: claseNum === 1 ? 'CIRCULANTE' : claseNum === 2 ? 'CORTO_PLAZO' : 'OPERACIONAL',
            naturaleza: claseNum === 1 || claseNum >= 5 ? 'DEUDORA' : 'ACREEDORA',
            activa: true,
            manejaMultimoneda: false,
            requiereDocReferencia: true,
            esEfectivoEquivalente: false,
            esContracuentaEfectivo: false,
            requiereProyecto: false,
            empresaRut: company.rut,
          };
        });

        onAutoAddAccounts(newAccountsToCreate);
      }

      // 2. Build final AccountingEntry[]
      const validCandidates = activeCandidates.filter((c) => c.balanceado);
      const finalEntries: AccountingEntry[] = validCandidates.map((c, idx) => {
        const entryId = `mig-${Date.now()}-${idx + 1}-${c.numeroAsiento.replace(/[^a-zA-Z0-9]/g, '')}`;
        return {
          id: entryId,
          fecha: c.fecha,
          concepto: c.concepto || `Asiento Migrado Folio ${c.numeroAsiento}`,
          documento: c.documentoRef || `COMP-${c.numeroAsiento}`,
          lineas: c.lineas,
          totalDebe: c.totalDebe,
          totalHaber: c.totalHaber,
          balanceado: true,
          origen: 'MIGRACION_ERP',
          creadoEn: new Date().toISOString(),
          supervisorSignature: `MIGRATED_BY_AGENT_LEGAL_HASH_${Date.now()}`,
        };
      });

      // 3. Process with progress callback
      await Promise.resolve(onCommitEntries(finalEntries));

      setImportResult({
        success: true,
        message: `¡Migración completada con éxito! Se incorporaron ${finalEntries.length} asientos contables (${finalEntries.reduce((s, e) => s + e.lineas.length, 0)} movimientos) al Libro Diario oficial.`,
        count: finalEntries.length,
      });

      setTimeout(() => {
        setIsProcessing(false);
        onClose();
      }, 2500);
    } catch (err: any) {
      setIsProcessing(false);
      setImportResult({
        success: false,
        message: `Error al persistir asientos contables: ${err?.message || 'Error desconocido'}`,
        count: 0,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl my-6 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-[#0f172a] text-white px-6 py-4 flex items-center justify-between border-b-2 border-blue-500">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center font-bold text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Importador Masivo de Asientos Contables</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  Migración de Sistemas
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Migra históricos y comprobantes desde Softland, Defontana, Laudus, SAP, Transtecnia, Nubox o Excel con validación de Partida Doble.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top KPI & Mode Tabs */}
        <div className="px-6 pt-4 pb-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-slate-200/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('PASTE')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'PASTE' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Pegar desde Excel (Portapapeles)</span>
            </button>
            <button
              onClick={() => setActiveTab('FILE')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'FILE' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Subir Archivo (.xlsx, .csv, .json)</span>
            </button>
            <button
              onClick={() => setActiveTab('TEMPLATE')}
              className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'TEMPLATE' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar Plantillas Oficiales</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadSampleData}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Cargar datos de prueba de apertura, compras y pagos"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
              <span>Cargar Datos de Ejemplo</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* TAB 1: PASTE FROM CLIPBOARD */}
          {activeTab === 'PASTE' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>Pegue los datos copiados desde Excel, Google Sheets o texto delimitado:</span>
                </label>
                <span className="text-[11px] text-slate-500 font-mono">
                  Columnas sugeridas: NumeroAsiento, Fecha, Tipo, Glosa, CuentaCodigo, CuentaNombre, Debe, Haber, RutAuxiliar...
                </span>
              </div>
              <textarea
                rows={6}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="1&#9;2026-01-01&#9;APERTURA&#9;Asiento Apertura&#9;1.1.01.001&#9;Caja Central&#9;10000000&#9;0&#9;Saldo Inicial&#10;1&#9;2026-01-01&#9;APERTURA&#9;Asiento Apertura&#9;3.1.01.001&#9;Capital Pagado&#9;0&#9;10000000&#9;Capital Social..."
                className="w-full font-mono text-[11px] p-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all leading-relaxed"
              />
            </div>
          )}

          {/* TAB 2: UPLOAD FILE */}
          {activeTab === 'FILE' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-8 text-center bg-slate-50/60 hover:bg-blue-50/20 transition-all cursor-pointer relative">
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.json"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center justify-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    {fileName ? `Archivo seleccionado: ${fileName}` : 'Haga clic para subir archivo de migración (.xlsx, .csv o .json)'}
                  </h4>
                  <p className="text-slate-500 text-[11px] max-w-md">
                    Soporta libros diarios exportados de otros sistemas contables chilenos con cabeceras de columnas o en formato matriz.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DOWNLOAD TEMPLATES */}
          {activeTab === 'TEMPLATE' && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>Plantillas Oficiales de Migración Contable</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Descargue los formatos oficiales preconfigurados para traspasar la contabilidad de clientes que vienen de otros ERPs.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('XLSX')}
                  className="p-4 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-left transition-all group bg-white shadow-xs cursor-pointer"
                >
                  <div className="flex items-center justify-between font-bold text-slate-900 group-hover:text-emerald-800">
                    <span className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                      Descargar Plantilla Excel (.xlsx)
                    </span>
                    <Download className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Incluye pestaña de asientos de ejemplo (Apertura, Compras, Pagos) y pestaña de instrucciones paso a paso.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadTemplate('CSV')}
                  className="p-4 rounded-xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-left transition-all group bg-white shadow-xs cursor-pointer"
                >
                  <div className="flex items-center justify-between font-bold text-slate-900 group-hover:text-blue-800">
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Descargar Plantilla CSV Delimitado (;)
                    </span>
                    <Download className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Ideal para scripts de exportación automática o sistemas que generan archivos de texto plano UTF-8.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* PREVIEW & DIAGNOSTICS OF CANDIDATE ENTRIES */}
          {activeCandidates.length > 0 && (
            <div className="space-y-4 pt-2 border-t border-slate-200">
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Asientos Detectados</span>
                  <span className="text-base font-black text-slate-900 mt-0.5 block">{stats.totalEntries}</span>
                  <span className="text-[10px] text-slate-400">{stats.totalLines} líneas totales</span>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Débitos (Debe)</span>
                  <span className="text-sm font-black font-mono text-emerald-700 mt-0.5 block">{formatCLP(stats.sumDebe)}</span>
                  <span className="text-[10px] text-slate-400">Sumas al Debe</span>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Créditos (Haber)</span>
                  <span className="text-sm font-black font-mono text-blue-700 mt-0.5 block">{formatCLP(stats.sumHaber)}</span>
                  <span className="text-[10px] text-slate-400">Sumas al Haber</span>
                </div>

                <div className={`p-3 border rounded-xl shadow-xs ${
                  stats.unbalancedCount === 0 ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-rose-50/70 border-rose-200 text-rose-900'
                }`}>
                  <span className="text-[10px] font-bold uppercase block">Partida Doble</span>
                  <div className="flex items-center gap-1.5 mt-0.5 font-bold text-xs">
                    {stats.unbalancedCount === 0 ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>100% Cuadrados</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{stats.unbalancedCount} Descuadrado(s)</span>
                      </>
                    )}
                  </div>
                  <span className="text-[10px] opacity-80 block">
                    {stats.unbalancedCount === 0 ? 'Debe === Haber' : 'Revisar diferencias'}
                  </span>
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Plan de Cuentas</span>
                  <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                    {stats.unknownAccountsCount === 0 ? 'Todas en el Plan' : `${stats.unknownAccountsCount} Cuentas Nuevas`}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {autoCreateAccounts ? 'Auto-creación activa' : 'Requiere homologación'}
                  </span>
                </div>
              </div>

              {/* Filtering Pills */}
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setFilterMode('ALL')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                      filterMode === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Todos ({activeCandidates.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('UNBALANCED')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                      filterMode === 'UNBALANCED' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Descuadrados ({stats.unbalancedCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode('NEW_ACCOUNTS')}
                    className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                      filterMode === 'NEW_ACCOUNTS' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    Con Cuentas Nuevas ({stats.unknownAccountsCount})
                  </button>
                </div>

                {/* Settings check */}
                <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoCreateAccounts}
                      onChange={(e) => setAutoCreateAccounts(e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Auto-crear cuentas inexistentes en el Plan</span>
                  </label>
                </div>
              </div>

              {/* Table of Entries */}
              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-2.5">N° Asiento</th>
                      <th className="p-2.5">Fecha</th>
                      <th className="p-2.5">Tipo</th>
                      <th className="p-2.5">Concepto / Glosa</th>
                      <th className="p-2.5 text-center">Líneas</th>
                      <th className="p-2.5 text-right">Total Debe</th>
                      <th className="p-2.5 text-right">Total Haber</th>
                      <th className="p-2.5 text-center">Cuadratura</th>
                      <th className="p-2.5 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {displayedCandidates.map((cand) => {
                      const isExpanded = expandedEntryId === cand.tempId;
                      return (
                        <React.Fragment key={cand.tempId}>
                          <tr className={`hover:bg-slate-50 transition-colors ${!cand.balanceado ? 'bg-rose-50/40' : ''}`}>
                            <td className="p-2.5 font-bold text-slate-900">{cand.numeroAsiento}</td>
                            <td className="p-2.5 text-slate-600">{cand.fecha}</td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                {cand.tipo}
                              </span>
                            </td>
                            <td className="p-2.5 font-sans font-medium text-slate-800 truncate max-w-xs" title={cand.concepto}>
                              {cand.concepto}
                            </td>
                            <td className="p-2.5 text-center text-slate-600">{cand.lineas.length}</td>
                            <td className="p-2.5 text-right font-bold text-emerald-700">{formatCLP(cand.totalDebe)}</td>
                            <td className="p-2.5 text-right font-bold text-blue-700">{formatCLP(cand.totalHaber)}</td>
                            <td className="p-2.5 text-center">
                              {cand.balanceado ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                  <Check className="w-3 h-3" /> Cuadrado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full" title={`Diferencia: ${formatCLP(cand.diferencia)}`}>
                                  <AlertCircle className="w-3 h-3" /> Dif: {formatCLP(cand.diferencia)}
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => setExpandedEntryId(isExpanded ? null : cand.tempId)}
                                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-sans font-bold cursor-pointer"
                              >
                                {isExpanded ? 'Ocultar' : 'Ver Líneas'}
                              </button>
                            </td>
                          </tr>

                          {/* Detail lines if expanded */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={9} className="p-3 bg-slate-50 border-y border-slate-200">
                                <div className="space-y-1.5 font-sans text-xs">
                                  <div className="font-bold text-slate-700 text-[11px] uppercase tracking-wider mb-1 flex items-center justify-between">
                                    <span>Líneas Contables del Asiento {cand.numeroAsiento}:</span>
                                    {cand.hasUnknownAccounts && (
                                      <span className="text-amber-700 font-bold text-[10px] bg-amber-100 px-2 py-0.5 rounded">
                                        Cuentas no registradas: {cand.unknownAccountCodes.join(', ')}
                                      </span>
                                    )}
                                  </div>
                                  <table className="w-full text-left text-[11px] font-mono bg-white border rounded">
                                    <thead className="bg-slate-100 text-slate-600">
                                      <tr>
                                        <th className="p-1.5">Código Cuenta</th>
                                        <th className="p-1.5">Nombre Cuenta</th>
                                        <th className="p-1.5 text-right">Debe</th>
                                        <th className="p-1.5 text-right">Haber</th>
                                        <th className="p-1.5">Glosa Detalle</th>
                                        <th className="p-1.5">RUT Auxiliar</th>
                                        <th className="p-1.5">Centro Costo</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {cand.lineas.map((ln, lIdx) => (
                                        <tr key={lIdx}>
                                          <td className="p-1.5 font-bold text-slate-900">{ln.cuentaCodigo}</td>
                                          <td className="p-1.5 font-sans text-slate-700">{ln.cuentaNombre}</td>
                                          <td className="p-1.5 text-right text-emerald-700">{ln.debe > 0 ? formatCLP(ln.debe) : '-'}</td>
                                          <td className="p-1.5 text-right text-blue-700">{ln.haber > 0 ? formatCLP(ln.haber) : '-'}</td>
                                          <td className="p-1.5 font-sans text-slate-500">{ln.glosa || '-'}</td>
                                          <td className="p-1.5 text-slate-600">{ln.rutAuxiliar || '-'}</td>
                                          <td className="p-1.5 text-slate-600">{ln.centroCosto || '-'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Result Notification */}
          {importResult && (
            <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
              importResult.success ? 'bg-emerald-50 text-emerald-900 border border-emerald-300' : 'bg-rose-50 text-rose-900 border border-rose-300'
            }`}>
              {importResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <div>
                <p className="font-bold">{importResult.success ? '¡Importación Exitosa!' : 'Error en la Importación'}</p>
                <p className="font-normal mt-0.5">{importResult.message}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-slate-500 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Valida automáticamente la partida doble chilena y registra en el Libro Diario.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={activeCandidates.length === 0 || isProcessing}
              onClick={handleExecuteImport}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Procesando Migración...</span>
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 text-white" />
                  <span>Importar {activeCandidates.length} Asientos al Libro Diario</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
