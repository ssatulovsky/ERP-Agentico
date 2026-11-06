import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
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
  expenseReports,
  expenseItems,
  expenseProjects,
  bankTransactions,
  rfqRequests as dbRfqRequests,
  rfqSupplierResponses as dbRfqSupplierResponses,
  purchaseOrders as dbPurchaseOrders,
  commercialQuotes as dbCommercialQuotes,
} from '../db/mysqlSchema';
import { isDemoModeEnabled } from '../config/demoMode';

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
  expenseReports?: any[];
  expenseItems?: any[];
  expenseProjects?: any[];
  credentialsVault?: any[];
  chartsOfAccounts?: Record<string, any[]>;
  auxiliaries?: Record<string, any[]>;
  groups?: Record<string, any[]>;
  financialNotes?: Record<string, any[]>;
  clientStates?: Record<string, any>;
  rfqRequests?: any[];
  rfqSupplierResponses?: any[];
  purchaseOrders?: any[];
  commercialQuotes?: any[];
  sessions?: Record<string, any>;
  governanceApprovals?: any[];
  warehouseTransfers?: any[];
  replenishmentRequisitions?: any[];
  productionOrders?: any[];
  cifPoolItems?: any[];
  productionBudgets?: any[];
  warehouseWithdrawals?: any[];
  recipes?: any[];
  autoRfqConfigs?: Record<string, any>;
  autoRfqs?: any[];
  stockMovements?: any[];
  aiConfig?: any;
  aiUsageLogs?: any[];
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
    expenseReports: [],
    expenseItems: [],
    expenseProjects: [],
    credentialsVault: [],
    chartsOfAccounts: {},
    auxiliaries: {},
    groups: {},
    financialNotes: {},
    clientStates: {},
    rfqRequests: [],
    rfqSupplierResponses: [],
    purchaseOrders: [],
    commercialQuotes: [],
    sessions: {},
    governanceApprovals: [],
    warehouseTransfers: [],
    replenishmentRequisitions: [],
    productionOrders: [],
    cifPoolItems: [],
    productionBudgets: [],
    warehouseWithdrawals: [],
    recipes: [],
    autoRfqConfigs: {},
    autoRfqs: [],
    stockMovements: [],
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
          warehouses: parsed.warehouses || [],
          inventoryItems: parsed.inventoryItems || [],
          costCenters: parsed.costCenters || [],
          fixedAssets: parsed.fixedAssets || [],
          expenseReports: parsed.expenseReports || [],
          expenseItems: parsed.expenseItems || [],
          expenseProjects: parsed.expenseProjects || [],
          chartsOfAccounts: parsed.chartsOfAccounts || {},
          auxiliaries: parsed.auxiliaries || {},
          groups: parsed.groups || {},
          financialNotes: parsed.financialNotes || {},
          clientStates: parsed.clientStates || {},
          governanceApprovals: parsed.governanceApprovals || [],
          warehouseTransfers: parsed.warehouseTransfers || [],
          replenishmentRequisitions: parsed.replenishmentRequisitions || [],
          productionOrders: parsed.productionOrders || [],
          cifPoolItems: parsed.cifPoolItems || [],
          productionBudgets: parsed.productionBudgets || [],
          warehouseWithdrawals: parsed.warehouseWithdrawals || [],
          recipes: parsed.recipes || [],
          autoRfqConfigs: parsed.autoRfqConfigs || {},
          autoRfqs: parsed.autoRfqs || [],
          stockMovements: parsed.stockMovements || [],
          ...parsed,
        };
        if ((!this.store.expenseReports || this.store.expenseReports.length === 0) && isDemoModeEnabled()) {
          this.initExpenseSeeds();
        }
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
    try {
      const { inMemoryEntries, inMemoryLines, inMemoryDtesRcv } = require('../db/mysqlClient');
      if (inMemoryEntries && inMemoryEntries.length === 0 && this.store.entries) {
        inMemoryEntries.push(...this.store.entries);
      }
      if (inMemoryLines && inMemoryLines.length === 0 && this.store.lines) {
        inMemoryLines.push(...this.store.lines);
      }
      if (inMemoryDtesRcv && inMemoryDtesRcv.length === 0 && this.store.dtes) {
        inMemoryDtesRcv.push(...this.store.dtes);
      }
    } catch {}
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

  public scheduleFlush() {
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }
    this.saveDebounceTimer = setTimeout(() => {
      this.flushToDiskSync();
    }, 300);
  }

  /**
   * Alias de scheduleFlush para compatibilidad con servicios que persisten colecciones adicionales.
   */
  public scheduleDiskSave() {
    this.scheduleFlush();
  }

  /**
   * Obtiene una copia del snapshot completo persistido en memoria/disco.
   */
  public getSnapshot(): DiskDataStore {
    if (!this.isInitialized) {
      this.loadFromDisk();
    }
    return { ...this.store };
  }

  /**
   * Actualiza una colección o clave arbitraria en el almacén de persistencia y programa su guardado.
   */
  public updateCollection(collectionName: string, items: any[]): void {
    if (collectionName === 'aiConfig') {
      this.store.aiConfig = items[0] || null;
    } else if (collectionName === 'aiUsageLogs') {
      this.store.aiUsageLogs = items;
    } else {
      (this.store as any)[collectionName] = items;
    }
    this.scheduleFlush();
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
                empresaId: cc.empresaId,
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
                empresaId: fa.empresaId,
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

      // 6. Proyectos de Rendición de Gastos
      if (this.store.expenseProjects && this.store.expenseProjects.length > 0) {
        for (const pry of this.store.expenseProjects) {
          try {
            await mysqlDb
              .insert(expenseProjects)
              .values({
                id: pry.id,
                empresaId: pry.empresaId,
                codigo: pry.codigo,
                nombre: pry.nombre,
                clienteNombre: pry.clienteNombre || null,
                presupuestoTotalClp: String(pry.presupuestoTotalClp || '0.00'),
                activo: pry.activo !== false,
                descripcion: pry.descripcion || null,
                createdAt: new Date(pry.createdAt || Date.now()),
              })
              .onDuplicateKeyUpdate({
                set: {
                  nombre: pry.nombre,
                  presupuestoTotalClp: String(pry.presupuestoTotalClp || '0.00'),
                  activo: pry.activo !== false,
                },
              });
          } catch (e) {}
        }
      }

      // 7. Cabeceras de Rendición de Gastos
      if (this.store.expenseReports && this.store.expenseReports.length > 0) {
        for (const rep of this.store.expenseReports) {
          try {
            await mysqlDb
              .insert(expenseReports)
              .values({
                id: rep.id,
                empresaId: rep.empresaId,
                folio: rep.folio,
                titulo: rep.titulo,
                rendidorId: rep.rendidorId || null,
                rendidorNombre: rep.rendidorNombre,
                rendidorRut: rep.rendidorRut,
                rendidorEmail: rep.rendidorEmail || null,
                rendidorCargo: rep.rendidorCargo || null,
                centroCostoId: rep.centroCostoId || null,
                centroCostoCodigo: rep.centroCostoCodigo || null,
                centroCostoNombre: rep.centroCostoNombre || null,
                proyectoId: rep.proyectoId || null,
                proyectoCodigo: rep.proyectoCodigo || null,
                proyectoNombre: rep.proyectoNombre || null,
                fondoAsignadoClp: String(rep.fondoAsignadoClp || '0.00'),
                montoTotalRendidoClp: String(rep.montoTotalRendidoClp || '0.00'),
                saldoReembolsarClp: String(rep.saldoReembolsarClp || '0.00'),
                saldoReintegrarClp: String(rep.saldoReintegrarClp || '0.00'),
                moneda: rep.moneda || 'CLP',
                estado: rep.estado || 'BORRADOR',
                fechaInicio: rep.fechaInicio,
                fechaCierre: rep.fechaCierre,
                fechaAprobacion: rep.fechaAprobacion || null,
                fechaPagoReembolso: rep.fechaPagoReembolso || null,
                aprobadorNombre: rep.aprobadorNombre || null,
                aprobadorEmail: rep.aprobadorEmail || null,
                observacionesAprobador: rep.observacionesAprobador || null,
                asientoContableId: rep.asientoContableId || null,
                agenteAuditorScore: rep.agenteAuditorScore || 100,
                agenteAuditorDiagnostico: rep.agenteAuditorDiagnostico || null,
                createdAt: new Date(rep.createdAt || Date.now()),
                updatedAt: new Date(rep.updatedAt || Date.now()),
              })
              .onDuplicateKeyUpdate({
                set: {
                  estado: rep.estado,
                  montoTotalRendidoClp: String(rep.montoTotalRendidoClp || '0.00'),
                  saldoReembolsarClp: String(rep.saldoReembolsarClp || '0.00'),
                  saldoReintegrarClp: String(rep.saldoReintegrarClp || '0.00'),
                  observacionesAprobador: rep.observacionesAprobador || null,
                  asientoContableId: rep.asientoContableId || null,
                  updatedAt: new Date(),
                },
              });
          } catch (e) {}
        }
      }

      // 8. Comprobantes / Ítems de Rendición
      if (this.store.expenseItems && this.store.expenseItems.length > 0) {
        for (const item of this.store.expenseItems) {
          try {
            await mysqlDb
              .insert(expenseItems)
              .values({
                id: item.id,
                expenseReportId: item.expenseReportId,
                empresaId: item.empresaId,
                fecha: item.fecha,
                tipoDocumento: item.tipoDocumento,
                folioDocumento: item.folioDocumento,
                proveedorRut: item.proveedorRut,
                proveedorRazonSocial: item.proveedorRazonSocial,
                categoria: item.categoria,
                descripcionGlosa: item.descripcionGlosa,
                montoNeto: String(item.montoNeto || '0.00'),
                montoIva: String(item.montoIva || '0.00'),
                montoExento: String(item.montoExento || '0.00'),
                montoTotalClp: String(item.montoTotalClp || '0.00'),
                monedaOriginal: item.monedaOriginal || 'CLP',
                montoOriginal: item.montoOriginal ? String(item.montoOriginal) : null,
                tipoCambio: String(item.tipoCambio || '1.0000'),
                centroCostoId: item.centroCostoId || null,
                centroCostoCodigo: item.centroCostoCodigo || null,
                proyectoId: item.proyectoId || null,
                proyectoCodigo: item.proyectoCodigo || null,
                cuentaContableCodigo: item.cuentaContableCodigo,
                cuentaContableNombre: item.cuentaContableNombre || null,
                comprobanteArchivoNombre: item.comprobanteArchivoNombre || null,
                comprobanteUrl: item.comprobanteUrl || null,
                comprobantePreviewBase64: item.comprobantePreviewBase64 || null,
                esGastoRechazadoArt21: Boolean(item.esGastoRechazadoArt21),
                validadoPorAgente: Boolean(item.validadoPorAgente),
                observacionAgente: item.observacionAgente || null,
                createdAt: new Date(item.createdAt || Date.now()),
              })
              .onDuplicateKeyUpdate({
                set: {
                  descripcionGlosa: item.descripcionGlosa,
                  montoTotalClp: String(item.montoTotalClp || '0.00'),
                  cuentaContableCodigo: item.cuentaContableCodigo,
                },
              });
          } catch (e) {}
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

  public addAccountingEntry(entry: any, lines?: any[]) {
    const entryLines = lines || entry.lineas || [];
    // 1. Guardar en memoria de proceso y disco
    const existingIndex = this.store.entries.findIndex((e) => e.id === entry.id);
    if (existingIndex >= 0) {
      this.store.entries[existingIndex] = entry;
      this.store.lines = this.store.lines.filter((l) => l.entryId !== entry.id);
    } else {
      this.store.entries.unshift(entry);
    }

    this.store.lines.push(...entryLines);
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
            documentoReferencia: entry.documentoReferencia || entry.documentoRef || null,
            tipoDocumentoRef: entry.tipoDocumentoRef || null,
            folioDocumentoRef: entry.folioDocumentoRef || null,
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
              documentoRef: line.documentoRef || entry.documentoRef || null,
              dteIdAsociado: line.dteIdAsociado || null,
              tipoDocumentoRef: line.tipoDocumentoRef || entry.tipoDocumentoRef || null,
              folioDocumentoRef: line.folioDocumentoRef || entry.folioDocumentoRef || null,
              montoDocumentoRef: line.montoDocumentoRef != null ? String(line.montoDocumentoRef) : null,
              fechaDocumentoRef: line.fechaDocumentoRef || null,
              fechaVencimientoRef: line.fechaVencimientoRef || null,
              documentoOperacion: line.documentoOperacion || null,
              tipoDocumentoOperacion: line.tipoDocumentoOperacion || null,
              fechaDocumentoOperacion: line.fechaDocumentoOperacion || null,
              documentoConciliacion: line.documentoConciliacion || null,
              tipoDocumentoConciliacion: line.tipoDocumentoConciliacion || null,
              monedaOriginal: line.monedaOriginal || null,
              montoMonedaOriginal: line.montoMonedaOriginal != null ? String(line.montoMonedaOriginal) : null,
              tipoCambio: line.tipoCambio != null ? String(line.tipoCambio) : null,
            });
          }
        } catch (sqlErr: any) {
          console.warn(`[DiskPersistence] Error al escribir asiento en MySQL (respaldo en disco seguro): ${sqlErr.message}`);
        }
      })();
    }
  }

  public deleteAccountingEntry(entryId: string): boolean {
    const initialCount = this.store.entries.length;
    this.store.entries = this.store.entries.filter((e) => e.id !== entryId);
    this.store.lines = this.store.lines.filter((l) => l.entryId !== entryId);
    this.scheduleFlush();

    // Purgar también de memoria de proceso si estuviese ahí
    try {
      const { inMemoryEntries, inMemoryLines } = require('../db/mysqlClient');
      if (Array.isArray(inMemoryEntries)) {
        const idx = inMemoryEntries.findIndex((e: any) => e.id === entryId);
        if (idx >= 0) inMemoryEntries.splice(idx, 1);
      }
      if (Array.isArray(inMemoryLines)) {
        for (let i = inMemoryLines.length - 1; i >= 0; i--) {
          if (inMemoryLines[i].entryId === entryId) {
            inMemoryLines.splice(i, 1);
          }
        }
      }
    } catch {}

    if (isRealMysqlConnected) {
      (async () => {
        try {
          await mysqlDb.delete(accountingEntryLines).where(eq(accountingEntryLines.entryId, entryId));
          await mysqlDb.delete(accountingEntries).where(eq(accountingEntries.id, entryId));
        } catch (sqlErr: any) {
          console.warn(`[DiskPersistence] Error al eliminar asiento en MySQL: ${sqlErr.message}`);
        }
      })();
    }

    return this.store.entries.length < initialCount;
  }

  public updateAccountingEntry(entryId: string, updatedFields: any, newLines?: any[]): boolean {
    const existingIndex = this.store.entries.findIndex((e) => e.id === entryId);
    if (existingIndex < 0) return false;

    this.store.entries[existingIndex] = {
      ...this.store.entries[existingIndex],
      ...updatedFields,
    };

    if (Array.isArray(newLines)) {
      this.store.lines = this.store.lines.filter((l) => l.entryId !== entryId);
      this.store.lines.push(...newLines);
    }

    this.scheduleFlush();

    // Sincronizar en memoria de proceso
    try {
      const { inMemoryEntries, inMemoryLines } = require('../db/mysqlClient');
      if (Array.isArray(inMemoryEntries)) {
        const idx = inMemoryEntries.findIndex((e: any) => e.id === entryId);
        if (idx >= 0) inMemoryEntries[idx] = { ...inMemoryEntries[idx], ...updatedFields };
      }
      if (Array.isArray(newLines) && Array.isArray(inMemoryLines)) {
        for (let i = inMemoryLines.length - 1; i >= 0; i--) {
          if (inMemoryLines[i].entryId === entryId) {
            inMemoryLines.splice(i, 1);
          }
        }
        inMemoryLines.push(...newLines);
      }
    } catch {}

    if (isRealMysqlConnected) {
      (async () => {
        try {
          const entryUpdate: any = {};
          if (updatedFields.concepto !== undefined) entryUpdate.concepto = updatedFields.concepto;
          if (updatedFields.fecha !== undefined) entryUpdate.fecha = updatedFields.fecha;
          if (updatedFields.documentoRef !== undefined) {
            entryUpdate.documentoRef = updatedFields.documentoRef;
            entryUpdate.documentoReferencia = updatedFields.documentoReferencia || updatedFields.documentoRef;
          }
          if (updatedFields.documentoReferencia !== undefined) entryUpdate.documentoReferencia = updatedFields.documentoReferencia;
          if (updatedFields.tipoDocumentoRef !== undefined) entryUpdate.tipoDocumentoRef = updatedFields.tipoDocumentoRef;
          if (updatedFields.folioDocumentoRef !== undefined) entryUpdate.folioDocumentoRef = updatedFields.folioDocumentoRef;
          if (updatedFields.totalDebe !== undefined) entryUpdate.totalDebe = String(updatedFields.totalDebe);
          if (updatedFields.totalHaber !== undefined) entryUpdate.totalHaber = String(updatedFields.totalHaber);
          if (updatedFields.supervisorSignature !== undefined) entryUpdate.supervisorSignature = updatedFields.supervisorSignature;

          if (Object.keys(entryUpdate).length > 0) {
            await mysqlDb.update(accountingEntries).set(entryUpdate).where(eq(accountingEntries.id, entryId));
          }

          if (Array.isArray(newLines)) {
            await mysqlDb.delete(accountingEntryLines).where(eq(accountingEntryLines.entryId, entryId));
            for (const line of newLines) {
              await mysqlDb.insert(accountingEntryLines).values({
                id: line.id || crypto.randomUUID(),
                entryId,
                lineaNumero: line.lineaNumero || 1,
                codigoCuenta: line.codigoCuenta,
                nombreCuenta: line.nombreCuenta,
                debe: String(line.debe),
                haber: String(line.haber),
                rutAuxiliar: line.rutAuxiliar || null,
                centroCosto: line.centroCosto || null,
                documentoRef: line.documentoRef || updatedFields.documentoRef || null,
                dteIdAsociado: line.dteIdAsociado || null,
                tipoDocumentoRef: line.tipoDocumentoRef || updatedFields.tipoDocumentoRef || null,
                folioDocumentoRef: line.folioDocumentoRef || updatedFields.folioDocumentoRef || null,
                montoDocumentoRef: line.montoDocumentoRef != null ? String(line.montoDocumentoRef) : null,
                fechaDocumentoRef: line.fechaDocumentoRef || null,
                fechaVencimientoRef: line.fechaVencimientoRef || null,
                documentoOperacion: line.documentoOperacion || null,
                tipoDocumentoOperacion: line.tipoDocumentoOperacion || null,
                fechaDocumentoOperacion: line.fechaDocumentoOperacion || null,
                documentoConciliacion: line.documentoConciliacion || null,
                tipoDocumentoConciliacion: line.tipoDocumentoConciliacion || null,
                monedaOriginal: line.monedaOriginal || null,
                montoMonedaOriginal: line.montoMonedaOriginal != null ? String(line.montoMonedaOriginal) : null,
                tipoCambio: line.tipoCambio != null ? String(line.tipoCambio) : null,
              });
            }
          }
        } catch (sqlErr: any) {
          console.warn(`[DiskPersistence] Error al actualizar asiento en MySQL: ${sqlErr.message}`);
        }
      })();
    }

    return true;
  }

  public addAccountingLines(lines: any[]) {
    if (!Array.isArray(lines) || lines.length === 0) return;
    for (const line of lines) {
      const existingIdx = this.store.lines.findIndex((l) => l.id === line.id);
      if (existingIdx >= 0) {
        this.store.lines[existingIdx] = line;
      } else {
        this.store.lines.push(line);
      }
    }
    this.scheduleFlush();

    if (isRealMysqlConnected) {
      (async () => {
        try {
          for (const line of lines) {
            await mysqlDb.insert(accountingEntryLines).values({
              id: line.id || crypto.randomUUID(),
              entryId: line.entryId,
              lineaNumero: line.lineaNumero || 1,
              codigoCuenta: line.codigoCuenta,
              nombreCuenta: line.nombreCuenta,
              debe: String(line.debe),
              haber: String(line.haber),
              rutAuxiliar: line.rutAuxiliar || null,
              centroCosto: line.centroCosto || null,
              documentoRef: line.documentoRef || null,
              dteIdAsociado: line.dteIdAsociado || null,
              tipoDocumentoRef: line.tipoDocumentoRef || null,
              folioDocumentoRef: line.folioDocumentoRef || null,
              montoDocumentoRef: line.montoDocumentoRef != null ? String(line.montoDocumentoRef) : null,
              fechaDocumentoRef: line.fechaDocumentoRef || null,
              fechaVencimientoRef: line.fechaVencimientoRef || null,
              documentoOperacion: line.documentoOperacion || null,
              tipoDocumentoOperacion: line.tipoDocumentoOperacion || null,
              fechaDocumentoOperacion: line.fechaDocumentoOperacion || null,
              documentoConciliacion: line.documentoConciliacion || null,
              tipoDocumentoConciliacion: line.tipoDocumentoConciliacion || null,
              monedaOriginal: line.monedaOriginal || null,
              montoMonedaOriginal: line.montoMonedaOriginal != null ? String(line.montoMonedaOriginal) : null,
              tipoCambio: line.tipoCambio != null ? String(line.tipoCambio) : null,
            });
          }
        } catch (sqlErr: any) {
          console.warn(`[DiskPersistence] Error al escribir líneas en MySQL: ${sqlErr.message}`);
        }
      })();
    }
  }

  public saveBankMovements(movements: any[], empresaId?: string, replace = false) {
    if (!Array.isArray(movements) || movements.length === 0) return;
    if (!this.store.bankMovements) this.store.bankMovements = [];
    const norm = (empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
    if (replace && norm) {
      this.store.bankMovements = this.store.bankMovements.filter((m) => {
        const mEmp = (m.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
        return mEmp !== norm;
      });
    }
    for (const mov of movements) {
      const targetEmp = mov.empresaId || empresaId;
      const normalizedMov = { ...mov, empresaId: targetEmp };
      const idx = this.store.bankMovements.findIndex((m) => m.id === mov.id);
      if (idx >= 0) {
        this.store.bankMovements[idx] = { ...this.store.bankMovements[idx], ...normalizedMov };
      } else {
        this.store.bankMovements.push(normalizedMov);
      }
    }
    if (empresaId) {
      this.saveClientState(empresaId, 'bankMovements', movements);
    }
    this.scheduleFlush();

    if (isRealMysqlConnected) {
      (async () => {
        try {
          for (const mov of movements) {
            await mysqlDb
              .insert(bankTransactions)
              .values({
                id: mov.id,
                accountId: mov.cuentaId || mov.accountId || 'bank-acc-01',
                fecha: mov.fecha,
                descripcion: mov.glosaBancaria || mov.descripcion || '',
                cargo: String(mov.cargo || 0),
                abono: String(mov.abono || 0),
                documentoRef: mov.documentoRef || mov.numeroReferencia || null,
                estadoConciliacion: mov.estado || 'PENDIENTE',
                matchedDteId: mov.dteFolioAsociado ? String(mov.dteFolioAsociado) : null,
                moneda: mov.moneda || 'CLP',
                tipoCambio: mov.tipoCambio != null ? String(mov.tipoCambio) : '1.0000',
                montoClpEquivalente: mov.montoCLPEquivalente != null ? String(mov.montoCLPEquivalente) : null,
                matchCerteza: mov.matchCerteza || null,
                matchSugeridoId: mov.matchSugeridoId || null,
                matchSugeridoGlosa: mov.matchSugeridoGlosa || null,
                codigoConciliacion: mov.codigoConciliacion || null,
                fechaConciliacion: mov.fechaConciliacion ? new Date(mov.fechaConciliacion) : null,
                matchCriterio: mov.matchCriterio || null,
                usuarioConciliador: mov.usuarioConciliador || null,
                asientoGeneradoId: mov.asientoGeneradoId || null,
                partidaContableDetalle: mov.partidaContableDetalle || null,
                esAmbiguo: Boolean(mov.esAmbiguo),
                candidatosMatchesCount: mov.candidatosMatchesCount || 0,
                origenImportacion: mov.origenImportacion || 'MANUAL',
              })
              .onDuplicateKeyUpdate({
                set: {
                  estadoConciliacion: mov.estado || 'PENDIENTE',
                  codigoConciliacion: mov.codigoConciliacion || null,
                  fechaConciliacion: mov.fechaConciliacion ? new Date(mov.fechaConciliacion) : null,
                  matchCriterio: mov.matchCriterio || null,
                  usuarioConciliador: mov.usuarioConciliador || null,
                  asientoGeneradoId: mov.asientoGeneradoId || null,
                  partidaContableDetalle: mov.partidaContableDetalle || null,
                  esAmbiguo: Boolean(mov.esAmbiguo),
                  candidatosMatchesCount: mov.candidatosMatchesCount || 0,
                },
              });
          }
        } catch (sqlErr: any) {
          console.warn(`[DiskPersistence] Error al escribir movimientos bancarios en MySQL: ${sqlErr.message}`);
        }
      })();
    }
  }

  public getBankMovements(accountIdOrEmpresaId?: string, empresaId?: string): any[] {
    let list = this.store.bankMovements || [];
    if (!accountIdOrEmpresaId && !empresaId) return list;

    if (accountIdOrEmpresaId && !empresaId) {
      const norm = accountIdOrEmpresaId.replace(/[\.\-\s]/g, '').toUpperCase();
      const hasMatchingCompany = list.some((m: any) => {
        const mEmp = (m.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
        return mEmp === norm;
      });
      const isRutOrEmpresa = hasMatchingCompany ||
        /^[0-9]{7,8}-[0-9kK]$/.test(accountIdOrEmpresaId) ||
        accountIdOrEmpresaId.startsWith('emp-') ||
        accountIdOrEmpresaId.startsWith('EMP-') ||
        accountIdOrEmpresaId.startsWith('client-') ||
        accountIdOrEmpresaId.startsWith('CLIENT-');

      if (isRutOrEmpresa) {
        const filtered = list.filter((m: any) => {
          const mEmp = (m.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
          return mEmp === norm;
        });
        if (filtered.length > 0) return filtered;
        const saved = this.getClientState(accountIdOrEmpresaId, 'bankMovements');
        if (Array.isArray(saved) && saved.length > 0) return saved;
        return filtered;
      }
      return list.filter((m: any) => m.cuentaId === accountIdOrEmpresaId || m.accountId === accountIdOrEmpresaId || m.bankAccountId === accountIdOrEmpresaId);
    }

    if (accountIdOrEmpresaId) {
      list = list.filter((m: any) => m.cuentaId === accountIdOrEmpresaId || m.accountId === accountIdOrEmpresaId);
    }
    if (empresaId) {
      const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
      const filtered = list.filter((m: any) => {
        const mEmp = (m.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
        return mEmp === norm;
      });
      if (filtered.length > 0) return filtered;
      const saved = this.getClientState(empresaId, 'bankMovements');
      if (Array.isArray(saved) && saved.length > 0) return saved;
      return filtered;
    }
    return list;
  }

  public getBankMovementsByCompany(empresaId?: string): any[] {
    return this.getBankMovements(empresaId);
  }

  public getBankAccounts(empresaId?: string): any[] {
    let list = this.store.bankAccounts || [];
    if (!empresaId) return list;
    const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
    const filtered = list.filter((b: any) => {
      const bEmp = (b.empresaId || b.empresa_id || b.rut || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return bEmp === norm;
    });
    if (filtered.length > 0) return filtered;
    const saved = this.getClientState(empresaId, 'bankAccounts');
    if (Array.isArray(saved) && saved.length > 0) return saved;
    return list.filter((b: any) => {
      const bEmp = (b.empresaId || b.empresa_id || b.rut || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return !bEmp;
    });
  }

  public saveBankAccounts(accounts: any[], empresaId?: string, replace = false): void {
    if (!Array.isArray(accounts)) return;
    if (!this.store.bankAccounts) this.store.bankAccounts = [];
    const norm = (empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
    if (replace && norm) {
      this.store.bankAccounts = this.store.bankAccounts.filter((b: any) => {
        const bEmp = (b.empresaId || b.empresa_id || b.rut || '').replace(/[\.\-\s]/g, '').toUpperCase();
        return bEmp !== norm;
      });
    }
    for (const acc of accounts) {
      const targetEmpresaId = acc.empresaId || empresaId;
      const idx = this.store.bankAccounts.findIndex((b: any) => b.id === acc.id);
      if (idx >= 0) {
        this.store.bankAccounts[idx] = { ...this.store.bankAccounts[idx], ...acc, empresaId: targetEmpresaId };
      } else {
        this.store.bankAccounts.push({ ...acc, empresaId: targetEmpresaId });
      }
    }
    if (empresaId) {
      this.saveClientState(empresaId, 'bankAccounts', accounts);
    }
    this.scheduleFlush();
  }

  public savePayrolls(payrolls: any[], empresaId?: string, replace = false): void {
    if (!Array.isArray(payrolls)) return;
    if (!this.store.payrolls) this.store.payrolls = [];
    const norm = (empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
    if (replace && norm) {
      this.store.payrolls = this.store.payrolls.filter((p: any) => {
        const pEmp = (p.empresaId || p.empresa_id || p.rutEmpresa || '').replace(/[\.\-\s]/g, '').toUpperCase();
        return pEmp !== norm;
      });
    }
    for (const pay of payrolls) {
      const targetEmpresaId = pay.empresaId || pay.rutEmpresa || empresaId;
      const idx = this.store.payrolls.findIndex((p: any) => p.id === pay.id);
      if (idx >= 0) {
        this.store.payrolls[idx] = { ...this.store.payrolls[idx], ...pay, empresaId: targetEmpresaId };
      } else {
        this.store.payrolls.push({ ...pay, empresaId: targetEmpresaId });
      }
    }
    if (empresaId) {
      this.saveClientState(empresaId, 'payrolls', payrolls);
    }
    this.scheduleFlush();
  }

  public getJournalEntries(empresaId?: string, periodo?: string): any[] {
    return this.getAccountingEntries(empresaId, periodo);
  }

  public getPayrolls(empresaId?: string, periodo?: string): any[] {
    let result = this.store.payrolls || [];
    if (empresaId) {
      const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
      result = result.filter((p: any) => {
        const pEmp = (p.empresaId || p.empresa_id || p.rutEmpresa || '').replace(/[\.\-\s]/g, '').toUpperCase();
        return pEmp === norm;
      });
    }
    if (periodo) {
      result = result.filter((p: any) => !p.periodo || p.periodo === periodo);
    }
    if (result.length > 0) return result;
    if (empresaId) {
      const saved = this.getClientState(empresaId, 'payrolls');
      if (Array.isArray(saved) && saved.length > 0) {
        return periodo ? saved.filter((p: any) => !p.periodo || p.periodo === periodo) : saved;
      }
    }
    return result;
  }

  public addDtes(dtes: any[]): void {
    if (!Array.isArray(dtes)) return;
    for (const d of dtes) {
      this.addDte(d);
    }
  }

  public saveDtes(empresaId: string, dtes: any[], replace = false): void {
    if (!Array.isArray(dtes)) return;
    if (!this.store.dtes) this.store.dtes = [];
    const norm = (empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
    if (replace && norm) {
      this.store.dtes = this.store.dtes.filter((d: any) => {
        const dNorm = (d.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
        return dNorm !== norm;
      });
    }
    for (const d of dtes) {
      this.addDte({ ...d, empresaId });
    }
    if (empresaId) {
      this.saveClientState(empresaId, 'dtes', dtes);
    }
    this.scheduleFlush();
  }

  public getAccountingEntries(empresaId?: string, periodo?: string): any[] {
    let result = this.store.entries;
    if (empresaId) {
      const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
      result = result.filter((e) => {
        const eNorm = (e.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
        return eNorm === norm;
      });
    }
    if (periodo) {
      result = result.filter((e) => !e.periodo || e.periodo === periodo);
    }
    return result.map((e) => ({
      ...e,
      lineas: e.lineas || this.getLinesForEntry(e.id),
    }));
  }

  public getLinesForEntry(entryId: string): any[] {
    return this.store.lines.filter((l) => l.entryId === entryId);
  }

  public getAllLines(): any[] {
    return this.store.lines || [];
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
        return Boolean(dNorm && dNorm === norm);
      });
    }
    if (periodo) {
      result = result.filter((d) => (d.periodo || (d.fechaEmision ? d.fechaEmision.slice(0, 7) : '')) === periodo);
    }
    if (result.length > 0) return result;
    if (empresaId) {
      const saved = this.getClientState(empresaId, 'dtes');
      if (Array.isArray(saved) && saved.length > 0) {
        return periodo ? saved.filter((d: any) => (d.periodo || (d.fechaEmision ? d.fechaEmision.slice(0, 7) : '')) === periodo) : saved;
      }
    }
    return result;
  }

  public markDtesAsCentralized(empresaId: string, periodo: string, tipoOp: string, entryId: string): void {
    const norm = (empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
    let modified = false;
    for (const d of this.store.dtes) {
      const dEmp = (d.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      if ((!norm || !dEmp || dEmp === norm) && (!periodo || d.periodo === periodo)) {
        if (!tipoOp || d.tipoOperacion === tipoOp || d.tipo === tipoOp) {
          d.estadoContable = 'CENTRALIZADO';
          d.entryIdRef = entryId;
          modified = true;
        }
      }
    }
    if (modified) {
      this.scheduleFlush();
    }
  }

  private ensureSessionsFile(): Record<string, any> {
    const sessDir = path.resolve(process.cwd(), 'storage');
    const sessFile = path.join(sessDir, 'sessions.json');
    try {
      if (!fs.existsSync(sessDir)) {
        fs.mkdirSync(sessDir, { recursive: true });
      }
      if (fs.existsSync(sessFile)) {
        return JSON.parse(fs.readFileSync(sessFile, 'utf-8'));
      }
    } catch {}
    return this.store.sessions || {};
  }

  private writeSessionsFile(sessions: Record<string, any>): void {
    const sessDir = path.resolve(process.cwd(), 'storage');
    const sessFile = path.join(sessDir, 'sessions.json');
    try {
      if (!fs.existsSync(sessDir)) {
        fs.mkdirSync(sessDir, { recursive: true });
      }
      const tmp = `${sessFile}.tmp.${Date.now()}`;
      fs.writeFileSync(tmp, JSON.stringify(sessions, null, 2), 'utf-8');
      fs.renameSync(tmp, sessFile);
    } catch (e: any) {
      console.warn(`[DiskPersistence] Error guardando sessions.json: ${e.message}`);
    }
  }

  public saveSession(token: string, session: any): void {
    const sessions = this.ensureSessionsFile();
    sessions[token] = session;
    this.writeSessionsFile(sessions);
    if (!this.store.sessions) {
      this.store.sessions = {};
    }
    this.store.sessions[token] = session;
  }

  public getSession(token: string): any | null {
    const sessions = this.ensureSessionsFile();
    const s = sessions[token] || (this.store.sessions ? this.store.sessions[token] : null);
    if (s && s.expiresAt > Date.now()) {
      return s;
    }
    if (s && s.expiresAt <= Date.now()) {
      delete sessions[token];
      this.writeSessionsFile(sessions);
      if (this.store.sessions) delete this.store.sessions[token];
    }
    return null;
  }

  public deleteSession(token: string): void {
    const sessions = this.ensureSessionsFile();
    if (sessions[token]) {
      delete sessions[token];
      this.writeSessionsFile(sessions);
    }
    if (this.store.sessions && this.store.sessions[token]) {
      delete this.store.sessions[token];
    }
  }

  public getInventoryItems(empresaId?: string): any[] {
    const items = this.store.inventoryItems || [];
    if (!empresaId) return items;
    const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
    return items.filter((item: any) => {
      const itemEmpresa = (item.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return itemEmpresa === norm;
    });
  }

  public setInventoryItems(empresaId: string, items: any[]): void {
    if (!this.store.inventoryItems) this.store.inventoryItems = [];
    const norm = (empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
    this.store.inventoryItems = this.store.inventoryItems.filter((it: any) => {
      const itemEmpresa = (it.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return itemEmpresa && itemEmpresa !== norm;
    });
    for (const item of items) {
      this.store.inventoryItems.push({
        ...item,
        empresaId: item.empresaId || empresaId,
      });
    }
    this.scheduleFlush();
  }

  public saveInventoryItem(item: any): void {
    if (!this.store.inventoryItems) this.store.inventoryItems = [];
    const idx = this.store.inventoryItems.findIndex(
      (it: any) => it.id === item.id || (it.sku === item.sku && it.empresaId === item.empresaId)
    );
    if (idx >= 0) {
      this.store.inventoryItems[idx] = { ...this.store.inventoryItems[idx], ...item };
    } else {
      this.store.inventoryItems.push(item);
    }
    this.scheduleFlush();
  }

  public recordStockMovement(movement: any): void {
    if (!this.store.stockMovements) this.store.stockMovements = [];
    this.store.stockMovements.unshift(movement);

    // Actualizar stock físico en inventoryItems
    const items = this.store.inventoryItems || [];
    const norm = (movement.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
    const item = items.find(
      (it: any) =>
        (it.id === movement.itemId || it.sku === movement.sku) &&
        (!movement.empresaId || (it.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase() === norm)
    );

    if (item) {
      const currentStock = Number(item.stockActual ?? item.stockTotal ?? 0);
      const qty = Number(movement.cantidad || 0);
      const unitCost = Number(movement.costoUnitario || item.costoPromedioPonderado || item.costoUnitarioPMP || 0);

      if (movement.tipoMovimiento === 'ENTRADA') {
        const totalOldVal = currentStock * Number(item.costoPromedioPonderado ?? item.costoUnitarioPMP ?? 0);
        const totalNewVal = qty * unitCost;
        const newStock = currentStock + qty;
        item.stockActual = newStock;
        item.stockTotal = newStock;
        if (newStock > 0) {
          const newPmp = Math.round((totalOldVal + totalNewVal) / newStock);
          item.costoPromedioPonderado = newPmp;
          item.costoUnitarioPMP = newPmp;
        }
      } else if (movement.tipoMovimiento === 'SALIDA' || movement.tipoMovimiento === 'MERMA') {
        const newStock = Math.max(0, currentStock - qty);
        item.stockActual = newStock;
        item.stockTotal = newStock;
      }
    }
    this.scheduleFlush();
  }

  public getWarehouses(empresaId?: string): any[] {
    const list = this.store.warehouses || [];
    if (!empresaId) return list;
    const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
    return list.filter((w: any) => {
      const wEmp = (w.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return wEmp === norm;
    });
  }

  public saveWarehouse(w: any): void {
    if (!this.store.warehouses) this.store.warehouses = [];
    const idx = this.store.warehouses.findIndex((item: any) => item.id === w.id);
    if (idx >= 0) {
      this.store.warehouses[idx] = { ...this.store.warehouses[idx], ...w };
    } else {
      this.store.warehouses.push(w);
    }
    this.scheduleFlush();
  }

  public setWarehouses(empresaId: string, list: any[]): void {
    if (!this.store.warehouses) this.store.warehouses = [];
    const norm = (empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
    this.store.warehouses = this.store.warehouses.filter((w: any) => {
      const wEmp = (w.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return wEmp && wEmp !== norm;
    });
    for (const w of list) {
      this.store.warehouses.push({ ...w, empresaId: w.empresaId || empresaId });
    }
    this.scheduleFlush();
  }

  public getWarehouseTransfers(empresaId?: string): any[] {
    const list = this.store.warehouseTransfers || [];
    if (!empresaId) return list;
    const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
    return list.filter((t: any) => {
      const tEmp = (t.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return tEmp === norm;
    });
  }

  public saveWarehouseTransfer(transfer: any): void {
    if (!this.store.warehouseTransfers) this.store.warehouseTransfers = [];
    const idx = this.store.warehouseTransfers.findIndex((t: any) => t.id === transfer.id);
    if (idx >= 0) {
      this.store.warehouseTransfers[idx] = { ...this.store.warehouseTransfers[idx], ...transfer };
    } else {
      this.store.warehouseTransfers.unshift(transfer);
    }
    this.scheduleFlush();
  }

  public setWarehouseTransfers(empresaId: string, list: any[]): void {
    if (!this.store.warehouseTransfers) this.store.warehouseTransfers = [];
    const norm = (empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
    this.store.warehouseTransfers = this.store.warehouseTransfers.filter((t: any) => {
      const tEmp = (t.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return tEmp && tEmp !== norm;
    });
    for (const t of list) {
      this.store.warehouseTransfers.push({ ...t, empresaId: t.empresaId || empresaId });
    }
    this.scheduleFlush();
  }

  public getReplenishmentRequisitions(empresaId?: string): any[] {
    const list = this.store.replenishmentRequisitions || [];
    if (!empresaId) return list;
    const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
    return list.filter((r: any) => {
      const rEmp = (r.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return rEmp === norm;
    });
  }

  public saveReplenishmentRequisition(req: any): void {
    if (!this.store.replenishmentRequisitions) this.store.replenishmentRequisitions = [];
    const idx = this.store.replenishmentRequisitions.findIndex((r: any) => r.id === req.id);
    if (idx >= 0) {
      this.store.replenishmentRequisitions[idx] = { ...this.store.replenishmentRequisitions[idx], ...req };
    } else {
      this.store.replenishmentRequisitions.unshift(req);
    }
    this.scheduleFlush();
  }

  public setReplenishmentRequisitions(empresaId: string, list: any[]): void {
    if (!this.store.replenishmentRequisitions) this.store.replenishmentRequisitions = [];
    const norm = (empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
    this.store.replenishmentRequisitions = this.store.replenishmentRequisitions.filter((r: any) => {
      const rEmp = (r.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return rEmp && rEmp !== norm;
    });
    for (const r of list) {
      this.store.replenishmentRequisitions.push({ ...r, empresaId: r.empresaId || empresaId });
    }
    this.scheduleFlush();
  }

  public getProductionOrders(empresaId?: string): any[] {
    const list = this.store.productionOrders || [];
    if (!empresaId) return list;
    const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
    return list.filter((o: any) => {
      const oEmp = (o.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return oEmp === norm;
    });
  }

  public saveProductionOrder(order: any): void {
    if (!this.store.productionOrders) this.store.productionOrders = [];
    const idx = this.store.productionOrders.findIndex((o: any) => o.id === order.id);
    if (idx >= 0) {
      this.store.productionOrders[idx] = { ...this.store.productionOrders[idx], ...order };
    } else {
      this.store.productionOrders.unshift(order);
    }
    this.scheduleFlush();
  }

  public setProductionOrders(empresaId: string, orders: any[]): void {
    if (!this.store.productionOrders) this.store.productionOrders = [];
    const norm = (empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
    this.store.productionOrders = this.store.productionOrders.filter((o: any) => {
      const oEmp = (o.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return oEmp && oEmp !== norm;
    });
    for (const o of orders) {
      this.store.productionOrders.push({ ...o, empresaId: o.empresaId || empresaId });
    }
    this.scheduleFlush();
  }

  public saveProductionOrders(empresaId: string, orders: any[]): void {
    this.setProductionOrders(empresaId, orders);
  }

  public getProductionBudgets(empresaId?: string): any[] {
    const list = this.store.productionBudgets || [];
    if (!empresaId) return list;
    const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
    return list.filter((b: any) => {
      const bEmp = (b.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return bEmp === norm;
    });
  }

  public saveProductionBudget(budget: any): void {
    if (!this.store.productionBudgets) this.store.productionBudgets = [];
    const idx = this.store.productionBudgets.findIndex((b: any) => b.id === budget.id);
    if (idx >= 0) {
      this.store.productionBudgets[idx] = { ...this.store.productionBudgets[idx], ...budget };
    } else {
      this.store.productionBudgets.unshift(budget);
    }
    this.scheduleFlush();
  }

  public getWarehouseWithdrawals(empresaId?: string): any[] {
    const list = this.store.warehouseWithdrawals || [];
    if (!empresaId) return list;
    const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
    return list.filter((w: any) => {
      const wEmp = (w.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return wEmp === norm;
    });
  }

  public saveWarehouseWithdrawal(w: any): void {
    if (!this.store.warehouseWithdrawals) this.store.warehouseWithdrawals = [];
    const idx = this.store.warehouseWithdrawals.findIndex((item: any) => item.id === w.id);
    if (idx >= 0) {
      this.store.warehouseWithdrawals[idx] = { ...this.store.warehouseWithdrawals[idx], ...w };
    } else {
      this.store.warehouseWithdrawals.unshift(w);
    }
    this.scheduleFlush();
  }

  public getRecipes(empresaId?: string): any[] {
    const list = this.store.recipes || [];
    if (!empresaId) return list;
    const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
    return list.filter((r: any) => {
      const rEmp = (r.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return rEmp === norm;
    });
  }

  public saveRecipe(recipe: any): void {
    if (!this.store.recipes) this.store.recipes = [];
    const idx = this.store.recipes.findIndex((r: any) => r.id === recipe.id);
    if (idx >= 0) {
      this.store.recipes[idx] = { ...this.store.recipes[idx], ...recipe };
    } else {
      this.store.recipes.push(recipe);
    }
    this.scheduleFlush();
  }

  public setRecipes(empresaId: string, list: any[]): void {
    if (!this.store.recipes) this.store.recipes = [];
    const norm = (empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
    this.store.recipes = this.store.recipes.filter((r: any) => {
      const rEmp = (r.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return rEmp && rEmp !== norm;
    });
    for (const r of list) {
      this.store.recipes.push({ ...r, empresaId: r.empresaId || empresaId });
    }
    this.scheduleFlush();
  }

  public getAutoRfqConfig(empresaId: string): any | null {
    if (!this.store.autoRfqConfigs) return null;
    return this.store.autoRfqConfigs[empresaId] || null;
  }

  public saveAutoRfqConfig(empresaId: string, config: any): void {
    if (!this.store.autoRfqConfigs) this.store.autoRfqConfigs = {};
    this.store.autoRfqConfigs[empresaId] = config;
    this.scheduleFlush();
  }

  public getAutoRfqs(empresaId?: string): any[] {
    const list = this.store.autoRfqs || [];
    if (!empresaId) return list;
    const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
    return list.filter((q: any) => {
      const qEmp = (q.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return qEmp === norm;
    });
  }

  public saveAutoRfqs(empresaId: string, list: any[]): void {
    if (!this.store.autoRfqs) this.store.autoRfqs = [];
    const norm = (empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
    this.store.autoRfqs = this.store.autoRfqs.filter((q: any) => {
      const qEmp = (q.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return qEmp && qEmp !== norm;
    });
    for (const q of list) {
      this.store.autoRfqs.push({ ...q, empresaId: q.empresaId || empresaId });
    }
    this.scheduleFlush();
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

  public saveFixedAsset(empresaId: string, fa: any) {
    this.addFixedAsset({ ...fa, empresaId });
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

  public setFixedAssets(empresaId: string, assets: any[]): void {
    if (!this.store.fixedAssets) this.store.fixedAssets = [];
    const norm = (empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
    this.store.fixedAssets = this.store.fixedAssets.filter((a: any) => {
      const aNorm = (a.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return aNorm && aNorm !== norm;
    });
    for (const a of assets) {
      this.store.fixedAssets.push({ ...a, empresaId: a.empresaId || empresaId });
    }
    this.scheduleFlush();
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
    expenseReportsCount: number;
    expenseItemsCount: number;
    expenseProjectsCount: number;
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
      expenseReportsCount: (this.store.expenseReports || []).length,
      expenseItemsCount: (this.store.expenseItems || []).length,
      expenseProjectsCount: (this.store.expenseProjects || []).length,
      mysqlActive: isRealMysqlConnected,
    };
  }

  // ==========================================================================
  // MÓDULO RENDICIÓN DE GASTOS ("RINDE GASTOS AI"): CRUD EN DISCO CON CERO MOCKS
  // ==========================================================================

  public getExpenseReports(empresaId?: string): any[] {
    const result = this.store.expenseReports || [];
    if (!empresaId) {
      return result;
    }
    const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
    return result.filter((r) => {
      const rNorm = (r.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return r.empresaId === empresaId || rNorm === norm;
    });
  }

  public updateExpenseReport(id: string, partial: any): boolean {
    if (!this.store.expenseReports) return false;
    const report = this.store.expenseReports.find((r) => r.id === id);
    if (!report) return false;
    Object.assign(report, partial, {
      updatedAt: new Date().toISOString(),
    });
    this.scheduleFlush();
    return true;
  }

  public saveExpenseReport(report: any) {
    if (!this.store.expenseReports) this.store.expenseReports = [];
    const idx = this.store.expenseReports.findIndex((r) => r.id === report.id);
    if (idx >= 0) {
      this.store.expenseReports[idx] = {
        ...this.store.expenseReports[idx],
        ...report,
        updatedAt: new Date().toISOString(),
      };
    } else {
      this.store.expenseReports.unshift({
        ...report,
        createdAt: report.createdAt || new Date().toISOString(),
        updatedAt: report.updatedAt || new Date().toISOString(),
      });
    }
    this.scheduleFlush();
  }

  public saveExpenseReports(empresaId: string, reports: any[]): void {
    if (!this.store.expenseReports) this.store.expenseReports = [];
    const norm = (empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
    this.store.expenseReports = this.store.expenseReports.filter((r: any) => {
      const rEmp = (r.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
      return rEmp && rEmp !== norm;
    });
    for (const r of reports) {
      this.store.expenseReports.push({ ...r, empresaId: r.empresaId || empresaId });
    }
    this.scheduleFlush();
  }

  public updateExpenseReportStatus(
    id: string,
    estado: string,
    observacionesAprobador?: string,
    aprobadorNombre?: string,
    asientoContableId?: string
  ): boolean {
    if (!this.store.expenseReports) return false;
    const report = this.store.expenseReports.find((r) => r.id === id);
    if (!report) return false;

    report.estado = estado;
    report.updatedAt = new Date().toISOString();
    if (observacionesAprobador !== undefined) report.observacionesAprobador = observacionesAprobador;
    if (aprobadorNombre !== undefined) report.aprobadorNombre = aprobadorNombre;
    if (asientoContableId !== undefined) report.asientoContableId = asientoContableId;

    if (estado === 'APROBADA') {
      report.fechaAprobacion = new Date().toISOString().substring(0, 10);
    } else if (estado === 'CONTABILIZADA_PAGADA') {
      report.fechaPagoReembolso = new Date().toISOString().substring(0, 10);
    }

    this.scheduleFlush();
    return true;
  }

  public getExpenseItems(reportId?: string, empresaId?: string): any[] {
    let result = this.store.expenseItems || [];
    if (empresaId) {
      const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
      result = result.filter((i) => {
        const iNorm = (i.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
        return (
          // Solo comprobantes de la propia empresa (antes cualquier empresa veía los de la empresa de ejemplo)
          i.empresaId === empresaId ||
          iNorm === norm
        );
      });
    }
    if (reportId) {
      result = result.filter((i) => i.expenseReportId === reportId);
    }
    return result;
  }

  public addExpenseItem(item: any) {
    if (!this.store.expenseItems) this.store.expenseItems = [];
    const idx = this.store.expenseItems.findIndex((i) => i.id === item.id);
    if (idx >= 0) {
      this.store.expenseItems[idx] = { ...this.store.expenseItems[idx], ...item };
    } else {
      this.store.expenseItems.unshift({
        ...item,
        createdAt: item.createdAt || new Date().toISOString(),
      });
    }

    // Recalcular montos consolidados de la rendición
    const reportId = item.expenseReportId;
    const report = (this.store.expenseReports || []).find((r) => r.id === reportId);
    if (report) {
      const itemsOfReport = this.store.expenseItems.filter((i) => i.expenseReportId === reportId);
      const totalRendido = itemsOfReport.reduce((acc, it) => acc + Number(it.montoTotalClp || 0), 0);
      const fondoAnticipo = Number(report.fondoAsignadoClp || 0);
      report.montoTotalRendidoClp = totalRendido;
      report.saldoReembolsarClp = Math.max(0, totalRendido - fondoAnticipo);
      report.saldoReintegrarClp = Math.max(0, fondoAnticipo - totalRendido);
      report.updatedAt = new Date().toISOString();
    }

    this.scheduleFlush();
  }

  public deleteExpenseItem(itemId: string): boolean {
    if (!this.store.expenseItems) return false;
    const idx = this.store.expenseItems.findIndex((i) => i.id === itemId);
    if (idx === -1) return false;

    const item = this.store.expenseItems[idx];
    const reportId = item.expenseReportId;
    this.store.expenseItems.splice(idx, 1);

    const report = (this.store.expenseReports || []).find((r) => r.id === reportId);
    if (report) {
      const itemsOfReport = this.store.expenseItems.filter((i) => i.expenseReportId === reportId);
      const totalRendido = itemsOfReport.reduce((acc, it) => acc + Number(it.montoTotalClp || 0), 0);
      const fondoAnticipo = Number(report.fondoAsignadoClp || 0);
      report.montoTotalRendidoClp = totalRendido;
      report.saldoReembolsarClp = Math.max(0, totalRendido - fondoAnticipo);
      report.saldoReintegrarClp = Math.max(0, fondoAnticipo - totalRendido);
      report.updatedAt = new Date().toISOString();
    }

    this.scheduleFlush();
    return true;
  }

  public getExpenseProjects(empresaId?: string): any[] {
    let result = this.store.expenseProjects || [];
    if (empresaId) {
      const norm = empresaId.replace(/[\.\-\s]/g, '').toUpperCase();
      result = result.filter((p) => {
        const pNorm = (p.empresaId || '').replace(/[\.\-\s]/g, '').toUpperCase();
        return (
          p.empresaId === empresaId ||
          pNorm === norm
        );
      });
    }
    return result;
  }

  public createExpenseProject(project: any) {
    if (!this.store.expenseProjects) this.store.expenseProjects = [];
    const idx = this.store.expenseProjects.findIndex(
      (p) => p.id === project.id || (p.codigo === project.codigo && p.empresaId === project.empresaId)
    );
    if (idx >= 0) {
      this.store.expenseProjects[idx] = { ...this.store.expenseProjects[idx], ...project };
    } else {
      this.store.expenseProjects.push({
        ...project,
        createdAt: project.createdAt || new Date().toISOString(),
      });
    }
    this.scheduleFlush();
    return project;
  }

  public updateExpenseProject(id: string, updates: any): any | null {
    if (!this.store.expenseProjects) this.store.expenseProjects = [];
    const idx = this.store.expenseProjects.findIndex((p) => p.id === id || p.codigo === id);
    if (idx >= 0) {
      this.store.expenseProjects[idx] = { ...this.store.expenseProjects[idx], ...updates, updatedAt: new Date().toISOString() };
      this.scheduleFlush();
      return this.store.expenseProjects[idx];
    }
    return null;
  }

  public deleteExpenseProject(id: string): boolean {
    if (!this.store.expenseProjects) return false;
    const initialLen = this.store.expenseProjects.length;
    this.store.expenseProjects = this.store.expenseProjects.filter((p) => p.id !== id && p.codigo !== id);
    if (this.store.expenseProjects.length < initialLen) {
      this.scheduleFlush();
      return true;
    }
    return false;
  }

  public getCompanyChart(empresaId: string): any[] | null {
    if (!this.store.chartsOfAccounts) this.store.chartsOfAccounts = {};
    return this.store.chartsOfAccounts[empresaId] || null;
  }

  public saveCompanyChart(empresaId: string, chart: any[]): void {
    if (!this.store.chartsOfAccounts) this.store.chartsOfAccounts = {};
    this.store.chartsOfAccounts[empresaId] = chart;
    this.scheduleFlush();
  }

  public updateCompanyAccount(empresaId: string, account: any): void {
    if (!this.store.chartsOfAccounts) this.store.chartsOfAccounts = {};
    const chart = this.store.chartsOfAccounts[empresaId] ? [...this.store.chartsOfAccounts[empresaId]] : [];
    const idx = chart.findIndex((a: any) => a.codigo === account.codigo);
    if (idx >= 0) {
      chart[idx] = { ...chart[idx], ...account };
    } else {
      chart.push(account);
    }
    this.store.chartsOfAccounts[empresaId] = chart;
    this.scheduleFlush();
  }

  // ============================================================================
  // AUXILIARES Y PADRÓN DE CLIENTES/PROVEEDORES (MULTI-TENANT & MULTI-USUARIO)
  // ============================================================================
  public getCompanyAuxiliaries(empresaId: string): any[] | null {
    if (!this.store.auxiliaries) this.store.auxiliaries = {};
    return this.store.auxiliaries[empresaId] || null;
  }

  public saveCompanyAuxiliaries(empresaId: string, auxiliaries: any[]): void {
    if (!this.store.auxiliaries) this.store.auxiliaries = {};
    this.store.auxiliaries[empresaId] = auxiliaries;
    this.scheduleFlush();

    // Sincronizar asíncronamente con MySQL si está conectado
    if (isRealMysqlConnected) {
      (async () => {
        try {
          const db = mysqlDb;
          const { clientAuxiliariesMaster } = await import('../db/mysqlSchema');
          for (const aux of auxiliaries) {
            const rawRut = (aux.rut || aux.rutCompleto || '').trim();
            if (!rawRut) continue;
            const auxId = aux.id || `aux-${empresaId}-${rawRut}`.replace(/[^a-zA-Z0-9_-]/g, '_');
            const cleanTipo = String(aux.tipo || aux.tipoAuxiliar || 'CLIENTE').toUpperCase();
            const tipoValid = cleanTipo === 'PROVEEDOR' ? 'PROVEEDOR' : cleanTipo === 'CLIENTE' ? 'CLIENTE' : cleanTipo === 'HONORARIOS' || cleanTipo === 'HONORARIO' ? 'HONORARIOS' : 'AMBOS';

            await db.insert(clientAuxiliariesMaster).values({
              id: auxId,
              empresaId,
              rutCompleto: rawRut,
              codigoAuxiliar: aux.codigoAuxiliar || rawRut.replace(/[^0-9Kk]/g, ''),
              razonSocial: aux.razonSocial || rawRut,
              nombreFantasia: aux.nombreFantasia || null,
              giroComercial: aux.giroComercial || 'Giro General',
              inactivo: Boolean(aux.inactivo),
              telefonoPrincipal: aux.telefonoPrincipal || null,
              emailContacto: aux.emailContacto || null,
              nombreContacto: aux.nombreContacto || null,
              emailDte: aux.emailDte || aux.emailContacto || 'dte@empresa.cl',
              direccion: aux.direccion || 'Dirección Comercial',
              region: aux.region || 'Metropolitana',
              ciudad: aux.ciudad || 'Santiago',
              comuna: aux.comuna || 'Santiago',
              tipoAuxiliar: tipoValid,
              limiteCredito: String(Number(aux.limiteCredito) || 0),
              terminosPago: aux.terminosPago || '30 días factura',
              vendedor: aux.vendedor || null,
              descuentoPorcentaje: String(Number(aux.descuentoPorcentaje) || 0),
              sucursales: aux.sucursales ? (typeof aux.sucursales === 'string' ? JSON.parse(aux.sucursales) : aux.sucursales) : null,
            }).onDuplicateKeyUpdate({
              set: {
                razonSocial: aux.razonSocial || rawRut,
                nombreFantasia: aux.nombreFantasia || null,
                giroComercial: aux.giroComercial || 'Giro General',
                inactivo: Boolean(aux.inactivo),
                telefonoPrincipal: aux.telefonoPrincipal || null,
                emailContacto: aux.emailContacto || null,
                nombreContacto: aux.nombreContacto || null,
                emailDte: aux.emailDte || aux.emailContacto || 'dte@empresa.cl',
                direccion: aux.direccion || 'Dirección Comercial',
                region: aux.region || 'Metropolitana',
                ciudad: aux.ciudad || 'Santiago',
                comuna: aux.comuna || 'Santiago',
                tipoAuxiliar: tipoValid,
                limiteCredito: String(Number(aux.limiteCredito) || 0),
                terminosPago: aux.terminosPago || '30 días factura',
                vendedor: aux.vendedor || null,
                descuentoPorcentaje: String(Number(aux.descuentoPorcentaje) || 0),
                sucursales: aux.sucursales ? (typeof aux.sucursales === 'string' ? JSON.parse(aux.sucursales) : aux.sucursales) : null,
              }
            });
          }
        } catch (err: any) {
          console.warn('[DiskPersistence] Error al sincronizar auxiliares en MySQL:', err.message);
        }
      })();
    }
  }

  public addOrUpdateCompanyAuxiliary(empresaId: string, aux: any): any[] {
    if (!this.store.auxiliaries) this.store.auxiliaries = {};
    const list = this.store.auxiliaries[empresaId] ? [...this.store.auxiliaries[empresaId]] : [];
    const cleanRut = (aux.rut || aux.rutCompleto || '').replace(/[\.\-\s]/g, '').toUpperCase();
    const idx = list.findIndex((a: any) => (a.rut || a.rutCompleto || '').replace(/[\.\-\s]/g, '').toUpperCase() === cleanRut);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...aux };
    } else {
      list.unshift(aux);
    }
    this.store.auxiliaries[empresaId] = list;
    this.scheduleFlush();
    this.saveCompanyAuxiliaries(empresaId, list);
    return list;
  }

  // ============================================================================
  // GRUPOS Y SUBGRUPOS DEL PLAN DE CUENTAS
  // ============================================================================
  public getCompanyGroups(empresaId: string): any[] | null {
    if (!this.store.groups) this.store.groups = {};
    return this.store.groups[empresaId] || null;
  }

  public saveCompanyGroups(empresaId: string, groups: any[]): void {
    if (!this.store.groups) this.store.groups = {};
    this.store.groups[empresaId] = groups;
    this.scheduleFlush();
  }

  // ============================================================================
  // NOTAS EXPLICATIVAS IFRS A LOS ESTADOS FINANCIEROS
  // ============================================================================
  public getCompanyFinancialNotes(empresaId: string): any[] | null {
    if (!this.store.financialNotes) this.store.financialNotes = {};
    return this.store.financialNotes[empresaId] || null;
  }

  public saveCompanyFinancialNotes(empresaId: string, notes: any[]): void {
    if (!this.store.financialNotes) this.store.financialNotes = {};
    this.store.financialNotes[empresaId] = notes;
    this.scheduleFlush();
  }

  // ============================================================================
  // ESTADOS DE CLIENTES Y PARÁMETROS GENÉRICOS (MULTI-TENANT & MULTI-USUARIO)
  // ============================================================================
  public getClientState(empresaId: string, key: string): any | null {
    if (!this.store.clientStates) this.store.clientStates = {};
    const tenantKey = `${empresaId}__${key}`;
    return this.store.clientStates[tenantKey] !== undefined ? this.store.clientStates[tenantKey] : null;
  }

  public saveClientState(empresaId: string, key: string, data: any): void {
    if (!this.store.clientStates) this.store.clientStates = {};
    const tenantKey = `${empresaId}__${key}`;
    this.store.clientStates[tenantKey] = data;
    this.scheduleFlush();
  }

  // ============================================================================
  // GESTIÓN COMERCIAL, APROVISIONAMIENTO Y SOLICITUDES DE COTIZACIÓN (RFQ)
  // ============================================================================
  public getRfqRequests(empresaId?: string): any[] {
    if (!this.store.rfqRequests) this.store.rfqRequests = [];
    if (empresaId) {
      return this.store.rfqRequests.filter((r: any) => r.empresaId === empresaId);
    }
    return this.store.rfqRequests;
  }

  public saveRfqRequest(rfq: any): void {
    if (!this.store.rfqRequests) this.store.rfqRequests = [];
    const idx = this.store.rfqRequests.findIndex((r: any) => r.id === rfq.id);
    if (idx >= 0) {
      this.store.rfqRequests[idx] = { ...this.store.rfqRequests[idx], ...rfq };
    } else {
      this.store.rfqRequests.unshift(rfq);
    }
    this.scheduleFlush();

    if (isRealMysqlConnected) {
      (async () => {
        try {
          await mysqlDb
            .insert(dbRfqRequests)
            .values({
              id: rfq.id,
              empresaId: rfq.empresaId,
              folioRfq: rfq.folioRfq,
              titulo: rfq.titulo,
              fechaEmision: rfq.fechaEmision,
              fechaLimiteRespuesta: rfq.fechaLimiteRespuesta,
              diasPlazoRespuesta: rfq.diasPlazoRespuesta || 3,
              estado: rfq.estado || 'ENVIADA',
              itemsJson: rfq.itemsJson || rfq.items,
              proveedorGanadorRut: rfq.proveedorGanadorRut || null,
              proveedorGanadorNombre: rfq.proveedorGanadorNombre || null,
              ordenCompraGeneradaId: rfq.ordenCompraGeneradaId || null,
              folioOrdenCompra: rfq.folioOrdenCompra || null,
              motivoAdjudicacion: rfq.motivoAdjudicacion || null,
              recomendacionAgenteSr: rfq.recomendacionAgenteSr || null,
              createdAt: new Date(rfq.createdAt || Date.now()),
            })
            .onDuplicateKeyUpdate({
              set: {
                estado: rfq.estado,
                proveedorGanadorRut: rfq.proveedorGanadorRut || null,
                proveedorGanadorNombre: rfq.proveedorGanadorNombre || null,
                ordenCompraGeneradaId: rfq.ordenCompraGeneradaId || null,
                folioOrdenCompra: rfq.folioOrdenCompra || null,
                motivoAdjudicacion: rfq.motivoAdjudicacion || null,
                recomendacionAgenteSr: rfq.recomendacionAgenteSr || null,
              },
            });
        } catch (e: any) {
          console.warn(`[DiskPersistence] Error al sincronizar RFQ a MySQL: ${e.message}`);
        }
      })();
    }
  }

  public getRfqSupplierResponses(rfqId?: string): any[] {
    if (!this.store.rfqSupplierResponses) this.store.rfqSupplierResponses = [];
    if (rfqId) {
      return this.store.rfqSupplierResponses.filter((r: any) => r.rfqId === rfqId);
    }
    return this.store.rfqSupplierResponses;
  }

  public saveRfqSupplierResponse(resp: any): void {
    if (!this.store.rfqSupplierResponses) this.store.rfqSupplierResponses = [];
    const idx = this.store.rfqSupplierResponses.findIndex((r: any) => r.id === resp.id);
    if (idx >= 0) {
      this.store.rfqSupplierResponses[idx] = { ...this.store.rfqSupplierResponses[idx], ...resp };
    } else {
      this.store.rfqSupplierResponses.unshift(resp);
    }
    this.scheduleFlush();

    if (isRealMysqlConnected) {
      (async () => {
        try {
          await mysqlDb
            .insert(dbRfqSupplierResponses)
            .values({
              id: resp.id,
              rfqId: resp.rfqId,
              empresaId: resp.empresaId,
              proveedorRut: resp.proveedorRut,
              proveedorRazonSocial: resp.proveedorRazonSocial,
              emailContacto: resp.emailContacto,
              telefonoContacto: resp.telefonoContacto || null,
              estadoSeguimiento: resp.estadoSeguimiento || 'ENVIADA',
              fechaEnvio: new Date(resp.fechaEnvio || Date.now()),
              fechaLectura: resp.fechaLectura ? new Date(resp.fechaLectura) : null,
              fechaRespuesta: resp.fechaRespuesta ? new Date(resp.fechaRespuesta) : null,
              cantidadReiteraciones: resp.cantidadReiteraciones || 0,
              ultimoRecordatorioAt: resp.ultimoRecordatorioAt ? new Date(resp.ultimoRecordatorioAt) : null,
              montoNetoOfertado: resp.montoNetoOfertado != null ? String(resp.montoNetoOfertado) : null,
              plazoEntregaDiasOfertado: resp.plazoEntregaDiasOfertado || null,
              condicionPagoOfertada: resp.condicionPagoOfertada || null,
              costoFleteClp: resp.costoFleteClp != null ? String(resp.costoFleteClp) : '0.00',
              scoringPonderadoTotal: resp.scoringPonderadoTotal != null ? String(resp.scoringPonderadoTotal) : null,
              itemsCotizadosJson: resp.itemsCotizadosJson || resp.itemsCotizados || null,
              observacionesProveedor: resp.observacionesProveedor || null,
              esOfertaGanadora: Boolean(resp.esOfertaGanadora),
              createdAt: new Date(resp.createdAt || Date.now()),
            })
            .onDuplicateKeyUpdate({
              set: {
                estadoSeguimiento: resp.estadoSeguimiento,
                cantidadReiteraciones: resp.cantidadReiteraciones,
                ultimoRecordatorioAt: resp.ultimoRecordatorioAt ? new Date(resp.ultimoRecordatorioAt) : null,
                montoNetoOfertado: resp.montoNetoOfertado != null ? String(resp.montoNetoOfertado) : null,
                plazoEntregaDiasOfertado: resp.plazoEntregaDiasOfertado || null,
                condicionPagoOfertada: resp.condicionPagoOfertada || null,
                costoFleteClp: resp.costoFleteClp != null ? String(resp.costoFleteClp) : '0.00',
                scoringPonderadoTotal: resp.scoringPonderadoTotal != null ? String(resp.scoringPonderadoTotal) : null,
                itemsCotizadosJson: resp.itemsCotizadosJson || resp.itemsCotizados || null,
                observacionesProveedor: resp.observacionesProveedor || null,
                esOfertaGanadora: Boolean(resp.esOfertaGanadora),
              },
            });
        } catch (e: any) {
          console.warn(`[DiskPersistence] Error al sincronizar RFQ Supplier Response a MySQL: ${e.message}`);
        }
      })();
    }
  }

  public getPurchaseOrders(empresaId?: string): any[] {
    if (!this.store.purchaseOrders) this.store.purchaseOrders = [];
    if (empresaId) {
      return this.store.purchaseOrders.filter((o: any) => o.empresaId === empresaId);
    }
    return this.store.purchaseOrders;
  }

  public savePurchaseOrder(po: any): void {
    if (!this.store.purchaseOrders) this.store.purchaseOrders = [];
    const idx = this.store.purchaseOrders.findIndex((o: any) => o.id === po.id);
    if (idx >= 0) {
      this.store.purchaseOrders[idx] = { ...this.store.purchaseOrders[idx], ...po };
    } else {
      this.store.purchaseOrders.unshift(po);
    }
    this.scheduleFlush();

    if (isRealMysqlConnected) {
      (async () => {
        try {
          await mysqlDb
            .insert(dbPurchaseOrders)
            .values({
              id: po.id,
              empresaId: po.empresaId,
              folioOc: po.folioOc || po.folio,
              rfqOrigenId: po.rfqOrigenId || null,
              proveedorRut: po.proveedorRut,
              proveedorRazonSocial: po.proveedorRazonSocial,
              fechaEmision: po.fechaEmision,
              fechaEntregaPactada: po.fechaEntregaPactada || po.fechaEmision,
              condicionPago: po.condicionPago || 'Crédito 30 días',
              itemsJson: po.itemsJson || po.items,
              montoNeto: String(po.montoNeto || po.totalNetoCLP || '0.00'),
              montoIva: String(po.montoIva || po.iva19CLP || '0.00'),
              montoTotal: String(po.montoTotal || po.totalBrutoCLP || '0.00'),
              estado: po.estado || 'EMITIDA',
              aprobadoPorAgente: po.aprobadoPorAgente ?? true,
              firmaAgente: po.firmaAgente || 'Esteban Morales (Gerente Comercial & Aprovisionamiento Sr.)',
              motivoGeneracion: po.motivoGeneracion || null,
              asientoContableRefId: po.asientoContableRefId || null,
              createdAt: new Date(po.createdAt || Date.now()),
            })
            .onDuplicateKeyUpdate({
              set: {
                estado: po.estado,
                montoTotal: String(po.montoTotal || po.totalBrutoCLP || '0.00'),
              },
            });
        } catch (e: any) {
          console.warn(`[DiskPersistence] Error al sincronizar Purchase Order a MySQL: ${e.message}`);
        }
      })();
    }
  }

  public getCommercialQuotes(empresaId?: string): any[] {
    if (!this.store.commercialQuotes) this.store.commercialQuotes = [];
    if (empresaId) {
      return this.store.commercialQuotes.filter((q: any) => q.empresaId === empresaId);
    }
    return this.store.commercialQuotes;
  }

  public saveCommercialQuote(quote: any): void {
    if (!this.store.commercialQuotes) this.store.commercialQuotes = [];
    const idx = this.store.commercialQuotes.findIndex((q: any) => q.id === quote.id);
    if (idx >= 0) {
      this.store.commercialQuotes[idx] = { ...this.store.commercialQuotes[idx], ...quote };
    } else {
      this.store.commercialQuotes.unshift(quote);
    }
    this.scheduleFlush();

    if (isRealMysqlConnected) {
      (async () => {
        try {
          await mysqlDb
            .insert(dbCommercialQuotes)
            .values({
              id: quote.id,
              empresaId: quote.empresaId,
              folioCotizacion: quote.folioCotizacion || quote.folio,
              clienteRut: quote.clienteRut,
              clienteRazonSocial: quote.clienteRazonSocial,
              fechaEmision: quote.fechaEmision,
              fechaVencimiento: quote.fechaVencimiento || quote.fechaEmision,
              validezDias: quote.validezDias || 15,
              itemsJson: quote.itemsJson || quote.items,
              montoNeto: String(quote.montoNeto || quote.totalNetoCLP || '0.00'),
              montoIva: String(quote.montoIva || quote.iva19CLP || '0.00'),
              montoTotal: String(quote.montoTotal || quote.totalBrutoCLP || '0.00'),
              margenBrutoPromedioPorcentaje: String(quote.margenBrutoPromedioPorcentaje || quote.margenBrutoTotalPorcentaje || '0.00'),
              estado: quote.estado || 'ENVIADA',
              stockValidado: quote.stockValidado ?? true,
              createdAt: new Date(quote.createdAt || Date.now()),
            })
            .onDuplicateKeyUpdate({
              set: {
                estado: quote.estado,
                montoTotal: String(quote.montoTotal || quote.totalBrutoCLP || '0.00'),
              },
            });
        } catch (e: any) {
          console.warn(`[DiskPersistence] Error al sincronizar Commercial Quote a MySQL: ${e.message}`);
        }
      })();
    }
  }

  public initExpenseSeeds() {
    this.store.expenseProjects = [
      {
        id: 'pry-01',
        empresaId: 'client-retail-01',
        codigo: 'PRY-QUELLON-26',
        nombre: 'Mantención Mayor Redes y Jaulas Balsas Quellón',
        clienteNombre: 'Salmones Antártica S.A.',
        presupuestoTotalClp: 45000000,
        activo: true,
        descripcion: 'Servicio integral de instalación de fondeos y redes loberas.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'pry-02',
        empresaId: 'client-retail-01',
        codigo: 'PRY-STGO-EXP',
        nombre: 'Expansión Comercial & Distribución Retail Santiago',
        clienteNombre: 'Cencosud / Walmart Chile',
        presupuestoTotalClp: 25000000,
        activo: true,
        descripcion: 'Apertura de nuevos canales de congelados y mariscos en cadenas de supermercados.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'pry-03',
        empresaId: 'client-retail-01',
        codigo: 'PRY-LOG-FLOTA',
        nombre: 'Habilitación Barcazas y Motores Fuera de Borda',
        clienteNombre: 'Interno Flota Austral',
        presupuestoTotalClp: 18000000,
        activo: true,
        descripcion: 'Overhaul mecánico preventivo de barcazas Don Víctor y Mar Austral II.',
        createdAt: new Date().toISOString(),
      },
    ];

    this.store.expenseReports = [
      {
        id: 'rdg-001',
        empresaId: 'client-retail-01',
        folio: 'RDG-2026-001',
        titulo: 'Visita Técnica Clientes Salmoaustral y Supervisión Centro Dalcahue',
        rendidorId: 'emp-001',
        rendidorNombre: 'Gonzalo Silva Valenzuela',
        rendidorRut: '14.238.192-8',
        rendidorEmail: 'gonzalo.silva@maraustral.cl',
        rendidorCargo: 'Supervisor Comercial & Operaciones',
        centroCostoId: 'cc-02',
        centroCostoCodigo: 'CC-VTA-STGO',
        centroCostoNombre: 'Ventas & Distribución Zona Central',
        proyectoId: 'pry-01',
        proyectoCodigo: 'PRY-QUELLON-26',
        proyectoNombre: 'Mantención Mayor Redes y Jaulas Balsas Quellón',
        fondoAsignadoClp: 150000,
        montoTotalRendidoClp: 184500,
        saldoReembolsarClp: 34500,
        saldoReintegrarClp: 0,
        moneda: 'CLP',
        estado: 'PENDIENTE_APROBACION',
        fechaInicio: '2026-09-24',
        fechaCierre: '2026-09-28',
        fechaAprobacion: null,
        aprobadorNombre: 'Carla Morales Troncoso',
        agenteAuditorScore: 95,
        agenteAuditorDiagnostico: {
          calificacion: 'APROBADO_LIMPIO',
          scoreGlobal: 95,
          totalComprobantesValidos: 4,
          totalComprobantesObjetados: 0,
          montoIvaCreditoRecuperable: 16150,
          montoGastoRechazadoArt21: 0,
          alertas: [],
          recomendaciones: ['Gasto de combustible rendido con boleta. Se sugiere solicitar Factura para recuperar IVA Crédito.'],
          verificacionRutDuplicados: true,
          resumenTributario: 'Comprobantes íntegros con respaldo fidedigno Art. 31 LIR. Saldo a reembolsar: $34.500 CLP.',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'rdg-002',
        empresaId: 'client-retail-01',
        folio: 'RDG-2026-002',
        titulo: 'Adquisición de Insumos y Repuestos Urgentes Maestranza Quellón',
        rendidorId: 'emp-002',
        rendidorNombre: 'Ing. Rodrigo Cárdenas Soto',
        rendidorRut: '13.914.882-K',
        rendidorEmail: 'rodrigo.cardenas@maraustral.cl',
        rendidorCargo: 'Jefe de Planta Quellón',
        centroCostoId: 'cc-03',
        centroCostoCodigo: 'CC-PRD-QUELLON',
        centroCostoNombre: 'Planta Fabril & Maestranza Quellón',
        proyectoId: 'pry-01',
        proyectoCodigo: 'PRY-QUELLON-26',
        proyectoNombre: 'Mantención Mayor Redes y Jaulas Balsas Quellón',
        fondoAsignadoClp: 200000,
        montoTotalRendidoClp: 165000,
        saldoReembolsarClp: 0,
        saldoReintegrarClp: 35000,
        moneda: 'CLP',
        estado: 'APROBADA',
        fechaInicio: '2026-09-15',
        fechaCierre: '2026-09-18',
        fechaAprobacion: '2026-09-20',
        aprobadorNombre: 'Carla Morales Troncoso',
        agenteAuditorScore: 100,
        agenteAuditorDiagnostico: {
          calificacion: 'APROBADO_LIMPIO',
          scoreGlobal: 100,
          totalComprobantesValidos: 2,
          totalComprobantesObjetados: 0,
          montoIvaCreditoRecuperable: 26345,
          montoGastoRechazadoArt21: 0,
          alertas: [],
          recomendaciones: [],
          verificacionRutDuplicados: true,
          resumenTributario: 'Aprobado por jefatura. El colaborador debe reintegrar $35.000 a la cuenta corriente de la empresa.',
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    this.store.expenseItems = [
      {
        id: 'item-01',
        expenseReportId: 'rdg-001',
        empresaId: 'client-retail-01',
        fecha: '2026-09-25',
        tipoDocumento: 'BOLETA_ELECTRONICA',
        folioDocumento: 'B-481920',
        proveedorRut: '99.520.000-7',
        proveedorRazonSocial: 'Compañía de Petróleos de Chile COPEC S.A.',
        categoria: 'COMBUSTIBLE',
        descripcionGlosa: 'Carga de Diesel camioneta terreno traslado Chiloé',
        montoNeto: 37815,
        montoIva: 7185,
        montoExento: 0,
        montoTotalClp: 45000,
        monedaOriginal: 'CLP',
        tipoCambio: 1,
        centroCostoId: 'cc-02',
        centroCostoCodigo: 'CC-VTA-STGO',
        proyectoId: 'pry-01',
        proyectoCodigo: 'PRY-QUELLON-26',
        cuentaContableCodigo: '4.2.01.009',
        cuentaContableNombre: 'Combustibles & Lubricantes',
        esGastoRechazadoArt21: false,
        validadoPorAgente: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'item-02',
        expenseReportId: 'rdg-001',
        empresaId: 'client-retail-01',
        fecha: '2026-09-26',
        tipoDocumento: 'FACTURA_ELECTRONICA_33',
        folioDocumento: '91283',
        proveedorRut: '76.128.490-2',
        proveedorRazonSocial: 'Hotelera & Turismo del Sur SpA (Hotel Castro)',
        categoria: 'ALOJAMIENTO',
        descripcionGlosa: 'Hospedaje 2 noches personal técnico en terreno',
        montoNeto: 85000,
        montoIva: 16150,
        montoExento: 0,
        montoTotalClp: 101150,
        monedaOriginal: 'CLP',
        tipoCambio: 1,
        centroCostoId: 'cc-02',
        centroCostoCodigo: 'CC-VTA-STGO',
        proyectoId: 'pry-01',
        proyectoCodigo: 'PRY-QUELLON-26',
        cuentaContableCodigo: '4.2.01.007',
        cuentaContableNombre: 'Alojamiento & Estadía Terreno',
        esGastoRechazadoArt21: false,
        validadoPorAgente: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'item-03',
        expenseReportId: 'rdg-001',
        empresaId: 'client-retail-01',
        fecha: '2026-09-26',
        tipoDocumento: 'BOLETA_ELECTRONICA',
        folioDocumento: 'B-12839',
        proveedorRut: '77.819.200-5',
        proveedorRazonSocial: 'Restaurante Rincón Chilote Castro',
        categoria: 'ALIMENTACION',
        descripcionGlosa: 'Cena y almuerzo en terreno durante supervisión',
        montoNeto: 23824,
        montoIva: 4526,
        montoExento: 0,
        montoTotalClp: 28350,
        monedaOriginal: 'CLP',
        tipoCambio: 1,
        centroCostoId: 'cc-02',
        centroCostoCodigo: 'CC-VTA-STGO',
        proyectoId: 'pry-01',
        proyectoCodigo: 'PRY-QUELLON-26',
        cuentaContableCodigo: '4.2.01.006',
        cuentaContableNombre: 'Gastos de Alimentación & Viáticos',
        esGastoRechazadoArt21: false,
        validadoPorAgente: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'item-04',
        expenseReportId: 'rdg-001',
        empresaId: 'client-retail-01',
        fecha: '2026-09-27',
        tipoDocumento: 'TICKET_PEAJE',
        folioDocumento: 'TAG-98124',
        proveedorRut: '96.812.390-1',
        proveedorRazonSocial: 'Sociedad Concesionaria Ruta del Canal S.A.',
        categoria: 'PEAJES_ESTACIONAMIENTOS',
        descripcionGlosa: 'Peajes y transbordo canal de Chacao ida y vuelta',
        montoNeto: 0,
        montoIva: 0,
        montoExento: 10000,
        montoTotalClp: 10000,
        monedaOriginal: 'CLP',
        tipoCambio: 1,
        centroCostoId: 'cc-02',
        centroCostoCodigo: 'CC-VTA-STGO',
        proyectoId: 'pry-01',
        proyectoCodigo: 'PRY-QUELLON-26',
        cuentaContableCodigo: '4.2.01.010',
        cuentaContableNombre: 'Peajes & Tag Autopistas',
        esGastoRechazadoArt21: false,
        validadoPorAgente: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'item-05',
        expenseReportId: 'rdg-002',
        empresaId: 'client-retail-01',
        fecha: '2026-09-16',
        tipoDocumento: 'FACTURA_ELECTRONICA_33',
        folioDocumento: 'F-78192',
        proveedorRut: '76.992.110-3',
        proveedorRazonSocial: 'Ferretería Industrial Austral Ltda.',
        categoria: 'MATERIALES_INSUMOS',
        descripcionGlosa: 'Pernos de acero inox 316 y electrodos para balsas',
        montoNeto: 138655,
        montoIva: 26345,
        montoExento: 0,
        montoTotalClp: 165000,
        monedaOriginal: 'CLP',
        tipoCambio: 1,
        centroCostoId: 'cc-03',
        centroCostoCodigo: 'CC-PRD-QUELLON',
        proyectoId: 'pry-01',
        proyectoCodigo: 'PRY-QUELLON-26',
        cuentaContableCodigo: '4.1.02.001',
        cuentaContableNombre: 'Materiales Menores & Consumibles',
        esGastoRechazadoArt21: false,
        validadoPorAgente: true,
        createdAt: new Date().toISOString(),
      },
    ];
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
      { codigo: 'UF', valor: '40885.6300', fecha: '2026-09-09', fuente: 'valor_referencial_inicial' },
      { codigo: 'USD', valor: '928.1000', fecha: '2026-09-09', fuente: 'valor_referencial_inicial' },
      { codigo: 'UTM', valor: '71721.0000', fecha: '2026-09-09', fuente: 'valor_referencial_inicial' },
      { codigo: 'IPC', valor: '0.6000', fecha: '2026-09-09', fuente: 'valor_referencial_inicial' },
    ];

    // Centros de costo y activos fijos de la empresa de ejemplo: solo con DEMO_MODE=true
    if (isDemoModeEnabled() && (!this.store.costCenters || this.store.costCenters.length === 0)) {
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

    // Activos Fijos de ejemplo con Centro de Costo imputado (solo DEMO_MODE)
    if (isDemoModeEnabled() && (!this.store.fixedAssets || this.store.fixedAssets.length === 0)) {
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

  // ============================================================================
  // GOBERNANZA AGÉNTICA: APROBACIONES HUMAN-IN-THE-LOOP (PERSISTENCIA TOTAL)
  // ============================================================================
  public getApprovals(empresaId?: string, modulo?: string): any[] {
    let list = this.store.governanceApprovals || [];
    if (empresaId) {
      const cleanTarget = empresaId.replace(/[^0-9kK]/g, '').toUpperCase();
      list = list.filter(a => {
        const cleanEmp = (a.empresaId || '').replace(/[^0-9kK]/g, '').toUpperCase();
        return cleanEmp === cleanTarget || a.empresaId === empresaId;
      });
    }
    if (modulo) {
      list = list.filter(a => a.modulo === modulo);
    }
    return list;
  }

  public getGovernanceApprovals(empresaId?: string, modulo?: string): any[] {
    return this.getApprovals(empresaId, modulo);
  }

  public getApprovalById(id: string): any | null {
    const list = this.store.governanceApprovals || [];
    return list.find(a => a.id === id) || null;
  }

  public saveApproval(approval: any): void {
    if (!this.store.governanceApprovals) this.store.governanceApprovals = [];
    const idx = this.store.governanceApprovals.findIndex(a => a.id === approval.id);
    if (idx >= 0) {
      this.store.governanceApprovals[idx] = { ...this.store.governanceApprovals[idx], ...approval };
    } else {
      this.store.governanceApprovals.unshift(approval);
    }
    this.flushToDiskSync();

    // Sincronizar asíncronamente con MySQL si está conectado
    if (isRealMysqlConnected) {
      (async () => {
        try {
          const db = mysqlDb;
          const { moduleAgentApprovals } = await import('../db/schema/hrManagementSchema');
          await db.insert(moduleAgentApprovals).values({
            id: approval.id,
            empresaId: approval.empresaId,
            modulo: approval.modulo as any,
            agenteNombre: approval.agenteNombre || 'Agente Especialista',
            operacionTipo: approval.operacionTipo || 'OPERACION_AUTONOMA',
            titulo: approval.titulo || 'Solicitud de Aprobación Agéntica',
            descripcion: approval.descripcion || '',
            datosOperacion: approval.datosOperacion || {},
            impactoFinancieroClp: String(approval.impactoFinancieroClp || approval.impactoFinanciero || 0),
            nivelRiesgo: (approval.nivelRiesgo || approval.riesgoNivel || 'MEDIO') as any,
            estado: approval.estado as any,
            solicitadoEn: approval.solicitadoEn ? new Date(approval.solicitadoEn) : new Date(),
            resueltoPor: approval.resueltoPor || null,
            resueltoEn: approval.resueltoEn ? new Date(approval.resueltoEn) : null,
            resultadoEjecucion: approval.resultadoEjecucion || null,
          }).onDuplicateKeyUpdate({
            set: {
              estado: approval.estado as any,
              resueltoPor: approval.resueltoPor || null,
              resueltoEn: approval.resueltoEn ? new Date(approval.resueltoEn) : null,
              resultadoEjecucion: approval.resultadoEjecucion || null,
            }
          });
        } catch (err: any) {
          console.warn('[DiskPersistence] Error al sincronizar approval en MySQL:', err?.message);
        }
      })();
    }
  }

  public getClient(empresaId: string): any | null {
    const clean = (empresaId || '').replace(/[^0-9kK]/g, '').toUpperCase();
    return (this.store.clients || []).find((c: any) => {
      const cRut = (c.rut || c.id || '').replace(/[^0-9kK]/g, '').toUpperCase();
      return cRut === clean || c.id === empresaId;
    }) || null;
  }
}

export const diskPersistence = new DiskPersistenceService();
(globalThis as any).__diskPersistence = diskPersistence;
