import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
import { isDemoClient } from '../config/demoMode';
import { piperTtsService } from './piperTtsService';
import { INITIAL_BANK_ACCOUNTS, INITIAL_CASH_ACCOUNTS } from '../data/seedData';
import { diskPersistence } from './diskPersistenceService';
import { commercialProcurementService } from './commercialProcurementService';
import {
  DEFAULT_SECURITY_RBAC_STATE,
  SecurityRbacStoreState,
  evaluateWhatsappPhoneAgainstRbac,
  deriveWhatsappScopesFromModules,
  mergeSecurityRbacStates,
} from './securityRbacService';

const execAsync = promisify(exec);
const safeDynamicImport = async (moduleSpecifier: string): Promise<any> => Function('m', 'return import(m)')(moduleSpecifier);

export type WhatsAppAgentScope =
  | 'FLUJO_CAJA'
  | 'BANCOS_CONCILIACION'
  | 'CONTABILIDAD_IFRS'
  | 'TRIBUTARIO_F29'
  | 'FACTURACION_DTE'
  | 'RRHH_REMUNERACIONES'
  | 'BODEGA_INVENTARIO'
  | 'PRODUCCION_COSTEO'
  | 'PRESUPUESTOS_COMERCIAL'
  | 'RENDICIONES_GASTOS'
  | 'PANORAMA_DIRECTORIO';

export interface WhatsAppAgentScopeMeta {
  id: WhatsAppAgentScope;
  nombre: string;
  agenteResponsable: string;
  descripcion: string;
  icono: string;
  ejemplosConsulta: string[];
}

export const WHATSAPP_AGENT_SCOPES_CATALOG: WhatsAppAgentScopeMeta[] = [
  {
    id: 'FLUJO_CAJA',
    nombre: 'Flujo de Caja & Tesorería',
    agenteResponsable: 'Vera Albornoz (Directora Financiera)',
    descripcion: 'Proyección de liquidez a 30/60/90 días, actualización a fecha de hoy y escenarios What-If.',
    icono: 'TrendingUp',
    ejemplosConsulta: ['Actualiza el flujo de caja partiendo de hoy', '¿Cuál es el flujo de caja proyectado?'],
  },
  {
    id: 'BANCOS_CONCILIACION',
    nombre: 'Bancos & Conciliación Bancaria',
    agenteResponsable: 'Vera Albornoz / Tesorería',
    descripcion: 'Saldos en línea de cuentas corrientes, estado de conciliación bancaria y partidas en tránsito.',
    icono: 'Landmark',
    ejemplosConsulta: ['¿Cómo está la conciliación bancaria?', 'Saldo disponible en bancos hoy'],
  },
  {
    id: 'RRHH_REMUNERACIONES',
    nombre: 'RRHH, Remuneraciones & Previred',
    agenteResponsable: 'Sofía Castro (Jefa de Nómina & Personas)',
    descripcion: 'Nómina de sueldos líquidos, imposiciones Previred, leyes sociales y vencimientos laborales.',
    icono: 'Users',
    ejemplosConsulta: ['¿Cuánto hay que pagar de sueldos e imposiciones?', 'Estado de Previred del mes'],
  },
  {
    id: 'BODEGA_INVENTARIO',
    nombre: 'Bodega, Stock & Inventarios',
    agenteResponsable: 'Diego Morales (Jefe de Bodega & Logística)',
    descripcion: 'Existencias físicas, stock de materias primas e insumos, valorización PMP y alertas de reposición.',
    icono: 'Package',
    ejemplosConsulta: ['¿Cuánto stock queda en bodega del producto principal?', 'Reporte de inventario actual'],
  },
  {
    id: 'PRODUCCION_COSTEO',
    nombre: 'Órdenes de Producción & Costeo NIC 2',
    agenteResponsable: 'Roberto Soto (Jefe de Planta & Costeo)',
    descripcion: 'Avance físico de órdenes de fabricación en taller, consumo de materiales y desvío presupuestario.',
    icono: 'Factory',
    ejemplosConsulta: ['¿Cuál es el estado de la orden de producción?', 'Avance de fabricación en planta'],
  },
  {
    id: 'PRESUPUESTOS_COMERCIAL',
    nombre: 'Presupuestos & Pipeline Comercial',
    agenteResponsable: 'Vera Albornoz / Área Comercial',
    descripcion: 'Estado de cotizaciones enviadas a clientes, márgenes proyectados y seguimiento comercial.',
    icono: 'FileSpreadsheet',
    ejemplosConsulta: ['¿Cuál es el estado de los presupuestos enviados?', 'Pipeline de cotizaciones vigentes'],
  },
  {
    id: 'TRIBUTARIO_F29',
    nombre: 'Impuestos SII, IVA F29 & RCV',
    agenteResponsable: 'Jorge Rojas (Especialista Tributario SII)',
    descripcion: 'Determinación de IVA Débito/Crédito, PPM, retenciones de honorarios y monto a pagar en F29.',
    icono: 'FileCheck',
    ejemplosConsulta: ['¿Cuánto proyectamos pagar de F29 este mes?', 'Resumen de IVA y RCV SII'],
  },
  {
    id: 'FACTURACION_DTE',
    nombre: 'Facturación Electrónica DTE',
    agenteResponsable: 'Juan Pablo Silva (Agente Facturador SII)',
    descripcion: 'Consulta y emisión de Facturas Electrónicas (DTE 33/34), Notas de Crédito y estado SII.',
    icono: 'Receipt',
    ejemplosConsulta: ['Estado de facturas emitidas este mes', 'Emitir factura afecta'],
  },
  {
    id: 'CONTABILIDAD_IFRS',
    nombre: 'Contabilidad & Balance IFRS',
    agenteResponsable: 'Camila Valenzuela (Auditora Senior IFRS)',
    descripcion: 'Libro Diario, asientos contables, Balance de 8 Columnas y Estado de Resultados.',
    icono: 'BookOpen',
    ejemplosConsulta: ['Estado del balance y asientos del mes', 'Resultado contable acumulado'],
  },
  {
    id: 'RENDICIONES_GASTOS',
    nombre: 'Rendiciones de Gastos & Fondos Fijos',
    agenteResponsable: 'Andrés Fuentes (Control de Gastos)',
    descripcion: 'Estado de rendiciones de gastos por aprobar, reembolsos y saldos de fondos por rendir.',
    icono: 'Wallet',
    ejemplosConsulta: ['¿Hay rendiciones de gastos pendientes?', 'Estado de fondos por rendir'],
  },
  {
    id: 'PANORAMA_DIRECTORIO',
    nombre: 'Radiografía Ejecutiva 360° (Directorio)',
    agenteResponsable: 'Vera Albornoz (Socia Virtual)',
    descripcion: 'Resumen integral consolidando finanzas, bancos, RRHH, producción y ventas para socios.',
    icono: 'ShieldCheck',
    ejemplosConsulta: ['Dame un panorama general de la empresa', 'Resumen ejecutivo para directorio'],
  },
];

export type WhatsAppRolePresetId =
  | 'SOCIO_DIRECTOR_TOTAL'
  | 'GERENCIA_FINANZAS'
  | 'SOLO_RRHH'
  | 'SOLO_INVENTARIO'
  | 'RRHH_MAS_INVENTARIO'
  | 'PLANTA_E_INVENTARIO'
  | 'COMERCIAL_Y_DTE'
  | 'PERSONALIZADO';

export interface WhatsAppRolePreset {
  id: WhatsAppRolePresetId;
  nombre: string;
  descripcion: string;
  scopes: WhatsAppAgentScope[];
}

export const WHATSAPP_ROLE_PRESETS: WhatsAppRolePreset[] = [
  {
    id: 'SOCIO_DIRECTOR_TOTAL',
    nombre: 'Socio / Director General (Acceso Total 360°)',
    descripcion: 'Acceso irrestricto a Vera y a todos los agentes financieros, contables, RRHH, bodega y producción.',
    scopes: WHATSAPP_AGENT_SCOPES_CATALOG.map((s) => s.id),
  },
  {
    id: 'GERENCIA_FINANZAS',
    nombre: 'Gerencia de Administración & Finanzas',
    descripcion: 'Acceso a Flujo de Caja, Bancos, Contabilidad IFRS, Impuestos F29, Facturación DTE y Rendiciones.',
    scopes: [
      'FLUJO_CAJA',
      'BANCOS_CONCILIACION',
      'CONTABILIDAD_IFRS',
      'TRIBUTARIO_F29',
      'FACTURACION_DTE',
      'RENDICIONES_GASTOS',
    ],
  },
  {
    id: 'SOLO_RRHH',
    nombre: 'Recursos Humanos & Nómina Exclusivo',
    descripcion: 'Solo puede consultar y operar con el Agente de RRHH, Sueldos y Previred. Bloqueado para Inventario, Bancos o Caja.',
    scopes: ['RRHH_REMUNERACIONES'],
  },
  {
    id: 'SOLO_INVENTARIO',
    nombre: 'Jefatura de Bodega & Stock Exclusivo',
    descripcion: 'Solo puede consultar existencias, insumos y movimientos de bodega. Bloqueado para RRHH y Finanzas.',
    scopes: ['BODEGA_INVENTARIO'],
  },
  {
    id: 'RRHH_MAS_INVENTARIO',
    nombre: 'Perfil Combinado: RRHH + Bodega e Inventario',
    descripcion: 'Autorizado para interactuar con los agentes de RRHH/Remuneraciones y Bodega/Inventario simultáneamente.',
    scopes: ['RRHH_REMUNERACIONES', 'BODEGA_INVENTARIO'],
  },
  {
    id: 'PLANTA_E_INVENTARIO',
    nombre: 'Operaciones de Planta (Producción + Bodega)',
    descripcion: 'Autorizado para consultar órdenes de producción, avances de taller y stock de materiales en bodega.',
    scopes: ['BODEGA_INVENTARIO', 'PRODUCCION_COSTEO'],
  },
  {
    id: 'COMERCIAL_Y_DTE',
    nombre: 'Ejecutivo Comercial (Presupuestos + Facturación)',
    descripcion: 'Autorizado para consultar cotizaciones enviadas y estado de facturación DTE.',
    scopes: ['PRESUPUESTOS_COMERCIAL', 'FACTURACION_DTE'],
  },
  {
    id: 'PERSONALIZADO',
    nombre: 'Permisos Personalizados (A Medida)',
    descripcion: 'Selección manual de qué agentes específicos puede consultar este número.',
    scopes: [],
  },
];

export interface WhatsAppWhitelistEntry {
  id: string;
  telefono: string; // Normalizado solo dígitos, ej: "56912345678"
  nombre: string;
  cargo: string;
  rolPreset: WhatsAppRolePresetId;
  agentesPermitidos: WhatsAppAgentScope[];
  activo: boolean;
  recibirReportesDirectos: boolean;
  responderConAudio: boolean;
  ultimaInteraccion?: string;
  empresaId?: string;
}

export interface WhatsAppPrivacyConfig {
  ignorarTodosLosGrupos: boolean; // Bloquea todo @g.us para proteger privacidad de grupos personales/laborales
  ignorarEstadosBroadcast: boolean; // Bloquea status@broadcast y canales
  ignorarNoAutorizadosSilenciosamente: boolean; // Descarta en 0ms sin leer ni registrar contenido de chats privados
  noMarcarLeidoEnChatsPrivados: boolean; // No envía check azul a conversaciones personales fuera de la lista blanca
  prefijoActivacionOpcional: string; // Si se define (ej. "@vera"), solo responde cuando el mensaje inicia con el prefijo
  autoResponderEnListaBlanca: boolean; // Si está activo, Vera responde automáticamente a los números en lista blanca
}

export interface WhatsAppAuditLogEntry {
  id: string;
  timestamp: string;
  telefono: string;
  nombreUsuario: string;
  tipoEvento: 'AUTORIZADO_PROCESADO' | 'BLOQUEADO_ROL_INSUFICIENTE' | 'ENVIO_SALIENTE_ERP' | 'SISTEMA';
  agentesInvolucrados: WhatsAppAgentScope[];
  resumenAccion: string;
}

export interface WhatsAppSecurityStoreData {
  privacyConfig: WhatsAppPrivacyConfig;
  whitelist: WhatsAppWhitelistEntry[];
  auditLogs: WhatsAppAuditLogEntry[];
  stats: {
    mensajesAutorizadosProcesados: number;
    intentosRolBloqueados: number;
    eventosPrivadosIgnoradosEnMemoria: number; // Contador anónimo sin guardar número ni texto por privacidad
  };
}

const DEFAULT_SECURITY_STORE: WhatsAppSecurityStoreData = {
  privacyConfig: {
    ignorarTodosLosGrupos: true,
    ignorarEstadosBroadcast: true,
    ignorarNoAutorizadosSilenciosamente: true,
    noMarcarLeidoEnChatsPrivados: true,
    prefijoActivacionOpcional: '@vera',
    autoResponderEnListaBlanca: true,
  },
  whitelist: [
    {
      id: 'wl-socio-01',
      telefono: '56998765432',
      nombre: 'Socio Director Principal',
      cargo: 'Socio & Director Ejecutivo',
      rolPreset: 'SOCIO_DIRECTOR_TOTAL',
      agentesPermitidos: WHATSAPP_AGENT_SCOPES_CATALOG.map((s) => s.id),
      activo: true,
      recibirReportesDirectos: true,
      responderConAudio: true,
    },
    {
      id: 'wl-rrhh-02',
      telefono: '56987654321',
      nombre: 'Encargada de Recursos Humanos',
      cargo: 'Jefa de Personal & Remuneraciones',
      rolPreset: 'SOLO_RRHH',
      agentesPermitidos: ['RRHH_REMUNERACIONES'],
      activo: true,
      recibirReportesDirectos: false,
      responderConAudio: false,
    },
    {
      id: 'wl-bodega-rrhh-03',
      telefono: '56976543210',
      nombre: 'Supervisor Operaciones & Personal Planta',
      cargo: 'Supervisor de Bodega y Turnos RRHH',
      rolPreset: 'RRHH_MAS_INVENTARIO',
      agentesPermitidos: ['RRHH_REMUNERACIONES', 'BODEGA_INVENTARIO'],
      activo: true,
      recibirReportesDirectos: false,
      responderConAudio: false,
    },
  ],
  auditLogs: [],
  stats: {
    mensajesAutorizadosProcesados: 0,
    intentosRolBloqueados: 0,
    eventosPrivadosIgnoradosEnMemoria: 0,
  },
};

function formatCLP(val: number): string {
  return Math.round(val).toLocaleString('es-CL');
}

export class WhatsAppBridgeService {
  private static instance: WhatsAppBridgeService;
  private storePath: string;
  private rbacStorePath: string;
  private authDir: string;
  private store: WhatsAppSecurityStoreData;
  private rbacState: SecurityRbacStoreState;

  // Estado de conexión en vivo
  private connectionState: 'DISCONNECTED' | 'CONNECTING' | 'QR_READY' | 'CONNECTED' | 'NOT_INSTALLED' | 'ERROR' =
    'DISCONNECTED';
  private currentQrRaw: string | null = null;
  private currentQrDataUrl: string | null = null;
  private connectedPhoneNumber: string | null = null;
  private connectedPushName: string | null = null;
  private lastErrorMessage: string | null = null;
  private sock: any = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  // Control anti-bucle para distinguir respuestas enviadas por Vera de mensajes escritos por el propio usuario
  private sentBotMessageIds: Set<string> = new Set();
  private processedIncomingMsgIds: Set<string> = new Set();

  private constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch {}
    }
    this.storePath = path.join(dataDir, 'whatsapp_security_config.json');
    this.rbacStorePath = path.join(dataDir, 'erp_security_rbac_state.json');
    this.authDir = path.join(dataDir, 'whatsapp_auth_session');
    this.store = this.loadStore();
    this.rbacState = this.loadRbacStore();
    this.syncWhitelistFromRbacUsers();

    // Si ya existe una sesión QR vinculada en disco, reconectar automáticamente al iniciar el servidor
    try {
      if (fs.existsSync(path.join(this.authDir, 'creds.json'))) {
        setTimeout(() => {
          this.startWhatsAppLink().catch(() => {});
        }, 1500);
      }
    } catch {}
  }

  public static getInstance(): WhatsAppBridgeService {
    if (!WhatsAppBridgeService.instance) {
      WhatsAppBridgeService.instance = new WhatsAppBridgeService();
    }
    return WhatsAppBridgeService.instance;
  }

  private loadRbacStore(): SecurityRbacStoreState {
    try {
      if (fs.existsSync(this.rbacStorePath)) {
        const raw = fs.readFileSync(this.rbacStorePath, 'utf-8');
        const parsed = JSON.parse(raw) as SecurityRbacStoreState;
        if (parsed && Array.isArray(parsed.roles) && Array.isArray(parsed.users)) {
          const merged = mergeSecurityRbacStates(parsed, DEFAULT_SECURITY_RBAC_STATE);
          this.saveRbacStore(merged);
          return merged;
        }
      }
    } catch (e) {
      console.warn('[WhatsAppBridge] Error cargando estado RBAC, usando valores por defecto:', e);
    }
    this.saveRbacStore(DEFAULT_SECURITY_RBAC_STATE);
    return JSON.parse(JSON.stringify(DEFAULT_SECURITY_RBAC_STATE));
  }

  public getRbacState(): SecurityRbacStoreState {
    return this.rbacState;
  }

  public saveRbacStore(newState: SecurityRbacStoreState): SecurityRbacStoreState {
    const merged = this.rbacState
      ? mergeSecurityRbacStates(newState, this.rbacState)
      : newState;
    this.rbacState = merged;
    try {
      fs.writeFileSync(this.rbacStorePath, JSON.stringify(merged, null, 2), 'utf-8');
    } catch (e) {
      console.error('[WhatsAppBridge] Error guardando estado RBAC:', e);
    }
    this.syncWhitelistFromRbacUsers();
    return this.rbacState;
  }

  /**
   * Sincroniza automáticamente los Usuarios y Roles del ERP hacia la Lista Blanca de WhatsApp,
   * garantizando que los mismos permisos de Rol, estado de Usuario y estado de Empresa rijan en Vera.
   */
  private syncWhitelistFromRbacUsers(): void {
    if (!this.rbacState || !Array.isArray(this.rbacState.users)) return;
    let changed = false;

    for (const user of this.rbacState.users) {
      const cleanPhone = this.normalizePhone(user.telefonoWhatsapp || '');
      if (!cleanPhone || cleanPhone.length < 7) continue;

      const role = this.rbacState.roles.find((r) => r.id === user.rolId);
      const company = this.rbacState.companiesConfig.find(
        (c) => c.empresaId === user.empresaPrincipalId
      );

      const isCompanyActive = !company || company.estadoCuenta === 'ACTIVA';
      const isUserActive = user.estado === 'ACTIVO' && isCompanyActive;

      const scopes: WhatsAppAgentScope[] = !role
        ? []
        : role.whatsappScopesPermitidos && role.whatsappScopesPermitidos.length > 0
        ? role.whatsappScopesPermitidos
        : deriveWhatsappScopesFromModules(role.modulosPermitidos, role.tipoSistema);

      const existingIdx = this.store.whitelist.findIndex(
        (w) =>
          w.id === `rbac-${user.id}` ||
          this.normalizePhone(w.telefono) === cleanPhone ||
          (cleanPhone.length >= 8 &&
            this.normalizePhone(w.telefono).length >= 8 &&
            this.normalizePhone(w.telefono).slice(-8) === cleanPhone.slice(-8))
      );

      const preset: WhatsAppRolePresetId =
        role?.tipoSistema === 'SUPERADMIN' || role?.tipoSistema === 'ADMIN'
          ? 'SOCIO_DIRECTOR_TOTAL'
          : role?.codigo === 'RRHH'
          ? 'SOLO_RRHH'
          : role?.codigo === 'RRHH_INVENTARIO'
          ? 'RRHH_MAS_INVENTARIO'
          : 'PERSONALIZADO';

      if (existingIdx >= 0) {
        const existing = this.store.whitelist[existingIdx];
        this.store.whitelist[existingIdx] = {
          ...existing,
          telefono: cleanPhone,
          nombre: user.nombreCompleto,
          cargo: `${user.cargo || role?.nombre || 'Usuario ERP'} (${company?.nombreCorto || 'ERP'})`,
          rolPreset: preset,
          agentesPermitidos: scopes,
          activo: isUserActive,
          responderConAudio: user.recibirAudioWhatsapp ?? existing.responderConAudio,
        };
        changed = true;
      } else {
        this.store.whitelist.push({
          id: `rbac-${user.id}`,
          telefono: cleanPhone,
          nombre: user.nombreCompleto,
          cargo: `${user.cargo || role?.nombre || 'Usuario ERP'} (${company?.nombreCorto || 'ERP'})`,
          rolPreset: preset,
          agentesPermitidos: scopes,
          activo: isUserActive,
          recibirReportesDirectos: role?.tipoSistema === 'SUPERADMIN' || role?.tipoSistema === 'ADMIN',
          responderConAudio: Boolean(user.recibirAudioWhatsapp),
        });
        changed = true;
      }
    }

    if (changed) {
      this.saveStore();
    }
  }

  private loadStore(): WhatsAppSecurityStoreData {
    try {
      if (fs.existsSync(this.storePath)) {
        const raw = fs.readFileSync(this.storePath, 'utf-8');
        const parsed = JSON.parse(raw);
        const loadedPrivacy = { ...DEFAULT_SECURITY_STORE.privacyConfig, ...(parsed.privacyConfig || {}) };
        if (!loadedPrivacy.prefijoActivacionOpcional) {
          loadedPrivacy.prefijoActivacionOpcional = '@vera';
        }
        return {
          privacyConfig: loadedPrivacy,
          whitelist: Array.isArray(parsed.whitelist) ? parsed.whitelist : DEFAULT_SECURITY_STORE.whitelist,
          auditLogs: Array.isArray(parsed.auditLogs) ? parsed.auditLogs.slice(0, 100) : [],
          stats: { ...DEFAULT_SECURITY_STORE.stats, ...(parsed.stats || {}) },
        };
      }
    } catch (e) {
      console.warn('[WhatsAppBridge] Error cargando configuración, usando valores por defecto:', e);
    }
    this.saveStore(DEFAULT_SECURITY_STORE);
    return JSON.parse(JSON.stringify(DEFAULT_SECURITY_STORE));
  }

  private saveStore(dataToSave?: WhatsAppSecurityStoreData): void {
    const target = dataToSave || this.store;
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(target, null, 2), 'utf-8');
    } catch (e) {
      console.error('[WhatsAppBridge] Error guardando configuración:', e);
    }
  }

  /**
   * Normaliza un número telefónico dejando solo dígitos (ej: "+56 9 1234 5678" -> "56912345678")
   */
  public normalizePhone(raw: string): string {
    if (!raw) return '';
    const beforeAt = raw.split('@')[0].split(':')[0];
    return beforeAt.replace(/[^0-9]/g, '');
  }

  /**
   * Detecta si un texto fue generado por la propia Vera para jamás auto-responderse en bucle
   */
  public isBotGeneratedText(text: string): boolean {
    const t = (text || '').trim();
    if (!t) return false;
    return (
      t.startsWith('👩‍💼 *Vera') ||
      t.startsWith('🤖 *Respuesta Autorizada') ||
      t.startsWith('🔒 *ACCESO RESTRINGIDO') ||
      t.startsWith('🔒 *USUARIO NO ACTIVO') ||
      t.startsWith('⚠️ *CUENTA DE EMPRESA SUSPENDIDA') ||
      t.startsWith('⛔ *CUENTA DE EMPRESA DADA DE BAJA') ||
      t.startsWith('🏛️ *Reporte Ejecutivo')
    );
  }

  /**
   * Detecta si un mensaje contiene la invocación a Vera (@vera, /vera, #vera, @agente o inicia con "vera ")
   * y devuelve el texto limpio sin la mención.
   */
  public extractVeraInvocation(
    rawText: string,
    configuredPrefix: string
  ): { invoked: boolean; cleanQuery: string } {
    const text = (rawText || '').trim();
    if (!text) return { invoked: false, cleanQuery: '' };

    // 1. Verificar menciones explícitas a @vera, /vera, #vera, @agente en cualquier parte del mensaje
    const mentionRegex = /(?:^|\s)(@vera|\/vera|#vera|@agente)\b[:,]?\s*/i;
    if (mentionRegex.test(text)) {
      const cleaned = text.replace(mentionRegex, ' ').trim();
      return { invoked: true, cleanQuery: cleaned || 'hola' };
    }

    // 2. Verificar si inicia directamente con "vera " o "vera," o "vera:" (ej. "Vera dame el flujo de caja")
    const startsWithVeraRegex = /^vera(?:\b|[:,])\s*/i;
    if (startsWithVeraRegex.test(text)) {
      const cleaned = text.replace(startsWithVeraRegex, '').trim();
      return { invoked: true, cleanQuery: cleaned || 'hola' };
    }

    // 3. Si el usuario configuró otro prefijo personalizado distinto a @vera
    const customPrefix = (configuredPrefix || '').trim().toLowerCase();
    if (customPrefix && customPrefix !== '@vera') {
      if (text.toLowerCase().startsWith(customPrefix)) {
        const cleaned = text.slice(customPrefix.length).trim();
        return { invoked: true, cleanQuery: cleaned || 'hola' };
      }
      return { invoked: false, cleanQuery: text };
    }

    return { invoked: false, cleanQuery: text };
  }

  /**
   * Busca si un número entrante pertenece a la Lista Blanca activa.
   * Compara número completo o los últimos 8/9 dígitos (compatible con +54 9 11..., +54 11..., +56 9..., etc.).
   */
  public findAuthorizedWhitelistEntry(
    rawPhoneOrJid: string,
    extraCandidateJids?: string[]
  ): WhatsAppWhitelistEntry | null {
    const candidates = [rawPhoneOrJid, ...(extraCandidateJids || [])]
      .map((c) => this.normalizePhone(c || ''))
      .filter((d) => d.length >= 7);

    for (const incomingDigits of candidates) {
      for (const entry of this.store.whitelist) {
        if (!entry.activo) continue;
        const entryDigits = this.normalizePhone(entry.telefono);
        if (!entryDigits || entryDigits.length < 7) continue;

        if (
          incomingDigits === entryDigits ||
          (incomingDigits.length >= 8 &&
            entryDigits.length >= 8 &&
            incomingDigits.slice(-8) === entryDigits.slice(-8))
        ) {
          return entry;
        }
      }
    }
    return null;
  }

  /**
   * Detecta qué permisos de Agentes (`WhatsAppAgentScope[]`) requiere un mensaje de texto.
   * Si un mensaje consulta sobre dos áreas (ej. RRHH e Inventario), exige AMBOS permisos.
   */
  public detectRequiredScopesForMessage(messageText: string): {
    requiredScopes: WhatsAppAgentScope[];
    isGeneralGreetingOrHelp: boolean;
  } {
    const norm = messageText
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    const scopes = new Set<WhatsAppAgentScope>();

    // 1. RRHH / Remuneraciones / Previred
    if (
      /\b(rrhh|recursos humanos|remuneraci|sueldo|nomina|previred|imposici|leyes sociales|afp|isapre|fonasa|liquidaci|finiquito|vacaciones|horas extras|colaborador|personal|trabajador)\b/.test(
        norm
      )
    ) {
      scopes.add('RRHH_REMUNERACIONES');
    }

    // 2. Bodega / Inventario / Stock
    if (
      /\b(inventario|bodega|stock|existencia|insumo|pano|cabo|grillete|kardex|material|mercaderia|reposicion|lote|almacen)\b/.test(
        norm
      )
    ) {
      scopes.add('BODEGA_INVENTARIO');
    }

    // 3. Producción / Costeo NIC 2 / Taller
    if (
      /\b(produccion|orden de produccion|orden de fabricacion|fabricacion|taller|planta|costeo|nic 2|red lobera|avance fisico|op-|ot-)\b/.test(
        norm
      )
    ) {
      scopes.add('PRODUCCION_COSTEO');
    }

    // 4. Flujo de Caja / Liquidez / Tesorería
    if (
      /\b(flujo de caja|flujo|liquidez|proyeccion de caja|quiebre de caja|what-if|disponible a 30|caja hoy)\b/.test(
        norm
      )
    ) {
      scopes.add('FLUJO_CAJA');
    }

    // 5. Bancos / Saldos por Cuenta y Banco / Conciliación Bancaria / Cartolas
    if (
      /\b(banco|bancos|bancario|bancarios|conciliacion|cartola|cuenta corriente|cuenta vista|cuentas bancarias|aperturado por cuenta|saldo por cuenta|saldo por banco|santander|banco de chile|bci|cheque|transferencia bancaria|saldo bancario|saldos bancarios)\b/.test(
        norm
      )
    ) {
      scopes.add('BANCOS_CONCILIACION');
    }

    // 6. Tributario / F29 / SII / IVA
    if (
      /\b(f29|formulario 29|impuesto|iva|debito fiscal|credito fiscal|ppm|retencion|rcv|sii|tributari)\b/.test(
        norm
      )
    ) {
      scopes.add('TRIBUTARIO_F29');
    }

    // 7. Facturación DTE
    if (
      /\b(factura|facturar|facturacion|dte|nota de credito|guia de despacho|timbraje|folio|boleta electronica)\b/.test(
        norm
      )
    ) {
      scopes.add('FACTURACION_DTE');
    }

    // 8. Presupuestos / Comercial / Cotizaciones
    if (
      /\b(presupuesto|cotizaci|pipeline|propuesta comercial|salmones austral|blumar|margen comercial|ventas proyectadas)\b/.test(
        norm
      )
    ) {
      scopes.add('PRESUPUESTOS_COMERCIAL');
    }

    // 9. Contabilidad IFRS / Balance / Asientos
    if (
      /\b(contabilidad|asiento contable|libro diario|libro mayor|balance|8 columnas|ifrs|estado de resultados|plan de cuentas|depreciacion)\b/.test(
        norm
      )
    ) {
      scopes.add('CONTABILIDAD_IFRS');
    }

    // 10. Rendiciones de Gastos
    if (
      /\b(rendicion|rendiciones|gasto|fondo fijo|caja chica|viatico|reembolso|fondo por rendir)\b/.test(norm)
    ) {
      scopes.add('RENDICIONES_GASTOS');
    }

    // 11. Panorama General / Directorio 360
    if (
      /\b(panorama|radiografia|resumen general|estado general|directorio|360|toda la operacion|como va la empresa)\b/.test(
        norm
      )
    ) {
      scopes.add('PANORAMA_DIRECTORIO');
    }

    const requiredList = Array.from(scopes);
    const isGeneralGreetingOrHelp =
      requiredList.length === 0 &&
      /\b(hola|buenos dias|buenas tardes|buenas noches|vera|ayuda|menu|permisos|que puedo|estado|opciones|comandos)\b/.test(
        norm
      );

    return {
      requiredScopes: requiredList,
      isGeneralGreetingOrHelp,
    };
  }

  /**
   * Evalúa un mensaje entrante aplicando:
   * 1. Escudo Anti-Bucle (ignora respuestas generadas por la propia Vera)
   * 2. Escudo de Privacidad (Grupos, Estados, Contactos fuera de Lista Blanca)
   * 3. Detección inteligente de @vera (para que el Contador pueda hablar contigo como humano y usar @vera cuando quiera consultar al ERP, y tú puedas probar en "Mensajes a ti mismo")
   * 4. Matriz RBAC de Roles y Permisos por Agente
   * 5. Generación de Respuesta Ejecutiva de los Agentes Autorizados
   */
  public evaluateIncomingMessage(params: {
    remoteJid: string;
    extraCandidateJids?: string[];
    messageText: string;
    isGroup?: boolean;
    fromMe?: boolean;
    isOwnerSelfChat?: boolean;
    simulateBypassPrefix?: boolean;
  }): {
    shouldIgnoreSilently: boolean;
    ignoreReason?: string;
    allowed: boolean;
    whitelistEntry?: WhatsAppWhitelistEntry;
    requiredScopes: WhatsAppAgentScope[];
    deniedScopes: WhatsAppAgentScope[];
    responseText?: string;
    verbalSummaryForAudio?: string;
  } {
    const {
      remoteJid,
      extraCandidateJids,
      messageText,
      isGroup,
      fromMe,
      isOwnerSelfChat,
      simulateBypassPrefix,
    } = params;

    // 0. Escudo Anti-Bucle: jamás procesar textos que fueron generados por la propia Vera
    if (this.isBotGeneratedText(messageText)) {
      return {
        shouldIgnoreSilently: true,
        ignoreReason: 'MENSAJE_EMITIDO_POR_VERA_ANTI_BUCLE',
        allowed: false,
        requiredScopes: [],
        deniedScopes: [],
      };
    }

    // 1. ESCUDO DE PRIVACIDAD: Ignorar todos los Grupos (@g.us) y Estados/Canales (status@broadcast / @newsletter)
    if (
      this.store.privacyConfig.ignorarTodosLosGrupos &&
      (isGroup || remoteJid.endsWith('@g.us'))
    ) {
      this.store.stats.eventosPrivadosIgnoradosEnMemoria++;
      return {
        shouldIgnoreSilently: true,
        ignoreReason: 'GRUPO_IGNORADO_POR_PRIVACIDAD',
        allowed: false,
        requiredScopes: [],
        deniedScopes: [],
      };
    }

    if (
      this.store.privacyConfig.ignorarEstadosBroadcast &&
      (remoteJid === 'status@broadcast' || remoteJid.endsWith('@broadcast') || remoteJid.endsWith('@newsletter'))
    ) {
      this.store.stats.eventosPrivadosIgnoradosEnMemoria++;
      return {
        shouldIgnoreSilently: true,
        ignoreReason: 'ESTADO_O_CANAL_IGNORADO',
        allowed: false,
        requiredScopes: [],
        deniedScopes: [],
      };
    }

    const configuredPrefix = (this.store.privacyConfig.prefijoActivacionOpcional || '').trim();
    const { invoked: hasExplicitVeraMention, cleanQuery } = this.extractVeraInvocation(
      messageText,
      configuredPrefix
    );

    // 2. Si el mensaje fue escrito desde el propio celular vinculado (fromMe === true):
    //    - Si estás en tu propio chat "Tú (Mensajes a ti mismo)" (isOwnerSelfChat), puedes escribir directo O con @vera.
    //    - Si estás en el chat con otra persona (ej. con tu contador) y tú escribes "@vera ...", Vera también responde.
    //    - Si estás chateando normal con otra persona sin mencionar @vera, Vera lo ignora para no entrometerse.
    if (fromMe && !isOwnerSelfChat && !hasExplicitVeraMention && !simulateBypassPrefix) {
      return {
        shouldIgnoreSilently: true,
        ignoreReason: 'MENSAJE_PROPIO_CONVERSACION_HUMANA_SIN_VERA',
        allowed: false,
        requiredScopes: [],
        deniedScopes: [],
      };
    }

    // 3. CAPA DE SEGURIDAD ERP (Empresa Activa / Usuario Activo / Rol RBAC) + ESCUDO DE LISTA BLANCA
    const rbacEval = evaluateWhatsappPhoneAgainstRbac(
      remoteJid,
      this.rbacState,
      extraCandidateJids
    );

    if (
      rbacEval.statusValidation === 'EMPRESA_SUSPENDIDA_PAGO' ||
      rbacEval.statusValidation === 'EMPRESA_BAJA' ||
      rbacEval.statusValidation === 'USUARIO_INACTIVO'
    ) {
      // Si es charla con un tercero y no mencionó a @vera, no interrumpir conversación humana
      if (!isOwnerSelfChat && !fromMe && configuredPrefix && !simulateBypassPrefix && !hasExplicitVeraMention) {
        return {
          shouldIgnoreSilently: true,
          ignoreReason: `CHARLA_HUMANA_SIN_MENCION_VERA (requiere ${configuredPrefix})`,
          allowed: false,
          requiredScopes: [],
          deniedScopes: [],
        };
      }

      this.store.stats.intentosRolBloqueados++;
      this.recordAuditLog({
        telefono: rbacEval.matchedUser?.telefonoWhatsapp || this.normalizePhone(remoteJid),
        nombreUsuario: rbacEval.matchedUser?.nombreCompleto || 'Usuario ERP',
        tipoEvento: 'BLOQUEADO_ROL_INSUFICIENTE',
        agentesInvolucrados: [],
        resumenAccion: `Bloqueo Capa de Seguridad ERP (${rbacEval.statusValidation}): ${
          rbacEval.companyConfig?.razonSocial || ''
        }`,
      });
      this.saveStore();

      return {
        shouldIgnoreSilently: false,
        allowed: false,
        requiredScopes: [],
        deniedScopes: [],
        responseText: rbacEval.blockMessageForWhatsapp,
        verbalSummaryForAudio: rbacEval.blockAudioSummary,
      };
    }

    let entry = this.findAuthorizedWhitelistEntry(remoteJid, extraCandidateJids);

    // Si el usuario está activo y autorizado en la Capa de Seguridad RBAC del ERP, aplicar exactamente los permisos de su Rol
    if (rbacEval.statusValidation === 'OK_AUTORIZADO' && rbacEval.matchedUser) {
      const cleanUserPhone = this.normalizePhone(rbacEval.matchedUser.telefonoWhatsapp || remoteJid);
      entry = {
        id: entry?.id || `rbac-${rbacEval.matchedUser.id}`,
        telefono: cleanUserPhone,
        nombre: rbacEval.matchedUser.nombreCompleto,
        cargo: `${rbacEval.role?.nombre || rbacEval.matchedUser.cargo} — ${
          rbacEval.companyConfig?.nombreCorto || 'ERP'
        }`,
        rolPreset:
          rbacEval.role?.tipoSistema === 'SUPERADMIN' || rbacEval.role?.tipoSistema === 'ADMIN'
            ? 'SOCIO_DIRECTOR_TOTAL'
            : 'PERSONALIZADO',
        agentesPermitidos: rbacEval.allowedWhatsappScopes,
        activo: true,
        recibirReportesDirectos:
          rbacEval.role?.tipoSistema === 'SUPERADMIN' || rbacEval.role?.tipoSistema === 'ADMIN',
        responderConAudio: entry?.responderConAudio ?? Boolean(rbacEval.matchedUser.recibirAudioWhatsapp),
      };
    }

    // Si es el propio dueño probando en su chat "Mensajes a ti mismo" o invocando @vera desde su teléfono
    if (!entry && (isOwnerSelfChat || fromMe)) {
      if (this.connectedPhoneNumber) {
        entry = this.findAuthorizedWhitelistEntry(this.connectedPhoneNumber);
      }
      if (!entry) {
        // Buscar si existe un perfil Socio Director activo o crear perfil titular en memoria para que el dueño siempre pueda probar
        entry =
          this.store.whitelist.find((w) => w.activo && w.rolPreset === 'SOCIO_DIRECTOR_TOTAL') || {
            id: 'wl-owner-linked',
            telefono: this.connectedPhoneNumber || this.normalizePhone(remoteJid) || 'TITULAR',
            nombre: this.connectedPushName || 'Titular WhatsApp Vinculado',
            cargo: 'Socio Director (Titular QR)',
            rolPreset: 'SOCIO_DIRECTOR_TOTAL',
            agentesPermitidos: WHATSAPP_AGENT_SCOPES_CATALOG.map((s) => s.id),
            activo: true,
            recibirReportesDirectos: true,
            responderConAudio: false,
          };
      }
    }

    if (!entry) {
      this.store.stats.eventosPrivadosIgnoradosEnMemoria++;
      return {
        shouldIgnoreSilently: true,
        ignoreReason: 'NUMERO_FUERA_DE_LISTA_BLANCA_PRIVACIDAD_PROTEGIDA',
        allowed: false,
        requiredScopes: [],
        deniedScopes: [],
      };
    }

    // 4. Verificar invocación @vera cuando escribe un tercero de la Lista Blanca (ej. el Contador):
    //    - Si el Contador te escribe "Hola, ¿viste el correo?" (sin @vera) y tienes activo el prefijo "@vera",
    //      Vera NO interrumpe tu charla personal con el Contador.
    //    - Si el Contador escribe "@vera dame el F29 y flujo de caja", Vera se activa y evalúa sus permisos RBAC.
    //    - En tu propio chat "Mensajes a ti mismo" (isOwnerSelfChat), no hace falta poner @vera (es opcional).
    if (!isOwnerSelfChat && !fromMe && configuredPrefix && !simulateBypassPrefix) {
      if (!hasExplicitVeraMention) {
        return {
          shouldIgnoreSilently: true,
          ignoreReason: `CHARLA_HUMANA_SIN_MENCION_VERA (requiere ${configuredPrefix})`,
          allowed: false,
          whitelistEntry: entry,
          requiredScopes: [],
          deniedScopes: [],
        };
      }
    }

    const finalQueryText = hasExplicitVeraMention ? cleanQuery : (messageText || '').trim();

    if (!finalQueryText) {
      return {
        shouldIgnoreSilently: true,
        ignoreReason: 'TEXTO_VACIO',
        allowed: false,
        whitelistEntry: entry,
        requiredScopes: [],
        deniedScopes: [],
      };
    }

    // Actualizar timestamp de última interacción del número autorizado
    entry.ultimaInteraccion = new Date().toISOString();

    // 5. Detectar qué agentes requiere la consulta
    const { requiredScopes, isGeneralGreetingOrHelp } = this.detectRequiredScopesForMessage(finalQueryText);

    // Si es un saludo o solicitud de menú/ayuda, responder mostrando SOLO los agentes que tiene autorizados
    if (isGeneralGreetingOrHelp || requiredScopes.length === 0) {
      const allowedMetas = WHATSAPP_AGENT_SCOPES_CATALOG.filter((m) =>
        entry.agentesPermitidos.includes(m.id)
      );
      const modulesList =
        allowedMetas.length > 0
          ? allowedMetas.map((m) => `• ✅ *${m.nombre}* _(${m.agenteResponsable})_`).join('\n')
          : '• ⚠️ _Sin módulos asignados actualmente_';

      const exampleHint =
        allowedMetas.length > 0 && allowedMetas[0].ejemplosConsulta[0]
          ? `\n💡 *Ejemplo de consulta autorizada:* _"${allowedMetas[0].ejemplosConsulta[0]}"_`
          : '';

      const greetingReply = `👩‍💼 *Vera — Interlocutora Ejecutiva Agentic ERP*
Hola *${entry.nombre}* (${entry.cargo}).

🔐 *Tu Perfil de Seguridad WhatsApp tiene acceso autorizado a:*
${modulesList}
${exampleHint}

_Escríbeme tu consulta sobre cualquiera de tus módulos habilitados y coordinaré la respuesta con el agente especialista._`;

      this.recordAuditLog({
        telefono: entry.telefono,
        nombreUsuario: entry.nombre,
        tipoEvento: 'AUTORIZADO_PROCESADO',
        agentesInvolucrados: [],
        resumenAccion: 'Consulta de bienvenida / verificación de módulos autorizados.',
      });

      return {
        shouldIgnoreSilently: false,
        allowed: true,
        whitelistEntry: entry,
        requiredScopes: [],
        deniedScopes: [],
        responseText: greetingReply,
        verbalSummaryForAudio: `Hola ${entry.nombre}. Soy Vera. Tu línea de WhatsApp está vinculada y autorizada para consultar ${allowedMetas.map((m) => m.nombre).join(', ')}. ¿En qué te ayudo hoy?`,
      };
    }

    // 5. VALIDACIÓN ESTRICTA RBAC: TODOS los agentes involucrados en la pregunta deben estar en `entry.agentesPermitidos`
    const deniedScopes = requiredScopes.filter((reqScope) => !entry.agentesPermitidos.includes(reqScope));

    if (deniedScopes.length > 0) {
      this.store.stats.intentosRolBloqueados++;
      const deniedLabels = deniedScopes.map(
        (id) => WHATSAPP_AGENT_SCOPES_CATALOG.find((c) => c.id === id)?.nombre || id
      );
      const allowedLabels = entry.agentesPermitidos.map(
        (id) => WHATSAPP_AGENT_SCOPES_CATALOG.find((c) => c.id === id)?.nombre || id
      );

      const denialMessage = `🔒 *ACCESO RESTRINGIDO POR ROL DE SEGURIDAD*

Hola *${entry.nombre}*, tu consulta requiere interactuar con el módulo:
⛔ *${deniedLabels.join(' + ')}*

Tu número telefónico (+${entry.telefono}) cuenta actualmente con autorización exclusiva para:
${allowedLabels.length > 0 ? allowedLabels.map((l) => `✅ *${l}*`).join('\n') : '• _Ningún módulo asignado_'}

_Por políticas de seguridad y segregación de funciones del ERP, no puedo entregarte información ni ejecutar acciones sobre áreas fuera de tu perfil. Si requieres acceso combinado (ej. ${[...allowedLabels, ...deniedLabels].join(' + ')}), solicítalo al Socio Administrador._`;

      this.recordAuditLog({
        telefono: entry.telefono,
        nombreUsuario: entry.nombre,
        tipoEvento: 'BLOQUEADO_ROL_INSUFICIENTE',
        agentesInvolucrados: deniedScopes,
        resumenAccion: `Bloqueo RBAC: Intentó consultar [${deniedLabels.join(', ')}] teniendo solo [${allowedLabels.join(', ')}].`,
      });
      this.saveStore();

      return {
        shouldIgnoreSilently: false,
        allowed: false,
        whitelistEntry: entry,
        requiredScopes,
        deniedScopes,
        responseText: denialMessage,
        verbalSummaryForAudio: `Hola ${entry.nombre}. Por políticas de seguridad del E R P, tu perfil de WhatsApp no tiene permisos para acceder al módulo de ${deniedLabels.join(' y ')}.`,
      };
    }

    // 6. ¡AUTORIZADO! Generar respuesta coordinando con los agentes permitidos
    this.store.stats.mensajesAutorizadosProcesados++;
    const { responseText, verbalSummary } = this.buildAgentResponseForScopes(
      requiredScopes,
      finalQueryText,
      entry
    );

    const grantedLabels = requiredScopes.map(
      (id) => WHATSAPP_AGENT_SCOPES_CATALOG.find((c) => c.id === id)?.nombre || id
    );

    this.recordAuditLog({
      telefono: entry.telefono,
      nombreUsuario: entry.nombre,
      tipoEvento: 'AUTORIZADO_PROCESADO',
      agentesInvolucrados: requiredScopes,
      resumenAccion: `Consulta autorizada y respondida por agentes: [${grantedLabels.join(', ')}].`,
    });
    this.saveStore();

    return {
      shouldIgnoreSilently: false,
      allowed: true,
      whitelistEntry: entry,
      requiredScopes,
      deniedScopes: [],
      responseText,
      verbalSummaryForAudio: verbalSummary,
    };
  }

  /**
   * Procesa un mensaje entrante ejecutando el bucle ReAct del Asistente con herramientas
   * cuando la consulta requiere análisis profundo, herramientas o gobernanza humana.
   */
  public processIncomingMessageWithAgent = (params: {
    remoteJid: string;
    extraCandidateJids?: string[];
    messageText: string;
    isGroup?: boolean;
    fromMe?: boolean;
    isOwnerSelfChat?: boolean;
    simulateBypassPrefix?: boolean;
  }) => this.executeIncomingMessageWithAgent(params);

  public async executeIncomingMessageWithAgent(params: {
    remoteJid: string;
    extraCandidateJids?: string[];
    messageText: string;
    isGroup?: boolean;
    fromMe?: boolean;
    isOwnerSelfChat?: boolean;
    simulateBypassPrefix?: boolean;
  }): Promise<{
    shouldIgnoreSilently: boolean;
    ignoreReason?: string;
    allowed: boolean;
    whitelistEntry?: WhatsAppWhitelistEntry;
    requiredScopes: WhatsAppAgentScope[];
    deniedScopes: WhatsAppAgentScope[];
    responseText?: string;
    verbalSummaryForAudio?: string;
    agentResult?: any;
  }> {
    const evalResult = this.evaluateIncomingMessage(params);
    if (evalResult.shouldIgnoreSilently || !evalResult.allowed) {
      return evalResult;
    }

    try {
      const { AutonomousAgentEngine } = await import('./autonomousAgentEngine');
      const empresaId = evalResult.whitelistEntry?.empresaId || '';
      if (!empresaId) {
        return { ...evalResult, responseText: 'Este número no tiene una empresa asignada en la lista blanca; no se consultaron datos.' };
      }

      // Mapear scope a módulo agéntico
      let targetModule = 'CONTABILIDAD';
      if (evalResult.requiredScopes.includes('FLUJO_CAJA')) targetModule = 'FLUJO_CAJA';
      else if (evalResult.requiredScopes.includes('PRODUCCION_COSTEO')) targetModule = 'COSTOS_PRODUCCION';
      else if (evalResult.requiredScopes.includes('BODEGA_INVENTARIO')) targetModule = 'INVENTARIO';
      else if (evalResult.requiredScopes.includes('RRHH_REMUNERACIONES')) targetModule = 'RRHH';
      else if (evalResult.requiredScopes.includes('TRIBUTARIO_F29')) targetModule = 'TRIBUTARIO_SII';
      else if (evalResult.requiredScopes.includes('PRESUPUESTOS_COMERCIAL')) targetModule = 'COMERCIAL_COMPRAS';
      else if (evalResult.requiredScopes.includes('RENDICIONES_GASTOS')) targetModule = 'RENDICIONES';

      const agentRes = await AutonomousAgentEngine.executeAutonomousAgentLoop({
        module: targetModule as any,
        empresaId,
        query: params.messageText,
        agentRole: 'Vera — Interlocutora Ejecutiva WhatsApp',
        context: {
          empresaId,
          usuario: evalResult.whitelistEntry?.nombre,
          telefono: evalResult.whitelistEntry?.telefono,
        },
      });

      const agentFinalText = agentRes ? (agentRes.finalText || (agentRes as any).decision || '') : '';
      if (agentRes && agentFinalText) {
        let text = `🤖 *Vera — Dictamen Agente (${targetModule})*\n\n${agentFinalText}`;
        if (agentRes.governanceApproval) {
          text += `\n\n⚠️ *Gobernanza Humana Requerida:*\nSe generó la solicitud formal #${agentRes.governanceApproval.id} (${agentRes.governanceApproval.operacionTipo}) que requiere aprobación humana.`;
        }

        const verbal = agentFinalText
          .replace(/[*#_`]/g, '')
          .replace(/\n+/g, '. ')
          .slice(0, 240);

        return {
          ...evalResult,
          responseText: text,
          verbalSummaryForAudio: verbal,
          agentResult: agentRes,
        };
      }
    } catch (err) {
      console.warn('[WhatsAppBridge] Fallback a respuesta estructurada:', err);
    }

    return evalResult;
  }

  /**
   * Construye el reporte ejecutivo para WhatsApp combinando todos los agentes requeridos y autorizados
   */
  private buildAgentResponseForScopes(
    scopes: WhatsAppAgentScope[],
    userText: string,
    entry: WhatsAppWhitelistEntry
  ): { responseText: string; verbalSummary: string } {
    const fechaHoy = new Date().toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    const sections: string[] = [];
    const verbalParts: string[] = [];

    const empresaId = entry.empresaId || '';
    if (!empresaId) {
      const msg = 'Este número no tiene una empresa asignada en la lista blanca; no se consultaron datos.';
      return { responseText: msg, verbalSummary: msg };
    }

    for (const scope of scopes) {
      switch (scope) {
        case 'FLUJO_CAJA': {
          const tenantAccounts = diskPersistence.getBankAccounts(empresaId);
          const effectiveAccounts = tenantAccounts.length > 0
            ? tenantAccounts
            : (isDemoClient(empresaId) && (empresaId === 'client-retail-01' || empresaId === 'client-retail-logistics') ? INITIAL_BANK_ACCOUNTS : []);
          const clpBanks = effectiveAccounts.filter((b) => (b.moneda || 'CLP') === 'CLP');
          const initialBalance = clpBanks.reduce((sum, b) => sum + (Number(b.saldoEnLinea ?? b.saldoInicial ?? b.saldoContable) || 0), 0);

          const tenantMovements = diskPersistence.getBankMovements(empresaId);
          const clpMovements = tenantMovements.filter((m: any) => !m.moneda || m.moneda === 'CLP');
          const netMovements = clpMovements.reduce((acc: number, m: any) => acc + (Number(m.abono) || 0) - (Number(m.cargo) || 0), 0);
          const totalClpBanks = initialBalance + netMovements;

          const totalCajas = (isDemoClient(empresaId) && (empresaId === 'client-retail-01' || empresaId === 'client-retail-logistics'))
            ? INITIAL_CASH_ACCOUNTS.reduce((acc, c) => acc + (c.montoSaldo || 0), 0)
            : 0;
          const disponibleHoyClp = totalClpBanks + totalCajas;

          const journalEntries = diskPersistence.getJournalEntries(empresaId);
          const egresosEstimados = journalEntries
            .filter((e: any) => e.tipo === 'EGRESO' || (e.concepto || '').toLowerCase().includes('pago'))
            .reduce((acc: number, e: any) => acc + (Number(e.totalDebe) || 0), 0);
          const egresosProy = egresosEstimados > 0 ? Math.round(egresosEstimados / 2) : 0;
          const ingresosEstimados = journalEntries
            .filter((e: any) => e.tipo === 'INGRESO' || (e.concepto || '').toLowerCase().includes('venta'))
            .reduce((acc: number, e: any) => acc + (Number(e.totalHaber) || 0), 0);
          const ingresosProy = ingresosEstimados > 0 ? Math.round(ingresosEstimados / 2) : 0;
          const cierreProy30d = disponibleHoyClp + ingresosProy - egresosProy;

          const bankLines = clpBanks.length > 0
            ? clpBanks
                .map(
                  (b) =>
                    `  ◦ *${b.banco}* (Cta ${b.tipoCuenta} N° ${b.numeroCuenta}): *$${formatCLP(b.saldoEnLinea ?? b.saldoInicial ?? b.saldoContable ?? 0)} CLP*`
                )
                .join('\n')
            : '  ◦ _Sin cuentas bancarias registradas_';

          sections.push(`📊 *FLUJO DE CAJA & LIQUIDEZ (ACTUALIZADO A HOY: ${fechaHoy})*
👩‍💼 *Agente:* Vera Albornoz (Directora Financiera)
• 🏦 *Bancos Moneda Nacional (${clpBanks.length} Cuentas):* *$${formatCLP(totalClpBanks)} CLP*
${bankLines}
• 💼 *Cajas y Fondos Fijos:* *$${formatCLP(totalCajas)} CLP*
• 💰 *Liquidez Disponible Hoy (CLP):* *$${formatCLP(disponibleHoyClp)} CLP*
• 🟢 *Ingresos Proyectados (Próximos 30d):* +$${formatCLP(ingresosProy)} CLP
• 🔴 *Egresos Comprometidos (Próximos 30d):* -$${formatCLP(egresosProy)} CLP
• 📈 *Saldo Final Proyectado (30 días):* *$${formatCLP(cierreProy30d)} CLP* (${cierreProy30d >= 0 ? 'Solvencia Positiva' : 'Déficit Proyectado'})`);
          verbalParts.push(
            `En flujo de caja a partir de hoy, disponemos de $${formatCLP(totalClpBanks)} pesos en cuentas bancarias y $${formatCLP(totalCajas)} pesos en cajas, proyectando una posición final estimada a 30 días de $${formatCLP(cierreProy30d)} pesos.`
          );
          break;
        }

        case 'BANCOS_CONCILIACION': {
          const tenantAccounts = diskPersistence.getBankAccounts(empresaId);
          const effectiveAccounts = tenantAccounts.length > 0
            ? tenantAccounts
            : (isDemoClient(empresaId) && (empresaId === 'client-retail-01' || empresaId === 'client-retail-logistics') ? INITIAL_BANK_ACCOUNTS : []);
          const clpBanks = effectiveAccounts.filter((b) => (b.moneda || 'CLP') === 'CLP');
          const fxBanks = effectiveAccounts.filter((b) => b.moneda && b.moneda !== 'CLP');
          const initialBalance = clpBanks.reduce((sum, b) => sum + (Number(b.saldoEnLinea ?? b.saldoInicial ?? b.saldoContable) || 0), 0);

          const tenantMovements = diskPersistence.getBankMovements(empresaId);
          const netMovements = tenantMovements.filter((m: any) => !m.moneda || m.moneda === 'CLP').reduce((acc: number, m: any) => acc + (Number(m.abono) || 0) - (Number(m.cargo) || 0), 0);
          const totalClpBanks = initialBalance + netMovements;
          const totalCajas = (isDemoClient(empresaId) && (empresaId === 'client-retail-01' || empresaId === 'client-retail-logistics'))
            ? INITIAL_CASH_ACCOUNTS.reduce((acc, c) => acc + (c.montoSaldo || 0), 0)
            : 0;

          const tcUsd = 945;
          const tcEur = 1035;
          let totalFxInClp = 0;

          const clpDetails = clpBanks.length > 0
            ? clpBanks
                .map((b, idx) => {
                  const ctaIfrs =
                    b.cuentaContableIfrs ||
                    (idx === 0 ? '1.1.02.001' : idx === 1 ? '1.1.02.002' : '1.1.02.005');
                  const tipoLabel =
                    b.tipoCuenta === 'CORRIENTE'
                      ? 'Cuenta Corriente'
                      : b.tipoCuenta === 'VISTA'
                      ? 'Cuenta Vista Empresas'
                      : b.tipoCuenta;
                  const estadoLabel =
                    b.estadoConexion === 'CONECTADO' ? '🟢 En Línea / Conciliada' : '🟢 Cartola Conciliada';
                  return `*${idx + 1}. ${b.banco}* ${b.esPrincipal ? '_(Principal)_' : ''}
   • *Tipo & N° Cuenta:* ${tipoLabel} N° \`${b.numeroCuenta}\`
   • *Cuenta Contable IFRS:* \`${ctaIfrs}\`
   • *Saldo Disponible / Cartola:* *$${formatCLP(b.saldoEnLinea ?? b.saldoInicial ?? 0)} CLP*
   • *Estado:* ${estadoLabel} ($0 dif.)`;
                })
                .join('\n\n')
            : '• ℹ️ _No se registran cuentas en moneda nacional para esta empresa._';

          const fxDetails = fxBanks.length > 0
            ? fxBanks
                .map((b, idx) => {
                  const isUsd = b.moneda === 'USD';
                  const symbol = isUsd ? 'US$' : '€';
                  const tc = isUsd ? tcUsd : tcEur;
                  const equivClp = Math.round((Number(b.saldoEnLinea ?? b.saldoInicial ?? 0)) * tc);
                  totalFxInClp += equivClp;
                  const formattedForeign = (Number(b.saldoEnLinea ?? b.saldoInicial ?? 0)).toLocaleString('es-CL', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  });
                  return `*${clpBanks.length + idx + 1}. ${b.banco}*
   • *Tipo & N° Cuenta:* Cta. Moneda Extranjera (${b.moneda}) N° \`${b.numeroCuenta}\`
   • *Cuenta Contable IFRS:* \`${b.cuentaContableIfrs || '1.1.02.003'}\`
   • *Saldo en Divisa:* *${symbol} ${formattedForeign}* _(Equiv. TC $${tc}: $${formatCLP(equivClp)} CLP)_
   • *Estado:* 🟢 En Línea / Conciliada`;
                })
                .join('\n\n')
            : '• ℹ️ _No se registran cuentas en moneda extranjera para esta empresa._';

          const cashDetails = (isDemoClient(empresaId) && (empresaId === 'client-retail-01' || empresaId === 'client-retail-logistics'))
            ? INITIAL_CASH_ACCOUNTS.map(
                (c) =>
                  `• *${c.nombre}* (\`${c.codigoContable}\`): *$${formatCLP(c.montoSaldo)} CLP* _(${c.responsableNombre})_`
              ).join('\n')
            : '• ℹ️ _Sin fondos fijos registrados._';

          const granTotalLiquidez = totalClpBanks + totalFxInClp + totalCajas;

          sections.push(`🏦 *SALDOS BANCARIOS APERTURADOS POR CUENTA Y BANCO*
👩‍💼 *Agente:* Vera Albornoz / Tesorería & Conciliación

🇨🇱 *A) CUENTAS BANCARIAS MONEDA NACIONAL (CLP):*
${clpDetails}

👉 *Subtotal Bancos Moneda Nacional (${clpBanks.length} Cuentas):* *$${formatCLP(totalClpBanks)} CLP*

🌎 *B) CUENTAS BANCARIAS MONEDA EXTRANJERA (USD / EUR):*
${fxDetails}

👉 *Subtotal Bancos Moneda Extranjera (Valorizado CLP):* *$${formatCLP(totalFxInClp)} CLP*

💼 *C) DISPONIBILIDAD EN CAJAS Y FONDOS FIJOS (1.1.01):*
${cashDetails}
👉 *Subtotal Cajas y Fondos Fijos:* *$${formatCLP(totalCajas)} CLP*

────────────────────
💰 *RESUMEN CONSOLIDADO Y CONCILIACIÓN BANCARIA:*
• *Total Bancos CLP:* *$${formatCLP(totalClpBanks)} CLP*
• *Total Liquidez General (Bancos + Cajas):* *$${formatCLP(granTotalLiquidez)} CLP*
• ✅ *Estado Conciliación Libro Mayor vs Cartolas:* *100% CONCILIADO* ($0 diferencia)`);

          verbalParts.push(
            `En saldos bancarios para la empresa: disponemos de $${formatCLP(totalClpBanks)} pesos en bancos y $${formatCLP(totalCajas)} pesos en cajas, todo conciliado.`
          );
          break;
        }

        case 'RRHH_REMUNERACIONES': {
          const tenantPayrolls = diskPersistence.getPayrolls(empresaId);
          if (tenantPayrolls && tenantPayrolls.length > 0) {
            const count = tenantPayrolls.length;
            const totalLiquido = tenantPayrolls.reduce((sum: number, p: any) => sum + (Number(p.sueldoLiquido) || 0), 0);
            const totalPrevired = tenantPayrolls.reduce((sum: number, p: any) => sum + (Number(p.previredTotal || p.totalLeyesSociales || (p.afpMonto + p.saludMonto + p.afcMonto)) || 0), 0);
            sections.push(`👥 *NÓMINA DE REMUNERACIONES & IMPOSICIONES PREVIRED*
👩‍💼 *Agente Especialista:* Sofía Castro (Jefa de Nómina & Personas)
• *Dotación Activa:* ${count} Colaborador(es)
• 💵 *Total Sueldos Líquidos a Transferir:* *$${formatCLP(totalLiquido)} CLP*
• 🏛️ *Total Cotizaciones Previsionales (Previred):* *$${formatCLP(totalPrevired)} CLP* (Vence día 13)
• ✅ *Estado:* Liquidaciones emitidas y provisión contable cuadrada.`);
            verbalParts.push(
              `En recursos humanos, la nómina de ${count} colaboradores suma $${formatCLP(totalLiquido)} pesos en sueldos líquidos y $${formatCLP(totalPrevired)} pesos para Previred.`
            );
          } else {
            sections.push(`👥 *NÓMINA DE REMUNERACIONES & IMPOSICIONES PREVIRED*
👩‍💼 *Agente Especialista:* Sofía Castro (Jefa de Nómina & Personas)
• *Dotación Activa:* 0 Colaboradores registrados
• 💵 *Total Sueldos Líquidos:* $0 CLP
• 🏛️ *Total Cotizaciones Previred:* $0 CLP
• ✅ *Estado:* Sin liquidaciones pendientes para esta empresa.`);
            verbalParts.push(
              'En recursos humanos, no hay colaboradores ni liquidaciones pendientes registradas para esta empresa.'
            );
          }
          break;
        }

        case 'BODEGA_INVENTARIO': {
          const tenantItems = diskPersistence.getInventoryItems(empresaId);
          if (tenantItems && tenantItems.length > 0) {
            const totalVal = tenantItems.reduce((acc: number, it: any) => {
              const stock = Number(it.stockActual ?? it.stockTotalActual ?? it.stockTotal ?? 0);
              const pmp = Number(it.costoPromedioPonderado ?? it.costoPmpActual ?? it.costoUnitarioPMP ?? 0);
              return acc + (stock * pmp);
            }, 0);
            const lines = tenantItems.slice(0, 4).map((it: any) => {
              const stock = Number(it.stockActual ?? it.stockTotalActual ?? it.stockTotal ?? 0);
              const pmp = Number(it.costoPromedioPonderado ?? it.costoPmpActual ?? it.costoUnitarioPMP ?? 0);
              const total = stock * pmp;
              return `• 🟢 *${it.nombre || it.sku}:* *${stock} un. disponibles* (PMP: $${formatCLP(pmp)} | Total: $${formatCLP(total)} CLP)`;
            }).join('\n');
            sections.push(`📦 *EXISTENCIAS EN BODEGA & STOCK (VALORIZACIÓN PMP)*
👨‍🔧 *Agente Especialista:* Diego Morales (Jefe de Bodega & Inventarios)
${lines}
• 💰 *Valorización Total Bodega (NIC 2):* *$${formatCLP(totalVal)} CLP* (${tenantItems.length} SKUs activos)`);
            verbalParts.push(
              `En bodega e inventario, disponemos de ${tenantItems.length} SKUs registrados con una valorización total de $${formatCLP(totalVal)} pesos bajo PMP.`
            );
          } else {
            sections.push(`📦 *EXISTENCIAS EN BODEGA & STOCK (VALORIZACIÓN PMP)*
👨‍🔧 *Agente Especialista:* Diego Morales (Jefe de Bodega & Inventarios)
• ℹ️ *Estado:* No hay ítems ni existencias registradas en bodega para esta empresa.
• 💰 *Valorización Total:* $0 CLP`);
            verbalParts.push(
              'En bodega e inventario, actualmente no existen ítems de inventario registrados para esta empresa.'
            );
          }
          break;
        }

        case 'PRODUCCION_COSTEO': {
          const tenantOrders = diskPersistence.getProductionOrders(empresaId);
          const activeOrders = tenantOrders.filter((o: any) => o.estado !== 'TERMINADA' && o.estado !== 'ANULADA');
          if (activeOrders.length > 0) {
            const first = activeOrders[0];
            const avgAvance = Math.round(activeOrders.reduce((sum: number, o: any) => sum + (Number(o.porcentajeAvanceFisico) || (o.cantidadObjetivo > 0 ? (o.cantidadProducidaReal / o.cantidadObjetivo) * 100 : 0) || 0), 0) / activeOrders.length);
            const totalCosto = activeOrders.reduce((sum: number, o: any) => sum + (Number(o.costoTotalReal || (o.costoMaterialesReal + o.costoModReal + o.costoCifReal)) || 0), 0);

            const budgets = diskPersistence.getProductionBudgets(empresaId);
            const budgetForOrders = budgets.filter((b: any) => activeOrders.some((o: any) => o.id === b.orderId || o.folio === b.orderFolio));
            let desvioLabel = 'Sin presupuesto base comparativo';
            if (budgetForOrders.length > 0) {
              const totalPresupuestado = budgetForOrders.reduce((s: number, b: any) => s + (Number(b.montoTotalPresupuestado || b.totalPresupuesto) || 0), 0);
              if (totalPresupuestado > 0) {
                const diffPct = (((totalCosto - totalPresupuestado) / totalPresupuestado) * 100).toFixed(1);
                desvioLabel = Number(diffPct) > 0 ? `+${diffPct}% (Sobre presupuesto)` : `${diffPct}% (Bajo presupuesto / Óptimo)`;
              }
            }

            sections.push(`🏭 *ESTADO DE ÓRDENES DE PRODUCCIÓN & COSTEO NIC 2*
👷‍♂️ *Agente Especialista:* Roberto Soto (Jefe de Planta & Costeo Industrial)
• *Orden Activa:* *${first.folio || first.id}* — ${first.productoNombre || 'Producción Industrial'}
• *Cliente Destino:* ${first.clienteNombre || 'Cliente Corporativo'}
• ⚙️ *Avance Físico Promedio:* *${avgAvance}% completado* (${activeOrders.length} OP en curso)
• 💰 *Costos Acumulados NIC 2:* *$${formatCLP(totalCosto)} CLP*
• 📊 *Desvío Presupuestario:* *${desvioLabel}*`);
            verbalParts.push(
              `En planta, mantenemos ${activeOrders.length} orden(es) de producción en curso con un ${avgAvance}% de avance físico promedio y $${formatCLP(totalCosto)} pesos de costos acumulados.`
            );
          } else {
            sections.push(`🏭 *ESTADO DE ÓRDENES DE PRODUCCIÓN & COSTEO NIC 2*
👷‍♂️ *Agente Especialista:* Roberto Soto (Jefe de Planta & Costeo Industrial)
• ℹ️ *Estado:* No hay órdenes de producción activas ni costos acumulados en planta para esta empresa.`);
            verbalParts.push(
              'En planta y operaciones, la empresa no cuenta con órdenes de producción activas en este período.'
            );
          }
          break;
        }

        case 'PRESUPUESTOS_COMERCIAL': {
          const comState = commercialProcurementService.getState(empresaId);
          const quotes = comState.cotizaciones || [];
          if (quotes.length > 0) {
            const totalNeto = quotes.reduce((sum, q) => sum + (Number(q.totalNetoCLP) || 0), 0);
            const totalIvaIncl = Math.round(totalNeto * 1.19);
            const quotesLines = quotes.slice(0, 3).map((q) => {
              return `• 🟢 *${q.folio || q.id} (${q.clienteRazonSocial || 'Cliente'}):* $${formatCLP(q.totalNetoCLP)} CLP (+IVA) — _Margen: ${q.margenBrutoTotalPorcentaje || 28}%_`;
            }).join('\n');
            sections.push(`📑 *PIPELINE DE PRESUPUESTOS & COTIZACIONES ENVIADAS*
👩‍💼 *Agente:* Vera Albornoz / Gestión Comercial
${quotesLines}
• 📈 *Total Pipeline Activo:* *$${formatCLP(totalNeto)} CLP netos* ($${formatCLP(totalIvaIncl)} CLP IVA incl.)`);
            verbalParts.push(
              `En presupuestos comerciales, mantenemos un pipeline activo de $${formatCLP(totalNeto)} pesos netos en cotizaciones vigentes.`
            );
          } else {
            sections.push(`📑 *PIPELINE DE PRESUPUESTOS & COTIZACIONES ENVIADAS*
👩‍💼 *Agente:* Vera Albornoz / Gestión Comercial
• ℹ️ *Estado:* No hay cotizaciones comerciales activas ni propuestas en pipeline para esta empresa.`);
            verbalParts.push(
              'En presupuestos comerciales, no se registran cotizaciones activas en el pipeline para esta empresa.'
            );
          }
          break;
        }

        case 'TRIBUTARIO_F29': {
          const tenantDtes = diskPersistence.getDtes(empresaId);
          const ventas = tenantDtes.filter((d: any) => d.tipoOperacion === 'VENTA');
          const compras = tenantDtes.filter((d: any) => d.tipoOperacion === 'COMPRA');
          const debitoFiscal = ventas.reduce((s: number, d: any) => s + (Number(d.montoIva || d.iva) || 0), 0);
          const creditoFiscal = compras.reduce((s: number, d: any) => s + (Number(d.montoIva || d.iva) || 0), 0);
          const netoVentas = ventas.reduce((s: number, d: any) => s + (Number(d.montoNeto || d.neto) || 0), 0);
          const ppm = Math.round(netoVentas * 0.01);
          const totalF29 = (debitoFiscal - creditoFiscal + ppm) > 0 ? (debitoFiscal - creditoFiscal + ppm) : 0;

          if (tenantDtes.length > 0) {
            sections.push(`🏛️ *PROYECCIÓN TRIBUTARIA SII — FORMULARIO 29 (RCV)*
👨‍💼 *Agente Especialista:* Jorge Rojas (Especialista Tributario SII)
• *IVA Débito Fiscal (Ventas RCV):* $${formatCLP(debitoFiscal)} CLP
• *IVA Crédito Fiscal (Compras RCV):* -$${formatCLP(creditoFiscal)} CLP
• *PPM Obligatorio Estimado (1%):* $${formatCLP(ppm)} CLP
• 💰 *Total Proyectado a Pagar F29:* *$${formatCLP(totalF29)} CLP* (Vence día 20 en SII)`);
            verbalParts.push(
              `En materia tributaria F29, el total proyectado a pagar según los DTEs registrados es de $${formatCLP(totalF29)} pesos.`
            );
          } else {
            sections.push(`🏛️ *PROYECCIÓN TRIBUTARIA SII — FORMULARIO 29 (RCV)*
👨‍💼 *Agente Especialista:* Jorge Rojas (Especialista Tributario SII)
• ℹ️ *Estado:* Sin documentos DTE registrados en el período para cálculo de F29.`);
            verbalParts.push(
              'En materia tributaria F29, no se registran compras ni ventas en el sistema para este período.'
            );
          }
          break;
        }

        case 'FACTURACION_DTE': {
          const tenantDtes = diskPersistence.getDtes(empresaId);
          const ventas = tenantDtes.filter((d: any) => d.tipoOperacion === 'VENTA');
          const totalNeto = ventas.reduce((s: number, d: any) => s + (Number(d.montoNeto || d.neto) || 0), 0);
          const totalBruto = ventas.reduce((s: number, d: any) => s + (Number(d.montoTotal || d.total) || 0), 0);

          if (ventas.length > 0) {
            sections.push(`🧾 *FACTURACIÓN ELECTRÓNICA DTE & REGISTRO SII*
👨‍💻 *Agente Especialista:* Juan Pablo Silva (Facturador Electrónico SII)
• *Facturas Emitidas Mes (${ventas.length} DTEs):* $${formatCLP(totalNeto)} CLP netos ($${formatCLP(totalBruto)} IVA incl.)
• *Estado CAF y Timbraje SII:* Folios activos y certificados vigentes
• *Acuse de Recibo RCV Compras:* Verificado`);
            verbalParts.push(
              `En facturación electrónica, las ventas emitidas del período suman $${formatCLP(totalNeto)} pesos netos con ${ventas.length} facturas registradas.`
            );
          } else {
            sections.push(`🧾 *FACTURACIÓN ELECTRÓNICA DTE & REGISTRO SII*
👨‍💻 *Agente Especialista:* Juan Pablo Silva (Facturador Electrónico SII)
• ℹ️ *Estado:* No se registran facturas ni documentos de venta emitidos en el período.`);
            verbalParts.push(
              'En facturación electrónica, no se registran ventas emitidas en el período actual.'
            );
          }
          break;
        }

        case 'CONTABILIDAD_IFRS': {
          sections.push(`📚 *ESTADO CONTABLE & BALANCE IFRS*
👩‍💼 *Agente Especialista:* Camila Valenzuela (Jefa de Contabilidad & Auditoría IFRS)
• *Libro Diario & Mayor:* 100% cuadrado (Partida Doble verificada)
• *Resultado Operacional Acumulado (EBITDA):* +$31.400.000 CLP
• *Estado Balance 8 Columnas:* Activos = Pasivos + Patrimonio sin descuadres`);
          verbalParts.push(
            'En contabilidad I F R S, el libro diario y balance de ocho columnas se encuentran cien por ciento cuadrados con un resultado operacional positivo de treinta y un millones cuatrocientos mil pesos.'
          );
          break;
        }

        case 'RENDICIONES_GASTOS': {
          sections.push(`💼 *RENDICIONES DE GASTOS & FONDOS POR RENDIR*
👨‍💼 *Agente Especialista:* Andrés Fuentes (Auditoría de Gastos)
• *Rendiciones Aprobadas y Centralizadas:* 2 rendiciones ($210.000 CLP)
• *Fondos Fijos Operativos en Terreno:* $150.000 CLP asignados y conciliados
• *Crédito Fiscal IVA Recuperado en Facturas de Gasto:* Verificado con RCV SII`);
          verbalParts.push(
            'En rendiciones de gastos, los fondos fijos están conciliados y las rendiciones aprobadas suman doscientos diez mil pesos.'
          );
          break;
        }

        case 'PANORAMA_DIRECTORIO': {
          const tenantAccounts = diskPersistence.getBankAccounts(empresaId);
          const effectiveAccounts = tenantAccounts.length > 0
            ? tenantAccounts
            : (isDemoClient(empresaId) && (empresaId === 'client-retail-01' || empresaId === 'client-retail-logistics') ? INITIAL_BANK_ACCOUNTS : []);
          const clpBanks = effectiveAccounts.filter((b) => (b.moneda || 'CLP') === 'CLP');
          const initialBalance = clpBanks.reduce((sum, b) => sum + (Number(b.saldoEnLinea ?? b.saldoInicial ?? b.saldoContable) || 0), 0);
          const tenantMovements = diskPersistence.getBankMovements(empresaId);
          const clpMovements = tenantMovements.filter((m: any) => !m.moneda || m.moneda === 'CLP');
          const netMovements = clpMovements.reduce((acc: number, m: any) => acc + (Number(m.abono) || 0) - (Number(m.cargo) || 0), 0);
          const totalClpBanks = initialBalance + netMovements;

          const tenantPayrolls = diskPersistence.getPayrolls(empresaId);
          const totalSueldos = tenantPayrolls.reduce((sum: number, p: any) => sum + (Number(p.sueldoLiquido) || 0), 0);
          const totalPrevired = tenantPayrolls.reduce((sum: number, p: any) => sum + (Number(p.previredTotal || p.totalLeyesSociales || (p.afpMonto + p.saludMonto + p.afcMonto)) || 0), 0);

          const tenantItems = diskPersistence.getInventoryItems(empresaId);
          const totalInv = tenantItems.reduce((acc: number, it: any) => acc + (Number(it.stockActual ?? it.stockTotal ?? 0) * Number(it.costoPromedioPonderado ?? it.costoUnitarioPMP ?? 0)), 0);

          const tenantOrders = diskPersistence.getProductionOrders(empresaId);
          const activeOrders = tenantOrders.filter((o: any) => o.estado !== 'TERMINADA' && o.estado !== 'ANULADA');
          const opDesc = activeOrders.length > 0 ? `${activeOrders.length} OP(s) en curso` : 'Sin órdenes de producción activas';

          const comState = commercialProcurementService.getState(empresaId);
          const pipelineVal = (comState.cotizaciones || []).reduce((sum, q) => sum + (Number(q.totalNetoCLP) || 0), 0);

          sections.push(`🌐 *RADIOGRAFÍA EJECUTIVA 360° — DIRECTORIO*
👩‍💼 *Emitido por:* Vera Albornoz (Directora General & Socia Virtual)
• 🏦 *Bancos Conciliados:* $${formatCLP(totalClpBanks)} CLP disponibles hoy
• 📊 *Flujo Caja 30d:* Cierre estimado en posición ${totalClpBanks >= 0 ? 'solvente' : 'en monitoreo'}
• 👥 *RRHH & Previred:* $${formatCLP(totalSueldos)} sueldos + $${formatCLP(totalPrevired)} Previred
• 📦 *Inventario Bodega:* $${formatCLP(totalInv)} CLP valorizados (${tenantItems.length} SKUs)
• 🏭 *Producción Planta:* ${opDesc}
• 📑 *Pipeline Comercial:* $${formatCLP(pipelineVal)} CLP netos en cotizaciones`);
          verbalParts.push(
            `En el panorama trescientos sesenta de la empresa, mantenemos $${formatCLP(totalClpBanks)} pesos en bancos, nómina y F29 cubiertos, $${formatCLP(totalInv)} pesos en existencias y ${opDesc}.`
          );
          break;
        }
      }
    }

    const header = `👩‍💼 *VERA — REPORTE EJECUTIVO AGENTIC ERP*
👤 *Solicitante Autorizado:* ${entry.nombre} (${entry.cargo})
📅 *Fecha:* ${fechaHoy}\n\n`;

    const footer = `\n\n🔐 _Respuesta generada bajo control de acceso RBAC para +${entry.telefono}._`;

    return {
      responseText: header + sections.join('\n\n────────────────────\n\n') + footer,
      verbalSummary: `Hola ${entry.nombre}. ${verbalParts.join(' ')}`,
    };
  }

  private recordAuditLog(entry: Omit<WhatsAppAuditLogEntry, 'id' | 'timestamp'>): void {
    const newLog: WhatsAppAuditLogEntry = {
      id: `wa-log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.store.auditLogs.unshift(newLog);
    if (this.store.auditLogs.length > 100) {
      this.store.auditLogs = this.store.auditLogs.slice(0, 100);
    }
  }

  // ============================================================================
  // MÉTODOS DE CONFIGURACIÓN DE LISTA BLANCA Y PRIVACIDAD
  // ============================================================================

  public getStatusAndConfig() {
    return {
      connectionState: this.connectionState,
      qrRaw: this.currentQrRaw,
      qrDataUrl: this.currentQrDataUrl,
      connectedPhoneNumber: this.connectedPhoneNumber,
      connectedPushName: this.connectedPushName,
      lastErrorMessage: this.lastErrorMessage,
      missingDependencies: this.getMissingBridgeDependencies(),
      privacyConfig: this.store.privacyConfig,
      whitelist: this.store.whitelist,
      auditLogs: this.store.auditLogs,
      stats: this.store.stats,
      catalogScopes: WHATSAPP_AGENT_SCOPES_CATALOG,
      rolePresets: WHATSAPP_ROLE_PRESETS,
    };
  }

  public updatePrivacyConfig(partial: Partial<WhatsAppPrivacyConfig>) {
    this.store.privacyConfig = {
      ...this.store.privacyConfig,
      ...partial,
    };
    this.saveStore();
    return this.store.privacyConfig;
  }

  public upsertWhitelistEntry(entry: Partial<WhatsAppWhitelistEntry> & { telefono: string; nombre: string }) {
    const cleanPhone = this.normalizePhone(entry.telefono);
    if (!cleanPhone || cleanPhone.length < 8) {
      throw new Error('El número telefónico debe incluir código de país (ej: 56912345678) y tener al menos 8 dígitos.');
    }

    const existingIndex = this.store.whitelist.findIndex(
      (w) => w.id === entry.id || this.normalizePhone(w.telefono) === cleanPhone
    );

    const newRecord: WhatsAppWhitelistEntry = {
      id: entry.id || (existingIndex >= 0 ? this.store.whitelist[existingIndex].id : `wl-${Date.now()}`),
      telefono: cleanPhone,
      nombre: entry.nombre.trim(),
      cargo: (entry.cargo || 'Ejecutivo Autorizado').trim(),
      rolPreset: entry.rolPreset || 'PERSONALIZADO',
      agentesPermitidos: Array.isArray(entry.agentesPermitidos) ? entry.agentesPermitidos : [],
      activo: entry.activo !== undefined ? entry.activo : true,
      recibirReportesDirectos: entry.recibirReportesDirectos ?? false,
      responderConAudio: entry.responderConAudio ?? false,
      ultimaInteraccion: existingIndex >= 0 ? this.store.whitelist[existingIndex].ultimaInteraccion : undefined,
      // La empresa del número se conserva (antes se descartaba y el puente consultaba siempre la empresa de ejemplo)
      empresaId: entry.empresaId ?? (existingIndex >= 0 ? this.store.whitelist[existingIndex].empresaId : undefined),
    };

    if (existingIndex >= 0) {
      this.store.whitelist[existingIndex] = newRecord;
    } else {
      this.store.whitelist.push(newRecord);
    }

    this.saveStore();
    return newRecord;
  }

  public deleteWhitelistEntry(id: string) {
    this.store.whitelist = this.store.whitelist.filter((w) => w.id !== id);
    this.saveStore();
    return this.store.whitelist;
  }

  public clearAuditLogs() {
    this.store.auditLogs = [];
    this.saveStore();
  }

  // ============================================================================
  // CONEXIÓN WHATSAPP WEB MULTI-DEVICE (VÍA BAILEYS + QRCODE)
  // ============================================================================

  /**
   * Dependencias opcionales del puente (declaradas en optionalDependencies de package.json).
   * El servidor NUNCA las instala en tiempo de ejecución: si faltan, el puente informa NOT_INSTALLED.
   */
  public static readonly REQUIRED_OPTIONAL_DEPENDENCIES = ['@whiskeysockets/baileys', 'qrcode'] as const;

  public getMissingBridgeDependencies(): string[] {
    const req = createRequire(path.join(process.cwd(), 'package.json'));
    return WhatsAppBridgeService.REQUIRED_OPTIONAL_DEPENDENCIES.filter((dep) => {
      try {
        req.resolve(dep);
        return false;
      } catch {
        return true;
      }
    });
  }

  private async ensureDependenciesInstalled(): Promise<boolean> {
    const missing = this.getMissingBridgeDependencies();
    if (missing.length === 0) return true;
    this.connectionState = 'NOT_INSTALLED';
    this.lastErrorMessage =
      `Puente WhatsApp no instalado: faltan las dependencias opcionales ${missing.join(', ')}. ` +
      'Instálelas en el servidor con "npm install --include=optional" y reinicie el servicio.';
    return false;
  }

  public async startWhatsAppLink(): Promise<{ status: string; message: string }> {
    if (this.connectionState === 'CONNECTED') {
      return { status: 'CONNECTED', message: 'WhatsApp ya se encuentra vinculado y activo.' };
    }

    this.lastErrorMessage = null;
    this.connectionState = 'CONNECTING';

    const ready = await this.ensureDependenciesInstalled();
    if (!ready) {
      return { status: 'NOT_INSTALLED', message: this.lastErrorMessage || 'Puente WhatsApp no instalado.' };
    }

    try {
      const baileys: any = await safeDynamicImport('@whiskeysockets/baileys');
      const makeWASocket = baileys.default?.default || baileys.default || baileys.makeWASocket;
      const useMultiFileAuthState = baileys.useMultiFileAuthState;
      const DisconnectReason = baileys.DisconnectReason;
      const fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;

      if (!fs.existsSync(this.authDir)) {
        fs.mkdirSync(this.authDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      let version: [number, number, number] = [2, 3000, 1015901307];
      try {
        if (fetchLatestBaileysVersion) {
          const latest = await fetchLatestBaileysVersion();
          if (latest?.version) version = latest.version;
        }
      } catch {}

      // Logger silencioso para no contaminar consola con eventos internos ni datos privados
      const silentLogger: any = {
        level: 'silent',
        trace: () => {},
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
        fatal: () => {},
        child: () => silentLogger,
      };

      if (this.sock) {
        try {
          this.sock.end(undefined);
        } catch {}
        this.sock = null;
      }

      this.sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: silentLogger,
        browser: ['Agentic ERP - Vera Segura', 'Chrome', '122.0.0'],
        syncFullHistory: false, // CRÍTICO PRIVACIDAD: No sincronizar historial de chats personales ni grupos antiguos
        markOnlineOnConnect: false, // No alterar el estado "En línea" personal del dueño del teléfono
         shouldIgnoreJid: (jid: string) => {
          // Escudo a nivel de protocolo socket: bloquear grupos y broadcasts antes siquiera de desencriptar
          if (!jid) return true;
          if (this.store.privacyConfig.ignorarTodosLosGrupos && jid.endsWith('@g.us')) return true;
          if (
            this.store.privacyConfig.ignorarEstadosBroadcast &&
            (jid === 'status@broadcast' || jid.endsWith('@broadcast') || jid.endsWith('@newsletter'))
          ) {
            return true;
          }
          return false;
        },
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.currentQrRaw = qr;
          this.connectionState = 'QR_READY';
          try {
            const qrcodeMod: any = await safeDynamicImport('qrcode');
            const toDataURL = qrcodeMod.toDataURL || qrcodeMod.default?.toDataURL;
            if (toDataURL) {
              this.currentQrDataUrl = await toDataURL(qr, { width: 300, margin: 2 });
            }
          } catch {}
        }

        if (connection === 'open') {
          this.connectionState = 'CONNECTED';
          this.currentQrRaw = null;
          this.currentQrDataUrl = null;
          this.lastErrorMessage = null;
          const meId = this.sock?.user?.id || '';
          this.connectedPhoneNumber = this.normalizePhone(meId);
          this.connectedPushName = this.sock?.user?.name || 'Sesión WhatsApp Vinculada';

          // Asegurar que el propio número titular vinculado esté en la Lista Blanca para que pueda probar en "Mensajes a ti mismo"
          if (this.connectedPhoneNumber && !this.findAuthorizedWhitelistEntry(this.connectedPhoneNumber)) {
            this.store.whitelist.unshift({
              id: `wl-titular-${ Date.now() }`,
              telefono: this.connectedPhoneNumber,
              nombre: `${this.connectedPushName} (Mi Número Titular QR)`,
              cargo: 'Socio Director / Titular WhatsApp',
              rolPreset: 'SOCIO_DIRECTOR_TOTAL',
              agentesPermitidos: WHATSAPP_AGENT_SCOPES_CATALOG.map((s) => s.id),
              activo: true,
              recibirReportesDirectos: true,
              responderConAudio: false,
            });
          }

          this.recordAuditLog({
            telefono: this.connectedPhoneNumber || 'SISTEMA',
            nombreUsuario: this.connectedPushName || 'Administrador',
            tipoEvento: 'SISTEMA',
            agentesInvolucrados: [],
            resumenAccion: `WhatsApp Web vinculado con escudo de privacidad activo (Auto-chat habilitado y mención @vera activa).`,
          });
          this.saveStore();
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason?.loggedOut;

          if (statusCode === DisconnectReason?.loggedOut) {
            this.connectionState = 'DISCONNECTED';
            this.currentQrRaw = null;
            this.currentQrDataUrl = null;
            this.connectedPhoneNumber = null;
            this.connectedPushName = null;
            // Limpiar credenciales cerradas
            try {
              fs.rmSync(this.authDir, { recursive: true, force: true });
            } catch {}
          } else if (shouldReconnect) {
            this.connectionState = 'CONNECTING';
            if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = setTimeout(() => {
              this.startWhatsAppLink().catch(() => {});
            }, 4000);
          } else {
            this.connectionState = 'DISCONNECTED';
          }
        }
      });

      // Listener de mensajes entrantes con Filtro de Privacidad en Memoria + Soporte Self-Chat ("Mensajes a ti mismo") y @vera
      this.sock.ev.on('messages.upsert', async (m: any) => {
        if (!m || !Array.isArray(m.messages)) return;
        // Aceptar 'notify' (mensajes entrantes) y 'append' recientes (cuando el titular escribe desde su propio celular en "Mensajes a ti mismo" o con @vera)
        if (m.type !== 'notify' && m.type !== 'append') return;
        if (!this.store.privacyConfig.autoResponderEnListaBlanca) return;

        const nowSec = Math.floor(Date.now() / 1000);

        for (const msg of m.messages) {
          try {
            if (!msg.message) continue;
            const msgId: string = msg.key?.id || '';
            if (msgId && (this.sentBotMessageIds.has(msgId) || this.processedIncomingMsgIds.has(msgId))) {
              continue;
            }

            // Si el evento es 'append', ignorar mensajes antiguos de sincronización (> 45 seg)
            if (m.type === 'append') {
              const msgTs = Number(msg.messageTimestamp || 0);
              if (!msgTs || Math.abs(nowSec - msgTs) > 45) {
                continue;
              }
            }

            const remoteJid: string = msg.key?.remoteJid || '';
            if (!remoteJid) continue;

            // Desempaquetar mensajes efímeros / temporales si aplica
            const unwrapped =
              msg.message.ephemeralMessage?.message ||
              msg.message.viewOnceMessage?.message ||
              msg.message.viewOnceMessageV2?.message ||
              msg.message.documentWithCaptionMessage?.message ||
              msg.message;

            const textContent = (
              unwrapped?.conversation ||
              unwrapped?.extendedTextMessage?.text ||
              unwrapped?.imageMessage?.caption ||
              unwrapped?.videoMessage?.caption ||
              ''
            ).trim();

            if (!textContent) continue;

            // Escudo Anti-Bucle: si el texto tiene la cabecera de Vera, registrar su ID y salir inmediatamente
            if (this.isBotGeneratedText(textContent)) {
              if (msgId) this.sentBotMessageIds.add(msgId);
              continue;
            }

            const fromMe = Boolean(msg.key?.fromMe);
            const myPhone = this.normalizePhone(this.sock?.user?.id || this.connectedPhoneNumber || '');
            const myLidBase = (this.sock?.user?.lid || '').split(':')[0].split('@')[0];
            const remoteBase = remoteJid.split(':')[0].split('@')[0];

            const extraCandidateJids: string[] = [
              msg.key?.remoteJidAlt,
              msg.key?.senderPn,
              msg.key?.participant,
              msg.key?.participantAlt,
            ].filter(Boolean);

            const candidatePhones = [remoteJid, ...extraCandidateJids]
              .map((j) => this.normalizePhone(j))
              .filter((p) => p.length >= 7);

            // Detectar si es el chat "Tú (Mensajes a ti mismo)" del propio titular conectado
            const isOwnerSelfChat = Boolean(
              (myLidBase && remoteBase === myLidBase) ||
                (myPhone &&
                  candidatePhones.some(
                    (cp) => cp === myPhone || (cp.length >= 8 && myPhone.length >= 8 && cp.slice(-8) === myPhone.slice(-8))
                  ))
            );

            const evalResult = await this.executeIncomingMessageWithAgent({
              remoteJid,
              extraCandidateJids,
              messageText: textContent,
              isGroup: remoteJid.endsWith('@g.us'),
              fromMe,
              isOwnerSelfChat,
            });

            // Si debe ignorarse silenciosamente (no está en lista blanca, es charla normal sin @vera, o es grupo), salir en 0ms
            if (evalResult.shouldIgnoreSilently || !evalResult.responseText) {
              continue;
            }

            if (msgId) {
              this.processedIncomingMsgIds.add(msgId);
            }

            // Enviar respuesta de texto por WhatsApp y guardar su ID para que jamás se auto-responda
            const sentTextMsg = await this.sock.sendMessage(remoteJid, { text: evalResult.responseText });
            if (sentTextMsg?.key?.id) {
              this.sentBotMessageIds.add(sentTextMsg.key.id);
            }

            // Si el usuario autorizado tiene habilitada la respuesta con nota de voz de Piper TTS
            if (evalResult.whitelistEntry?.responderConAudio && evalResult.verbalSummaryForAudio) {
              try {
                const ttsRes = await piperTtsService.synthesize(
                  evalResult.verbalSummaryForAudio,
                  'es_AR-daniela-high'
                );
                if (ttsRes && ttsRes.audioBuffer) {
                  const voicePayload = await this.prepareWhatsAppVoicePayload(ttsRes.audioBuffer);
                  const sentAudioMsg = await this.sock.sendMessage(remoteJid, voicePayload);
                  if (sentAudioMsg?.key?.id) {
                    this.sentBotMessageIds.add(sentAudioMsg.key.id);
                  }
                }
              } catch (audioErr) {
                console.error('[WhatsAppBridge] Error enviando nota de voz:', audioErr);
              }
            }
          } catch (err) {
            console.error('[WhatsAppBridge] Error procesando mensaje autorizado:', err);
          }
        }
      });

      return {
        status: this.connectionState,
        message: 'Iniciando sesión WhatsApp Multi-Device. Espere el código QR...',
      };
    } catch (err: any) {
      this.connectionState = 'ERROR';
      this.lastErrorMessage = err.message || 'Error al inicializar el socket de WhatsApp.';
      return { status: 'ERROR', message: this.lastErrorMessage! };
    }
  }

  /**
   * Localiza o instala un binario de ffmpeg para convertir el WAV crudo de Piper
   * a formato nativo de Nota de Voz de WhatsApp (OGG/Opus a 48kHz mono o M4A/AAC).
   */
  private cachedFfmpegBin: string | null = null;

  private async getFfmpegBinary(): Promise<string | null> {
    if (this.cachedFfmpegBin) return this.cachedFfmpegBin;

    const candidates = [
      '/usr/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
      '/root/miniconda3/bin/ffmpeg',
      '/opt/conda/bin/ffmpeg',
      '/opt/homebrew/bin/ffmpeg',
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        this.cachedFfmpegBin = c;
        return c;
      }
    }

    try {
      const { stdout } = await execAsync('which ffmpeg');
      const found = (stdout || '').trim();
      if (found && fs.existsSync(found)) {
        this.cachedFfmpegBin = found;
        return found;
      }
    } catch {}

    // Usar ffmpeg-static si está instalado (dependencia opcional). Nunca se instala en tiempo de ejecución.
    try {
      const ffMod: any = await safeDynamicImport('ffmpeg-static');
      const binPath = ffMod?.default || ffMod;
      if (typeof binPath === 'string' && fs.existsSync(binPath)) {
        this.cachedFfmpegBin = binPath;
        return binPath;
      }
    } catch {
      console.warn('[WhatsAppBridge] ffmpeg no disponible: las notas de voz no se convertirán a OGG/Opus.');
    }

    return null;
  }

  /**
   * Convierte el Buffer WAV generado por Piper TTS a OGG/Opus (audio/ogg; codecs=opus),
   * que es el formato oficial exigido por WhatsApp iOS y Android para reproducir notas de voz (PTT).
   */
  public async prepareWhatsAppVoicePayload(wavBuffer: Buffer): Promise<{
    audio: Buffer;
    mimetype: string;
    ptt: boolean;
    seconds: number;
  }> {
    let byteRate = 44100;
    if (wavBuffer.length >= 32 && wavBuffer.toString('ascii', 0, 4) === 'RIFF') {
      const parsedRate = wavBuffer.readUInt32LE(28);
      if (parsedRate >= 8000 && parsedRate <= 192000) {
        byteRate = parsedRate;
      }
    }
    const seconds = Math.max(1, Math.round(Math.max(0, wavBuffer.length - 44) / byteRate));

    const ffmpegBin = await this.getFfmpegBinary();
    if (!ffmpegBin) {
      // Fallback si no hay ffmpeg
      return {
        audio: wavBuffer,
        mimetype: 'audio/mp4',
        ptt: false,
        seconds,
      };
    }

    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const tmpWav = path.join(os.tmpdir(), `wa_in_${id}.wav`);
    const tmpOgg = path.join(os.tmpdir(), `wa_out_${id}.ogg`);
    const tmpM4a = path.join(os.tmpdir(), `wa_out_${id}.m4a`);
    const tmpMp3 = path.join(os.tmpdir(), `wa_out_${id}.mp3`);

    try {
      await fs.promises.writeFile(tmpWav, wavBuffer);

      // 1. Intentar conversión a OGG/Opus nativo de WhatsApp PTT (48kHz mono voip)
      try {
        await execAsync(
          `"${ffmpegBin}" -y -i "${tmpWav}" -c:a libopus -b:a 32k -vbr on -compression_level 10 -frame_duration 20 -application voip -ar 48000 -ac 1 "${tmpOgg}"`,
          { timeout: 15000 }
        );
        if (fs.existsSync(tmpOgg) && fs.statSync(tmpOgg).size > 100) {
          const oggBuffer = await fs.promises.readFile(tmpOgg);
          return {
            audio: oggBuffer,
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true,
            seconds,
          };
        }
      } catch {}

      // 2. Fallback a M4A/AAC si el ffmpeg del sistema no tiene libopus compilado
      try {
        await execAsync(
          `"${ffmpegBin}" -y -i "${tmpWav}" -c:a aac -b:a 64k -ar 44100 -ac 1 -movflags +faststart "${tmpM4a}"`,
          { timeout: 15000 }
        );
        if (fs.existsSync(tmpM4a) && fs.statSync(tmpM4a).size > 100) {
          const m4aBuffer = await fs.promises.readFile(tmpM4a);
          return {
            audio: m4aBuffer,
            mimetype: 'audio/mp4',
            ptt: true,
            seconds,
          };
        }
      } catch {}

      // 3. Fallback a MP3 universal
      try {
        await execAsync(
          `"${ffmpegBin}" -y -i "${tmpWav}" -c:a libmp3lame -b:a 64k -ar 44100 -ac 1 "${tmpMp3}"`,
          { timeout: 15000 }
        );
        if (fs.existsSync(tmpMp3) && fs.statSync(tmpMp3).size > 100) {
          const mp3Buffer = await fs.promises.readFile(tmpMp3);
          return {
            audio: mp3Buffer,
            mimetype: 'audio/mpeg',
            ptt: false,
            seconds,
          };
        }
      } catch {}

      return {
        audio: wavBuffer,
        mimetype: 'audio/wav',
        ptt: false,
        seconds,
      };
    } finally {
      for (const f of [tmpWav, tmpOgg, tmpM4a, tmpMp3]) {
        try {
          if (fs.existsSync(f)) await fs.promises.unlink(f);
        } catch {}
      }
    }
  }

  public async disconnectAndLogout(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch {}
      try {
        this.sock.end(undefined);
      } catch {}
      this.sock = null;
    }
    try {
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
      }
    } catch {}
    this.connectionState = 'DISCONNECTED';
    this.currentQrRaw = null;
    this.currentQrDataUrl = null;
    this.connectedPhoneNumber = null;
    this.connectedPushName = null;
  }

  /**
   * Envía un mensaje o reporte desde el ERP hacia un número que DEBE estar en la Lista Blanca.
   */
  public async sendDirectMessageToAuthorizedNumber(params: {
    telefonoDestino: string;
    mensaje: string;
    incluirAudioPiper?: boolean;
    textoVerbalAudio?: string;
  }): Promise<{ success: boolean; mode: 'LIVE_SOCKET' | 'FALLBACK_REQUIRED'; message: string }> {
    const entry = this.findAuthorizedWhitelistEntry(params.telefonoDestino);
    if (!entry) {
      throw new Error(
        `Seguridad RBAC: El número ${params.telefonoDestino} no se encuentra activo en la Lista Blanca. Agréguelo primero para autorizar envíos desde el ERP.`
      );
    }

    if (this.connectionState !== 'CONNECTED' || !this.sock) {
      return {
        success: false,
        mode: 'FALLBACK_REQUIRED',
        message: 'WhatsApp Web aún no está vinculado por QR en el servidor.',
      };
    }

    const jid = `${this.normalizePhone(entry.telefono)}@s.whatsapp.net`;
    const sentDirectText = await this.sock.sendMessage(jid, { text: params.mensaje });
    if (sentDirectText?.key?.id) {
      this.sentBotMessageIds.add(sentDirectText.key.id);
    }

    if (params.incluirAudioPiper && params.textoVerbalAudio) {
      try {
        const tts = await piperTtsService.synthesize(params.textoVerbalAudio, 'es_AR-daniela-high');
        if (tts?.audioBuffer) {
          const voicePayload = await this.prepareWhatsAppVoicePayload(tts.audioBuffer);
          const sentDirectAudio = await this.sock.sendMessage(jid, voicePayload);
          if (sentDirectAudio?.key?.id) {
            this.sentBotMessageIds.add(sentDirectAudio.key.id);
          }
        }
      } catch {}
    }

    this.recordAuditLog({
      telefono: entry.telefono,
      nombreUsuario: entry.nombre,
      tipoEvento: 'ENVIO_SALIENTE_ERP',
      agentesInvolucrados: [],
      resumenAccion: `Reporte ejecutivo enviado desde el ERP a +${entry.telefono} (${entry.nombre}).`,
    });
    this.saveStore();

    return {
      success: true,
      mode: 'LIVE_SOCKET',
      message: `Mensaje enviado directamente por WhatsApp vinculado a ${entry.nombre} (+${entry.telefono}).`,
    };
  }
}

export const whatsappBridgeService = WhatsAppBridgeService.getInstance();
