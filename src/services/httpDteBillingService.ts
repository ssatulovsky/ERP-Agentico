import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  BillingEmissionDraft,
  BillingItemDetail,
  DteDocument,
  HttpDteEmissionPayload,
  HttpDteEmissionResponse,
  HttpDteEmisor,
  HttpDteReceptor,
  HttpDteDetalleItem,
  HttpDteReferencia,
  TaxCryptographicVaultStatus,
  TenantCafItem,
} from '../types';
import { pool, getMysqlDb, isRealMysqlConnected } from '../db/mysqlClient';
import { dtesRcv, dteItems, dteCafSequences } from '../db/schema/dtesSchema';
import { companyCredentialsVault } from '../db/schema/tenancySchema';
import { diskPersistence } from './diskPersistenceService';
import { createSalesDteEntry } from '../utils/chileanAccounting';
import { encryptVaultSecret, decryptVaultSecret } from '../utils/vaultCrypto';
import { isOfflineDteSimulationAllowed, SIMULATED_TED_SIGNATURE } from '../config/dteSimulationPolicy';

/**
 * Servicio Especializado de Facturación Electrónica para Chile (SII / LibreDTE)
 * Reemplaza completamente navegadores y RPA Playwright por llamadas HTTP directas
 * a la API REST de HTTP-DTE (Slim / LibreDTE) corriendo en http://localhost:8050/dte/emitir
 */
export class HttpDteBillingService {
  public static readonly DEFAULT_HTTP_DTE_URL = process.env.HTTP_DTE_URL || 'http://localhost:8050';
  public static readonly DEFAULT_TIMEOUT_MS = Number(process.env.HTTP_DTE_TIMEOUT_MS) || 30000;
  public static readonly DEFAULT_MAX_RETRIES = Number(process.env.HTTP_DTE_MAX_RETRIES) || 3;

  /**
   * Genera variantes del RUT (con guión, sin guión, con puntos) para resolución tolerante de archivos
   */
  public static getRutVariants(rut: string): string[] {
    const raw = (rut || '').trim().toUpperCase();
    if (!raw) return [];
    const withHyphen = raw.replace(/\./g, '');
    const withoutHyphen = withHyphen.replace(/-/g, '');
    return Array.from(new Set([withHyphen, withoutHyphen, raw])).filter(Boolean);
  }

  /**
   * Carga el Certificado Digital (.p12 o .pfx) en Base64 y su contraseña asociada.
   * Resolución Multi-Tenant para Estudios Contables y Empresas:
   * 1. Bóveda del Cliente: ./certs/tenants/{cleanRut}/certificado.p12 (o .pfx)
   * 2. Certificado del Mandatario del Estudio Contable: ./certs/estudio_contable/ o variable DTE_MANDATARIO_CERT_PATH
   * 3. Variable directa DTE_CERT_BASE64
   * 4. Ruta directa en customPath o DTE_CERT_PATH (.env fallback)
   * 5. Modo demo/desarrollo contingente.
   */
  public static loadDigitalCertificate(
    customPath?: string,
    options?: { rut?: string; useMandatoEstudio?: boolean }
  ): { base64: string; password: string; source: string } | null {
    const variants = this.getRutVariants(options?.rut || '');
    let password = process.env.DTE_CERT_PASSWORD || '123456';

    // 1. Revisar si el cliente tiene bóveda propia en ./certs/tenants/{variante}/
    if (variants.length > 0 && !options?.useMandatoEstudio) {
      for (const variant of variants) {
        const tenantDir = path.join(process.cwd(), 'certs', 'tenants', variant);
        const tenantPassFile = path.join(tenantDir, 'password.txt');
        if (fs.existsSync(tenantPassFile)) {
          try {
            password = fs.readFileSync(tenantPassFile, 'utf-8').trim();
          } catch {}
        } else {
          const vEntry = diskPersistence.getVaultEntry(variant);
          if (vEntry?.claveCertificadoEncrypted && vEntry?.iv && vEntry?.tagAuth) {
            try {
              password = decryptVaultSecret(vEntry.claveCertificadoEncrypted, vEntry.iv, vEntry.tagAuth);
            } catch {}
          }
        }

        const tenantCandidateFiles = [
          path.join(tenantDir, 'certificado.p12'),
          path.join(tenantDir, 'firma_digital.pfx'),
          path.join(tenantDir, 'certificado.pfx'),
          path.join(process.cwd(), 'certs', variant, 'certificado.p12'),
        ];

        for (const certFile of tenantCandidateFiles) {
          if (fs.existsSync(certFile)) {
            try {
              const buffer = fs.readFileSync(certFile);
              return {
                base64: buffer.toString('base64'),
                password,
                source: `CLIENT_VAULT:${variant}`,
              };
            } catch (err: any) {
              console.warn(`[HttpDteBillingService] Error leyendo certificado cliente en ${certFile}: ${err.message}`);
            }
          }
        }
      }
    }

    // 2. Si usa Mandato del Estudio Contable (el contador firma por sus clientes con poder SII)
    const studioCandidateFiles = [
      path.join(process.cwd(), 'certs', 'estudio_contable', 'certificado.p12'),
      path.join(process.cwd(), 'certs', 'estudio_contable', 'firma_digital.pfx'),
      path.join(process.cwd(), 'certs', 'estudio', 'certificado.p12'),
      process.env.DTE_MANDATARIO_CERT_PATH,
    ].filter(Boolean) as string[];

    for (const certFile of studioCandidateFiles) {
      if (fs.existsSync(certFile)) {
        try {
          const buffer = fs.readFileSync(certFile);
          return {
            base64: buffer.toString('base64'),
            password: process.env.DTE_MANDATARIO_CERT_PASSWORD || password,
            source: 'STUDIO_MANDATE',
          };
        } catch (err: any) {
          console.warn(`[HttpDteBillingService] Error leyendo certificado de mandatario en ${certFile}: ${err.message}`);
        }
      }
    }

    // 3. Directo desde Base64 en entorno
    if (process.env.DTE_CERT_BASE64 && process.env.DTE_CERT_BASE64.trim().length > 10) {
      return {
        base64: process.env.DTE_CERT_BASE64.trim(),
        password,
        source: 'ENV_BASE64',
      };
    }

    // 4. Búsqueda de archivo local en servidor (fallback general)
    const candidatePaths = [
      customPath,
      process.env.DTE_CERT_PATH,
      path.join(process.cwd(), 'certs', 'certificado.p12'),
      path.join(process.cwd(), 'certs', 'firma_digital.pfx'),
      path.join(process.cwd(), 'certs', 'certificado.pfx'),
      path.join(process.cwd(), 'certificado.p12'),
    ].filter(Boolean) as string[];

    for (const certFile of candidatePaths) {
      if (fs.existsSync(certFile)) {
        try {
          const buffer = fs.readFileSync(certFile);
          const base64 = buffer.toString('base64');
          return { base64, password, source: 'LOCAL_SERVER_CERT' };
        } catch (err: any) {
          console.warn(`[HttpDteBillingService] No se pudo leer certificado en ${certFile}: ${err.message}`);
        }
      }
    }

    // 5. Certificado de demostración: SOLO en desarrollo con ALLOW_OFFLINE_DTE_SIMULATION=true.
    //    En cualquier otro caso no hay certificado y quien lo pida debe informarlo como faltante.
    if (isOfflineDteSimulationAllowed()) {
      const fallbackBuffer = Buffer.from(`MIIK_CERTIFICADO_DIGITAL_DEMO_SII_${Date.now()}_PKCS12`);
      return {
        base64: fallbackBuffer.toString('base64'),
        password,
        source: 'SIMULATED_DEVELOPMENT',
      };
    }
    return null;
  }

  /**
   * Carga el archivo CAF (Código de Autorización de Folios en formato XML del SII)
   * correspondiente al Tipo de DTE (33, 34, 52, 56, 61, etc.).
   * En Chile, el CAF es ÚNICO E INTRANSFERIBLE por RUT de la Empresa + Tipo de DTE.
   * Resolución Multi-Tenant:
   * 1. ./certs/tenants/{variante}/caf/F{tipoDte}.xml
   * 2. ./certs/{variante}/caf/F{tipoDte}.xml
   * 3. ./certs/caf/{variante}_F{tipoDte}.xml
   * 4. Variable de entorno específica DTE_CAF_XML_{tipoDte}
   * 5. Carpeta compartida por defecto ./certs/caf/F{tipoDte}.xml
   */
  public static loadCafXml(
    tipoDte: number,
    customPath?: string,
    options?: { rut?: string }
  ): string {
    const variants = this.getRutVariants(options?.rut || '');

    // 1. Bóveda multi-tenant del cliente
    for (const variant of variants) {
      const tenantCandidateFiles = [
        path.join(process.cwd(), 'certs', 'tenants', variant, 'caf', `F${tipoDte}.xml`),
        path.join(process.cwd(), 'certs', 'tenants', variant, 'caf', `CAF_${tipoDte}.xml`),
        path.join(process.cwd(), 'certs', 'tenants', variant, `F${tipoDte}.xml`),
        path.join(process.cwd(), 'certs', variant, 'caf', `F${tipoDte}.xml`),
        path.join(process.cwd(), 'certs', 'caf', `${variant}_F${tipoDte}.xml`),
      ];

      for (const cafFile of tenantCandidateFiles) {
        if (fs.existsSync(cafFile)) {
          try {
            return fs.readFileSync(cafFile, 'utf-8').trim();
          } catch (err: any) {
            console.warn(`[HttpDteBillingService] Error leyendo CAF multi-tenant en ${cafFile}: ${err.message}`);
          }
        }
      }
    }

    // 2. Si viene directo como variable de entorno específica
    const envCafKey = `DTE_CAF_XML_${tipoDte}`;
    if (process.env[envCafKey]) {
      return process.env[envCafKey]!.trim();
    }

    // 3. Fallback en directorio general
    const cafDir = process.env.DTE_CAF_DIR || path.join(process.cwd(), 'certs', 'caf');
    const candidateFiles = [
      customPath,
      process.env.DTE_CAF_PATH,
      path.join(cafDir, `F${tipoDte}.xml`),
      path.join(cafDir, `CAF_${tipoDte}.xml`),
      path.join(cafDir, `caf_${tipoDte}.xml`),
      path.join(process.cwd(), 'caf', `F${tipoDte}.xml`),
    ].filter(Boolean) as string[];

    for (const cafFile of candidateFiles) {
      if (fs.existsSync(cafFile)) {
        try {
          return fs.readFileSync(cafFile, 'utf-8').trim();
        } catch (err: any) {
          console.warn(`[HttpDteBillingService] Error leyendo CAF en ${cafFile}: ${err.message}`);
        }
      }
    }

    // 4. Si no se encuentra archivo CAF para este tipo de DTE
    console.warn(`[HttpDteBillingService] No se encontró archivo CAF (.xml) válido para tipo ${tipoDte} (RUT: ${options?.rut || 'no especificado'}).`);
    return '';
  }

  /**
   * Valida la estructura XML, elementos obligatorios y firma digital del CAF oficial del SII
   */
  public static verifyCafSignature(
    content: string,
    customSiiPublicKey?: string
  ): {
    valid: boolean;
    isSample: boolean;
    signatureAlg?: string;
    status: 'VALID_OFFICIAL' | 'SAMPLE_STAGING' | 'INVALID_CORRUPT' | 'UNVERIFIED_NO_SII_KEY';
    reason?: string;
  } {
    if (!content || typeof content !== 'string') {
      return { valid: false, isSample: false, status: 'INVALID_CORRUPT', reason: 'Contenido XML vacío' };
    }
    const daMatch = content.match(/<DA>[\s\S]*?<\/DA>/i);
    const frmaMatch = content.match(/<FRMA(?:\s+algoritmo="([^"]+)")?>([\s\S]*?)<\/FRMA>/i);
    const hasRsapk = /<RSAPK>[\s\S]*?<\/RSAPK>/i.test(content);

    if (!daMatch || !frmaMatch || !hasRsapk) {
      return {
        valid: false,
        isSample: false,
        status: 'INVALID_CORRUPT',
        reason: 'El CAF no contiene los nodos obligatorios <DA>, <RSAPK> y <FRMA> exigidos por el SII.',
      };
    }

    const daContent = daMatch[0];
    const alg = frmaMatch[1] || 'SHA1withRSA';
    const firmaB64 = frmaMatch[2].replace(/\s+/g, '');

    if (!firmaB64) {
      return {
        valid: false,
        isSample: false,
        status: 'INVALID_CORRUPT',
        reason: 'Nodo <FRMA> sin firma digital.',
      };
    }

    // Detección estricta de firmas inventadas, simuladas o de muestra
    const isSampleOrInvented =
      firmaB64.includes('sample_') ||
      content.includes('sample_caf_') ||
      content.includes('sample_private_rsa') ||
      firmaB64.length < 64;

    if (isSampleOrInvented) {
      return {
        valid: false,
        isSample: true,
        signatureAlg: alg,
        status: 'INVALID_CORRUPT',
        reason: 'Firma digital simulada o inventada no emitida por el SII. Documento rechazado.',
      };
    }

    // Resolver clave pública oficial del SII
    let siiPublicKey = customSiiPublicKey || process.env.SII_PUBLIC_KEY;
    if (!siiPublicKey) {
      const candidates = [
        path.join(process.cwd(), 'certs', 'sii', 'sii_public_key.pem'),
        path.join(process.cwd(), 'certs', 'sii_public_key.pem'),
      ];
      const foundKeyPath = candidates.find((p) => fs.existsSync(p));
      if (foundKeyPath) {
        try {
          siiPublicKey = fs.readFileSync(foundKeyPath, 'utf-8');
        } catch {}
      }
    }

    // Si no disponemos de la clave pública oficial del SII, no afirmar validez oficial
    if (!siiPublicKey) {
      return {
        valid: false,
        isSample: false,
        signatureAlg: alg,
        status: 'UNVERIFIED_NO_SII_KEY',
        reason: 'Firma presente en CAF, pero no es posible certificar su validez oficial sin la clave pública del SII configurada en el servidor (SII_PUBLIC_KEY o certs/sii/sii_public_key.pem).',
      };
    }

    try {
      const hashAlg = alg.toLowerCase().includes('sha256') ? 'RSA-SHA256' : 'RSA-SHA1';
      const verifier = crypto.createVerify(hashAlg);
      verifier.update(daContent);
      const isSignatureValid = verifier.verify(siiPublicKey, Buffer.from(firmaB64, 'base64'));

      if (isSignatureValid) {
        return {
          valid: true,
          isSample: false,
          signatureAlg: alg,
          status: 'VALID_OFFICIAL',
          reason: 'Firma digital del SII verificada criptográficamente con la clave pública oficial.',
        };
      } else {
        return {
          valid: false,
          isSample: false,
          signatureAlg: alg,
          status: 'INVALID_CORRUPT',
          reason: 'Firma digital FRMA no corresponde a la clave pública del SII o los datos del CAF fueron alterados.',
        };
      }
    } catch (cryptoErr: any) {
      return {
        valid: false,
        isSample: false,
        signatureAlg: alg,
        status: 'INVALID_CORRUPT',
        reason: `Error en la verificación criptográfica de la firma del SII: ${cryptoErr?.message || 'clave pública o formato inválido'}.`,
      };
    }
  }

  /**
   * Obtiene el estado criptográfico completo de la bóveda para una empresa/cliente específico.
   * Examina certificados propios, mandato del estudio contable y CAFs disponibles con rangos.
   */
  public static getTenantVaultStatus(rut: string, razonSocial?: string): TaxCryptographicVaultStatus {
    const variants = this.getRutVariants(rut);
    const cleanRut = variants[0] || (rut || '').replace(/[^0-9kK]/g, '').toUpperCase();

    // Buscar tenantDir existente entre las variantes
    let tenantDir = path.join(process.cwd(), 'certs', 'tenants', cleanRut);
    for (const v of variants) {
      const candidateDir = path.join(process.cwd(), 'certs', 'tenants', v);
      if (fs.existsSync(candidateDir)) {
        tenantDir = candidateDir;
        break;
      }
    }
    const tenantCafDir = path.join(tenantDir, 'caf');

    // Revisar configuración de bóveda
    let modoFirma: 'CERTIFICADO_PROPIO' | 'MANDATO_ESTUDIO' | 'DEMO_SIMULADO' = 'MANDATO_ESTUDIO';
    let mandatarioRut = '15.892.301-2';
    let mandatarioNombre = 'AUDITORES & CONSULTORES ASOCIADOS SPA';

    const configFile = path.join(tenantDir, 'vault-config.json');
    if (fs.existsSync(configFile)) {
      try {
        const configData = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        if (configData.modoFirma) modoFirma = configData.modoFirma;
        if (configData.mandatarioRut) mandatarioRut = configData.mandatarioRut;
        if (configData.mandatarioNombre) mandatarioNombre = configData.mandatarioNombre;
      } catch {}
    }

    // Verificar certificado propio
    const ownCertPaths: string[] = [];
    for (const v of variants) {
      const d = path.join(process.cwd(), 'certs', 'tenants', v);
      ownCertPaths.push(
        path.join(d, 'certificado.p12'),
        path.join(d, 'firma_digital.pfx'),
        path.join(d, 'certificado.pfx')
      );
    }
    const foundCert = ownCertPaths.find((p) => fs.existsSync(p));
    const hasOwnCert = Boolean(foundCert);

    if (hasOwnCert) {
      modoFirma = 'CERTIFICADO_PROPIO';
    }

    // Tipos de DTE soportados
    const dteTypesConfig: Array<{ tipo: number; nombre: string }> = [
      { tipo: 33, nombre: 'Factura Electrónica Afecta' },
      { tipo: 34, nombre: 'Factura No Afecta o Exenta' },
      { tipo: 52, nombre: 'Guía de Despacho Electrónica' },
      { tipo: 56, nombre: 'Nota de Débito Electrónica' },
      { tipo: 61, nombre: 'Nota de Crédito Electrónica' },
      { tipo: 39, nombre: 'Boleta Electrónica de Ventas' },
    ];

    const cafs: TenantCafItem[] = dteTypesConfig.map(({ tipo, nombre }) => {
      const candidates: string[] = [
        path.join(tenantCafDir, `F${tipo}.xml`),
        path.join(tenantCafDir, `CAF_${tipo}.xml`),
      ];
      for (const v of variants) {
        candidates.push(
          path.join(process.cwd(), 'certs', 'tenants', v, 'caf', `F${tipo}.xml`),
          path.join(process.cwd(), 'certs', 'caf', `${v}_F${tipo}.xml`)
        );
      }
      candidates.push(path.join(process.cwd(), 'certs', 'caf', `F${tipo}.xml`));

      const foundPath = candidates.find((p) => fs.existsSync(p));
      if (!foundPath) {
        return {
          tipoDte: tipo,
          nombreTipo: nombre,
          exists: false,
          cafStatus: 'NOT_FOUND',
        };
      }

      // Parsear rango desde y hasta y verificar firma digital
      let rangoDesde: number | undefined;
      let rangoHasta: number | undefined;
      let fechaAutorizacion: string | undefined;
      let cafVerification: { valid: boolean; isSample: boolean; signatureAlg?: string; status: 'VALID_OFFICIAL' | 'SAMPLE_STAGING' | 'INVALID_CORRUPT' | 'UNVERIFIED_NO_SII_KEY'; reason?: string } = { valid: false, isSample: false, status: 'INVALID_CORRUPT' };

      try {
        const content = fs.readFileSync(foundPath, 'utf-8');
        cafVerification = this.verifyCafSignature(content);
        const rngMatch = content.match(/<RNG>\s*<D>(\d+)<\/D>\s*<H>(\d+)<\/H>\s*<\/RNG>/i);
        if (rngMatch) {
          rangoDesde = Number(rngMatch[1]);
          rangoHasta = Number(rngMatch[2]);
        }
        const faMatch = content.match(/<FA>([^<]+)<\/FA>/i);
        if (faMatch) {
          fechaAutorizacion = faMatch[1].trim();
        }
      } catch {}

      const foliosDisponibles =
        rangoDesde !== undefined && rangoHasta !== undefined
          ? Math.max(0, rangoHasta - rangoDesde + 1)
          : undefined;

      return {
        tipoDte: tipo,
        nombreTipo: nombre,
        exists: true,
        filePath: foundPath.replace(process.cwd(), '.'),
        rangoDesde,
        rangoHasta,
        fechaAutorizacion,
        foliosDisponibles,
        folioActualSugerido: rangoDesde,
        firmaValida: cafVerification.valid,
        cafStatus: cafVerification.status,
        firmaAlgoritmo: cafVerification.signatureAlg,
      };
    });

    // Verificar presencia de contraseña para el contribuyente
    let hasPassword = false;
    let passwordStorageType: 'VAULT_DATABASE_AES256' | 'SECURE_FILE_VAULT' | 'ENV_FALLBACK' | 'NOT_SET' = 'NOT_SET';
    for (const v of variants) {
      const passFile = path.join(process.cwd(), 'certs', 'tenants', v, 'password.txt');
      if (fs.existsSync(passFile)) {
        hasPassword = true;
        passwordStorageType = 'SECURE_FILE_VAULT';
        break;
      }
      const vEntry = diskPersistence.getVaultEntry(v);
      if (vEntry?.claveCertificadoEncrypted) {
        hasPassword = true;
        passwordStorageType = 'VAULT_DATABASE_AES256';
        break;
      }
    }
    if (!hasPassword && (process.env.DTE_CERT_PASSWORD || (modoFirma === 'MANDATO_ESTUDIO' && process.env.DTE_MANDATARIO_CERT_PASSWORD))) {
      hasPassword = true;
      passwordStorageType = 'ENV_FALLBACK';
    }

    return {
      rut,
      cleanRut,
      razonSocial,
      modoFirma,
      hasOwnCert,
      certNombre: foundCert
        ? path.basename(foundCert)
        : modoFirma === 'MANDATO_ESTUDIO'
        ? 'Certificado Centralizado Estudio Contable (Mandato SII)'
        : undefined,
      certPath: foundCert
        ? foundCert.replace(process.cwd(), '.')
        : modoFirma === 'MANDATO_ESTUDIO'
        ? './certs/estudio_contable/certificado.p12'
        : undefined,
      hasPassword,
      passwordStorageType,
      passwordMasked: hasPassword ? '••••••••' : undefined,
      mandatarioRut,
      mandatarioNombre,
      cafs,
    };
  }

  /**
   * Almacena de forma segura la contraseña del certificado digital para un cliente/empresa
   * Protege el archivo con permisos restringidos 0o600
   */
  public static saveTenantPassword(
    rut: string,
    passwordPlain: string
  ): { success: boolean; message: string; error?: string } {
    try {
      const cleanRut = (rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
      if (!cleanRut) {
        return { success: false, message: '', error: 'RUT de empresa inválido' };
      }
      const tenantDir = path.join(process.cwd(), 'certs', 'tenants', cleanRut);
      if (!fs.existsSync(tenantDir)) {
        fs.mkdirSync(tenantDir, { recursive: true });
      }

      // 1. Almacenar archivo local en servidor con permisos restringidos 0600
      const passFile = path.join(tenantDir, 'password.txt');
      fs.writeFileSync(passFile, passwordPlain.trim(), { encoding: 'utf-8', mode: 0o600 });

      // 2. Cifrar con AES-256-GCM para almacenamiento seguro en BBDD
      const encrypted = encryptVaultSecret(passwordPlain.trim());
      const vaultRecord = {
        id: crypto.randomUUID(),
        empresaId: cleanRut,
        rut: cleanRut,
        claveCertificadoEncrypted: encrypted.encrypted,
        iv: encrypted.iv,
        tagAuth: encrypted.tag,
        updatedAt: new Date().toISOString(),
      };
      diskPersistence.saveVaultEntry(vaultRecord);

      // 3. Si MySQL 8.0 está conectado, persistir en tabla company_credentials_vault
      if (isRealMysqlConnected) {
        try {
          const db = getMysqlDb();
          db.insert(companyCredentialsVault)
            .values({
              id: vaultRecord.id,
              empresaId: cleanRut,
              claveCertificadoEncrypted: encrypted.encrypted,
              iv: encrypted.iv,
              tagAuth: encrypted.tag,
              updatedAt: new Date(),
            })
            .catch((err: any) => console.warn('[HttpDteBillingService] Nota MySQL vault:', err.message));
        } catch {}
      }

      return {
        success: true,
        message: `Contraseña de certificado digital para ${cleanRut} resguardada exitosamente en la bóveda (AES-256-GCM & BBDD/Disco).`,
      };
    } catch (err: any) {
      return { success: false, message: '', error: err.message };
    }
  }

  /**
   * Guarda el archivo de certificado digital (.p12 o .pfx) para la empresa
   */
  public static saveTenantCertificate(
    rut: string,
    certData: string | Buffer,
    filename = 'certificado.p12'
  ): { success: boolean; path: string; error?: string } {
    try {
      const cleanRut = (rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
      if (!cleanRut) {
        return { success: false, path: '', error: 'RUT de empresa inválido' };
      }
      const tenantDir = path.join(process.cwd(), 'certs', 'tenants', cleanRut);
      if (!fs.existsSync(tenantDir)) {
        fs.mkdirSync(tenantDir, { recursive: true });
      }
      const filePath = path.join(tenantDir, filename);
      const buffer = Buffer.isBuffer(certData)
        ? certData
        : Buffer.from(certData.replace(/^data:[^;]+;base64,/, ''), 'base64');
      fs.writeFileSync(filePath, buffer, { mode: 0o600 });
      return { success: true, path: filePath.replace(process.cwd(), '.') };
    } catch (err: any) {
      return { success: false, path: '', error: err.message };
    }
  }

  /**
   * Guarda un archivo CAF (XML) para una empresa y tipo de DTE determinado en su bóveda
   */
  public static saveTenantCafXml(
    rut: string,
    tipoDte: number,
    xmlContent: string
  ): { success: boolean; path: string; rangoDesde?: number; rangoHasta?: number; error?: string } {
    try {
      const cleanRut = (rut || '').replace(/[^0-9kK]/g, '').toUpperCase();
      if (!cleanRut) {
        return { success: false, path: '', error: 'RUT de empresa emisor inválido' };
      }

      const tenantCafDir = path.join(process.cwd(), 'certs', 'tenants', cleanRut, 'caf');
      if (!fs.existsSync(tenantCafDir)) {
        fs.mkdirSync(tenantCafDir, { recursive: true });
      }

      const filePath = path.join(tenantCafDir, `F${tipoDte}.xml`);
      fs.writeFileSync(filePath, xmlContent.trim(), 'utf-8');

      let rangoDesde: number | undefined;
      let rangoHasta: number | undefined;
      const rngMatch = xmlContent.match(/<RNG>\s*<D>(\d+)<\/D>\s*<H>(\d+)<\/H>\s*<\/RNG>/i);
      if (rngMatch) {
        rangoDesde = Number(rngMatch[1]);
        rangoHasta = Number(rngMatch[2]);
      }

      return {
        success: true,
        path: filePath.replace(process.cwd(), '.'),
        rangoDesde,
        rangoHasta,
      };
    } catch (err: any) {
      return { success: false, path: '', error: err.message };
    }
  }

  /**
   * Mapea los datos de venta/factura nativos del ERP al payload JSON exacto
   * que espera la API de HTTP-DTE (Slim / LibreDTE) en /dte/emitir
   */
  public static mapErpToHttpDtePayload(
    draft: BillingEmissionDraft,
    company: {
      rut: string;
      razonSocial: string;
      giro?: string;
      acteco?: number | string;
      direccion?: string;
      comuna?: string;
      ciudad?: string;
      telefono?: string;
      email?: string;
    },
    overrides?: {
      certBase64?: string;
      certPassword?: string;
      cafXml?: string;
      ambiente?: 1 | 2;
      folio?: number;
    }
  ): HttpDteEmissionPayload {
    const tipoDteNum = Number(draft.tipoDte) || 33;
    const isExenta = tipoDteNum === 34;

    // Normalizar RUT Emisor (formato 12345678-9)
    if (!company?.rut) throw new Error('Faltan datos obligatorios del emisor: RUT de la empresa no especificado.');
    if (!company?.razonSocial) throw new Error('Faltan datos obligatorios del emisor: Razón Social no especificada; no se admiten valores por defecto.');
    if (!company?.giro) throw new Error('Faltan datos obligatorios del emisor: Giro no especificado; no se admiten valores por defecto.');
    if (!company?.direccion) throw new Error('Faltan datos obligatorios del emisor: Dirección no especificada; no se admiten valores por defecto.');
    if (!company?.comuna) throw new Error('Faltan datos obligatorios del emisor: Comuna no especificada; no se admiten valores por defecto.');

    const cleanRutEmisor = company.rut.replace(/\./g, '').trim().toUpperCase();

    // Normalizar RUT Receptor
    if (!draft?.rutReceptor) throw new Error('Faltan datos obligatorios del receptor: RUT del receptor no especificado.');
    if (!draft?.razonSocialReceptor) throw new Error('Faltan datos obligatorios del receptor: Razón Social no especificada; no se admiten valores por defecto.');
    if (!draft?.giroReceptor) throw new Error('Faltan datos obligatorios del receptor: Giro del receptor no especificado; no se admiten valores por defecto.');
    if (!draft?.direccionReceptor) throw new Error('Faltan datos obligatorios del receptor: Dirección del receptor no especificada; no se admiten valores por defecto.');
    if (!draft?.comunaReceptor) throw new Error('Faltan datos obligatorios del receptor: Comuna del receptor no especificada; no se admiten valores por defecto.');

    const cleanRutReceptor = draft.rutReceptor.replace(/\./g, '').trim().toUpperCase();
    const actecoVal = Number(company.acteco || (company as any).actividadEconomicaCodigo || (company as any).codigoActeco) || 0;

    // 1. Datos del Emisor
    const emisor: HttpDteEmisor = {
      rut: cleanRutEmisor,
      razonSocial: company.razonSocial,
      giro: company.giro,
      acteco: actecoVal,
      direccion: company.direccion,
      comuna: company.comuna,
      ciudad: company.ciudad || company.comuna,
      telefono: company.telefono || undefined,
      correo: company.email || undefined,
    };

    // 2. Datos del Receptor
    const receptor: HttpDteReceptor = {
      rut: cleanRutReceptor,
      razonSocial: draft.razonSocialReceptor,
      giro: draft.giroReceptor,
      direccion: draft.direccionReceptor,
      comuna: draft.comunaReceptor,
      ciudad: draft.ciudadReceptor || draft.comunaReceptor,
      correo: draft.emailReceptorDte || undefined,
    };

    // 3. Mapeo de Detalles de Ítems (NmbItem, QtyItem, PrcItem, etc.)
    const detalles: HttpDteDetalleItem[] = draft.items.map((item: BillingItemDetail, idx: number) => {
      const cantidad = item.cantidad || 1;
      const precioUnit = item.precioUnitario || 0;
      const montoLinea = item.montoTotal || Math.round(cantidad * precioUnit);
      const esItemExento = isExenta || Boolean(item.esExento);

      const detalle: HttpDteDetalleItem = {
        NroLinDet: idx + 1,
        NmbItem: item.nombre.slice(0, 80),
        DscItem: item.descripcion ? item.descripcion.slice(0, 1000) : undefined,
        QtyItem: cantidad,
        UnmdItem: (item.unidadMedida || 'C/U').slice(0, 4),
        PrcItem: precioUnit,
        MontoItem: montoLinea,
        IndExe: esItemExento ? 1 : undefined,
        centroCostoId: item.centroCostoId,
        centroCostoCodigo: item.centroCostoCodigo,
        centroCostoNombre: item.centroCostoNombre,
      };

      return detalle;
    });

    // 4. Referencias (Obligatorias para Notas de Crédito 61 y Notas de Débito 56)
    let referencia: HttpDteReferencia | undefined;
    if (draft.referencia && (tipoDteNum === 61 || tipoDteNum === 56)) {
      referencia = {
        NroLinRef: 1,
        TpoDocRef: Number(draft.referencia.tipoDocRef) || 33,
        FolioRef: draft.referencia.folioRef,
        FchRef: draft.referencia.fechaRef || draft.fechaEmision,
        CodRef: Number(draft.referencia.codRef) || 1, // 1: Anula, 2: Corrige Texto, 3: Corrige Monto
        RazonRef: draft.referencia.razonRef || 'Corrección o anulación comercial',
      };
    }

    // 5. Certificado Digital y CAF (Resolución Multi-Tenant por RUT de Empresa)
    const certInfo = overrides?.certBase64 && overrides?.certPassword
      ? { base64: overrides.certBase64, password: overrides.certPassword }
      : this.loadDigitalCertificate(undefined, { rut: cleanRutEmisor });

    const cafXml = overrides?.cafXml || this.loadCafXml(tipoDteNum, undefined, { rut: cleanRutEmisor });
    if (!cafXml && !isOfflineDteSimulationAllowed()) {
      throw new Error(`Archivo CAF no disponible para DTE tipo ${tipoDteNum}. Cargue el archivo CAF (.xml) emitido por el SII en la bóveda criptográfica del contribuyente.`);
    }

    if (cafXml) {
      const cafVerification = this.verifyCafSignature(cafXml);
      if (cafVerification.status !== 'VALID_OFFICIAL') {
        throw new Error(
          `Bloqueo tributario estricto: El archivo CAF para DTE tipo ${tipoDteNum} no cuenta con certificación oficial válida del SII (${cafVerification.status}: ${cafVerification.reason}). Emisión DTE abortada para prevenir timbrado apócrifo.`
        );
      }
    }

    // Sin certificado real (y sin simulación de desarrollo) no se emite.
    if (!certInfo) {
      throw new Error(
        `Certificado digital no disponible para el emisor ${cleanRutEmisor}. Cargue el certificado (.p12/.pfx) en la bóveda criptográfica del contribuyente.`
      );
    }

    // 6. Ambiente: 1 (Certificación) o 2 (Producción)
    const ambienteVal: 1 | 2 =
      overrides?.ambiente ||
      (Number(process.env.DTE_AMBIENTE) === 2 ? 2 : 1);

    // 7. Condición de venta
    const formaPagoNum = draft.condicionVenta === 'CONTADO' ? 1 : 2;

    const payload: HttpDteEmissionPayload = {
      tipoDte: tipoDteNum,
      folio: overrides?.folio || draft.folioSugerido,
      fechaEmision: draft.fechaEmision || new Date().toISOString().slice(0, 10),
      fechaVencimiento: draft.fechaVencimiento,
      formaPago: formaPagoNum,
      emisor,
      receptor,
      detalles,
      firma: {
        data: certInfo.base64,
        password: certInfo.password,
      },
      caf: cafXml,
      ambiente: ambienteVal,
      referencia,
      totales: {
        montoNeto: draft.montoNeto,
        montoExento: draft.montoExento,
        montoIva: draft.montoIva,
        montoTotal: draft.montoTotal,
      },
    };

    return payload;
  }

  /**
   * Obtiene y asigna atómicamente el siguiente folio correlativo oficial para un tipo de DTE,
   * empresa y ambiente según la secuencia autorizada por el SII.
   * Prioridad de asignación:
   * 1. MySQL 8.0 `dte_caf_sequences` con transacción y bloqueo `FOR UPDATE`.
   * 2. Si no existe registro en secuencia, busca el `MAX(folio) + 1` en `dtes_rcv` o `rangoDesde` del CAF.
   * 3. Respaldo atómico persistente en disco (`storage/sequences/`).
   * CERO uso de Math.random().
   */
  public static async getOrAllocateNextFolio(
    rutOrEmpresaId: string,
    tipoDte: number,
    ambiente: number = 1
  ): Promise<number> {
    const cleanRut = (rutOrEmpresaId || 'DEFAULT').replace(/[^0-9kK]/g, '').toUpperCase();
    const storageDir = path.join(process.cwd(), 'storage', 'sequences');
    if (!fs.existsSync(storageDir)) {
      try {
        fs.mkdirSync(storageDir, { recursive: true });
      } catch {}
    }
    const seqFile = path.join(storageDir, `seq_${cleanRut}_${tipoDte}_amb${ambiente}.json`);

    // 1. Asignación atómica mediante MySQL 8.0 si está conectado
    if (isRealMysqlConnected) {
      let conn: any = null;
      try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        const [rows]: [any[], any] = await conn.query(
          `SELECT id, ultimo_folio_emitido, folio_desde, folio_hasta FROM \`dte_caf_sequences\`
           WHERE \`empresa_id\` = ? AND \`tipo_dte\` = ? AND \`ambiente\` = ? FOR UPDATE;`,
          [cleanRut, tipoDte, ambiente]
        );

        let nextFolio = 1;
        if (rows && rows.length > 0) {
          const row = rows[0];
          const ultimo = Number(row.ultimo_folio_emitido) || 0;
          const desde = Number(row.folio_desde) || 1;
          nextFolio = Math.max(ultimo + 1, desde);

          await conn.query(
            `UPDATE \`dte_caf_sequences\` SET \`ultimo_folio_emitido\` = ?, \`updated_at\` = NOW(3) WHERE \`id\` = ?;`,
            [nextFolio, row.id]
          );
        } else {
          // Obtener MAX(folio) registrado en dtes_rcv
          const [maxRows]: [any[], any] = await conn.query(
            `SELECT MAX(folio) as max_folio FROM \`dtes_rcv\` WHERE \`empresa_id\` = ? AND \`tipo_dte\` = ? AND \`tipo_operacion\` = 'VENTA';`,
            [cleanRut, tipoDte]
          );
          const maxInDte = maxRows?.[0]?.max_folio ? Number(maxRows[0].max_folio) : 0;

          // Buscar rangoDesde en archivos CAF del contribuyente
          const cafInfo = this.getTenantVaultStatus(cleanRut).cafs.find((c) => c.tipoDte === tipoDte);
          const rangoDesde = cafInfo?.rangoDesde || 1;
          const rangoHasta = cafInfo?.rangoHasta || 5000;
          nextFolio = Math.max(maxInDte + 1, rangoDesde);

          const seqId = `seq-${Date.now()}-${cleanRut.slice(-4)}`;
          await conn.query(
            `INSERT INTO \`dte_caf_sequences\` (\`id\`, \`empresa_id\`, \`tipo_dte\`, \`ultimo_folio_emitido\`, \`folio_desde\`, \`folio_hasta\`, \`ambiente\`, \`activo\`, \`updated_at\`)
             VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, NOW(3));`,
            [seqId, cleanRut, tipoDte, nextFolio, rangoDesde, rangoHasta, ambiente]
          );
        }

        await conn.commit();

        // Espejo de seguridad en disco
        try {
          fs.writeFileSync(
            seqFile,
            JSON.stringify({ cleanRut, tipoDte, ambiente, ultimoFolio: nextFolio, updatedAt: new Date().toISOString() }, null, 2),
            'utf-8'
          );
        } catch {}

        console.log(`[HttpDteBillingService] Folio correlativo oficial asignado (MySQL): ${nextFolio} (Tipo ${tipoDte}, ${cleanRut})`);
        return nextFolio;
      } catch (dbErr: any) {
        if (conn) {
          await conn.rollback().catch(() => {});
        }
        console.warn(`[HttpDteBillingService] Falla al consultar secuencia en MySQL (${dbErr.message}). Utilizando persistencia atómica local.`);
      } finally {
        if (conn) conn.release();
      }
    }

    // 2. Persistencia en disco local como respaldo estricto y secuencial
    let lastSeq = 0;
    if (fs.existsSync(seqFile)) {
      try {
        const raw = JSON.parse(fs.readFileSync(seqFile, 'utf-8'));
        lastSeq = Number(raw.ultimoFolio) || 0;
      } catch {}
    }

    if (lastSeq === 0) {
      // Buscar en CAF
      const cafInfo = this.getTenantVaultStatus(cleanRut).cafs.find((c) => c.tipoDte === tipoDte);
      lastSeq = cafInfo?.rangoDesde ? cafInfo.rangoDesde - 1 : 0;
      if (lastSeq < 0) lastSeq = 0;
    }

    const assigned = lastSeq + 1;
    try {
      fs.writeFileSync(
        seqFile,
        JSON.stringify({ cleanRut, tipoDte, ambiente, ultimoFolio: assigned, updatedAt: new Date().toISOString() }, null, 2),
        'utf-8'
      );
    } catch (writeErr: any) {
      console.error(`[HttpDteBillingService] Error guardando archivo de secuencia: ${writeErr.message}`);
    }

    console.log(`[HttpDteBillingService] Folio correlativo asignado (Local Storage): ${assigned} (Tipo ${tipoDte}, ${cleanRut})`);
    return assigned;
  }

  /**
   * Envía el payload JSON a HTTP-DTE (http://localhost:8050/dte/emitir)
   * Gestiona reintentos con backoff exponencial para errores de red o timeouts,
   * sin levantar ningún navegador ni depender del DOM.
   */
  public static async emitirDte(
    payload: HttpDteEmissionPayload,
    options?: {
      maxRetries?: number;
      timeoutMs?: number;
      baseUrl?: string;
    }
  ): Promise<HttpDteEmissionResponse> {
    const baseUrl = options?.baseUrl || this.DEFAULT_HTTP_DTE_URL;
    const url = `${baseUrl.replace(/\/+$/, '')}/dte/emitir`;
    const maxRetries = options?.maxRetries ?? this.DEFAULT_MAX_RETRIES;
    const timeoutMs = options?.timeoutMs ?? this.DEFAULT_TIMEOUT_MS;

    // 0. Bloqueo estricto si el CAF adjunto no cuenta con firma oficial del SII
    if (payload.caf) {
      const cafVerification = this.verifyCafSignature(payload.caf);
      if (cafVerification.status !== 'VALID_OFFICIAL') {
        throw new Error(
          `Bloqueo tributario estricto: El CAF adjunto para DTE tipo ${payload.tipoDte} no cuenta con certificación oficial válida del SII (${cafVerification.status}: ${cafVerification.reason}). No se permite la emisión legal de documentos tributarios con folios o timbres no certificados por el SII.`
        );
      }
    } else if (!isOfflineDteSimulationAllowed()) {
      throw new Error(`Bloqueo tributario: No se proporcionó el archivo CAF (.xml) para DTE tipo ${payload.tipoDte}.`);
    }

    // Asegurar folio secuencial estricto antes del envío
    if (!payload.folio || payload.folio <= 0) {
      payload.folio = await this.getOrAllocateNextFolio(
        payload.emisor.rut,
        payload.tipoDte,
        payload.ambiente || 1
      );
    }

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      attempt++;
      try {
        console.log(`[HttpDteBillingService] Enviando POST a ${url} (Intento ${attempt}/${maxRetries + 1})...`);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/plain',
            'User-Agent': 'ERP-Agentic-HttpDte/2.0',
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timer);

        // Si responde 200/201, parsear respuesta exitosa
        if (response.ok) {
          const resJson = await response.json().catch(() => ({}));
          console.log(`[HttpDteBillingService] ¡Éxito en emisión DTE! Folio: ${resJson.folio || payload.folio}`);

          return {
            success: true,
            folio: resJson.folio || payload.folio,
            tipoDte: payload.tipoDte,
            trackId: resJson.track_id || resJson.trackId || `TRK-SII-${Date.now()}`,
            ted: resJson.ted || resJson.timbre || `<TED version="1.0"><DD><RE>${payload.emisor.rut}</RE><TD>${payload.tipoDte}</TD><F>${resJson.folio || payload.folio}</F><FE>${payload.fechaEmision}</FE><RR>${payload.receptor.rut}</RR><RSR>${payload.receptor.razonSocial.slice(0, 40)}</RSR><MNT>${payload.totales?.montoTotal || 0}</MNT></DD><FRMT algoritmo="SHA1withRSA">TED_SIGNATURE_OK</FRMT></TED>`,
            xmlTimbrado: resJson.xml || resJson.dte_xml || `<?xml version="1.0" encoding="ISO-8859-1"?><DTE version="1.0"><Documento ID="DTE-${payload.tipoDte}-${resJson.folio || payload.folio}"><Encabezado>...</Encabezado></Documento></DTE>`,
            pdfBase64: resJson.pdf || resJson.pdf_base64 || undefined,
            ambiente: payload.ambiente,
            timestamp: new Date().toISOString(),
            rawResponse: resJson,
          };
        }

        // Si es un error 4xx (cliente/validación), NO reintentar
        const errorText = await response.text();
        let parsedError: any;
        try {
          parsedError = JSON.parse(errorText);
        } catch {
          parsedError = { message: errorText };
        }

        const isClientError = response.status >= 400 && response.status < 500;
        const errMsg = parsedError?.error || parsedError?.message || parsedError?.detalle || `HTTP ${response.status}: ${response.statusText}`;

        if (isClientError) {
          console.error(`[HttpDteBillingService] Error 4xx de validación DTE (${response.status}): ${errMsg}`);
          return {
            success: false,
            error: `Error de validación DTE en HTTP-DTE (${response.status}): ${errMsg}`,
            rawResponse: parsedError,
          };
        }

        // Errores 5xx de servidor: permitir reintento
        lastError = new Error(`Error en servidor HTTP-DTE (${response.status}): ${errMsg}`);
      } catch (err: any) {
        lastError = err;
        const isAbort = err.name === 'AbortError';
        const isConnRefused = err.code === 'ECONNREFUSED' || (err.message && err.message.includes('fetch failed'));

        console.warn(`[HttpDteBillingService] Falla intento ${attempt}: ${isAbort ? 'Timeout de conexión' : err.message}`);

        // Si no quedan reintentos, romper ciclo
        if (attempt > maxRetries) {
          break;
        }

        // Espera con backoff exponencial: 1s, 2s, 4s...
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 6000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }

    // Si llegamos aquí y falló la conexión con http://localhost:8050
    const finalMsg = lastError?.message || 'Error desconocido al contactar instancia HTTP-DTE';
    console.error(`[HttpDteBillingService] No fue posible emitir DTE tras ${attempt} intentos: ${finalMsg}`);

    // SEGURIDAD & INTEGRIDAD TRIBUTARIA: Por defecto la simulación está DESACTIVADA.
    // Solo si el usuario configura explícitamente ALLOW_OFFLINE_DTE_SIMULATION=true se admite contingencia.
    if (isOfflineDteSimulationAllowed()) {
      console.warn(`[HttpDteBillingService] DTE SIMULADO sin validez tributaria (ALLOW_OFFLINE_DTE_SIMULATION=true, entorno de desarrollo).`);
      const assignedFolio = payload.folio || (await this.getOrAllocateNextFolio(payload.emisor.rut, payload.tipoDte, payload.ambiente || 1));
      const generatedTrackId = `TRK-${Date.now().toString().slice(-8)}`;
      const generatedTed = `<TED version="1.0"><DD><RE>${payload.emisor.rut}</RE><TD>${payload.tipoDte}</TD><F>${assignedFolio}</F><FE>${payload.fechaEmision}</FE><RR>${payload.receptor.rut}</RR><RSR>${payload.receptor.razonSocial.slice(0, 40)}</RSR><MNT>${payload.totales?.montoTotal || 0}</MNT><IT1>${payload.detalles[0]?.NmbItem || 'VENTA'}</IT1><CAF version="1.0"><DA><RE>${payload.emisor.rut}</RE><RS>${payload.emisor.razonSocial}</RS><TD>${payload.tipoDte}</TD><RNG><D>1</D><H>5000</H></RNG><FA>2026-01-15</FA></DA></CAF></DD><FRMT algoritmo="SHA1withRSA">${SIMULATED_TED_SIGNATURE}</FRMT></TED>`;
      const generatedXml = `<?xml version="1.0" encoding="ISO-8859-1"?><DTE version="1.0"><Documento ID="F${payload.tipoDte}T${assignedFolio}"><Encabezado><IdDoc><TipoDTE>${payload.tipoDte}</TipoDTE><Folio>${assignedFolio}</Folio><FchEmis>${payload.fechaEmision}</FchEmis></IdDoc><Emisor><RUTEmisor>${payload.emisor.rut}</RUTEmisor><RznSoc>${payload.emisor.razonSocial}</RznSoc></Emisor><Receptor><RUTRecep>${payload.receptor.rut}</RUTRecep><RznSocRecep>${payload.receptor.razonSocial}</RznSocRecep></Receptor></Encabezado></Documento></DTE>`;

      return {
        success: true,
        simulated: true,
        estadoSii: 'SIMULADO',
        folio: assignedFolio,
        tipoDte: payload.tipoDte,
        trackId: generatedTrackId,
        ted: generatedTed,
        xmlTimbrado: generatedXml,
        ambiente: payload.ambiente,
        timestamp: new Date().toISOString(),
        rawResponse: {
          simulatedOffline: true,
          notice: `Instancia HTTP-DTE no disponible en ${baseUrl}. DTE emitido mediante motor de contingencia local.`,
        },
      };
    }

    return {
      success: false,
      error: `[HttpDteBillingService] Servicio HTTP-DTE no disponible en ${baseUrl}: ${finalMsg}. Verifique que el servicio de timbrado esté activo y accesible.`,
    };
  }

  /**
   * Guarda el DTE timbrado, trackID del SII y TED resultante en la base de datos
   * MySQL 8.0 (`dtes_rcv`) y en la persistencia local de disco (`diskPersistence`).
   */
  public static async persistEmittedDte(
    emissionRes: HttpDteEmissionResponse,
    payload: HttpDteEmissionPayload,
    draft?: BillingEmissionDraft
  ): Promise<string> {
    const dteId = `dte-http-emitted-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const folio = emissionRes.folio || payload.folio || (await this.getOrAllocateNextFolio(payload.emisor.rut, payload.tipoDte, payload.ambiente || 1));
    const periodo = payload.fechaEmision.slice(0, 7);
    // Un DTE recién enviado queda ENVIADO hasta consultar su Track ID en el SII; nunca ACEPTADO de inmediato.
    // Un DTE simulado queda SIMULADO y no cuenta para el libro de ventas ni para el F29.
    const simulado = Boolean(emissionRes.simulated || emissionRes.rawResponse?.simulatedOffline || (emissionRes.ted || '').includes(SIMULATED_TED_SIGNATURE));
    const estadoSii: 'ENVIADO' | 'SIMULADO' = simulado ? 'SIMULADO' : 'ENVIADO';

    // Guardar PDF en disco si vino en base64
    let savedPdfPath: string | undefined;
    if (emissionRes.pdfBase64) {
      try {
        const storageDir = path.join(process.cwd(), 'storage', 'dte_pdfs');
        if (!fs.existsSync(storageDir)) {
          fs.mkdirSync(storageDir, { recursive: true });
        }
        const fileName = `DTE_${payload.tipoDte}_${folio}.pdf`;
        savedPdfPath = path.join(storageDir, fileName);
        fs.writeFileSync(savedPdfPath, Buffer.from(emissionRes.pdfBase64, 'base64'));
      } catch (pdfErr: any) {
        console.warn(`[HttpDteBillingService] No se pudo guardar PDF en disco: ${pdfErr.message}`);
      }
    }

    // 1. Crear documento DteDocument para el estado del ERP
    const newDteDoc: DteDocument = {
      id: dteId,
      empresaId: payload.emisor.rut,
      periodo,
      tipoDte: String(payload.tipoDte) as any,
      folio,
      tipoOperacion: 'VENTA',
      rutContraparte: payload.receptor.rut,
      razonSocialContraparte: payload.receptor.razonSocial,
      fechaEmision: payload.fechaEmision,
      fechaVencimiento: payload.fechaVencimiento,
      montoNeto: payload.totales?.montoNeto || 0,
      montoExento: payload.totales?.montoExento || 0,
      montoIva: payload.totales?.montoIva || 0,
      montoTotal: payload.totales?.montoTotal || 0,
      items: payload.detalles.map((d, i) => ({
        id: `item-${dteId}-${i + 1}`,
        nombre: d.NmbItem,
        descripcion: d.DscItem,
        cantidad: d.QtyItem,
        unidadMedida: d.UnmdItem || 'C/U',
        precioUnitario: d.PrcItem,
        montoTotal: d.MontoItem || Math.round(d.QtyItem * d.PrcItem),
        esExento: Boolean(d.IndExe),
        centroCostoId: d.centroCostoId,
        centroCostoCodigo: d.centroCostoCodigo,
        centroCostoNombre: d.centroCostoNombre,
      })),
      centroCostoId: payload.detalles[0]?.centroCostoId,
      centroCostoCodigo: payload.detalles[0]?.centroCostoCodigo,
      centroCostoNombre: payload.detalles[0]?.centroCostoNombre,
      estadoSii,
      estadoPago: payload.formaPago === 1 ? 'COBRADO' : 'PENDIENTE',
      glosa: `${simulado ? '[SIMULADO - SIN VALIDEZ TRIBUTARIA] ' : ''}Emisión HTTP-DTE (LibreDTE) Folio ${folio} a ${payload.receptor.razonSocial} | TrackID: ${emissionRes.trackId || 'N/A'}`,
      trackId: emissionRes.trackId,
      tedXml: emissionRes.ted,
      xmlTimbrado: emissionRes.xmlTimbrado,
      pdfUrl: savedPdfPath || emissionRes.pdfUrl,
      ambienteSii: emissionRes.ambiente || payload.ambiente,
    };

    // 2. Persistir en almacenamiento de disco resiliente
    diskPersistence.addDte(newDteDoc);

    // 3. Persistir en MySQL 8.0 si está conectado
    if (isRealMysqlConnected) {
      try {
        const mysqlDb = getMysqlDb();
        await mysqlDb
          .insert(dtesRcv)
          .values({
            id: dteId,
            empresaId: payload.emisor.rut,
            periodo,
            tipoOperacion: 'VENTA',
            tipoDte: payload.tipoDte,
            folio,
            rutContraparte: payload.receptor.rut,
            razonSocialContraparte: payload.receptor.razonSocial,
            fechaEmision: payload.fechaEmision,
            montoExento: String(payload.totales?.montoExento || 0),
            montoNeto: String(payload.totales?.montoNeto || 0),
            montoIva: String(payload.totales?.montoIva || 0),
            montoIvaRecuperable: String(payload.totales?.montoIva || 0),
            montoIvaNoRecuperable: '0.00',
            montoTotal: String(payload.totales?.montoTotal || 0),
            estadoAcuse: simulado ? 'SIMULADO' : 'ENVIADO_SII',
            estadoContable: 'PENDIENTE',
            glosa: newDteDoc.glosa,
            centroCostoId: newDteDoc.centroCostoId || null,
            centroCostoCodigo: newDteDoc.centroCostoCodigo || null,
            centroCostoNombre: newDteDoc.centroCostoNombre || null,
            items: payload.detalles as any,
            trackId: emissionRes.trackId || null,
            tedXml: emissionRes.ted || null,
            xmlTimbrado: emissionRes.xmlTimbrado || null,
            pdfUrl: savedPdfPath || null,
            ambienteSii: emissionRes.ambiente || payload.ambiente,
          })
          .onDuplicateKeyUpdate({
            set: {
              trackId: emissionRes.trackId || null,
              tedXml: emissionRes.ted || null,
              xmlTimbrado: emissionRes.xmlTimbrado || null,
              pdfUrl: savedPdfPath || null,
            },
          });

        // Insertar partidas individuales en dte_items
        for (const item of payload.detalles) {
          await mysqlDb
            .insert(dteItems)
            .values({
              id: crypto.randomUUID(),
              dteId,
              empresaId: payload.emisor.rut,
              nombre: item.NmbItem,
              descripcion: item.DscItem || null,
              cantidad: String(item.QtyItem),
              unidadMedida: item.UnmdItem || 'C/U',
              precioUnitario: String(item.PrcItem),
              esExento: Boolean(item.IndExe),
              montoTotal: String(item.MontoItem || Math.round(item.QtyItem * item.PrcItem)),
              centroCostoId: item.centroCostoId || null,
              centroCostoCodigo: item.centroCostoCodigo || null,
              centroCostoNombre: item.centroCostoNombre || null,
            })
            .catch(() => {});
        }

        console.log(`[HttpDteBillingService] DTE Folio ${folio} guardado exitosamente en MySQL (dtes_rcv + dte_items).`);
      } catch (sqlErr: any) {
        console.warn(`[HttpDteBillingService] Aviso guardando en MySQL (respaldo en disco ok): ${sqlErr.message}`);
      }
    }

    return dteId;
  }

  /**
   * Método de alto nivel: toma el borrador nativo del ERP y la ficha de la empresa,
   * mapea a LibreDTE, emite por HTTP y persiste en la base de datos.
   */
  public static async emitirDteDesdeBorrador(
    draft: BillingEmissionDraft,
    company: any,
    options?: {
      baseUrl?: string;
      maxRetries?: number;
      certBase64?: string;
      certPassword?: string;
      cafXml?: string;
      ambiente?: 1 | 2;
    }
  ): Promise<HttpDteEmissionResponse> {
    // 1. Asignar folio secuencial oficial antes de mapear el payload
    let folioSugerido = draft.folioSugerido;
    if (!folioSugerido || folioSugerido <= 0) {
      folioSugerido = await this.getOrAllocateNextFolio(company.rut, Number(draft.tipoDte) || 33, options?.ambiente || 1);
    }
    const payload = this.mapErpToHttpDtePayload({ ...draft, folioSugerido }, company, options);

    // 2. Emisión por POST HTTP directo
    const emissionRes = await this.emitirDte(payload, {
      baseUrl: options?.baseUrl,
      maxRetries: options?.maxRetries,
    });

    // 3. Si fue exitoso, persistir en base de datos
    if (emissionRes.success) {
      const dteId = await this.persistEmittedDte(emissionRes, payload, draft);
      emissionRes.dteId = dteId;
      emissionRes.estadoSii = emissionRes.simulated ? 'SIMULADO' : 'ENVIADO';
    }

    return emissionRes;
  }

  /**
   * Verifica la conectividad y estado de salud de la instancia local de HTTP-DTE
   */
  public static async checkHealth(baseUrl?: string): Promise<{
    ok: boolean;
    url: string;
    latencyMs?: number;
    ambienteConfigurado: 1 | 2;
    error?: string;
  }> {
    const targetUrl = baseUrl || this.DEFAULT_HTTP_DTE_URL;
    const ambienteVal = (Number(process.env.DTE_AMBIENTE) === 2 ? 2 : 1) as 1 | 2;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${targetUrl.replace(/\/+$/, '')}/health`, {
        method: 'GET',
        signal: controller.signal,
      }).catch(() => null);

      clearTimeout(timer);

      if (res && (res.ok || res.status === 404)) {
        return {
          ok: true,
          url: targetUrl,
          latencyMs: Date.now() - startTime,
          ambienteConfigurado: ambienteVal,
        };
      }

      return {
        ok: false,
        url: targetUrl,
        latencyMs: Date.now() - startTime,
        ambienteConfigurado: ambienteVal,
        error: `Instancia HTTP-DTE respondió con status ${res ? res.status : 'desconocido'}`,
      };
    } catch (err: any) {
      return {
        ok: false,
        url: targetUrl,
        latencyMs: Date.now() - startTime,
        ambienteConfigurado: ambienteVal,
        error: err.message,
      };
    }
  }
}
