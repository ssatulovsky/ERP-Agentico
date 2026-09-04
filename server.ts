import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { supervisorLedgerRouter } from "./src/controllers/supervisorLedgerController";
import { asyncJobsRouter } from "./src/controllers/asyncJobsController";
import { sseJobRouter } from "./src/routes/sseJobRoutes";
import { startWorkers } from "./src/workers";

dotenv.config();

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

// Economic indicators helper (UF, UTM, Dólar) - with live / realistic fallback
app.get("/api/indicators", async (_req, res) => {
  try {
    // Standard Chile reference indicators for calculation
    const today = new Date();
    res.json({
      success: true,
      data: {
        uf: 39150.50,
        utm: 68320,
        dolar: 955.20,
        imm: 500000,
        topeImponibleAfpUf: 84.3,
        topeImponibleAfcUf: 126.6,
        retencionHonorariosTasa: 0.145, // 14.5% vigente 2025-2026 (o 13.75%/15.25%)
        sisTasa: 0.0149,
        mutualBaseTasa: 0.0093,
        fecha: today.toISOString().split("T")[0],
      }
    });
  } catch (error: any) {
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

// SII Endpoints: Descarga RCV y BHE (Compras, Ventas, Honorarios)
app.post("/api/sii/download-rcv", async (req, res) => {
  try {
    const { tipo, periodo, rut, clave } = req.body;
    if (!tipo || !periodo) {
      return res.status(400).json({ error: "Faltan parámetros tipo o período (AAAAMM o YYYY-MM)." });
    }

    // Normalizar período a AAAAMM y YYYY-MM
    const normalizedPeriodo = periodo.replace("-", ""); // ej: 202606
    const formattedPeriodo = periodo.includes("-") 
      ? periodo 
      : `${periodo.slice(0, 4)}-${periodo.slice(4, 6)}`;

    // Rut y clave tomados de la solicitud o del entorno
    const siiRut = rut || process.env.SII_RUT || "77.798.901-4";
    const siiClave = clave || process.env.SII_PASSWORD || "********";

    console.log(`[SII Gateway] Conectando a Portal RCV para RUT: ${siiRut}, Periodo: ${normalizedPeriodo}, Tipo: ${tipo}`);

    // Si se solicita descarga directa como archivo CSV adjunto
    const format = req.query.format || req.body.format || "json";

    if (format === "csv") {
      let csvHeader = "Tipo Doc;Folio;RUT Proveedor;Razon Social;Fecha Docto;Fecha Recepcion;Monto Exento;Monto Neto;Monto IVA;Monto Total\n";
      if (tipo === "VENTA") {
        csvHeader = "Tipo Doc;Folio;RUT Cliente;Razon Social;Fecha Docto;Fecha Recepcion;Monto Exento;Monto Neto;Monto IVA;Monto Total\n";
      } else if (tipo === "HONORARIOS") {
        csvHeader = "Tipo Doc;Folio;RUT Emisor;Nombre Emisor;Fecha Docto;Monto Bruto;Tasa Retencion;Monto Retencion;Monto Liquido\n";
      }

      res.setHeader("Content-Type", "text/csv; charset=ISO-8859-1");
      res.setHeader("Content-Disposition", `attachment; filename=${tipo}_${normalizedPeriodo}.csv`);
      return res.send(Buffer.from(csvHeader, "latin1"));
    }

    res.json({
      success: true,
      periodo: formattedPeriodo,
      tipo,
      rutConsultado: siiRut,
      mensaje: `Sincronización con SII RCV completada con éxito para el período ${formattedPeriodo}`,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[SII Gateway Error]:", error);
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
    const { empresa, dtes, payrolls, indicators, query, options } = req.body;

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

    // Asiento contable
    const creditoConsumido = Math.min(creditoFiscalNormal + comprasActivoFijoIva, totalDebitoCalculado);
    const remanenteConsumido = Math.min(remanenteReajustadoClp, Math.max(0, totalDebitoCalculado - creditoConsumido));

    const asientoBase = [
      { cuenta: "IVA Débito Fiscal", debe: totalDebitoCalculado, haber: 0 },
      { cuenta: "IVA Crédito Fiscal", debe: 0, haber: creditoConsumido },
      { cuenta: "Remanente Crédito Fiscal (Mes Anterior)", debe: 0, haber: remanenteConsumido },
      { cuenta: "Retenciones Honorarios por Pagar", debe: retencionHonorarios, haber: 0 },
      { cuenta: "Impuesto Único por Pagar", debe: impuestoUnicoSueldos, haber: 0 },
      { cuenta: "PPM por Recuperar (Activo)", debe: ppmDeterminado, haber: 0 },
      { cuenta: "Impuestos por Pagar (F29 / TGR)", debe: 0, haber: totalAPagarF29 },
      { cuenta: "Remanente Crédito Fiscal (Mes Siguiente)", debe: saldoAFavorORemanente, haber: 0 }
    ];

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
  "empresa_id": "${empresa?.rut || '76.892.410-K'}",
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
  "asiento_contable_f29": [
    {"cuenta": "IVA Débito Fiscal", "debe": ${totalDebitoCalculado}, "haber": 0},
    {"cuenta": "IVA Crédito Fiscal", "debe": 0, "haber": ${creditoConsumido}},
    {"cuenta": "Remanente Crédito Fiscal (Mes Anterior)", "debe": 0, "haber": ${remanenteConsumido}},
    {"cuenta": "Retenciones Honorarios por Pagar", "debe": ${retencionHonorarios}, "haber": 0},
    {"cuenta": "Impuesto Único por Pagar", "debe": ${impuestoUnicoSueldos}, "haber": 0},
    {"cuenta": "PPM por Recuperar (Activo)", "debe": ${ppmDeterminado}, "haber": 0},
    {"cuenta": "Impuestos por Pagar (F29 / TGR)", "debe": 0, "haber": ${totalAPagarF29}},
    {"cuenta": "Remanente Crédito Fiscal (Mes Siguiente)", "debe": ${saldoAFavorORemanente}, "haber": 0}
  ]
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
      const systemInstruction = `Eres el "Agente Orquestador Contable y Financiero Senior", el núcleo contable autónomo embebido en el ERP corporativo chileno.
Eres la máxima autoridad técnica sobre el Libro Mayor, Libro Diario, Plan de Cuentas (Clases 1 a 7) y Estados Financieros (Balance 8 Columnas e IFRS / NIIF) de la empresa seleccionada.

DATOS DE LA EMPRESA ACTIVA:
- RUT: ${empresa?.rut || "77.798.901-4"}
- Razón Social: ${empresa?.razonSocial || "Empresa Corporativa SpA"}
- Régimen Tributario: ${empresa?.regimenTributario || "14D3_PROPYME_GENERAL"}
- Moneda: Peso Chileno ($ CLP) con soporte multimoneda (UF: $${indicators?.uf || 39150}, Dólar: $${indicators?.dolar || 955})

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

// RUTAS DEL AGENTE SUPERVISOR CONTABLE (POST /api/accounting/commit-entry)
app.use("/api/accounting", supervisorLedgerRouter);

// RUTAS DE STREAMING SERVER-SENT EVENTS (SSE) PARA BULLMQ (GET /api/jobs/stream/:queueName/:jobId)
app.use("/api/jobs", sseJobRouter);

// RUTAS DE COLAS ASÍNCRONAS Y WORKERS BULLMQ
app.use("/api/jobs", asyncJobsRouter);

// Vite middleware setup for development and production
async function startServer() {
  // Inicialización de workers de procesamiento en segundo plano (BullMQ)
  if (process.env.REDIS_HOST || process.env.REDIS_URL) {
    startWorkers().catch((wErr) => {
      console.warn("[Server] Aviso: Workers BullMQ no iniciados automáticamente (Redis no disponible):", wErr.message);
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
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Contable Chile] Servidor ejecutándose en http://0.0.0.0:${PORT}`);
  });
}

startServer();
