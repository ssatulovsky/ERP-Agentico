#!/usr/bin/env bash
# ==============================================================================
# Script de Descarga de Todas las Voces en Español de Piper TTS (Hugging Face)
# Repositorio Oficial: https://huggingface.co/rhasspy/piper-voices/tree/main/es
# ==============================================================================
set -e

# Directorio de destino prioritario
TARGET_DIR="${PIPER_MODELS_DIR:-/opt/agentic/piper}"

if [ ! -d "$TARGET_DIR" ]; then
  mkdir -p "$TARGET_DIR" 2>/dev/null || {
    TARGET_DIR="$(pwd)/piper"
    mkdir -p "$TARGET_DIR"
  }
fi

echo "========================================================================"
echo "  SISTEMA ERP AGENTIC - DESCARGA DE VOCES EN ESPAÑOL PIPER TTS"
echo "  Repositorio: Hugging Face (rhasspy/piper-voices/es)"
echo "  Directorio de destino: $TARGET_DIR"
echo "========================================================================"
echo ""

BASE_URL="https://huggingface.co/rhasspy/piper-voices/resolve/main"

# Lista de las 9 voces en español del repositorio con sus rutas y nombres
declare -a VOICES=(
  # 1. Argentina / Latam - Femenina (Alta Fidelidad 22kHz - Ideal para Vera)
  "es/es_AR/daniela/high/es_AR-daniela-high.onnx:es_AR-daniela-high.onnx:Vera (Daniela AR - High 22kHz Femenina)"
  "es/es_AR/daniela/high/es_AR-daniela-high.onnx.json:es_AR-daniela-high.onnx.json:Configuración Daniela AR"

  # 2. México / Latam - Femenina (Medium)
  "es/es_MX/ald/medium/es_MX-ald-medium.onnx:es_MX-ald-medium.onnx:Camila / Ald (MX - Medium Femenina)"
  "es/es_MX/ald/medium/es_MX-ald-medium.onnx.json:es_MX-ald-medium.onnx.json:Configuración Ald MX Medium"

  # 3. México / Latam - Femenina Ultrarrápida (x_low)
  "es/es_MX/ald/x_low/es_MX-ald-x_low.onnx:es_MX-ald-x_low.onnx:Ald (MX - x_low Femenina Ligera)"
  "es/es_MX/ald/x_low/es_MX-ald-x_low.onnx.json:es_MX-ald-x_low.onnx.json:Configuración Ald MX x_low"

  # 4. México / Latam - Masculina Alta Fidelidad (High 22kHz)
  "es/es_MX/claude/high/es_MX-claude-high.onnx:es_MX-claude-high.onnx:Claude (MX - High 22kHz Masculina)"
  "es/es_MX/claude/high/es_MX-claude-high.onnx.json:es_MX-claude-high.onnx.json:Configuración Claude MX"

  # 5. España - Masculina Sobria (Medium)
  "es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx:es_ES-sharvard-medium.onnx:Sharvard (ES - Medium Masculina)"
  "es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx.json:es_ES-sharvard-medium.onnx.json:Configuración Sharvard ES"

  # 6. España - Masculina Barítono (Medium)
  "es/es_ES/davefx/medium/es_ES-davefx-medium.onnx:es_ES-davefx-medium.onnx:Davefx (ES - Medium Masculina Barítono)"
  "es/es_ES/davefx/medium/es_ES-davefx-medium.onnx.json:es_ES-davefx-medium.onnx.json:Configuración Davefx ES"

  # 7. España - Masculina Ultrarrápida (x_low)
  "es/es_ES/carlfm/x_low/es_ES-carlfm-x_low.onnx:es_ES-carlfm-x_low.onnx:Carlfm (ES - x_low Masculina Ligera)"
  "es/es_ES/carlfm/x_low/es_ES-carlfm-x_low.onnx.json:es_ES-carlfm-x_low.onnx.json:Configuración Carlfm ES"

  # 8. España - MLS 10246 (Low)
  "es/es_ES/mls_10246/low/es_ES-mls_10246-low.onnx:es_ES-mls_10246-low.onnx:MLS 10246 (ES - Low Femenina)"
  "es/es_ES/mls_10246/low/es_ES-mls_10246-low.onnx.json:es_ES-mls_10246-low.onnx.json:Configuración MLS 10246 ES"

  # 9. España - MLS 9972 (Low)
  "es/es_ES/mls_9972/low/es_ES-mls_9972-low.onnx:es_ES-mls_9972-low.onnx:MLS 9972 (ES - Low Masculina)"
  "es/es_ES/mls_9972/low/es_ES-mls_9972-low.onnx.json:es_ES-mls_9972-low.onnx.json:Configuración MLS 9972 ES"
)

TOTAL_FILES=${#VOICES[@]}
CURRENT=0

download_file() {
  local remote_rel="$1"
  local local_filename="$2"
  local label="$3"
  local dest_path="$TARGET_DIR/$local_filename"
  local url="$BASE_URL/$remote_rel"

  CURRENT=$((CURRENT + 1))
  echo "[$CURRENT/$TOTAL_FILES] Comprobando: $label..."

  if [ -f "$dest_path" ] && [ -s "$dest_path" ]; then
    echo "  ✓ Ya existe en el disco: $local_filename ($(du -h "$dest_path" | cut -f1))"
    return 0
  fi

  echo "  ⬇ Descargando desde Hugging Face..."
  echo "    URL: $url"

  if command -v curl >/dev/null 2>&1; then
    curl -L -C - --fail --retry 3 --retry-delay 2 -o "$dest_path" "$url"
  elif command -v wget >/dev/null 2>&1; then
    wget -c -O "$dest_path" "$url"
  else
    echo "  ✗ Error: Ni curl ni wget están instalados en el sistema."
    exit 1
  fi

  if [ -f "$dest_path" ] && [ -s "$dest_path" ]; then
    echo "  ✓ Descarga exitosa: $local_filename ($(du -h "$dest_path" | cut -f1))"
  else
    echo "  ✗ Error al descargar: $local_filename"
    exit 1
  fi
}

for item in "${VOICES[@]}"; do
  IFS=":" read -r rel_path file_name label <<< "$item"
  download_file "$rel_path" "$file_name" "$label"
done

# Sanear JSONs para evitar error 'PhonemeType.ESPEAK' en Python 3.12/3.13
for json_file in "$TARGET_DIR"/*.json; do
  if [ -f "$json_file" ]; then
    sed -i 's/"phoneme_type": *"PhonemeType\.ESPEAK"/"phoneme_type": "espeak"/g' "$json_file" 2>/dev/null || sed -i '' 's/"phoneme_type": *"PhonemeType\.ESPEAK"/"phoneme_type": "espeak"/g' "$json_file" 2>/dev/null || true
  fi
done

echo ""
echo "========================================================================"
echo "  ¡DESCARGA COMPLETADA CON ÉXITO!"
echo "  Todas las 9 voces en español están disponibles en:"
echo "  $TARGET_DIR"
echo "========================================================================"
ls -lh "$TARGET_DIR"/*.onnx 2>/dev/null || true
echo ""
echo "Para verificar el estado en el sistema, la API y el panel web recargarán"
echo "automáticamente las voces detectadas."
