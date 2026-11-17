// Prueba directa de la voz de Gemini con la clave del .env (sin pasar por la app). Uso: npm run voz:probar
import 'dotenv/config';
import fs from 'node:fs';
import { GoogleGenAI } from '@google/genai';
const key = (process.env.GEMINI_API_KEY || '').replace(/^["']|["']$/g, '').trim();
console.log('GEMINI_API_KEY:', key ? `presente (${key.length} caracteres, termina en ${key.slice(-4)})` : 'NO CONFIGURADA');
const ai = new GoogleGenAI({ apiKey: key });
for (const model of ['gemini-3.8-flash-tts', 'gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts']) {
  try {
    const nuevo = model.includes('3.8');
    const r = await ai.models.generateContent({
      model,
      contents: nuevo ? [{ role: 'user', parts: [{ text: 'Hola, soy Vera. Esta es una prueba de voz.' }] }] : 'Hola, soy Vera. Esta es una prueba de voz.',
      config: { responseModalities: ['AUDIO'], speechConfig: nuevo ? { voiceConfig: { voice: 'Kore' } } : { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } },
    });
    const part = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
    if (!part) { console.log(model, '→ respondió sin audio'); continue; }
    const buf = Buffer.from(part.inlineData.data, 'base64');
    fs.writeFileSync(`/tmp/prueba-${model}.audio`, buf);
    console.log(model, '→ OK', part.inlineData.mimeType, buf.length, 'bytes', buf.slice(0, 4).toString() === 'RIFF' ? '(WAV)' : '(sin cabecera)');
  } catch (e) {
    console.log(model, '→ ERROR:', String(e.message).slice(0, 300));
  }
}
