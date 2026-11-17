#!/usr/bin/env python3
# ==============================================================================
# Daemon Multi-Voz de Piper TTS para Agentic ERP
# Mantiene los modelos neuronales ONNX en memoria RAM para latencia ultra-baja (~50ms)
# Soporta todas las 9 voces en español dinámicamente con carga bajo demanda en RAM
# ==============================================================================
import os
import sys
import io
import wave
import logging
from pathlib import Path

# Configurar logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("piper_daemon")

try:
    from flask import Flask, request, Response
except ImportError:
    print("Flask no está instalado. Instalando...")
    os.system(f"{sys.executable} -m pip install flask -q")
    from flask import Flask, request, Response

try:
    from piper import PiperVoice
except ImportError:
    print("Piper no está instalado. Instalando piper-tts[http]...")
    os.system(f"{sys.executable} -m pip install 'piper-tts[http]' -q")
    from piper import PiperVoice

app = Flask("piper_daemon")

MODELS_DIR = os.environ.get("PIPER_MODELS_DIR", "/opt/agentic/piper")
if not os.path.exists(MODELS_DIR):
    MODELS_DIR = str(Path.cwd() / "piper")

loaded_voices = {}

def find_model_path(voice_id):
    """Busca el archivo .onnx exacto o por aproximación en MODELS_DIR"""
    if not os.path.isdir(MODELS_DIR):
        return None, None

    # 1. Coincidencia exacta
    exact = os.path.join(MODELS_DIR, f"{voice_id}.onnx")
    if os.path.isfile(exact):
        cfg = f"{exact}.json"
        return exact, (cfg if os.path.isfile(cfg) else None)

    # 2. Coincidencia parcial por id o nombre
    clean = voice_id.lower().replace("-", "").replace("_", "")
    for f in os.listdir(MODELS_DIR):
        if f.endswith(".onnx"):
            f_clean = f.lower().replace("-", "").replace("_", "")
            if clean in f_clean or f_clean.startswith(clean[:6]):
                m_path = os.path.join(MODELS_DIR, f)
                cfg = f"{m_path}.json"
                return m_path, (cfg if os.path.isfile(cfg) else None)

    # 3. Fallback a voz femenina si se solicitó voz femenina
    is_female = any(k in voice_id.lower() for k in ["daniela", "ald", "female", "10246"])
    if is_female:
        for f in os.listdir(MODELS_DIR):
            if f.endswith(".onnx"):
                fl = f.lower()
                if "daniela" in fl or "ald" in fl or "10246" in fl:
                    m_path = os.path.join(MODELS_DIR, f)
                    cfg = f"{m_path}.json"
                    return m_path, (cfg if os.path.isfile(cfg) else None)

    # 4. Fallback general al primer modelo .onnx disponible
    all_onnx = [f for f in sorted(os.listdir(MODELS_DIR)) if f.endswith(".onnx")]
    if all_onnx:
        m_path = os.path.join(MODELS_DIR, all_onnx[0])
        cfg = f"{m_path}.json"
        return m_path, (cfg if os.path.isfile(cfg) else None)

    return None, None

def get_or_load_voice(voice_id):
    """Retorna la instancia de PiperVoice cargada en RAM, o la carga si es la primera vez"""
    if voice_id in loaded_voices:
        return loaded_voices[voice_id]

    model_path, config_path = find_model_path(voice_id)
    if not model_path:
        logger.error(f"No se encontró modelo ONNX para '{voice_id}' en {MODELS_DIR}")
        return None

    logger.info(f"Cargando modelo en memoria RAM: {os.path.basename(model_path)}...")
    try:
        voice = PiperVoice.load(model_path, config_path=config_path)
        loaded_voices[voice_id] = voice
        logger.info(f"✓ Modelo cargado exitosamente en RAM: {os.path.basename(model_path)}")
        return voice
    except Exception as e:
        logger.error(f"Error al cargar modelo {model_path}: {e}")
        return None

@app.route("/synthesize", methods=["POST", "GET"])
@app.route("/", methods=["POST", "GET"])
def handle_synthesize():
    text = ""
    voice_id = "es_AR-daniela-high"

    if request.method == "POST":
        if request.is_json:
            data = request.get_json(silent=True) or {}
            text = data.get("text", "")
            voice_id = data.get("voiceId") or data.get("voice") or voice_id
        else:
            text = request.data.decode("utf-8", errors="replace")
            voice_id = request.headers.get("X-Voice-Id") or request.args.get("voiceId") or request.args.get("voice") or voice_id
    else:
        text = request.args.get("text", "")
        voice_id = request.args.get("voiceId") or request.args.get("voice") or voice_id

    text = (text or "").strip()
    if not text:
        return Response("Texto vacío para síntesis.", status=400, mimetype="text/plain")

    voice = get_or_load_voice(voice_id)
    if not voice:
        return Response(f"Voz '{voice_id}' no disponible.", status=404, mimetype="text/plain")

    logger.info(f"Sintetizando {len(text)} caracteres con voz '{voice_id}'...")
    wav_io = io.BytesIO()
    with wave.open(wav_io, "wb") as wav_file:
        voice.synthesize(text, wav_file, sentence_silence=0.1)

    audio_bytes = wav_io.getvalue()
    logger.info(f"✓ Síntesis completada: {len(audio_bytes)} bytes WAV")
    return Response(audio_bytes, mimetype="audio/wav")

@app.route("/health", methods=["GET"])
def health():
    return {"status": "ok", "models_dir": MODELS_DIR, "loaded_voices": list(loaded_voices.keys())}

if __name__ == "__main__":
    port = int(os.environ.get("PIPER_PORT", 5000))
    host = os.environ.get("PIPER_HOST", "0.0.0.0")
    logger.info(f"Iniciando Piper Multi-Voz Daemon en {host}:{port}")
    logger.info(f"Directorio de modelos: {MODELS_DIR}")

    # Pre-cargar modelo por defecto (Vera Daniela AR si existe, o el que esté disponible)
    get_or_load_voice("es_AR-daniela-high")

    app.run(host=host, port=port, threaded=True)
