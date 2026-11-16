/**
 * Tenancy jerárquico (estudios contables, empresas, módulos y bóveda de credenciales).
 *
 * K1.8: sin MySQL estas rutas guardan en la persistencia de disco; antes inventaban un estudio
 * ("Audicon"), seis suscripciones de módulos y respondían "almacenadas en Vault" sin guardar nada.
 * En la bóveda cada secreto se cifra con su propio IV (antes la clave del certificado quedaba con
 * el IV de la clave SII y no se podía descifrar) y las credenciales bancarias también se cifran.
 *
 * La administración comercial (cliente ERP, plan, estado, límites) vive en /api/saas.
 */
import { diskPersistence } from '../services/diskPersistenceService';
import { getDemoClients } from '../data/seedData';
import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getMysqlDb, isRealMysqlConnected } from '../db/mysqlClient';
import {
  accountingFirms,
  companies,
  companyModuleSubscriptions,
  companyCredentialsVault,
} from '../db/schema/tenancySchema';
import { encryptToVaultString } from '../utils/vaultCrypto';
import { validateRutChileno } from '../utils/chileanAccounting';
import { normalizeCompanyKey } from '../services/companyRegistryService';

export const tenancyRouter = Router();

const store = () => diskPersistence.getSnapshot() as any;

// ============================================================================
// 1. ESTUDIOS CONTABLES (NIVEL 1)
// ============================================================================

tenancyRouter.get('/firms', async (_req: Request, res: Response) => {
  try {
    const firms = isRealMysqlConnected ? await getMysqlDb().select().from(accountingFirms) : store().accountingFirms || [];
    res.json({ success: true, count: firms.length, data: firms });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

tenancyRouter.post('/firms', async (req: Request, res: Response) => {
  try {
    const { rut, razonSocial, emailContacto, plan } = req.body || {};
    const faltantes = [!rut && 'rut', !razonSocial && 'razonSocial', !emailContacto && 'emailContacto', !plan && 'plan'].filter(Boolean);
    if (faltantes.length) {
      return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: faltantes, error: 'Faltan datos obligatorios del estudio.' });
    }
    if (!validateRutChileno(String(rut))) return res.status(400).json({ success: false, error: 'RUT_INVALIDO' });

    const newFirm = {
      id: crypto.randomUUID(),
      rut: String(rut).trim().toUpperCase(),
      razonSocial: String(razonSocial).trim(),
      emailContacto: String(emailContacto).trim().toLowerCase(),
      plan: String(plan),
      estado: 'ACTIVO' as const,
      createdAt: new Date(),
    };
    if (isRealMysqlConnected) {
      await getMysqlDb().insert(accountingFirms).values(newFirm);
    } else {
      const list = store().accountingFirms || [];
      if (list.some((f: any) => normalizeCompanyKey(f.rut) === normalizeCompanyKey(newFirm.rut))) {
        return res.status(409).json({ success: false, error: 'RUT_DUPLICADO' });
      }
      diskPersistence.updateCollection('accountingFirms', [...list, { ...newFirm, createdAt: newFirm.createdAt.toISOString() }]);
    }
    res.status(201).json({ success: true, message: 'Estudio contable registrado.', data: newFirm });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 2. EMPRESAS CLIENTES DEL ESTUDIO (NIVEL 2)
// ============================================================================

tenancyRouter.get('/firms/:firmId/companies', async (req: Request, res: Response) => {
  try {
    const { firmId } = req.params;
    let companyList: any[];
    if (isRealMysqlConnected) {
      companyList = await getMysqlDb().select().from(companies).where(eq(companies.firmId, firmId));
    } else {
      // Empresas registradas en disco y, solo con DEMO_MODE, las de ejemplo.
      const stored: any[] = (store().clients || []).filter((c: any) => c.firmId === firmId);
      const ruts = new Set(stored.map((c: any) => normalizeCompanyKey(c.rut)));
      companyList = [
        ...stored,
        ...getDemoClients()
          .filter((c) => !ruts.has(normalizeCompanyKey(c.rut)))
          .map((c) => ({ ...c, firmId })),
      ];
    }
    res.json({ success: true, count: companyList.length, data: companyList });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

tenancyRouter.post('/firms/:firmId/companies', async (req: Request, res: Response) => {
  try {
    const { firmId } = req.params;
    const { rut, razonSocial, giro, regimenTributario, esClienteAncla } = req.body || {};
    const faltantes = [!rut && 'rut', !razonSocial && 'razonSocial', !giro && 'giro', !regimenTributario && 'regimenTributario'].filter(Boolean);
    if (faltantes.length) {
      return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: faltantes, error: 'Faltan datos obligatorios de la empresa.' });
    }
    if (!['14_A', '14_D3', '14_D8'].includes(regimenTributario)) {
      return res.status(400).json({ success: false, error: 'REGIMEN_INVALIDO', errorMessage: 'Régimen tributario: 14_A, 14_D3 o 14_D8.' });
    }
    const newCompany = {
      id: String(rut).replace(/\./g, '').trim().toUpperCase(),
      firmId,
      rut: String(rut).trim().toUpperCase(),
      razonSocial: String(razonSocial).trim(),
      giro: String(giro).trim(),
      regimenTributario: regimenTributario as '14_A' | '14_D3' | '14_D8',
      esClienteAncla: Boolean(esClienteAncla),
      createdAt: new Date(),
    };
    if (isRealMysqlConnected) {
      await getMysqlDb().insert(companies).values(newCompany);
    } else {
      const stored: any[] = store().clients || [];
      if (stored.some((c) => normalizeCompanyKey(c.rut) === normalizeCompanyKey(newCompany.rut))) {
        return res.status(409).json({ success: false, error: 'RUT_DUPLICADO' });
      }
      diskPersistence.updateCollection('clients', [...stored, { ...newCompany, createdAt: newCompany.createdAt.toISOString() }]);
    }
    res.status(201).json({ success: true, message: 'Empresa vinculada al Estudio Contable.', data: newCompany });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 3. SUSCRIPCIÓN DE MÓDULOS (NIVEL 3)
// ============================================================================

tenancyRouter.get('/companies/:empresaId/modules', async (req: Request, res: Response) => {
  try {
    const { empresaId } = req.params;
    const subscriptions = isRealMysqlConnected
      ? await getMysqlDb().select().from(companyModuleSubscriptions).where(eq(companyModuleSubscriptions.empresaId, empresaId))
      : (store().companyModuleSubscriptions || []).filter((s: any) => normalizeCompanyKey(s.empresaId) === normalizeCompanyKey(empresaId));
    res.json({ success: true, count: subscriptions.length, data: subscriptions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

tenancyRouter.post('/companies/:empresaId/modules', async (req: Request, res: Response) => {
  try {
    const { empresaId } = req.params;
    const { moduloCodigo, pagadoPor, fechaRenovacion } = req.body || {};
    const faltantes = [!moduloCodigo && 'moduloCodigo', !pagadoPor && 'pagadoPor', !fechaRenovacion && 'fechaRenovacion'].filter(Boolean);
    if (faltantes.length) {
      return res.status(400).json({ success: false, code: 'MISSING_PARAMS', missingParams: faltantes, error: 'Faltan datos de la suscripción.' });
    }
    const sub = {
      id: crypto.randomUUID(),
      empresaId,
      moduloCodigo,
      pagadoPor,
      estado: 'ACTIVO' as const,
      fechaRenovacion,
      createdAt: new Date(),
    };
    if (isRealMysqlConnected) {
      await getMysqlDb().insert(companyModuleSubscriptions).values(sub);
    } else {
      diskPersistence.updateCollection('companyModuleSubscriptions', [...(store().companyModuleSubscriptions || []), { ...sub, createdAt: sub.createdAt.toISOString() }]);
    }
    res.status(201).json({ success: true, message: `Módulo ${moduloCodigo} suscrito.`, data: sub });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// 4. BÓVEDA DE CREDENCIALES (AES-256-GCM, un IV por secreto)
// ============================================================================

tenancyRouter.post('/companies/:empresaId/vault', async (req: Request, res: Response) => {
  try {
    const { empresaId } = req.params;
    const { claveSii, claveCertificado, apiBancosJson } = req.body || {};
    if (!claveSii && !claveCertificado && !apiBancosJson) {
      return res.status(400).json({ success: false, code: 'MISSING_PARAMS', error: 'No se recibió ningún secreto para guardar.' });
    }
    // Cada secreto queda autocontenido (vault:v1:<iv>:<tag>:<cifrado>), con su propio IV.
    const entry: any = { empresaId };
    if (claveSii) entry.claveSii = encryptToVaultString(String(claveSii));
    if (claveCertificado) entry.claveCertificado = encryptToVaultString(String(claveCertificado));
    if (apiBancosJson) entry.apiBancos = encryptToVaultString(typeof apiBancosJson === 'string' ? apiBancosJson : JSON.stringify(apiBancosJson));
    diskPersistence.saveVaultEntry(entry);

    if (isRealMysqlConnected) {
      const parts = (v?: string) => (v ? v.split(':') : []);
      const ref = parts(entry.claveSii || entry.claveCertificado || entry.apiBancos);
      await getMysqlDb().insert(companyCredentialsVault).values({
        id: crypto.randomUUID(),
        empresaId,
        certificadoDigitalEncrypted: null,
        claveCertificadoEncrypted: entry.claveCertificado || null,
        claveSiiEncrypted: entry.claveSii || null,
        apiBancosEncrypted: entry.apiBancos || null,
        iv: ref[2],
        tagAuth: ref[3],
        updatedAt: new Date(),
      } as any);
    }

    res.status(200).json({
      success: true,
      message: 'Credenciales cifradas y guardadas.',
      empresaId,
      hasSiiKey: Boolean(claveSii),
      hasCertKey: Boolean(claveCertificado),
      hasBankApi: Boolean(apiBancosJson),
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});
