import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';

export interface PiperVoiceMetadata {
  id: string;
  name: string;
  lang: string;
  gender: 'FEMENINO' | 'MASCULINO';
  quality: 'high' | 'medium' | 'low' | 'x_low';
  region: string;
  description: string;
  sampleSentence: string;
  onnxUrl: string;
  jsonUrl: string;
}

export const PIPER_SPANISH_VOICES: PiperVoiceMetadata[] = [
  {
    id: 'es_AR-daniela-high',
    name: 'Vera Ejecutiva Neural (Daniela AR - High 22kHz)',
    lang: 'es-AR',
    gender: 'FEMENINO',
    quality: 'high',
    region: 'Argentina / Latam',
    description: 'Voz femenina de alta fidelidad (22kHz), cálida, ejecutiva y sumamente natural. Diseñada especialmente para la Agente Principal Vera y dirección financiera.',
    sampleSentence: 'Hola socio, tengo las proyecciones de flujo de caja y compromisos bancarios listos para revisar.',
    onnxUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_AR/daniela/high/es_AR-daniela-high.onnx',
    jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_AR/daniela/high/es_AR-daniela-high.onnx.json',
  },
  {
    id: 'es_MX-ald-medium',
    name: 'Sofía / Camila Dinámica (Ald MX - Medium)',
    lang: 'es-MX',
    gender: 'FEMENINO',
    quality: 'medium',
    region: 'México / Latam',
    description: 'Voz femenina hispana neutra, ágil y de baja latencia para auditoría contable y operaciones rápidas.',
    sampleSentence: 'Conciliación bancaria procesada con éxito en las cuentas de la empresa.',
    onnxUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/ald/medium/es_MX-ald-medium.onnx',
    jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/ald/medium/es_MX-ald-medium.onnx.json',
  },
  {
    id: 'es_MX-ald-x_low',
    name: 'Ald Ultrarrápida (Ald MX - x_low)',
    lang: 'es-MX',
    gender: 'FEMENINO',
    quality: 'x_low',
    region: 'México / Latam',
    description: 'Voz femenina ultraligera (~16MB), consumo mínimo de CPU y respuesta instantánea.',
    sampleSentence: 'Órdenes de compra y facturas procesadas en el sistema.',
    onnxUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/ald/x_low/es_MX-ald-x_low.onnx',
    jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/ald/x_low/es_MX-ald-x_low.onnx.json',
  },
  {
    id: 'es_MX-claude-high',
    name: 'Claude Consultor Directivo (Claude MX - High 22kHz)',
    lang: 'es-MX',
    gender: 'MASCULINO',
    quality: 'high',
    region: 'México / Latam',
    description: 'Voz masculina de alta definición (22kHz), dicción impecable y porte corporativo para finanzas e informes ejecutivos.',
    sampleSentence: 'Hemos completado la revisión fiscal y la proyección del estado de resultados del trimestre.',
    onnxUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/claude/high/es_MX-claude-high.onnx',
    jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/claude/high/es_MX-claude-high.onnx.json',
  },
  {
    id: 'es_ES-sharvard-medium',
    name: 'Rodrigo / Tomás Consultor (Sharvard ES - Medium)',
    lang: 'es-ES',
    gender: 'MASCULINO',
    quality: 'medium',
    region: 'España',
    description: 'Voz masculina sobria, profesional y pausada para análisis de costos, balances y declaraciones tributarias.',
    sampleSentence: 'Los asientos del Libro Diario y el cálculo de impuestos se encuentran cuadrados y sellados.',
    onnxUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx',
    jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx.json',
  },
  {
    id: 'es_ES-davefx-medium',
    name: 'Matías / Juan Pablo Barítono (Davefx ES - Medium)',
    lang: 'es-ES',
    gender: 'MASCULINO',
    quality: 'medium',
    region: 'España',
    description: 'Voz masculina sobria, profesional y con excelente articulación para tesorería, DTEs y normativa tributaria.',
    sampleSentence: 'El saldo oficial en bancos y la emisión de facturas electrónicas están sincronizados.',
    onnxUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx',
    jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx.json',
  },
  {
    id: 'es_ES-carlfm-x_low',
    name: 'Ignacio Logística (Carlfm ES - x_low)',
    lang: 'es-ES',
    gender: 'MASCULINO',
    quality: 'x_low',
    region: 'España',
    description: 'Voz masculina ultraligera y rápida, optimizada para mínima latencia en inventarios y bodegas.',
    sampleSentence: 'Stock de materias primas y órdenes de producción verificadas en bodega.',
    onnxUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/carlfm/x_low/es_ES-carlfm-x_low.onnx',
    jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/carlfm/x_low/es_ES-carlfm-x_low.onnx.json',
  },
  {
    id: 'es_ES-mls_10246-low',
    name: 'Elena / MLS 10246 (ES - Low)',
    lang: 'es-ES',
    gender: 'FEMENINO',
    quality: 'low',
    region: 'España',
    description: 'Voz femenina natural basada en corpus MLS en español, ligera y fluida.',
    sampleSentence: 'Informe de remuneraciones e imposiciones listo para su aprobación.',
    onnxUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/mls_10246/low/es_ES-mls_10246-low.onnx',
    jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/mls_10246/low/es_ES-mls_10246-low.onnx.json',
  },
  {
    id: 'es_ES-mls_9972-low',
    name: 'Gonzalo / MLS 9972 (ES - Low)',
    lang: 'es-ES',
    gender: 'MASCULINO',
    quality: 'low',
    region: 'España',
    description: 'Voz masculina ligera basada en corpus MLS en español, rápida y clara.',
    sampleSentence: 'Verificación de existencias y pedidos de compra actualizados.',
    onnxUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/mls_9972/low/es_ES-mls_9972-low.onnx',
    jsonUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/mls_9972/low/es_ES-mls_9972-low.onnx.json',
  },
];

export const PIPER_VOICE_DOWNLOAD_URLS: Record<string, { onnxUrl: string; jsonUrl: string; filename: string }> =
  PIPER_SPANISH_VOICES.reduce((acc, v) => {
    acc[v.id] = {
      onnxUrl: v.onnxUrl,
      jsonUrl: v.jsonUrl,
      filename: v.id,
    };
    return acc;
  }, {} as Record<string, { onnxUrl: string; jsonUrl: string; filename: string }>);

/**
 * Servicio Central de Síntesis de Voz Neuronal Piper
 */
export class PiperTtsService {
  private static instance: PiperTtsService;
  private detectedPiperBin: string | null = null;

  public static getInstance(): PiperTtsService {
    if (!PiperTtsService.instance) {
      PiperTtsService.instance = new PiperTtsService();
    }
    return PiperTtsService.instance;
  }

  /**
   * Directorios donde pueden estar almacenados los modelos .onnx
   */
  public getCandidateModelDirs(): string[] {
    const cwd = process.cwd();
    const home = os.homedir();
    const dirs: string[] = [];

    if (process.env.PIPER_MODELS_DIR) {
      dirs.push(path.resolve(process.env.PIPER_MODELS_DIR));
    }

    dirs.push(
      '/opt/agentic/piper',
      path.resolve(cwd, 'piper'),
      path.resolve(cwd, 'piper_models'),
      '/opt/agentic/piper_models',
      path.resolve(cwd, 'models'),
      path.resolve(cwd, 'voices'),
      '/opt/agentic/models',
      '/opt/agentic/voices',
      '/usr/share/piper-voices',
      '/usr/local/share/piper-voices',
      path.join(home, '.local/share/piper-voices'),
      path.join(home, 'piper_models'),
      path.join(home, 'piper'),
      path.join(home, '.piper'),
      '/opt/piper/models',
      '/opt/piper/voices'
    );

    return Array.from(new Set(dirs)).filter((d) => fs.existsSync(d));
  }

  /**
   * Rutas candidatas del binario ejecutable `piper` en servidores Linux/macOS
   */
  public getCandidateBinaryPaths(): string[] {
    const home = os.homedir();
    const candidates: string[] = [];

    if (process.env.PIPER_BIN_PATH) {
      candidates.push(process.env.PIPER_BIN_PATH);
    }

    candidates.push(
      '/root/miniconda3/bin/piper',
      path.join(home, 'miniconda3/bin/piper'),
      '/root/miniconda3/bin/piper-tts',
      path.join(home, 'miniconda3/bin/piper-tts'),
      '/root/anaconda3/bin/piper',
      path.join(home, 'anaconda3/bin/piper'),
      '/opt/conda/bin/piper',
      '/opt/miniconda3/bin/piper',
      '/usr/local/bin/piper',
      '/usr/bin/piper',
      '/opt/piper/piper',
      '/opt/agentic/piper/piper',
      path.join(home, '.local/bin/piper'),
      path.join(home, 'bin/piper'),
      '/usr/local/bin/piper-tts',
      '/usr/bin/piper-tts',
      path.join(home, '.local/bin/piper-tts'),
      'piper',
      'piper-tts'
    );

    return Array.from(new Set(candidates));
  }

  /**
   * Detecta y valida el ejecutable de Piper disponible
   */
  public async getPiperBinaryPath(): Promise<string | null> {
    if (this.detectedPiperBin) return this.detectedPiperBin;

    const candidates = this.getCandidateBinaryPaths();
    for (const bin of candidates) {
      const works = await this.testBinary(bin);
      if (works) {
        this.detectedPiperBin = bin;
        console.log(`[PiperTtsService] Binario Piper detectado y validado en: ${bin}`);
        return bin;
      }
    }

    return null;
  }

  private testBinary(binPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const binDir = path.dirname(binPath);
        const condaDir = path.dirname(binDir);
        const condaLib = path.join(condaDir, 'lib');

        const env = {
          ...process.env,
          PATH: `${binDir}:${process.env.PATH || ''}`,
          ...(fs.existsSync(condaLib)
            ? { LD_LIBRARY_PATH: `${condaLib}:${process.env.LD_LIBRARY_PATH || ''}` }
            : {}),
        };

        const proc = spawn(binPath, ['--help'], { env });
        let output = '';
        proc.stdout?.on('data', (d) => {
          output += d.toString();
        });
        proc.stderr?.on('data', (d) => {
          output += d.toString();
        });
        proc.on('error', () => resolve(false));
        proc.on('close', (code) => {
          if (code === 0 || code === 1 || output.toLowerCase().includes('piper')) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
      } catch {
        resolve(false);
      }
    });
  }

  private audioCache = new Map<string, {
    audioBuffer: Buffer;
    audioBase64: string;
    mimeType: string;
    modelUsed: string;
    voiceName: string;
  }>();
  private readonly MAX_CACHE_ENTRIES = 200;
  // Caché en memoria de rutas de modelos ya localizados para evitar escaneos de disco continuos
  private modelPathCache = new Map<string, { modelPath: string; configPath?: string; isFallback?: boolean }>();

  // Cola secuencial de inferencia para evitar colapso de CPU en VPS con 1-2 núcleos
  private activeSynthesisPromise: Promise<any> = Promise.resolve();

  /**
   * Búsqueda inteligente y rápida de modelos ONNX en el servidor (con caché en RAM)
   */
  public findModelFile(voiceId: string): { modelPath: string; configPath?: string; isFallback?: boolean } | null {
    if (this.modelPathCache.has(voiceId)) {
      const cached = this.modelPathCache.get(voiceId)!;
      if (fs.existsSync(cached.modelPath)) {
        return cached;
      }
      this.modelPathCache.delete(voiceId);
    }
    const dirs = this.getCandidateModelDirs();
    const cleanId = voiceId.toLowerCase().replace(/[-_]/g, '');

    // 1. Búsqueda directa por nombre de archivo exacto
    for (const dir of dirs) {
      const directPath = path.join(dir, `${voiceId}.onnx`);
      if (fs.existsSync(directPath)) {
        const configPath = fs.existsSync(`${directPath}.json`)
          ? `${directPath}.json`
          : fs.existsSync(path.join(dir, `${voiceId}.json`))
          ? path.join(dir, `${voiceId}.json`)
          : undefined;
        const res = { modelPath: directPath, configPath, isFallback: false };
        this.modelPathCache.set(voiceId, res);
        return res;
      }
    }

    // 2. Búsqueda recursiva / flexible en directorios de modelos
    for (const dir of dirs) {
      try {
        const found = this.scanDirForModel(dir, voiceId, cleanId);
        if (found) return { ...found, isFallback: false };
      } catch (e) {
        // Ignorar errores de lectura en directorios restringidos
      }
    }

    // 3. Fallback inteligente respetando género si es posible
    const isTargetFemale = voiceId.includes('daniela') || voiceId.includes('ald') || voiceId.includes('female');
    if (isTargetFemale) {
      for (const dir of dirs) {
        try {
          const femaleMatch = this.scanDirForFemaleModel(dir);
          if (femaleMatch) {
            console.warn(`[PiperTtsService] Voz '${voiceId}' no encontrada exactamente, utilizando voz femenina alternativa: ${path.basename(femaleMatch.modelPath)}`);
            return { ...femaleMatch, isFallback: true };
          }
        } catch {}
      }
    }

    // 4. Fallback general: Cualquier modelo en español (.onnx que comience con "es" o contenga "spanish")
    for (const dir of dirs) {
      try {
        const foundSpanish = this.scanDirForAnySpanishModel(dir);
        if (foundSpanish) {
          console.warn(`[PiperTtsService] Aviso: Se solicitó '${voiceId}' pero solo hay disponible: ${path.basename(foundSpanish.modelPath)}. Descargue 'es_AR-daniela-high.onnx' en /opt/agentic/piper para voz femenina.`);
          const res = { ...foundSpanish, isFallback: true };
          this.modelPathCache.set(voiceId, res);
          return res;
        }
      } catch {}
    }

    return null;
  }

  private scanDirForModel(
    dir: string,
    targetId: string,
    cleanTargetId: string,
    depth = 0
  ): { modelPath: string; configPath?: string } | null {
    if (depth > 3) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = this.scanDirForModel(fullPath, targetId, cleanTargetId, depth + 1);
        if (sub) return sub;
      } else if (entry.isFile() && entry.name.endsWith('.onnx')) {
        const entryClean = entry.name.toLowerCase().replace(/[-_]/g, '');
        // Coincidencia por id o nombre clave (daniela, ald, sharvard, davefx, carlfm)
        const keywordMatch =
          (targetId.includes('daniela') && entryClean.includes('daniela')) ||
          (targetId.includes('ald') && entryClean.includes('ald')) ||
          (targetId.includes('claude') && entryClean.includes('claude')) ||
          (targetId.includes('sharvard') && entryClean.includes('sharvard')) ||
          (targetId.includes('davefx') && entryClean.includes('davefx')) ||
          (targetId.includes('carlfm') && entryClean.includes('carlfm')) ||
          (targetId.includes('mls_10246') && (entryClean.includes('10246') || entryClean.includes('mls10246'))) ||
          (targetId.includes('mls_9972') && (entryClean.includes('9972') || entryClean.includes('mls9972'))) ||
          entryClean.includes(cleanTargetId);

        if (keywordMatch || entry.name.toLowerCase().startsWith(targetId.toLowerCase())) {
          const configPath = fs.existsSync(`${fullPath}.json`) ? `${fullPath}.json` : undefined;
          return { modelPath: fullPath, configPath };
        }
      }
    }
    return null;
  }

  private scanDirForFemaleModel(dir: string, depth = 0): { modelPath: string; configPath?: string } | null {
    if (depth > 3) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = this.scanDirForFemaleModel(fullPath, depth + 1);
        if (sub) return sub;
      } else if (entry.isFile() && entry.name.endsWith('.onnx')) {
        const lower = entry.name.toLowerCase();
        if (
          lower.includes('daniela') ||
          lower.includes('ald') ||
          lower.includes('mls_9972') ||
          lower.includes('mls_10246')
        ) {
          const configPath = fs.existsSync(`${fullPath}.json`) ? `${fullPath}.json` : undefined;
          return { modelPath: fullPath, configPath };
        }
      }
    }
    return null;
  }

  private scanDirForAnySpanishModel(dir: string, depth = 0): { modelPath: string; configPath?: string } | null {
    if (depth > 3) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = this.scanDirForAnySpanishModel(fullPath, depth + 1);
        if (sub) return sub;
      } else if (entry.isFile() && entry.name.endsWith('.onnx')) {
        if (entry.name.toLowerCase().startsWith('es') || entry.name.toLowerCase().includes('spanish')) {
          const configPath = fs.existsSync(`${fullPath}.json`) ? `${fullPath}.json` : undefined;
          return { modelPath: fullPath, configPath };
        }
      }
    }
    return null;
  }

  /**
   * Diagnóstico completo del estado de Piper para la API
   */
  /**
   * Retorna todas las 9 voces de Piper en español indicando cuáles están descargadas en el servidor
   */
  public getSpanishVoicesWithInstallStatus(): Array<PiperVoiceMetadata & {
    isInstalled: boolean;
    modelPath?: string;
    fileSizeMb?: number;
  }> {
    return PIPER_SPANISH_VOICES.map((v) => {
      const match = this.findModelFile(v.id);
      let isInstalled = false;
      let modelPath: string | undefined = undefined;
      let fileSizeMb: number | undefined = undefined;

      if (match && !match.isFallback) {
        isInstalled = true;
        modelPath = match.modelPath;
        try {
          fileSizeMb = Number((fs.statSync(match.modelPath).size / (1024 * 1024)).toFixed(1));
        } catch {}
      }

      return {
        ...v,
        isInstalled,
        modelPath,
        fileSizeMb,
      };
    });
  }

  /**
   * Descarga una voz específica de Hugging Face en el directorio primario de modelos
   */
  public async downloadVoice(
    voiceId: string,
    customTargetDir?: string
  ): Promise<{ success: boolean; modelPath: string; voiceName: string; sizeMb: number }> {
    const meta = PIPER_SPANISH_VOICES.find((v) => v.id === voiceId);
    if (!meta) {
      throw new Error(`La voz '${voiceId}' no es una voz válida de Piper en español.`);
    }

    const targetDir =
      customTargetDir ||
      process.env.PIPER_MODELS_DIR ||
      (fs.existsSync('/opt/agentic') ? '/opt/agentic/piper' : path.resolve(process.cwd(), 'piper'));

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const onnxDest = path.join(targetDir, `${meta.id}.onnx`);
    const jsonDest = path.join(targetDir, `${meta.id}.onnx.json`);

    await this.downloadHttpFile(meta.onnxUrl, onnxDest);
    await this.downloadHttpFile(meta.jsonUrl, jsonDest);

    const sizeMb = Number((fs.statSync(onnxDest).size / (1024 * 1024)).toFixed(1));

    return {
      success: true,
      modelPath: onnxDest,
      voiceName: meta.name,
      sizeMb,
    };
  }

  /**
   * Descarga todas las 9 voces en español del repositorio Hugging Face
   */
  public async downloadAllVoices(customTargetDir?: string): Promise<{
    success: boolean;
    targetDir: string;
    results: Array<{ voiceId: string; voiceName: string; success: boolean; error?: string }>;
  }> {
    const targetDir =
      customTargetDir ||
      process.env.PIPER_MODELS_DIR ||
      (fs.existsSync('/opt/agentic') ? '/opt/agentic/piper' : path.resolve(process.cwd(), 'piper'));

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const results: Array<{ voiceId: string; voiceName: string; success: boolean; error?: string }> = [];

    for (const voice of PIPER_SPANISH_VOICES) {
      try {
        await this.downloadVoice(voice.id, targetDir);
        results.push({ voiceId: voice.id, voiceName: voice.name, success: true });
      } catch (err: any) {
        results.push({ voiceId: voice.id, voiceName: voice.name, success: false, error: err.message });
      }
    }

    return {
      success: results.some((r) => r.success),
      targetDir,
      results,
    };
  }

  private downloadHttpFile(url: string, destPath: string): Promise<void> {
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const makeRequest = (currentUrl: string) => {
        https
          .get(currentUrl, (res: any) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              makeRequest(res.headers.location);
              return;
            }
            if (res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode} al descargar ${currentUrl}`));
              return;
            }
            const fileStream = fs.createWriteStream(destPath);
            res.pipe(fileStream);
            fileStream.on('finish', () => {
              fileStream.close();
              resolve();
            });
            fileStream.on('error', (err: any) => {
              fs.unlink(destPath, () => {});
              reject(err);
            });
          })
          .on('error', (err: any) => {
            fs.unlink(destPath, () => {});
            reject(err);
          });
      };
      makeRequest(url);
    });
  }

  public async getStatus(): Promise<{
    piperInstalled: boolean;
    piperBinaryPath: string | null;
    candidateDirsChecked: string[];
    modelsFound: Array<{ id: string; name: string; file: string; hasConfig: boolean }>;
  }> {
    const bin = await this.getPiperBinaryPath();
    const dirs = this.getCandidateModelDirs();
    const modelsFound: Array<{ id: string; name: string; file: string; hasConfig: boolean }> = [];

    for (const dir of dirs) {
      try {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (f.endsWith('.onnx')) {
            const hasConfig = fs.existsSync(path.join(dir, `${f}.json`));
            modelsFound.push({
              id: f.replace('.onnx', ''),
              name: f,
              file: path.join(dir, f),
              hasConfig,
            });
          }
        }
      } catch {}
    }

    return {
      piperInstalled: Boolean(bin),
      piperBinaryPath: bin,
      candidateDirsChecked: dirs,
      modelsFound,
    };
  }

  /**
   * Sintetiza texto en español utilizando el ejecutable Piper nativo
   */
  public async synthesize(
    text: string,
    voiceId: string = 'es_AR-daniela-high',
    options: { rate?: number; pitch?: number } = {}
  ): Promise<{
    audioBuffer: Buffer;
    audioBase64: string;
    mimeType: string;
    modelUsed: string;
    voiceName: string;
  }> {
    const cleanText = text
      .replace(/[*#_`~>]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\n+/g, ' ')
      .trim();

    if (!cleanText) {
      throw new Error('El texto para sintetizar está vacío.');
    }

    const voiceMeta =
      PIPER_SPANISH_VOICES.find((v) => v.id === voiceId) || PIPER_SPANISH_VOICES[0];
    const rate = options.rate || 1.0;

    // 1. Verificación en caché en memoria LRU para respuesta en 0ms en frases recurrentes
    const cacheKey = `${voiceMeta.id}_${rate.toFixed(2)}_${cleanText.toLowerCase()}`;
    const cached = this.audioCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // 1.5 Intento ultra-rápido (~50ms) si existe daemon Piper HTTP activo en local
    const daemonUrl = process.env.PIPER_HTTP_URL || 'http://127.0.0.1:5000';
    const daemonBuffer = await this.trySynthesizeViaHttp(daemonUrl, cleanText, voiceMeta.id);
    if (daemonBuffer) {
      const result = {
        audioBuffer: daemonBuffer,
        audioBase64: daemonBuffer.toString('base64'),
        mimeType: 'audio/wav',
        modelUsed: `Piper Daemon (${voiceMeta.name}) [~50ms]`,
        voiceName: voiceMeta.name,
      };
      if (this.audioCache.size >= this.MAX_CACHE_ENTRIES) {
        const oldestKey = this.audioCache.keys().next().value;
        if (oldestKey) this.audioCache.delete(oldestKey);
      }
      this.audioCache.set(cacheKey, result);
      return result;
    }

    const piperBin = await this.getPiperBinaryPath();
    if (!piperBin) {
      throw new Error(
        'Piper no está instalado o no se encuentra en el PATH del servidor VPS. Verifique /usr/local/bin/piper o configure PIPER_BIN_PATH.'
      );
    }

    const modelInfo = this.findModelFile(voiceMeta.id);
    if (!modelInfo) {
      const dirs = this.getCandidateModelDirs();
      throw new Error(
        `No se encontró el modelo ONNX para '${voiceMeta.id}' ni ninguna voz en español en las rutas: ${dirs.join(', ')}. Descargue el modelo .onnx y su archivo .onnx.json correspondiente.`
      );
    }

    // Ejecutar síntesis de Piper a un archivo WAV temporal seguro (garantiza RIFF WAV 100% válido)
    const tempWav = path.join(
      os.tmpdir(),
      `piper_out_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`
    );

    try {
      await this.runPiperCliToFile(piperBin, cleanText, modelInfo.modelPath, modelInfo.configPath, tempWav, rate);
      const audioBuffer = await fs.promises.readFile(tempWav);

      const result = {
        audioBuffer,
        audioBase64: audioBuffer.toString('base64'),
        mimeType: 'audio/wav',
        modelUsed: `Piper VITS ONNX (${path.basename(modelInfo.modelPath)})${modelInfo.isFallback ? ' [Fallback]' : ''}`,
        voiceName: voiceMeta.name,
      };

      // Guardar en caché LRU (limitar a MAX_CACHE_ENTRIES)
      if (this.audioCache.size >= this.MAX_CACHE_ENTRIES) {
        const oldestKey = this.audioCache.keys().next().value;
        if (oldestKey) this.audioCache.delete(oldestKey);
      }
      this.audioCache.set(cacheKey, result);

      return result;
    } finally {
      // Limpiar archivo temporal
      try {
        if (fs.existsSync(tempWav)) {
          await fs.promises.unlink(tempWav);
        }
      } catch {}
    }
  }

  private runPiperCliToFile(
    binPath: string,
    text: string,
    modelPath: string,
    configPath: string | undefined,
    outWavPath: string,
    rate: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Sanear config JSON si contiene 'PhonemeType.ESPEAK' (incompatible con enum de Python 3.12/3.13)
      const sanitizeConfigFile = (filePath?: string): string | undefined => {
        if (!filePath || !fs.existsSync(filePath)) return undefined;
        try {
          const raw = fs.readFileSync(filePath, 'utf8');
          if (raw.includes('PhonemeType.')) {
            const fixed = raw
              .replace(/"phoneme_type":\s*"PhonemeType\.ESPEAK"/g, '"phoneme_type": "espeak"')
              .replace(/'PhonemeType\.ESPEAK'/g, '"espeak"')
              .replace(/PhonemeType\.ESPEAK/g, 'espeak')
              .replace(/"phoneme_type":\s*"PhonemeType\.TEXT"/g, '"phoneme_type": "text"')
              .replace(/'PhonemeType\.TEXT'/g, '"text"')
              .replace(/PhonemeType\.TEXT/g, 'text');
            try {
              fs.writeFileSync(filePath, fixed, 'utf8');
              return filePath;
            } catch {
              // Si el archivo original no tiene permisos de escritura, crear versión saneada en temp
              const tmpDir = path.join(process.cwd(), 'storage', 'temp');
              if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
              const tempConfig = path.join(tmpDir, `sanitized_${path.basename(filePath)}`);
              fs.writeFileSync(tempConfig, fixed, 'utf8');
              return tempConfig;
            }
          }
        } catch {}
        return filePath;
      };

      const cleanExplicit = sanitizeConfigFile(configPath);
      const cleanModelJson = sanitizeConfigFile(`${modelPath}.json`);
      const effectiveConfigPath = cleanExplicit || cleanModelJson || configPath;

      const args = [
        '--model', modelPath,
        '--output_file', outWavPath,
        '--sentence-silence', '0.1'
      ];

      if (effectiveConfigPath) {
        args.push('--config', effectiveConfigPath);
      }

      // En Piper: --length_scale controla la duración/velocidad (menor a 1.0 = más rápido)
      if (rate !== 1.0) {
        const lengthScale = (1.0 / Math.max(rate, 0.4)).toFixed(2);
        args.push('--length_scale', lengthScale);
      }

      const binDir = path.dirname(binPath);
      const condaDir = path.dirname(binDir);
      const condaLib = path.join(condaDir, 'lib');

      const env = {
        ...process.env,
        PATH: `${binDir}:${process.env.PATH || ''}`,
        ...(fs.existsSync(condaLib)
          ? { LD_LIBRARY_PATH: `${condaLib}:${process.env.LD_LIBRARY_PATH || ''}` }
          : {}),
      };

      const proc = spawn(binPath, args, { env });
      let stderrOutput = '';

      proc.stderr.on('data', (d) => {
        stderrOutput += d.toString();
      });

      proc.on('error', (err) => {
        reject(new Error(`Fallo al ejecutar '${binPath}': ${err.message}`));
      });

      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(outWavPath) && fs.statSync(outWavPath).size > 44) {
          resolve();
        } else {
          reject(
            new Error(
              `Piper finalizó con código ${code}. Salida stderr: ${stderrOutput.slice(-300)}`
            )
          );
        }
      });

      // Enviar texto UTF-8 al stdin de Piper
      proc.stdin.write(text, 'utf8');
      proc.stdin.end();
    });
  }

  /**
   * Intenta sintetizar audio de forma ultra-rápida (~50ms) usando el daemon HTTP de Piper
   * si se encuentra en ejecución en segundo plano (p.ej. scripts/piper_daemon.py o python -m piper.http_server).
   */
  private async trySynthesizeViaHttp(
    baseUrl: string,
    text: string,
    voiceId?: string
  ): Promise<Buffer | null> {
    try {
      const url = new URL(baseUrl);
      const startTime = Date.now();

      const tryRequest = (
        reqPath: string,
        method: 'POST' | 'GET',
        headers: Record<string, string | number>,
        body?: string | Buffer
      ): Promise<Buffer | null> => {
        return new Promise((resolve) => {
          const req = http.request(
            {
              hostname: url.hostname,
              port: url.port || 5000,
              path: reqPath,
              method,
              headers,
              timeout: 15000, // 15 segundos para síntesis completa en CPU sin abortos prematuros
            },
            (res) => {
              if (res.statusCode !== 200) {
                resolve(null);
                return;
              }
              const chunks: Buffer[] = [];
              res.on('data', (c) => chunks.push(c));
              res.on('end', () => {
                const buf = Buffer.concat(chunks);
                if (buf.length > 44) {
                  resolve(buf);
                } else {
                  resolve(null);
                }
              });
            }
          );
          req.on('error', () => resolve(null));
          req.on('timeout', () => {
            req.destroy();
            resolve(null);
          });
          if (body) {
            req.write(body);
          }
          req.end();
        });
      };

      const voiceParam = voiceId ? `?voiceId=${encodeURIComponent(voiceId)}` : '';

      // 1. POST / con texto plano UTF-8 y header X-Voice-Id (nativo de piper_daemon.py y piper.http_server)
      const textBuffer = Buffer.from(text, 'utf8');
      let res = await tryRequest(`/${voiceParam}`, 'POST', {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Length': textBuffer.length,
        ...(voiceId ? { 'X-Voice-Id': voiceId } : {}),
      }, textBuffer);
      if (res) {
        console.log(`[PiperTtsService] Síntesis exitosa vía Daemon HTTP (${res.length} bytes, ${Date.now() - startTime}ms)`);
        return res;
      }

      // 2. POST /synthesize con JSON (compatibilidad con endpoints OpenAI/FastAPI y piper_daemon.py)
      const jsonPayload = JSON.stringify({ text, voiceId, voice: voiceId });
      const jsonBuffer = Buffer.from(jsonPayload, 'utf8');
      res = await tryRequest('/synthesize', 'POST', {
        'Content-Type': 'application/json',
        'Content-Length': jsonBuffer.length,
      }, jsonBuffer);
      if (res) {
        console.log(`[PiperTtsService] Síntesis exitosa vía Daemon HTTP /synthesize (${res.length} bytes, ${Date.now() - startTime}ms)`);
        return res;
      }

      // 3. Fallback GET /?text=...&voiceId=...
      const encoded = encodeURIComponent(text);
      res = await tryRequest(`/?text=${encoded}${voiceParam ? '&' + voiceParam.slice(1) : ''}`, 'GET', {});
      if (res) {
        console.log(`[PiperTtsService] Síntesis exitosa vía Daemon HTTP GET (${res.length} bytes, ${Date.now() - startTime}ms)`);
        return res;
      }

      return null;
    } catch {
      return null;
    }
  }
}

export const piperTtsService = PiperTtsService.getInstance();
