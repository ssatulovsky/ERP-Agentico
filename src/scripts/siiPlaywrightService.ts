/**
 * Servicio de RPA / Scraping para el Registro de Compras y Ventas (RCV) del SII
 * Basado en Playwright y navegación sobre la interfaz de usuario oficial (zeusr.sii.cl).
 *
 * Resuelve el problema de negociación mTLS (Mutual TLS) del certificado digital
 * mediante autenticación con RUT y Clave Tributaria, extrayendo el CSV oficial
 * e ingestándolo directamente en el sistema ERP.
 */

export interface SiiRpaConfig {
  rutAutenticacion: string; // RUT de acceso (empresa o representante)
  claveTributaria: string;  // Clave secreta tributaria del SII configurada para la empresa
  rutEmpresa: string;        // RUT de la empresa mandante
  razonSocial?: string;      // Razón social para logs y auditoría
  headless?: boolean;
  erpApiUrl?: string;        // URL del ERP (ej: 'http://localhost:3000')
}

export interface SiiDownloadResult {
  tipo: 'COMPRA' | 'VENTA' | 'HONORARIOS';
  periodo: string; // Formato AAAAMM (ej: '202608')
  filename: string;
  csvContent: string;
  bufferLength: number;
}

/**
 * Plantilla de código ejecutable con Playwright (Node.js / TypeScript).
 * Diseñada para arquitectura MULTI-EMPRESA:
 * - NO almacena credenciales fijas en variables de entorno globales.
 * - Obtiene el RUT y Clave Tributaria directamente desde la configuración de cada empresa en el ERP.
 * - Soporta ejecución individual por empresa y ejecución masiva/batch para estudios contables.
 */
export const PLAYWRIGHT_NODE_SCRIPT_TEMPLATE = `
// ============================================================================
// SII CHILE - MOTOR RPA PLAYWRIGHT MULTI-EMPRESA PARA RCV (CSV)
// Las credenciales se obtienen dinámicamente de la ficha de cada empresa.
// ============================================================================

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class SIIService {
  /**
   * @param {Object} config - Configuración específica de la empresa
   * @param {string} config.rut - RUT de autenticación (representante o empresa)
   * @param {string} config.password - Clave Tributaria del SII de la empresa
   * @param {string} config.empresaRut - RUT mandante de la empresa
   * @param {string} [config.razonSocial] - Razón social de la empresa
   * @param {string} [config.erpApiUrl] - URL del ERP
   */
  constructor(config) {
    if (!config || !config.rut || !config.password) {
      throw new Error('[SII-RPA] Error: Se requiere rut y password configurados para la empresa.');
    }
    this.rut = config.rut;
    this.password = config.password;
    this.empresaRut = config.empresaRut || this.rut;
    this.razonSocial = config.razonSocial || this.empresaRut;
    this.erpApiUrl = config.erpApiUrl || 'http://localhost:3000';
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  /**
   * Carga la configuración y credenciales de una empresa directamente desde el ERP
   * @param {string} empresaRutOrId - RUT o ID de la empresa en el ERP
   * @param {string} [erpApiUrl] - URL del servidor ERP
   */
  static async fromErpCompany(empresaRutOrId, erpApiUrl = 'http://localhost:3000') {
    console.log(\`[SII-RPA] Obteniendo credenciales de la empresa \${empresaRutOrId} desde el ERP...\`);
    const cleanId = encodeURIComponent(empresaRutOrId.replace(/\\./g, '').trim());
    const res = await fetch(\`\${erpApiUrl}/api/companies/\${cleanId}/sii-config\`);
    
    if (!res.ok) {
      throw new Error(\`No se pudo cargar la configuración de la empresa: \${res.statusText}\`);
    }
    
    const data = await res.json();
    if (!data.success || !data.empresa) {
      throw new Error(data.error || 'Empresa no encontrada en el sistema ERP.');
    }

    const { empresa } = data;
    return new SIIService({
      rut: empresa.rutAutenticacion || empresa.rut,
      password: empresa.claveSii,
      empresaRut: empresa.rut,
      razonSocial: empresa.razonSocial || empresa.nombreCorto,
      erpApiUrl
    });
  }

  /**
   * Sincroniza todas las empresas activas del ERP de forma masiva (Batch Multi-Empresa)
   * @param {string} periodo - Período a consultar en formato AAAAMM (ej: '202608')
   * @param {string} [erpApiUrl] - URL del servidor ERP
   */
  static async syncAllActiveCompanies(periodo, erpApiUrl = 'http://localhost:3000') {
    console.log(\`[SII-RPA Batch] Consultando lista de empresas activas en el ERP (\${erpApiUrl})...\`);
    const res = await fetch(\`\${erpApiUrl}/api/companies/active-sii\`);
    const data = await res.json();

    if (!data.success || !data.companies || data.companies.length === 0) {
      console.log('[SII-RPA Batch] No hay empresas activas con sincronización SII habilitada.');
      return [];
    }

    console.log(\`[SII-RPA Batch] Se procesarán \${data.companies.length} empresas para el período \${periodo}.\`);
    const results = [];

    for (const emp of data.companies) {
      console.log(\`\\n------------------------------------------------------------\`);
      console.log(\`[SII-RPA] Procesando: \${emp.razonSocial} (RUT: \${emp.rut})\`);
      console.log(\`[SII-RPA] RUT Autenticación: \${emp.rutAutenticacion} | Tipo: \${emp.tipoAutenticacionSii}\`);
      
      if (!emp.claveSii) {
        console.warn(\`[SII-RPA] ADVERTENCIA: La empresa \${emp.rut} no tiene Clave SII configurada. Saltando...\`);
        results.push({ rut: emp.rut, success: false, error: 'Sin Clave SII configurada' });
        continue;
      }

      const service = new SIIService({
        rut: emp.rutAutenticacion || emp.rut,
        password: emp.claveSii,
        empresaRut: emp.rut,
        razonSocial: emp.razonSocial,
        erpApiUrl
      });

      try {
        await service.initialize(true);
        // Descargar Ventas
        const bufVentas = await service.descargarRegistro('VENTA', periodo);
        const resVentas = await service.enviarAlErp(bufVentas, 'VENTA', periodo);
        
        // Descargar Compras
        const bufCompras = await service.descargarRegistro('COMPRA', periodo);
        const resCompras = await service.enviarAlErp(bufCompras, 'COMPRA', periodo);

        results.push({
          rut: emp.rut,
          success: true,
          ventas: resVentas.count || 0,
          compras: resCompras.count || 0
        });
      } catch (err) {
        console.error(\`[SII-RPA] Error procesando empresa \${emp.rut}:\`, err.message);
        results.push({ rut: emp.rut, success: false, error: err.message });
      } finally {
        await service.close();
      }
    }

    console.log(\`\\n[SII-RPA Batch] Proceso completado. Resumen:\`, results);
    return results;
  }

  async initialize(headless = true) {
    console.log(\`[SII-RPA] Inicializando Chromium para \${this.razonSocial}...\`);
    this.browser = await chromium.launch({ 
      headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
    });
    this.context = await this.browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1280, height: 800 }
    });
    this.page = await this.context.newPage();
  }

  async login() {
    console.log(\`[SII-RPA] Autenticando en zeusr.sii.cl con RUT: \${this.rut}...\`);
    await this.page.goto('https://zeusr.sii.cl/AUT2000/InicioAutenticacion/IngresoRutClave.html?https://www4.sii.cl/consdcvinternetui/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    await this.page.fill('#rutcntr', this.rut);
    await this.page.fill('#clave', this.password);
    await this.page.click('#bt_ingresar');

    await this.page.waitForURL('https://www4.sii.cl/consdcvinternetui/#/**', { timeout: 35000 });
    console.log(\`[SII-RPA] Sesión iniciada exitosamente para \${this.razonSocial}.\`);
  }

  async descargarRegistro(tipo, periodo) {
    if (!this.browser) await this.initialize(true);
    await this.login();

    const anio = periodo.slice(0, 4);
    const mes = periodo.slice(4, 6);

    console.log(\`[SII-RPA] Consultando \${tipo} para período \${anio}-\${mes} (RUT: \${this.empresaRut})...\`);

    try {
      const selectRut = await this.page.$('select[name="rut"]');
      if (selectRut) {
        await this.page.selectOption('select[name="rut"]', { index: 1 });
      }
    } catch (e) {}

    await this.page.selectOption('#periodoMes', mes);
    await this.page.selectOption('[ng-model="periodoAnho"]', anio);
    await this.page.click('button[type="submit"]:has-text("Consultar")');
    await this.page.waitForLoadState('networkidle');

    const tabSelector = tipo === 'COMPRA' ? '#tabCompra' : '#tabVenta';
    const tabExists = await this.page.$(tabSelector);
    if (tabExists) {
      await this.page.click(tabSelector);
    } else {
      await this.page.click(\`ul.nav-tabs a:has-text("\${tipo === 'VENTA' ? 'VENTA' : 'COMPRA'}")\`);
    }
    await this.page.waitForLoadState('networkidle');

    console.log(\`[SII-RPA] Descargando detalles CSV de \${tipo}...\`);
    await this.page.waitForSelector('button:has-text("Descargar Detalles")', { state: 'visible', timeout: 20000 });

    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.page.click('button:has-text("Descargar Detalles")')
    ]);

    const stream = await download.createReadStream();
    const buffer = await new Promise((resolve, reject) => {
      const chunks = [];
      stream.on('data', chunk => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });

    console.log(\`[SII-RPA] \${tipo} descargado con éxito (\${buffer.length} bytes).\`);
    return buffer;
  }

  async enviarAlErp(buffer, tipo, periodo) {
    const periodoFormatted = \`\${periodo.slice(0, 4)}-\${periodo.slice(4, 6)}\`;
    const payload = {
      empresaRut: this.empresaRut,
      periodo: periodoFormatted,
      tipo: tipo === 'COMPRA' ? 'COMPRA' : 'VENTA',
      fileBase64: buffer.toString('base64'),
    };

    console.log(\`[SII-RPA] Enviando CSV de \${this.empresaRut} a \${this.erpApiUrl}/api/rcv/upload-csv...\`);
    const res = await fetch(\`\${this.erpApiUrl}/api/rcv/upload-csv\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    return data;
  }

  async close() {
    if (this.browser) {
      try {
        await this.page?.click('a:has-text("Cerrar sesión")').catch(() => {});
        await this.browser.close();
      } catch (e) {}
      this.browser = null;
      this.page = null;
    }
  }
}

// ============================================================================
// EJEMPLOS DE EJECUCIÓN:
// ============================================================================
// 1. Ejecutar para UNA empresa específica obteniendo credenciales desde el ERP:
// (async () => {
//   const service = await SIIService.fromErpCompany('76.892.410-K', 'http://localhost:3000');
//   try {
//     const bufVentas = await service.descargarRegistro('VENTA', '202608');
//     await service.enviarAlErp(bufVentas, 'VENTA', '202608');
//     const bufCompras = await service.descargarRegistro('COMPRA', '202608');
//     await service.enviarAlErp(bufCompras, 'COMPRA', '202608');
//   } finally {
//     await service.close();
//   }
// })();
//
// 2. Ejecutar de forma MASIVA para TODAS las empresas del estudio contable:
// (async () => {
//   await SIIService.syncAllActiveCompanies('202608', 'http://localhost:3000');
// })();

module.exports = SIIService;
`;

