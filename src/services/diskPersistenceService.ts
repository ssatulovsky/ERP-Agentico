import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isRealMysqlConnected, db as mysqlDb } from '../db/mysqlClient';
import {
  accountingEntries,
  accountingEntryLines,
  agentAuditLogs,
  economicIndicators,
  dtesRcv,
  employees,
  payrollSettlements,
} from '../db/mysqlSchema';

export interface DiskDataStore {
  version: string;
  lastPersistedAt: string;
  entries: any[];
  lines: any[];
  auditLogs: any[];
  dtes: any[];
  employees: any[];
  payrolls: any[];
  indicators: any[];
  bankAccounts: any[];
  bankMovements: any[];
  warehouses: any[];
  inventoryItems: any[];
  clients: any[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DISK_FILE = path.join(DATA_DIR, 'db_disk_snapshot.json');

class DiskPersistenceService {
  private store: DiskDataStore = {
    version: '1.0.0',
    lastPersistedAt: new Date().toISOString(),
    entries: [],
    lines: [],
    auditLogs: [],
    dtes: [],
    employees: [],
    payrolls: [],
    indicators: [],
    bankAccounts: [],
    bankMovements: [],
    warehouses: [],
    inventoryItems: [],
    clients: [],
  };

  private isInitialized = false;
  private saveDebounceTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.ensureDirectory();
    this.loadFromDisk();
  }

  private ensureDirectory() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (err: any) {
      console.warn(`[DiskPersistence] Error al crear directorio data: ${err.message}`);
    }
  }

  /**
   * Carga el estado serializado desde el disco local.
   * Si no existe, precarga datos semilla balanceados.
   */
  public loadFromDisk(): DiskDataStore {
    if (this.isInitialized) {
      return this.store;
    }

    try {
      if (fs.existsSync(DISK_FILE)) {
        const raw = fs.readFileSync(DISK_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.store = {
          ...this.store,
          ...parsed,
        };
        // Purgar asientos ficticios de ventas con IVA para InnovAgile (empresa no afecta a IVA)
        this.store.entries = this.store.entries.filter(e => {
          const isInnovagile = e.empresaId.includes('76.892.410') || e.empresaId.includes('77.798.901');
          if (isInnovagile && (e.origenModulo === 'RCV_VENTA' || e.documentoRef?.includes('DTE 33') || e.concepto?.includes('Retail Logistics'))) {
            return false;
          }
          return true;
        });
        const validEntryIds = new Set(this.store.entries.map(e => e.id));
        this.store.lines = this.store.lines.filter(l => validEntryIds.has(l.entryId));
        console.log(`[DiskPersistence] Snapshot cargado desde disco: ${DISK_FILE} (${this.store.entries.length} asientos, ${this.store.dtes.length} DTEs).`);
      } else {
        console.log('[DiskPersistence] Archivo de persistencia no encontrado. Inicializando con datos semilla estándar.');
        this.populateSeedData();
        this.flushToDiskSync();
      }
    } catch (err: any) {
      console.error(`[DiskPersistence] Error al leer snapshot de disco: ${err.message}. Regenerando...`);
      this.populateSeedData();
      this.flushToDiskSync();
    }

    this.isInitialized = true;
    return this.store;
  }

  /**
   * Escribe el estado actual al disco de manera atómica (evita corrupción).
   */
  public flushToDiskSync(): boolean {
    try {
      this.ensureDirectory();
      this.store.lastPersistedAt = new Date().toISOString();
      const tempPath = `${DISK_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(this.store, null, 2), 'utf-8');
      fs.renameSync(tempPath, DISK_FILE);
      return true;
    } catch (err: any) {
      console.error(`[DiskPersistence] Error al guardar en disco: ${err.message}`);
      return false;
    }
  }

  /**
   * Programa un guardado diferido (debounce) para no saturar I/O en ráfagas de transacciones.
   */
  public scheduleFlush() {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = setTimeout(() => {
      this.flushToDiskSync();
    }, 300);
  }

  /**
   * Sincroniza los registros almacenados en disco hacia la base de datos MySQL 8.0.
   */
  public async syncDiskToMysql(): Promise<{ syncedEntries: number; syncedDtes: number }> {
    if (!isRealMysqlConnected) {
      return { syncedEntries: 0, syncedDtes: 0 };
    }

    let syncedEntries = 0;
    let syncedDtes = 0;

    try {
      // 1. Asientos contables y líneas
      for (const entry of this.store.entries) {
        try {
          await mysqlDb
            .insert(accountingEntries)
            .values({
              id: entry.id,
              firmId: entry.firmId || 'firm-001-audicon',
              empresaId: entry.empresaId,
              periodo: entry.periodo,
              fecha: entry.fecha,
              concepto: entry.concepto,
              documentoRef: entry.documentoRef || null,
              origenModulo: entry.origenModulo || 'MANUAL',
              totalDebe: String(entry.totalDebe),
              totalHaber: String(entry.totalHaber),
              creadoPorAgente: entry.creadoPorAgente || 'SISTEMA_PERSISTENCIA',
              autorizadoPorSupervisor: Boolean(entry.autorizadoPorSupervisor),
              supervisorSignature: entry.supervisorSignature || 'HMAC_PERSISTED',
              createdAt: new Date(entry.createdAt || Date.now()),
            })
            .onDuplicateKeyUpdate({
              set: {
                totalDebe: String(entry.totalDebe),
                totalHaber: String(entry.totalHaber),
              },
            });

          syncedEntries++;
        } catch (e) {
          // Si ya existe o error específico, continuar
        }
      }

      // 2. Líneas de asientos
      for (const line of this.store.lines) {
        try {
          await mysqlDb
            .insert(accountingEntryLines)
            .values({
              id: line.id,
              entryId: line.entryId,
              lineaNumero: line.lineaNumero || 1,
              codigoCuenta: line.codigoCuenta,
              nombreCuenta: line.nombreCuenta,
              debe: String(line.debe),
              haber: String(line.haber),
              rutAuxiliar: line.rutAuxiliar || null,
              centroCosto: line.centroCosto || null,
            })
            .onDuplicateKeyUpdate({
              set: {
                debe: String(line.debe),
                haber: String(line.haber),
              },
            });
        } catch (e) {
          // Continuar
        }
      }

      // 3. DTEs RCV
      for (const dte of this.store.dtes) {
        try {
          await mysqlDb
            .insert(dtesRcv)
            .values({
              id: dte.id || crypto.randomUUID(),
              empresaId: dte.empresaId,
              periodo: dte.periodo,
              tipoOperacion: dte.tipoOperacion || 'COMPRA',
              tipoDte: Number(dte.tipoDte) || 33,
              folio: Number(dte.folio) || 1,
              rutContraparte: dte.rutContraparte,
              razonSocialContraparte: dte.razonSocialContraparte || 'Proveedor',
              fechaEmision: dte.fechaEmision,
              montoExento: String(dte.montoExento || '0.00'),
              montoNeto: String(dte.montoNeto || '0.00'),
              montoIva: String(dte.montoIva || '0.00'),
              montoIvaRecuperable: String(dte.montoIvaRecuperable || '0.00'),
              montoIvaNoRecuperable: String(dte.montoIvaNoRecuperable || '0.00'),
              montoTotal: String(dte.montoTotal),
              estadoAcuse: dte.estadoAcuse || null,
              estadoContable: dte.estadoContable || 'PENDIENTE',
              entryIdRef: dte.entryIdRef || null,
              createdAt: new Date(dte.createdAt || Date.now()),
            })
            .onDuplicateKeyUpdate({
              set: {
                montoTotal: String(dte.montoTotal),
              },
            });

          syncedDtes++;
        } catch (e) {
          // Continuar
        }
      }

      console.log(`[DiskPersistence] Sincronización a MySQL 8.0 completada: ${syncedEntries} asientos, ${syncedDtes} DTEs.`);
    } catch (syncErr: any) {
      console.warn(`[DiskPersistence] Aviso en sync a MySQL: ${syncErr.message}`);
    }

    return { syncedEntries, syncedDtes };
  }

  // ==========================================================================
  // OPERACIONES CRUD CON DOBLE PERSISTENCIA (MYSQL + DISCO)
  // ==========================================================================

  public addAccountingEntry(entry: any, lines: any[]) {
    // 1. Guardar en memoria de proceso y disco
    const existingIndex = this.store.entries.findIndex((e) => e.id === entry.id);
    if (existingIndex >= 0) {
      this.store.entries[existingIndex] = entry;
      this.store.lines = this.store.lines.filter((l) => l.entryId !== entry.id);
    } else {
      this.store.entries.unshift(entry);
    }

    this.store.lines.push(...lines);
    this.scheduleFlush();

    // 2. Si MySQL está conectado, persistir inmediatamente en MySQL
    if (isRealMysqlConnected) {
      (async () => {
        try {
          await mysqlDb.insert(accountingEntries).values({
            id: entry.id,
            firmId: entry.firmId || 'firm-001-audicon',
            empresaId: entry.empresaId,
            periodo: entry.periodo,
            fecha: entry.fecha,
            concepto: entry.concepto,
            documentoRef: entry.documentoRef || null,
            origenModulo: entry.origenModulo,
            totalDebe: String(entry.totalDebe),
            totalHaber: String(entry.totalHaber),
            creadoPorAgente: entry.creadoPorAgente,
            autorizadoPorSupervisor: Boolean(entry.autorizadoPorSupervisor),
            supervisorSignature: entry.supervisorSignature,
            createdAt: new Date(entry.createdAt || Date.now()),
          });

          for (const line of lines) {
            await mysqlDb.insert(accountingEntryLines).values({
              id: line.id || crypto.randomUUID(),
              entryId: entry.id,
              lineaNumero: line.lineaNumero || 1,
              codigoCuenta: line.codigoCuenta,
              nombreCuenta: line.nombreCuenta,
              debe: String(line.debe),
              haber: String(line.haber),
              rutAuxiliar: line.rutAuxiliar || null,
              centroCosto: line.centroCosto || null,
            });
          }
        } catch (sqlErr: any) {
          console.warn(`[DiskPersistence] Error al escribir asiento en MySQL (respaldo en disco seguro): ${sqlErr.message}`);
        }
      })();
    }
  }

  public getAccountingEntries(empresaId?: string, periodo?: string): any[] {
    let result = this.store.entries;
    if (empresaId) {
      const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
      result = result.filter((e) => {
        const eNorm = (e.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
        return !eNorm || eNorm === norm;
      });
    }
    if (periodo) {
      result = result.filter((e) => !e.periodo || e.periodo === periodo);
    }
    return result;
  }

  public getLinesForEntry(entryId: string): any[] {
    return this.store.lines.filter((l) => l.entryId === entryId);
  }

  public addDte(dte: any) {
    const existingIndex = this.store.dtes.findIndex((d) => d.id === dte.id);
    if (existingIndex >= 0) {
      this.store.dtes[existingIndex] = dte;
    } else {
      this.store.dtes.unshift(dte);
    }
    this.scheduleFlush();
  }

  public getDtes(empresaId?: string, periodo?: string): any[] {
    let result = this.store.dtes;
    if (empresaId) {
      const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
      result = result.filter((d) => {
        const dNorm = (d.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
        return !dNorm || dNorm === norm;
      });
    }
    if (periodo) {
      result = result.filter((d) => !d.periodo || d.periodo === periodo);
    }
    return result;
  }

  public addAuditLog(log: any) {
    this.store.auditLogs.unshift(log);
    if (this.store.auditLogs.length > 500) {
      this.store.auditLogs = this.store.auditLogs.slice(0, 500);
    }
    this.scheduleFlush();
  }

  public getAuditLogs(empresaId?: string): any[] {
    if (!empresaId) return this.store.auditLogs;
    const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
    return this.store.auditLogs.filter((l) => {
      const lNorm = (l.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return !lNorm || lNorm === norm;
    });
  }

  public getStatus(): {
    diskPath: string;
    fileSizeBytes: number;
    lastPersistedAt: string;
    entriesCount: number;
    linesCount: number;
    dtesCount: number;
    employeesCount: number;
    mysqlActive: boolean;
  } {
    let size = 0;
    try {
      if (fs.existsSync(DISK_FILE)) {
        size = fs.statSync(DISK_FILE).size;
      }
    } catch {}

    return {
      diskPath: DISK_FILE,
      fileSizeBytes: size,
      lastPersistedAt: this.store.lastPersistedAt,
      entriesCount: this.store.entries.length,
      linesCount: this.store.lines.length,
      dtesCount: this.store.dtes.length,
      employeesCount: this.store.employees.length,
      mysqlActive: isRealMysqlConnected,
    };
  }

  /**
   * Poblado inicial de datos semilla para arranque garantizado.
   */
  private populateSeedData() {
    const now = new Date();
    const demoEmpresas = ['76.892.410-K', '76.543.210-9', '76.543.210-K'];

    demoEmpresas.forEach((empresaId, empIdx) => {
      const isInnovagile = empresaId.includes('76.892.410') || empresaId.includes('77.798.901');
      if (isInnovagile) {
        // InnovAgile Group SpA es NO AFECTA A IVA (Art. 12 Letra E / DL 825).
        // CERO datos inventados: no emite DTE 33 ni genera Débito Fiscal ($0).
        // Debe consultar directamente al SII oficial para obtener su realidad tributaria.
        return;
      }
      // 1. Asiento Venta Retail
      const idVenta = `entry-seed-v1-${empIdx}`;
      const hashVenta = crypto.createHmac('sha256', 'SIEX_AUDIT_SUPERVISOR_KEY_2026').update(idVenta).digest('hex');
      this.store.entries.push({
        id: idVenta,
        firmId: 'firm-001-audicon',
        empresaId,
        periodo: '2026-09',
        fecha: '2026-09-02',
        concepto: 'Venta Factura Electrónica Folio 1041 - Retail Logistics Chile S.A.',
        documentoRef: 'DTE 33 N° 1041',
        totalDebe: '14875000.00',
        totalHaber: '14875000.00',
        origenModulo: 'RCV_VENTA',
        creadoPorAgente: 'AGENTE_RCV',
        autorizadoPorSupervisor: true,
        supervisorSignature: hashVenta,
        createdAt: new Date(now.getTime() - 86400000 * 3).toISOString(),
      });
      this.store.lines.push(
        {
          id: `line-v1-1-${empIdx}`,
          entryId: idVenta,
          lineaNumero: 1,
          codigoCuenta: '1.1.03.001',
          nombreCuenta: 'Clientes Nacionales (Retail Logistics Chile S.A.)',
          debe: '14875000.00',
          haber: '0.00',
          rutAuxiliar: '77.210.980-5',
          centroCosto: 'VENTAS_CORPORATIVAS',
        },
        {
          id: `line-v1-2-${empIdx}`,
          entryId: idVenta,
          lineaNumero: 2,
          codigoCuenta: '4.1.01.001',
          nombreCuenta: 'Ingresos por Ventas Afectas a IVA',
          debe: '0.00',
          haber: '12500000.00',
          rutAuxiliar: null,
          centroCosto: 'VENTAS_CORPORATIVAS',
        },
        {
          id: `line-v1-3-${empIdx}`,
          entryId: idVenta,
          lineaNumero: 3,
          codigoCuenta: '2.1.03.001',
          nombreCuenta: 'IVA Débito Fiscal',
          debe: '0.00',
          haber: '2375000.00',
          rutAuxiliar: null,
          centroCosto: null,
        }
      );

      // 2. Asiento Compra AWS
      const idCompra = `entry-seed-c1-${empIdx}`;
      const hashCompra = crypto.createHmac('sha256', 'SIEX_AUDIT_SUPERVISOR_KEY_2026').update(idCompra).digest('hex');
      this.store.entries.push({
        id: idCompra,
        firmId: 'firm-001-audicon',
        empresaId,
        periodo: '2026-09',
        fecha: '2026-09-03',
        concepto: 'Compra Factura Electrónica Folio 9840 - AWS Amazon Web Services Cloud',
        documentoRef: 'DTE 33 N° 9840',
        totalDebe: '5712000.00',
        totalHaber: '5712000.00',
        origenModulo: 'RCV_COMPRA',
        creadoPorAgente: 'AGENTE_RCV',
        autorizadoPorSupervisor: true,
        supervisorSignature: hashCompra,
        createdAt: new Date(now.getTime() - 86400000 * 2).toISOString(),
      });
      this.store.lines.push(
        {
          id: `line-c1-1-${empIdx}`,
          entryId: idCompra,
          lineaNumero: 1,
          codigoCuenta: '5.1.01.001',
          nombreCuenta: 'Costo de Ventas / Infraestructura Servidores Cloud',
          debe: '4800000.00',
          haber: '0.00',
          rutAuxiliar: '76.999.888-2',
          centroCosto: 'TECNOLOGIA',
        },
        {
          id: `line-c1-2-${empIdx}`,
          entryId: idCompra,
          lineaNumero: 2,
          codigoCuenta: '1.1.04.001',
          nombreCuenta: 'IVA Crédito Fiscal (DL 825)',
          debe: '912000.00',
          haber: '0.00',
          rutAuxiliar: null,
          centroCosto: null,
        },
        {
          id: `line-c1-3-${empIdx}`,
          entryId: idCompra,
          lineaNumero: 3,
          codigoCuenta: '2.1.01.001',
          nombreCuenta: 'Proveedores Nacionales (Amazon Web Services Chile)',
          debe: '0.00',
          haber: '5712000.00',
          rutAuxiliar: '76.999.888-2',
          centroCosto: null,
        }
      );
    });

    // Indicadores económicos iniciales
    this.store.indicators = [
      { codigo: 'UF', valor: '40885.6300', fecha: '2026-09-09', fuente: 'sii.cl-oficial' },
      { codigo: 'USD', valor: '928.1000', fecha: '2026-09-09', fuente: 'dolarapi.cl-oficial' },
      { codigo: 'UTM', valor: '71721.0000', fecha: '2026-09-09', fuente: 'sii.cl-oficial' },
      { codigo: 'IPC', valor: '0.6000', fecha: '2026-09-09', fuente: 'ine.cl-oficial' },
    ];
  }
}

export const diskPersistence = new DiskPersistenceService();
