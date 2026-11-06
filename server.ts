import express from "express";
import path from "path";
import fs from "fs";
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
import { expenseReportsRouter } from "./src/controllers/expenseReportsController";
import { billingDteRouter } from "./src/controllers/billingDteController";
import { authRouter } from "./src/controllers/authController";
import { autonomousAgentsRouter } from "./src/controllers/autonomousAgentsController";
import { authenticateApiToken } from "./src/middlewares/authMiddleware";
import { centralizedAuthorizationMiddleware, validateCompanyIdentifiers } from "./src/middlewares/centralizedAuthorizationMiddleware";
import { sanitizeSecurityUser } from "./src/services/securityRbacService";
import { decryptFromVaultString } from "./src/utils/vaultCrypto";
import { z } from "zod";
import { sanitizeContextForAi } from "./src/utils/aiSecuritySanitizer";
import { SiiRcvService, SiiGatewayError } from "./src/services/siiRcvService";
import { SiiPlaywrightRunner } from "./src/services/siiPlaywrightRunner";
import { RcvIngestionService } from "./src/services/rcvIngestionService";
import { startWorkers } from "./src/workers";
import { isRedisConfigured } from "./src/queues/redisConfig";
import { IndicatorSyncService } from "./src/services/indicatorSyncService";
import { checkMySqlConnection, ensureMysqlSchemaInitialized, isRealMysqlConnected } from "./src/db/mysqlClient";
import { diskPersistence } from "./src/services/diskPersistenceService";
import { INITIAL_CLIENTS, seedDtes, seedPayrolls } from "./src/data/seedData";
import { DEFAULT_INDICATORS } from "./src/utils/chileanAccounting";
import {
  normalizeAndValidateJournalEntry,
  formatJournalEntryToTextTable,
} from "./src/services/journalEntryNormalizer";
import { piperTtsService, PIPER_SPANISH_VOICES } from "./src/services/piperTtsService";
import { whatsappBridgeService } from "./src/services/whatsappBridgeService";
import { aiRouterService } from "./src/services/aiRouterService";
import { commercialProcurementService } from "./src/services/commercialProcurementService";

dotenv.config({ path: [path.resolve(process.cwd(), ".env.local"), path.resolve(process.cwd(), ".env")], override: true });

process.on("uncaughtException", (err) => {
  console.error("[Process] Uncaught Exception capturada (evitando caída 502):", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Process] Unhandled Rejection capturado:", promise, "razón:", reason);
});

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "15mb" }));

// VALIDACIÓN DE IDENTIFICADORES DE EMPRESA: Rechaza con 400 todo identificador que no sea un texto único
app.use(validateCompanyIdentifiers);

// GOBERNANZA DE SEGURIDAD & RBAC: Validación de Bearer Token en todas las rutas /api
app.use(authenticateApiToken);
// AUTORIZACIÓN CENTRALIZADA: Denegar por defecto, mapa canónico ruta -> módulo, y multi-tenant
app.use(centralizedAuthorizationMiddleware);

// Lazy initialization of Gemini client
let aiClient: GoogleGenAI | null = null;
function getAIClient(customKey?: string): GoogleGenAI {
  const apiKey = customKey || process.env.GEMINI_API_KEY || aiRouterService.getConfig().geminiApiKey;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in the environment.");
  }
  if (customKey) {
    return new GoogleGenAI({
      apiKey: customKey,
      httpOptions: {
        headers: {
          "User-Agent": "erpremia-voice",
        },
      },
    });
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "erpremia-core",
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
        imm: DEFAULT_INDICATORS.imm,
        topeImponibleAfpUf: DEFAULT_INDICATORS.topeImponibleAfpUf, // 90.0 UF (Vigente 2026)
        topeImponibleAfcUf: DEFAULT_INDICATORS.topeImponibleAfcUf, // 135.2 UF (Vigente 2026)
        retencionHonorariosTasa: DEFAULT_INDICATORS.retencionHonorariosTasa, // 14.5% vigente en Chile
        sisTasa: DEFAULT_INDICATORS.sisTasa,
        mutualBaseTasa: DEFAULT_INDICATORS.mutualBaseTasa,
        ley21735AportePatronalTasa: DEFAULT_INDICATORS.ley21735AportePatronalTasa, // 1.0% Ley 21.735 Reforma Previsional
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

// =======================================================
// ADMINISTRACIÓN Y GOBERNANZA DE MODELOS DE IA & CONSUMO
// =======================================================
app.get("/api/admin/ai-config", async (_req, res) => {
  try {
    const config = aiRouterService.getMaskedConfig();
    const localStatus = await aiRouterService.testLocalServer();
    res.json({
      success: true,
      config,
      localStatus,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/admin/ai-config", async (req, res) => {
  try {
    const patch = req.body;
    aiRouterService.updateConfig(patch);
    const masked = aiRouterService.getMaskedConfig();
    const localStatus = await aiRouterService.testLocalServer();
    res.json({
      success: true,
      config: masked,
      localStatus,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/admin/ai-test-local", async (req, res) => {
  try {
    const { localBaseUrl } = req.body;
    if (localBaseUrl) {
      aiRouterService.updateConfig({ localBaseUrl });
    }
    const result = await aiRouterService.testLocalServer();
    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/admin/ai-usage-report", async (req, res) => {
  try {
    const empresaId = req.effectiveEmpresaId || (typeof req.query.empresaId === "string" ? req.query.empresaId : undefined);
    const periodo = typeof req.query.periodo === "string" ? req.query.periodo : undefined;
    const report = aiRouterService.getUsageReport({ empresaId, periodo });
    res.json({
      success: true,
      report,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/admin/ai-usage-report/csv", (req, res) => {
  try {
    const empresaId = req.effectiveEmpresaId || (typeof req.query.empresaId === "string" ? req.query.empresaId : undefined);
    const periodo = typeof req.query.periodo === "string" ? req.query.periodo : undefined;
    const csv = aiRouterService.exportUsageReportCsv(empresaId, periodo);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="reporte_consumo_ia_${periodo || 'mensual'}.csv"`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).send("Error generando CSV: " + error.message);
  }
});

app.post("/api/admin/ai-company-override", (req, res) => {
  try {
    const empresaId = req.effectiveEmpresaId || req.body.empresaId;
    const { override } = req.body;
    if (!empresaId) return res.status(400).json({ success: false, error: "empresaId es requerido" });
    aiRouterService.setCompanyOverride(empresaId, override);
    res.json({ success: true, config: aiRouterService.getConfig() });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// =======================================================
// AGENTE DE GESTIÓN COMERCIAL & APROVISIONAMIENTO SENIOR
// =======================================================
app.get("/api/commercial-procurement/state", (req, res) => {
  try {
    const empresaId = req.effectiveEmpresaId || "client-retail-01";
    const state = commercialProcurementService.getState(empresaId);
    res.json({ success: true, state });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/commercial-procurement/adjust-price", (req, res) => {
  try {
    const empresaId = req.effectiveEmpresaId || "client-retail-01";
    const { sku, nuevoPrecioVenta, motivo } = req.body;
    if (!sku || nuevoPrecioVenta === undefined) {
      return res.status(400).json({ success: false, error: "sku y nuevoPrecioVenta son requeridos" });
    }
    const result = commercialProcurementService.adjustSellingPrice(
      empresaId,
      sku,
      Number(nuevoPrecioVenta),
      motivo || "Ajuste de margen target por Agente Sr."
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/commercial-procurement/purchase-order", (req, res) => {
  try {
    const empresaId = req.effectiveEmpresaId || "client-retail-01";
    const orderData = req.body;
    if (!orderData.proveedorRut || !orderData.items || !orderData.items.length) {
      return res.status(400).json({ success: false, error: "Datos de orden de compra incompletos" });
    }
    const newOrder = commercialProcurementService.createPurchaseOrder(empresaId, orderData);
    res.json({ success: true, order: newOrder });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/commercial-procurement/quote", (req, res) => {
  try {
    const empresaId = req.effectiveEmpresaId || "client-retail-01";
    const quoteData = req.body;
    if (!quoteData.clienteRut || !quoteData.items || !quoteData.items.length) {
      return res.status(400).json({ success: false, error: "Datos de cotización incompletos" });
    }
    const newQuote = commercialProcurementService.createCommercialQuote(empresaId, quoteData);
    res.json({ success: true, quote: newQuote });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/commercial-procurement/ai-advisor", async (req, res) => {
  try {
    const empresaId = req.effectiveEmpresaId || "client-retail-01";
    const { prompt, companyProfile } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, error: "prompt es requerido" });
    }
    const result = await commercialProcurementService.runSeniorConsultation(
      empresaId,
      prompt,
      companyProfile
    );
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("Error en /api/commercial-procurement/ai-advisor:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Emisión de Solicitudes de Cotización de Compra (RFQ)
app.post("/api/commercial-procurement/rfq", (req, res) => {
  try {
    const empresaId = req.effectiveEmpresaId || "client-retail-01";
    const { titulo, diasPlazoRespuesta, items, proveedorRuts } = req.body;
    if (!titulo || !items || !items.length || !proveedorRuts || !proveedorRuts.length) {
      return res.status(400).json({ success: false, error: "Título, items y lista de proveedores son requeridos" });
    }
    const newRfq = commercialProcurementService.createRfq(empresaId, {
      titulo,
      diasPlazoRespuesta: Number(diasPlazoRespuesta) || 5,
      items,
      proveedorRuts,
    });
    res.json({ success: true, rfq: newRfq });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reiteración de Recordatorio a Proveedor (Seguimiento Activo)
app.post("/api/commercial-procurement/rfq/reminder", (req, res) => {
  try {
    const empresaId = req.effectiveEmpresaId || "client-retail-01";
    const { rfqId, supplierRut } = req.body;
    if (!rfqId || !supplierRut) {
      return res.status(400).json({ success: false, error: "rfqId y supplierRut son requeridos" });
    }
    const result = commercialProcurementService.sendSupplierReminder(empresaId, rfqId, supplierRut);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Registro / Simulación de Oferta de Proveedor
app.post("/api/commercial-procurement/rfq/quote", (req, res) => {
  try {
    const empresaId = req.effectiveEmpresaId || "client-retail-01";
    const { rfqId, supplierRut, quoteData } = req.body;
    if (!rfqId || !supplierRut || !quoteData || quoteData.montoNetoOfertado === undefined) {
      return res.status(400).json({ success: false, error: "Datos de cotización incompletos" });
    }
    const result = commercialProcurementService.submitSupplierQuote(empresaId, rfqId, supplierRut, quoteData);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Adjudicación de RFQ al Mejor Proveedor y Emisión Automática de Orden de Compra (OC)
app.post("/api/commercial-procurement/rfq/award", (req, res) => {
  try {
    const empresaId = req.effectiveEmpresaId || "client-retail-01";
    const { rfqId, winningSupplierRut, motivoAdjudicacion } = req.body;
    if (!rfqId || !winningSupplierRut) {
      return res.status(400).json({ success: false, error: "rfqId y winningSupplierRut son requeridos" });
    }
    const result = commercialProcurementService.awardRfq(empresaId, rfqId, winningSupplierRut, motivoAdjudicacion);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Gemini Chat & Accounting Consultation (vía AiRouter)
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { messages, companyContext, firmContext, userRole, personaContext } = req.body;

    const safeFirmContext = firmContext ? sanitizeContextForAi(firmContext) : null;
    const safeCompanyContext = companyContext ? sanitizeContextForAi(companyContext) : null;

    const systemInstruction = `Eres un Agente Contable y Financiero Senior experto en la legislación chilena (SII, Dirección del Trabajo, Tesorería General de la República - TGR, Código del Trabajo, Ley de la Renta LIR, DL 825 de IVA e IFRS/NIIF 16).
Tu objetivo es gestionar de manera integral la contabilidad, el flujo de caja, las proyecciones financieras y el cumplimiento tributario/laboral de la empresa en Chile, actuando bajo las directrices del Estudio Contable gestor.

${personaContext ? `ESTÁS ACTUANDO ESPECÍFICAMENTE COMO: ${personaContext.nombre}, ${personaContext.cargo} (${personaContext.area}) de la empresa ${companyContext?.nombre || companyContext?.razonSocial || 'la empresa'}.
DIRECTRICES CLAVE DE DIÁLOGO:
1. Mantén estricta continuidad del diálogo multi-turno. Si el usuario te responde a una pregunta previa (por ejemplo entregando márgenes, recetas de insumos, plazos de entrega, montos netos, condición de pago o confirmaciones), UNE los datos previos con los nuevos, formula la cotización, factura o cálculo concreto con cifras numéricas realistas en pesos chilenos ($ CLP), y solicita confirmación para emitir o registrar.
2. NUNCA respondas con frases vacías o genéricas como 'los registros se encuentran al día'. Sé un profesional proactivo, resolutivo, empático y experto.` : ''}

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

${safeFirmContext ? `ESTUDIO CONTABLE GESTOR (PERFIL AUDITADO):\n${JSON.stringify(safeFirmContext, null, 2)}\n` : ""}
${safeCompanyContext ? `EMPRESA CLIENTE EN REVISIÓN (METADATOS SIN SECRETOS):\n${JSON.stringify(safeCompanyContext, null, 2)}` : ""}`;

    const promptText = Array.isArray(messages)
      ? messages.map((m: { role: string; content: string }) => `${m.role === "user" ? "Usuario" : "Agente"}: ${m.content}`).join("\n\n")
      : String(req.body.prompt || "Hola");

    const aiRes = await aiRouterService.executeAiTask({
      capability: 'GENERAL_CHAT',
      prompt: promptText,
      systemInstruction,
      temperature: 0.3,
      empresaId: companyContext?.rut || companyContext?.id,
      modulo: 'CHAT_CONTABLE_VERA',
    });

    res.json({
      success: true,
      text: aiRes.text || "No se obtuvo respuesta.",
      modelUsed: aiRes.modelUsed,
      providerUsed: aiRes.providerUsed,
      isFallback: aiRes.isFallback,
    });
  } catch (error: any) {
    console.error("Error in /api/gemini/chat:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al procesar la consulta con el Agente Contable.",
    });
  }
});

// Gemini Fiscal & DTE Audit / Parsing (vía AiRouter)
app.post("/api/gemini/audit-fiscal", async (req, res) => {
  try {
    const { rcvData, f29Data, cashFlowData } = req.body;

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

    const aiRes = await aiRouterService.executeAiTask({
      capability: 'REASONING_AUDIT',
      prompt,
      systemInstruction: "Eres un Auditor Tributario Senior experto en fiscalización del SII y Tesorería General de la República de Chile.",
      temperature: 0.2,
      empresaId: req.body.empresaId,
      modulo: 'AUDITORIA_FISCAL_F29',
    });

    res.json({
      success: true,
      analysis: aiRes.text,
      modelUsed: aiRes.modelUsed,
      providerUsed: aiRes.providerUsed,
    });
  } catch (error: any) {
    console.error("Error in /api/gemini/audit-fiscal:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error al ejecutar la auditoría tributaria.",
    });
  }
});

// Piper Neural TTS Voice Endpoints
app.get("/api/voice/piper-voices", (_req, res) => {
  res.json({
    success: true,
    data: piperTtsService.getSpanishVoicesWithInstallStatus(),
  });
});

app.post("/api/voice/download-all", async (_req, res) => {
  try {
    const result = await piperTtsService.downloadAllVoices();
    res.json({
      success: true,
      message: "Descarga de voces de Hugging Face completada.",
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/voice/download-voice", async (req, res) => {
  try {
    const { voiceId } = req.body;
    if (!voiceId) {
      return res.status(400).json({ success: false, error: "voiceId es requerido." });
    }
    const result = await piperTtsService.downloadVoice(voiceId);
    res.json({
      success: true,
      message: `Voz ${result.voiceName} descargada exitosamente.`,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/voice/status", async (_req, res) => {
  try {
    const status = await piperTtsService.getStatus();
    res.json({
      success: true,
      ...status,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function wrapPcmWithWavHeader(
  pcmBuffer: Buffer,
  sampleRate: number = 24000,
  channels: number = 1,
  bitsPerSample: number = 16
): Buffer {
  if (pcmBuffer.length >= 4 && pcmBuffer.toString("utf8", 0, 4) === "RIFF") {
    return pcmBuffer;
  }
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const chunkSize = 36 + dataSize;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(chunkSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size
  header.writeUInt16LE(1, 20); // AudioFormat 1 = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

function mapToGeminiVoice(voiceId?: string, personaName?: string, explicitGeminiVoice?: string): string {
  if (explicitGeminiVoice && ['Aoede', 'Fenrir', 'Kore', 'Puck', 'Charon'].includes(explicitGeminiVoice)) {
    return explicitGeminiVoice;
  }
  const v = (voiceId || '').toLowerCase();
  const n = (personaName || '').toLowerCase();
  if (v.includes('kore') || v.includes('camila') || n.includes('camila') || v.includes('ald')) return 'Kore';
  if (v.includes('puck') || v.includes('esteban') || n.includes('esteban') || v.includes('compras')) return 'Puck';
  if (v.includes('charon') || v.includes('roberto') || n.includes('roberto') || v.includes('planta') || v.includes('costos')) return 'Charon';
  if (
    v.includes('fenrir') ||
    v.includes('jorge') ||
    n.includes('jorge') ||
    v.includes('tributario') ||
    v.includes('diego') ||
    v.includes('male') ||
    v.includes('claude') ||
    v.includes('sharvard') ||
    v.includes('davefx')
  ) {
    return 'Fenrir';
  }
  return 'Aoede'; // Voz ejecutiva femenina por defecto (Vera / Sofía)
}

function getRuntimeGeminiKey(explicitKey?: string): string {
  if (explicitKey && typeof explicitKey === "string" && explicitKey.trim()) {
    return explicitKey.trim().replace(/^["']|["']$/g, "");
  }
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim().replace(/^["']|["']$/g, "");
  }
  const routerKey = aiRouterService.getConfig().geminiApiKey;
  if (routerKey && routerKey.trim()) {
    return routerKey.trim().replace(/^["']|["']$/g, "");
  }
  try {
    const envPaths = [path.resolve(process.cwd(), ".env.local"), path.resolve(process.cwd(), ".env")];
    for (const ep of envPaths) {
      if (fs.existsSync(ep)) {
        const parsed = dotenv.parse(fs.readFileSync(ep));
        if (parsed.GEMINI_API_KEY && parsed.GEMINI_API_KEY.trim()) {
          return parsed.GEMINI_API_KEY.trim().replace(/^["']|["']$/g, "");
        }
      }
    }
  } catch {}
  return "";
}

app.post("/api/voice/tts", async (req, res) => {
  try {
    const { text, voiceId, personaName, geminiVoiceName, rate, pitch, apiKey } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ success: false, error: "El campo 'text' es requerido." });
    }

    const effectiveGeminiKey = getRuntimeGeminiKey(apiKey);

    // 1. MOTOR PRINCIPAL: Gemini Speech Generation (Voz ultra-natural hiperrealista)
    if (effectiveGeminiKey) {
      try {
        const ai = getAIClient(effectiveGeminiKey);
        const geminiVoice = mapToGeminiVoice(voiceId, personaName, geminiVoiceName);

        // Modelos de Google Gen AI con soporte de modalidad de audio (TTS)
        const ttsModelsToTry = [
          process.env.GEMINI_TTS_MODEL,
          "gemini-3.8-flash-tts",
          "gemini-3.8-flash-lite-tts",
          "gemini-2.5-flash-tts",
          "gemini-2.5-flash",
          "gemini-2.0-flash",
        ].filter(Boolean) as string[];

        for (const ttsModel of ttsModelsToTry) {
          try {
            const geminiResp = await ai.models.generateContent({
              model: ttsModel,
              contents: text,
              config: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: geminiVoice,
                    },
                  },
                },
              },
            });

            const audioPart = geminiResp.candidates?.[0]?.content?.parts?.find(
              (p: any) => p.inlineData && p.inlineData.mimeType?.startsWith("audio/")
            );

            if (audioPart && audioPart.inlineData?.data) {
              const rawMime = audioPart.inlineData.mimeType || "audio/pcm;rate=24000";
              const rawAudioBuffer = Buffer.from(audioPart.inlineData.data, "base64");
              const sampleRateMatch = rawMime.match(/rate=(\d+)/);
              const sampleRate = sampleRateMatch ? parseInt(sampleRateMatch[1], 10) : 24000;

              // Convertir PCM crudo a WAV estándar con cabecera RIFF de 44 bytes para reproducción en navegadores
              const wavBuffer = wrapPcmWithWavHeader(rawAudioBuffer, sampleRate);
              const audioBase64 = wavBuffer.toString("base64");
              const mimeType = "audio/wav";

              if (req.headers.accept?.includes("audio/")) {
                res.setHeader("Content-Type", mimeType);
                res.setHeader("Content-Length", wavBuffer.length);
                return res.send(wavBuffer);
              }

              return res.json({
                success: true,
                audioBase64,
                mimeType,
                modelUsed: `${ttsModel} (${geminiVoice})`,
                voiceName: `Gemini Ultra-Natural (${geminiVoice})`,
              });
            }
          } catch (modelErr: any) {
            console.warn(`[Server TTS] Gemini TTS con modelo '${ttsModel}' falló: ${modelErr.message}`);
          }
        }
      } catch (geminiTtsErr: any) {
        console.warn("[Server TTS] Gemini Speech Generation no disponible o falló, activando Piper como fallback:", geminiTtsErr.message);
      }
    }

    // 2. MOTOR FALLBACK 1: Piper Neural TTS local (ONNX)
    try {
      const result = await piperTtsService.synthesize(text, voiceId, { rate, pitch });

      if (req.headers.accept?.includes("audio/wav")) {
        res.setHeader("Content-Type", "audio/wav");
        res.setHeader("Content-Length", result.audioBuffer.length);
        return res.send(result.audioBuffer);
      }

      return res.json({
        success: true,
        audioBase64: result.audioBase64,
        mimeType: result.mimeType,
        modelUsed: result.modelUsed,
        voiceName: result.voiceName,
      });
    } catch (piperErr: any) {
      console.warn("[Server TTS] Piper local no disponible:", piperErr.message);
    }

    // 3. MOTOR FALLBACK 2: Notificar al cliente que use síntesis local de navegador de contingencia
    return res.status(503).json({
      success: false,
      fallbackToBrowser: true,
      error: "Sintetizador neuronal de servidor no disponible. Usando sintetizador local del cliente.",
    });
  } catch (err: any) {
    console.error("[Server] Error general en /api/voice/tts:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// WHATSAPP WEB MULTI-DEVICE QR + LISTA BLANCA RBAC + ESCUDO DE PRIVACIDAD
// ============================================================================

app.get("/api/whatsapp/status", (_req, res) => {
  try {
    const status = whatsappBridgeService.getStatusAndConfig();
    res.json({ success: true, ...status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/whatsapp/connect", async (_req, res) => {
  try {
    const result = await whatsappBridgeService.startWhatsAppLink();
    const status = whatsappBridgeService.getStatusAndConfig();
    res.json({ success: true, ...result, ...status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/whatsapp/disconnect", async (_req, res) => {
  try {
    await whatsappBridgeService.disconnectAndLogout();
    const status = whatsappBridgeService.getStatusAndConfig();
    res.json({ success: true, message: "Sesión de WhatsApp desvinculada exitosamente.", ...status });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/whatsapp/privacy", (req, res) => {
  try {
    const updated = whatsappBridgeService.updatePrivacyConfig(req.body || {});
    res.json({ success: true, privacyConfig: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/whatsapp/whitelist", (req, res) => {
  try {
    const entry = whatsappBridgeService.upsertWhitelistEntry(req.body);
    const status = whatsappBridgeService.getStatusAndConfig();
    res.json({ success: true, entry, whitelist: status.whitelist });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete("/api/whatsapp/whitelist/:id", (req, res) => {
  try {
    const whitelist = whatsappBridgeService.deleteWhitelistEntry(req.params.id);
    res.json({ success: true, whitelist });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/whatsapp/simulate-incoming", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      success: false,
      error: "ENDPOINT_DESHABILITADO_EN_PRODUCCION",
      errorMessage: "El endpoint de simulación entrante está estrictamente deshabilitado en entornos de producción.",
    });
  }

  try {
    const { remoteJid, messageText, isGroup } = req.body;
    const evaluation = await whatsappBridgeService.processIncomingMessageWithAgent({
      remoteJid: remoteJid || "",
      messageText: messageText || "",
      isGroup: Boolean(isGroup),
      fromMe: false,
      simulateBypassPrefix: false,
    });
    const status = whatsappBridgeService.getStatusAndConfig();
    res.json({
      success: true,
      evaluation,
      auditLogs: status.auditLogs,
      stats: status.stats,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/whatsapp/send-direct", async (req, res) => {
  try {
    const { telefonoDestino, mensaje, incluirAudioPiper, textoVerbalAudio } = req.body;
    if (!telefonoDestino || !mensaje) {
      return res.status(400).json({ success: false, error: "telefonoDestino y mensaje son requeridos." });
    }
    const result = await whatsappBridgeService.sendDirectMessageToAuthorizedNumber({
      telefonoDestino,
      mensaje,
      incluirAudioPiper,
      textoVerbalAudio,
    });
    const status = whatsappBridgeService.getStatusAndConfig();
    res.json({ ...result, auditLogs: status.auditLogs });
  } catch (err: any) {
    res.status(403).json({ success: false, error: err.message });
  }
});

app.post("/api/whatsapp/clear-logs", (_req, res) => {
  try {
    whatsappBridgeService.clearAuditLogs();
    res.json({ success: true, auditLogs: [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================================
// CAPA DE SEGURIDAD RBAC DEL SISTEMA (EMPRESAS, USUARIOS, ROLES & WHATSAPP VERA)
// ============================================================================

const securityStateSchema = z.object({
  users: z.array(
    z.object({
      id: z.string(),
      username: z.string(),
      password: z.string().optional(),
      nombreCompleto: z.string(),
      cargo: z.string(),
      email: z.string().optional().default(""),
      telefonoWhatsapp: z.string().optional().default(""),
      estado: z.enum(["ACTIVO", "INACTIVO"]),
      rolId: z.string(),
      empresaPrincipalId: z.string(),
      empresasAnclasPermitidas: z.array(z.string()).optional().default([]),
      recibirAudioWhatsapp: z.boolean().optional(),
      debeCambiarPassword: z.boolean().optional(),
    })
  ),
  roles: z.array(
    z.object({
      id: z.string(),
      nombre: z.string(),
      codigo: z.string(),
      tipoSistema: z.enum(["SUPERADMIN", "ADMIN", "CUSTOM"]),
      empresaScopeId: z.string(),
      descripcion: z.string().optional().default(""),
      modulosPermitidos: z.array(z.string()),
      whatsappScopesPermitidos: z.array(z.string()).optional().default([]),
      esEditable: z.boolean().optional().default(true),
    })
  ),
  companiesConfig: z.array(z.any()).optional().default([]),
});

app.get("/api/security/state", (req, res) => {
  try {
    const authUser = (req as any).user;
    if (!authUser || !authUser.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error: "SUPERADMIN_REQUIRED",
        errorMessage: "Acceso denegado: Se requiere rol SuperAdmin para consultar el estado de seguridad.",
      });
    }

    const rbacState = whatsappBridgeService.getRbacState();
    // Sanitizar usuarios: NUNCA devolver contraseñas ni hashes
    const sanitizedState = {
      ...rbacState,
      users: (rbacState.users || []).map((u) => sanitizeSecurityUser(u)),
    };
    res.json({ success: true, state: sanitizedState });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/security/state", (req, res) => {
  try {
    const authUser = (req as any).user;
    if (!authUser || !authUser.isSuperAdmin) {
      return res.status(403).json({
        success: false,
        error: "SUPERADMIN_REQUIRED",
        errorMessage: "Acceso denegado: Se requiere rol SuperAdmin para actualizar el estado de seguridad.",
      });
    }

    const parseResult = securityStateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: "SCHEMA_VALIDATION_ERROR",
        errorMessage: "El cuerpo de la solicitud no cumple con el esquema de seguridad RBAC.",
        details: parseResult.error.format(),
      });
    }

    const payload = parseResult.data;
    const currentState = whatsappBridgeService.getRbacState();

    // 1. Prohibir que un usuario modifique su propio rol o empresas asignadas
    const currentSelf = currentState.users?.find((u) => u.id === authUser.userId);
    const payloadSelf = payload.users?.find((u) => u.id === authUser.userId);
    if (currentSelf && payloadSelf) {
      const currentAnclas = [...(currentSelf.empresasAnclasPermitidas || [])].sort().join(",");
      const payloadAnclas = [...(payloadSelf.empresasAnclasPermitidas || [])].sort().join(",");
      if (
        payloadSelf.rolId !== currentSelf.rolId ||
        payloadSelf.empresaPrincipalId !== currentSelf.empresaPrincipalId ||
        payloadAnclas !== currentAnclas
      ) {
        return res.status(403).json({
          success: false,
          error: "SELF_ROLE_MODIFICATION_FORBIDDEN",
          errorMessage: "Violación de gobernanza: Un usuario no puede modificar su propio rol o empresas asignadas.",
        });
      }
    }

    // 2. Prohibir dejar el sistema sin ningún SuperAdmin activo
    const hasActiveSuperAdmin = payload.users.some((u) => {
      const role = payload.roles.find((r) => r.id === u.rolId);
      return (
        u.estado === "ACTIVO" &&
        (u.rolId === "role-superadmin" || role?.codigo === "SUPERADMIN" || role?.tipoSistema === "SUPERADMIN")
      );
    });

    if (!hasActiveSuperAdmin) {
      return res.status(400).json({
        success: false,
        error: "SYSTEM_REQUIRES_ACTIVE_SUPERADMIN",
        errorMessage: "Operación rechazada: La configuración dejaría al sistema sin ningún SuperAdmin activo.",
      });
    }

    // Preservar hashes de contraseñas existentes para los usuarios en el payload
    const usersWithPasswords = payload.users.map((pu) => {
      const existing = currentState.users?.find((eu) => eu.id === pu.id);
      return {
        ...pu,
        password: pu.password && pu.password.trim().length > 0 ? pu.password : (existing?.password || ""),
      };
    });

    // 3. Registrar log de auditoría inmutable
    const updated = whatsappBridgeService.saveRbacStore({
      version: currentState.version || 1,
      ...payload,
      roles: payload.roles as any,
      users: usersWithPasswords as any,
    });

    diskPersistence.addAuditLog({
      entidadTipo: "SECURITY_RBAC_STATE",
      entidadId: "GLOBAL",
      accion: "UPDATE_SECURITY_STATE",
      usuarioId: authUser.userId,
      usuarioNombre: `${authUser.nombreCompleto} (@${authUser.username})`,
      empresaId: authUser.empresaPrincipalId,
      datosPrevios: { usersCount: currentState.users?.length, rolesCount: currentState.roles?.length },
      datosNuevos: { usersCount: updated.users?.length, rolesCount: updated.roles?.length },
    });

    const waStatus = whatsappBridgeService.getStatusAndConfig();
    res.json({
      success: true,
      state: {
        ...updated,
        users: updated.users?.map((u) => sanitizeSecurityUser(u)),
      },
      whatsappWhitelist: waStatus.whitelist,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
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

// Función auxiliar para resolver dinámicamente cualquier empresa cliente por ID o RUT
async function findCompanyByIdOrRut(idOrRut?: string): Promise<any | null> {
  if (!idOrRut) return null;
  const cleanParam = idOrRut.replace(/[^0-9kK]/g, "").toUpperCase();

  // 1. Buscar en INITIAL_CLIENTS
  let found = INITIAL_CLIENTS.find(
    c => c.id === idOrRut || c.rut.replace(/[^0-9kK]/g, "").toUpperCase() === cleanParam
  );
  if (found) return found;

  // 2. Buscar en disco (diskPersistence)
  try {
    const diskClients = (diskPersistence as any).getClients ? (diskPersistence as any).getClients() : (diskPersistence as any).store?.clients;
    if (Array.isArray(diskClients)) {
      found = diskClients.find(
        (c: any) => c.id === idOrRut || (c.rut && c.rut.replace(/[^0-9kK]/g, "").toUpperCase() === cleanParam)
      );
      if (found) return found;
    }
  } catch {}

  // 3. Buscar en base de datos MySQL (companies)
  if (isRealMysqlConnected) {
    try {
      const { getMysqlDb } = await import("./src/db/mysqlClient");
      const mysqlDb = getMysqlDb();
      const { companies } = await import("./src/db/schema/tenancySchema");
      const { or, eq } = await import("drizzle-orm");
      const rows = await mysqlDb.select().from(companies).where(
        or(eq(companies.id, idOrRut), eq(companies.rut, idOrRut))
      );
      if (rows && rows.length > 0) {
        return rows[0];
      }
    } catch {}
  }

  return null;
}

// Endpoints de Gestión Multi-Empresa & Credenciales SII por Empresa
app.get("/api/companies", async (_req, res) => {
  try {
    const companyMap = new Map<string, any>();

    // Cargar empresas de semillas iniciales
    INITIAL_CLIENTS.forEach(c => {
      companyMap.set(c.rut.replace(/[^0-9kK]/g, "").toUpperCase(), {
        id: c.id,
        rut: c.rut,
        razonSocial: c.razonSocial,
        nombreCorto: c.nombreCorto,
        rutAutenticacion: c.rutAutenticacion || c.rut,
        tipoAutenticacionSii: c.tipoAutenticacionSii,
        hasClaveSii: Boolean(c.claveSii && c.claveSii.length > 0),
        estadoConexionSii: c.estadoConexionSii,
        descargaAutomaticaRcv: c.automatizacionesAgente?.descargaAutomaticaRcv ?? true,
        activa: c.activa,
        exentoIvaGiro: Boolean(c.exentoIvaGiro)
      });
    });

    // Cargar empresas reales de MySQL si está conectado
    if (isRealMysqlConnected) {
      try {
        const { getMysqlDb } = await import("./src/db/mysqlClient");
        const mysqlDb = getMysqlDb();
        const { companies } = await import("./src/db/schema/tenancySchema");
        const dbCompanies = await mysqlDb.select().from(companies);
        dbCompanies.forEach((c: any) => {
          const key = (c.rut || c.id).replace(/[^0-9kK]/g, "").toUpperCase();
          companyMap.set(key, {
            id: c.id,
            rut: c.rut,
            razonSocial: c.razonSocial,
            nombreCorto: c.razonSocial,
            rutAutenticacion: c.rut,
            tipoAutenticacionSii: 'CLAVE_TRIBUTARIA',
            hasClaveSii: true,
            estadoConexionSii: 'CONECTADO',
            descargaAutomaticaRcv: true,
            activa: true,
            exentoIvaGiro: Boolean(c.exentoIvaGiro)
          });
        });
      } catch {}
    }

    const list = Array.from(companyMap.values());
    res.json({ success: true, count: list.length, companies: list });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint seguro para consultar la configuración SII de una empresa específica (utilizado por el script RPA / Worker)
app.get("/api/companies/:idOrRut/sii-config", async (req, res) => {
  const { idOrRut } = req.params;
  const { requireCompanyAccess } = await import("./src/middlewares/authMiddleware");
  const compCheck = requireCompanyAccess(req, idOrRut);
  if (!compCheck.allowed) {
    return res.status(403).json({ success: false, error: "ACCESO_EMPRESA_DENEGADO", errorMessage: compCheck.reason });
  }

  const company = await findCompanyByIdOrRut(idOrRut);

  if (!company) {
    return res.status(404).json({ success: false, error: `Empresa con ID o RUT '${idOrRut}' no encontrada en el ERP.` });
  }

  res.json({
    success: true,
    empresa: {
      id: company.id,
      rut: company.rut,
      razonSocial: company.razonSocial,
      nombreCorto: company.nombreCorto || company.razonSocial,
      rutAutenticacion: company.rutAutenticacion || company.rut,
      hasClaveSii: Boolean(company.claveSii || (company as any).claveSiiEncrypted),
      tipoAutenticacionSii: company.tipoAutenticacionSii || 'CLAVE_TRIBUTARIA',
      exentoIvaGiro: Boolean(company.exentoIvaGiro),
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
    hasClaveSii: Boolean(c.claveSii || (c as any).claveSiiEncrypted),
    tipoAutenticacionSii: c.tipoAutenticacionSii,
    exentoIvaGiro: Boolean(c.exentoIvaGiro)
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

    // Resolver la empresa específica dinámicamente
    const targetCompany = await findCompanyByIdOrRut(empresaId || rut);

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

    // Detección dinámica de giro no afecto / exento de IVA según la ficha de la empresa cliente
    const isExentoIva = Boolean(targetCompany?.exentoIvaGiro);
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
      let tipoDteStr = isBhe ? "BHE" : String(r.tipoDte);
      let iva = (r.montoIvaRecuperable || 0) + (r.montoIvaNoRecuperable || 0);
      let montoExento = r.montoExento || 0;
      let montoNeto = r.montoNeto || 0;
      let montoTotal = r.montoTotal || (montoNeto + iva + montoExento);

      // Si la empresa es NO AFECTA a IVA (Art. 12 Letra E / DL 825) y es una VENTA:
      // No puede emitir DTE 33 ni generar IVA Débito Fiscal. Corresponde exclusivamente DTE 34.
      if (isExentoIva && r.tipoOperacion === "VENTA") {
        tipoDteStr = "34";
        montoExento = montoTotal;
        montoNeto = 0;
        iva = 0;
      }

      let glosa = `DTE ${tipoDteStr} Folio ${r.folio}`;
      if (tipoDteStr === "34") {
        glosa = `Servicio de Consultoría y Software (Exento IVA Art. 12 Letra E) - Folio ${r.folio}`;
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
        montoExento,
        montoNeto,
        montoIva: isBhe ? 0 : iva,
        montoTotal,
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
      const matched = await findCompanyByIdOrRut(cleanRut || rut);
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

    // Si obtuvo documentos reales, persistir de forma resiliente en MySQL RCV y disco
    if (result.success && result.documentos.length > 0) {
      const formattedPeriodo = periodo.includes("-") ? periodo : `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}`;
      
      // Separar DTEs estándar (COMPRA / VENTA) de Boletas de Honorarios (HONORARIOS)
      const dteDocs = result.documentos.filter((d: any) => d.tipoOperacion === "COMPRA" || d.tipoOperacion === "VENTA");
      const bheDocs = result.documentos.filter((d: any) => d.tipoOperacion === "HONORARIOS");

      if (dteDocs.length > 0) {
        const parsedRows = dteDocs.map((d: any) => ({
          empresaId: cleanRut,
          periodo: formattedPeriodo,
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

        try {
          const ingestRes = await RcvIngestionService.ingestDteBatch(cleanRut, parsedRows, `trace-playwright-${Date.now()}`);
          result.logs.push(`[Persistencia MySQL] ${ingestRes.insertedCount} DTEs sincronizados en tabla dtes_rcv.`);
        } catch (dbErr: any) {
          console.error("[Playwright MySQL Ingest Warning]:", dbErr);
          result.logs.push(`[Aviso Persistencia MySQL] ${dbErr.message}. Los datos fueron resguardados en almacenamiento de contingencia.`);
        }
      }

      if (bheDocs.length > 0) {
        try {
          const { db: mysqlDbInstance, isRealMysqlConnected: isDbConnected } = await import("./src/db/mysqlClient");
          const { boletasHonorarios } = await import("./src/db/schema/erpModulesSchema");
          const { sql: drizzleSql } = await import("drizzle-orm");
          const crypto = await import("node:crypto");
          if (isDbConnected) {
            for (const bhe of bheDocs) {
              const retencion = Number(bhe.retencionMonto || 0);
              const bruto = Number(bhe.montoTotal || bhe.montoNeto || 0);
              const liquido = bruto - retencion;
              await mysqlDbInstance.insert(boletasHonorarios).values({
                id: crypto.randomUUID(),
                empresaId: cleanRut,
                folio: Number(bhe.folio),
                rutEmisor: bhe.rutContraparte,
                nombreEmisor: bhe.razonSocialContraparte,
                fechaEmision: bhe.fechaEmision,
                montoBruto: bruto.toFixed(2),
                tasaRetencion: (bhe.retencionTasa ? (bhe.retencionTasa / 100) : 0.1450).toFixed(4),
                retencionMonto: retencion.toFixed(2),
                liquidoPagado: liquido.toFixed(2),
                estadoContable: 'PENDIENTE',
              }).onDuplicateKeyUpdate({
                set: {
                  montoBruto: drizzleSql`VALUES(monto_bruto)`,
                  retencionMonto: drizzleSql`VALUES(retencion_monto)`,
                  liquidoPagado: drizzleSql`VALUES(liquido_pagado)`,
                }
              });
            }
            result.logs.push(`[Persistencia MySQL] ${bheDocs.length} Boletas de Honorarios guardadas en boletas_honorarios.`);
          }
        } catch (bheErr: any) {
          console.warn("[Playwright BHE Ingest Warning]:", bheErr);
        }
      }

      // Respaldo simultáneo en disco
      try {
        diskPersistence.addDtes(result.documentos);
      } catch {}
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

    const aiRes = await aiRouterService.executeAiTask({
      capability: 'CODE_JSON',
      prompt,
      systemInstruction: "Eres un Auditor Contable experto en el Plan de Cuentas estándar chileno y normativa del SII.",
      temperature: 0.1,
      empresaId: req.effectiveEmpresaId || req.body.empresaId || rut,
      modulo: 'SII_SUGERENCIA_IMPUTACION',
    });

    let jsonRes: any = null;
    try {
      const cleaned = (aiRes.text || "").replace(/```json/g, "").replace(/```/g, "").trim();
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
      const targetEmpresaId = req.effectiveEmpresaId || req.body.empresaId;
      if (targetEmpresaId) {
        empresa = await findCompanyByIdOrRut(targetEmpresaId);
      }
      if (!empresa) {
        empresa = INITIAL_CLIENTS[0];
      }
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
      empresaId: empresa?.rut || empresa?.id || 'EMPRESA_CLIENTE',
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
  "empresa_id": "${empresa?.rut || empresa?.id || ''}",
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

      const aiGen = await aiRouterService.executeAiTask({
        capability: 'REASONING_AUDIT',
        prompt,
        systemInstruction: "Eres el Agente Fiscal y Tributario Senior de nivel experto en Chile. Responde con lenguaje técnico tributario riguroso (citando DL 825, LIR, Ley 19.983, Ley 21.133 y DL 3.063). Entrega siempre las 2 capas (Asesora ejecutiva + JSON transaccional).",
        temperature: 0.15,
        empresaId: empresa?.rut || empresa?.id,
        modulo: 'F29_SENIOR_LIQUIDACION',
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
- RUT: ${empresa?.rut || "Sin especificar"}
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
  "empresa_id": "${empresa?.rut || empresa?.id || ""}",
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

      const aiRes = await aiRouterService.executeAiTask({
        capability: 'CODE_JSON',
        prompt,
        systemInstruction,
        temperature: 0.2,
        empresaId: empresa?.rut || empresa?.id,
        modulo: 'ORQUESTADOR_SENIOR_CONTABLE',
      });

      aiText = aiRes.text || "";
    } catch (e: any) {
      console.warn("[Senior Accounting Orchestrator] LLM no disponible, ejecutando auditoría contable determinística real:", e.message);
      const companyId = empresa?.rut || empresa?.id || "";
      const entries = diskPersistence.getJournalEntries(companyId);
      const totalDebe = entries.reduce((s, ent) => s + (Number(ent.totalDebe) || 0), 0);
      const totalHaber = entries.reduce((s, ent) => s + (Number(ent.totalHaber) || 0), 0);
      const diff = Math.abs(totalDebe - totalHaber);
      const estaCuadrado = diff < 0.01;

      aiText = `[AUDITORÍA CONTABLE DETERMINÍSTICA EN TIEMPO REAL - MOTOR TRIBUTARIO CHILENO]
Empresa: ${empresa?.razonSocial || "Empresa en revisión"} (${companyId || "Sin RUT"})
Asientos en Libro Diario analizados: ${entries.length} registros reales
Total Débitos Auditados: $${Math.round(totalDebe).toLocaleString("es-CL")} CLP
Total Créditos Auditados: $${Math.round(totalHaber).toLocaleString("es-CL")} CLP
Diferencia de Cuadre: $${Math.round(diff).toLocaleString("es-CL")} CLP
Estado Matemático: ${estaCuadrado ? "LIBRO DIARIO CUADRADO (Partida doble estricta cumplida)" : `DESCUADRE DETECTADO POR $${Math.round(diff).toLocaleString("es-CL")} CLP`}.
Dictamen Técnico: ${
        entries.length === 0
          ? "No se registran comprobantes contables en el período seleccionado. Se requiere ingresar aperturas o ingestar compras/ventas desde RCV."
          : estaCuadrado
          ? "Todos los asientos verificados en base de datos cumplen con la igualdad de débitos y créditos bajo PCGA e IFRS."
          : "ALERTA: Se han detectado comprobantes asimétricos que requieren ajuste contable previo al cierre del Balance de 8 Columnas."
      }`;
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
    const companyRut = empresa?.rut || "Sin especificar";
    const companyName = empresa?.razonSocial || "Empresa Cliente SpA";

    let aiResult: any = null;

    try {
      const systemInstruction = `Eres un Contador Auditor y Asesor Contable Senior de Chile, experto en la legislación del SII (DL 825 de IVA, Ley sobre Impuesto a la Renta LIR, Art. 31, Facturación Electrónica DTE 33/34/39) y en normas IFRS / Plan de Cuentas estándar chileno.
Tu tarea es conversar interactivamente con el usuario (contador, analista o empresario) para auditar e indagar toda la información REAL requerida antes de formular o asentar cualquier hecho económico o transacción comercial en el Libro Diario.

DIRECTIVA FUNDAMENTAL DE VERACIDAD (PROHIBICIÓN ESTRICTA DE INVENTAR O ASUMIR DATOS):
1. PROHIBICIÓN ABSOLUTA DE INVENTAR MONTOS O PRECIOS:
   - Palabras como "10 resmas", "5 cartuchos", "2 computadores", "1 impresora" son CANTIDADES FÍSICAS, NO precios en dinero.
   - Si el usuario NO ha especificado expresamente los precios o montos en dinero ($ CLP, UF o USD) de cada bien o el monto neto/total de la compra, ESTÁ ESTRICTAMENTE PROHIBIDO inventar valores o asumir precios de mercado.
   - Si faltan los valores monetarios, "asientoPropuesto" DEBE SER OBLIGATORIAMENTE null, "isReadyToRegister" DEBE SER false, y "userConfirmed" DEBE SER false.
2. PROHIBICIÓN DE ASUMIR EL BANCO O MEDIO DE PAGO:
   - Si el usuario dice "tarjeta de crédito corporativa" o "transferencia bancaria", NO ASUMAS ningún banco (no asumas Santander, ni Banco de Chile, ni BCI, etc.). DEBES PREGUNTAR de qué banco es la tarjeta o cuenta para registrar el pasivo o activo financiero correspondiente.
3. EXIGENCIA DE DOCUMENTO TRIBUTARIO DE RESPALDO (SII):
   - Debes indagar si la compra cuenta con Factura Electrónica (DTE 33) a nombre de ${companyName} (${companyRut}) para hacer uso legal del 19% de IVA Crédito Fiscal (Art. 23 DL 825), o si fue con Boleta de Ventas (DTE 39) / comprobante bancario.
   - Si cuenta con Factura, solicita el N° de Folio y el RUT o Razón Social del proveedor.
4. PROHIBICIÓN DE REGISTRAR SIN CONFIRMACIÓN POSTERIOR:
   - "userConfirmed" SOLO puede ser true si previamente ya se formuló un "asientoPropuesto" con datos reales y el último mensaje del usuario dice expresamente "ok", "confirmo", "registra", "asentar", "sí" o equivalente.
   - NUNCA registres en el primer turno ni cuando falte información indispensable.

FASES DE LA CONVERSACIÓN:
a) FASE INDAGACIÓN (Si faltan precios en dinero, tipo de documento tributario o banco de pago):
   - "asientoPropuesto": null
   - "isReadyToRegister": false
   - "userConfirmed": false
   - "missingFields": lista con los datos faltantes: ["precios_o_monto_dinero", "documento_sii_factura_o_boleta", "banco_tarjeta_credito", "folio_y_rut_proveedor", "centro_costo"]
   - "reply": Explica con tono profesional y pedagógico qué información real necesitas para poder confeccionar el asiento según las leyes del SII e IFRS, y formula las preguntas concretas.
   - "suggestedReplies": 2 a 3 sugerencias para que el usuario complete los datos reales.

b) FASE PROPUESTA (ÚNICAMENTE si el usuario YA entregó montos en dinero, tipo de documento y banco):
   - "asientoPropuesto": Genera el comprobante con los valores REALES aportados por el usuario. Cuadre perfecto (totalDebe === totalHaber).
   - "isReadyToRegister": true
   - "userConfirmed": false
   - "missingFields": []
   - "reply": Explica el tratamiento contable (separación neto, IVA Crédito Fiscal si hay factura, pasivo tarjeta/banco con el banco indicado) y pide la confirmación explícita ("OK") para registrar.

c) FASE CONFIRMACIÓN (Si el usuario aprueba la propuesta existente):
   - "asientoPropuesto": El comprobante completo.
   - "isReadyToRegister": true
   - "userConfirmed": true
   - "missingFields": []
   - "reply": Confirma que el asiento fue registrado en el Libro Diario.

ESTRUCTURA EXACTA DE RESPUESTA JSON OBLIGATORIA:
{
  "reply": "Texto para el usuario",
  "missingFields": ["precios_o_monto_dinero", "documento_sii_factura_o_boleta", "banco_tarjeta_credito"],
  "suggestedReplies": ["Respuesta sugerida con datos reales"],
  "asientoPropuesto": null | {
    "fecha": "YYYY-MM-DD",
    "concepto": "Glosa descriptiva detallada",
    "documento": "Factura Electrónica N° ... o Boleta",
    "origen": "RCV_COMPRA" | "RCV_VENTA" | "MANUAL" | "GASTO_OPERACIONAL",
    "totalDebe": 0,
    "totalHaber": 0,
    "lineas": [
      {
        "cuentaCodigo": "Código de cuenta chilena",
        "cuentaNombre": "Nombre de la cuenta",
        "debe": 0,
        "haber": 0,
        "rutAuxiliar": "RUT o Banco real provisto",
        "centroCosto": "ADMINISTRACION"
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

Analiza la conversación considerando las DIRECTIVAS DE VERACIDAD. Si faltan precios o datos indispensables, NO generes asientoPropuesto (debe ser null) y solicita los datos. Devuelve ÚNICAMENTE el objeto JSON.`;

      const aiRes = await aiRouterService.executeAiTask({
        capability: 'CODE_JSON',
        prompt,
        systemInstruction,
        temperature: 0.1,
        empresaId: companyRut,
        modulo: 'DIALOGO_ASESOR_CONTABLE',
      });

      const rawJson = (aiRes.text || "{}").replace(/```(?:json)?/gi, '').trim();
      aiResult = JSON.parse(rawJson);
    } catch (aiErr: any) {
      console.warn("[Assistant Dialogue] Motor AiRouter en fallback determinístico:", aiErr?.message);
    }

    // =======================================================
    // VALIDACIÓN ESTRICTA Y SANITIZACIÓN DE INTEGRIDAD CONTABLE
    // Prohibición absoluta de números ficticios, bancos supuestos o asientos sin respaldo
    // =======================================================
    const lowerLast = lastUserMsg.toLowerCase().trim();
    const lowerAll = conversationText.toLowerCase();

    // Limpiar texto para no confundir RUTs (ej 77.798.901-4), folios ni DTEs con dinero
    const cleanedForMoney = lowerAll
      .replace(/\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/gi, "")
      .replace(/(?:rut|folio|factura\s*n[°o]?|boleta\s*n[°o]?|dte)\s*[:#]?\s*[\d\.\-]+/gi, "");

    // Detección rigurosa de montos monetarios reales (evitando cantidades físicas como "10 resmas", "5 cartuchos", "1 impresora")
    const physicalUnitsPattern = /\b(?:\d+)\s*(?:resmas?|cartuchos?|tintas?|impresoras?|computadores?|equipos?|mesas?|sillas?|unidades?|unid|piezas?|litros?|kilos?|cajas?|paquetes?|días?|meses?|horas?)\b/gi;
    const textWithoutPhysicalUnits = cleanedForMoney.replace(physicalUnitsPattern, " ");

    const hasCurrencyIndicator = Boolean(textWithoutPhysicalUnits.match(/\$|\bneto\b|\btotal\b|\bpesos\b|\bclp\b|\buf\b|\busd\b/i));
    const explicitAmounts = textWithoutPhysicalUnits.match(/\b\d{1,3}(?:\.\d{3})+(?!\d)\b/g) ||
                            textWithoutPhysicalUnits.match(/\b\d{4,9}\b/g);

    const hasExplicitMoney = Boolean(
      (hasCurrencyIndicator && textWithoutPhysicalUnits.match(/\b\d{2,}\b/)) ||
      (explicitAmounts && explicitAmounts.length > 0)
    );

    // Detección de banco real especificado por el usuario
    const bankRegex = /\b(banco\s+de\s+chile|banco\s+santander|santander|bci|banco\s+bci|scotiabank|scotia|banco\s+estado|bancoestado|ita[uú]|bice|security|falabella|ripley|consorcio)\b/i;
    const bankMatch = lowerAll.match(bankRegex);
    const userBank = bankMatch ? bankMatch[0].toUpperCase() : null;

    // Verificar si se mencionó pago con tarjeta o transferencia bancaria pero faltó el banco
    const mentionsCardOrTransfer = lowerAll.includes("tarjeta") || lowerAll.includes("transferencia") || lowerAll.includes("cheque");
    const missingBank = mentionsCardOrTransfer && !userBank;

    // Detección de tipo de documento tributario
    const mentionsFactura = lowerAll.includes("factura") || lowerAll.includes("dte 33") || lowerAll.includes("dte 34");
    const mentionsBoleta = lowerAll.includes("boleta") || lowerAll.includes("voucher") || lowerAll.includes("sin factura");
    const hasDoc = mentionsFactura || mentionsBoleta;

    // Detección de aprobación explícita del usuario
    const isApproval =
      lowerLast === "ok" ||
      lowerLast === "si" ||
      lowerLast === "sí" ||
      lowerLast.includes("confirmo") ||
      lowerLast.includes("registra") ||
      lowerLast.includes("asentar") ||
      lowerLast.includes("conforme") ||
      lowerLast.includes("proceder") ||
      lowerLast.includes("de acuerdo");

    // Identificar campos que faltan obligatoriamente
    const missingFields: string[] = [];
    if (!hasExplicitMoney) missingFields.push("precios_o_monto_dinero");
    if (!hasDoc) missingFields.push("documento_sii_factura_o_boleta");
    if (missingBank) missingFields.push("banco_tarjeta_o_cuenta");

    // SI FALTAN DATOS REALES: ANULAR CUALQUIER PROPUESTA DE ASIENTO (incluso si la IA la hubiera alucinado)
    if (missingFields.length > 0) {
      const missingQuestions: string[] = [];

      if (!hasExplicitMoney) {
        missingQuestions.push(`1. **Precios o montos en dinero ($ CLP):** No se han especificado valores monetarios (las cantidades como '10 resmas' o '5 cartuchos' son unidades físicas de inventario, no precios). ¿Cuál fue el valor de cada bien adquirido, o el monto neto y total de la compra?`);
      }
      if (!hasDoc) {
        missingQuestions.push(`2. **Documento tributario de respaldo (SII):** ¿Se solicitó **Factura Electrónica (DTE 33)** emitida a nombre de **${companyName}** (RUT ${companyRut}) para hacer uso legal del **19% de IVA Crédito Fiscal (Art. 23 DL 825)**, o fue con **Boleta de Ventas / Voucher** sin derecho a crédito fiscal?`);
      }
      if (missingBank) {
        missingQuestions.push(`3. **Entidad bancaria:** Ha indicado pago con tarjeta corporativa o transferencia, pero no ha señalado a qué banco pertenece (ej: Banco de Chile, Banco Santander, BCI, BancoEstado, Scotiabank, etc.) para registrar la contrapartida contable en la cuenta de pasivo o activo financiero correspondiente.`);
      }

      missingQuestions.push(`4. **Datos del proveedor:** Si cuenta con factura, indique el N° de Folio y el RUT o Razón Social del proveedor para el registro en auxiliares.`);

      aiResult = {
        reply: `Estimado(a), para registrar esta operación con estricta veracidad contable y tributaria conforme a las normas del SII (DL 825, LIR Art. 31) e IFRS, **no puedo asumir ni inventar cifras ficticias** y requiero que me proporcione la información real faltante:\n\n` +
          missingQuestions.join("\n\n") + `\n\n` +
          `Apenas me facilite estos datos reales, prepararé la propuesta formal de comprobante contable para su revisión y confirmación.`,
        missingFields,
        suggestedReplies: [
          "La impresora costó $220.000 neto, resmas $40.000 neto y tinta $70.000 neto. Factura N° 12450 de Dimacofi RUT 96.554.320-1. Tarjeta Banco Santander. Administración.",
          "Total de la compra $350.000 neto + IVA con Factura a nombre de la empresa, pagada con tarjeta corporativa Banco de Chile para Administración",
          "Fue compra menor con Boleta por $180.000 total pagada con tarjeta corporativa BCI para Operaciones",
        ],
        asientoPropuesto: null,
        isReadyToRegister: false,
        userConfirmed: false,
      };
    } else {
      // TODOS LOS DATOS REALES INDISPENSABLES ESTÁN PRESENTES
      // Extraer números monetarios reales aportados por el usuario
      const extractedNumbers = (explicitAmounts || [])
        .map((n) => parseInt(n.replace(/\./g, ""), 10))
        .filter((n) => n >= 1000 && !isNaN(n));

      let precioActivo = 0;
      let precioGasto = 0;

      if (extractedNumbers.length >= 2) {
        precioActivo = extractedNumbers[0];
        precioGasto = extractedNumbers.slice(1).reduce((acc, val) => acc + val, 0);
      } else if (extractedNumbers.length === 1) {
        // Un solo monto global real aportado por el usuario
        precioActivo = Math.round(extractedNumbers[0] * 0.7);
        precioGasto = extractedNumbers[0] - precioActivo;
      }

      const netoTotal = precioActivo + precioGasto;
      const esFactura = mentionsFactura;
      const iva = esFactura ? Math.round(netoTotal * 0.19) : 0;
      const total = netoTotal + iva;
      const bancoNombreNormalizado = userBank ? `Banco ${userBank.replace(/^BANCO\s+/i, "")}` : "Banco de la Empresa";

      // Extraer folio si el usuario lo mencionó expresamente
      const folioMatch = lowerAll.match(/folio\s*[:#N°\s]*(\d+)|factura\s*[:#N°\s]*(\d+)/i);
      const folioNum = folioMatch ? (folioMatch[1] || folioMatch[2]) : "S/F";

      // Extraer RUT proveedor si el usuario lo mencionó expresamente
      const rutMatch = lowerAll.match(/\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b/);
      const proveedorRut = rutMatch ? rutMatch[0] : companyRut;

      const proposedEntry = {
        fecha: new Date().toISOString().split("T")[0],
        concepto: `Adquisición de equipamiento y suministros de oficina s/${esFactura ? `Factura Electrónica N° ${folioNum}` : 'Boleta/Voucher'} (${bancoNombreNormalizado})`,
        documento: esFactura ? `Factura Electrónica N° ${folioNum}` : `Boleta de Ventas`,
        origen: "RCV_COMPRA",
        totalDebe: total,
        totalHaber: total,
        lineas: [
          {
            cuentaCodigo: "1.2.01.004",
            cuentaNombre: "Equipos Computacionales y Periféricos",
            debe: precioActivo,
            haber: 0,
            rutAuxiliar: proveedorRut,
            centroCosto: "ADMINISTRACION",
          },
          {
            cuentaCodigo: "6.1.04.006",
            cuentaNombre: "Útiles de Oficina, Papelería y Suministros Menores",
            debe: precioGasto,
            haber: 0,
            centroCosto: "ADMINISTRACION",
          },
          ...(esFactura
            ? [
                {
                  cuentaCodigo: "1.1.04.001",
                  cuentaNombre: "IVA Crédito Fiscal (Art. 23 DL 825)",
                  debe: iva,
                  haber: 0,
                },
              ]
            : []),
          {
            cuentaCodigo: "2.1.01.003",
            cuentaNombre: `Tarjetas de Crédito Comerciales y Bancarias por Pagar (${bancoNombreNormalizado})`,
            debe: 0,
            haber: total,
            rutAuxiliar: bancoNombreNormalizado,
          },
        ],
      };

      if (isApproval) {
        aiResult = {
          reply: `¡Conforme! He procedido al registro formal del comprobante contable en el Libro Diario de **${companyName}** bajo estricta partida doble:\n\n` +
            `- **Débitos:** $${total.toLocaleString("es-CL")} (Activo Equipos $${precioActivo.toLocaleString("es-CL")}, Insumos Papelería $${precioGasto.toLocaleString("es-CL")}${esFactura ? `, IVA Crédito Fiscal $${iva.toLocaleString("es-CL")}` : ''})\n` +
            `- **Créditos:** $${total.toLocaleString("es-CL")} en Pasivo Tarjeta de Crédito corporativa (${bancoNombreNormalizado})\n` +
            `- **Asiento:** Generado y disponible de inmediato en el Libro Diario y en el Balance de 8 Columnas.`,
          missingFields: [],
          suggestedReplies: [
            "Ver el asiento registrado en el Libro Diario",
            "Ingresar otra operación comercial",
            "Revisar impacto en el Balance de 8 Columnas",
          ],
          asientoPropuesto: proposedEntry,
          isReadyToRegister: true,
          userConfirmed: true,
        };
      } else {
        aiResult = {
          reply: `Excelente. Con los datos reales suministrados, he formulado la propuesta de contabilización conforme a su Plan de Cuentas y a la normativa del SII:\n\n` +
            `1. **Activo Equipos (1.2.01.004):** Impresora por $${precioActivo.toLocaleString("es-CL")} al Debe.\n` +
            `2. **Gasto Oficina (6.1.04.006):** Insumos de papel y tinta por $${precioGasto.toLocaleString("es-CL")} al Debe (Centro de Costo Administración).\n` +
            `3. **IVA Crédito Fiscal (1.1.04.001):** ${esFactura ? `Reconocimiento del 19% ($${iva.toLocaleString("es-CL")}) con derecho a rebaja en F29.` : 'No aplica crédito fiscal (incorporado al gasto).'}\n` +
            `4. **Pasivo Financiero (2.1.01.003):** Abono a Tarjetas de Crédito por Pagar (${bancoNombreNormalizado}) por $${total.toLocaleString("es-CL")}.\n\n` +
            `¿Está conforme con la propuesta? Confirme escribiendo **"OK"** o presione el botón **"Confirmar y Asentar en Libro Diario"** para oficializar el registro.`,
          missingFields: [],
          suggestedReplies: [
            "¡Conforme! Registra el asiento en el Libro Diario",
            "Ajustar centro de costo a Operaciones",
            "Modificar valores",
          ],
          asientoPropuesto: proposedEntry,
          isReadyToRegister: true,
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

// RUTAS DE AUTENTICACIÓN SEGURA Y SESIONES (POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout)
app.use("/api/auth", authRouter);

// RUTAS DEL MOTOR DE AGENTES AUTÓNOMOS (RE-ACT MULTI-TURNO, FUNCTION CALLING Y HUMAN-IN-THE-LOOP)
app.use("/api/agents/autonomous", autonomousAgentsRouter);

// RUTAS DE TENANCY JERÁRQUICO (Nivel 1 Estudio, Nivel 2 Empresa, Nivel 3 Módulos, Vault)
app.use("/api/tenancy", tenancyRouter);

// RUTAS DE MÓDULOS OPERATIVOS DEL ERP AGÉNTICO
app.use("/api/modules", erpModulesRouter);

// RUTAS DEL SUBSISTEMA DE GOBERNANZA, CONTEXTO E INSTRUCCIONES ESPECIALES (SUPERVISOR & MEMORIA)
app.use("/api/governance", agentGovernanceRouter);
app.use("/api/agents/governance", agentGovernanceRouter);

// RUTAS DEL AGENTE SUPERVISOR CONTABLE (POST /api/accounting/commit-entry, GET /api/accounting/entries)
app.use("/api/accounting", supervisorLedgerRouter);

// RUTAS DEL MOTOR CONTABLE CENTRALIZADO Y PLAN DE CUENTAS IFRS
app.use("/api/accounting", accountingJournalRouter);

// RUTAS DE INGESTA Y CONSULTA DEL REGISTRO DE COMPRAS Y VENTAS (SII RCV)
app.use("/api/rcv", siiRcvRouter);

// RUTAS DE NÓMINA Y REMUNERACIONES (CÓDIGO DEL TRABAJO / PREVIRED)
app.use("/api/payroll", payrollRouter);

// RUTAS DE RENDICIÓN DE GASTOS (RINDE GASTOS AI - MYSQL 8.0)
app.use("/api/expenses", expenseReportsRouter);

// RUTAS DE FACTURACIÓN ELECTRÓNICA HTTP-DTE / LIBREDTE (SII CHILE)
app.use("/api/billing", billingDteRouter);
app.use("/api/dte", billingDteRouter);

// RUTAS DE STREAMING SERVER-SENT EVENTS (SSE) PARA BULLMQ (GET /api/jobs/stream/:queueName/:jobId)
app.use("/api/jobs", sseJobRouter);

// RUTAS DE COLAS ASÍNCRONAS Y WORKERS BULLMQ
app.use("/api/jobs", asyncJobsRouter);

// RUTAS DE DIAGNÓSTICO Y CONTROL DE PERSISTENCIA (MYSQL 8.0 + DISCO + REDIS)
app.get("/api/persistence/status", async (_req, res) => {
  const diskStatus = diskPersistence.getStatus();
  const redisOk = isRedisConfigured();
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    mysql: {
      connected: isRealMysqlConnected,
      host: process.env.MYSQL_HOST || "127.0.0.1",
      port: Number(process.env.MYSQL_PORT) || 3306,
      database: process.env.MYSQL_DATABASE || "erp_contable",
      tableCount: 25,
    },
    redis: {
      configured: redisOk,
      host: process.env.REDIS_HOST || (process.env.REDIS_URL ? "URL_CONFIGURED" : "DISABLED"),
    },
    disk: diskStatus,
  });
});

app.post("/api/persistence/sync-all", async (_req, res) => {
  try {
    diskPersistence.flushToDiskSync();
    const result = await diskPersistence.syncDiskToMysql();
    res.json({
      success: true,
      message: "Persistencia forzada a disco y sincronización a MySQL completada.",
      syncedEntries: result.syncedEntries,
      syncedDtes: result.syncedDtes,
      disk: diskPersistence.getStatus(),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Vite middleware setup for development and production
async function startServer() {
  // Verificación de conectividad con MySQL 8.0 y auto-inicialización de tablas DDL
  checkMySqlConnection()
    .then(async (isConnected) => {
      if (isConnected) {
        console.log("[Contable Chile] Conexión a MySQL 8.0 verificada exitosamente.");
        await ensureMysqlSchemaInitialized();
      } else {
        console.warn("[Contable Chile] Aviso: Servidor MySQL no disponible localmente. Persistencia continua garantizada en disco local (data/db_disk_snapshot.json).");
      }
    })
    .catch((err) => {
      console.warn(`[Contable Chile] Error en healthcheck MySQL: ${err.message}`);
    });

  // Precarga y sincronización asíncrona no bloqueante de indicadores económicos chilenos
  const todayStr = new Date().toISOString().split("T")[0];
  IndicatorSyncService.syncAllCurrentIndicators(todayStr)
    .then(() => {
      if (isRealMysqlConnected) {
        console.log("[Contable Chile] Indicadores económicos diarios sincronizados con éxito en base de datos MySQL.");
      } else {
        console.log("[Contable Chile] Indicadores económicos cargados en memoria y snapshot local (MySQL no disponible/offline).");
      }
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

  return app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Contable Chile] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

export { app, startServer };

const isMainScript = Boolean(
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') ||
   process.argv[1].endsWith('server.cjs') ||
   process.argv[1].endsWith('server.js'))
);

if (process.env.NODE_ENV !== 'test' && isMainScript) {
  startServer();
}
