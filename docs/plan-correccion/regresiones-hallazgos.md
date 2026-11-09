# 4.1 Pruebas de regresión por hallazgo

Cada hallazgo de la auditoría (6 nov 2026) tiene al menos una prueba que reproduce el caso original y espera el error honesto. Todas corren en `npm test`; la prueba "4.1 Cada hallazgo #1 a #10 tiene al menos una prueba…" de `tests/phase4_markers.test.ts` falla si alguno queda sin cobertura.

| # | Hallazgo original | Caso que se reproduce | Resultado esperado hoy | Suite |
| --- | --- | --- | --- | --- |
| 1 | Vera anunciaba la factura folio 1542 a VeHiCe y presupuestos Dyneema con costos fijos | Orden "factura a VeHiCe", cotizar, inventario sin datos | Delega al motor agéntico; nunca "timbrada" ni folio; sin existencias ni montos de respaldo; los literales no existen fuera de `src/data/seed*` | `phase1_regressions` |
| 2 | Si fallaba el OCR, el servidor inventaba el comprobante con `success: true` | Subir comprobante sin `GEMINI_API_KEY`; respuesta de la IA inválida | 503 `OCR_UNAVAILABLE`, ningún monto; la heurística de respaldo ya no está en el controlador | `phase1_regressions` |
| 3 | "Probar conexión SII" marcaba CONECTADO por el largo de la clave | Clave incorrecta o sin clave registrada | El estado lo decide el portal del SII (`ERROR_CREDENCIALES`); sin esperas ni bitácoras simuladas | `phase1_regressions` |
| 4 | DTE con firma `SIMULATED_TED_KEY_OK` y certificado de demostración | Producción con simulación activa; emisión sin servicio HTTP-DTE | El servidor no arranca; la emisión falla; simulados quedan `SIMULADO`, enviados `ENVIADO`; el F29 los excluye | `phase1_regressions` |
| 5 | Sin LLM, una consulta no reconocida respondía `success: true` | "Analiza el balance" sin clave | `success: false`, `LLM_UNAVAILABLE`; cada respuesta muestra su modo | `phase2_regressions` |
| 6 | Finiquito con sueldo $1.000.000 e ingreso 2024-01-01 supuestos ($4.247.668) | Finiquito sin sueldo ni fechas; borrador DTE sin receptor; empresa no registrada | `MISSING_PARAMS` con la lista; sin "Empresa Cliente SpA" ni perfiles inventados | `phase2_regressions` |
| 7 | "Sincronizar API" marcaba CONECTADO; "100% cuadrado" con movimientos pendientes | Sincronizar; 1 movimiento sin calce | Ninguna cuenta queda CONECTADO; el mensaje muestra 1 pendiente | `phase2_regressions` |
| 8 | Período `2026-08` fijo en RCV, F29 y descarga | RCV o F29 sin período | Período obligatorio; `2026-08` no aparece en el código | `phase2_regressions` |
| 9 | El chat pedía "cifras numéricas realistas" | Prompt de `/api/gemini/chat` | Solo cifras del contexto o de herramientas; si faltan, las pide | `phase2_regressions` |
| 10 | Bitácoras con esperas, cartola de ejemplo, folio aleatorio, datos semilla | Formularios nuevos; arranque sin `DEMO_MODE` | Sin folio aleatorio ni $1.000.000; cartolas y empresas de ejemplo solo con `DEMO_MODE` y franja visible | `phase1_regressions`, `phase2_regressions` |

Complementan estas pruebas la búsqueda de marcadores (4.4: `Math.random` en montos, esperas de "procesamiento", `success: true` en un `catch`) y las pruebas de autonomía de la fase 3 (`phase3_autonomy`).
