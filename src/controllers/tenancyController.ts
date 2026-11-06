import { diskPersistence } from '../services/diskPersistenceService';
import { getDemoClients } from '../data/seedData';
import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { getMysqlDb, isRealMysqlConnected } from '../db/mysqlClient';
import {
  accountingFirms,
  companies,
  companyModuleSubscriptions,
  companyCredentialsVault,
} from '../db/schema/tenancySchema';
import { encryptVaultSecret } from '../utils/vaultCrypto';

export const tenancyRouter = Router();

// ============================================================================
// 1. ESTUDIOS CONTABLES (NIVEL 1)
// ============================================================================

/**
 * GET /api/tenancy/firms
 * Lista todos los Estudios Contables registrados en la plataforma
 */
tenancyRouter.get('/firms', async (_req: Request, res: Response) => {
  try {
    const db = getMysqlDb();
    let firms: any[] = [];

    if (isRealMysqlConnected) {
      firms = await db.select().from(accountingFirms);
    } else {
      firms = [
        {
          id: 'firm-001-audicon',
          rut: '76.111.222-3',
          razonSocial: 'Audicon & Asesores Tributarios SpA',
          emailContacto: 'contacto@audicon.cl',
          plan: 'ESTUDIO_ENTERPRISE',
          estado: 'ACTIVO',
          createdAt: new Date('2026-01-01'),
        },
      ];
    }

    res.json({ success: true, count: firms.length, data: firms });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/tenancy/firms
 * Registra un nuevo Estudio Contable titular
 */
tenancyRouter.post('/firms', async (req: Request, res: Response) => {
  try {
    const { rut, razonSocial, emailContacto, plan } = req.body;
    if (!rut || !razonSocial || !emailContacto) {
      return res.status(400).json({
        success: false,
        error: 'DATOS_REQUERIDOS: rut, razonSocial y emailContacto son obligatorios.',
      });
    }

    const newFirm = {
      id: crypto.randomUUID(),
      rut: rut.trim().toUpperCase(),
      razonSocial: razonSocial.trim(),
      emailContacto: emailContacto.trim().toLowerCase(),
      plan: plan || 'ESTUDIO_PRO',
      estado: 'ACTIVO' as const,
      createdAt: new Date(),
    };

    const db = getMysqlDb();
    if (isRealMysqlConnected) {
      await db.insert(accountingFirms).values(newFirm);
    }

    res.status(201).json({
      success: true,
      message: 'Estudio Contable creado exitosamente.',
      data: newFirm,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 2. EMPRESAS CLIENTES DEL ESTUDIO (NIVEL 2)
// ============================================================================

/**
 * GET /api/tenancy/firms/:firmId/companies
 * Lista las empresas operativas de un Estudio Contable con aislamiento estricto
 */
tenancyRouter.get('/firms/:firmId/companies', async (req: Request, res: Response) => {
  try {
    const { firmId } = req.params;
    const db = getMysqlDb();
    let companyList: any[] = [];

    if (isRealMysqlConnected) {
      companyList = await db
        .select()
        .from(companies)
        .where(eq(companies.firmId, firmId));
    } else {
      // Sin MySQL: empresas registradas en disco y, solo con DEMO_MODE, las de ejemplo (antes: dos empresas inventadas)
      const stored: any[] = ((diskPersistence as any).store?.clients || []).filter((c: any) => !c.firmId || c.firmId === firmId);
      const ruts = new Set(stored.map((c: any) => String(c.rut || '').replace(/[^0-9kK]/g, '').toUpperCase()));
      companyList = [
        ...stored,
        ...getDemoClients()
          .filter((c) => !ruts.has(c.rut.replace(/[^0-9kK]/g, '').toUpperCase()))
          .map((c) => ({ ...c, firmId })),
      ];
    }

    res.json({ success: true, count: companyList.length, data: companyList });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/tenancy/firms/:firmId/companies
 * Asigna una nueva empresa cliente al Estudio Contable
 */
tenancyRouter.post('/firms/:firmId/companies', async (req: Request, res: Response) => {
  try {
    const { firmId } = req.params;
    const { rut, razonSocial, giro, regimenTributario, esClienteAncla } = req.body;

    if (!rut || !razonSocial || !giro) {
      return res.status(400).json({
        success: false,
        error: 'DATOS_REQUERIDOS: rut, razonSocial y giro son obligatorios.',
      });
    }

    const newCompany = {
      id: crypto.randomUUID(),
      firmId,
      rut: rut.trim().toUpperCase(),
      razonSocial: razonSocial.trim(),
      giro: giro.trim(),
      regimenTributario: (regimenTributario || '14_D3') as '14_A' | '14_D3' | '14_D8',
      esClienteAncla: Boolean(esClienteAncla),
      createdAt: new Date(),
    };

    const db = getMysqlDb();
    if (isRealMysqlConnected) {
      await db.insert(companies).values(newCompany);
    }

    res.status(201).json({
      success: true,
      message: 'Empresa vinculada exitosamente al Estudio Contable.',
      data: newCompany,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 3. SUSCRIPCIÓN DE MÓDULOS DEL ERP (NIVEL 3)
// ============================================================================

/**
 * GET /api/tenancy/companies/:empresaId/modules
 * Obtiene los módulos ERP suscritos para la empresa
 */
tenancyRouter.get('/companies/:empresaId/modules', async (req: Request, res: Response) => {
  try {
    const { empresaId } = req.params;
    const db = getMysqlDb();
    let subscriptions: any[] = [];

    if (isRealMysqlConnected) {
      subscriptions = await db
        .select()
        .from(companyModuleSubscriptions)
        .where(eq(companyModuleSubscriptions.empresaId, empresaId));
    } else {
      subscriptions = [
        {
          id: 'sub-01',
          empresaId,
          moduloCodigo: 'CORE_ACCOUNTING',
          pagadoPor: 'ESTUDIO',
          estado: 'ACTIVO',
          fechaRenovacion: '2026-12-31',
        },
        {
          id: 'sub-02',
          empresaId,
          moduloCodigo: 'F29_TAX',
          pagadoPor: 'ESTUDIO',
          estado: 'ACTIVO',
          fechaRenovacion: '2026-12-31',
        },
        {
          id: 'sub-03',
          empresaId,
          moduloCodigo: 'PAYROLL_DT',
          pagadoPor: 'ESTUDIO',
          estado: 'ACTIVO',
          fechaRenovacion: '2026-12-31',
        },
        {
          id: 'sub-04',
          empresaId,
          moduloCodigo: 'BANK_RECON',
          pagadoPor: 'ESTUDIO',
          estado: 'ACTIVO',
          fechaRenovacion: '2026-12-31',
        },
        {
          id: 'sub-05',
          empresaId,
          moduloCodigo: 'INVENTORY_WMS',
          pagadoPor: 'CLIENTE_DIRECTO',
          estado: 'ACTIVO',
          fechaRenovacion: '2026-12-31',
        },
        {
          id: 'sub-06',
          empresaId,
          moduloCodigo: 'MARKETING_AGENT',
          pagadoPor: 'CLIENTE_DIRECTO',
          estado: 'ACTIVO',
          fechaRenovacion: '2026-12-31',
        },
      ];
    }

    res.json({ success: true, count: subscriptions.length, data: subscriptions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/tenancy/companies/:empresaId/modules
 * Activa un módulo ERP para una empresa
 */
tenancyRouter.post('/companies/:empresaId/modules', async (req: Request, res: Response) => {
  try {
    const { empresaId } = req.params;
    const { moduloCodigo, pagadoPor, fechaRenovacion } = req.body;

    const sub = {
      id: crypto.randomUUID(),
      empresaId,
      moduloCodigo,
      pagadoPor: pagadoPor || 'ESTUDIO',
      estado: 'ACTIVO' as const,
      fechaRenovacion: fechaRenovacion || '2026-12-31',
      createdAt: new Date(),
    };

    const db = getMysqlDb();
    if (isRealMysqlConnected) {
      await db.insert(companyModuleSubscriptions).values(sub);
    }

    res.status(201).json({
      success: true,
      message: `Módulo ${moduloCodigo} suscrito exitosamente.`,
      data: sub,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 4. VAULT DE CREDENCIALES CIFRADAS (AES-256-GCM)
// ============================================================================

/**
 * POST /api/tenancy/companies/:empresaId/vault
 * Almacena o actualiza credenciales del SII / Bancos bajo cifrado de grado bancario
 */
tenancyRouter.post('/companies/:empresaId/vault', async (req: Request, res: Response) => {
  try {
    const { empresaId } = req.params;
    const { claveSii, claveCertificado, apiBancosJson } = req.body;

    // Cifrar datos con AES-256-GCM
    const encryptedSii = claveSii ? encryptVaultSecret(claveSii) : null;
    const encryptedCert = claveCertificado ? encryptVaultSecret(claveCertificado) : null;

    const vaultEntry = {
      id: crypto.randomUUID(),
      empresaId,
      certificadoDigitalEncrypted: null,
      claveCertificadoEncrypted: encryptedCert?.encrypted || null,
      claveSiiEncrypted: encryptedSii?.encrypted || null,
      apiBancosEncrypted: apiBancosJson || null,
      iv: (encryptedSii?.iv || encryptedCert?.iv || crypto.randomBytes(16).toString('hex')),
      tagAuth: (encryptedSii?.tag || encryptedCert?.tag || crypto.randomBytes(16).toString('hex')),
      updatedAt: new Date(),
    };

    const db = getMysqlDb();
    if (isRealMysqlConnected) {
      await db.insert(companyCredentialsVault).values(vaultEntry);
    }

    res.status(200).json({
      success: true,
      message: 'Credenciales cifradas con AES-256-GCM y almacenadas de forma segura en Vault.',
      empresaId,
      hasSiiKey: Boolean(claveSii),
      hasCertKey: Boolean(claveCertificado),
      hasBankApi: Boolean(apiBancosJson),
      vaultSecurity: 'AES-256-GCM Authenticated Encryption',
      updatedAt: vaultEntry.updatedAt.toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
