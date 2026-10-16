#!/usr/bin/env bash
# ==============================================================================
# Iniciar Servidor Daemon Residente de Piper TTS en segundo plano
# Carga el modelo neuronal una sola vez en la memoria RAM del VPS
# y responde a las solicitudes de audio en ~50 milisegundos (latencia ultra-baja).
# ==============================================================================

MODELS_DIR="${PIPER_MODELS_DIR:-/opt/agentic/piper}"
DEFAULT_MODEL="$MODELS_DIR/es_AR-daniela-high.onnx"
FALLBACK_MODEL="$MODELS_DIR/es_ES-sharvard-medium.onnx"
PORT=5000

if [ -f "$DEFAULT_MODEL" ]; then
  CHOSEN_MODEL="$DEFAULT_MODEL"
elif [ -f "$FALLBACK_MODEL" ]; then
  CHOSEN_MODEL="$FALLBACK_MODEL"
else
  CHOSEN_MODEL="$(ls "$MODELS_DIR"/*.onnx 2>/dev/null | head -n 1)"
fi

if [ -z "$CHOSEN_MODEL" ] || [ ! -f "$CHOSEN_MODEL" ]; then
  echo "Error: No se encontró ningún modelo .onnx en $MODELS_DIR"
  echo "Por favor ejecute primero: npm run download:voices"
  exit 1
fi

echo "=================================================================="
echo "  INICIANDO PIPER TTS DAEMON EN MEMORIA RAM (PORT $PORT)"
echo "  Modelo activo: $(basename "$CHOSEN_MODEL")"
echo "  Respuesta en tiempo real: ~50ms sin cold-starts"
echo "=================================================================="

# Verificar si python3 con módulo piper está en miniconda o path
PYTHON_BIN="/root/miniconda3/bin/python"
if [ ! -f "$PYTHON_BIN" ]; then
  PYTHON_BIN="$(which python3)"
fi

# Instalar soporte http si falta
$PYTHON_BIN -c "import piper.http_server" 2>/dev/null || {
  echo "Instalando soporte HTTP para Piper..."
  $PYTHON_BIN -m pip install "piper-tts[http]" -q
}

# Matar cualquier instancia anterior en el puerto 5000 de forma segura
fuser -k $PORT/tcp 2>/dev/null || true
pkill -f "piper_daemon.py" 2>/dev/null || true
pkill -f "piper.http_server" 2>/dev/null || true
sleep 1

# Priorizar el script multi-voz propio que soporta dinámicamente todas las 9 voces
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DAEMON_PY="$SCRIPT_DIR/piper_daemon.py"

if [ -f "$DAEMON_PY" ]; then
  echo "Iniciando Daemon Multi-Voz ($DAEMON_PY)..."
  nohup $PYTHON_BIN "$DAEMON_PY" > /tmp/piper_server.log 2>&1 &
else
  echo "Iniciando piper.http_server estándar..."
  nohup $PYTHON_BIN -m piper.http_server -m "$CHOSEN_MODEL" --port $PORT > /tmp/piper_server.log 2>&1 &
fi

DAEMON_PID=$!
sleep 2

if ps -p $DAEMON_PID > /dev/null 2>&1 || lsof -i:$PORT > /dev/null 2>&1; then
  echo "✓ Daemon de Piper iniciado exitosamente en http://127.0.0.1:$PORT"
  echo "  Logs en tiempo real: tail -f /tmp/piper_server.log"
else
  echo "Aviso: Comprobando log de arranque en /tmp/piper_server.log:"
  cat /tmp/piper_server.log | tail -n 10
fi

