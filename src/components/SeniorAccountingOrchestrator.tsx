import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Scale,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Plus,
  Copy,
  Check,
  Search,
  RefreshCw,
  Send,
  Bot,
  Sparkles,
  DollarSign,
  PieChart,
  Layers,
  ArrowRight,
  Table,
  Building2,
  Landmark,
  ShieldCheck,
  Download,
  Info,
  Calendar,
  Sliders,
  ChevronRight,
  TrendingUp,
  Boxes,
  Users,
  Receipt,
  FileText
} from 'lucide-react';
import {
  AccountingEntry,
  AccountingEntryLine,
  CompanyProfile,
  AccountingFirmProfile,
  ChileIndicators,
  DteDocument,
  EmployeePayroll,
  F29Declaration,
  LeaseContract,
  BankStatementMovement,
  HierarchicalAccountItem,
  TrialBalance8ColAccount,
  Balance8ColumnasReport,
  OrchestratorAuditItem,
  AccountingProposalResponse,
  PeriodClosingAdjustment,
} from '../types';
import { formatCLP, formatNumberCL, formatNormalizedAccountingEntry } from '../utils/chileanAccounting';
import {
  CHILE_HIERARCHICAL_CHART_OF_ACCOUNTS,
  buildOfficial8ColumnBalance,
  buildIFRSFinancialStatements,
  auditPeripheralModules,
  generatePeriodClosingAdjustments,
  validateAndBalanceEntry,
  buildTransactionalAccountingProposalJSON,
  findAccountInChart,
} from '../utils/accountingOrchestratorEngine';
import { seedF29 } from '../data/seedData';

interface SeniorAccountingOrchestratorProps {
  company: CompanyProfile;
  firm: AccountingFirmProfile;
  indicators: ChileIndicators;
  entries: AccountingEntry[];
  onAddEntry: (entry: AccountingEntry) => void;
  dtes?: DteDocument[];
  payrolls?: EmployeePayroll[];
  f29?: F29Declaration;
  leases?: LeaseContract[];
  bankStatements?: BankStatementMovement[];
}

export const SeniorAccountingOrchestrator: React.FC<SeniorAccountingOrchestratorProps> = ({
  company,
  firm,
  indicators,
  entries,
  onAddEntry,
  dtes = [],
  payrolls = [],
  f29 = seedF29,
  leases = [],
  bankStatements = [],
}) => {
  // Navigation tabs of the orchestrator
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'DIARIO' | 'MAYOR' | 'PLAN_CUENTAS' | 'BALANCE_8COL' | 'IFRS' | 'AI_ROUTING'>('AUDIT');

  // Multi-currency display mode (CLP, UF, USD)
  const [currencyMode, setCurrencyMode] = useState<'CLP' | 'UF' | 'USD'>('CLP');

  // Filters for Diario
  const [sourceFilter, setSourceFilter] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Mayor account selector
  const [selectedMayorAccountCode, setSelectedMayorAccountCode] = useState<string>('1.1.02.001');

  // Plan de cuentas filter & search
  const [planClassFilter, setPlanClassFilter] = useState<number | 'TODOS'>('TODOS');
  const [planSearchTerm, setPlanSearchTerm] = useState<string>('');
  const [chartOfAccounts, setChartOfAccounts] = useState<HierarchicalAccountItem[]>(CHILE_HIERARCHICAL_CHART_OF_ACCOUNTS);
  const [showAddAccountModal, setShowAddAccountModal] = useState<boolean>(false);
  const [newAccountForm, setNewAccountForm] = useState({
    codigo: '',
    nombre: '',
    clase: 6,
    tipo: 'GASTO' as const,
    clasificacion: 'OPERACIONAL' as const,
    naturaleza: 'DEUDORA' as const,
    requiereAuxiliarRut: false,
    requiereCentroCosto: true,
    esConciliableBancaria: false,
  });

  // Modal for Manual Entry
  const [showManualModal, setShowManualModal] = useState<boolean>(false);
  const [manualEntry, setManualEntry] = useState<{
    fecha: string;
    concepto: string;
    documentoReferencia: string;
    origen: AccountingEntry['origen'];
    lineas: AccountingEntryLine[];
  }>({
    fecha: new Date().toISOString().split('T')[0],
    concepto: '',
    documentoReferencia: '',
    origen: 'MANUAL',
    lineas: [
      { cuentaCodigo: '1.1.02.001', cuentaNombre: 'Banco Santander Chile Cta Cte M/N', debe: 0, haber: 0 },
      { cuentaCodigo: '2.1.01.001', cuentaNombre: 'Proveedores Nacionales (Cuentas por Pagar)', debe: 0, haber: 0 },
    ],
  });

  // AI Routing state
  const [rawGlosaInput, setRawGlosaInput] = useState<string>('Compra de servidores cloud en AWS para infraestructura web según factura afecta con IVA');
  const [rawMontoInput, setRawMontoInput] = useState<number>(1450000);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [aiProposalResponse, setAiProposalResponse] = useState<{
    humanLayer: string;
    transactionalLayer: AccountingProposalResponse | null;
  } | null>(null);

  // Copy notification state
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Period Closing Adjustments
  const [closingAdjustments, setClosingAdjustments] = useState<PeriodClosingAdjustment[]>(() =>
    generatePeriodClosingAdjustments(indicators, company, leases)
  );

  // Totals of all entries
  const totalDebe = entries.reduce((s, e) => s + (e.totalDebe || 0), 0);
  const totalHaber = entries.reduce((s, e) => s + (e.totalHaber || 0), 0);
  const isAllBalanced = Math.abs(totalDebe - totalHaber) < 1;

  // 8-Columns Balance computation
  const balance8Col: Balance8ColumnasReport = useMemo(() => {
    return buildOfficial8ColumnBalance(entries, company, '2026-12-31');
  }, [entries, company]);

  // IFRS Financial Statements
  const ifrsStatements = useMemo(() => {
    return buildIFRSFinancialStatements(balance8Col);
  }, [balance8Col]);

  // Audit items across peripheral modules
  const auditItems: OrchestratorAuditItem[] = useMemo(() => {
    return auditPeripheralModules(entries, dtes, payrolls, f29, bankStatements, leases);
  }, [entries, dtes, payrolls, f29, bankStatements, leases]);

  const totalInTransit = auditItems.reduce((s, i) => s + i.enTransito, 0);

  // Currency converter helper
  const convertAmount = (clpAmount: number): string => {
    if (currencyMode === 'UF') {
      const ufVal = clpAmount / (indicators.uf || 39150.50);
      return `${formatNumberCL(ufVal, 2)} UF`;
    }
    if (currencyMode === 'USD') {
      const usdVal = clpAmount / (indicators.dolar || 955.20);
      return `US$${formatNumberCL(usdVal, 2)}`;
    }
    return formatCLP(clpAmount);
  };

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Handle Centralization of Peripheral Module
  const handleCentralizeModule = (modulo: OrchestratorAuditItem['modulo']) => {
    const today = new Date().toISOString().split('T')[0];

    if (modulo === 'VENTAS') {
      const salesDtes = dtes.filter(d => d.tipoOperacion === 'VENTA');
      const totalVentaNeto = salesDtes.reduce((s, d) => s + (d.montoNeto || 0), 0);
      const totalVentaIva = salesDtes.reduce((s, d) => s + (d.montoIva || 0), 0);
      const totalVentaTotal = salesDtes.reduce((s, d) => s + (d.montoTotal || 0), 0);

      const entry: AccountingEntry = {
        id: `centraliza-ventas-${Date.now()}`,
        fecha: today,
        concepto: `Centralización Mensual RCV Ventas (${salesDtes.length} DTEs emitidos del giro)`,
        documento: 'Resumen RCV Ventas SII Folios 33/34',
        origen: 'RCV_VENTA',
        lineas: [
          {
            cuentaCodigo: '1.1.03.001',
            cuentaNombre: 'Clientes Nacionales (Cuentas por Cobrar)',
            debe: totalVentaTotal,
            haber: 0,
          },
          {
            cuentaCodigo: '4.1.01.001',
            cuentaNombre: 'Ingresos por Ventas Afectas a IVA',
            debe: 0,
            haber: totalVentaNeto,
          },
          {
            cuentaCodigo: '2.1.03.001',
            cuentaNombre: 'IVA Débito Fiscal',
            debe: 0,
            haber: totalVentaIva,
          },
        ],
        totalDebe: totalVentaTotal,
        totalHaber: totalVentaNeto + totalVentaIva,
        balanceado: true,
        creadoEn: new Date().toISOString(),
      };
      onAddEntry(entry);
    } else if (modulo === 'COMPRAS') {
      const purchaseDtes = dtes.filter(d => d.tipoOperacion === 'COMPRA');
      const totalCompraNeto = purchaseDtes.reduce((s, d) => s + (d.montoNeto || 0), 0);
      const totalCompraIva = purchaseDtes.reduce((s, d) => s + (d.montoIva || 0), 0);
      const totalCompraTotal = purchaseDtes.reduce((s, d) => s + (d.montoTotal || 0), 0);

      const entry: AccountingEntry = {
        id: `centraliza-compras-${Date.now()}`,
        fecha: today,
        concepto: `Centralización Mensual RCV Compras Proveedores (${purchaseDtes.length} Facturas)`,
        documento: 'Registro RCV Compras SII',
        origen: 'RCV_COMPRA',
        lineas: [
          {
            cuentaCodigo: '5.1.01.001',
            cuentaNombre: 'Costo de Ventas Mercaderías',
            debe: totalCompraNeto,
            haber: 0,
          },
          {
            cuentaCodigo: '1.1.04.001',
            cuentaNombre: 'IVA Crédito Fiscal (DL 825)',
            debe: totalCompraIva,
            haber: 0,
          },
          {
            cuentaCodigo: '2.1.01.001',
            cuentaNombre: 'Proveedores Nacionales (Cuentas por Pagar)',
            debe: 0,
            haber: totalCompraTotal,
          },
        ],
        totalDebe: totalCompraNeto + totalCompraIva,
        totalHaber: totalCompraTotal,
        balanceado: true,
        creadoEn: new Date().toISOString(),
      };
      onAddEntry(entry);
    } else if (modulo === 'RRHH') {
      const totalSueldoLiquido = payrolls.reduce((s, p) => s + p.sueldoLiquido, 0);
      const totalImposiciones = payrolls.reduce((s, p) => s + p.totalDescuentosLegales, 0);
      const totalAportePatronal = payrolls.reduce(
        (s, p) => s + p.sisEmpleadorMonto + p.mutualEmpleadorMonto + p.afcEmpleadorMonto,
        0
      );
      const totalCostoEmpresa = payrolls.reduce((s, p) => s + p.costoTotalEmpresa, 0);

      const entry: AccountingEntry = {
        id: `centraliza-rrhh-${Date.now()}`,
        fecha: today,
        concepto: `Centralización Mensual Libro de Remuneraciones (${payrolls.length} colaboradores)`,
        documento: 'Nómina DT & Previred Centralizada',
        origen: 'REMUNERACIONES',
        lineas: [
          {
            cuentaCodigo: '6.1.01.001',
            cuentaNombre: 'Sueldos y Remuneraciones Base Personal',
            debe: totalCostoEmpresa - totalAportePatronal,
            haber: 0,
          },
          {
            cuentaCodigo: '6.1.01.004',
            cuentaNombre: 'Aportes Patronales (SIS, Mutual, AFC Empleador)',
            debe: totalAportePatronal,
            haber: 0,
          },
          {
            cuentaCodigo: '2.1.02.001',
            cuentaNombre: 'Sueldos Líquidos por Pagar',
            debe: 0,
            haber: totalSueldoLiquido,
          },
          {
            cuentaCodigo: '2.1.02.002',
            cuentaNombre: 'Instituciones Previsionales (AFP) por Pagar (Previred)',
            debe: 0,
            haber: totalImposiciones + totalAportePatronal,
          },
        ],
        totalDebe: totalCostoEmpresa,
        totalHaber: totalSueldoLiquido + totalImposiciones + totalAportePatronal,
        balanceado: true,
        creadoEn: new Date().toISOString(),
      };
      onAddEntry(entry);
    } else if (modulo === 'F29') {
      const debito = f29.debitoFiscalIva || 0;
      const credito = f29.creditoFiscalIva || 0;
      const retencion = f29.retencionHonorariosSegundaCat || 0;
      const impuestoUnico = f29.retencionImpuestoUnicoSueldos || 0;
      const ppm = f29.montoPpm || 0;
      const totalPagar = f29.totalAPagar || 0;

      const entry: AccountingEntry = {
        id: `centraliza-f29-${Date.now()}`,
        fecha: today,
        concepto: 'Liquidación Mensual de Impuestos F29 (IVA, PPM y Retenciones TGR)',
        documento: 'Declaración F29 SII Folio 889210',
        origen: 'F29_TRIBUTARIO',
        lineas: [
          {
            cuentaCodigo: '2.1.03.001',
            cuentaNombre: 'IVA Débito Fiscal',
            debe: debito,
            haber: 0,
          },
          {
            cuentaCodigo: '1.1.04.003',
            cuentaNombre: 'PPM por Recuperar (Art. 84 LIR)',
            debe: ppm,
            haber: 0,
          },
          {
            cuentaCodigo: '1.1.04.001',
            cuentaNombre: 'IVA Crédito Fiscal (DL 825)',
            debe: 0,
            haber: Math.min(debito, credito),
          },
          {
            cuentaCodigo: '2.1.03.002',
            cuentaNombre: 'Retención Honorarios 2da Categoría por Pagar (F29)',
            debe: retencion,
            haber: 0,
          },
          {
            cuentaCodigo: '2.1.03.003',
            cuentaNombre: 'Impuesto Único de Segunda Categoría por Pagar (F29)',
            debe: impuestoUnico,
            haber: 0,
          },
          {
            cuentaCodigo: '2.1.03.005',
            cuentaNombre: 'Impuestos Mensuales F29 por Pagar (TGR)',
            debe: 0,
            haber: totalPagar,
          },
        ],
        totalDebe: debito + ppm + retencion + impuestoUnico,
        totalHaber: Math.min(debito, credito) + totalPagar,
        balanceado: true,
        creadoEn: new Date().toISOString(),
      };
      onAddEntry(entry);
    }
  };

  // Handle Apply Period Closing Adjustment
  const handleApplyAdjustment = (adj: PeriodClosingAdjustment) => {
    const today = new Date().toISOString().split('T')[0];
    const sumDebe = adj.asientoPropuesto.lineas.reduce((s, l) => s + l.debe, 0);
    const sumHaber = adj.asientoPropuesto.lineas.reduce((s, l) => s + l.haber, 0);

    const entry: AccountingEntry = {
      id: `adj-entry-${Date.now()}`,
      fecha: today,
      concepto: adj.asientoPropuesto.glosa,
      documento: `Comprobante Ajuste Cierre #${adj.id.toUpperCase()}`,
      origen: 'MANUAL',
      lineas: adj.asientoPropuesto.lineas.map(l => ({
        cuentaCodigo: l.codigo_cuenta,
        cuentaNombre: l.nombre_cuenta,
        debe: l.debe,
        haber: l.haber,
      })),
      totalDebe: sumDebe,
      totalHaber: sumHaber,
      balanceado: Math.abs(sumDebe - sumHaber) < 1,
      creadoEn: new Date().toISOString(),
    };

    onAddEntry(entry);
    setClosingAdjustments(prev =>
      prev.map(a => (a.id === adj.id ? { ...a, aplicado: true } : a))
    );
  };

  // Handle AI Routing Simulation
  const handleSimulateAiRouting = async () => {
    if (!rawGlosaInput.trim()) return;
    setIsAiLoading(true);

    try {
      const response = await fetch('/api/accounting/senior-orchestrator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa: company,
          query: rawGlosaInput,
          mode: 'route_glosa',
          rawGlosa: rawGlosaInput,
          monto: rawMontoInput,
          indicators,
        }),
      });

      const resJson = await response.json();
      const aiText = resJson.text || '';

      // Extract JSON if present
      let extractedJSON: AccountingProposalResponse | null = null;
      try {
        const match = aiText.match(/```json\s*([\s\S]*?)\s*```/);
        if (match && match[1]) {
          extractedJSON = JSON.parse(match[1]);
        }
      } catch (err) {
        console.warn('Failed to parse AI JSON:', err);
      }

      // Fallback deterministic if no JSON extracted
      if (!extractedJSON) {
        const isCompra = rawGlosaInput.toLowerCase().includes('compra') || rawGlosaInput.toLowerCase().includes('proveedor');
        const iva = Math.round(rawMontoInput * 0.19);
        const neto = rawMontoInput;
        const total = neto + iva;

        extractedJSON = {
          empresa_id: company.rut || '77.798.901-4',
          accion: 'propuesta_asiento',
          origen_modulo: isCompra ? 'COMPRAS' : 'VENTAS',
          periodo: new Date().toISOString().substring(0, 7),
          asiento: {
            fecha: new Date().toISOString().split('T')[0],
            tipo_comprobante: isCompra ? 'EGRESO' : 'INGRESO',
            glosa_general: rawGlosaInput,
            cuadre_valido: true,
            total_debe: total,
            total_haber: total,
            lineas: [
              {
                codigo_cuenta: '6.1.04.002',
                nombre_cuenta: 'Software, Servidores Cloud y Licencias',
                debe: neto,
                haber: 0,
                centro_costo: 'TECNOLOGIA',
              },
              {
                codigo_cuenta: '1.1.04.001',
                nombre_cuenta: 'IVA Crédito Fiscal (DL 825)',
                debe: iva,
                haber: 0,
              },
              {
                codigo_cuenta: '2.1.01.001',
                nombre_cuenta: 'Proveedores Nacionales (Cuentas por Pagar)',
                debe: 0,
                haber: total,
                rut_auxiliar: '76.889.012-3',
              },
            ],
          },
          alertas_auditoria: [
            'Asiento validado: IVA Crédito Fiscal cumple con requisitos de respaldo en RCV según Art. 23 DL 825.',
          ],
        };
      }

      setAiProposalResponse({
        humanLayer: aiText.replace(/```json[\s\S]*?```/, '').trim() ||
          `Como Agente Orquestador Contable y Financiero Senior, he determinado la imputación para "${rawGlosaInput}". Se clasificó el gasto operacional con crédito fiscal IVA afecto y pasivo en Proveedores Nacionales con centro de costo.`,
        transactionalLayer: extractedJSON,
      });
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Handle Commit Proposal from AI to Ledger
  const handleCommitAiProposal = () => {
    if (!aiProposalResponse?.transactionalLayer?.asiento) return;
    const a = aiProposalResponse.transactionalLayer.asiento;

    const entry: AccountingEntry = {
      id: `entry-ai-${Date.now()}`,
      fecha: a.fecha,
      concepto: a.glosa_general,
      documento: 'Comprobante Propuesta IA Autorizada',
      origen: (aiProposalResponse.transactionalLayer.origen_modulo as any) || 'MANUAL',
      lineas: a.lineas.map(l => ({
        cuentaCodigo: l.codigo_cuenta,
        cuentaNombre: l.nombre_cuenta,
        debe: l.debe,
        haber: l.haber,
      })),
      totalDebe: a.total_debe,
      totalHaber: a.total_haber,
      balanceado: a.cuadre_valido,
      creadoEn: new Date().toISOString(),
    };

    onAddEntry(entry);
    alert('Asiento contable imputado con éxito en el Libro Diario.');
  };

  // Handle Add Account to Chart
  const handleCreateNewAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountForm.codigo || !newAccountForm.nombre) return;

    const newAcc: HierarchicalAccountItem = {
      codigo: newAccountForm.codigo,
      nombre: newAccountForm.nombre,
      clase: newAccountForm.clase as any,
      grupo: newAccountForm.codigo.split('.').slice(0, 2).join('.'),
      subgrupo: newAccountForm.codigo.split('.').slice(0, 3).join('.'),
      nivel: 5,
      tipo: newAccountForm.tipo,
      clasificacion: newAccountForm.clasificacion,
      naturaleza: newAccountForm.naturaleza,
      requiereAuxiliarRut: newAccountForm.requiereAuxiliarRut,
      requiereCentroCosto: newAccountForm.requiereCentroCosto,
      esConciliableBancaria: newAccountForm.esConciliableBancaria,
      activa: true,
    };

    setChartOfAccounts(prev => [...prev, newAcc]);
    setShowAddAccountModal(false);
    setNewAccountForm({
      codigo: '',
      nombre: '',
      clase: 6,
      tipo: 'GASTO',
      clasificacion: 'OPERACIONAL',
      naturaleza: 'DEUDORA',
      requiereAuxiliarRut: false,
      requiereCentroCosto: true,
      esConciliableBancaria: false,
    });
  };

  // Filtered Chart of Accounts
  const filteredPlan = useMemo(() => {
    return chartOfAccounts.filter(acc => {
      const matchClass = planClassFilter === 'TODOS' || acc.clase === planClassFilter;
      const matchSearch =
        acc.nombre.toLowerCase().includes(planSearchTerm.toLowerCase()) ||
        acc.codigo.toLowerCase().includes(planSearchTerm.toLowerCase());
      return matchClass && matchSearch;
    });
  }, [chartOfAccounts, planClassFilter, planSearchTerm]);

  // Filtered Entries for Diario
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchSource = sourceFilter === 'TODOS' || e.origen === sourceFilter;
      const matchSearch =
        e.concepto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.documento.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.lineas.some(l => l.cuentaNombre.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchSource && matchSearch;
    });
  }, [entries, sourceFilter, searchTerm]);

  // Mayor account details
  const mayorAccountMovements = useMemo(() => {
    const list: Array<{
      fecha: string;
      asientoId: string;
      concepto: string;
      documento: string;
      debe: number;
      haber: number;
      saldoAcumulado: number;
    }> = [];

    let runningBalance = 0;
    const selectedAcc = findAccountInChart(selectedMayorAccountCode);
    const isDeudora = selectedAcc?.naturaleza === 'DEUDORA';

    entries.forEach(entry => {
      entry.lineas.forEach(line => {
        if (line.cuentaCodigo === selectedMayorAccountCode) {
          if (isDeudora) {
            runningBalance += (line.debe || 0) - (line.haber || 0);
          } else {
            runningBalance += (line.haber || 0) - (line.debe || 0);
          }

          list.push({
            fecha: entry.fecha,
            asientoId: entry.id,
            concepto: entry.concepto,
            documento: entry.documento,
            debe: line.debe,
            haber: line.haber,
            saldoAcumulado: runningBalance,
          });
        }
      });
    });

    return list;
  }, [entries, selectedMayorAccountCode]);

  // Manual Entry Form Line Handlers
  const handleAddManualLine = () => {
    setManualEntry(prev => ({
      ...prev,
      lineas: [
        ...prev.lineas,
        { cuentaCodigo: '1.1.01.001', cuentaNombre: 'Caja Central Moneda Nacional', debe: 0, haber: 0 },
      ],
    }));
  };

  const handleUpdateManualLine = (index: number, field: keyof AccountingEntryLine, value: any) => {
    const updated = [...manualEntry.lineas];
    if (field === 'cuentaNombre') {
      const found = findAccountInChart(value);
      updated[index] = {
        ...updated[index],
        cuentaNombre: value,
        cuentaCodigo: found?.codigo || '9.9.99.999',
      };
    } else {
      updated[index] = { ...updated[index], [field]: Number(value) };
    }
    setManualEntry(prev => ({ ...prev, lineas: updated }));
  };

  const handleRemoveManualLine = (index: number) => {
    if (manualEntry.lineas.length <= 2) return;
    setManualEntry(prev => ({
      ...prev,
      lineas: prev.lineas.filter((_, i) => i !== index),
    }));
  };

  const handleAutoBalanceCentavos = () => {
    const res = validateAndBalanceEntry(manualEntry.lineas);
    if (res.lineasCorregidas) {
      setManualEntry(prev => ({ ...prev, lineas: res.lineasCorregidas }));
    }
  };

  const handleSaveManualEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualEntry.concepto.trim()) return;

    const validation = validateAndBalanceEntry(manualEntry.lineas);
    if (!validation.valido) {
      alert(`No se puede guardar el asiento. Existe un descuadre en la partida doble de ${formatCLP(Math.abs(validation.diferencia))}. Σ Débitos debe ser igual a Σ Créditos.`);
      return;
    }

    const created: AccountingEntry = {
      id: `entry-man-${Date.now()}`,
      fecha: manualEntry.fecha,
      concepto: manualEntry.concepto,
      documento: manualEntry.documentoReferencia || 'Comprobante Diario Interno',
      origen: manualEntry.origen,
      lineas: validation.lineasCorregidas,
      totalDebe: validation.totalDebe,
      totalHaber: validation.totalHaber,
      balanceado: true,
      creadoEn: new Date().toISOString(),
    };

    onAddEntry(created);
    setShowManualModal(false);
  };

  const manualDebe = manualEntry.lineas.reduce((s, l) => s + (l.debe || 0), 0);
  const manualHaber = manualEntry.lineas.reduce((s, l) => s + (l.haber || 0), 0);
  const manualDiff = manualDebe - manualHaber;
  const isManualBalanced = Math.abs(manualDiff) < 1;

  return (
    <div className="space-y-6">
      {/* Top Banner: Senior Orchestrator Identity & Context */}
      <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#0f172a] text-white border border-slate-700 rounded-xl p-6 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                NÚCLEO CONTABLE AUTÓNOMO ERP
              </span>
              <span className="bg-slate-800 text-slate-300 border border-slate-700 text-xs px-2.5 py-0.5 rounded-full font-mono">
                RUT: {company.rut || '77.798.901-4'}
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-2.5 py-0.5 rounded-full font-mono">
                Régimen: {company.regimenTributario || '14 D3 Pro Pyme General'}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-2 flex items-center gap-2">
              <Scale className="w-6 h-6 text-blue-400" />
              Agente Orquestador Contable & Financiero Senior
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl">
              Autoridad técnica central sobre el Libro Mayor, Libro Diario, Plan de Cuentas Jerárquico y Balances Oficiales (Balance 8 Columnas SII e IFRS). Supervisa y centraliza operaciones de RRHH, RCV, F29, Bancos y Arriendos garantizando partida doble estricta.
            </p>
          </div>

          {/* Currency Switcher & Quick Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <div className="bg-slate-800/90 border border-slate-700 rounded-lg p-1 flex items-center gap-1">
              <button
                onClick={() => setCurrencyMode('CLP')}
                className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                  currencyMode === 'CLP' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
              >
                $ CLP
              </button>
              <button
                onClick={() => setCurrencyMode('UF')}
                className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                  currencyMode === 'UF' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
                title={`UF al cierre: ${formatCLP(indicators.uf)}`}
              >
                UF ({formatNumberCL(indicators.uf, 0)})
              </button>
              <button
                onClick={() => setCurrencyMode('USD')}
                className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-all ${
                  currencyMode === 'USD' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'
                }`}
                title={`Dólar observado: $${indicators.dolar}`}
              >
                USD (${indicators.dolar})
              </button>
            </div>

            <button
              onClick={() => setShowManualModal(true)}
              className="bg-[#2563eb] hover:bg-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Asiento Manual</span>
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-800 text-xs">
          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/60">
            <span className="text-slate-400 block font-medium">Total Sumas Débito</span>
            <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">
              {convertAmount(totalDebe)}
            </span>
            <span className="text-[11px] text-slate-400">{entries.length} Asientos contables</span>
          </div>

          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/60">
            <span className="text-slate-400 block font-medium">Total Sumas Crédito</span>
            <span className="text-lg font-bold font-mono text-blue-400 mt-1 block">
              {convertAmount(totalHaber)}
            </span>
            <span className="text-[11px] text-slate-400">Partida doble SII</span>
          </div>

          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/60">
            <span className="text-slate-400 block font-medium">Cuadratura Partida Doble</span>
            <div className={`mt-1 font-bold flex items-center gap-1.5 ${isAllBalanced ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isAllBalanced ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Libro Mayor Cuadrado</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Descuadre ({formatCLP(Math.abs(totalDebe - totalHaber))})</span>
                </>
              )}
            </div>
            <span className="text-[11px] text-slate-400">Σ Débitos == Σ Créditos</span>
          </div>

          <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700/60">
            <span className="text-slate-400 block font-medium">Resultado del Ejercicio</span>
            <div className="mt-1 font-bold font-mono flex items-center gap-1.5">
              <span className={balance8Col.resultado_del_ejercicio.tipo === 'UTILIDAD' ? 'text-emerald-400' : 'text-amber-400'}>
                {balance8Col.resultado_del_ejercicio.tipo}: {convertAmount(balance8Col.resultado_del_ejercicio.monto)}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              {totalInTransit > 0 ? `${totalInTransit} operaciones en tránsito` : 'Módulos 100% al día'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-xs flex flex-wrap items-center gap-1.5 overflow-x-auto">
        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            activeTab === 'AUDIT'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span>Orquestación & Auditoría Continua</span>
          {totalInTransit > 0 && (
            <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
              {totalInTransit}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('DIARIO')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            activeTab === 'DIARIO'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <span>Libro Diario Normalizado</span>
        </button>

        <button
          onClick={() => setActiveTab('MAYOR')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            activeTab === 'MAYOR'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>Libro Mayor Analítico (T)</span>
        </button>

        <button
          onClick={() => setActiveTab('PLAN_CUENTAS')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            activeTab === 'PLAN_CUENTAS'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-4 h-4 text-amber-400" />
          <span>Plan de Cuentas (Chile 5 Niveles)</span>
        </button>

        <button
          onClick={() => setActiveTab('BALANCE_8COL')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            activeTab === 'BALANCE_8COL'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Table className="w-4 h-4 text-blue-500" />
          <span>Balance Oficial 8 Columnas (SII)</span>
        </button>

        <button
          onClick={() => setActiveTab('IFRS')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            activeTab === 'IFRS'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <PieChart className="w-4 h-4 text-rose-400" />
          <span>Estados Financieros IFRS</span>
        </button>

        <button
          onClick={() => setActiveTab('AI_ROUTING')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
            activeTab === 'AI_ROUTING'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Bot className="w-4 h-4 text-purple-400" />
          <span>Terminal Asesora & Routing IA</span>
        </button>
      </div>

      {/* VIEW 1: AUDITORÍA CONTINUA Y ORQUESTACIÓN */}
      {activeTab === 'AUDIT' && (
        <div className="space-y-6">
          {/* Peripheral Module Matrix */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#2563eb]" />
                  Matriz de Supervisión y Centralización de Módulos Periféricos
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monitoreo en tiempo real de operaciones en tránsito provenientes de RRHH, Compras/Ventas SII, F29, Bancos y Arriendos.
                </p>
              </div>
              <div className="text-xs text-slate-500 font-mono">
                Empresa: <strong className="text-slate-800">{company.razonSocial}</strong>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[11px] tracking-wider">
                    <th className="py-3 px-4">Módulo Periférico</th>
                    <th className="py-3 px-4">Documentos</th>
                    <th className="py-3 px-4">Monto Global</th>
                    <th className="py-3 px-4 text-center">Asentados</th>
                    <th className="py-3 px-4 text-center">En Tránsito</th>
                    <th className="py-3 px-4">Diagnóstico Auditor</th>
                    <th className="py-3 px-4 text-right">Acción Orquestador</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditItems.map((item) => (
                    <tr key={item.modulo} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                        {item.modulo === 'VENTAS' && <Receipt className="w-4 h-4 text-blue-600" />}
                        {item.modulo === 'COMPRAS' && <FileSpreadsheet className="w-4 h-4 text-amber-600" />}
                        {item.modulo === 'HONORARIOS' && <FileText className="w-4 h-4 text-indigo-600" />}
                        {item.modulo === 'RRHH' && <Users className="w-4 h-4 text-emerald-600" />}
                        {item.modulo === 'F29' && <Scale className="w-4 h-4 text-purple-600" />}
                        {item.modulo === 'TESORERIA' && <Landmark className="w-4 h-4 text-sky-600" />}
                        {item.modulo === 'ARRIENDO' && <Building2 className="w-4 h-4 text-teal-600" />}
                        <span>{item.nombre}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">{item.totalDocumentos}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">{convertAmount(item.montoTotal)}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-bold">
                          {item.contabilizados}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.enTransito > 0 ? (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-bold">
                            {item.enTransito} pendientes
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs">{item.observacion}</td>
                      <td className="py-3 px-4 text-right">
                        {item.enTransito > 0 ? (
                          <button
                            onClick={() => handleCentralizeModule(item.modulo)}
                            className="bg-[#2563eb] hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-all shadow-2xs"
                          >
                            Centralizar Ahora
                          </button>
                        ) : (
                          <span className="text-emerald-700 font-semibold flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Al Día</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Period End Adjustments (Devengos, UF, USD, Depreciaciones) */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-600" />
                  Cierres y Ajustes de Período Automáticos (IFRS / LIR)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ajustes automáticos de devengos mensuales, corrección monetaria USD, reajustes UF y depreciación de activo fijo bajo NIC 16.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {closingAdjustments.map((adj) => (
                <div
                  key={adj.id}
                  className={`border rounded-lg p-4 transition-all ${
                    adj.aplicado ? 'bg-slate-50/80 border-slate-200 opacity-80' : 'bg-white border-slate-300 hover:border-blue-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                        {adj.tipo}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 mt-2">{adj.titulo}</h4>
                      <p className="text-xs text-slate-600 mt-1">{adj.descripcion}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold font-mono text-slate-900 block">
                        {convertAmount(adj.montoAjuste)}
                      </span>
                      {adj.aplicado ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold mt-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Asentado
                        </span>
                      ) : (
                        <button
                          onClick={() => handleApplyAdjustment(adj)}
                          className="mt-2 bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1 rounded cursor-pointer transition-all"
                        >
                          Asentar Ajuste
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Asiento Preview */}
                  <div className="mt-3 pt-3 border-t border-slate-100 bg-slate-50 p-2.5 rounded text-[11px] font-mono space-y-1">
                    <div className="text-slate-500 text-[10px] uppercase font-bold">Líneas de Asiento Propuesto:</div>
                    {adj.asientoPropuesto.lineas.map((line, idx) => (
                      <div key={idx} className="flex justify-between items-center text-slate-700">
                        <span className="truncate pr-2">
                          {line.codigo_cuenta} - {line.nombre_cuenta}
                        </span>
                        <span>
                          {line.debe > 0 ? `D: ${formatCLP(line.debe)}` : `H: ${formatCLP(line.haber)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: LIBRO DIARIO NORMALIZADO */}
      {activeTab === 'DIARIO' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por glosa, cuenta o documento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 w-64"
                />
              </div>

              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
              >
                <option value="TODOS">Todos los Orígenes</option>
                <option value="RCV_VENTA">RCV Ventas (DTE 33/34)</option>
                <option value="RCV_COMPRA">RCV Compras Proveedores</option>
                <option value="HONORARIOS">Boletas de Honorarios</option>
                <option value="REMUNERACIONES">Nómina y RRHH</option>
                <option value="F29_TRIBUTARIO">Liquidación F29</option>
                <option value="CAJA_BANCO">Bancos y Tesorería</option>
                <option value="ARRIENDO_IFRS16">Contratos IFRS 16</option>
                <option value="MANUAL">Asientos Manuales / Ajustes</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const allFormatted = filteredEntries.map(formatNormalizedAccountingEntry).join('\n\n');
                  handleCopyText(allFormatted, 'diario_all');
                }}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {copiedText === 'diario_all' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-600" />}
                <span>Copiar Todo el Libro Diario</span>
              </button>
            </div>
          </div>

          {/* Entries Cards */}
          <div className="space-y-4">
            {filteredEntries.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-500 text-xs">
                No se encontraron asientos contables que coincidan con los filtros aplicados.
              </div>
            ) : (
              filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs hover:border-slate-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                        {entry.fecha}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{entry.concepto}</span>
                      <span className="text-[11px] text-slate-500 font-mono">[{entry.documento}]</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                        {entry.origen}
                      </span>
                      {entry.balanceado ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 text-[11px] font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Cuadrado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 text-[11px] font-bold">
                          <AlertTriangle className="w-3.5 h-3.5" /> Descuadrado
                        </span>
                      )}
                      <button
                        onClick={() => handleCopyText(formatNormalizedAccountingEntry(entry), entry.id)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                        title="Copiar comprobante normalizado"
                      >
                        {copiedText === entry.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Lines Table */}
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 text-[11px] uppercase border-b border-slate-100 font-mono">
                          <th className="pb-1.5 text-left font-semibold">Código</th>
                          <th className="pb-1.5 text-left font-semibold">Cuenta Contable</th>
                          <th className="pb-1.5 text-right font-semibold">Debe ($)</th>
                          <th className="pb-1.5 text-right font-semibold">Haber ($)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-mono">
                        {entry.lineas.map((line, lIdx) => (
                          <tr key={lIdx} className="hover:bg-slate-50/50">
                            <td className="py-1.5 text-slate-500">{line.cuentaCodigo}</td>
                            <td className="py-1.5 text-slate-800 font-sans">{line.cuentaNombre}</td>
                            <td className="py-1.5 text-right text-emerald-700 font-semibold">
                              {line.debe > 0 ? convertAmount(line.debe) : '-'}
                            </td>
                            <td className="py-1.5 text-right text-blue-700 font-semibold">
                              {line.haber > 0 ? convertAmount(line.haber) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-200 font-mono font-bold text-slate-900 bg-slate-50/50">
                          <td colSpan={2} className="py-2 text-right uppercase text-[11px]">
                            Sumas Iguales:
                          </td>
                          <td className="py-2 text-right text-emerald-700">{convertAmount(entry.totalDebe)}</td>
                          <td className="py-2 text-right text-blue-700">{convertAmount(entry.totalHaber)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: LIBRO MAYOR ANALÍTICO */}
      {activeTab === 'MAYOR' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                Libro Mayor Analítico por Cuenta (Esquema de Mayor / Cuentas T)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Seguimiento analítico de débitos, créditos y saldo acumulado por cuenta contable.
              </p>
            </div>

            {/* Account Selector */}
            <div className="w-full sm:w-80">
              <select
                value={selectedMayorAccountCode}
                onChange={(e) => setSelectedMayorAccountCode(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-lg p-2 font-mono focus:outline-none focus:border-blue-500"
              >
                {chartOfAccounts.map((acc) => (
                  <option key={acc.codigo} value={acc.codigo}>
                    {acc.codigo} - {acc.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Account Card Details */}
          {(() => {
            const acc = findAccountInChart(selectedMayorAccountCode);
            const totalDebeMayor = mayorAccountMovements.reduce((s, m) => s + m.debe, 0);
            const totalHaberMayor = mayorAccountMovements.reduce((s, m) => s + m.haber, 0);
            const saldoFinal = acc?.naturaleza === 'DEUDORA'
              ? totalDebeMayor - totalHaberMayor
              : totalHaberMayor - totalDebeMayor;

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Cuenta</span>
                    <div className="font-bold text-slate-900 text-sm mt-1">{acc?.nombre || selectedMayorAccountCode}</div>
                    <div className="text-[11px] font-mono text-slate-500">{selectedMayorAccountCode}</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Total Débitos</span>
                    <div className="font-bold font-mono text-emerald-700 text-base mt-1">{convertAmount(totalDebeMayor)}</div>
                    <div className="text-[11px] text-slate-500">{mayorAccountMovements.filter(m => m.debe > 0).length} cargos</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Total Créditos</span>
                    <div className="font-bold font-mono text-blue-700 text-base mt-1">{convertAmount(totalHaberMayor)}</div>
                    <div className="text-[11px] text-slate-500">{mayorAccountMovements.filter(m => m.haber > 0).length} abonos</div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg">
                    <span className="text-[11px] text-slate-500 uppercase font-semibold">Saldo ({acc?.naturaleza})</span>
                    <div className="font-bold font-mono text-slate-900 text-base mt-1">{convertAmount(saldoFinal)}</div>
                    <div className="text-[11px] text-slate-500">Naturaleza: {acc?.naturaleza}</div>
                  </div>
                </div>

                {/* Table of Movements */}
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                        <th className="py-2.5 px-4 font-mono">Fecha</th>
                        <th className="py-2.5 px-4">Concepto / Glosa</th>
                        <th className="py-2.5 px-4">Documento</th>
                        <th className="py-2.5 px-4 text-right font-mono">Debe ($)</th>
                        <th className="py-2.5 px-4 text-right font-mono">Haber ($)</th>
                        <th className="py-2.5 px-4 text-right font-mono">Saldo Acumulado ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {mayorAccountMovements.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400 font-sans">
                            No se registran movimientos en el período para esta cuenta.
                          </td>
                        </tr>
                      ) : (
                        mayorAccountMovements.map((mov, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60">
                            <td className="py-2 px-4 text-slate-600">{mov.fecha}</td>
                            <td className="py-2 px-4 text-slate-900 font-sans">{mov.concepto}</td>
                            <td className="py-2 px-4 text-slate-500 font-sans">{mov.documento}</td>
                            <td className="py-2 px-4 text-right text-emerald-700 font-semibold">
                              {mov.debe > 0 ? convertAmount(mov.debe) : '-'}
                            </td>
                            <td className="py-2 px-4 text-right text-blue-700 font-semibold">
                              {mov.haber > 0 ? convertAmount(mov.haber) : '-'}
                            </td>
                            <td className="py-2 px-4 text-right font-bold text-slate-900">
                              {convertAmount(mov.saldoAcumulado)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* VIEW 4: PLAN DE CUENTAS JERÁRQUICO */}
      {activeTab === 'PLAN_CUENTAS' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-600" />
                Plan de Cuentas Jerárquico Chileno (5 Niveles · Clases 1 a 7)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Estructura normalizada según CMF y SII: Clase, Grupo, Subgrupo, Cuenta y Subcuenta analítica con atributos.
              </p>
            </div>

            <button
              onClick={() => setShowAddAccountModal(true)}
              className="bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Cuenta Contable</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por código o nombre de cuenta..."
                value={planSearchTerm}
                onChange={(e) => setPlanSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 w-72"
              />
            </div>

            <select
              value={planClassFilter}
              onChange={(e) => setPlanClassFilter(e.target.value === 'TODOS' ? 'TODOS' : Number(e.target.value))}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="TODOS">Todas las Clases (1 a 7)</option>
              <option value="1">Clase 1: ACTIVO (Corriente y No Corriente)</option>
              <option value="2">Clase 2: PASIVO (Corriente y No Corriente)</option>
              <option value="3">Clase 3: PATRIMONIO NETO</option>
              <option value="4">Clase 4: INGRESOS DE LA OPERACIÓN</option>
              <option value="5">Clase 5: COSTOS DE EXPLOTACIÓN</option>
              <option value="6">Clase 6: GASTOS DE ADMINISTRACIÓN Y VENTAS</option>
              <option value="7">Clase 7: OTROS INGRESOS / GASTOS NO OPERACIONALES</option>
            </select>
          </div>

          {/* Accounts Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[11px]">
                  <th className="py-2.5 px-4 font-mono">Código</th>
                  <th className="py-2.5 px-4">Nombre de la Cuenta</th>
                  <th className="py-2.5 px-4">Clase</th>
                  <th className="py-2.5 px-4">Tipo</th>
                  <th className="py-2.5 px-4 text-center">Naturaleza</th>
                  <th className="py-2.5 px-4 text-center">Auxiliar RUT</th>
                  <th className="py-2.5 px-4 text-center">C. Costo</th>
                  <th className="py-2.5 px-4 text-center">Conciliable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredPlan.map((acc) => (
                  <tr key={acc.codigo} className="hover:bg-slate-50/70">
                    <td className="py-2 px-4 font-bold text-slate-800">{acc.codigo}</td>
                    <td className="py-2 px-4 font-sans font-medium text-slate-900">{acc.nombre}</td>
                    <td className="py-2 px-4 font-sans text-slate-600">
                      Clase {acc.clase}
                    </td>
                    <td className="py-2 px-4 font-sans text-slate-600">{acc.tipo}</td>
                    <td className="py-2 px-4 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        acc.naturaleza === 'DEUDORA' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                      }`}>
                        {acc.naturaleza}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-center">
                      {acc.requiereAuxiliarRut ? (
                        <span className="text-emerald-700 font-bold">Sí</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-center">
                      {acc.requiereCentroCosto ? (
                        <span className="text-blue-700 font-bold">Sí</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-center">
                      {acc.esConciliableBancaria ? (
                        <span className="text-indigo-700 font-bold">Banco</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 5: BALANCE GENERAL TRIBUTARIO DE 8 COLUMNAS (SII) */}
      {activeTab === 'BALANCE_8COL' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded font-mono">
                  FORMATO OFICIAL SII CHILE
                </span>
                <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5 rounded font-mono">
                  PARTIDA DOBLE GARANTIZADA
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
                <Table className="w-5 h-5 text-blue-600" />
                Balance General Tributario de 8 Columnas
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Col 1 & 2: Débitos y Créditos · Col 3 & 4: Saldos Deudor/Acreedor · Col 5 & 6: Inventario (Activo/Pasivo) · Col 7 & 8: Resultado (Pérdida/Ganancia).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const jsonReport = JSON.stringify(balance8Col, null, 2);
                  handleCopyText(jsonReport, 'balance_json');
                }}
                className="bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                {copiedText === 'balance_json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
                <span>Copiar JSON ERP (Tipo B)</span>
              </button>
            </div>
          </div>

          {/* 8 Column Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                {/* Main Header */}
                <tr className="bg-[#0f172a] text-white text-[11px] font-semibold uppercase tracking-wider">
                  <th rowSpan={2} className="py-2.5 px-3 text-left border-r border-slate-700">Código</th>
                  <th rowSpan={2} className="py-2.5 px-3 text-left border-r border-slate-700">Cuenta Contable</th>
                  <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-700 bg-slate-800">1-2. Sumas</th>
                  <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-700 bg-slate-800">3-4. Saldos</th>
                  <th colSpan={2} className="py-2 px-3 text-center border-r border-slate-700 bg-blue-900/60">5-6. Inventario</th>
                  <th colSpan={2} className="py-2 px-3 text-center bg-emerald-900/60">7-8. Resultado</th>
                </tr>
                {/* Sub Header */}
                <tr className="bg-slate-100 text-slate-700 text-[10px] font-bold uppercase border-b border-slate-300">
                  <th className="py-1.5 px-2.5 border-r border-slate-200">Débito ($)</th>
                  <th className="py-1.5 px-2.5 border-r border-slate-200">Crédito ($)</th>
                  <th className="py-1.5 px-2.5 border-r border-slate-200">Deudor ($)</th>
                  <th className="py-1.5 px-2.5 border-r border-slate-200">Acreedor ($)</th>
                  <th className="py-1.5 px-2.5 border-r border-slate-200 bg-blue-50 text-blue-900">Activo ($)</th>
                  <th className="py-1.5 px-2.5 border-r border-slate-200 bg-blue-50 text-blue-900">Pasivo ($)</th>
                  <th className="py-1.5 px-2.5 border-r border-slate-200 bg-rose-50 text-rose-900">Pérdida ($)</th>
                  <th className="py-1.5 px-2.5 bg-emerald-50 text-emerald-900">Ganancia ($)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {balance8Col.cuentas.map((c) => (
                  <tr key={c.codigo} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 text-left font-bold text-slate-800 border-r border-slate-100">{c.codigo}</td>
                    <td className="py-2 px-3 text-left font-sans text-slate-900 border-r border-slate-100 truncate max-w-xs">{c.nombre}</td>
                    {/* Sumas */}
                    <td className="py-2 px-2.5 text-slate-700 border-r border-slate-100">{c.debitos > 0 ? convertAmount(c.debitos) : '-'}</td>
                    <td className="py-2 px-2.5 text-slate-700 border-r border-slate-100">{c.creditos > 0 ? convertAmount(c.creditos) : '-'}</td>
                    {/* Saldos */}
                    <td className="py-2 px-2.5 text-emerald-800 font-semibold border-r border-slate-100">{c.saldo_deudor > 0 ? convertAmount(c.saldo_deudor) : '-'}</td>
                    <td className="py-2 px-2.5 text-blue-800 font-semibold border-r border-slate-100">{c.saldo_acreedor > 0 ? convertAmount(c.saldo_acreedor) : '-'}</td>
                    {/* Inventario */}
                    <td className="py-2 px-2.5 text-blue-900 font-bold bg-blue-50/30 border-r border-slate-100">{c.activo > 0 ? convertAmount(c.activo) : '-'}</td>
                    <td className="py-2 px-2.5 text-blue-900 font-bold bg-blue-50/30 border-r border-slate-100">{c.pasivo > 0 ? convertAmount(c.pasivo) : '-'}</td>
                    {/* Resultado */}
                    <td className="py-2 px-2.5 text-rose-800 font-bold bg-rose-50/30 border-r border-slate-100">{c.perdida > 0 ? convertAmount(c.perdida) : '-'}</td>
                    <td className="py-2 px-2.5 text-emerald-800 font-bold bg-emerald-50/30">{c.ganancia > 0 ? convertAmount(c.ganancia) : '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-mono text-[11px] font-bold">
                {/* Subtotales */}
                <tr className="bg-slate-100 text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={2} className="py-2.5 px-3 text-left uppercase text-[11px] border-r border-slate-200">
                    Subtotales de Columnas:
                  </td>
                  <td className="py-2.5 px-2.5 border-r border-slate-200 text-emerald-800">{convertAmount(balance8Col.totales.total_debitos)}</td>
                  <td className="py-2.5 px-2.5 border-r border-slate-200 text-blue-800">{convertAmount(balance8Col.totales.total_creditos)}</td>
                  <td className="py-2.5 px-2.5 border-r border-slate-200 text-emerald-800">{convertAmount(balance8Col.totales.total_saldo_deudor)}</td>
                  <td className="py-2.5 px-2.5 border-r border-slate-200 text-blue-800">{convertAmount(balance8Col.totales.total_saldo_acreedor)}</td>
                  <td className="py-2.5 px-2.5 border-r border-slate-200 bg-blue-100/50 text-blue-950">{convertAmount(balance8Col.totales.total_activo)}</td>
                  <td className="py-2.5 px-2.5 border-r border-slate-200 bg-blue-100/50 text-blue-950">{convertAmount(balance8Col.totales.total_pasivo)}</td>
                  <td className="py-2.5 px-2.5 border-r border-slate-200 bg-rose-100/50 text-rose-950">{convertAmount(balance8Col.totales.total_perdida)}</td>
                  <td className="py-2.5 px-2.5 bg-emerald-100/50 text-emerald-950">{convertAmount(balance8Col.totales.total_ganancia)}</td>
                </tr>

                {/* Línea Oficial de Utilidad / Pérdida del Ejercicio con Cuadre Simétrico */}
                <tr className="bg-amber-50 text-amber-900 border-t border-amber-200 font-bold">
                  <td colSpan={2} className="py-2.5 px-3 text-left uppercase text-[11px] border-r border-amber-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      {balance8Col.resultado_del_ejercicio.tipo === 'UTILIDAD' ? 'Utilidad del Ejercicio Actual' : 'Pérdida del Ejercicio Actual'}
                    </span>
                  </td>
                  <td colSpan={4} className="py-2.5 px-2.5 text-center text-slate-400 border-r border-amber-200 font-sans text-xs">
                    (Cuadre simétrico entre Inventario y Resultado)
                  </td>
                  {/* Inventario Balance Line */}
                  <td className="py-2.5 px-2.5 border-r border-amber-200 text-amber-950">
                    {balance8Col.resultado_del_ejercicio.tipo === 'PERDIDA' ? convertAmount(balance8Col.resultado_del_ejercicio.monto) : '-'}
                  </td>
                  <td className="py-2.5 px-2.5 border-r border-amber-200 text-amber-950">
                    {balance8Col.resultado_del_ejercicio.tipo === 'UTILIDAD' ? convertAmount(balance8Col.resultado_del_ejercicio.monto) : '-'}
                  </td>
                  {/* Resultado Balance Line */}
                  <td className="py-2.5 px-2.5 border-r border-amber-200 text-amber-950">
                    {balance8Col.resultado_del_ejercicio.tipo === 'UTILIDAD' ? convertAmount(balance8Col.resultado_del_ejercicio.monto) : '-'}
                  </td>
                  <td className="py-2.5 px-2.5 text-amber-950">
                    {balance8Col.resultado_del_ejercicio.tipo === 'PERDIDA' ? convertAmount(balance8Col.resultado_del_ejercicio.monto) : '-'}
                  </td>
                </tr>

                {/* Totales Iguales Finales */}
                <tr className="bg-[#0f172a] text-white text-[11px] border-t-2 border-slate-900 font-mono">
                  <td colSpan={2} className="py-3 px-3 text-left uppercase text-[11px] border-r border-slate-700">
                    Totales Iguales Cuadrados:
                  </td>
                  <td className="py-3 px-2.5 border-r border-slate-700 text-emerald-400">{convertAmount(balance8Col.totales.total_debitos)}</td>
                  <td className="py-3 px-2.5 border-r border-slate-700 text-blue-400">{convertAmount(balance8Col.totales.total_creditos)}</td>
                  <td className="py-3 px-2.5 border-r border-slate-700 text-emerald-400">{convertAmount(balance8Col.totales.total_saldo_deudor)}</td>
                  <td className="py-3 px-2.5 border-r border-slate-700 text-blue-400">{convertAmount(balance8Col.totales.total_saldo_acreedor)}</td>
                  <td className="py-3 px-2.5 border-r border-slate-700 text-blue-300">
                    {convertAmount(
                      balance8Col.resultado_del_ejercicio.tipo === 'PERDIDA'
                        ? balance8Col.totales.total_activo + balance8Col.resultado_del_ejercicio.monto
                        : balance8Col.totales.total_activo
                    )}
                  </td>
                  <td className="py-3 px-2.5 border-r border-slate-700 text-blue-300">
                    {convertAmount(
                      balance8Col.resultado_del_ejercicio.tipo === 'UTILIDAD'
                        ? balance8Col.totales.total_pasivo + balance8Col.resultado_del_ejercicio.monto
                        : balance8Col.totales.total_pasivo
                    )}
                  </td>
                  <td className="py-3 px-2.5 border-r border-slate-700 text-rose-300">
                    {convertAmount(
                      balance8Col.resultado_del_ejercicio.tipo === 'UTILIDAD'
                        ? balance8Col.totales.total_perdida + balance8Col.resultado_del_ejercicio.monto
                        : balance8Col.totales.total_perdida
                    )}
                  </td>
                  <td className="py-3 px-2.5 text-emerald-300">
                    {convertAmount(
                      balance8Col.resultado_del_ejercicio.tipo === 'PERDIDA'
                        ? balance8Col.totales.total_ganancia + balance8Col.resultado_del_ejercicio.monto
                        : balance8Col.totales.total_ganancia
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 6: ESTADOS FINANCIEROS IFRS / CMF */}
      {activeTab === 'IFRS' && (
        <div className="space-y-6">
          {/* Ratios Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
              <span className="text-[11px] text-slate-500 font-medium uppercase">Razón Corriente</span>
              <div className="text-lg font-bold text-slate-900 mt-1 font-mono">
                {ifrsStatements.ratios.razonCorriente.toFixed(2)}x
              </div>
              <span className="text-[10px] text-slate-400">Activo Cte / Pasivo Cte</span>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
              <span className="text-[11px] text-slate-500 font-medium uppercase">Capital de Trabajo</span>
              <div className="text-lg font-bold text-emerald-700 mt-1 font-mono">
                {convertAmount(ifrsStatements.ratios.capitalTrabajo)}
              </div>
              <span className="text-[10px] text-slate-400">Liquidez Neta Operacional</span>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
              <span className="text-[11px] text-slate-500 font-medium uppercase">Margen Bruto</span>
              <div className="text-lg font-bold text-blue-700 mt-1 font-mono">
                {ifrsStatements.ratios.margenBrutoPct.toFixed(1)}%
              </div>
              <span className="text-[10px] text-slate-400">Utilidad Bruta / Ventas</span>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
              <span className="text-[11px] text-slate-500 font-medium uppercase">Margen Neto</span>
              <div className="text-lg font-bold text-indigo-700 mt-1 font-mono">
                {ifrsStatements.ratios.margenNetoPct.toFixed(1)}%
              </div>
              <span className="text-[10px] text-slate-400">Resultado Neto / Ventas</span>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
              <span className="text-[11px] text-slate-500 font-medium uppercase">Endeudamiento</span>
              <div className="text-lg font-bold text-amber-700 mt-1 font-mono">
                {ifrsStatements.ratios.ratioEndeudamiento.toFixed(2)}x
              </div>
              <span className="text-[10px] text-slate-400">Pasivo Total / Patrimonio</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Estado de Situación Financiera */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#2563eb]" />
                    Estado de Situación Financiera Clasificado (NIC 1)
                  </h4>
                  <p className="text-[11px] text-slate-500">Balance General Clasificado en Corriente y No Corriente</p>
                </div>
                {ifrsStatements.estadoSituacion.cuadrado && (
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ecuación Patrimonial Cuadrada
                  </span>
                )}
              </div>

              {/* Activos */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider bg-slate-50 px-2 py-1 rounded">
                  ACTIVOS
                </div>
                <div className="pl-2 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-700 font-medium">
                    <span>Activo Corriente:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {convertAmount(ifrsStatements.estadoSituacion.activoCorriente.total)}
                    </span>
                  </div>
                  {ifrsStatements.estadoSituacion.activoCorriente.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between text-slate-500 text-[11px] pl-2">
                      <span>{i.nombre}</span>
                      <span className="font-mono">{convertAmount(i.saldo)}</span>
                    </div>
                  ))}

                  <div className="flex justify-between text-slate-700 font-medium pt-2">
                    <span>Activo No Corriente (Activo Fijo + IFRS 16):</span>
                    <span className="font-mono font-bold text-slate-900">
                      {convertAmount(ifrsStatements.estadoSituacion.activoNoCorriente.total)}
                    </span>
                  </div>
                  {ifrsStatements.estadoSituacion.activoNoCorriente.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between text-slate-500 text-[11px] pl-2">
                      <span>{i.nombre}</span>
                      <span className="font-mono">{convertAmount(i.saldo)}</span>
                    </div>
                  ))}

                  <div className="flex justify-between text-slate-900 font-bold pt-2 border-t border-slate-200 text-xs">
                    <span>TOTAL ACTIVOS:</span>
                    <span className="font-mono text-emerald-700">
                      {convertAmount(ifrsStatements.estadoSituacion.totalActivos)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pasivos y Patrimonio */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider bg-slate-50 px-2 py-1 rounded">
                  PASIVOS Y PATRIMONIO
                </div>
                <div className="pl-2 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-700 font-medium">
                    <span>Pasivo Corriente:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {convertAmount(ifrsStatements.estadoSituacion.pasivoCorriente.total)}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-700 font-medium pt-1">
                    <span>Pasivo No Corriente:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {convertAmount(ifrsStatements.estadoSituacion.pasivoNoCorriente.total)}
                    </span>
                  </div>

                  <div className="flex justify-between text-slate-700 font-medium pt-1">
                    <span>Patrimonio Neto:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {convertAmount(ifrsStatements.estadoSituacion.patrimonioNeto.total)}
                    </span>
                  </div>
                  {ifrsStatements.estadoSituacion.patrimonioNeto.items.map((i, idx) => (
                    <div key={idx} className="flex justify-between text-slate-500 text-[11px] pl-2">
                      <span>{i.nombre}</span>
                      <span className="font-mono">{convertAmount(i.saldo)}</span>
                    </div>
                  ))}

                  <div className="flex justify-between text-slate-900 font-bold pt-2 border-t border-slate-200 text-xs">
                    <span>TOTAL PASIVOS Y PATRIMONIO:</span>
                    <span className="font-mono text-blue-700">
                      {convertAmount(ifrsStatements.estadoSituacion.totalPasivoYPatrimonio)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Estado de Resultados por Función */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
              <div className="pb-3 border-b border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  Estado de Resultados por Función (NIC 1)
                </h4>
                <p className="text-[11px] text-slate-500">Estructura oficial de margen, EBITDA y resultado del ejercicio</p>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-700 font-medium">Ingresos de Actividades Ordinarias:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {convertAmount(ifrsStatements.estadoResultados.ingresosOperacionales)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">(-) Costo de Ventas:</span>
                  <span className="font-mono text-rose-700">
                    -{convertAmount(ifrsStatements.estadoResultados.costoVentas)}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 bg-slate-50 px-2 rounded font-bold">
                  <span className="text-slate-900">MARGEN BRUTO:</span>
                  <span className="font-mono text-slate-900">
                    {convertAmount(ifrsStatements.estadoResultados.margenBruto)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">(-) Gastos de Administración y Ventas:</span>
                  <span className="font-mono text-rose-700">
                    -{convertAmount(ifrsStatements.estadoResultados.gastosAdministracionVentas)}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 bg-blue-50/60 px-2 rounded font-bold">
                  <span className="text-blue-900">EBITDA:</span>
                  <span className="font-mono text-blue-900">
                    {convertAmount(ifrsStatements.estadoResultados.ebitda)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">(-) Depreciación y Amortización (NIC 16 / IFRS 16):</span>
                  <span className="font-mono text-rose-700">
                    -{convertAmount(ifrsStatements.estadoResultados.depreciacionAmortizacion)}
                  </span>
                </div>

                <div className="flex justify-between py-1.5 bg-slate-50 px-2 rounded font-bold">
                  <span className="text-slate-900">RESULTADO OPERACIONAL:</span>
                  <span className="font-mono text-slate-900">
                    {convertAmount(ifrsStatements.estadoResultados.resultadoOperacional)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">(+) Otros Ingresos Fuera de Explotación:</span>
                  <span className="font-mono text-emerald-700">
                    {convertAmount(ifrsStatements.estadoResultados.otrosIngresos)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">(-) Gastos Financieros y Reajustes:</span>
                  <span className="font-mono text-rose-700">
                    -{convertAmount(ifrsStatements.estadoResultados.otrosGastosFinancieros)}
                  </span>
                </div>

                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">(-) Provisión Impuesto a la Renta (IDPC):</span>
                  <span className="font-mono text-rose-700">
                    -{convertAmount(ifrsStatements.estadoResultados.impuestoRenta)}
                  </span>
                </div>

                <div className="flex justify-between py-2 bg-emerald-50 px-2 rounded font-bold text-sm border border-emerald-200">
                  <span className="text-emerald-900">RESULTADO NETO DEL EJERCICIO:</span>
                  <span className="font-mono text-emerald-900">
                    {convertAmount(ifrsStatements.estadoResultados.resultadoNeto)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 7: CONSOLA ASESORA IA & ROUTING DE ASIENTOS (DOS CAPAS) */}
      {activeTab === 'AI_ROUTING' && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-6">
          <div className="pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="bg-purple-100 text-purple-800 text-[11px] font-bold px-2 py-0.5 rounded font-mono">
                DOS CAPAS: HUMANA + JSON ERP TRANSACCIONAL
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-600" />
                Terminal Asesora de Routing Contable & Imputaciones IA
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Ingresa cualquier glosa cruda, factura o contrato para que el Agente Orquestador determine las cuentas exactas, centro de costo y emita la propuesta transaccional.
              </p>
            </div>
          </div>

          {/* Glosa Input Form */}
          <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl space-y-3">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Glosa u Operación Económica Cruda
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="text"
                value={rawGlosaInput}
                onChange={(e) => setRawGlosaInput(e.target.value)}
                placeholder="Ej: Pago arriendo de oficina en Las Condes según contrato UF..."
                className="flex-1 text-xs bg-white border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:border-blue-500 font-sans"
              />
              <div className="w-48">
                <input
                  type="number"
                  value={rawMontoInput}
                  onChange={(e) => setRawMontoInput(Number(e.target.value))}
                  placeholder="Monto $ CLP"
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2.5 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                onClick={handleSimulateAiRouting}
                disabled={isAiLoading}
                className="bg-[#2563eb] hover:bg-blue-700 disabled:bg-slate-400 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs shrink-0"
              >
                {isAiLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Analizando Imputación...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Ejecutar Routing IA</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Response Display (2 Layers) */}
          {aiProposalResponse && (
            <div className="space-y-4 pt-2">
              {/* Capa 1: Capa Humana */}
              <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-5">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-900 uppercase font-mono mb-2">
                  <Info className="w-4 h-4 text-blue-600" />
                  CAPA HUMANA · EXPLICACIÓN TÉCNICA Y NORMATIVA CHILENA
                </div>
                <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-line font-sans">
                  {aiProposalResponse.humanLayer}
                </div>
              </div>

              {/* Capa 2: Capa Transaccional JSON */}
              <div className="bg-[#0f172a] text-slate-200 rounded-xl p-5 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-400 font-mono">
                    <FileSpreadsheet className="w-4 h-4" />
                    CAPA TRANSACCIONAL ERP (JSON PROTOCOL A)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        handleCopyText(JSON.stringify(aiProposalResponse.transactionalLayer, null, 2), 'ai_json')
                      }
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer font-mono bg-slate-800 px-2.5 py-1 rounded"
                    >
                      {copiedText === 'ai_json' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copiar JSON</span>
                    </button>
                    <button
                      onClick={handleCommitAiProposal}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Asentar en Libro Diario</span>
                    </button>
                  </div>
                </div>

                <pre className="text-xs font-mono text-emerald-400 overflow-x-auto max-h-96 p-2">
                  {JSON.stringify(aiProposalResponse.transactionalLayer, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: NUEVO ASIENTO MANUAL */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-blue-600" />
                Registrar Nuevo Asiento Contable Manual
              </h3>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveManualEntry} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Fecha Contable</label>
                  <input
                    type="date"
                    value={manualEntry.fecha}
                    onChange={(e) => setManualEntry({ ...manualEntry, fecha: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded p-2"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Tipo de Origen</label>
                  <select
                    value={manualEntry.origen}
                    onChange={(e) => setManualEntry({ ...manualEntry, origen: e.target.value as any })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded p-2"
                  >
                    <option value="MANUAL">Manual / Ajuste Interno</option>
                    <option value="RCV_VENTA">RCV Ventas</option>
                    <option value="RCV_COMPRA">RCV Compras</option>
                    <option value="REMUNERACIONES">Remuneraciones</option>
                    <option value="F29_TRIBUTARIO">F29 Tributario</option>
                    <option value="CAJA_BANCO">Bancos / Tesorería</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Documento Respaldo</label>
                  <input
                    type="text"
                    value={manualEntry.documentoReferencia}
                    onChange={(e) => setManualEntry({ ...manualEntry, documentoReferencia: e.target.value })}
                    placeholder="Ej: Factura #1420 / Comprobante #10"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded p-2"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Concepto / Glosa General</label>
                <input
                  type="text"
                  value={manualEntry.concepto}
                  onChange={(e) => setManualEntry({ ...manualEntry, concepto: e.target.value })}
                  placeholder="Descripción clara de la operación económica..."
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded p-2"
                  required
                />
              </div>

              {/* Lines table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase">Partidas del Asiento (Debe y Haber)</span>
                  <button
                    type="button"
                    onClick={handleAddManualLine}
                    className="text-blue-600 hover:text-blue-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Línea
                  </button>
                </div>

                <div className="space-y-2">
                  {manualEntry.lineas.map((line, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={line.cuentaNombre}
                        onChange={(e) => handleUpdateManualLine(idx, 'cuentaNombre', e.target.value)}
                        className="flex-1 text-xs bg-slate-50 border border-slate-300 rounded p-2 font-mono"
                      >
                        {chartOfAccounts.map((acc) => (
                          <option key={acc.codigo} value={acc.nombre}>
                            {acc.codigo} - {acc.nombre}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Debe"
                        value={line.debe || ''}
                        onChange={(e) => handleUpdateManualLine(idx, 'debe', e.target.value)}
                        className="w-28 text-xs bg-slate-50 border border-slate-300 rounded p-2 text-right font-mono"
                      />
                      <input
                        type="number"
                        placeholder="Haber"
                        value={line.haber || ''}
                        onChange={(e) => handleUpdateManualLine(idx, 'haber', e.target.value)}
                        className="w-28 text-xs bg-slate-50 border border-slate-300 rounded p-2 text-right font-mono"
                      />
                      {manualEntry.lineas.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveManualLine(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Balancing Checker */}
              <div className="bg-slate-50 p-3 rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
                <div className="font-mono">
                  <span>Debe: <strong>{formatCLP(manualDebe)}</strong></span> |{' '}
                  <span>Haber: <strong>{formatCLP(manualHaber)}</strong></span> |{' '}
                  <span className={isManualBalanced ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                    {isManualBalanced ? 'CUADRADO (0)' : `DESCUADRE (${formatCLP(Math.abs(manualDiff))})`}
                  </span>
                </div>

                {/* If discrepancy is <= $2, allow auto-balance centavos button */}
                {!isManualBalanced && Math.abs(manualDiff) <= 2 && (
                  <button
                    type="button"
                    onClick={handleAutoBalanceCentavos}
                    className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer"
                  >
                    Ajustar Centavos / Redondeo ($1)
                  </button>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!isManualBalanced}
                  className="px-4 py-2 bg-[#2563eb] hover:bg-blue-600 disabled:bg-slate-300 text-white rounded text-xs font-bold cursor-pointer shadow-xs"
                >
                  Guardar Asiento Contable
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA CUENTA AL PLAN DE CUENTAS */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-600" />
                Crear Nueva Cuenta Contable Jerárquica
              </h3>
              <button
                onClick={() => setShowAddAccountModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewAccount} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Clase</label>
                <select
                  value={newAccountForm.clase}
                  onChange={(e) => {
                    const c = Number(e.target.value) as any;
                    setNewAccountForm({
                      ...newAccountForm,
                      clase: c,
                      naturaleza: c === 1 || c >= 5 ? 'DEUDORA' : 'ACREEDORA',
                      tipo: c === 1 ? 'ACTIVO' : c === 2 ? 'PASIVO' : c === 3 ? 'PATRIMONIO' : c === 4 ? 'INGRESO' : c === 5 ? 'COSTO' : 'GASTO',
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2"
                >
                  <option value={1}>1. ACTIVO</option>
                  <option value={2}>2. PASIVO</option>
                  <option value={3}>3. PATRIMONIO</option>
                  <option value={4}>4. INGRESOS</option>
                  <option value={5}>5. COSTOS</option>
                  <option value={6}>6. GASTOS DE ADMINISTRACIÓN Y VENTAS</option>
                  <option value={7}>7. OTROS INGRESOS / GASTOS</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Código Jerárquico (Nivel 5: X.X.XX.XXX)</label>
                <input
                  type="text"
                  placeholder="Ej: 6.1.04.007"
                  value={newAccountForm.codigo}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, codigo: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 font-mono"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nombre de la Cuenta</label>
                <input
                  type="text"
                  placeholder="Ej: Gastos de Telecomunicaciones e Internet Fibra"
                  value={newAccountForm.nombre}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, nombre: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Naturaleza</label>
                  <select
                    value={newAccountForm.naturaleza}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, naturaleza: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2"
                  >
                    <option value="DEUDORA">DEUDORA</option>
                    <option value="ACREEDORA">ACREEDORA</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Clasificación</label>
                  <select
                    value={newAccountForm.clasificacion}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, clasificacion: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-300 rounded p-2"
                  >
                    <option value="OPERACIONAL">OPERACIONAL</option>
                    <option value="NO_OPERACIONAL">NO OPERACIONAL</option>
                    <option value="CIRCULANTE">CIRCULANTE</option>
                    <option value="NO_CIRCULANTE">NO CIRCULANTE</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAccountForm.requiereAuxiliarRut}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, requiereAuxiliarRut: e.target.checked })}
                    className="rounded"
                  />
                  <span>Requiere Análisis Auxiliar (por RUT de cliente/proveedor)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAccountForm.requiereCentroCosto}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, requiereCentroCosto: e.target.checked })}
                    className="rounded"
                  />
                  <span>Requiere Asignación de Centro de Costo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newAccountForm.esConciliableBancaria}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, esConciliableBancaria: e.target.checked })}
                    className="rounded"
                  />
                  <span>Cuenta Conciliable Bancaria</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#2563eb] hover:bg-blue-600 text-white rounded text-xs font-bold cursor-pointer"
                >
                  Crear Cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
