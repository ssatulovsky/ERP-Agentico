/**
 * Lectura de comprobantes de gasto con IA (tarea 1.1 del plan de corrección, hallazgo #2).
 *
 * Regla: si la IA no responde o su respuesta no valida contra el esquema, NO se devuelven datos.
 * El controlador responde 503 OCR_UNAVAILABLE y la app abre el formulario manual vacío.
 * Nunca se completan montos, RUT, folios ni proveedores con valores inventados.
 */
import { z } from 'zod';
import { aiRouterService } from './aiRouterService';

const DOCUMENT_TYPES = [
  'BOLETA_ELECTRONICA',
  'FACTURA_ELECTRONICA_33',
  'FACTURA_EXENTA_34',
  'BOLETA_HONORARIOS',
  'INVOICE_EXTERIOR',
  'TICKET_PEAJE',
  'RECIBO_MOVILIZACION',
  'OTRO',
] as const;

const CATEGORIES = [
  'ALIMENTACION',
  'ALOJAMIENTO',
  'TRANSPORTE_MOVILIZACION',
  'COMBUSTIBLE',
  'PEAJES_ESTACIONAMIENTOS',
  'MATERIALES_INSUMOS',
  'REPRESENTACION_CLIENTES',
  'TELECOMUNICACIONES',
  'SERVICIOS_TECNICOS',
  'OTROS',
] as const;

const nonNegativeInt = z.number().int().nonnegative();

/** Lo que el modelo debe devolver. Los datos que no aparecen en el comprobante van en null. */
export const ScannedReceiptSchema = z.object({
  tipoDocumento: z.enum(DOCUMENT_TYPES),
  proveedorRut: z.string().trim().min(1).nullable(),
  proveedorRazonSocial: z.string().trim().min(1).nullable(),
  folioDocumento: z.string().trim().min(1).nullable(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  montoTotalClp: z.number().int().positive(),
  montoNeto: nonNegativeInt.nullable(),
  montoIva: nonNegativeInt.nullable(),
  montoExento: nonNegativeInt.nullable(),
  categoria: z.enum(CATEGORIES).nullable(),
  descripcionGlosa: z.string().nullable(),
  cuentaContableCodigo: z.string().nullable(),
  cuentaContableNombre: z.string().nullable(),
  esGastoRechazadoArt21: z.boolean().nullable(),
  diagnosticoAgente: z.string().nullable(),
  confianzaScore: z.number().min(0).max(100).nullable(),
});

export type ScannedReceipt = z.infer<typeof ScannedReceiptSchema>;

export const RECEIPT_OCR_PROMPT = `Eres un asistente que lee comprobantes de gasto chilenos (boleta electrónica, factura 33/34, voucher Transbank, ticket de peaje, boleta de honorarios, recibo de combustible o transporte).

Transcribe SOLO lo que se lee en la imagen. Si un dato no aparece o no es legible, usa null. No inventes ni estimes RUT, folios, fechas ni montos.

Responde ÚNICAMENTE con un objeto JSON (sin backticks ni texto adicional) con esta estructura:
{
  "tipoDocumento": "BOLETA_ELECTRONICA" | "FACTURA_ELECTRONICA_33" | "FACTURA_EXENTA_34" | "BOLETA_HONORARIOS" | "INVOICE_EXTERIOR" | "TICKET_PEAJE" | "RECIBO_MOVILIZACION" | "OTRO",
  "proveedorRut": string | null,
  "proveedorRazonSocial": string | null,
  "folioDocumento": string | null,
  "fecha": "AAAA-MM-DD" | null,
  "montoTotalClp": entero (monto total impreso en el comprobante),
  "montoNeto": entero | null (solo si está impreso),
  "montoIva": entero | null (solo si está impreso),
  "montoExento": entero | null (solo si está impreso),
  "categoria": "ALIMENTACION" | "ALOJAMIENTO" | "TRANSPORTE_MOVILIZACION" | "COMBUSTIBLE" | "PEAJES_ESTACIONAMIENTOS" | "MATERIALES_INSUMOS" | "REPRESENTACION_CLIENTES" | "TELECOMUNICACIONES" | "SERVICIOS_TECNICOS" | "OTROS" | null,
  "descripcionGlosa": string | null,
  "cuentaContableCodigo": string | null (sugerencia),
  "cuentaContableNombre": string | null (sugerencia),
  "esGastoRechazadoArt21": boolean | null,
  "diagnosticoAgente": string | null (observaciones sobre legibilidad o validez),
  "confianzaScore": número 0-100 | null (tu confianza real en la lectura)
}

Si la imagen no es un comprobante o no se lee el monto total, responde {"error": "ILEGIBLE"}.`;

export type ReceiptOcrResult =
  | { ok: true; data: ScannedReceipt }
  | { ok: false; code: 'OCR_UNAVAILABLE'; reason: string };

/** Valida la respuesta textual del modelo. Nunca completa campos faltantes. */
export function parseReceiptOcrResponse(rawText: string): ReceiptOcrResult {
  const cleaned = (rawText || '').replace(/```(?:json)?/gi, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, code: 'OCR_UNAVAILABLE', reason: 'La respuesta de la IA no es JSON válido.' };
  }
  if (parsed && typeof parsed === 'object' && 'error' in (parsed as any)) {
    return { ok: false, code: 'OCR_UNAVAILABLE', reason: `La IA no pudo leer el comprobante (${String((parsed as any).error)}).` };
  }
  const result = ScannedReceiptSchema.safeParse(parsed);
  if (!result.success) {
    const campos = result.error.issues.map((i) => i.path.join('.') || '(raíz)').join(', ');
    return { ok: false, code: 'OCR_UNAVAILABLE', reason: `La lectura de la IA no superó la validación (${campos}).` };
  }
  return { ok: true, data: result.data };
}

export async function scanReceiptWithAi(input: {
  imageBase64: string;
  mimeType?: string;
  empresaId?: string;
}): Promise<ReceiptOcrResult> {
  let cleanBase64 = input.imageBase64;
  let cleanMime = input.mimeType || 'image/jpeg';
  const match = input.imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (match) {
    cleanMime = match[1];
    cleanBase64 = match[2];
  }

  let rawText = '';
  try {
    const aiResult = await aiRouterService.executeAiTask({
      capability: 'VISION_OCR',
      prompt: RECEIPT_OCR_PROMPT,
      inlineData: { mimeType: cleanMime, data: cleanBase64 },
      temperature: 0.1,
      empresaId: input.empresaId,
      modulo: 'RINDE_GASTOS_OCR',
    } as any);
    rawText = aiResult?.text || '';
  } catch (err: any) {
    return { ok: false, code: 'OCR_UNAVAILABLE', reason: `Servicio de lectura con IA no disponible: ${err?.message || err}` };
  }
  if (!rawText.trim()) {
    return { ok: false, code: 'OCR_UNAVAILABLE', reason: 'La IA no devolvió contenido.' };
  }
  return parseReceiptOcrResponse(rawText);
}
