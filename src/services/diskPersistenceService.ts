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
  costCenters,
  fixedAssets,
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
  costCenters: any[];
  fixedAssets: any[];
  credentialsVault?: any[];
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
    costCenters: [],
    fixedAssets: [],
    credentialsVault: [],
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
          costCenters: parsed.costCenters || [],
          fixedAssets: parsed.fixedAssets || [],
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
              glosa: dte.glosa || null,
              centroCostoId: dte.centroCostoId || null,
              centroCostoCodigo: dte.centroCostoCodigo || null,
              centroCostoNombre: dte.centroCostoNombre || null,
              cuentaGastoImputadaCodigo: dte.cuentaGastoImputadaCodigo || dte.cuentaCodigoAsignada || null,
              cuentaGastoImputadaNombre: dte.cuentaGastoImputadaNombre || dte.cuentaNombreAsignada || null,
              items: dte.items ? dte.items : null,
              entryIdRef: dte.entryIdRef || null,
              createdAt: new Date(dte.createdAt || Date.now()),
            })
            .onDuplicateKeyUpdate({
              set: {
                montoTotal: String(dte.montoTotal),
                centroCostoId: dte.centroCostoId || null,
                centroCostoCodigo: dte.centroCostoCodigo || null,
                centroCostoNombre: dte.centroCostoNombre || null,
                cuentaGastoImputadaCodigo: dte.cuentaGastoImputadaCodigo || dte.cuentaCodigoAsignada || null,
                cuentaGastoImputadaNombre: dte.cuentaGastoImputadaNombre || dte.cuentaNombreAsignada || null,
              },
            });

          syncedDtes++;
        } catch (e) {
          // Continuar
        }
      }

      // 4. Centros de Costo (Mini-Empresas)
      if (this.store.costCenters && this.store.costCenters.length > 0) {
        for (const cc of this.store.costCenters) {
          try {
            await mysqlDb
              .insert(costCenters)
              .values({
                id: cc.id || crypto.randomUUID(),
                empresaId: cc.empresaId || 'client-retail-01',
                codigo: cc.codigo,
                nombre: cc.nombre,
                categoria: cc.categoria || 'ADMINISTRACION',
                responsableNombre: cc.responsableNombre || 'Responsable',
                responsableEmail: cc.responsableEmail || cc.emailResponsable || null,
                presupuestoMensualClp: String(cc.presupuestoMensualClp || '0.00'),
                activo: cc.activo !== false,
                descripcion: cc.descripcion || null,
                ventasAcumuladasMes: String(cc.ventasAcumuladasMes || '0.00'),
                costosDirectosMes: String(cc.costosDirectosMes || '0.00'),
                gastosOperacionalesMes: String(cc.gastosOperacionalesMes || '0.00'),
                remuneracionesMes: String(cc.remuneracionesMes || '0.00'),
                depreciacionMes: String(cc.depreciacionMes || '0.00'),
                createdAt: new Date(cc.createdAt || Date.now()),
              })
              .onDuplicateKeyUpdate({
                set: {
                  nombre: cc.nombre,
                  presupuestoMensualClp: String(cc.presupuestoMensualClp || '0.00'),
                  activo: cc.activo !== false,
                },
              });
          } catch (e) {
            // Continuar
          }
        }
      }

      // 5. Activos Fijos (con Centro de Costo)
      if (this.store.fixedAssets && this.store.fixedAssets.length > 0) {
        for (const fa of this.store.fixedAssets) {
          try {
            await mysqlDb
              .insert(fixedAssets)
              .values({
                id: fa.id || crypto.randomUUID(),
                empresaId: fa.empresaId || 'client-retail-01',
                codigoPlaca: fa.codigoPlaca || fa.id,
                nombre: fa.nombre,
                categoria: fa.categoria || 'MAQUINARIA_INDUSTRIAL',
                fechaAdquisicion: fa.fechaAdquisicion || '2026-01-01',
                proveedorRut: fa.proveedorRut || null,
                proveedorRazonSocial: fa.proveedorRazonSocial || null,
                folioDteCompra: fa.folioDteCompra ? Number(fa.folioDteCompra) : null,
                valorAdquisicionOriginal: String(fa.valorAdquisicionOriginal || '0.00'),
                valorResidualFinanciero: String(fa.valorResidualFinanciero || '0.00'),
                vidaUtilMesesFinanciera: Number(fa.vidaUtilMesesFinanciera || 60),
                vidaUtilMesesTributaria: Number(fa.vidaUtilMesesTributaria || 36),
                mesesDepreciados: Number(fa.mesesDepreciados || 0),
                vidaUtilRestanteMeses: Number(fa.vidaUtilRestanteMeses || 60),
                metodoDepreciacion: fa.metodoDepreciacion || 'LINEAL_RECTA',
                depreciacionAcumuladaFinanciera: String(fa.depreciacionAcumuladaFinanciera || '0.00'),
                valorLibroFinanciero: String(fa.valorLibroFinanciero || '0.00'),
                cuotaDepreciacionMensualFinanciera: String(fa.cuotaDepreciacionMensualFinanciera || '0.00'),
                factorCorreccionMonetariaAcum: String(fa.factorCorreccionMonetariaAcum || '0.000000'),
                correccionMonetariaAcumulada: String(fa.correccionMonetariaAcumulada || '0.00'),
                depreciacionAcumuladaTributaria: String(fa.depreciacionAcumuladaTributaria || '0.00'),
                valorTributarioNeto: String(fa.valorTributarioNeto || '0.00'),
                cuotaDepreciacionMensualTributaria: String(fa.cuotaDepreciacionMensualTributaria || '0.00'),
                centroCostoId: fa.centroCostoId || null,
                centroCostoCodigo: fa.centroCostoCodigo || null,
                centroCostoNombre: fa.centroCostoNombre || null,
                ubicacionFisica: fa.ubicacionFisica || 'Planta Principal',
                responsableCustodio: fa.responsableCustodio || 'Encargado de Operaciones',
                estado: fa.estado || 'ACTIVO_OPERATIVO',
                numeroSerie: fa.numeroSerie || null,
                marcaModelo: fa.marcaModelo || null,
                esFabrilProduccion: Boolean(fa.esFabrilProduccion),
                asientoAltaId: fa.asientoAltaId || null,
                createdAt: new Date(fa.createdAt || Date.now()),
              })
              .onDuplicateKeyUpdate({
                set: {
                  nombre: fa.nombre,
                  valorLibroFinanciero: String(fa.valorLibroFinanciero || '0.00'),
                  centroCostoId: fa.centroCostoId || null,
                  centroCostoCodigo: fa.centroCostoCodigo || null,
                  centroCostoNombre: fa.centroCostoNombre || null,
                },
              });
          } catch (e) {
            // Continuar
          }
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

  public addCostCenter(cc: any) {
    if (!this.store.costCenters) this.store.costCenters = [];
    const existingIndex = this.store.costCenters.findIndex(
      (c) => c.id === cc.id || (c.codigo === cc.codigo && c.empresaId === cc.empresaId)
    );
    if (existingIndex >= 0) {
      this.store.costCenters[existingIndex] = { ...this.store.costCenters[existingIndex], ...cc };
    } else {
      this.store.costCenters.push(cc);
    }
    this.scheduleFlush();
  }

  public getCostCenters(empresaId?: string): any[] {
    let result = this.store.costCenters || [];
    if (empresaId) {
      const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
      result = result.filter((c) => {
        const cNorm = (c.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
        return !cNorm || cNorm === norm;
      });
    }
    return result;
  }

  public addFixedAsset(fa: any) {
    if (!this.store.fixedAssets) this.store.fixedAssets = [];
    const existingIndex = this.store.fixedAssets.findIndex((a) => a.id === fa.id);
    if (existingIndex >= 0) {
      this.store.fixedAssets[existingIndex] = { ...this.store.fixedAssets[existingIndex], ...fa };
    } else {
      this.store.fixedAssets.unshift(fa);
    }
    this.scheduleFlush();
  }

  public getFixedAssets(empresaId?: string): any[] {
    let result = this.store.fixedAssets || [];
    if (empresaId) {
      const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
      result = result.filter((a) => {
        const aNorm = (a.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
        return !aNorm || aNorm === norm;
      });
    }
    return result;
  }

  public saveVaultEntry(entry: any) {
    if (!this.store.credentialsVault) this.store.credentialsVault = [];
    const existingIndex = this.store.credentialsVault.findIndex(
      (v) => v.empresaId === entry.empresaId || (entry.rut && v.rut === entry.rut)
    );
    if (existingIndex >= 0) {
      this.store.credentialsVault[existingIndex] = {
        ...this.store.credentialsVault[existingIndex],
        ...entry,
        updatedAt: new Date().toISOString(),
      };
    } else {
      this.store.credentialsVault.push({
        ...entry,
        updatedAt: new Date().toISOString(),
      });
    }
    this.scheduleFlush();
  }

  public getVaultEntry(empresaIdOrRut: string): any | null {
    if (!this.store.credentialsVault || !empresaIdOrRut) return null;
    const clean = empresaIdOrRut.replace(/[^0-9kK]/g, '').toUpperCase();
    return (
      this.store.credentialsVault.find((v) => {
        const vEmpresa = (v.empresaId || '').replace(/[^0-9kK]/g, '').toUpperCase();
        const vRut = (v.rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
        return vEmpresa === clean || vRut === clean || v.empresaId === empresaIdOrRut;
      }) || null
    );
  }

  public getStatus(): {
    diskPath: string;
    fileSizeBytes: number;
    lastPersistedAt: string;
    entriesCount: number;
    linesCount: number;
    dtesCount: number;
    employeesCount: number;
    costCentersCount: number;
    fixedAssetsCount: number;
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
      costCentersCount: (this.store.costCenters || []).length,
      fixedAssetsCount: (this.store.fixedAssets || []).length,
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

    // Centros de Costo iniciales (Mini-Empresas)
    if (!this.store.costCenters || this.store.costCenters.length === 0) {
      this.store.costCenters = [
        {
          id: 'cc-01',
          empresaId: 'client-retail-01',
          codigo: 'CC-ADM-01',
          nombre: 'Administración Central & Finanzas',
          categoria: 'ADMINISTRACION',
          responsableNombre: 'Carla Morales Troncoso',
          emailResponsable: 'carla.morales@maraustral.cl',
          presupuestoMensualClp: 14500000,
          activo: true,
          descripcion: 'Gestión corporativa, contraloría interna, legal, compras generales y RRHH central.',
          ventasAcumuladasMes: 0,
          costosDirectosMes: 0,
          gastosOperacionalesMes: 4850000,
          remuneracionesMes: 7200000,
          depreciacionMes: 450000,
        },
        {
          id: 'cc-02',
          empresaId: 'client-retail-01',
          codigo: 'CC-VTA-STGO',
          nombre: 'Ventas & Distribución Zona Central (Mini-Empresa)',
          categoria: 'VENTAS',
          responsableNombre: 'Gonzalo Silva Valenzuela',
          emailResponsable: 'gonzalo.silva@maraustral.cl',
          presupuestoMensualClp: 28000000,
          activo: true,
          descripcion: 'Unidad comercial metropolitana y de exportaciones. Opera como centro de utilidad independiente.',
          ventasAcumuladasMes: 48500000,
          costosDirectosMes: 18200000,
          gastosOperacionalesMes: 3400000,
          remuneracionesMes: 5800000,
          depreciacionMes: 350000,
        },
        {
          id: 'cc-03',
          empresaId: 'client-retail-01',
          codigo: 'CC-PRD-QUELLON',
          nombre: 'Planta Fabril & Maestranza Quellón (Mini-Empresa)',
          categoria: 'PRODUCCION',
          responsableNombre: 'Ing. Rodrigo Cárdenas Soto',
          emailResponsable: 'rodrigo.cardenas@maraustral.cl',
          presupuestoMensualClp: 52000000,
          activo: true,
          descripcion: 'Fabricación y reparación de redes peceras, loberas y estructuras HDPE de acuicultura.',
          ventasAcumuladasMes: 64200000,
          costosDirectosMes: 28900000,
          gastosOperacionalesMes: 6200000,
          remuneracionesMes: 14800000,
          depreciacionMes: 2100000,
        },
        {
          id: 'cc-04',
          empresaId: 'client-retail-01',
          codigo: 'CC-LOG-SUR',
          nombre: 'Logística & Transporte Fluvial Décima Región',
          categoria: 'LOGISTICA',
          responsableNombre: 'Patricio Almonacid Vera',
          emailResponsable: 'patricio.almonacid@maraustral.cl',
          presupuestoMensualClp: 18500000,
          activo: true,
          descripcion: 'Flota de barcazas, camiones rampla, despacho de insumos a centros de cultivo en mar abierto.',
          ventasAcumuladasMes: 12000000,
          costosDirectosMes: 6400000,
          gastosOperacionalesMes: 2100000,
          remuneracionesMes: 4900000,
          depreciacionMes: 980000,
        },
      ];
    }

    // Activos Fijos iniciales con Centro de Costo imputado
    if (!this.store.fixedAssets || this.store.fixedAssets.length === 0) {
      this.store.fixedAssets = [
        {
          id: 'af-001',
          empresaId: 'client-retail-01',
          codigoPlaca: 'AF-2026-001',
          nombre: 'Grúa Horquilla Eléctrica Yale 2.5T',
          categoria: 'MAQUINARIA_INDUSTRIAL',
          fechaAdquisicion: '2026-01-15',
          proveedorRut: '76.888.999-1',
          proveedorRazonSocial: 'Yale Material Handling Chile SpA',
          folioDteCompra: 8820,
          valorAdquisicionOriginal: 24500000,
          valorResidualFinanciero: 1000000,
          vidaUtilMesesFinanciera: 84,
          vidaUtilMesesTributaria: 36,
          mesesDepreciados: 8,
          vidaUtilRestanteMeses: 76,
          metodoDepreciacion: 'LINEAL_RECTA',
          depreciacionAcumuladaFinanciera: 2238095.24,
          valorLibroFinanciero: 22261904.76,
          cuotaDepreciacionMensualFinanciera: 279761.9,
          factorCorreccionMonetariaAcum: 0.006,
          correccionMonetariaAcumulada: 133571.43,
          depreciacionAcumuladaTributaria: 5222222.22,
          valorTributarioNeto: 19277777.78,
          cuotaDepreciacionMensualTributaria: 652777.78,
          centroCostoId: 'cc-03',
          centroCostoCodigo: 'CC-PRD-QUELLON',
          centroCostoNombre: 'Planta Fabril & Maestranza Quellón (Mini-Empresa)',
          ubicacionFisica: 'Bodega Central Quellón - Nave 2',
          responsableCustodio: 'Marcelo Gallardo - Jefe Operaciones',
          estado: 'ACTIVO_OPERATIVO',
          numeroSerie: 'YALE-EL25-98302',
          marcaModelo: 'Yale ERP25VL 2026',
          esFabrilProduccion: true,
        },
      ];
    }
  }
}

export const diskPersistence = new DiskPersistenceService();
