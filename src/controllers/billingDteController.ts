import { Router, Request, Response } from 'express';
import { HttpDteBillingService } from '../services/httpDteBillingService';
import { BillingEmissionDraft } from '../types';
import { INITIAL_CLIENTS } from '../data/seedData';

export const billingDteRouter = Router();

/**
 * GET /api/billing/http-dte/status
 * Verifica el estado de salud de la instancia local de HTTP-DTE en http://localhost:8050
 * y la presencia de certificados y CAFs.
 */
billingDteRouter.get('/http-dte/status', async (req: Request, res: Response) => {
  try {
    const health = await HttpDteBillingService.checkHealth();
    const cert = HttpDteBillingService.loadDigitalCertificate();

    res.json({
      success: true,
      service: 'HTTP-DTE / LibreDTE Engine',
      endpoint: HttpDteBillingService.DEFAULT_HTTP_DTE_URL,
      ambiente: Number(process.env.DTE_AMBIENTE) === 2 ? 'Producción (2)' : 'Certificación (1)',
      ambienteCodigo: Number(process.env.DTE_AMBIENTE) === 2 ? 2 : 1,
      health,
      certificadoConfigurado: Boolean(cert.base64 && cert.base64.length > 20),
      certPasswordConfigurado: Boolean(process.env.DTE_CERT_PASSWORD),
      cafConfigurado: Boolean(process.env.DTE_CAF_PATH || process.env.DTE_CAF_DIR),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/billing/emitir-http-dte
 * Emisión directa de DTE por HTTP POST a LibreDTE sin levantar navegadores
 */
billingDteRouter.post('/emitir-http-dte', async (req: Request, res: Response) => {
  try {
    const { draft, companyId, options } = req.body;

    if (!draft || !draft.tipoDte) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el objeto "draft" con datos de la factura/DTE a emitir.',
      });
    }

    // Buscar datos de la empresa emisor
    let company = INITIAL_CLIENTS.find(
      (c) => c.id === companyId || c.rut.replace(/[^0-9kK]/g, '') === (companyId || '').replace(/[^0-9kK]/g, '')
    );

    if (!company) {
      company = {
        id: 'client-empresa-default',
        rut: req.body.rutEmisor || '76.123.456-7',
        razonSocial: req.body.razonSocialEmisor || 'SOCIEDAD INDUSTRIAL PUERTO MONTT SPA',
        giro: 'SERVICIOS INDUSTRIALES Y COMERCIALES',
        acteco: 139400,
        direccion: 'Av. Juan Soler Manfredini 101, Piso 8',
        comuna: 'PUERTO MONTT',
        ciudad: 'PUERTO MONTT',
      } as any;
    }

    console.log(`[BillingDteController] Solicitando emisión de DTE ${draft.tipoDte} para empresa ${company.rut} via HTTP-DTE...`);

    const result = await HttpDteBillingService.emitirDteDesdeBorrador(
      draft as BillingEmissionDraft,
      company,
      options
    );

    if (!result.success) {
      return res.status(502).json(result);
    }

    res.json(result);
  } catch (error: any) {
    console.error('[BillingDteController] Error en /emitir-http-dte:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error interno al procesar emisión DTE.',
    });
  }
});

/**
 * POST /api/billing/preview-payload
 * Genera el JSON exacto de HTTP-DTE que sería enviado al endpoint /dte/emitir
 * Útil para inspección de payload, auditoría y pruebas unitarias.
 */
billingDteRouter.post('/preview-payload', (req: Request, res: Response) => {
  try {
    const { draft, company } = req.body;
    const mapped = HttpDteBillingService.mapErpToHttpDtePayload(
      draft,
      company || {
        rut: '76.123.456-7',
        razonSocial: 'SOCIEDAD INDUSTRIAL PUERTO MONTT SPA',
        giro: 'SERVICIOS INDUSTRIALES',
        acteco: 139400,
        direccion: 'Av. Industrial 1000',
        comuna: 'PUERTO MONTT',
      }
    );

    res.json({
      success: true,
      targetEndpoint: `${HttpDteBillingService.DEFAULT_HTTP_DTE_URL}/dte/emitir`,
      payload: mapped,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Almacén en memoria de configuraciones de formato por empresa
const layoutConfigStore = new Map<string, any>();

/**
 * GET /api/billing/layout-config/:companyId
 * Obtiene la configuración de diseño de formato de factura para una empresa
 */
billingDteRouter.get('/layout-config/:companyId', (req: Request, res: Response) => {
  const { companyId } = req.params;
  const config = layoutConfigStore.get(companyId);
  res.json({
    success: true,
    companyId,
    config: config || null,
  });
});

/**
 * POST /api/billing/layout-config
 * Guarda la configuración de formato de factura personalizada
 */
billingDteRouter.post('/layout-config', (req: Request, res: Response) => {
  try {
    const { companyId, layout } = req.body;
    if (!companyId || !layout) {
      return res.status(400).json({ success: false, error: 'Faltan parámetros companyId o layout' });
    }
    layoutConfigStore.set(companyId, layout);
    res.json({
      success: true,
      message: 'Configuración de formato de factura guardada exitosamente',
      updatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/billing/vault-status/:rut
 * Retorna el estado criptográfico de la bóveda para una empresa/cliente específico
 * (Certificados propios, mandato de estudio contable y CAFs disponibles con rangos).
 */
billingDteRouter.get('/vault-status/:rut', (req: Request, res: Response) => {
  try {
    const { rut } = req.params;
    const razonSocial = req.query.razonSocial as string | undefined;
    const status = HttpDteBillingService.getTenantVaultStatus(rut, razonSocial);
    res.json({
      success: true,
      vault: status,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/billing/vault-save-caf
 * Permite cargar o actualizar un archivo CAF XML para un cliente específico
 */
billingDteRouter.post('/vault-save-caf', (req: Request, res: Response) => {
  try {
    const { rut, tipoDte, xmlContent } = req.body;
    if (!rut || !tipoDte || !xmlContent) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren "rut", "tipoDte" y "xmlContent" para registrar el CAF.',
      });
    }

    const result = HttpDteBillingService.saveTenantCafXml(rut, Number(tipoDte), xmlContent);
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      message: `CAF para DTE ${tipoDte} guardado exitosamente en la bóveda del cliente ${rut}.`,
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/billing/vault-save-password
 * Guarda o actualiza la contraseña del certificado digital para un cliente o empresa específica
 */
billingDteRouter.post('/vault-save-password', (req: Request, res: Response) => {
  try {
    const { rut, password } = req.body;
    if (!rut || !password) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere "rut" y "password" para actualizar la contraseña del certificado.',
      });
    }

    const result = HttpDteBillingService.saveTenantPassword(rut, password);
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/billing/vault-save-cert
 * Carga o actualiza el archivo de certificado digital (.p12 / .pfx) para la empresa
 */
billingDteRouter.post('/vault-save-cert', (req: Request, res: Response) => {
  try {
    const { rut, certBase64, filename } = req.body;
    if (!rut || !certBase64) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere "rut" y "certBase64" para almacenar el certificado digital.',
      });
    }

    const result = HttpDteBillingService.saveTenantCertificate(rut, certBase64, filename || 'certificado.p12');
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      message: `Certificado digital guardado exitosamente para ${rut}.`,
      ...result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});



