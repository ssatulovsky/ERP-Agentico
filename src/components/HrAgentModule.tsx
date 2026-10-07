import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Bot, 
  ShieldCheck, 
  AlertTriangle, 
  FileText, 
  CheckCircle2, 
  Scale, 
  Calculator, 
  Calendar, 
  Download, 
  Copy, 
  Check, 
  Building, 
  Briefcase, 
  DollarSign, 
  Clock, 
  Printer, 
  FileCheck, 
  Send, 
  Plus, 
  Sparkles, 
  Info, 
  UserPlus, 
  ShieldAlert, 
  FileSpreadsheet, 
  Landmark,
  ChevronRight,
  HeartPulse,
  Eye,
  X,
  UserCheck,
  AlertCircle,
  Palmtree,
  Gift,
  FileWarning,
  Trash2,
  Edit2,
  Pencil,
  RefreshCw,
  Search
} from 'lucide-react';
import { 
  EmployeePayroll, 
  LaborContract, 
  MedicalLeave, 
  VacationRecord, 
  VacationRequest,
  HrBenefit, 
  AbsenteeismRecord, 
  DisciplinarySanction,
  HrAgentAlert,
  CompanyProfile, 
  ClientCompany, 
  ChileIndicators, 
  AccountingEntry,
  ErpTechnicalOutputPayload,
  SeveranceCalculation,
  SeveranceCausal,
  CertificateType,
  GeneratedLaborCertificate,
  KarinInvestigationCase
} from '../types';
import { formatCLP, formatNumberCL, calculatePayroll, createPayrollCentralizationEntry } from '../utils/chileanAccounting';
import { 
  validateHrWorkerParameters,
  calculateSeverancePay,
  generateMiDtContractPayload,
  calculateVacationEligibility,
  processMedicalLeaveSalaryDeduction,
  generateLaborCertificate,
  generatePrevired105Fields,
  buildErpTechnicalPayload
} from '../utils/hrCalculations';
import { 
  INITIAL_LABOR_CONTRACTS, 
  INITIAL_MEDICAL_LEAVES, 
  INITIAL_VACATION_RECORDS, 
  INITIAL_HR_BENEFITS, 
  INITIAL_ABSENTEEISM, 
  INITIAL_DISCIPLINARY_SANCTIONS, 
  INITIAL_HR_ALERTS 
} from '../data/seedHrData';
import { AbsenteeismManager } from './hr/AbsenteeismManager';
import { BenefitsManager } from './hr/BenefitsManager';
import { ContractsManager } from './hr/ContractsManager';
import { MedicalLeavesManager } from './hr/MedicalLeavesManager';
import { SanctionsManager } from './hr/SanctionsManager';
import { VacationsManager } from './hr/VacationsManager';

export type HrSubTab =
  | 'collaborators'
  | 'contracts'
  | 'absenteeism'
  | 'medical_leaves'
  | 'vacations'
  | 'benefits'
  | 'sanctions'
  | 'severance'
  | 'karin'
  | 'certificates'
  | 'legal_books'
  | 'console';

interface HrAgentModuleProps {
  company: CompanyProfile;
  activeClient: ClientCompany;
  clients: ClientCompany[];
  onSelectClient: (clientId: string) => void;
  payrolls: EmployeePayroll[];
  onUpdateEmployee: (emp: EmployeePayroll) => void;
  onAddEmployee: (emp: EmployeePayroll) => void;
  onDeleteEmployee?: (empId: string) => void;
  indicators: ChileIndicators;
  onAddAccountingEntry: (entry: AccountingEntry) => void;
  contracts?: LaborContract[];
  onAddContract?: (contract: LaborContract) => void;
  onUpdateContract?: (contract: LaborContract) => void;
  medicalLeaves?: MedicalLeave[];
  onAddMedicalLeave?: (leave: MedicalLeave) => void;
  onUpdateMedicalLeave?: (leave: MedicalLeave) => void;
  vacations?: VacationRecord[];
  onAddVacationRequest?: (employeeId: string, req: VacationRequest) => void;
  onApproveVacationRequest?: (employeeId: string, reqId: string) => void;
  absenteeismList?: AbsenteeismRecord[];
  onAddAbsenteeismRecord?: (record: AbsenteeismRecord) => void;
  benefits?: HrBenefit[];
  onAddBenefit?: (benefit: HrBenefit) => void;
  onToggleBenefit?: (benefitId: string) => void;
  sanctions?: DisciplinarySanction[];
  onAddSanction?: (sanction: DisciplinarySanction) => void;
  onUpdateSanction?: (sanction: DisciplinarySanction) => void;
  karinCases?: KarinInvestigationCase[];
  onAddKarinCase?: (caseItem: KarinInvestigationCase) => void;
  onUpdateKarinCase?: (caseItem: KarinInvestigationCase) => void;
}

export const HrAgentModule: React.FC<HrAgentModuleProps> = ({
  company,
  activeClient,
  clients,
  onSelectClient,
  payrolls = [],
  onUpdateEmployee,
  onAddEmployee,
  onDeleteEmployee,
  indicators,
  onAddAccountingEntry,
  contracts,
  onAddContract,
  onUpdateContract,
  medicalLeaves,
  onAddMedicalLeave,
  onUpdateMedicalLeave,
  vacations,
  onAddVacationRequest,
  onApproveVacationRequest,
  absenteeismList,
  onAddAbsenteeismRecord,
  benefits,
  onAddBenefit,
  onToggleBenefit,
  sanctions,
  onAddSanction,
  onUpdateSanction,
  karinCases,
  onAddKarinCase,
  onUpdateKarinCase,
}) => {
  // Navigation Tabs inside HR Agent Module
  const [activeSubTab, setActiveSubTab] = useState<HrSubTab>('collaborators');

  // Multi-Company Active State
  const activeEmpresaId = activeClient.id || company.id;

  // Local state fallbacks for HR documents and records
  const [localContracts, setLocalContracts] = useState<LaborContract[]>(INITIAL_LABOR_CONTRACTS);
  const [localMedicalLeaves, setLocalMedicalLeaves] = useState<MedicalLeave[]>(INITIAL_MEDICAL_LEAVES);
  const [localVacations, setLocalVacations] = useState<VacationRecord[]>(INITIAL_VACATION_RECORDS);
  const [localAbsenteeism, setLocalAbsenteeism] = useState<AbsenteeismRecord[]>(INITIAL_ABSENTEEISM);
  const [localBenefits, setLocalBenefits] = useState<HrBenefit[]>(INITIAL_HR_BENEFITS);
  const [localSanctions, setLocalSanctions] = useState<DisciplinarySanction[]>(INITIAL_DISCIPLINARY_SANCTIONS);
  const [alerts, setAlerts] = useState<HrAgentAlert[]>(INITIAL_HR_ALERTS);

  // Ley Karin Cases State
  const [localKarinCases, setLocalKarinCases] = useState<KarinInvestigationCase[]>([
    {
      id: 'karin-01',
      empresaId: activeEmpresaId,
      folioCaso: 'KARIN-2026-004',
      fechaDenuncia: '2026-08-20',
      tipoAcoso: 'ACOSO_LABORAL',
      denuncianteRutAnonimizado: '18.***.***-2',
      denunciadoCargo: 'Jefatura de Turno Logístico',
      estado: 'INVESTIGACION_INTERNA',
      medidasDeResguardo: 'Separación inmediata de turnos y cambio de dependencia física preventiva.',
      plazoLegalDias: 30,
      fechaLimiteInforme: '2026-09-19',
      responsableInvestigacion: 'Comité Paritario & Oficial de Cumplimiento RRHH',
      conclusionesYAcciones: 'Entrevistas de testigos en curso bajo estricta confidencialidad según Ley 21.643.',
    }
  ]);

  const activeContracts = contracts ?? localContracts;
  const activeMedicalLeaves = medicalLeaves ?? localMedicalLeaves;
  const activeVacations = vacations ?? localVacations;
  const activeAbsenteeism = absenteeismList ?? localAbsenteeism;
  const activeBenefits = benefits ?? localBenefits;
  const activeSanctions = sanctions ?? localSanctions;
  const activeKarinCases = karinCases ?? localKarinCases;

  // Modals & UI States
  const [showAddCollabModal, setShowAddCollabModal] = useState(false);
  const [showEditCollabModal, setShowEditCollabModal] = useState<EmployeePayroll | null>(null);
  const [editCollabForm, setEditCollabForm] = useState<Partial<EmployeePayroll>>({});
  const [collabSearch, setCollabSearch] = useState('');
  const [showAddKarinModal, setShowAddKarinModal] = useState(false);

  // New Collaborator Form Data
  const [newCollabForm, setNewCollabForm] = useState<Partial<EmployeePayroll>>({
    nombreCompleto: '',
    rut: '',
    cargo: '',
    departamento: 'Operaciones',
    fechaIngreso: new Date().toISOString().split('T')[0],
    tipoContrato: 'INDEFINIDO',
    sueldoBase: 1200000,
    gratificacionModalidad: 'ART_50',
    asignacionColacion: 80000,
    asignacionMovilizacion: 70000,
    afpNombre: 'HABITAT',
    saludTipo: 'FONASA',
    saludPlanUf: 0,
    otrosDescuentos: 0,
    horasExtrasCantidad: 0,
    comisionesBonosImponibles: 0
  });

  // New Karin Report Form Data
  const [newKarinForm, setNewKarinForm] = useState<Partial<KarinInvestigationCase>>({
    tipoAcoso: 'ACOSO_LABORAL',
    denuncianteRutAnonimizado: '',
    denunciadoCargo: '',
    medidasDeResguardo: 'Separación preventiva de turnos y dependencias físicas inmediatas.',
    responsableInvestigacion: 'Comité Paritario & Oficial de Cumplimiento RRHH',
    conclusionesYAcciones: 'Investigación preliminar aperturada bajo reserva legal.'
  });

  // Selected entities for modals and inspectors
  const [selectedContractForDt, setSelectedContractForDt] = useState<LaborContract | null>(null);
  const [selectedSeverance, setSelectedSeverance] = useState<SeveranceCalculation | null>(null);
  const [selectedCertificate, setSelectedCertificate] = useState<GeneratedLaborCertificate | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  // Finiquito Simulator State
  const [finiquitoRut, setFiniquitoRut] = useState<string>(payrolls[0]?.rut || '14.892.301-2');
  const [finiquitoCausal, setFiniquitoCausal] = useState<SeveranceCausal>('ART_161_NECESIDADES_DE_LA_EMPRESA');
  const [finiquitoFechaDespido, setFiniquitoFechaDespido] = useState<string>(new Date().toISOString().split('T')[0]);
  const [finiquitoDiasPreaviso, setFiniquitoDiasPreaviso] = useState<number>(0);
  const [finiquitoDiasVacaciones, setFiniquitoDiasVacaciones] = useState<number>(14.5);
  const [finiquitoCalculado, setFiniquitoCalculado] = useState<SeveranceCalculation | null>(null);

  // Certificate Form State
  const [certEmployeeRut, setCertEmployeeRut] = useState<string>(payrolls[0]?.rut || '14.892.301-2');
  const [certType, setCertType] = useState<CertificateType>('ANTIGUEDAD');

  // Agent Interactive Console Chat State
  const [agentQuery, setAgentQuery] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<Array<{
    sender: 'user' | 'agent';
    text: string;
    timestamp: string;
    payload?: ErpTechnicalOutputPayload;
    requiresParams?: string[];
  }>>([
    {
      sender: 'agent',
      text: `Hola, soy el **Agente de Administración y Gestión de Personas / RRHH** para **${activeClient.razonSocial}** (RUT: ${activeClient.rut}).\n\nEstoy configurado con los parámetros activos de la empresa:\n- **Mutualidad:** ${activeClient.mutualidad || 'Mutual de Seguridad CChC'}\n- **Tasa SIS:** 1.49% (cargo empleador)\n- **CCAF:** Caja Los Andes\n- **Jornada:** Ley 40 Horas / 42 hrs vigentes (2026)\n\n¿Qué gestión del ciclo laboral deseas validar, calcular o emitir?`,
      timestamp: 'Ahora',
    }
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handlers bridging to App level or local state
  const handleAddContract = (contract: LaborContract) => {
    if (onAddContract) onAddContract(contract);
    else setLocalContracts(prev => [contract, ...prev]);
    showToast(`Contrato ${contract.folioRegistroDt || contract.id} registrado para MiDT.`);
  };

  const handleUpdateContract = (contract: LaborContract) => {
    if (onUpdateContract) onUpdateContract(contract);
    else setLocalContracts(prev => prev.map(c => c.id === contract.id ? contract : c));
    showToast(`Contrato actualizado.`);
  };

  const handleAddMedicalLeave = (leave: MedicalLeave) => {
    if (onAddMedicalLeave) onAddMedicalLeave(leave);
    else setLocalMedicalLeaves(prev => [leave, ...prev]);
    showToast(`Licencia Médica Folio ${leave.folioLicencia} ingresada.`);
  };

  const handleUpdateMedicalLeave = (leave: MedicalLeave) => {
    if (onUpdateMedicalLeave) onUpdateMedicalLeave(leave);
    else setLocalMedicalLeaves(prev => prev.map(l => l.id === leave.id ? leave : l));
    showToast(`Licencia Médica actualizada.`);
  };

  const handleAddVacationRequest = (empId: string, req: VacationRequest) => {
    if (onAddVacationRequest) onAddVacationRequest(empId, req);
    else {
      setLocalVacations(prev => prev.map(v => v.employeeId === empId ? { ...v, solicitudes: [req, ...(v.solicitudes || [])] } : v));
    }
    showToast(`Solicitud de feriado legal registrada (${req.diasHabilesTomados} días hábiles).`);
  };

  const handleApproveVacationRequest = (empId: string, reqId: string) => {
    if (onApproveVacationRequest) onApproveVacationRequest(empId, reqId);
    else {
      setLocalVacations(prev => prev.map(v => {
        if (v.employeeId === empId) {
          const r = (v.solicitudes || []).find(s => s.id === reqId);
          const d = r ? r.diasHabilesTomados : 0;
          return {
            ...v,
            diasTomadosHistorico: (v.diasTomadosHistorico || 0) + d,
            diasDisponibles: Math.max(0, v.diasDisponibles - d),
            solicitudes: (v.solicitudes || []).map(s => s.id === reqId ? { ...s, estado: 'AUTORIZADA_RRHH' as const } : s)
          };
        }
        return v;
      }));
    }
    showToast(`Feriado legal aprobado y comprobante emitido.`);
  };

  const handleAddAbsenteeismRecord = (rec: AbsenteeismRecord) => {
    if (onAddAbsenteeismRecord) onAddAbsenteeismRecord(rec);
    else setLocalAbsenteeism(prev => [rec, ...prev]);
    showToast(`Novedad de asistencia registrada (${rec.tipo}).`);
  };

  const handleAddBenefit = (b: HrBenefit) => {
    if (onAddBenefit) onAddBenefit(b);
    else setLocalBenefits(prev => [b, ...prev]);
    showToast(`Bono/Beneficio "${b.nombre}" creado.`);
  };

  const handleToggleBenefit = (id: string) => {
    if (onToggleBenefit) onToggleBenefit(id);
    else setLocalBenefits(prev => prev.map(b => b.id === id ? { ...b, activo: !b.activo } : b));
    showToast(`Estado del beneficio modificado.`);
  };

  const handleAddSanction = (s: DisciplinarySanction) => {
    if (onAddSanction) onAddSanction(s);
    else setLocalSanctions(prev => [s, ...prev]);
    showToast(`Medida disciplinaria ${s.folioConstanciaDt || s.id} registrada.`);
  };

  const handleUpdateSanction = (s: DisciplinarySanction) => {
    if (onUpdateSanction) onUpdateSanction(s);
    else setLocalSanctions(prev => prev.map(item => item.id === s.id ? s : item));
    showToast(`Sanción actualizada.`);
  };

  const handleAddKarinCaseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newCase: KarinInvestigationCase = {
      id: `karin-${Date.now()}`,
      empresaId: activeEmpresaId,
      folioCaso: `KARIN-2026-${String(activeKarinCases.length + 1).padStart(3, '0')}`,
      fechaDenuncia: new Date().toISOString().split('T')[0],
      tipoAcoso: newKarinForm.tipoAcoso || 'ACOSO_LABORAL',
      denuncianteRutAnonimizado: newKarinForm.denuncianteRutAnonimizado || 'ANONIMO',
      denunciadoCargo: newKarinForm.denunciadoCargo || 'Por Determinar',
      estado: 'INVESTIGACION_INTERNA',
      medidasDeResguardo: newKarinForm.medidasDeResguardo || 'Separación preventiva de turnos.',
      plazoLegalDias: 30,
      fechaLimiteInforme: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      responsableInvestigacion: newKarinForm.responsableInvestigacion || 'Comité Paritario',
      conclusionesYAcciones: newKarinForm.conclusionesYAcciones || 'En investigación bajo reserva.'
    };

    if (onAddKarinCase) onAddKarinCase(newCase);
    else setLocalKarinCases(prev => [newCase, ...prev]);

    setShowAddKarinModal(false);
    showToast(`Denuncia Ley Karin Folio ${newCase.folioCaso} ingresada bajo reserva legal.`);
  };

  // Submit new collaborator from modal
  const handleCreateCollaboratorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollabForm.nombreCompleto || !newCollabForm.rut) {
      showToast('Debe ingresar al menos Nombre y RUT válido.');
      return;
    }

    const calculated = calculatePayroll(
      {
        ...newCollabForm,
        id: `emp-${Date.now()}`,
      } as EmployeePayroll,
      indicators
    );

    onAddEmployee(calculated);

    // Auto-create initial labor contract
    const newContract: LaborContract = {
      id: `ctr-${Date.now()}`,
      employeeId: calculated.id,
      rut: calculated.rut,
      nombreCompleto: calculated.nombreCompleto,
      nacionalidad: 'Chilena',
      estadoCivil: 'Soltero(a)',
      fechaNacimiento: '1990-01-01',
      domicilio: 'Av. Costanera 1420',
      comuna: 'Puerto Montt',
      cargo: calculated.cargo,
      departamento: calculated.departamento,
      tipoContrato: calculated.tipoContrato === 'INDEFINIDO' ? 'INDEFINIDO' : 'PLAZO_FIJO',
      fechaInicio: calculated.fechaIngreso,
      sueldoBase: calculated.sueldoBase,
      jornadaHorasSemanales: 42,
      distribucionJornada: 'Lunes a Viernes de 08:30 a 17:30 hrs',
      lugarTrabajo: 'Planta de Procesos & Taller de Redes',
      gratificacionModalidad: (calculated.gratificacionModalidad === 'ART_47' ? 'ART_47' : calculated.gratificacionModalidad === 'ART_50' ? 'ART_50' : 'CONVENCIONAL') as any,
      asignacionColacion: calculated.asignacionColacion || 0,
      asignacionMovilizacion: calculated.asignacionMovilizacion || 0,
      estado: 'VIGENTE',
      registradoDtRel: true,
      folioRegistroDt: `DT-2026-${Math.floor(100000 + Math.random() * 900000)}`,
      anexos: [],
      clausulaConfidencialidad: true,
      clausulaTeletrabajo: false,
      observaciones: 'Contrato registrado con firma electrónica MiDT'
    };
    handleAddContract(newContract);

    // Initialize vacation balance
    const newVacation: VacationRecord = {
      id: `vac-${Date.now()}`,
      employeeId: calculated.id,
      nombreCompleto: calculated.nombreCompleto,
      rut: calculated.rut,
      fechaIngreso: calculated.fechaIngreso,
      antiguedadAnos: 0,
      diasLegalesPorAno: 15,
      diasProgresivos: 0,
      diasAcumuladosTotales: 15,
      diasTomadosHistorico: 0,
      diasDisponibles: 15,
      periodosPendientes: 1,
      alertaExcesoPeriodosArt70: false,
      solicitudes: []
    };
    if (onAddVacationRequest) {
      // Vacation record is in vacations array
    } else {
      setLocalVacations(prev => [newVacation, ...prev]);
    }

    setShowAddCollabModal(false);
    showToast(`Colaborador ${calculated.nombreCompleto} registrado con éxito. Contrato MiDT y ficha creados.`);
  };

  // Open Edit Collaborator Modal (M de ABM)
  const handleOpenEditCollabModal = (emp: EmployeePayroll) => {
    setEditCollabForm({ ...emp });
    setShowEditCollabModal(emp);
  };

  // Submit Edit Collaborator (M de ABM)
  const handleEditCollaboratorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditCollabModal || !editCollabForm.nombreCompleto) {
      showToast('El nombre del colaborador es obligatorio.');
      return;
    }

    const merged: EmployeePayroll = {
      ...showEditCollabModal,
      ...editCollabForm,
    } as EmployeePayroll;

    const recalculated = calculatePayroll(merged, indicators);
    onUpdateEmployee(recalculated);
    setShowEditCollabModal(null);
    showToast(`Ficha de ${recalculated.nombreCompleto} (${recalculated.rut}) actualizada y liquidación recalculada.`);
  };

  // Copy to clipboard helper
  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  // Handle Finiquito Calculation
  const handleRunFiniquito = () => {
    const emp = payrolls.find(p => p.rut === finiquitoRut) || payrolls[0];
    if (!emp) return;

    // Validate parameters
    const check = validateHrWorkerParameters({
      empresaId: activeEmpresaId,
      rut: emp.rut,
      tipoContrato: emp.tipoContrato,
      fechaIngreso: emp.fechaIngreso,
    });

    if (!check.valid) {
      showToast(`Faltan parámetros: ${check.missingFields.join(', ')}`);
      return;
    }

    const calc = calculateSeverancePay({
      empresaId: activeEmpresaId,
      rut: emp.rut,
      nombreCompleto: emp.nombreCompleto,
      cargo: emp.cargo,
      fechaIngreso: emp.fechaIngreso,
      fechaDespido: finiquitoFechaDespido,
      causal: finiquitoCausal,
      sueldoBase: emp.sueldoBase,
      promedioGratificacion: emp.gratificacionMonto,
      promedioVariables: emp.comisionesBonosImponibles + emp.horasExtrasMonto,
      asignacionesNoImponibles: emp.totalHaberesNoImponibles,
      diasAvisoPrevioOtorgados: finiquitoDiasPreaviso,
      diasVacacionesPendientes: finiquitoDiasVacaciones,
      ufValue: indicators.uf,
    });

    setFiniquitoCalculado(calc);
    setSelectedSeverance(calc);
    showToast('Finiquito calculado con éxito bajo normas Art. 159/160/161 del Código del Trabajo.');
  };

  // Handle Certificate Generation
  const handleGenerateCertificate = () => {
    const emp = payrolls.find(p => p.rut === certEmployeeRut) || payrolls[0];
    if (!emp) return;

    const cert = generateLaborCertificate(certType, emp, activeClient);
    setSelectedCertificate(cert);
    showToast(`Certificado de ${certType} generado con firma digital verificable.`);
  };

  // Handle Integrating Technical ERP Accounting Entry into General Ledger
  const handleCommitAccountingEntry = (entryLines: Array<{ cuenta: string; debe: number; haber: number }>, concepto: string) => {
    const totalDebe = entryLines.reduce((s, l) => s + l.debe, 0);
    const totalHaber = entryLines.reduce((s, l) => s + l.haber, 0);

    const newEntry: AccountingEntry = {
      id: `entry-hr-${Date.now()}`,
      fecha: new Date().toISOString().split('T')[0],
      concepto: `Centralización RRHH (${activeClient.nombreCorto}): ${concepto}`,
      documento: `DOC-RRHH-${Date.now().toString().slice(-6)}`,
      totalDebe,
      totalHaber,
      balanceado: Math.abs(totalDebe - totalHaber) < 5,
      origen: 'REMUNERACIONES',
      creadoEn: new Date().toISOString(),
      lineas: entryLines.map((line, idx) => ({
        cuentaCodigo: `2.1.${(idx + 1).toString().padStart(2, '0')}`,
        cuentaNombre: line.cuenta,
        debe: line.debe,
        haber: line.haber,
      })),
    };

    onAddAccountingEntry(newEntry);
    showToast(`¡Asiento contable integrado exitosamente en el Libro Diario del ERP! (${formatCLP(totalDebe)})`);
  };

  // Agent Chat Processor
  const handleSendAgentQuery = (customPrompt?: string) => {
    const query = customPrompt || agentQuery;
    if (!query.trim()) return;

    const userMsg = {
      sender: 'user' as const,
      text: query,
      timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages(prev => [...prev, userMsg]);
    setAgentQuery('');

    // Simulate Agent autonomous legal reasoning
    setTimeout(() => {
      const qLower = query.toLowerCase();
      const currentPeriod = new Date().toISOString().substring(0, 7);
      const emp = payrolls[0];

      let replyText = '';
      let payload: ErpTechnicalOutputPayload | undefined = undefined;

      if (qLower.includes('finiquito') || qLower.includes('art 161') || qLower.includes('indemniz')) {
        const fin = calculateSeverancePay({
          empresaId: activeEmpresaId,
          rut: emp.rut,
          nombreCompleto: emp.nombreCompleto,
          cargo: emp.cargo,
          fechaIngreso: emp.fechaIngreso,
          fechaDespido: new Date().toISOString().split('T')[0],
          causal: 'ART_161_NECESIDADES_DE_LA_EMPRESA',
          sueldoBase: emp.sueldoBase,
          promedioGratificacion: emp.gratificacionMonto,
          promedioVariables: 0,
          asignacionesNoImponibles: emp.totalHaberesNoImponibles,
          diasAvisoPrevioOtorgados: 0,
          diasVacacionesPendientes: 14.5,
          ufValue: indicators.uf,
        });

        replyText = `### Dictamen Legal y Liquidación de Finiquito (Art. 161 Código del Trabajo)\n\nSe ha procesado el cálculo formal de término de contrato por **Necesidades de la Empresa** para don(ña) **${emp.nombreCompleto}** (RUT: ${emp.rut}) bajo el contexto de **${activeClient.razonSocial}**:\n\n- **Antigüedad Computable:** ${fin.aniosComputables} años de servicio.\n- **Base Mensual Computable:** ${formatCLP(fin.remuneracionMensualComputable)} (respetando el tope legal de 90 UF: ${formatCLP(90 * indicators.uf)}).\n- **Indemnización Años de Servicio (Art. 163):** ${formatCLP(fin.indemnizacionAnosServicio)}.\n- **Indemnización Sustitutiva de Aviso Previo (Art. 161 inc. 2):** ${formatCLP(fin.indemnizacionAvisoPrevio)} (al no otorgarse 30 días de preaviso).\n- **Feriado Legal Proporcional (Art. 73):** ${formatCLP(fin.montoFeriadoProporcional)} (${fin.diasFeriadoPendienteProporcional} días hábiles).\n- **Imputación Aporte AFC Empleador (Art. 13 Ley 19.728):** -${formatCLP(fin.descuentoAporteAfcEmpleador)}.\n\n**Total Líquido a Pagar en Finiquito:** **${formatCLP(fin.totalFiniquitoLiquido)}**.\n\nA continuación se adjunta la transacción técnica normalizada para integración contable en el ERP:`;

        payload = buildErpTechnicalPayload({
          empresaId: activeEmpresaId,
          modulo: 'finiquitos',
          accion: 'calcular_finiquito',
          periodo: currentPeriod,
          payroll: emp,
          detallesAdicionales: {
            causal: 'ART_161_NECESIDADES_DE_LA_EMPRESA',
            indemnizacion_anos_servicio: fin.indemnizacionAnosServicio,
            indemnizacion_aviso_previo: fin.indemnizacionAvisoPrevio,
            feriado_proporcional: fin.montoFeriadoProporcional,
            liquido_finiquito: fin.totalFiniquitoLiquido,
          },
        });
        // Override technical payload accounting entry with finiquito entry
        payload.asiento_contable = fin.asientoContable || payload.asiento_contable;

      } else if (qLower.includes('contrato') || qLower.includes('40 horas') || qLower.includes('art 10')) {
        replyText = `### Validación y Redacción de Contrato de Trabajo (Art. 10 CT & Ley 40 Horas)\n\nSe valida la estructura obligatoria de contrato individual para **${emp.nombreCompleto}** en **${activeClient.razonSocial}**:\n\n1. **Cláusulas del Art. 10:** Se verifican los 7 numerales legales (individualización, funciones, lugar de servicios, remuneración y período, duración de jornada, plazo de contrato y estipulaciones pactadas).\n2. **Ley de 40 Horas (Ley 21.561):** La jornada pactada de **40 horas semanales** cumple anticipadamente con el cronograma legal (vigencia de 42 horas en abril 2026 y 40 horas en 2028). Distribución en 5 días (lunes a viernes).\n3. **Excepción Art. 22 inciso 2:** Se verifica que el cargo no está sujeto a fiscalización superior inmediata solo en caso de gerencia. Para cargos operativos se mantiene registro de asistencia digital acreditado por la DT.\n4. **Plazo de Registro MiDT:** Debe inscribirse en el Portal MiDT dentro de los 15 días corridos desde el inicio de faena.`;

        payload = buildErpTechnicalPayload({
          empresaId: activeEmpresaId,
          modulo: 'contratos',
          accion: 'generar_contrato',
          periodo: currentPeriod,
          payroll: emp,
          detallesAdicionales: {
            tipo_contrato: emp.tipoContrato,
            jornada_horas: 40,
            ley_40_horas_cumplimiento: true,
            registro_dt_plazo_dias: 15,
          },
        });

      } else if (qLower.includes('vacaciones') || qLower.includes('art 70') || qLower.includes('progresivo')) {
        const vacCheck = calculateVacationEligibility({
          fechaIngreso: emp.fechaIngreso,
          totalAnosCotizadosSistema: 12,
          diasPendientesHistoricos: 22,
        });

        replyText = `### Auditoría de Feriado Anual y Alerta Legal Art. 70\n\nAnálisis de cumplimiento para **${emp.nombreCompleto}**:\n\n- **Feriado Legal Anual (Art. 67):** 15 días hábiles (sábado considerado inhábil según Art. 69).\n- **Feriado Progresivo (Art. 68):** Acredita 12 años cotizados en el sistema previsional y más de 3 años continuos en ${activeClient.razonSocial}. Le corresponden **+${vacCheck.diasProgresivos} día(s) hábil(es) progresivo(s)**.\n- **Saldo Acumulado Total:** ${vacCheck.diasDisponiblesTotal} días hábiles disponibles (${vacCheck.periodosAcumulados} períodos).\n\n⚠️ **${vacCheck.infraccionArt70 ? 'INFRACCIÓN DETECTADA ART. 70 CÓDIGO DEL TRABAJO' : 'CUMPLIMIENTO NORMAL'}**: ${vacCheck.alertaMensaje || 'Dentro de los límites legales permitidos.'}`;

        payload = buildErpTechnicalPayload({
          empresaId: activeEmpresaId,
          modulo: 'ausentismos',
          accion: 'registrar_licencia',
          periodo: currentPeriod,
          payroll: emp,
          detallesAdicionales: {
            dias_disponibles_vacaciones: vacCheck.diasDisponiblesTotal,
            alerta_art_70: vacCheck.infraccionArt70,
          },
        });

      } else if (qLower.includes('karin') || qLower.includes('acoso') || qLower.includes('convivencia')) {
        replyText = `### Protocolo Preventivo de Convivencia Laboral (Ley Karin N° 21.643)\n\nEl sistema mantiene activo el protocolo obligatorio de prevención, investigación y sanción del acoso laboral, sexual y violencia en el trabajo para **${activeClient.razonSocial}**:\n\n1. **Canal de Denuncias:** Activo y garantizando confidencialidad e imparcialidad.\n2. **Medidas de Resguardo Inmediatas:** Ante cualquier denuncia, el empleador debe adoptar medidas inmediatas (ej: separación de espacios físicos o redistribución de turnos) en un plazo máximo de 24 horas.\n3. **Plazo de Investigación:** La investigación interna o remisión a la Dirección del Trabajo (DT) no puede exceder los 30 días corridos.\n4. **Actualización RIOHS:** Se constata la entrega formal del anexo de la Ley Karin a toda la dotación activa.`;

        payload = buildErpTechnicalPayload({
          empresaId: activeEmpresaId,
          modulo: 'ley_karin',
          accion: 'registrar_licencia',
          periodo: currentPeriod,
          payroll: emp,
          detallesAdicionales: {
            normativa: 'Ley Karin N° 21.643',
            canal_denuncias_activo: true,
            casos_en_investigacion: karinCases.length,
          },
        });

      } else if (qLower.includes('previred') || qLower.includes('105') || qLower.includes('lre') || qLower.includes('libro')) {
        const previred = generatePrevired105Fields(payrolls, activeClient, currentPeriod);
        replyText = `### Generación de Libro de Remuneraciones Electrónico (LRE) & Archivo Previred 105 Campos\n\nSe han estructurado los archivos oficiales para **${activeClient.razonSocial}** (Período: ${currentPeriod}):\n\n- **Total Cotizantes Procesados:** ${previred.totalCotizantes} colaboradores.\n- **Total Imposiciones Previsionales PREVIRED:** **${formatCLP(previred.totalMontoPrevired)}**.\n  - Cotizaciones AFP: ${formatCLP(previred.resumenEntidades.afpMonto)}\n  - Salud (Fonasa/Isapres): ${formatCLP(previred.resumenEntidades.fonasaMonto + previred.resumenEntidades.isapreMonto)}\n  - Seguro Cesantía (AFC Trabajador + Empleador): ${formatCLP(previred.resumenEntidades.afcTrabajadorMonto + previred.resumenEntidades.afcEmpleadorMonto)}\n  - SIS (1.49%): ${formatCLP(previred.resumenEntidades.sisMonto)}\n  - Mutualidad Ley 16.744 (${activeClient.mutualidad || 'Mutual'}): ${formatCLP(previred.resumenEntidades.mutualMonto)}\n\nEl archivo cumple con el layout de 105 campos para carga masiva y el layout CSV de la Dirección del Trabajo (códigos 1000 a 5000).`;

        payload = buildErpTechnicalPayload({
          empresaId: activeEmpresaId,
          modulo: 'remuneraciones',
          accion: 'generar_previred',
          periodo: currentPeriod,
          payroll: emp,
          detallesAdicionales: {
            total_previred_pesos: previred.totalMontoPrevired,
            campos_previred_layout: 105,
          },
        });

      } else {
        // Default Payroll Calculation & Centralization
        replyText = `### Liquidación Mensual y Cumplimiento Normativo de Nómina\n\nSe procesó el motor de remuneraciones del colaborador **${emp.nombreCompleto}** en **${activeClient.razonSocial}**:\n\n1. **Haberes Imponibles:** Sueldo Base (${formatCLP(emp.sueldoBase)}) + Gratificación Art. 50 tope 4.75 IMM (${formatCLP(emp.gratificacionMonto)}) = **${formatCLP(emp.totalHaberesImponibles)}**.\n2. **Haberes No Imponibles:** Colación (${formatCLP(emp.asignacionColacion)}) + Movilización (${formatCLP(emp.asignacionMovilizacion)}) = **${formatCLP(emp.totalHaberesNoImponibles)}**.\n3. **Descuentos Previsionales:** AFP ${emp.afpNombre} (${formatCLP(emp.afpMonto)}) + Salud ${emp.saludTipo} (${formatCLP(emp.saludMonto)}) + AFC (${formatCLP(emp.afcTrabajadorMonto)}) = **${formatCLP(emp.afpMonto + emp.saludMonto + emp.afcTrabajadorMonto)}**.\n4. **Impuesto Único Segunda Categoría:** **${formatCLP(emp.impuestoUnicoMonto)}** (calculado sobre base tributable en UTM según tabla SII).\n5. **Sueldo Líquido a Transferir:** **${formatCLP(emp.sueldoLiquido)}**.\n6. **Costo Total Empresa:** **${formatCLP(emp.costoTotalEmpresa)}** (incluye SIS 1.49%, Mutual y AFC patronal).\n\nTransacción técnica generada en formato JSON normalizado:`;

        payload = buildErpTechnicalPayload({
          empresaId: activeEmpresaId,
          modulo: 'remuneraciones',
          accion: 'crear_liquidacion',
          periodo: currentPeriod,
          payroll: emp,
        });
      }

      setChatMessages(prev => [
        ...prev,
        {
          sender: 'agent',
          text: replyText,
          timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
          payload,
        }
      ]);
    }, 600);
  };

  // Quick Action triggers for Agent
  const quickActions = [
    { label: 'Simular Finiquito Art. 161', query: 'Simular finiquito por necesidades de la empresa Art. 161 para un trabajador con 3 años de antigüedad' },
    { label: 'Generar Contrato 40 Horas', query: 'Validar contrato individual indefinido bajo Ley 40 Horas con cláusulas del Art. 10' },
    { label: 'Planilla Previred 105 Campos', query: 'Generar estructura de pago previsional Previred de 105 campos para el mes activo' },
    { label: 'Auditar Vacaciones Art. 70', query: 'Auditar cumplimiento de vacaciones y feriado progresivo bajo Art. 67 y Art. 70' },
    { label: 'Protocolo Ley Karin', query: 'Consultar estado del protocolo de prevención de acoso laboral bajo la Ley Karin 21.643' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner: Contexto Operativo & Multi-Empresa ERP */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 bg-blue-600 text-white rounded-lg shadow-sm">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  Agente de Administración y Gestión de Personas / RRHH
                </h2>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 uppercase tracking-wide">
                  Autónomo & Legal 100% Chile
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Garantiza el cumplimiento normativo ante Dirección del Trabajo (DT), PREVIRED, SUSESO y SII.
              </p>
            </div>
          </div>

          {/* Multi-Company Context Selector */}
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-50 border border-slate-200 p-2 rounded-lg">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold px-2">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <span>Empresa Activa:</span>
            </div>
            <select
              value={activeClient.id}
              onChange={(e) => onSelectClient(e.target.value)}
              className="bg-white border border-slate-300 text-slate-800 text-xs rounded-md px-3 py-1.5 font-bold shadow-2xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden cursor-pointer"
            >
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombreCorto} ({c.rut})
                </option>
              ))}
            </select>
            <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500 border-l border-slate-200 pl-3">
              <span>Mutual: <strong className="text-slate-700">{activeClient.mutualidad || 'Mutual CChC'}</strong></span>
              <span>•</span>
              <span>SIS: <strong className="text-slate-700">1.49%</strong></span>
              <span>•</span>
              <span>CCAF: <strong className="text-slate-700">Caja Los Andes</strong></span>
            </div>
          </div>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-1.5 border-t border-slate-100 mt-4 pt-3 overflow-x-auto pb-1">
          {[
            { id: 'collaborators', label: '1. Ficha Colaboradores', icon: Users, count: payrolls.length },
            { id: 'contracts', label: '2. Contratos MiDT', icon: FileCheck, count: activeContracts.length },
            { id: 'absenteeism', label: '3. Asistencia & Atrasos', icon: Clock, count: activeAbsenteeism.length },
            { id: 'medical_leaves', label: '4. Licencias Médicas (SIL)', icon: HeartPulse, count: activeMedicalLeaves.length },
            { id: 'vacations', label: '5. Vacaciones Art. 67', icon: Palmtree, count: activeVacations.length },
            { id: 'benefits', label: '6. Bonos & Beneficios', icon: Gift, count: activeBenefits.length },
            { id: 'sanctions', label: '7. Sanciones RIOHS', icon: FileWarning, count: activeSanctions.length },
            { id: 'severance', label: '8. Finiquitos Art. 161', icon: Scale },
            { id: 'karin', label: '9. Canal Ley Karin 21.643', icon: ShieldAlert, count: activeKarinCases.length },
            { id: 'certificates', label: '10. Certificados Laborales', icon: FileText },
            { id: 'legal_books', label: '11. Libros DT & Previred 105', icon: FileSpreadsheet },
            { id: 'console', label: '12. Consola Asistente IA', icon: Bot },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as HrSubTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs font-bold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isActive ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-slate-900 text-white px-4 py-3 rounded-lg shadow-lg text-xs flex items-center justify-between animate-fade-in border border-slate-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 1: CONSOLA AUTÓNOMA & CHAT DEL AGENTE DE RRHH                     */}
      {/* ========================================================================= */}
      {activeSubTab === 'console' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chat Stream */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col h-[700px]">
            {/* Console Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-800">
                  Consola Interactiva del Agente RRHH • Contexto: {activeClient.nombreCorto}
                </span>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                Norma Legal: Chile 2026
              </span>
            </div>

            {/* Message Stream */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
              {chatMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl p-4 text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-800 shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-slate-100 text-[10px] font-semibold text-slate-400">
                      <span>{msg.sender === 'user' ? 'Usuario ERP' : 'Agente Autónomo de RRHH'}</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    <div className="space-y-2 whitespace-pre-line text-xs">
                      {msg.text}
                    </div>

                    {/* Technical Output Payload Box */}
                    {msg.payload && (
                      <div className="mt-4 pt-3 border-t border-slate-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 uppercase tracking-wider">
                            Protocolo de Salida Técnica (Integración ERP)
                          </span>
                          <button
                            onClick={() => handleCopy(JSON.stringify(msg.payload, null, 2))}
                            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                          >
                            {copiedText ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>Copiar JSON</span>
                          </button>
                        </div>

                        <pre className="bg-[#0f172a] text-emerald-400 p-3 rounded-lg text-[11px] font-mono overflow-x-auto max-h-56 leading-tight">
                          {JSON.stringify(msg.payload, null, 2)}
                        </pre>

                        {/* Direct ERP Integration Button */}
                        {msg.payload.asiento_contable && msg.payload.asiento_contable.length > 0 && (
                          <div className="mt-2.5 flex items-center justify-between">
                            <span className="text-[11px] text-slate-500 italic">
                              Asiento balanceado listo para el Libro Diario
                            </span>
                            <button
                              onClick={() => handleCommitAccountingEntry(
                                msg.payload!.asiento_contable,
                                `${msg.payload!.modulo.toUpperCase()} - ${msg.payload!.accion}`
                              )}
                              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                            >
                              <Landmark className="w-3.5 h-3.5" />
                              <span>Contabilizar Asiento en ERP</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Prompts Bar */}
            <div className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2 overflow-x-auto">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide shrink-0">
                Acciones Rápidas:
              </span>
              {quickActions.map((act, i) => (
                <button
                  key={i}
                  onClick={() => handleSendAgentQuery(act.query)}
                  className="bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors border border-slate-200 cursor-pointer"
                >
                  {act.label}
                </button>
              ))}
            </div>

            {/* Console Input Bar */}
            <div className="p-3 border-t border-slate-200 bg-white">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendAgentQuery();
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={agentQuery}
                  onChange={(e) => setAgentQuery(e.target.value)}
                  placeholder="Instruye al agente de RRHH (ej: 'Calcula finiquito para Juan Pérez', 'Valida contrato 40 hrs')..."
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Active Company HR Parameters & Active Alerts */}
          <div className="space-y-6">
            {/* Active Company Parameter Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Parámetros Empresa Activa</span>
                </h3>
                <span className="text-[10px] font-mono text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  CONFORME DT
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Razón Social:</span>
                  <span className="font-bold text-slate-800 text-right truncate max-w-[180px]">{activeClient.razonSocial}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">RUT Empresa:</span>
                  <span className="font-mono font-bold text-slate-800">{activeClient.rut}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Mutual de Seguridad:</span>
                  <span className="font-bold text-blue-700">{activeClient.mutualidad || 'Mutual de Seguridad CChC'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tasa SIS Empleador:</span>
                  <span className="font-mono font-bold text-slate-800">1.49%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Caja Compensación (CCAF):</span>
                  <span className="font-bold text-slate-800">Caja Los Andes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ley 40 Horas (21.561):</span>
                  <span className="font-bold text-emerald-700">42 hrs (Abril 2026)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ley Karin (21.643):</span>
                  <span className="font-bold text-emerald-700">Protocolo RIOHS Activo</span>
                </div>
              </div>
            </div>

            {/* Compliance Alerts Card */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Alertas Legales Automatizadas</span>
                </h3>
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {alerts.length} Notificaciones
                </span>
              </div>

              <div className="space-y-2.5 max-h-[360px] overflow-y-auto">
                {alerts.map(a => (
                  <div
                    key={a.id}
                    className={`p-3 rounded-lg border text-xs ${
                      a.nivel === 'CRITICO' 
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : a.nivel === 'ALTO'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-blue-50 border-blue-200 text-blue-900'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>{a.titulo}</span>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-white/70">
                        {a.nivel}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-600 leading-tight">
                      {a.descripcion}
                    </p>
                    <div className="mt-2 text-[10px] font-semibold text-slate-500">
                      Norma: {a.normaLegal}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB: 1. FICHA Y DIRECTORIO DE COLABORADORES (INGESTA DE PERSONAS)     */}
      {/* ========================================================================= */}
      {activeSubTab === 'collaborators' && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Dotación Total</div>
              <div className="text-2xl font-black text-slate-900 mt-1">{payrolls.length}</div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-1">100% Contratos Registrados</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Sueldo Base Promedio</div>
              <div className="text-xl font-black text-slate-900 mt-1 font-mono">
                {formatCLP(payrolls.length ? Math.round(payrolls.reduce((s, p) => s + (p.sueldoBase || 0), 0) / payrolls.length) : 0)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Sueldo Mínimo: $500.000</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Imponible Nómina</div>
              <div className="text-xl font-black text-blue-700 mt-1 font-mono">
                {formatCLP(payrolls.reduce((s, p) => s + (p.totalImponible || 0), 0))}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Base Previsión & SIS</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Líquido a Pago</div>
              <div className="text-xl font-black text-emerald-700 mt-1 font-mono">
                {formatCLP(payrolls.reduce((s, p) => s + (p.sueldoLiquido || 0), 0))}
              </div>
              <div className="text-[11px] text-emerald-600 font-semibold mt-1">Transferencias Bancarias</div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={collabSearch}
                onChange={(e) => setCollabSearch(e.target.value)}
                placeholder="Buscar colaborador por nombre, RUT o cargo..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddCollabModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Registrar Nuevo Colaborador</span>
              </button>
            </div>
          </div>

          {/* Collaborators Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Colaborador / RUT</th>
                    <th className="px-4 py-3">Cargo & Departamento</th>
                    <th className="px-4 py-3 text-center">Tipo Contrato</th>
                    <th className="px-4 py-3 text-right">Sueldo Base</th>
                    <th className="px-4 py-3 text-right">Gratificación</th>
                    <th className="px-4 py-3 text-right">Líquido a Pago</th>
                    <th className="px-4 py-3">Previsión / Salud</th>
                    <th className="px-4 py-3 text-center">Novedades RRHH</th>
                    <th className="px-4 py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payrolls
                    .filter(p => 
                      p.nombreCompleto?.toLowerCase().includes(collabSearch.toLowerCase()) ||
                      p.rut?.includes(collabSearch) ||
                      p.cargo?.toLowerCase().includes(collabSearch.toLowerCase())
                    )
                    .map(emp => {
                      const hasActiveLeave = activeMedicalLeaves.some(l => l.rut === emp.rut);
                      const hasAbsenteeism = activeAbsenteeism.some(a => a.rut === emp.rut);
                      const empContract = activeContracts.find(c => c.rut === emp.rut);

                      return (
                        <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">{emp.nombreCompleto}</div>
                            <div className="text-[11px] font-mono text-slate-400">{emp.rut}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{emp.cargo}</div>
                            <div className="text-[10px] text-slate-400">{emp.departamento || 'Operaciones'}</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              {emp.tipoContrato || 'INDEFINIDO'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            {formatCLP(emp.sueldoBase)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600">
                            {formatCLP(emp.gratificacionLegal)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                            {formatCLP(emp.sueldoLiquido)}
                          </td>
                          <td className="px-4 py-3 text-[11px]">
                            <div className="font-semibold text-slate-800">AFP {emp.afpNombre}</div>
                            <div className="text-slate-500">{emp.saludTipo} {emp.saludPlanUf > 0 ? `(${emp.saludPlanUf} UF)` : ''}</div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {hasActiveLeave ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center gap-1">
                                <HeartPulse className="w-3 h-3" />
                                <span>SIL Activo</span>
                              </span>
                            ) : hasAbsenteeism ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>Novedad</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Normal</span>
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center justify-center gap-2">
                              {empContract && (
                                <button
                                  onClick={() => setSelectedContractForDt(empContract)}
                                  title="Ver Payload MiDT"
                                  className="text-blue-600 hover:text-blue-800 font-bold text-[11px] underline cursor-pointer"
                                >
                                  MiDT
                                </button>
                              )}
                              <button
                                onClick={() => handleOpenEditCollabModal(emp)}
                                title="Modificar / Editar Ficha Colaborador (M de ABM)"
                                className="text-cyan-600 hover:text-cyan-800 p-1 rounded-md hover:bg-cyan-50 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              {onDeleteEmployee && payrolls.length > 1 && (
                                <button
                                  onClick={() => onDeleteEmployee(emp.id)}
                                  title="Eliminar Colaborador (Baja ABM)"
                                  className="text-rose-500 hover:text-rose-700 p-1 rounded-md hover:bg-rose-50 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB: 2. CONTRATOS MiDT                                                 */}
      {/* ========================================================================= */}
      {activeSubTab === 'contracts' && (
        <ContractsManager
          contracts={activeContracts}
          onAddContract={handleAddContract}
          onUpdateContract={handleUpdateContract}
          company={company}
        />
      )}

      {/* ========================================================================= */}
      {/* SUBTAB: 3. ASISTENCIA & ATRASOS                                           */}
      {/* ========================================================================= */}
      {activeSubTab === 'absenteeism' && (
        <AbsenteeismManager
          absenteeism={activeAbsenteeism}
          onAddRecord={handleAddAbsenteeismRecord}
          onGenerateSanction={handleAddSanction}
          employees={payrolls}
        />
      )}

      {/* ========================================================================= */}
      {/* SUBTAB: 4. LICENCIAS MÉDICAS (SIL)                                        */}
      {/* ========================================================================= */}
      {activeSubTab === 'medical_leaves' && (
        <MedicalLeavesManager
          medicalLeaves={activeMedicalLeaves}
          onAddMedicalLeave={handleAddMedicalLeave}
          onUpdateMedicalLeave={handleUpdateMedicalLeave}
          employees={payrolls}
        />
      )}

      {/* ========================================================================= */}
      {/* SUBTAB: 5. VACACIONES & FERIADO PROGRESIVO                                */}
      {/* ========================================================================= */}
      {activeSubTab === 'vacations' && (
        <VacationsManager
          vacations={activeVacations}
          onAddRequest={handleAddVacationRequest}
          onApproveRequest={handleApproveVacationRequest}
          company={company}
        />
      )}

      {/* ========================================================================= */}
      {/* SUBTAB: 6. BONOS & BENEFICIOS                                             */}
      {/* ========================================================================= */}
      {activeSubTab === 'benefits' && (
        <BenefitsManager
          benefits={activeBenefits}
          onAddBenefit={handleAddBenefit}
          onToggleBenefit={handleToggleBenefit}
        />
      )}

      {/* ========================================================================= */}
      {/* SUBTAB: 7. SANCIONES RIOHS                                                */}
      {/* ========================================================================= */}
      {activeSubTab === 'sanctions' && (
        <SanctionsManager
          sanctions={activeSanctions}
          onAddSanction={handleAddSanction}
          onUpdateSanction={handleUpdateSanction}
          employees={payrolls}
          company={company}
        />
      )}

      {/* ========================================================================= */}
      {/* SUBTAB: 8. FINIQUITOS ART. 161                                            */}
      {/* ========================================================================= */}
      {activeSubTab === 'severance' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Simulador y Calculador Legal de Finiquitos (Art. 159, 160 y 161)
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                Tope indemnización: 90 UF ({formatCLP(90 * indicators.uf)})
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Colaborador:</label>
                <select
                  value={finiquitoRut}
                  onChange={(e) => setFiniquitoRut(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                >
                  {payrolls.map(p => (
                    <option key={p.id} value={p.rut}>{p.nombreCompleto} ({p.rut})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Causal de Término:</label>
                <select
                  value={finiquitoCausal}
                  onChange={(e) => setFiniquitoCausal(e.target.value as SeveranceCausal)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                >
                  <option value="ART_161_NECESIDADES_DE_LA_EMPRESA">Art. 161: Necesidades de la Empresa</option>
                  <option value="ART_161_DESAHUCIO_ESCRITO">Art. 161 inc. 2: Desahucio Escrito Empleador</option>
                  <option value="ART_159_MUTUO_ACUERDO">Art. 159 N° 1: Mutuo Acuerdo de las Partes</option>
                  <option value="ART_159_RENUNCIA_VOLUNTARIA">Art. 159 N° 2: Renuncia Voluntaria</option>
                  <option value="ART_159_VENCIMIENTO_PLAZO">Art. 159 N° 4: Vencimiento del Plazo</option>
                  <option value="ART_160_CONDUCTAS_INDEBIDAS_GRAVES">Art. 160: Conductas Graves (Sin Indemnización)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Fecha de Término:</label>
                <input
                  type="date"
                  value={finiquitoFechaDespido}
                  onChange={(e) => setFiniquitoFechaDespido(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Días Aviso Previo Otorgados:</label>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={finiquitoDiasPreaviso}
                  onChange={(e) => setFiniquitoDiasPreaviso(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleRunFiniquito}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Calculator className="w-4 h-4" />
                <span>Calcular Finiquito Legal & Asiento</span>
              </button>
            </div>

            {/* Finiquito Result Card */}
            {finiquitoCalculado && (
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-amber-900 text-xs uppercase tracking-wider">
                    Resultado Finiquito: {finiquitoCalculado.nombreCompleto} ({finiquitoCalculado.rut})
                  </h4>
                  <span className="text-[11px] font-bold text-amber-800">
                    Antigüedad: {finiquitoCalculado.antiguedadAnos} años, {finiquitoCalculado.antiguedadMeses} meses ({finiquitoCalculado.aniosComputables} años computables)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white p-3 rounded-lg border border-amber-200">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Indemniz. Años Servicio</div>
                    <div className="text-sm font-bold text-slate-900 mt-1 font-mono">
                      {formatCLP(finiquitoCalculado.indemnizacionAnosServicio)}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-amber-200">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Aviso Previo Sustitutivo</div>
                    <div className="text-sm font-bold text-slate-900 mt-1 font-mono">
                      {formatCLP(finiquitoCalculado.indemnizacionAvisoPrevio)}
                    </div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-amber-200">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Feriado Proporcional</div>
                    <div className="text-sm font-bold text-slate-900 mt-1 font-mono">
                      {formatCLP(finiquitoCalculado.montoFeriadoProporcional)}
                    </div>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                    <div className="text-[10px] text-emerald-800 uppercase font-bold">Líquido Finiquito</div>
                    <div className="text-base font-extrabold text-emerald-700 mt-1 font-mono">
                      {formatCLP(finiquitoCalculado.totalFiniquitoLiquido)}
                    </div>
                  </div>
                </div>

                {finiquitoCalculado.asientoContable && (
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-600">
                      Asiento de finiquito generado automáticamente según normas contables CMF / SII.
                    </span>
                    <button
                      onClick={() => handleCommitAccountingEntry(finiquitoCalculado.asientoContable!, `Finiquito ${finiquitoCalculado.nombreCompleto}`)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Landmark className="w-3.5 h-3.5" />
                      <span>Registrar Asiento Finiquito en ERP</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB: 9. GESTIÓN CONVIVENCIA LABORAL (LEY KARIN N° 21.643)              */}
      {/* ========================================================================= */}
      {activeSubTab === 'karin' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Gestión de Convivencia Laboral y Prevención de Acoso (Ley Karin N° 21.643)
                  </h3>
                  <p className="text-[11px] text-slate-500">Canal formal de denuncias con estricta reserva de identidad y plazos de 30 días.</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddKarinModal(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Ingresar Denuncia Bajo Reserva</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-purple-50/50 border border-purple-200 rounded-lg p-4">
                <div className="text-[11px] font-bold text-purple-800 uppercase">1. Canal de Denuncias</div>
                <p className="text-xs text-slate-600 mt-1">
                  Recepción segura y anónima con asignación inmediata de folio.
                </p>
              </div>
              <div className="bg-purple-50/50 border border-purple-200 rounded-lg p-4">
                <div className="text-[11px] font-bold text-purple-800 uppercase">2. Medidas de Resguardo</div>
                <p className="text-xs text-slate-600 mt-1">
                  Separación de turnos o dependencias en menos de 24 horas.
                </p>
              </div>
              <div className="bg-purple-50/50 border border-purple-200 rounded-lg p-4">
                <div className="text-[11px] font-bold text-purple-800 uppercase">3. Plazo de Investigación</div>
                <p className="text-xs text-slate-600 mt-1">
                  Informe final o remisión a la DT en plazo máximo de 30 días corridos.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Casos Registrados & Medidas Preventivas:
              </h4>
              {activeKarinCases.map(c => (
                <div key={c.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-purple-700 text-xs">{c.folioCaso}</span>
                      <span className="text-xs text-slate-600 font-semibold">• {c.tipoAcoso}</span>
                    </div>
                    <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                      {c.estado}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-slate-600">
                    <strong>Medidas de Resguardo Adoptadas:</strong> {c.medidasDeResguardo}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Responsable: {c.responsableInvestigacion}</span>
                    <span className="font-mono font-semibold text-rose-600">Límite Legal: {c.fechaLimiteInforme}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 4: MÓDULO C - CERTIFICADOS LABORALES FORMALES CON FIRMA DIGITAL    */}
      {/* ========================================================================= */}
      {activeSubTab === 'certificates' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Certificate Generation Panel */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Emisión de Certificados Laborales</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Colaborador:</label>
                <select
                  value={certEmployeeRut}
                  onChange={(e) => setCertEmployeeRut(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                >
                  {payrolls.map(p => (
                    <option key={p.id} value={p.rut}>{p.nombreCompleto} ({p.rut})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Tipo de Certificado Legal:</label>
                <select
                  value={certType}
                  onChange={(e) => setCertType(e.target.value as CertificateType)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold text-slate-800"
                >
                  <option value="ANTIGUEDAD">Certificado de Antigüedad Laboral</option>
                  <option value="REMUNERACIONES_COTIZACIONES">Certificado de Remuneraciones & Cotizaciones al Día (Ley Bustos)</option>
                  <option value="SALA_CUNA_ART203">Certificado para Sala Cuna (Art. 203 CT)</option>
                  <option value="ENTREGA_RIOHS_EPP">Comprobante de Entrega de RIOHS, Ley Karin & EPP</option>
                </select>
              </div>

              <button
                onClick={handleGenerateCertificate}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generar Certificado Formal con Firma</span>
              </button>
            </div>
          </div>

          {/* Certificate Formal Viewer */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-8 shadow-xs relative">
            {selectedCertificate ? (
              <div className="space-y-6">
                {/* Formal Header */}
                <div className="flex items-start justify-between border-b pb-4 border-slate-200">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">{activeClient.razonSocial}</h2>
                    <div className="text-[11px] text-slate-500">RUT: {activeClient.rut} • Casa Matriz: {activeClient.direccion}</div>
                  </div>
                  <div className="text-right font-mono text-[10px] text-slate-400">
                    <div>Folio: <strong>{selectedCertificate.folio}</strong></div>
                    <div>Fecha: {selectedCertificate.fechaEmision}</div>
                  </div>
                </div>

                {/* Certificate Title */}
                <div className="text-center py-2">
                  <h1 className="text-base font-bold text-slate-900 uppercase tracking-wider underline">
                    {selectedCertificate.tipo.replace(/_/g, ' ')}
                  </h1>
                </div>

                {/* Body Text */}
                <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-line text-justify bg-slate-50/50 p-6 rounded-lg border border-slate-200">
                  {selectedCertificate.cuerpoTexto}
                </div>

                {/* Signature & Digital Hash */}
                <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200">
                  <div className="text-center sm:text-left">
                    <div className="text-xs font-bold text-slate-800">{activeClient.razonSocial}</div>
                    <div className="text-[11px] text-slate-500">Firma Electrónica Avanzada</div>
                    <div className="text-[9px] font-mono text-slate-400 mt-1">Hash: {selectedCertificate.hashFirmaDigital}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.print()}
                      className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Imprimir</span>
                    </button>
                    <button
                      onClick={() => showToast('Certificado descargado en formato PDF oficial.')}
                      className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow-xs cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Descargar PDF</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-2">
                <FileText className="w-10 h-10 stroke-1" />
                <span className="text-xs">Selecciona un colaborador y haz clic en "Generar Certificado Formal".</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 5: MÓDULO D - MOTOR DE LIQUIDACIONES DE SUELDO (4 BLOQUES)          */}
      {/* ========================================================================= */}
      {activeSubTab === 'payroll_engine' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-blue-600" />
              <span>Motor de Remuneraciones Chilena: Desglose en Cuatro Bloques Normativos</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Haberes Imponibles/Tributables (Art. 50 tope 4.75 IMM), No Imponibles, Descuentos Legales (AFP, Fonasa/Isapre, AFC, Impuesto Único mensual) y Costo Empleador.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Bloque 1: Haberes Imponibles */}
            <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-[11px] font-bold text-blue-800 uppercase">1. Haberes Imponibles</span>
                <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Tributable</span>
              </div>
              <ul className="text-xs space-y-1.5 text-slate-600">
                <li className="flex justify-between">
                  <span>Sueldo Base (30 días):</span>
                  <span className="font-bold text-slate-800">{formatCLP(payrolls[0]?.sueldoBase || 1200000)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Gratificación Legal Art. 50:</span>
                  <span className="font-bold text-slate-800">{formatCLP(payrolls[0]?.gratificacionMonto || 205833)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Horas Extras (50% recargo):</span>
                  <span className="font-bold text-slate-800">{formatCLP(payrolls[0]?.horasExtrasMonto || 0)}</span>
                </li>
                <li className="flex justify-between pt-1 border-t font-bold text-blue-700">
                  <span>Total Imponible:</span>
                  <span>{formatCLP(payrolls[0]?.totalHaberesImponibles || 1405833)}</span>
                </li>
              </ul>
            </div>

            {/* Bloque 2: Haberes No Imponibles */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-[11px] font-bold text-slate-700 uppercase">2. No Imponibles</span>
                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">Exento</span>
              </div>
              <ul className="text-xs space-y-1.5 text-slate-600">
                <li className="flex justify-between">
                  <span>Asignación Colación:</span>
                  <span className="font-bold text-slate-800">{formatCLP(payrolls[0]?.asignacionColacion || 80000)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Asignación Movilización:</span>
                  <span className="font-bold text-slate-800">{formatCLP(payrolls[0]?.asignacionMovilizacion || 70000)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Viáticos / Cargas IPS:</span>
                  <span className="font-bold text-slate-800">{formatCLP(payrolls[0]?.viaticosAsignacionFamiliar || 0)}</span>
                </li>
                <li className="flex justify-between pt-1 border-t font-bold text-slate-800">
                  <span>Total No Imponible:</span>
                  <span>{formatCLP(payrolls[0]?.totalHaberesNoImponibles || 150000)}</span>
                </li>
              </ul>
            </div>

            {/* Bloque 3: Descuentos Legales */}
            <div className="bg-white border border-rose-200 rounded-xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-[11px] font-bold text-rose-800 uppercase">3. Descuentos Legales</span>
                <span className="text-[10px] font-mono font-bold bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded">Obligatorio</span>
              </div>
              <ul className="text-xs space-y-1.5 text-slate-600">
                <li className="flex justify-between">
                  <span>AFP ({payrolls[0]?.afpNombre}):</span>
                  <span className="font-bold text-slate-800">{formatCLP(payrolls[0]?.afpMonto || 158000)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Salud ({payrolls[0]?.saludTipo}):</span>
                  <span className="font-bold text-slate-800">{formatCLP(payrolls[0]?.saludMonto || 98400)}</span>
                </li>
                <li className="flex justify-between">
                  <span>AFC Trabajador (0.6%):</span>
                  <span className="font-bold text-slate-800">{formatCLP(payrolls[0]?.afcTrabajadorMonto || 8435)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Impuesto Único (SII):</span>
                  <span className="font-bold text-purple-700">{formatCLP(payrolls[0]?.impuestoUnicoMonto || 0)}</span>
                </li>
                <li className="flex justify-between pt-1 border-t font-bold text-rose-700">
                  <span>Total Descuentos:</span>
                  <span>{formatCLP(payrolls[0]?.totalDescuentos || 264835)}</span>
                </li>
              </ul>
            </div>

            {/* Bloque 4: Aportes Patronales */}
            <div className="bg-white border border-amber-200 rounded-xl p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                <span className="text-[11px] font-bold text-amber-800 uppercase">4. Aportes Patronales</span>
                <span className="text-[10px] font-mono font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">Costo Empresa</span>
              </div>
              <ul className="text-xs space-y-1.5 text-slate-600">
                <li className="flex justify-between">
                  <span>SIS Empleador (1.49%):</span>
                  <span className="font-bold text-slate-800">{formatCLP(payrolls[0]?.sisEmpleadorMonto || 20947)}</span>
                </li>
                <li className="flex justify-between">
                  <span>Mutual Ley 16.744:</span>
                  <span className="font-bold text-slate-800">{formatCLP(payrolls[0]?.mutualEmpleadorMonto || 13074)}</span>
                </li>
                <li className="flex justify-between">
                  <span>AFC Empleador (2.4%):</span>
                  <span className="font-bold text-slate-800">{formatCLP(payrolls[0]?.afcEmpleadorMonto || 33740)}</span>
                </li>
                <li className="flex justify-between pt-1 border-t font-bold text-amber-800">
                  <span>Costo Total Empresa:</span>
                  <span>{formatCLP(payrolls[0]?.costoTotalEmpresa || 1623594)}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBTAB 6: MÓDULO E - LIBROS LEGALES DT & PREVIRED 105 CAMPOS              */}
      {/* ========================================================================= */}
      {activeSubTab === 'legal_books' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <span>Libro de Remuneraciones Electrónico (LRE DT) & Carga Masiva PREVIRED</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Layout oficial de 105 campos para Previred y archivo normalizado para la Dirección del Trabajo (Res. Ex. 873).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const res = generatePrevired105Fields(payrolls, activeClient, '2026-08');
                  const blob = new Blob([res.archivoContenido], { type: 'text/plain;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `PREVIRED_105_CAMPOS_${activeClient.rut.replace(/[^0-9kK]/g, '')}_202608.txt`;
                  a.click();
                  showToast('Archivo PREVIRED de 105 campos descargado correctamente.');
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar Archivo PREVIRED (105 Campos)</span>
              </button>
            </div>
          </div>

          {/* Previred Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Cotizantes Informados</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">{payrolls.length}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Nómina mensual consolidada</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Monto Total a Pagar en Previred</span>
              <div className="text-2xl font-bold text-emerald-600 mt-1 font-mono">
                {formatCLP(payrolls.reduce((s, p) => s + p.afpMonto + p.saludMonto + p.afcTrabajadorMonto + p.afcEmpleadorMonto + p.sisEmpleadorMonto + p.mutualEmpleadorMonto, 0))}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Vencimiento legal: día 13 del mes</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase">Estado Libro LRE (Mi DT)</span>
              <div className="text-xs font-bold text-emerald-700 mt-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>DECLARADO Y ACEPTADO DT</span>
              </div>
              <div className="text-[10px] font-mono text-slate-500 mt-1">Certificado: CERT-DT-202608-99410</div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View MiDT Payload */}
      {selectedContractForDt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Estructura Oficial para Portal MiDT (Dirección del Trabajo)
                </h3>
              </div>
              <button
                onClick={() => setSelectedContractForDt(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Payload generado en cumplimiento de la Ley 21.327 para el Registro Electrónico Laboral (REL) del colaborador <strong>{selectedContractForDt.nombreCompleto}</strong>:
            </p>

            <pre className="flex-1 bg-[#0f172a] text-emerald-400 p-4 rounded-lg text-xs font-mono overflow-y-auto max-h-96">
              {JSON.stringify(generateMiDtContractPayload(selectedContractForDt, activeClient), null, 2)}
            </pre>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <button
                onClick={() => {
                  handleCopy(JSON.stringify(generateMiDtContractPayload(selectedContractForDt, activeClient), null, 2));
                  showToast('Payload copiado al portapapeles.');
                }}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar JSON MiDT</span>
              </button>
              <button
                onClick={() => setSelectedContractForDt(null)}
                className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-slate-700 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Ingesta de Nuevo Colaborador */}
      {showAddCollabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Ingreso de Colaborador & Ficha Contractual DT
                </h3>
              </div>
              <button
                onClick={() => setShowAddCollabModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCollaboratorSubmit} className="space-y-4 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    value={newCollabForm.nombreCompleto || ''}
                    onChange={(e) => setNewCollabForm(prev => ({ ...prev, nombreCompleto: e.target.value }))}
                    placeholder="Ej. Rodrigo Tapia Salinas"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">RUT con Guión y Dígito *</label>
                  <input
                    type="text"
                    required
                    value={newCollabForm.rut || ''}
                    onChange={(e) => setNewCollabForm(prev => ({ ...prev, rut: e.target.value }))}
                    placeholder="Ej. 17.654.321-9"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Cargo *</label>
                  <input
                    type="text"
                    required
                    value={newCollabForm.cargo || ''}
                    onChange={(e) => setNewCollabForm(prev => ({ ...prev, cargo: e.target.value }))}
                    placeholder="Ej. Buzo Comercial Especialista"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Departamento</label>
                  <select
                    value={newCollabForm.departamento || 'Operaciones'}
                    onChange={(e) => setNewCollabForm(prev => ({ ...prev, departamento: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800"
                  >
                    <option value="Operaciones Submarinas">Operaciones Submarinas</option>
                    <option value="Taller de Redes & Loberas">Taller de Redes & Loberas</option>
                    <option value="Calidad y Normativa">Calidad y Normativa</option>
                    <option value="Administración y Finanzas">Administración y Finanzas</option>
                    <option value="Logística Marítima">Logística Marítima</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Fecha de Ingreso</label>
                  <input
                    type="date"
                    required
                    value={newCollabForm.fechaIngreso || ''}
                    onChange={(e) => setNewCollabForm(prev => ({ ...prev, fechaIngreso: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Tipo de Contrato</label>
                  <select
                    value={newCollabForm.tipoContrato || 'INDEFINIDO'}
                    onChange={(e) => setNewCollabForm(prev => ({ ...prev, tipoContrato: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800"
                  >
                    <option value="INDEFINIDO">Indefinido</option>
                    <option value="PLAZO_FIJO">Plazo Fijo</option>
                    <option value="POR_OBRA_FAENA">Por Obra o Faena</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Sueldo Base (CLP) *</label>
                  <input
                    type="number"
                    required
                    min="500000"
                    step="10000"
                    value={newCollabForm.sueldoBase || 0}
                    onChange={(e) => setNewCollabForm(prev => ({ ...prev, sueldoBase: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Modalidad Gratificación</label>
                  <select
                    value={newCollabForm.gratificacionModalidad || 'ART_50'}
                    onChange={(e) => setNewCollabForm(prev => ({ ...prev, gratificacionModalidad: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800"
                  >
                    <option value="ART_50">Art. 50 (25% con tope 4.75 IMM)</option>
                    <option value="ART_47">Art. 47 (30% utilidades líquidas)</option>
                    <option value="CONVENIDA">Pactada / Convenida</option>
                    <option value="SIN_GRATIFICACION">Sin Gratificación</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">AFP</label>
                  <select
                    value={newCollabForm.afpNombre || 'HABITAT'}
                    onChange={(e) => setNewCollabForm(prev => ({ ...prev, afpNombre: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800"
                  >
                    <option value="CAPITAL">AFP Capital (11.44%)</option>
                    <option value="CUPRUM">AFP Cuprum (11.44%)</option>
                    <option value="HABITAT">AFP Habitat (11.27%)</option>
                    <option value="MODELO">AFP Modelo (10.58%)</option>
                    <option value="PLANVITAL">AFP PlanVital (11.16%)</option>
                    <option value="PROVIDA">AFP ProVida (11.45%)</option>
                    <option value="UNO">AFP UNO (10.49%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Salud</label>
                  <select
                    value={newCollabForm.saludTipo || 'FONASA'}
                    onChange={(e) => setNewCollabForm(prev => ({ ...prev, saludTipo: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800"
                  >
                    <option value="FONASA">FONASA (7% Legal)</option>
                    <option value="ISAPRE_BANMEDICA">Isapre Banmédica</option>
                    <option value="ISAPRE_COLMENA">Isapre Colmena</option>
                    <option value="ISAPRE_CONSALUD">Isapre Consalud</option>
                    <option value="ISAPRE_CRUZ_BLANCA">Isapre Cruz Blanca</option>
                    <option value="ISAPRE_NUEVA_MASVIDA">Isapre Nueva Masvida</option>
                    <option value="ISAPRE_VIDA_TRES">Isapre Vida Tres</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Colación (No Imponible)</label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={newCollabForm.asignacionColacion || 0}
                    onChange={(e) => setNewCollabForm(prev => ({ ...prev, asignacionColacion: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Movilización (No Imponible)</label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={newCollabForm.asignacionMovilizacion || 0}
                    onChange={(e) => setNewCollabForm(prev => ({ ...prev, asignacionMovilizacion: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-[11px] text-blue-800 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Al registrar el colaborador, se calculará automáticamente su liquidación mensual con las tasas vigentes 2026, se generará el contrato laboral para MiDT y su saldo de feriado legal de 15 días hábiles.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddCollabModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Registrar e Ingresar a Nómina
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Modificar / Editar Colaborador (M de ABM) */}
      {showEditCollabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-cyan-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Modificar Ficha de Colaborador (ABM)
                </h3>
                <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {showEditCollabModal.rut}
                </span>
              </div>
              <button
                onClick={() => setShowEditCollabModal(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditCollaboratorSubmit} className="space-y-4 overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    value={editCollabForm.nombreCompleto || ''}
                    onChange={(e) => setEditCollabForm(prev => ({ ...prev, nombreCompleto: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">RUT con Guión y Dígito *</label>
                  <input
                    type="text"
                    required
                    value={editCollabForm.rut || ''}
                    onChange={(e) => setEditCollabForm(prev => ({ ...prev, rut: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Cargo *</label>
                  <input
                    type="text"
                    required
                    value={editCollabForm.cargo || ''}
                    onChange={(e) => setEditCollabForm(prev => ({ ...prev, cargo: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Departamento</label>
                  <select
                    value={editCollabForm.departamento || 'Operaciones'}
                    onChange={(e) => setEditCollabForm(prev => ({ ...prev, departamento: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800"
                  >
                    <option value="Operaciones Submarinas">Operaciones Submarinas</option>
                    <option value="Taller de Redes & Loberas">Taller de Redes & Loberas</option>
                    <option value="Calidad y Normativa">Calidad y Normativa</option>
                    <option value="Administración y Finanzas">Administración y Finanzas</option>
                    <option value="Logística Marítima">Logística Marítima</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Fecha de Ingreso</label>
                  <input
                    type="date"
                    required
                    value={editCollabForm.fechaIngreso || ''}
                    onChange={(e) => setEditCollabForm(prev => ({ ...prev, fechaIngreso: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Tipo de Contrato</label>
                  <select
                    value={editCollabForm.tipoContrato || 'INDEFINIDO'}
                    onChange={(e) => setEditCollabForm(prev => ({ ...prev, tipoContrato: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800"
                  >
                    <option value="INDEFINIDO">Indefinido</option>
                    <option value="PLAZO_FIJO">Plazo Fijo</option>
                    <option value="POR_OBRA_FAENA">Por Obra o Faena</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Sueldo Base (CLP) *</label>
                  <input
                    type="number"
                    required
                    min="500000"
                    step="10000"
                    value={editCollabForm.sueldoBase || 0}
                    onChange={(e) => setEditCollabForm(prev => ({ ...prev, sueldoBase: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Modalidad Gratificación</label>
                  <select
                    value={editCollabForm.gratificacionModalidad || 'ART_50'}
                    onChange={(e) => setEditCollabForm(prev => ({ ...prev, gratificacionModalidad: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800"
                  >
                    <option value="ART_50">Art. 50 (25% con tope 4.75 IMM)</option>
                    <option value="ART_47">Art. 47 (30% utilidades líquidas)</option>
                    <option value="CONVENIDA">Pactada / Convenida</option>
                    <option value="SIN_GRATIFICACION">Sin Gratificación</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">AFP</label>
                  <select
                    value={editCollabForm.afpNombre || 'HABITAT'}
                    onChange={(e) => setEditCollabForm(prev => ({ ...prev, afpNombre: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800"
                  >
                    <option value="CAPITAL">AFP Capital (11.44%)</option>
                    <option value="CUPRUM">AFP Cuprum (11.44%)</option>
                    <option value="HABITAT">AFP Habitat (11.27%)</option>
                    <option value="MODELO">AFP Modelo (10.58%)</option>
                    <option value="PLANVITAL">AFP PlanVital (11.16%)</option>
                    <option value="PROVIDA">AFP ProVida (11.45%)</option>
                    <option value="UNO">AFP UNO (10.49%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Salud</label>
                  <select
                    value={editCollabForm.saludTipo || 'FONASA'}
                    onChange={(e) => setEditCollabForm(prev => ({ ...prev, saludTipo: e.target.value as any }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800"
                  >
                    <option value="FONASA">FONASA (7% Legal)</option>
                    <option value="ISAPRE_BANMEDICA">Isapre Banmédica</option>
                    <option value="ISAPRE_COLMENA">Isapre Colmena</option>
                    <option value="ISAPRE_CONSALUD">Isapre Consalud</option>
                    <option value="ISAPRE_CRUZ_BLANCA">Isapre Cruz Blanca</option>
                    <option value="ISAPRE_NUEVA_MASVIDA">Isapre Nueva Masvida</option>
                    <option value="ISAPRE_VIDA_TRES">Isapre Vida Tres</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Colación (No Imponible)</label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={editCollabForm.asignacionColacion || 0}
                    onChange={(e) => setEditCollabForm(prev => ({ ...prev, asignacionColacion: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Movilización (No Imponible)</label>
                  <input
                    type="number"
                    min="0"
                    step="5000"
                    value={editCollabForm.asignacionMovilizacion || 0}
                    onChange={(e) => setEditCollabForm(prev => ({ ...prev, asignacionMovilizacion: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono text-slate-800"
                  />
                </div>
              </div>

              <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-[11px] text-cyan-800 flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Al guardar las modificaciones, el motor de nómina recalculará automáticamente la liquidación, imponibles, descuentos previsionales e impuesto único de segunda categoría según parámetros 2026.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowEditCollabModal(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  Guardar Modificaciones
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Ingreso de Denuncia Ley Karin */}
      {showAddKarinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Ingresar Denuncia Ley Karin (N° 21.643)
                </h3>
              </div>
              <button
                onClick={() => setShowAddKarinModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddKarinCaseSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Materia de la Denuncia *</label>
                <select
                  value={newKarinForm.tipoAcoso || 'ACOSO_LABORAL'}
                  onChange={(e) => setNewKarinForm(prev => ({ ...prev, tipoAcoso: e.target.value as any }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold text-slate-800"
                >
                  <option value="ACOSO_LABORAL">Acoso Laboral (Art. 2 CT)</option>
                  <option value="ACOSO_SEXUAL">Acoso Sexual (Art. 2 CT)</option>
                  <option value="VIOLENCIA_EN_EL_TRABAJO">Violencia en el Trabajo ejercida por terceros</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">RUT o Identificador Anonimizado del Denunciante</label>
                <input
                  type="text"
                  value={newKarinForm.denuncianteRutAnonimizado || ''}
                  onChange={(e) => setNewKarinForm(prev => ({ ...prev, denuncianteRutAnonimizado: e.target.value }))}
                  placeholder="Ej. 18.***.***-K (o RESERVA_TOTAL)"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Cargo / Área del Denunciado *</label>
                <input
                  type="text"
                  required
                  value={newKarinForm.denunciadoCargo || ''}
                  onChange={(e) => setNewKarinForm(prev => ({ ...prev, denunciadoCargo: e.target.value }))}
                  placeholder="Ej. Supervisor de Faena Taller Redes"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Medidas de Resguardo Inmediatas (&lt;24 hrs) *</label>
                <textarea
                  required
                  rows={2}
                  value={newKarinForm.medidasDeResguardo || ''}
                  onChange={(e) => setNewKarinForm(prev => ({ ...prev, medidasDeResguardo: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Responsable de Investigación</label>
                <input
                  type="text"
                  value={newKarinForm.responsableInvestigacion || ''}
                  onChange={(e) => setNewKarinForm(prev => ({ ...prev, responsableInvestigacion: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                />
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-[11px] text-purple-800">
                Se asignará folio formal correlativo con plazo legal perentorio de 30 días corridos para emisión de informe o derivación a la DT.
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddKarinModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  Registrar Caso Bajo Reserva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
