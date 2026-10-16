import fs from 'fs';
import path from 'path';
import https from 'https';
import { PIPER_SPANISH_VOICES, PIPER_VOICE_DOWNLOAD_URLS, PiperTtsService } from '../services/piperTtsService';

async function downloadFileWithProgress(url: string, destPath: string, label: string): Promise<void> {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
    const sizeMb = (fs.statSync(destPath).size / (1024 * 1024)).toFixed(1);
    console.log(`[Piper Download] ✓ Ya existe: ${path.basename(destPath)} (${sizeMb} MB)`);
    return;
  }

  console.log(`[Piper Download] ⬇ Descargando ${label}...`);
  console.log(`  URL: ${url}`);

  return new Promise((resolve, reject) => {
    const makeRequest = (currentUrl: string) => {
      https.get(currentUrl, (res) => {
        // Manejar redirecciones 301 / 302 / 307 (comunes en Hugging Face LFS)
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          makeRequest(res.headers.location);
          return;
        }

        if (res.statusCode !== 200) {
          reject(new Error(`Error HTTP ${res.statusCode} al descargar ${currentUrl}`));
          return;
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;
        let lastReport = 0;

        const fileStream = fs.createWriteStream(destPath);
        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          const now = Date.now();
          if (now - lastReport > 2000 || downloadedBytes === totalBytes) {
            lastReport = now;
            const pct = totalBytes > 0 ? ((downloadedBytes / totalBytes) * 100).toFixed(1) : '?';
            const mb = (downloadedBytes / (1024 * 1024)).toFixed(1);
            process.stdout.write(`  -> Progreso: ${mb} MB (${pct}%)\r`);
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          const finalMb = (fs.statSync(destPath).size / (1024 * 1024)).toFixed(1);
          console.log(`\n  ✓ Completado: ${path.basename(destPath)} (${finalMb} MB)`);
          resolve();
        });

        fileStream.on('error', (err) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    };

    makeRequest(url);
  });
}

export async function downloadAllPiperVoices(customTargetDir?: string): Promise<{ success: boolean; targetDir: string; totalDownloaded: number }> {
  const targetDir =
    customTargetDir ||
    process.env.PIPER_MODELS_DIR ||
    (fs.existsSync('/opt/agentic') ? '/opt/agentic/piper' : path.resolve(process.cwd(), 'piper'));

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log('========================================================================');
  console.log('  DESCARGA DE MODELOS PIPER TTS EN ESPAÑOL (HUGGING FACE)');
  console.log(`  Directorio destino: ${targetDir}`);
  console.log(`  Total de modelos: ${PIPER_SPANISH_VOICES.length}`);
  console.log('========================================================================\n');

  let downloadedCount = 0;

  for (const voice of PIPER_SPANISH_VOICES) {
    const urls = PIPER_VOICE_DOWNLOAD_URLS[voice.id];
    if (!urls) continue;

    const onnxDest = path.join(targetDir, `${urls.filename}.onnx`);
    const jsonDest = path.join(targetDir, `${urls.filename}.onnx.json`);

    try {
      await downloadFileWithProgress(urls.onnxUrl, onnxDest, `${voice.name} (.onnx)`);
      await downloadFileWithProgress(urls.jsonUrl, jsonDest, `${voice.name} (.json)`);
      downloadedCount++;
    } catch (err: any) {
      console.error(`  ✗ Error al descargar ${voice.name}:`, err.message);
    }
  }

  console.log('\n========================================================================');
  console.log(`  ¡Proceso finalizado! ${downloadedCount}/${PIPER_SPANISH_VOICES.length} modelos listos en ${targetDir}`);
  console.log('========================================================================');

  return {
    success: true,
    targetDir,
    totalDownloaded: downloadedCount,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  downloadAllPiperVoices()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error fatal durante la descarga:', err);
      process.exit(1);
    });
}
