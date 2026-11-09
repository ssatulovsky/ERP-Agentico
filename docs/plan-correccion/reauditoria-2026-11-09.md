# Re-auditoría ERPremIA (tarea 4.5)

9 nov 2026 · rama `fase-4-verificacion`

**Resultado:** en el código revisado no quedan hallazgos de gravedad alta o media. Los 10 hallazgos de la auditoría del 6 nov están corregidos y cada uno tiene su prueba de regresión. La re-auditoría encontró 12 problemas nuevos, que también se corrigieron en esta fase. Dos verificaciones siguen pendientes porque necesitan recursos externos: la evaluación con un LLM real (4.2) y la prueba en el ambiente de certificación del SII (4.3). Hasta ejecutarlas no se puede afirmar que el modelo elige bien las herramientas ni que la emisión y la descarga funcionan contra el SII.

Esta re-auditoría la hizo el mismo agente que corrigió el código. Para cumplir el criterio de "revisión independiente" del plan conviene que la repita otra persona u otro agente sin acceso a este trabajo.

## Cómo se revisó

- Las suites de prueba completas (13) y la autoprueba del banco de evaluación en una copia limpia del repositorio, con y sin las dependencias opcionales de WhatsApp: todo en verde.
- Búsqueda de marcadores en `src/` y `server.ts`: valores de respaldo en montos, factores fijos (`× 0,95`), `Math.random` en datos, esperas artificiales, éxitos sin operación, identificadores fabricados.
- Instalación real de punta a punta en el navegador, sin `DEMO_MODE`: instalador, primer ingreso, cambio de clave y dashboard de la empresa instalada.
- La demostración (`DEMO_MODE=true`) sigue funcionando, con su franja visible.

## Hallazgos de la auditoría original

| # | Hallazgo | Gravedad original | Estado | Prueba |
| --- | --- | --- | --- | --- |
| 1 | Vera con guiones (folio 1542, VeHiCe, Dyneema) | Alta | Corregido: las intenciones van al motor agéntico | `phase1_regressions` |
| 2 | OCR que inventaba comprobantes | Alta | Corregido: 503 `OCR_UNAVAILABLE` | `phase1_regressions` |
| 3 | Prueba de conexión SII simulada | Alta | Corregido: el estado lo decide el portal | `phase1_regressions` |
| 4 | DTE simulado activado en el ejemplo | Alta | Corregido: el servidor no arranca con simulación en producción; estados `ENVIADO`/`SIMULADO` | `phase1_regressions`, `phase4_certification` |
| 5 | Respaldo sin LLM con `success: true` | Media | Corregido: `LLM_UNAVAILABLE` | `phase2_regressions` |
| 6 | Finiquito y otras herramientas con valores supuestos | Media | Corregido: `MISSING_PARAMS` | `phase2_regressions` |
| 7 | Sincronización bancaria simulada y "100 % cuadrado" | Media | Corregido | `phase2_regressions` |
| 8 | Período `2026-08` fijo | Media | Corregido | `phase2_regressions` |
| 9 | Chat que pedía "cifras realistas" | Media | Corregido | `phase2_regressions` |
| 10 | Bitácoras con esperas, folios aleatorios, datos semilla | Baja | Corregido; los ejemplos solo con `DEMO_MODE` | `phase1_regressions`, `phase2_regressions` |

## Hallazgos nuevos de la re-auditoría (todos corregidos)

| # | Hallazgo | Gravedad | Corrección | Prueba |
| --- | --- | --- | --- | --- |
| R1 | Un usuario de una instalación real no podía usar el sistema: el instalador agregaba las empresas y usuarios de la demo, el administrador compartía id con el de la demo, la pantalla de ingreso solo conocía a los usuarios de la demo y no había forma de cambiar la clave temporal (el servidor bloquea todo hasta cambiarla) | Alta | Instalador con la primera empresa real; sin `DEMO_MODE` no hay datos de ejemplo; ingreso sin elegir empresa; cambio de clave obligatorio en el primer ingreso; identidad desde `/api/auth/me` | `phase4_install` y prueba en el navegador |
| R2 | La cartera de empresas vivía solo en el navegador: en otro equipo, "No hay empresas registradas" | Alta | API `/api/clients`; el ERP descarga y guarda la cartera en el servidor | `phase4_install` |
| R3 | La emisión DTE fabricaba TED (`TED_SIGNATURE_OK`), XML y Track ID si el servicio no los entregaba | Alta | Sin TED ni XML la emisión falla; sin Track ID queda `PENDIENTE` | `phase4_certification` |
| R4 | Ningún DTE pasaba de `ENVIADO`: no había consulta del Track ID | Media | Consulta por Track ID, herramienta del agente de facturación y tarea diaria con aviso de rechazos; el F29 excluye rechazados | `phase4_certification` |
| R5 | La comparativa de cotizaciones nunca veía las ofertas (campo inexistente) y suponía plazo 15 días y puntaje 85 | Media | Lee las ofertas registradas y ordena por costo con flete | `phase4_markers` |
| R6 | Variación de producción sin presupuesto: estándar = real × 0,95 (herramienta y dashboard) | Media | `NO_DATA`; el dashboard solo muestra órdenes con presupuesto | `phase4_markers`, `autonomous_agents_modules` |
| R7 | Dashboard: ingresos = facturado × 0,95, costo de ausencias a $55.000 y $48.000 por día, reparto por departamento fijo 45/25/15/15 % | Media | Datos registrados o vacío | `phase4_markers` |
| R8 | Dashboard: ratio corriente 2,5 y prueba ácida 2,0 sin pasivos; margen de cotizaciones 25 %; régimen "14 A General" por defecto | Media | "—" / "Sin datos" / "No informado" | Prueba en el navegador |
| R9 | Orden de compra adjudicada con 15 días de entrega y crédito a 30 días supuestos | Media | Condiciones de la oferta ganadora, o por confirmar | `phase4_markers` |
| R10 | Registrar una empresa en el estudio sin MySQL respondía "vinculada exitosamente" sin guardar | Media | Se guarda en disco | — |
| R11 | Pantallas con puntaje 85, Track ID "TRK-OK" y margen meta 35 % cuando faltaba el dato | Baja | Muestran que falta | — |
| R12 | Botón "Accesos QA" con perfiles de prueba visible fuera de la demo | Baja | Solo con `DEMO_MODE` | Prueba en el navegador |

## Observaciones de gravedad baja que se mantienen

| Observación | Ubicación | Motivo para mantenerla |
| --- | --- | --- |
| "Disponibilidad factoring" estimada con tasa fija de 1,8 % mensual | `BillingAutonomousAgent.tsx` | Rotulada como estimación con su supuesto a la vista; conviene reemplazarla por la tasa del contrato de factoring |
| Etiqueta "Sano" en el margen de contribución cuando no hay centros de costo | `ExecutiveDashboard.tsx` | No muestra cifras; mejora de texto |
| "Cliente General" como texto cuando la orden no tiene cliente | `OpClosureAnalysisModal.tsx` | Etiqueta, no dato |
| Folios aleatorios en los comprobantes de ejemplo de Rinde Móvil | `CollaboratorExpenseMobileApp.tsx` | Solo con `DEMO_MODE` |
| El despachador de tareas no coordina varias instancias | `agentSchedulerService.ts` | Documentado: activar en una sola instancia (`AGENT_SCHEDULER_ENABLED`) |

## Verificaciones pendientes (recursos externos)

| Tarea | Qué falta | Cómo se ejecuta | Criterio |
| --- | --- | --- | --- |
| 4.2 LLM real | Una clave de Gemini | `GEMINI_API_KEY=... npm run eval:llm` (240 consultas; informe en `evals/llm/resultados`) | 90 % de aciertos |
| 4.3 Certificación SII | Empresa habilitada en certificación, certificado digital, CAF de prueba y servicio HTTP-DTE | `CERT_RUT=... npm run certificacion:sii -- --emitir --rcv` | Emisión con Track ID aceptado y descarga RCV sin fallas |

## Veredicto por dimensión (actualizado)

| Dimensión | 6 nov | 9 nov |
| --- | --- | --- |
| Bucle agéntico con LLM | Real | Real, con historial, memoria y límites; falta la corrida con modelo real (4.2) |
| Herramientas | Real, con defaults inventados | Real; piden los datos que faltan (`MISSING_PARAMS`) |
| Aprobación humana | Real | Real; también para las tareas programadas |
| Integración SII (Playwright) | Real, no verificada en vivo | Real, no verificada en vivo; script de certificación listo (4.3) |
| "Agentes autónomos" por módulo | Parcial | Real: herramientas propias, memoria y tareas programadas que terminan en aprobación |
| Respaldo sin LLM | Parcial | Honesto: `LLM_UNAVAILABLE` o reglas rotuladas |
| Vera | Simulado | Delega en el motor agéntico |
| Conexiones externas en la UI | Forzado | Estados reales o error explícito |
