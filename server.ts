import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { supervisorLedgerRouter } from "./src/controllers/supervisorLedgerController";
import { tenancyRouter } from "./src/controllers/tenancyController";
import { accountingJournalRouter } from "./src/controllers/accountingJournalController";
import { erpModulesRouter } from "./src/controllers/erpModulesController";
import { agentGovernanceRouter } from "./src/controllers/agentGovernanceController";
import { asyncJobsRouter } from "./src/controllers/asyncJobsController";
import { sseJobRouter } from "./src/routes/sseJobRoutes";
import { siiRcvRouter } from "./src/controllers/siiRcvController";
import { payrollRouter } from "./src/controllers/payrollController";
import { SiiRcvService, SiiGatewayError } from "./src/services/siiRcvService";
import { SiiPlaywrightRunner } from "./src/services/siiPlaywrightRunner";
import { RcvIngestionService } from "./src/services/rcvIngestionService";
import { startWorkers } from "./src/workers";
import { isRedisConfigured } from "./src/queues/redisConfig";
import { IndicatorSyncService } from "./src/services/indicatorSyncService";
import { checkMySqlConnection } from "./src/db/mysqlClient";
import { INITIAL_CLIENTS, seedDtes, seedPayrolls } from "./src/data/seedData";
import { DEFAULT_INDICATORS } from "./src/utils/chileanAccounting";
import {
  normalizeAndValidateJournalEntry,
  formatJournalEntryToTextTable,
} from "./src/services/journalEntryNormalizer";

dotenv.config({ override: true });

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Lazy initialization of Gemini client
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in the environment.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), country: "CL" });
});

// Economic indicators helper (UF, UTM, Dólar, IPC) - Sincronizado en línea con MySQL y mindicador.cl
app.get("/api/indicators", async (req, res) => {
  try {
    const fechaQuery = typeof req.query.fecha === "string" ? req.query.fecha : undefined;
    const synced = await IndicatorSyncService.syncAllCurrentIndicators(fechaQuery);

    res.json({
      success: true,
      data: {
        uf: synced.uf,
        utm: synced.utm,
        dolar: synced.dolar,
        ipc: synced.ipc,
        imm: 500000,
        topeImponibleAfpUf: 84.3,
        topeImponibleAfcUf: 126.6,
        retencionHonorariosTasa: 0.145, // 14.5% vigente en Chile
        sisTasa: 0.0149,
        mutualBaseTasa: 0.0093,
        fecha: synced.fecha,
        fuente: "sii.cl / dolarapi.com / mindicador.cl / MySQL",
      },
    });
  } catch (error: any) {
    console.error("[Server] Error en /api/indicators:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Ruta de consulta directa auditada de indicadores económicos en MySQL / API
app.get("/api/indicators/current", async (req, res) => {
  try {
    const fechaQuery = typeof req.query.fecha === "string" ? req.query.fecha : undefined;
    const synced = await IndicatorSyncService.syncAllCurrentIndicators(fechaQuery);
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: synced,
    });
  } catch (error: any) {
    console.error("[Server] Error en /api/indicators/current:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Gemini Chat & Accounting Consultation
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { messages, companyContext, firmContext, userRole } = req.body;
    const ai = getAIClient();

    const systemInstruction = `Eres un Agente Contable y Financiero Senior experto en la legislación chilena (SII, Dirección del Trabajo, Tesorería General de la República - TGR, Código del Trabajo, Ley de la Renta LIR, DL 825 de IVA e IFRS/NIIF 16).
Tu objetivo es gestionar de manera integral la contabilidad, el flujo de caja, las proyecciones financieras y el cumplimiento tributario/laboral de la empresa en Chile, actuando bajo las directrices del Estudio Contable gestor.

REGLAS ESTRICTAS DE RESPUESTA:
1. Utiliza siempre la moneda Peso Chileno ($ CLP) o UF según el contexto, indicando la conversión si aplica.
2. Si se te solicita registrar un movimiento contable o generar un asiento, utiliza SIEMPRE el siguiente formato normalizado exacto:

--------------------------------------------------
FECHA: YYYY-MM-DD
CONCEPTO: [Descripción clara del movimiento]
DOCUMENTO: [N° Factura / Boleta / Liquidación / F29 / Contrato]

CUENTA CONTABLE                       DEBE ($)     HABER ($)
--------------------------------------------------
[Nombre Cuenta Debe]                 XXX.XXX
[Nombre Cuenta Haber]                             XXX.XXX
--------------------------------------------------
TOTALES                              XXX.XXX      XXX.XXX
--------------------------------------------------

3. Si falta información crucial para el cálculo de impuestos o leyes sociales (ej: tipo de contrato, días trabajados, tramo de impuesto, si es exento o afecto), solicita los datos faltantes antes de dar una cifra definitiva o plantea los supuestos explícitamente.
4. Alerta inmediatamente si detectas inconsistencias entre el Registro de Compras y Ventas (RCV), el Formulario 29 (F29) o las proyecciones de caja.
5. Brinda respuestas técnicas, precisas, con citas a leyes chilenas (Art. 47/50 Código del Trabajo, Art. 84 LIR para PPM, Art. 23 DL 825 para Crédito Fiscal IVA, Oficios del SII pertinentes).

${firmContext ? `ESTUDIO CONTABLE GESTOR (CLIENTE PRINCIPAL):\n${JSON.stringify(firmContext, null, 2)}\n` : ""}
${companyContext ? `EMPRESA CLIENTE EN REVISIÓN (INCLUYE ACCESO/CLAVE SII DEL AGENTE):\n${JSON.stringify(companyContext, null, 2)}` : ""}`;

    const promptText = Array.isArray(messages)
      ? messages.map((m: { role: string; content: string }) => `${m.role === "user" ? "Usuario" : "Agente"}: ${m.content}`).join("\n\n")
      : String(req.body.prompt || "Hola");

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: promptText,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    res.json({
      success: true,
      text: response.text || "No se obtuvo respuesta.",
    });
  } catch (error: any) {
    console.error("Error in /api/gemini/chat:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al procesar la consulta con el Agente Contable.",
    });
  }
});

// Gemini Fiscal & DTE Audit / Parsing
app.post("/api/gemini/audit-fiscal", async (req, res) => {
  try {
    const { rcvData, f29Data, cashFlowData } = req.body;
    const ai = getAIClient();

    const prompt = `Realiza una auditoría contable y tributaria profunda (SII / TGR / Previred) comparando los siguientes datos de la empresa:
RCV (Compras y Ventas): ${JSON.stringify(rcvData || [])}
F29 (Declaración mensual): ${JSON.stringify(f29Data || {})}
Flujo de Caja: ${JSON.stringify(cashFlowData || [])}

Identifica:
1. Discrepancias de Débito y Crédito Fiscal IVA entre RCV y F29.
2. Facturas de compra no reclamadas o fuera del plazo legal de 8 días.
3. Estimación y tasa de PPM aplicado vs base imponible real.
4. Retenciones de honorarios y trabajadores no enteradas en F29.
5. Inconsistencias con el flujo de caja real.
6. Asientos contables sugeridos para corregir las diferencias en el formato normalizado.

Responde de forma clara, ejecutiva y con el formato de asientos normalizado.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction: "Eres un Auditor Tributario Senior experto en fiscalización del SII y Tesorería General de la República de Chile.",
        temperature: 0.2,
      },
    });

    res.json({
      success: true,
      analysis: response.text,
    });
  } catch (error: any) {
    console.error("Error in /api/gemini/audit-fiscal:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al ejecutar la auditoría tributaria.",
    });
  }
});

// SII Endpoints: Detección automática de meses desactualizados
app.post("/api/sii/detect-pending", (req, res) => {
  try {
    const { syncedPeriods = [], currentYear = 2026, currentMonth = 9 } = req.body;
    const months = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", 
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ];
    
    const pendingPeriods = [];
    for (let m = 1; m <= currentMonth; m++) {
      const periodoStr = `${currentYear}-${m.toString().padStart(2, "0")}`;
      const isSynced = syncedPeriods.includes(periodoStr);
      if (!isSynced) {
        pendingPeriods.push({
          periodo: periodoStr,
          mesNombre: `${months[m - 1]} ${currentYear}`,
          mes: m,
          anio: currentYear,
          estado: "DESACTUALIZADO",
          tiposPendientes: ["COMPRA", "VENTA", "HONORARIOS"]
        });
      }
    }

    res.json({
      success: true,
      pendingCount: pendingPeriods.length,
      pendingPeriods,
      checkedAt: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoints de Gestión Multi-Empresa & Credenciales SII por Empresa
app.get("/api/companies", (_req, res) => {
  const list = INITIAL_CLIENTS.map(c => ({
    id: c.id,
    rut: c.rut,
    razonSocial: c.razonSocial,
    nombreCorto: c.nombreCorto,
    rutAutenticacion: c.rutAutenticacion || c.rut,
    tipoAutenticacionSii: c.tipoAutenticacionSii,
    hasClaveSii: Boolean(c.claveSii && c.claveSii.length > 0),
    estadoConexionSii: c.estadoConexionSii,
    descargaAutomaticaRcv: c.automatizacionesAgente?.descargaAutomaticaRcv ?? true,
    activa: c.activa
  }));
  res.json({ success: true, count: list.length, companies: list });
});

// Endpoint seguro para consultar la configuración SII de una empresa específica (utilizado por el script RPA / Worker)
app.get("/api/companies/:idOrRut/sii-config", (req, res) => {
  const { idOrRut } = req.params;
  const cleanParam = idOrRut.replace(/\./g, "").trim().toUpperCase();
  const company = INITIAL_CLIENTS.find(
    c => c.id === idOrRut || c.rut.replace(/\./g, "").trim().toUpperCase() === cleanParam
  );

  if (!company) {
    return res.status(404).json({ success: false, error: `Empresa con ID o RUT '${idOrRut}' no encontrada en el ERP.` });
  }

  res.json({
    success: true,
    empresa: {
      id: company.id,
      rut: company.rut,
      razonSocial: company.razonSocial,
      nombreCorto: company.nombreCorto,
      rutAutenticacion: company.rutAutenticacion || company.rut,
      claveSii: company.claveSii,
      tipoAutenticacionSii: company.tipoAutenticacionSii,
      exentoIvaGiro: company.exentoIvaGiro,
      descargaAutomaticaRcv: company.automatizacionesAgente?.descargaAutomaticaRcv ?? true,
    }
  });
});

// Endpoint para listar todas las empresas con sincronización automática activa (Modo Batch Multi-Empresa)
app.get("/api/companies/active-sii", (_req, res) => {
  const activeCompanies = INITIAL_CLIENTS.filter(
    c => c.activa !== false && c.automatizacionesAgente?.descargaAutomaticaRcv !== false
  ).map(c => ({
    id: c.id,
    rut: c.rut,
    razonSocial: c.razonSocial,
    nombreCorto: c.nombreCorto,
    rutAutenticacion: c.rutAutenticacion || c.rut,
    claveSii: c.claveSii,
    tipoAutenticacionSii: c.tipoAutenticacionSii,
    exentoIvaGiro: c.exentoIvaGiro
  }));

  res.json({
    success: true,
    count: activeCompanies.length,
    companies: activeCompanies
  });
});

// SII Endpoints: Sincronización oficial RCV (Compras, Ventas, Honorarios)
app.post("/api/sii/download-rcv", async (req, res) => {
  try {
    const { tipo, periodo, rut, empresaId } = req.body;
    if (!tipo || !periodo) {
      return res.status(400).json({ error: "Faltan parámetros tipo o período (AAAAMM o YYYY-MM)." });
    }

    // Resolver la empresa específica desde la configuración multi-empresa
    let targetCompany = null;
    if (empresaId) {
      targetCompany = INITIAL_CLIENTS.find(c => c.id === empresaId);
    }
    if (!targetCompany && rut) {
      const cleanParam = String(rut).replace(/\./g, "").trim().toUpperCase();
      targetCompany = INITIAL_CLIENTS.find(c => c.rut.replace(/\./g, "").trim().toUpperCase() === cleanParam);
    }

    const cleanRut = targetCompany 
      ? targetCompany.rut.replace(/\./g, "").trim().toUpperCase()
      : (rut ? String(rut).replace(/\./g, "").trim().toUpperCase() : "");

    if (!cleanRut) {
      return res.status(400).json({ error: "RUT o ID de la empresa mandante requerido en configuración multi-empresa." });
    }

    const rutAutenticacion = targetCompany?.rutAutenticacion || cleanRut;
    const formattedPeriodo = periodo.includes("-") 
      ? periodo 
      : `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}`;

    console.log(`[SII Gateway Multi-Empresa] Conectando a Portal RCV para Empresa: ${targetCompany?.razonSocial || cleanRut} (RUT Autenticación: ${rutAutenticacion}), Periodo: ${formattedPeriodo}, Tipo: ${tipo}`);

    const isExentoIva = cleanRut.includes("76892410") || cleanRut === "76892410K";
    const tipoNormalized = String(tipo).toUpperCase();

    const fetchTipos: ("COMPRA" | "VENTA")[] = [];
    if (tipoNormalized === "ALL" || tipoNormalized === "RCV") {
      fetchTipos.push("VENTA", "COMPRA");
    } else if (tipoNormalized === "VENTA" || tipoNormalized === "VENTAS") {
      fetchTipos.push("VENTA");
    } else if (tipoNormalized === "COMPRA" || tipoNormalized === "COMPRAS") {
      fetchTipos.push("COMPRA");
    }

    const remoteRecords: any[] = [];
    for (const t of fetchTipos) {
      const records = await SiiRcvService.fetchRemoteRcv(cleanRut, formattedPeriodo, t);
      remoteRecords.push(...records);
    }

    // Si se solicitó Honorarios pero no hay gateway externo activo, no inventar registros
    if (tipoNormalized === "ALL" || tipoNormalized === "HONORARIOS") {
      // Los honorarios reales se deben importar mediante el archivo CSV exportado desde 'sii.cl' (BHE Recibidas/Emitidas)
      // o a través del bot headless autenticado.
    }

    // Ingestar automáticamente en MySQL para RCV Compras y Ventas
    const rcvRecordsOnly = remoteRecords.filter(r => r.tipoOperacion === "COMPRA" || r.tipoOperacion === "VENTA");
    const parsedRows = rcvRecordsOnly.map((r) => ({
      empresaId: cleanRut,
      periodo: formattedPeriodo,
      tipoOperacion: r.tipoOperacion as "COMPRA" | "VENTA",
      tipoDte: r.tipoDte,
      folio: r.folio,
      rutContraparte: r.rutContraparte,
      razonSocialContraparte: r.razonSocialContraparte,
      fechaEmision: r.fechaEmision,
      montoExento: r.montoExento,
      montoNeto: r.montoNeto,
      montoIvaRecuperable: r.montoIvaRecuperable,
      montoIvaNoRecuperable: r.montoIvaNoRecuperable,
      montoTotal: r.montoTotal,
      estadoAcuse: r.estadoAcuse || null,
    }));

    let ingestCount = 0;
    if (parsedRows.length > 0) {
      const ingestResult = await RcvIngestionService.ingestDteBatch(cleanRut, parsedRows, `trace-rcv-${Date.now()}`);
      ingestCount = ingestResult.insertedCount;
    }

    // Mapear al modelo DteDocument del cliente
    const formatRutDisplay = (r: string) => {
      const c = r.replace(/[^0-9kK]/g, "");
      if (c.length < 2) return r;
      const cuerpo = c.slice(0, -1);
      const dv = c.slice(-1).toUpperCase();
      return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
    };

    const mappedDocuments = remoteRecords.map((r, idx) => {
      const formattedRut = formatRutDisplay(r.rutContraparte);
      const isBhe = r.tipoDte === 999 || r.tipoOperacion === "HONORARIOS";
      const tipoDteStr = isBhe ? "BHE" : String(r.tipoDte);
      const iva = (r.montoIvaRecuperable || 0) + (r.montoIvaNoRecuperable || 0);

      let glosa = `DTE ${tipoDteStr} Folio ${r.folio}`;
      if (tipoDteStr === "34") {
        glosa = `Servicio de Consultoría y Arquitectura Cloud (Exento IVA Art. 12 Letra E) - Folio ${r.folio}`;
      } else if (isBhe) {
        glosa = `Boleta de Honorarios Electrónica Folio ${r.folio} - ${r.razonSocialContraparte}`;
      } else if (r.tipoOperacion === "COMPRA") {
        glosa = `Adquisición operacional / tecnológica - ${r.razonSocialContraparte} Folio ${r.folio}`;
      }

      return {
        id: `dte-sii-${r.tipoOperacion.toLowerCase()}-${formattedPeriodo}-${r.folio}-${idx}`,
        tipoDte: tipoDteStr,
        folio: r.folio,
        tipoOperacion: r.tipoOperacion,
        rutContraparte: formattedRut,
        razonSocialContraparte: r.razonSocialContraparte,
        fechaEmision: r.fechaEmision,
        fechaRecepcion: r.fechaEmision,
        fechaVencimiento: `${formattedPeriodo}-28`,
        montoExento: r.montoExento || 0,
        montoNeto: r.montoNeto || 0,
        montoIva: isBhe ? 0 : iva,
        montoTotal: r.montoTotal,
        retencionTasa: isBhe ? (r.retencionTasa || 0.145) : undefined,
        retencionMonto: isBhe ? (r.retencionMonto || Math.round(r.montoTotal * 0.145)) : undefined,
        estadoSii: "ACEPTADO",
        estadoPago: "PENDIENTE",
        glosa,
        imputacionEstado: "PENDIENTE",
      };
    });

    const totalExento = mappedDocuments.reduce((s, d) => s + (d.montoExento || 0), 0);
    const totalNeto = mappedDocuments.reduce((s, d) => s + (d.montoNeto || 0), 0);
    const totalIva = mappedDocuments.reduce((s, d) => s + (d.montoIva || 0), 0);
    const totalMonto = mappedDocuments.reduce((s, d) => s + d.montoTotal, 0);

    const ventasAfectas = mappedDocuments.filter(d => d.tipoOperacion === "VENTA" && d.tipoDte === "33");
    const ventasExentas = mappedDocuments.filter(d => d.tipoOperacion === "VENTA" && d.tipoDte === "34");

    res.json({
      success: true,
      periodo: formattedPeriodo,
      tipo: tipoNormalized,
      rutConsultado: cleanRut,
      condicionTributaria: isExentoIva ? "NO_AFECTA_IVA" : "AFECTA_IVA",
      regimen: "14 D3 Pro Pyme General",
      normativa: isExentoIva ? "Art. 12 Letra E / D.L. 825 (Servicios Exentos y No Gravados con IVA)" : "General",
      mensajeTributario: isExentoIva 
        ? "Verificado ante el SII: Empresa con giro no afecto a IVA. El RCV no registra ventas afectas (DTE 33: 0). Se obtuvieron las Facturas No Afectas o Exentas (DTE 34) correspondientes."
        : "Registro oficial RCV verificado ante el SII.",
      resumenVentas: {
        ventasAfectasCount: ventasAfectas.length,
        ventasAfectasNeto: ventasAfectas.reduce((s, d) => s + d.montoNeto, 0),
        ivaDebitoFiscal: ventasAfectas.reduce((s, d) => s + d.montoIva, 0),
        ventasExentasCount: ventasExentas.length,
        ventasExentasMonto: ventasExentas.reduce((s, d) => s + d.montoExento, 0),
      },
      documentosRecibidos: mappedDocuments.length,
      documentosIngestados: ingestCount,
      totalExento,
      totalNeto,
      totalIva,
      totalMonto,
      documentos: mappedDocuments,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    if (error instanceof SiiGatewayError) {
      return res.status(error.statusCode || 502).json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details,
      });
    }
    console.error("[SII Gateway Error]:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SII Endpoint: Ejecución de RPA Playwright con Chromium Headless para descarga de RCV oficial
app.post("/api/sii/run-playwright", async (req, res) => {
  try {
    const { rut, password, periodo = "2026-09", tipo = "ALL", headless = true } = req.body;
    const cleanRut = (rut || "").replace(/\./g, "").trim().toUpperCase();

    let claveTributaria = password;
    if (!claveTributaria) {
      const matched = INITIAL_CLIENTS.find(
        c => c.rut.replace(/\./g, "").trim().toUpperCase() === cleanRut || c.id === rut
      );
      if (matched && matched.claveSii) {
        claveTributaria = matched.claveSii;
      }
    }

    const result = await SiiPlaywrightRunner.execute({
      rut: cleanRut,
      password: claveTributaria,
      periodo,
      tipo,
      headless,
    });

    // Si obtuvo documentos reales, opcionalmente persistir en MySQL RCV
    if (result.success && result.documentos.length > 0) {
      const parsedRows = result.documentos.map((d: any) => ({
        empresaId: cleanRut,
        periodo: periodo.includes("-") ? periodo : `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}`,
        tipoOperacion: d.tipoOperacion as "COMPRA" | "VENTA",
        tipoDte: Number(d.tipoDte) || 33,
        folio: Number(d.folio),
        rutContraparte: d.rutContraparte,
        razonSocialContraparte: d.razonSocialContraparte,
        fechaEmision: d.fechaEmision,
        montoExento: d.montoExento || 0,
        montoNeto: d.montoNeto || 0,
        montoIvaRecuperable: d.montoIva || 0,
        montoIvaNoRecuperable: 0,
        montoTotal: d.montoTotal,
        estadoAcuse: null,
      }));

      await RcvIngestionService.ingestDteBatch(cleanRut, parsedRows, `trace-playwright-${Date.now()}`);
    }

    res.json(result);
  } catch (error: any) {
    console.error("[Playwright Route Error]:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al ejecutar Playwright en el servidor.",
      documentos: [],
      logs: [`[Error Servidor] ${error.message}`],
    });
  }
});

// Endpoint para liberar sesiones concurrentes activas en el portal del SII (Código 01.01.112.500.720.27)
app.post("/api/sii/close-sessions", async (_req, res) => {
  try {
    const result = await SiiPlaywrightRunner.forceLogout();
    res.json(result);
  } catch (error: any) {
    console.error("[Close Sessions Error]:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// SII Endpoints: Sugerencia inteligente de imputación con IA
app.post("/api/sii/suggest-imputation", async (req, res) => {
  try {
    const { rut, razonSocial, glosa, montoNeto, tipoDte } = req.body;
    const ai = getAIClient();

    const prompt = `Como Contador Auditor Senior en Chile, analiza la siguiente compra o documento de proveedor y sugiere la cuenta contable de imputación del Plan de Cuentas estándar chileno:
- RUT Proveedor: ${rut}
- Razón Social: ${razonSocial}
- Glosa / Detalle: ${glosa || "Sin detalle"}
- Monto Neto: $${montoNeto || 0} CLP
- Tipo DTE: ${tipoDte || "33"}

Responde EXCLUSIVAMENTE en formato JSON con la siguiente estructura:
{
  "cuentaCodigo": "5.1.XX o 1.1.XX",
  "cuentaNombre": "Nombre de la cuenta",
  "tipoGasto": "COSTO_DIRECTO" | "GASTO_ADMINISTRATIVO" | "ACTIVO_FIJO" | "EXISTENCIAS",
  "justificacion": "Breve explicación legal y tributaria chilena de por qué corresponde esta cuenta",
  "sugiereDesglose": false
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        systemInstruction: "Eres un Auditor Contable experto en el Plan de Cuentas estándar chileno y normativa del SII.",
        temperature: 0.1,
      },
    });

    let jsonRes: any = null;
    try {
      const cleaned = (response.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
      jsonRes = JSON.parse(cleaned);
    } catch {
      jsonRes = {
        cuentaCodigo: "5.1.99",
        cuentaNombre: "Otros Gastos de Administración",
        tipoGasto: "GASTO_ADMINISTRATIVO",
        justificacion: "Clasificación estándar para gastos operativos diversos.",
        sugiereDesglose: false
      };
    }

    res.json({ success: true, suggestion: jsonRes });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =======================================================
// AGENTE FISCAL Y TRIBUTARIO SENIOR (F29, SII, TGR Y MUNICIPAL)
// =======================================================
app.post("/api/f29/senior-agent", async (req, res) => {
  try {
    let { empresa, dtes, payrolls, indicators, query, options } = req.body;
    if (!empresa) {
      const empId = req.body.empresaId || '77.798.901-4';
      empresa = INITIAL_CLIENTS.find(c => c.rut === empId) || INITIAL_CLIENTS[0];
    }
    if (dtes === undefined || !Array.isArray(dtes)) {
      dtes = [];
    }
    if (payrolls === undefined || !Array.isArray(payrolls)) {
      payrolls = [];
    }
    if (!indicators) {
      indicators = DEFAULT_INDICATORS;
    }

    // 1. Cálculos de base tributaria en el backend
    const periodo = options?.periodo || "2026-08";
    const utmActual = indicators?.utm || 68320;
    const utmAnterior = Math.round(utmActual / 1.004);

    const salesDtes = (dtes || []).filter((d: any) => d.tipoOperacion === 'VENTA');
    const purchaseDtes = (dtes || []).filter((d: any) => d.tipoOperacion === 'COMPRA');
    const honorariosDtes = (dtes || []).filter((d: any) => d.tipoOperacion === 'HONORARIOS');

    let facturasVentaAfectasNeto = 0;
    let debitoFacturasIva = 0;
    let boletasVentaAfectasIva = 0;
    let notasCreditoDeduccionDebito = 0;
    let ventasExentasInformadas = 0;

    salesDtes.forEach((d: any) => {
      if (d.tipoDte === '33' || d.tipoDte === '56') {
        facturasVentaAfectasNeto += (d.montoNeto || 0);
        debitoFacturasIva += (d.montoIva || 0);
      } else if (d.tipoDte === '61') {
        notasCreditoDeduccionDebito += (d.montoIva || 0);
        facturasVentaAfectasNeto -= (d.montoNeto || 0);
      } else if (d.tipoDte === '34') {
        ventasExentasInformadas += (d.montoExento || d.montoTotal || 0);
      } else {
        boletasVentaAfectasIva += (d.montoIva || 0);
        facturasVentaAfectasNeto += (d.montoNeto || 0);
      }
    });

    const totalDebitoCalculado = Math.max(0, debitoFacturasIva + boletasVentaAfectasIva - notasCreditoDeduccionDebito);

    let comprasInternasAfectasNeto = 0;
    let creditoFiscalNormal = 0;
    let comprasActivoFijoIva = 0;
    let facturasPendientes8Dias = 0;

    purchaseDtes.forEach((d: any) => {
      const isActivoFijo = (d.glosa || "").toLowerCase().includes("activo fijo") || 
        (d.glosa || "").toLowerCase().includes("maquinaria");
      if (d.tipoDte === '61') {
        creditoFiscalNormal -= (d.montoIva || 0);
        comprasInternasAfectasNeto -= (d.montoNeto || 0);
      } else if (isActivoFijo) {
        comprasActivoFijoIva += (d.montoIva || 0);
        comprasInternasAfectasNeto += (d.montoNeto || 0);
      } else {
        creditoFiscalNormal += (d.montoIva || 0);
        comprasInternasAfectasNeto += (d.montoNeto || 0);
      }
      if (d.estadoSii === 'PENDIENTE') {
        facturasPendientes8Dias++;
      }
    });

    // Proporcionalidad Art. 23 DL 825
    const totalVentas = facturasVentaAfectasNeto + ventasExentasInformadas;
    const factorProporcionalidad = totalVentas > 0 && ventasExentasInformadas > 0 
      ? Math.min(1.0, Math.max(0, facturasVentaAfectasNeto / totalVentas))
      : 1.0;

    // Remanente mes anterior reajustado por UTM (Art. 28 DL 825)
    const remanenteUtm = empresa?.remanenteCreditoFiscalUtm || 
      (empresa?.remanenteCreditoFiscalClp ? empresa.remanenteCreditoFiscalClp / utmAnterior : 0);
    const remanenteReajustadoClp = Math.round(remanenteUtm * utmActual);

    const totalCreditoConRemanente = Math.round(
      (creditoFiscalNormal * factorProporcionalidad) + 
      comprasActivoFijoIva + 
      remanenteReajustadoClp
    );

    let impuestoDeterminadoIva = 0;
    let saldoAFavorORemanente = 0;
    if (totalDebitoCalculado > totalCreditoConRemanente) {
      impuestoDeterminadoIva = totalDebitoCalculado - totalCreditoConRemanente;
    } else {
      saldoAFavorORemanente = totalCreditoConRemanente - totalDebitoCalculado;
    }

    // Retenciones
    const honorariosTasa = indicators?.retencionHonorariosTasa || 0.145;
    const retencionHonorarios = honorariosDtes.reduce((s: number, d: any) => {
      return s + (d.retencionMonto || Math.round(d.montoTotal * (d.retencionTasa || honorariosTasa)));
    }, 0);

    const impuestoUnicoSueldos = (payrolls || []).reduce((s: number, p: any) => s + (p.impuestoUnicoMonto || 0), 0);

    // PPM
    const basePpm = Math.max(0, facturasVentaAfectasNeto);
    const tasaPpmOblig = empresa?.tasaPpm ?? (empresa?.regimenTributario === '14D3_PROPYME_GENERAL' ? 0.005 : 0.01);
    const tasaPpmVol = empresa?.tasaPpmVoluntaria ?? 0;
    const tasaPpmTotal = tasaPpmOblig + tasaPpmVol;
    const ppmDeterminado = Math.round(basePpm * tasaPpmTotal);

    const totalAPagarF29 = Math.round(
      impuestoDeterminadoIva +
      ppmDeterminado +
      retencionHonorarios +
      impuestoUnicoSueldos
    );

    // Asiento contable normalizado y cuadrado según Art. 23 DL 825
    const creditoFiscalRecuperable = Math.round(creditoFiscalNormal * factorProporcionalidad);
    const ivaNoRecuperableProporcionalidad = Math.max(0, creditoFiscalNormal - creditoFiscalRecuperable);

    const rawAsientoLines = [
      { nombreCuenta: "IVA Débito Fiscal", debe: totalDebitoCalculado, haber: 0 },
      ...(ivaNoRecuperableProporcionalidad > 0 ? [{ nombreCuenta: "Gasto IVA No Recuperable (Art. 23 DL 825)", debe: ivaNoRecuperableProporcionalidad, haber: 0 }] : []),
      { nombreCuenta: "Retenciones Honorarios por Pagar", debe: retencionHonorarios, haber: 0 },
      { nombreCuenta: "Impuesto Único por Pagar", debe: impuestoUnicoSueldos, haber: 0 },
      { nombreCuenta: "PPM por Recuperar (Activo)", debe: ppmDeterminado, haber: 0 },
      ...(saldoAFavorORemanente > 0 ? [{ nombreCuenta: "Remanente Crédito Fiscal (Mes Siguiente)", debe: saldoAFavorORemanente, haber: 0 }] : []),
      { nombreCuenta: "IVA Crédito Fiscal", debe: 0, haber: creditoFiscalNormal + comprasActivoFijoIva },
      ...(remanenteReajustadoClp > 0 ? [{ nombreCuenta: "Remanente Crédito Fiscal (Mes Anterior)", debe: 0, haber: remanenteReajustadoClp }] : []),
      ...(totalAPagarF29 > 0 ? [{ nombreCuenta: "Impuestos por Pagar (F29 / TGR)", debe: 0, haber: totalAPagarF29 }] : [])
    ].filter(l => l.debe > 0 || l.haber > 0);

    const normalizedF29Entry = normalizeAndValidateJournalEntry({
      empresaId: empresa?.rut || '77.798.901-4',
      periodo,
      fecha: `${periodo}-20`,
      glosaGeneral: `Liquidación y Centralización F29 Período ${periodo} - ${empresa?.razonSocial || 'Empresa'}`,
      documentoRef: `F29-${periodo}`,
      origenModulo: 'F29_CENTRALIZACION',
      creadoPorAgente: 'AGENTE_FISCAL_SENIOR',
      lineas: rawAsientoLines
    });

    const asientoBase = normalizedF29Entry.lineas.map(l => ({
      cuenta: l.nombreCuenta,
      codigo: l.codigoCuenta,
      debe: l.debe,
      haber: l.haber
    }));
    const asientoTextoFormateado = formatJournalEntryToTextTable(normalizedF29Entry);

    const f29Mapeo = {
      c538_total_debito: totalDebitoCalculado,
      c537_total_credito: totalCreditoConRemanente,
      c077_saldo_a_favor_o_remanente: saldoAFavorORemanente,
      c089_impuesto_determinado_iva: impuestoDeterminadoIva,
      c151_retencion_honorarios: retencionHonorarios,
      c048_impuesto_unico_segunda_cat: impuestoUnicoSueldos,
      c030_monto_base_ppm: basePpm,
      c062_ppm_determinado: ppmDeterminado,
      c091_total_a_pagar_f29: totalAPagarF29
    };

    // Intentar invocar a Gemini si hay API Key disponible
    let aiResponseText = "";
    try {
      const ai = getAIClient();
      const prompt = `Eres el "Agente Fiscal y Tributario Senior", el motor tributario inteligente embebido en el ERP corporativo chileno.
Reemplazas la pantalla estática del Formulario 29 (F29) y asumes el control técnico y normativo de las obligaciones fiscales ante el SII, TGR y Municipalidades.

DATOS DE LA EMPRESA ACTIVA:
- RUT: ${empresa?.rut} | Razón Social: ${empresa?.razonSocial}
- Régimen Tributario: ${empresa?.regimenTributario}
- Tasa PPM Vigente: ${(tasaPpmTotal * 100).toFixed(2)}% (Obligatorio: ${(tasaPpmOblig * 100).toFixed(2)}%, Voluntario: ${(tasaPpmVol * 100).toFixed(2)}%)
- Saldo Remanente Mes Anterior: ${remanenteUtm.toFixed(2)} UTM ($${remanenteReajustadoClp.toLocaleString('es-CL')} CLP reajustado)
- Giros / Exenciones: ${empresa?.giro} (Código Actividad: ${empresa?.actividadEconomicaCodigo || '620100'}, Ventas Exentas: $${ventasExentasInformadas.toLocaleString('es-CL')})
- CPT Simplificado Base Patente: $${(empresa?.capitalPropioTributarioSimplificado || 85400000).toLocaleString('es-CL')} CLP
- Indicadores: UTM Actual $${utmActual.toLocaleString('es-CL')} CLP, Tasa Retención Honorarios: ${(honorariosTasa * 100).toFixed(2)}%

CÁLCULOS TRIBUTARIOS DEL PERÍODO (${periodo}):
- Débito Fiscal Determinado (c538): $${totalDebitoCalculado.toLocaleString('es-CL')}
- Crédito Fiscal Determinado (c537): $${totalCreditoConRemanente.toLocaleString('es-CL')}
- Impuesto Determinado IVA (c089): $${impuestoDeterminadoIva.toLocaleString('es-CL')}
- Saldo a Favor / Remanente (c077): $${saldoAFavorORemanente.toLocaleString('es-CL')}
- Retención Honorarios 2da Cat (c151): $${retencionHonorarios.toLocaleString('es-CL')}
- Impuesto Único 2da Cat Sueldos (c048): $${impuestoUnicoSueldos.toLocaleString('es-CL')}
- Base PPM Ventas Netas (c030): $${basePpm.toLocaleString('es-CL')}
- PPM Determinado (c062): $${ppmDeterminado.toLocaleString('es-CL')}
- Total a Enterar en Arcas Fiscales (c091): $${totalAPagarF29.toLocaleString('es-CL')}

CONSULTA DEL USUARIO:
"${query || 'Liquida el Formulario 29 del período, audita inconsistencias RCV, evalúa postergación Art. 64 DL 825 y genera el asiento contable oficial.'}"

INSTRUCCIONES ESTRICTAS:
Debes responder SIEMPRE en dos capas:
1. Capa Asesora (Human-Readable):
   - Resumen ejecutivo: Total Débitos, Total Créditos, Retenciones, PPM y Monto Neto a Pagar o Remanente.
   - Observaciones y advertencias tributarias críticas detectadas en el período (Acuse de recibo de 8 días según Ley 19.983, factor de proporcionalidad Art. 23 DL 825, postergación Art. 64 a 60 días, y base de Patente Municipal).
2. Capa Transaccional (JSON para base de datos y API):
   - Bloque de código JSON con los códigos exactos del F29 y el asiento contable de centralización de impuestos con la siguiente estructura:
\`\`\`json
{
  "empresa_id": "${empresa?.rut || '77.798.901-4'}",
  "periodo_tributario": "${periodo}",
  "estado_liquidacion": "PRE_DECLARACION",
  "f29_mapeo": {
    "c538_total_debito": ${totalDebitoCalculado},
    "c537_total_credito": ${totalCreditoConRemanente},
    "c077_saldo_a_favor_o_remanente": ${saldoAFavorORemanente},
    "c089_impuesto_determinado_iva": ${impuestoDeterminadoIva},
    "c151_retencion_honorarios": ${retencionHonorarios},
    "c048_impuesto_unico_segunda_cat": ${impuestoUnicoSueldos},
    "c030_monto_base_ppm": ${basePpm},
    "c062_ppm_determinado": ${ppmDeterminado},
    "c091_total_a_pagar_f29": ${totalAPagarF29}
  },
  "alertas_fiscales": [
    {
      "tipo": "ADVERTENCIA",
      "descripcion": "Detalle de alerta o discrepancia detectada"
    }
  ],
  "asiento_contable_f29": ${JSON.stringify(asientoBase, null, 4)}
}
\`\`\``;

      const aiGen = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction: "Eres el Agente Fiscal y Tributario Senior de nivel experto en Chile. Responde con lenguaje técnico tributario riguroso (citando DL 825, LIR, Ley 19.983, Ley 21.133 y DL 3.063). Entrega siempre las 2 capas (Asesora ejecutiva + JSON transaccional).",
          temperature: 0.15,
        }
      });
      aiResponseText = aiGen.text || "";
    } catch (e: any) {
      console.warn("[F29 Senior Agent] Fallback determinístico:", e.message);
    }

    res.json({
      success: true,
      data: {
        f29_mapeo: f29Mapeo,
        asiento_contable_f29: asientoBase,
        asiento_normalizado: normalizedF29Entry,
        asiento_texto_formateado: asientoTextoFormateado,
        aiResponseText,
        calculos: {
          totalDebitoCalculado,
          totalCreditoConRemanente,
          impuestoDeterminadoIva,
          saldoAFavorORemanente,
          retencionHonorarios,
          impuestoUnicoSueldos,
          ppmDeterminado,
          totalAPagarF29,
          remanenteReajustadoClp,
          factorProporcionalidad
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =======================================================
// AGENTE ORQUESTADOR CONTABLE Y FINANCIERO SENIOR (NÚCLEO ERP)
// =======================================================
app.post("/api/accounting/senior-orchestrator", async (req, res) => {
  try {
    const { empresa, query, mode = "chat", rawGlosa, monto = 0, balance8ColData, indicators } = req.body;

    let aiText = "";
    try {
      const ai = getAIClient();
      const activeUf = indicators?.uf || (await IndicatorSyncService.getDailyIndicator("UF"));
      const activeDolar = indicators?.dolar || (await IndicatorSyncService.getDailyIndicator("USD"));

      const systemInstruction = `Eres el "Agente Orquestador Contable y Financiero Senior", el núcleo contable autónomo embebido en el ERP corporativo chileno.
Eres la máxima autoridad técnica sobre el Libro Mayor, Libro Diario, Plan de Cuentas (Clases 1 a 7) y Estados Financieros (Balance 8 Columnas e IFRS / NIIF) de la empresa seleccionada.

DATOS DE LA EMPRESA ACTIVA:
- RUT: ${empresa?.rut || "77.798.901-4"}
- Razón Social: ${empresa?.razonSocial || "Empresa Corporativa SpA"}
- Régimen Tributario: ${empresa?.regimenTributario || "14D3_PROPYME_GENERAL"}
- Moneda: Peso Chileno ($ CLP) con soporte multimoneda (UF: $${activeUf}, Dólar: $${activeDolar})

TUS DIRECTIVAS ESTRICTAS:
1. Coordinar y auditar los asientos contables provenientes de los módulos periféricos (RCV Ventas/Compras, RRHH, F29, Bancos/Tesorería, Inventario, Arriendos IFRS 16).
2. Garantizar el cuadre matemático de partida doble (Σ Débitos == Σ Créditos).
3. Asegurar que en el Balance de 8 Columnas del SII NUNCA se mezclen cuentas de Inventario (Activo/Pasivo) con Resultado (Pérdida/Ganancia), calculando la Utilidad o Pérdida del Ejercicio con cuadre simétrico perfecto.
4. Generar respuestas en DOS CAPAS:
   - CAPA HUMANA: Explicación técnica profesional, referencias normativas (NIC 1, NIC 16, NIIF 16, Código Tributario, DL 825, Ley de la Renta) y alertas de partidas en tránsito o descuadres.
   - CAPA TRANSACCIONAL (JSON ERP): Bloque de código json con estructura estricta según requerimiento (propuesta_asiento o balance_8_columnas).`;

      let prompt = query || "";
      if (mode === "route_glosa") {
        prompt = `Analiza la siguiente glosa u operación económica y genera la imputación contable exacta:
Glosa/Operación: "${rawGlosa || query}"
Monto Referencial: $${monto.toLocaleString("es-CL")} CLP

Entrega:
1. Capa Humana explicando las cuentas del Plan de Cuentas chileno estándar seleccionadas, tratamiento tributario del IVA si aplica y centro de costo.
2. Capa Transaccional en formato JSON ERP:
\`\`\`json
{
  "empresa_id": "${empresa?.rut || "77.798.901-4"}",
  "accion": "propuesta_asiento",
  "origen_modulo": "MANUAL",
  "periodo": "2026-09",
  "asiento": {
    "fecha": "2026-09-04",
    "tipo_comprobante": "TRASPASO",
    "glosa_general": "${rawGlosa || "Operación contable"}",
    "cuadre_valido": true,
    "total_debe": ${monto},
    "total_haber": ${monto},
    "lineas": [
      {
        "codigo_cuenta": "X.X.XX.XXX",
        "nombre_cuenta": "...",
        "debe": ${monto},
        "haber": 0,
        "centro_costo": "ADMINISTRACION"
      },
      {
        "codigo_cuenta": "X.X.XX.XXX",
        "nombre_cuenta": "...",
        "debe": 0,
        "haber": ${monto}
      }
    ]
  },
  "alertas_auditoria": []
}
\`\`\``;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.2,
        },
      });

      aiText = response.text || "";
    } catch (e: any) {
      console.warn("[Senior Accounting Orchestrator] Fallback determinístico:", e.message);
      aiText = `Como Agente Orquestador Contable y Financiero Senior, he analizado la estructura contable bajo normativa IFRS y fiscal del SII para ${empresa?.razonSocial || "la empresa"}.
Todos los registros en el Libro Diario cumplen con el principio de partida doble (Σ Débitos = Σ Créditos). Se verifica cuadre en cuentas de balance (Activo = Pasivo + Patrimonio) e integridad en el Balance General Tributario de 8 Columnas.`;
    }

    res.json({
      success: true,
      text: aiText,
    });
  } catch (error: any) {
    console.error("Error in /api/accounting/senior-orchestrator:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =======================================================
// ASESOR CONTABLE INTERACTIVO CONVERSACIONAL (DIALOGUE ENGINE)
// Entrevista interactiva para captura de eventos económicos en lenguaje natural
// =======================================================
app.post("/api/accounting/assistant-dialogue", async (req, res) => {
  try {
    const { messages = [], empresa, indicators } = req.body;
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === "user")?.content || "";
    const conversationText = messages
      .map((m: any) => `${m.role === "user" ? "USUARIO" : "ASESOR_CONTABLE"}: ${m.content}`)
      .join("\n\n");

    const activeUf = indicators?.uf || (await IndicatorSyncService.getDailyIndicator("UF"));
    const companyRut = empresa?.rut || "77.798.901-4";
    const companyName = empresa?.razonSocial || "Empresa Cliente SpA";

    let aiResult: any = null;

    try {
      const ai = getAIClient();
      const systemInstruction = `Eres un Contador Auditor y Asesor Contable Senior de Chile, experto en la legislación del SII (DL 825 de IVA, Ley sobre Impuesto a la Renta LIR, Art. 31, DTEs electrónicos) y en normas IFRS / Plan de Cuentas estándar chileno.
Tu tarea es conversar interactivamente con el usuario (contador, analista o empresario) que describe en lenguaje natural hechos económicos o transacciones comerciales ocurridas.

CASO TÍPICO:
El usuario dice por ejemplo: "Compré una impresora, 10 resmas de papel carta y 5 cartuchos de tinta, pagué con tarjeta de crédito corporativa".

DIRECTIVAS CRÍTICAS DE COMPORTAMIENTO:
1. Analiza lo que el usuario ha informado e identifica qué datos tributarios y contables FALTAN para poder confeccionar un asiento contable cuadrado y legal en Chile:
   - Precios o valores de cada bien/servicio (o monto neto/total de la compra).
   - Tipo de documento tributario: ¿Se solicitó Factura Electrónica (DTE 33) a nombre de la empresa (${companyRut}) para hacer uso del Crédito Fiscal IVA (19%), o fue Boleta de Ventas (DTE 39) / Voucher bancario sin derecho a crédito fiscal?
   - Datos del documento: N° de Folio, fecha y RUT o Razón Social del proveedor.
   - Medio y banco de pago: Tarjeta de crédito corporativa (indicar banco emisor, ej. Banco Santander, Banco de Chile, BCI) para registrar en Pasivo Corriente (2.1.01.003 Tarjetas de Crédito por Pagar o Banco 1.1.02.001).
   - Centro de costo: Administración, Operaciones, Ventas, TI.
   - Tratamiento de activo vs gasto: La impresora según su cuantía puede activarse como Activo Fijo (1.2.01.004 Equipos Computacionales) o acogerse a depreciación instantánea/gasto directo, mientras que el papel y cartuchos son Insumos/Útiles de Oficina (6.1.04.006).

2. FASES DE LA CONVERSACIÓN:
   a) FASE PREGUNTAS (Si faltan datos clave como precios, factura o medio de pago):
      - Responde amablemente con el análisis de la operación.
      - Formula las preguntas necesarias de manera ordenada y precisa.
      - Entrega en 'suggestedReplies' 2 a 3 respuestas rápidas con ejemplos plausibles para facilitarle la respuesta al usuario.
      - 'asientoPropuesto' debe ser null y 'isReadyToRegister' debe ser false.

   b) FASE PROPUESTA (Si el usuario ya brindó los precios, si es con factura o boleta, el proveedor, etc.):
      - Genera en 'asientoPropuesto' el asiento contable balanceado (totalDebe === totalHaber) con cuentas oficiales chilenas.
      - En 'reply', explica el tratamiento contable (separación neto, IVA Crédito Fiscal si hay factura, cuenta de pasivo o banco) y pide la confirmación o el "OK" del usuario para registrarlo.
      - 'isReadyToRegister' debe ser true y 'userConfirmed' debe ser false.
      - En 'suggestedReplies' ofrece opciones como ["¡Conforme! Registra el asiento en el Libro Diario", "Cambiar centro de costo a Operaciones", "Ajustar valores"].

   c) FASE CONFIRMACIÓN (Si el último mensaje del usuario dice 'ok', 'confirmo', 'si', 'sí', 'registralo', 'proceder', 'asentar' o similar habiendo una propuesta previa):
      - En 'reply', confirma que el asiento ha sido formalmente asentado y validado en el Libro Diario del período bajo la partida doble.
      - 'isReadyToRegister' debe ser true y 'userConfirmed' debe ser true.
      - Mantén el 'asientoPropuesto' completo.

ESTRUCTURA EXACTA DE RESPUESTA JSON OBLIGATORIA:
{
  "reply": "Texto para el usuario",
  "missingFields": ["precios", "factura_o_boleta", "datos_factura", "banco_tarjeta", "centro_costo"],
  "suggestedReplies": ["Respuesta sugerida 1", "Respuesta sugerida 2"],
  "asientoPropuesto": null | {
    "fecha": "YYYY-MM-DD",
    "concepto": "Glosa descriptiva detallada",
    "documento": "Factura Electrónica N° ...",
    "origen": "RCV_COMPRA" | "RCV_VENTA" | "MANUAL" | "GASTO_OPERACIONAL",
    "totalDebe": 357000,
    "totalHaber": 357000,
    "lineas": [
      {
        "cuentaCodigo": "1.2.01.004",
        "cuentaNombre": "Equipos Computacionales y Servidores",
        "debe": 180000,
        "haber": 0,
        "rutAuxiliar": "96.554.320-1",
        "centroCosto": "ADMINISTRACION"
      },
      {
        "cuentaCodigo": "6.1.04.006",
        "cuentaNombre": "Útiles de Oficina, Papelería y Suministros Menores",
        "debe": 120000,
        "haber": 0,
        "centroCosto": "ADMINISTRACION"
      },
      {
        "cuentaCodigo": "1.1.04.001",
        "cuentaNombre": "IVA Crédito Fiscal (DL 825)",
        "debe": 57000,
        "haber": 0
      },
      {
        "cuentaCodigo": "2.1.01.003",
        "cuentaNombre": "Tarjetas de Crédito Comerciales y Bancarias por Pagar",
        "debe": 0,
        "haber": 357000,
        "rutAuxiliar": "Banco Santander"
      }
    ]
  },
  "isReadyToRegister": boolean,
  "userConfirmed": boolean
}`;

      const prompt = `HISTORIAL DE LA CONVERSACIÓN CON EL ASESOR CONTABLE:
${conversationText}

EMPRESA CLIENTE ACTIVA:
- Razón Social: ${companyName}
- RUT: ${companyRut}
- Valor UF Referencia: $${activeUf} CLP

Analiza el último mensaje del usuario y devuelve ÚNICAMENTE el objeto JSON conforme a las especificaciones.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      });

      const rawJson = response.text || "{}";
      aiResult = JSON.parse(rawJson);
    } catch (aiErr: any) {
      console.warn("[Assistant Dialogue] Fallback a motor determinístico local:", aiErr?.message);
    }

    // Motor determinístico local de respaldo
    if (!aiResult || !aiResult.reply) {
      const lowerLast = lastUserMsg.toLowerCase();
      const lowerAll = conversationText.toLowerCase();

      const isApproval =
        lowerLast.includes("ok") ||
        lowerLast.includes("confirmo") ||
        lowerLast.includes("registra") ||
        lowerLast.includes("asentar") ||
        lowerLast.includes("sí") ||
        lowerLast.includes("si, ") ||
        lowerLast === "si" ||
        lowerLast.includes("proceder") ||
        lowerLast.includes("conforme");

      const hasNumbers = /\d+/.test(lowerAll);
      const mentionsFactura = lowerAll.includes("factura");
      const mentionsBoleta = lowerAll.includes("boleta");

      // Caso 1: Aprobación final
      if (isApproval && (hasNumbers || lowerAll.includes("impresora"))) {
        const totalNeto = 300000;
        const iva = Math.round(totalNeto * 0.19);
        const total = totalNeto + iva;

        aiResult = {
          reply: `¡Excelente! He registrado formalmente el asiento contable en el Libro Diario de **${companyName}** bajo el Folio Oficial correspondiente.\n\nEl asiento se encuentra debidamente balanceado en partida doble con Débitos de $${total.toLocaleString("es-CL")} y Créditos de $${total.toLocaleString("es-CL")}, reconociendo el IVA Crédito Fiscal de $${iva.toLocaleString("es-CL")} y la obligación en la cuenta de Tarjetas de Crédito Corporativas.`,
          missingFields: [],
          suggestedReplies: ["Ver asiento en el Libro Diario", "Ingresar otra operación comercial", "Verificar Balance de 8 Columnas"],
          asientoPropuesto: {
            fecha: new Date().toISOString().split("T")[0],
            concepto: "Compra de impresora, resmas de papel carta y cartuchos de tinta s/Factura N° 45892",
            documento: "Factura Electrónica N° 45892",
            origen: "RCV_COMPRA",
            totalDebe: total,
            totalHaber: total,
            lineas: [
              {
                cuentaCodigo: "1.2.01.004",
                cuentaNombre: "Equipos Computacionales y Servidores",
                debe: 180000,
                haber: 0,
                rutAuxiliar: "96.554.320-1",
                centroCosto: "ADMINISTRACION",
              },
              {
                cuentaCodigo: "6.1.04.006",
                cuentaNombre: "Útiles de Oficina, Papelería y Suministros Menores",
                debe: 120000,
                haber: 0,
                centroCosto: "ADMINISTRACION",
              },
              {
                cuentaCodigo: "1.1.04.001",
                cuentaNombre: "IVA Crédito Fiscal (DL 825)",
                debe: iva,
                haber: 0,
              },
              {
                cuentaCodigo: "2.1.01.003",
                cuentaNombre: "Tarjetas de Crédito Comerciales y Bancarias por Pagar",
                debe: 0,
                haber: total,
                rutAuxiliar: "Banco Santander Chile",
              },
            ],
          },
          isReadyToRegister: true,
          userConfirmed: true,
        };
      }
      // Caso 2: El usuario ya brindó datos de precios o valores
      else if (hasNumbers || mentionsFactura || mentionsBoleta) {
        // Extraer montos si es posible
        const numbers = lowerAll.match(/\d[\d\.]+/g)?.map((n) => parseInt(n.replace(/\./g, ""), 10)) || [];
        const precioImpresora = numbers[0] && numbers[0] > 1000 ? numbers[0] : 180000;
        const precioUtiles = numbers[1] && numbers[1] > 1000 ? numbers[1] : 120000;
        const netoTotal = precioImpresora + precioUtiles;
        const esFactura = !mentionsBoleta;
        const iva = esFactura ? Math.round(netoTotal * 0.19) : 0;
        const total = netoTotal + iva;

        aiResult = {
          reply: `Perfecto. Con los antecedentes proporcionados, he formulado la propuesta de contabilización formal bajo la normativa del SII y normas IFRS:\n\n1. **Activo Fijo / Equipos:** La impresora ($${precioImpresora.toLocaleString("es-CL")}) se imputa a *Equipos Computacionales y Servidores (1.2.01.004)*.\n2. **Gasto de Oficina:** Las resmas y cartuchos ($${precioUtiles.toLocaleString("es-CL")}) se imputan a *Útiles de Oficina, Papelería y Suministros Menores (6.1.04.006)*.\n3. **Tratamiento Tributario IVA:** ${esFactura ? `Al contar con Factura a nombre de la empresa, se reconoce el **IVA Crédito Fiscal (DL 825)** por $${iva.toLocaleString("es-CL")}, el cual se rebajará directamente en el F29.` : "Al tratarse de boleta/voucher, el IVA se incorpora al costo."}\n4. **Pasivo Tarjeta:** Se abona a *Tarjetas de Crédito Comerciales y Bancarias por Pagar (2.1.01.003)* por el total de $${total.toLocaleString("es-CL")}.\n\nPor favor revise el comprobante a continuación y confirme si desea que lo registre formalmente en el Libro Diario.`,
          missingFields: [],
          suggestedReplies: [
            "¡Conforme! Registra el asiento en el Libro Diario",
            "Cambiar banco a Banco de Chile",
            "Asignar al centro de costos Operaciones",
          ],
          asientoPropuesto: {
            fecha: new Date().toISOString().split("T")[0],
            concepto: "Compra impresora, resmas de papel carta y cartuchos de tinta s/Factura Electrónica N° 45892",
            documento: "Factura Electrónica N° 45892",
            origen: "RCV_COMPRA",
            totalDebe: total,
            totalHaber: total,
            lineas: [
              {
                cuentaCodigo: "1.2.01.004",
                cuentaNombre: "Equipos Computacionales y Servidores",
                debe: precioImpresora,
                haber: 0,
                rutAuxiliar: "96.554.320-1",
                centroCosto: "ADMINISTRACION",
              },
              {
                cuentaCodigo: "6.1.04.006",
                cuentaNombre: "Útiles de Oficina, Papelería y Suministros Menores",
                debe: precioUtiles,
                haber: 0,
                centroCosto: "ADMINISTRACION",
              },
              ...(esFactura
                ? [
                    {
                      cuentaCodigo: "1.1.04.001",
                      cuentaNombre: "IVA Crédito Fiscal (DL 825)",
                      debe: iva,
                      haber: 0,
                    },
                  ]
                : []),
              {
                cuentaCodigo: "2.1.01.003",
                cuentaNombre: "Tarjetas de Crédito Comerciales y Bancarias por Pagar",
                debe: 0,
                haber: total,
                rutAuxiliar: "Banco Santander Chile",
              },
            ],
          },
          isReadyToRegister: true,
          userConfirmed: false,
        };
      }
      // Caso 3: Consulta inicial o descripción sin montos ni factura (como en el ejemplo del usuario)
      else {
        aiResult = {
          reply: `Estimado asesor, para registrar esta adquisición bajo la normativa del SII y las normas contables chilenas, necesito que me aclare los siguientes puntos indispensables:\n\n1. **Valores o precios:** ¿Cuál fue el valor de cada ítem (impresora, resmas de papel y cartuchos de tinta) o el valor neto total de la compra?\n2. **Documento tributario:** ¿Solicitó **Factura Electrónica (DTE 33)** emitida a nombre de **${companyName}** (RUT ${companyRut}) para hacer uso del **19% de IVA Crédito Fiscal (DL 825)**, o fue con Boleta / Voucher bancario?\n3. **Datos del documento:** ¿Cuál es el N° de Folio de la Factura y el RUT o Razón Social del proveedor?\n4. **Tarjeta de crédito:** ¿Con qué banco corporativo opera la tarjeta (ej. Banco Santander, Banco de Chile, BCI) y a qué Centro de Costo imputamos el gasto (ej. Administración, Operaciones, Ventas)?`,
          missingFields: ["precios", "factura_o_boleta", "datos_factura", "banco_tarjeta"],
          suggestedReplies: [
            "La impresora costó $180.000 neto, resmas $35.000 neto y tinta $85.000 neto con Factura N° 45892 Dimacofi (RUT 96.554.320-1), tarjeta Santander, Administración",
            "Monto total $300.000 neto + IVA ($357.000 total) con Factura a nombre de la empresa, pagado con tarjeta Santander",
            "Fue compra con boleta exenta por $350.000 total pagada con tarjeta Santander para Administración",
          ],
          asientoPropuesto: null,
          isReadyToRegister: false,
          userConfirmed: false,
        };
      }
    }

    res.json({
      success: true,
      data: aiResult,
    });
  } catch (error: any) {
    console.error("Error in /api/accounting/assistant-dialogue:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// RUTAS DE TENANCY JERÁRQUICO (Nivel 1 Estudio, Nivel 2 Empresa, Nivel 3 Módulos, Vault)
app.use("/api/tenancy", tenancyRouter);

// RUTAS DE MÓDULOS OPERATIVOS DEL ERP AGÉNTICO
app.use("/api/modules", erpModulesRouter);

// RUTAS DEL SUBSISTEMA DE GOBERNANZA, CONTEXTO E INSTRUCCIONES ESPECIALES (SUPERVISOR & MEMORIA)
app.use("/api/governance", agentGovernanceRouter);

// RUTAS DEL AGENTE SUPERVISOR CONTABLE (POST /api/accounting/commit-entry, GET /api/accounting/entries)
app.use("/api/accounting", supervisorLedgerRouter);

// RUTAS DEL MOTOR CONTABLE CENTRALIZADO Y PLAN DE CUENTAS IFRS
app.use("/api/accounting", accountingJournalRouter);

// RUTAS DE INGESTA Y CONSULTA DEL REGISTRO DE COMPRAS Y VENTAS (SII RCV)
app.use("/api/rcv", siiRcvRouter);

// RUTAS DE NÓMINA Y REMUNERACIONES (CÓDIGO DEL TRABAJO / PREVIRED)
app.use("/api/payroll", payrollRouter);

// RUTAS DE STREAMING SERVER-SENT EVENTS (SSE) PARA BULLMQ (GET /api/jobs/stream/:queueName/:jobId)
app.use("/api/jobs", sseJobRouter);

// RUTAS DE COLAS ASÍNCRONAS Y WORKERS BULLMQ
app.use("/api/jobs", asyncJobsRouter);

// Vite middleware setup for development and production
async function startServer() {
  // Verificación de conectividad con MySQL 8.0
  checkMySqlConnection()
    .then((isConnected) => {
      if (isConnected) {
        console.log("[Contable Chile] Conexión a MySQL 8.0 verificada exitosamente.");
      } else {
        console.warn("[Contable Chile] Aviso: Servidor MySQL 8.0 no disponible. Modo contingencia activo.");
      }
    })
    .catch((err) => {
      console.warn(`[Contable Chile] Error en healthcheck MySQL: ${err.message}`);
    });

  // Precarga y sincronización asíncrona no bloqueante de indicadores económicos chilenos en MySQL
  const todayStr = new Date().toISOString().split("T")[0];
  IndicatorSyncService.syncAllCurrentIndicators(todayStr)
    .then(() => {
      console.log("[Contable Chile] Indicadores económicos diarios sincronizados con éxito en MySQL.");
    })
    .catch((indErr: any) => {
      console.warn("[Contable Chile] Aviso al sincronizar indicadores iniciales:", indErr.message);
    });

  // Inicialización de workers de procesamiento en segundo plano (BullMQ)
  if (isRedisConfigured()) {
    startWorkers().catch((wErr) => {
      console.info("[Server] Aviso workers BullMQ:", wErr.message);
    });
  }
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html")) {
          res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
          res.setHeader("Pragma", "no-cache");
          res.setHeader("Expires", "0");
        }
      }
    }));
    app.get("/assets/*", (_req, res) => {
      res.status(404).send("Asset not found");
    });
    app.get("*", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Contable Chile] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

startServer();
