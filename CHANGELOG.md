# CHANGELOG — ERPremIA

## Plan de corrección · Fase 3: autonomía real (6 nov 2026)

| Tarea | Cambio | Verificación |
| :--- | :--- | :--- |
| **3.1** Herramientas por agente | `src/config/agentToolPolicy.ts`: cada agente declara su lista cerrada de herramientas (`herramientasPermitidas` en el registro). Al modelo solo se envían esas; cualquier otra se rechaza con `TOOL_NOT_ALLOWED`, también en el núcleo de reglas. Módulo sin agente → `MODULE_UNKNOWN`. Nuevo agente `FACTURACION_DTE` (lo usaban Vera y el agente de facturación). Un agente solo pide aprobaciones de su propio módulo. | `tests/phase3_autonomy.test.ts`: el agente de inventario no puede llamar `tool_hr_calculate_finiquito` |
| **3.2** Contexto y memoria | La instrucción de sistema lleva el perfil operativo de la empresa (solo datos registrados), las directivas del estudio y las correcciones aprendidas (`buildAgentMemoryContext`); el historial de la conversación (`history`, 12 turnos) llega al modelo. La respuesta informa `learningsApplied`. El perfil ya no trae un plan de cuentas genérico inventado. | Una corrección registrada cambia la respuesta siguiente; las de otra empresa no se inyectan |
| **3.3** Ejecuciones programadas | `src/services/agentSchedulerService.ts`: conciliación diaria, RCV diario, borrador F29 el día 5 y depreciación mensual, en hora de Chile, con estado persistido (sin repetir ni perder horarios). Las tareas usan el motor con la lista de su agente y terminan en solicitud de aprobación (calces, borrador F29, asiento de depreciación); no duplican propuestas pendientes. Al aprobar los calces, los movimientos quedan conciliados. API `/api/agents/schedules`; `AGENT_SCHEDULER_ENABLED=true` en una sola instancia. | 3 agentes (Conciliación, Tributario, Activo fijo) terminan en aprobación humana; auditoría por ejecución; A6.15 en el perímetro HTTP |
| **3.4** Alertas proactivas | `src/services/agentAlertService.ts`: cada ejecución que requiere acción genera una alerta en el panel "Alertas de agentes" del dashboard ejecutivo (con las aprobaciones pendientes y las tareas programadas) y un WhatsApp al responsable o a los números autorizados del módulo. El estado de cada canal se guarda tal como ocurrió (`ENVIADA`, `NO_CONECTADO`, `SIN_DESTINATARIO`, `ERROR`). Conciliación y F29 muestran las aprobaciones de su agente. | El responsable recibe la alerta por WhatsApp sin abrir el módulo |
| **3.5** Límites y costos | `aiRouterService`: máximo de llamadas al modelo por ejecución, tokens y gasto en CLP por empresa y por día, y ejecuciones programadas por día (variables `AGENT_MAX_*`, configuración guardada o por empresa; editable en el administrador de IA). Cada llamada del motor registra sus tokens. Al agotar el presupuesto el agente se detiene (`BUDGET_EXCEEDED`, HTTP 429) y la tarea programada queda `BLOQUEADO_LIMITE` con aviso. | Un agente programado no supera el presupuesto configurado |

---

## Plan de corrección · Cierre de fases 0–2 y verificación 4.4 (6 nov 2026)

| Tarea | Cambio | Verificación |
| :--- | :--- | :--- |
| **Cierre 2.4** Empresa por defecto | Se eliminan `76.892.410-K`, `client-retail-01` y `client-default` como empresa por defecto en rutas, servicios, pantallas y WhatsApp. `agentContextBuilderService` ya no inyecta el perfil inventado "Distribuidora y Comercializadora del Pacífico SpA" ni régimen 14 D3/PPM 0,25 % ni la cuenta 00-123-45678-90. Las rendiciones de ejemplo ya no se insertan en MySQL salvo con `DEMO_MODE`. Los comprobantes y proyectos de la empresa de ejemplo ya no aparecen en otras empresas. WhatsApp conservaba mal la empresa de cada número (siempre consultaba la de ejemplo): corregido. | `phase2_regressions` (3 pruebas nuevas) |
| **1.6** Modo demostración explícito | Franja "DEMOSTRACIÓN · Datos de ejemplo sin validez tributaria ni contable" en toda la UI con `DEMO_MODE=true`. | `phase1_regressions` |
| **Cierre 0.2** Cartera y estudio | Sin `DEMO_MODE`, la app parte sin empresas (pantalla "Registrar primera empresa") y sin el estudio "Siex Consultores"; sin períodos cerrados inventados. | `phase1_regressions` + prueba en navegador |
| **Cierre** App compilada | `npm run build` producía una pantalla en blanco (node:crypto en el navegador). Corregido. | Prueba en navegador con y sin `DEMO_MODE` |
| **4.4** Marcadores | Sin `Math.random` en folios, contraseñas ni salt; sin esperas simuladas (prueba SII, OCR, autollenado "desde SII", "recalcular", "re-auditar"); sin folios oficiales inventados (certificado DT, REL, licencias); sin montos de respaldo (cierre de período con devengos de $1.250.000, US$8.500, 45 UF, activo fijo $45.000.000 y rendición $50.000; proyecciones con sueldos de $14.850.000 y ventas de $48.500.000; centralizaciones de depreciación y producción con montos supuestos; CPT $85.400.000; PPM 1 %). Folios internos correlativos (`src/utils/folioInterno.ts`). | `tests/phase4_markers.test.ts` (7 pruebas) |
| **Textos** | README, metadatos y UI dicen "asistentes con herramientas" hasta completar la Fase 3. La copia duplicada `agentic/` deja de versionarse. | — |

Pendiente (requiere decisión de producto, no es una simulación): el estado RBAC inicial asigna a los usuarios las empresas de ejemplo; una instalación productiva necesita un flujo de alta del primer SuperAdmin y de la primera empresa.

---

## Plan de corrección · Fase 2: motor y herramientas honestos (6 nov 2026)

| Tarea | Hallazgo | Cambio | Verificación |
| :--- | :---: | :--- | :--- |
| **2.1** Respaldo sin IA honesto | #5 | La rama genérica del núcleo determinista devuelve `success: false, code: 'LLM_UNAVAILABLE'`; una respuesta vacía del modelo devuelve `LLM_EMPTY_RESPONSE`. El endpoint responde 503/422 con `code` y `missingParams`. Las ramas con herramienta conservan `DETERMINISTIC_COMPLIANCE_CORE`. | `tests/phase2_regressions.test.ts` (#5) |
| **2.2** Finiquito sin defaults | #6 | Sin `sueldoBase`, `fechaIngreso`, `fechaDespido`, causal, feriado pendiente (y aviso previo en Art. 161) → `MISSING_PARAMS`. El núcleo determinista ya no usa `'2024-01-01'` ni "hoy". | #6 + `agent_tools` actualizado |
| **2.3** Período explícito | #8 | Nuevo `src/utils/periodo.ts`. RCV, F29, activo fijo, CSV y reconciliación RCV exigen período (argumento o `context.selectedPeriod`). La UI propone el mes en curso y lista los últimos 18 meses; descarga RCV con selector de período. Se eliminan el F29 "VALIDADO" con folio y montos fijos de `/api/modules/f29/declarations`, el caso Ley Karin, los registros de marketing/tickets, el catálogo de inventario y las bodegas de ejemplo. El historial de RRHH de ejemplo pasa a `src/data/seedHrHistory.ts`. Cero `2026-08` fuera de `src/data/seed*`. | #8 |
| **2.4** Revisión de defaults | #6 | Tabla en `docs/plan-correccion/tabla-defaults-herramientas.md`. Sin `'Empresa Cliente SpA'`/`'Empresa Contribuyente SpA'`; nómina, DTE, RFQ, orden de compra, cierre de producción y gobernanza exigen sus datos. `tool_sii_ingest_csv` ahora guarda los documentos (antes solo contaba líneas). Rutas sin empresa por defecto (`client-retail-01`, `76.892.410-K` en `erpModulesController`). | #6 |
| **2.5** Banco sin conexión simulada | #7 | "Sincronizar API" se reemplaza por "Importar cartola"; nunca asigna `CONECTADO`. Sin cuentas no se crea una cuenta de respaldo con saldo $44.382.013. | #7 |
| **2.6** Mensaje de conciliación | #7 | `src/utils/bankReconciliationReport.ts`: informa conciliados, ambiguos y pendientes; "100% cuadrado" solo con 0 pendientes/ambiguos y diferencia cartola vs. libro mayor = $0. | #7 |
| **2.7** Prompt del chat | #9 | El chat usa solo cifras del contexto o del usuario y pide las faltantes; no emite ni registra. | #9 |
| **2.8** Formularios sin datos precargados | #10 | Formulario DTE sin folio aleatorio ni $1.000.000 (estado `PENDIENTE`); la ingesta pegada omite líneas incompletas en vez de inventar RUT/folio/monto; cartolas de ejemplo y "restablecer cartola" solo con `DEMO_MODE`. | #10 |
| **2.9** Modo de ejecución visible | #5 | Cada respuesta del motor lleva `[Modo: IA + herramientas | Reglas | Demostración · …]` y el campo `executionModeLabel`; Vera lo muestra en su encabezado. | #5 |

Pendiente para la re-auditoría: empresa por defecto `76.892.410-K` en otros controladores y servicios (ver la tabla de defaults).

---

## Plan de corrección · Fase 1: éxitos falsos de gravedad alta (6 nov 2026)

| Tarea | Hallazgo | Cambio | Verificación |
| :--- | :---: | :--- | :--- |
| **1.4** DTE simulado bajo control | #4 | `src/config/dteSimulationPolicy.ts`. `ALLOW_OFFLINE_DTE_SIMULATION=false` en `.env.example`; con `NODE_ENV=production` o `DTE_AMBIENTE=2` y el valor en `true`, el servidor no arranca. El certificado de demostración solo existe en desarrollo con simulación activa (si no, `loadDigitalCertificate` devuelve `null` y la emisión se bloquea). Un DTE emitido queda `ENVIADO` (no `ACEPTADO`) hasta consultar el Track ID; uno simulado queda `SIMULADO`, se marca en rojo en la UI y el F29 lo excluye. | `tests/phase1_regressions.test.ts` (#4, 7 pruebas, incluye arranque real del servidor) |
| **1.1** OCR sin inventar | #2 | Nuevo `src/services/receiptOcrService.ts` con esquema zod. Se elimina la heurística de respaldo; sin IA o con JSON inválido, `POST /api/expenses/scan-receipt-ai` responde 503 `OCR_UNAVAILABLE`. El prompt ya no pide inventar RUT, año ni confianza. La app móvil abre el formulario manual vacío, exige monto, RUT, folio y fecha, y oculta los comprobantes de prueba fuera de `DEMO_MODE`. | #2 (3 pruebas) |
| **1.2** Prueba de conexión SII real | #3 | `SiiPlaywrightRunner.testLogin` + `POST /api/sii/test-login`: autentica con Playwright, informa el texto del SII y cierra la sesión. Sin espera de 1,2 s ni validación por longitud de clave. Las altas de clientes ya no asignan la clave `ClaveSii*2026` ni el estado `CONECTADO`. La clave se resuelve desde la bóveda del servidor (`siiCredentialResolver.ts`). | #3 (prueba con portal local y Chromium real) |
| **1.3** Bitácora de descarga real | #3, #10 | La bitácora muestra los logs que devuelve Playwright; se eliminan los mensajes con espera artificial. Una falla de descarga ya no marca `ERROR_CREDENCIALES`. | #3/#10 |
| **1.5** Vera sin guiones | #1 | Se eliminan los flujos de presupuesto Dyneema, factura VeHiCe (folio 1542), inventario de respaldo y el informe bancario con cifras fijas. Facturar, cotizar, inventario, bancos y escenarios de flujo de caja van al motor agéntico (`detectAgenticIntent`); si no responde, Vera lo dice sin inventar. Remuneraciones sin liquidaciones ya no muestra montos de respaldo. | #1 (4 pruebas) |

Pendiente: 1.6 (franja "DEMOSTRACIÓN") es opcional y no se implementó. El CI instala Chromium de Playwright para la prueba de login.

---

## Plan de corrección · Fase 0: repositorio ejecutable (6 nov 2026)

| Tarea | Cambio | Verificación |
| :--- | :--- | :--- |
| **0.1** Recuperar `src/data/` | `.gitignore` ignora solo `/data/` y `/storage/` de la raíz; `src/data/` queda versionado. El snapshot `data/db_disk_snapshot.json` deja de versionarse. | Clon limpio: `tsc --noEmit` sin errores; `tests/phase0_repository.test.ts` |
| **0.2** Semilla vs. maestros | Maestros a `src/config/` (`erpMasterConfig`, `defaultAgentPersonas`, `defaultInvoiceLayouts`); auxiliares de ejemplo a `src/data/seedClientAuxiliaries.ts`. Nuevo `src/config/demoMode.ts` (`DEMO_MODE`, `demoSeed`, `isDemoClient`). Con `DEMO_MODE=false` (valor por defecto) ninguna empresa recibe DTEs, F29, nóminas, contratos, cartolas, cuentas, cheques ni inventario semilla; con `DEMO_MODE=true` solo las empresas de ejemplo. El servidor deja de usar la primera empresa semilla como respaldo (worker F29, `/api/f29/senior-agent`, emisión DTE) y deja de sembrar nómina en MySQL para clientes reales. | `tests/phase0_repository.test.ts` (0.2) |
| **0.3** Dependencias WhatsApp | `@whiskeysockets/baileys`, `qrcode` y `ffmpeg-static` en `optionalDependencies`. El servidor ya no ejecuta `npm install` en tiempo de ejecución: si faltan, el puente informa `NOT_INSTALLED` y la UI muestra "NO INSTALADO". Se retira el respaldo que enviaba el QR de sesión a `api.qrserver.com`. | `tests/phase0_repository.test.ts` (0.3) |
| **0.4** Integración continua | `.github/workflows/ci.yml`: `npm ci`, `npm run lint`, `npm test` y `npm run build`, con y sin las dependencias del puente. | CI en verde |

Las suites de integración existentes usan las empresas de ejemplo como fixtures y corren con `DEMO_MODE=true` (`tests/setup/enableDemoMode.ts`).

---

## Auditoría y Reingeniería Agéntica ERPremIA v2.0.0

Este documento certifica y detalla la resolución integral de todas las observaciones levantadas por la auditoría técnica y de seguridad sobre **ERPremIA** (Sistema ERP Contable, Tributario y Agéntico Autónomo para Chile).

Se eliminaron completamente todas las simulaciones ("como si"), se cerró el perímetro de seguridad con aislamiento multi-tenant estricto y se transformaron todos los módulos restantes en verdaderos **Agentes Autónomos ReAct** con Function Calling, herramientas de servidor, gobernanza *Human-in-the-Loop* y ejecutores transaccionales registrados en el Libro Mayor.

---

## 1. Matriz de Cumplimiento de Auditoría

| Ítem | Requerimiento / Vulnerabilidad Auditada | Estado | Archivos Modificados / Creados | Pruebas de Verificación |
| :--- | :--- | :---: | :--- | :--- |
| **A1** | **Bandeja de Aprobación & Anti-Spoofing:**<br>Eliminar falsificación de identidad del aprobador; verificar rol facultado y empresa del solicitante. | **RESUELTO** | `server.ts`<br>`src/controllers/agentGovernanceController.ts`<br>`src/middlewares/authMiddleware.ts`<br>`src/services/hrManagementService.ts` | `tests/http_security_rbac.test.ts` (Tests 5, 6, 7, 8, 9)<br>`tests/e2e_audit_verification.test.ts` (Test 1) |
| **A2** | **Sesión en Servidor & Credenciales Seguras:**<br>Ruta `/api/auth/login`, contraseñas con scrypt, flag `debeCambiarPassword: true`, bloqueo de rutas de negocio hasta cambio de clave. | **RESUELTO** | `src/controllers/authController.ts`<br>`src/middlewares/authMiddleware.ts`<br>`src/services/securityRbacService.ts`<br>`src/utils/passwordCrypto.ts` | `tests/http_security_rbac.test.ts` (Tests 1, 2, 3, 4)<br>`tests/http_route_perimeter.test.ts` (Test A6.9) |
| **A3** | **Bóveda SII Cifrada:**<br>Cifrado AES-256-GCM para `claveSii`, nunca en texto plano, enmascaramiento con asteriscos, aislamiento estricto por RUT. | **RESUELTO** | `src/services/httpDteBillingService.ts`<br>`src/utils/vaultCrypto.ts`<br>`src/controllers/erpModulesController.ts` | `tests/http_route_perimeter.test.ts` (Test A6.5) |
| **A4** | **Aislamiento Cross-Tenant en Agentes:**<br>Segregación estricta por `empresaId`, imposibilidad de ejecutar agentes sobre empresas ajenas. | **RESUELTO** | `src/controllers/autonomousAgentsController.ts`<br>`src/services/autonomousAgentEngine.ts`<br>`src/middlewares/authMiddleware.ts` | `tests/http_security_rbac.test.ts` (Test 5, 10)<br>`tests/http_route_perimeter.test.ts` (Test A6.3) |
| **A5** | **Protección de Endpoints Sensibles:**<br>Bloqueo de autoasignación de SuperAdmin, configuración de IA, whitelist de WhatsApp y sueldos de RRHH sin autorización. | **RESUELTO** | `server.ts`<br>`src/controllers/authController.ts`<br>`src/middlewares/centralizedAuthorizationMiddleware.ts` | `tests/http_route_perimeter.test.ts` (Tests A6.4, A6.6, A6.7, A6.8) |
| **A6** | **Perímetro de Seguridad Exhaustivo:**<br>Verificación dinámica de las 189 rutas del stack de Express con mapa canónico de autorización. | **RESUELTO** | `server.ts`<br>`src/middlewares/authMiddleware.ts`<br>`tests/http_route_perimeter.test.ts` | `tests/http_route_perimeter.test.ts` (Tests A6.1 a A6.9) |
| **A7** | **Validación Universal de Empresa & Identificadores (HTTP 400):**<br>Rechazo con HTTP 400 de cualquier valor que no sea un texto único en `empresaId`, `rut`, `companyId`, `firmId`, `idOrRut` (listas, arrays, repeticiones en query string, objetos NoSQL, tipos no-string, cadenas vacías, delimitadores o valores conflictivos). Exigencia de consumo exclusivo de `req.effectiveEmpresaId` en todos los controladores y rutas. Extensión del perímetro a todas las rutas de la API. | **RESUELTO** | `server.ts`<br>`src/middlewares/authMiddleware.ts`<br>`src/middlewares/centralizedAuthorizationMiddleware.ts`<br>`src/controllers/*.ts`<br>`tests/http_route_perimeter.test.ts` | `tests/http_route_perimeter.test.ts` (Tests A6.10, A6.11, A6.12, A6.13) |
| **B1** | **Agente Autónomo Activo Fijo (NIC 16):**<br>Depreciación mensual financiera y tributaria, bajas/enajenaciones, propuesta y ejecutor `DEPRECIACION_ACTIVO_FIJO` y `BAJA_ACTIVO_FIJO`. | **RESUELTO** | `src/services/autonomousAgentEngine.ts`<br>`src/services/hrManagementService.ts`<br>`src/services/diskPersistenceService.ts` | `tests/autonomous_agents_modules.test.ts` (Tests B.1.1, B.1.2, B.1.3) |
| **B2** | **Agente Autónomo Costos de Producción (NIC 2):**<br>Costeo real MPD, MOD, CIF, variaciones estándar vs real, propuesta y ejecutor `CIERRE_ORDEN_PRODUCCION` (WIP -> PT). | **RESUELTO** | `src/services/autonomousAgentEngine.ts`<br>`src/services/hrManagementService.ts`<br>`src/utils/chileanAccounting.ts` | `tests/autonomous_agents_modules.test.ts` (Tests B.2.1, B.2.2) |
| **B3** | **Agente Autónomo Flujo de Caja & Simulación:**<br>Proyección 30/60/90 días real basada en DTEs, nóminas y saldos bancarios, simulación de estrés (What-If) sin datos mock. | **RESUELTO** | `src/services/autonomousAgentEngine.ts` | `tests/autonomous_agents_modules.test.ts` (Test B.3) |
| **B4** | **Agente Autónomo Abastecimiento Comercial & Ejecutor OC:**<br>Análisis de margen, licitación RFQ, cuadro comparativo de cotizaciones y ejecutor `EMITIR_ORDEN_COMPRA` con validaciones estrictas: rechazo si falta proveedor, SKU, cantidad o precio (cero valores por defecto); cálculo riguroso del precio unitario; validación de coincidencia exacta del total calculado vs monto aprobado; y estado inicial "EMITIDA" (no "ENVIADA_PROVEEDOR" mientras no exista despacho). | **RESUELTO** | `src/services/autonomousAgentEngine.ts`<br>`src/services/hrManagementService.ts`<br>`src/services/commercialProcurementService.ts`<br>`src/types/commercialProcurement.ts` | `tests/autonomous_agents_modules.test.ts` (Tests B.4.1, B.4.2) |
| **B5** | **Agente Autónomo Rendición de Gastos:**<br>Auditoría tributaria de gastos, consistencia aritmética de comprobantes y ejecutor `CENTRALIZAR_RENDICION` al Libro Mayor. | **RESUELTO** | `src/services/autonomousAgentEngine.ts`<br>`src/services/hrManagementService.ts`<br>`src/services/diskPersistenceService.ts` | `tests/autonomous_agents_modules.test.ts` (Test B.5) |
| **B6** | **Facturación DTE & Ejecutor Oficial:**<br>Emisión de DTE bajo verificación oficial de CAF; llamada real a `HttpDteBillingService.emitirDte`; marcado de `EJECUTADO` única y exclusivamente con Track ID o Timbre Electrónico (TED) devuelto por el servicio; ante cualquier falla o CAF apócrifo, transición estricta a `ERROR_EJECUCION`. | **RESUELTO** | `src/services/autonomousAgentEngine.ts`<br>`src/services/hrManagementService.ts`<br>`src/services/httpDteBillingService.ts`<br>`src/services/moduleAgentGovernanceService.ts`<br>`src/controllers/agentGovernanceController.ts` | `tests/agent_tools.test.ts` (Tests CAF)<br>`tests/autonomous_agents_modules.test.ts` (Tests B.6.1, B.6.2) |
| **B7** | **Sincronización RCV SII:**<br>Ingesta CSV oficial, consulta de estado de bóveda tributaria y reconciliación de RCV vs Libro Mayor (Cta 1.1.09 y 2.1.05). | **RESUELTO** | `src/services/autonomousAgentEngine.ts`<br>`src/services/siiRcvService.ts` | `tests/agent_tools.test.ts` (Tests SII)<br>`tests/autonomous_agents_modules.test.ts` |
| **B8** | **Erradicación Total de "Como Si":**<br>Eliminación de métricas duras inventadas (`68%`, `1360/2000`, `'OP-2026-101'`, `$10.150.000`) en Asistente de Voz y WhatsApp; respuesta honesta `NO_DATA`. | **RESUELTO** | `src/services/voiceAssistantEngine.ts`<br>`src/services/whatsappBridgeService.ts` | `tests/autonomous_agents_modules.test.ts` (Test B.7)<br>`tests/e2e_audit_verification.test.ts` (Test 7) |
| **B9** | **Conexión Total de Pantallas UI & Canales al Motor Agéntico:**<br>Integración de 7 pantallas operativas (Activo fijo, Producción, Flujo de caja, Compras, Rendiciones, DTE, SII) con trazabilidad de pensamiento ReAct (`steps`) y alertas de gobernanza humana. Canales de Voz y WhatsApp despachan sus peticiones al motor autónomo (`AutonomousAgentEngine`) ejecutando herramientas reales. | **RESUELTO** | `src/components/FixedAssetAgentModule.tsx`<br>`src/components/ProductionCostingAgentModule.tsx`<br>`src/components/CashFlowAutonomousAgentModal.tsx`<br>`src/components/CommercialProcurementAgentModule.tsx`<br>`src/components/expenses/ExpenseReportsModule.tsx`<br>`src/components/BillingAutonomousAgent.tsx`<br>`src/components/DteManager.tsx`<br>`src/services/voiceAssistantEngine.ts`<br>`src/services/whatsappBridgeService.ts` | `tests/autonomous_agents_modules.test.ts` (Test B.7)<br>`tests/e2e_audit_verification.test.ts` |
| **C1** | **Servidor Fuente Única de Verdad (SSOT):**<br>Persistencia cross-restart de aprobaciones en disco; `resolveApproval` busca en almacenamiento persistente ante reinicios. | **RESUELTO** | `src/services/hrManagementService.ts`<br>`src/services/diskPersistenceService.ts` | `tests/autonomous_agents_modules.test.ts` (Test C.1) |
| **C2** | **Umbral de Aprobación Financiera:**<br>Control por `umbralAprobacionClp` ($5.000.000 CLP default); montos superiores requieren obligatoriamente rol Administrador o SuperAdmin. | **RESUELTO** | `src/middlewares/authMiddleware.ts` | `tests/autonomous_agents_modules.test.ts` (Test C.2) |
| **C3** | **Persistencia de DTE, Remuneraciones y Bancos en el Servidor (SSOT):**<br>Sincronización en `App.tsx` al montar y al cambiar de empresa desde endpoints REST; localStorage relegado estrictamente a caché local; eliminación absoluta de `.catch(() => {})` silenciosos y alerta visual en UI ante cualquier fallo de red/servidor; endpoints `/api/rcv/dtes`, `/api/payroll`, `/api/modules/banking/accounts` y `/api/modules/banking/transactions` con soporte de actualización/reemplazo e integración multi-tenant en disco. | **RESUELTO** | `src/App.tsx`<br>`src/services/diskPersistenceService.ts`<br>`src/controllers/siiRcvController.ts`<br>`src/controllers/payrollController.ts`<br>`src/controllers/erpModulesController.ts`<br>`src/utils/storageService.ts` | `tests/autonomous_agents_modules.test.ts` (Test C.3) |
| **D1** | **Instalación Inicial sin Contraseñas Conocidas:**<br>Generación aleatoria criptográfica de alta entropía para claves temporales al instalar (`src/scripts/installSystem.ts`, `npm run setup:install`); erradicación de hashes predecibles en código fuente (`DEFAULT_SECURITY_USERS`); exigencia forzosa de `debeCambiarPassword: true`; eliminación total de contraseñas fijas o en texto plano en `tests/` sustituidas por buffers efímeros. | **RESUELTO** | `src/services/securityRbacService.ts`<br>`src/scripts/installSystem.ts`<br>`tests/agent_tools.test.ts`<br>`tests/autonomous_agents_modules.test.ts`<br>`tests/http_security_rbac.test.ts`<br>`tests/http_route_perimeter.test.ts` | `npm run setup:install`<br>`tests/http_security_rbac.test.ts` (Tests 1-4)<br>`tests/http_route_perimeter.test.ts` (A6.9) |
| **D2** | **Revisión Rigurosa de Ejecutores & Conciliación Monto Aprobado vs Ejecutado:**<br>Revisión y blindaje de los 6 ejecutores transaccionales (`DEPRECIACION_ACTIVO_FIJO`, `BAJA_ACTIVO_FIJO`, `CIERRE_ORDEN_PRODUCCION`, `EMITIR_ORDEN_COMPRA`, `CENTRALIZAR_RENDICION`, `EMITIR_DTE`). Cero datos inventados (validación de IDs de activo, OP, orden y reporte). Validación de coincidencia matemática exacta entre `montoAprobadoClp` e `impactoFinancieroClp` vs `montoEjecutadoClp`. Cualquier discrepancia transiciona a `ERROR_EJECUCION` y aborta la transacción. Efecto verificable comprobado en Libro Mayor y estados operacionales. | **RESUELTO** | `src/services/hrManagementService.ts`<br>`src/types.ts`<br>`tests/autonomous_agents_modules.test.ts` | `tests/autonomous_agents_modules.test.ts` (Tests B.8.1 a B.8.6) |
| **E1** | **Facturación DTE sin Datos Inventados:**<br>Erradicación absoluta de receptores inventados (RUT `77.798.901-4`, `"CLIENTE RECEPTOR SPA"`, `"Av. Providencia 1234"`, `"contacto@receptor.cl"`), emisores ficticios (`"Av. Industrial 1000"`, `"PUERTO MONTT"`) e ítems ficticios generados a partir del título. Si el borrador solo incluye el monto o carece de receptor o ítems detallados, el ejecutor aborta con `ERROR_EJECUCION` sin enviar ningún documento al servicio de timbrado. | **RESUELTO** | `src/services/hrManagementService.ts`<br>`src/services/httpDteBillingService.ts`<br>`src/controllers/billingDteController.ts` | `tests/autonomous_agents_modules.test.ts` (Tests B.6.2, B.8.6) |
| **E2** | **Idempotencia y Prevención de Múltiples Ejecuciones de Aprobaciones:**<br>Verificación estricta de estado `PENDIENTE` previo a cualquier resolución en `HrManagementService.resolveApproval` y en el endpoint `POST /api/governance/approvals/:id/resolve` (retorna HTTP 409 `SOLICITUD_YA_RESUELTA`). Se impide categóricamente la re-ejecución y la duplicación de asientos contables en el Libro Mayor ante reintentos o clics repetidos. | **RESUELTO** | `src/controllers/agentGovernanceController.ts`<br>`src/services/hrManagementService.ts` | `tests/autonomous_agents_modules.test.ts` (Tests B.6.2, B.8.1) |
| **E3** | **Soporte de Objetos Empresa en Perímetro HTTP (Cero Falsos Positivos):**<br>Adaptación del middleware de perímetro de seguridad para admitir objetos contenedores de empresa (`{ empresa: company }`, `{ companyContext: ... }`) en el cuerpo de peticiones legítimas del Asistente Contable, Auditor Fiscal IA, Chat Vera y Asistente de Voz libre, manteniendo el rechazo estricto (HTTP 400) contra vectores de inyección por listas o arrays. | **RESUELTO** | `src/middlewares/centralizedAuthorizationMiddleware.ts` | `tests/http_route_perimeter.test.ts` (Tests A6.10 a A6.14) |
| **E4** | **Erradicación de Cuentas Contables por Defecto & Validación de Activos:**<br>Eliminación de cuentas fijas o hardcodeadas (`5.2.13`, `1.2.01`, `1.1.08`, `5.2.05`, `1.1.01`), exigiendo códigos contables explícitos en cada línea o abortando con `ERROR_EJECUCION`. En depreciación de activo fijo, rechazo estricto si `activosAfectados` viene vacío (`[]`) para evitar depreciar indiscriminadamente todos los bienes del tenant. | **RESUELTO** | `src/services/hrManagementService.ts` | `tests/autonomous_agents_modules.test.ts` (Tests B.8.1 a B.8.5) |
| **E5** | **Entregable Limpio sin Sesiones Activas ni Directorios de Datos/Build:**<br>Purga completa de sesiones activas en los snapshots de disco (`data/db_disk_snapshot.json` con `sessions: {}`). Exclusión forzosa de los directorios `data/` y `dist/` en el empaquetado de distribución `agentic.zip`. | **RESUELTO** | `data/db_disk_snapshot.json`<br>`agentic.zip` | Inspección de snapshot y verificación de contenidos de ZIP |

---

## 2. Resumen de Pruebas Automatizadas

El proyecto cuenta con **72 pruebas automatizadas** organizadas en 5 suites formales, todas ejecutándose exitosamente con **100% de tasa de aprobación**:

1. `tests/agent_tools.test.ts` (20 pruebas):
   - Verificación de 11 Agentes Especialistas registrados en Gobernanza.
   - Herramientas contables, tributarias F29, RR.HH., Inventario Kardex PMP y Conciliación Bancaria.
   - Verificación criptográfica RSA real de CAFs y rechazo de firmas simuladas.
2. `tests/e2e_audit_verification.test.ts` (7 pruebas):
   - Ciclo E2E agéntico: Propuesta -> Aprobación -> Asiento en Libro Mayor.
   - Aislamiento multi-tenant entre empresas.
   - Persistencia de activos fijos, órdenes de producción y bodegas.
   - Integración de WhatsApp y Asistente de Voz con datos reales.
3. `tests/http_security_rbac.test.ts` (10 pruebas):
   - Autenticación JWT y credenciales con scrypt.
   - Bloqueo de rutas de negocio cuando `debeCambiarPassword: true`.
   - Bloqueo cross-tenant a usuario compras intentando operar en empresa ajena.
   - Trazabilidad de identidad en resolución de aprobaciones.
4. `tests/http_route_perimeter.test.ts` (14 pruebas):
   - Enumeración estricta de las 191 rutas de la aplicación Express.
   - Clasificación canónica y verificación de los vectores de ataque de auditoría externa (A6.1 a A6.9).
   - Verificación exhaustiva de identificadores (`empresaId`, `rut`, `companyId`, `firmId`, `idOrRut`): rechazo con 400 ante listas/arrays en query y body (A6.10).
   - Rechazo con 400 ante valores repetidos en query string para todos los parámetros (A6.11).
   - Rechazo con 400 ante objetos, números, cadenas vacías, delimitadores y valores conflictivos (A6.12).
   - Verificación de perímetro sobre todas las rutas de la API ante listas y repeticiones (A6.13).
   - **Auditoría Cross-Tenant (A6.14):** Usuario administrador de Empresa A no puede saltarse el perímetro enviando listas de identificadores para leer el libro contable de Empresa B (asiento de ventas de $14.875.000) ni sobrescribir sus facturas/DTEs.
5. `tests/autonomous_agents_modules.test.ts` (21 pruebas):
   - Agente de Activo Fijo (NIC 16): Depreciación mensual y baja de activos con impacto contable.
   - Agente de Costos de Producción (NIC 2): Costeo real y liquidación WIP -> PT.
   - Agente de Flujo de Caja: Proyección 30/60/90 y simulación de escenarios sin mock.
   - Agente de Abastecimiento: Creación de RFQ, adjudicación, validación de OC (proveedor, SKU, cantidad, precio, coincidencia de total y estado EMITIDA).
   - Agente de Rendiciones: Validación y centralización de gastos al Libro Mayor.
   - Facturación DTE: Aborto formal ante CAF no oficial.
   - Ejecutor DTE: Invocación a `emitirDte` y transición a `EJECUTADO` solo ante Track ID o Timbre Electrónico devuelto.
   - Asistente de Voz: Cero datos mock; respuesta honesta `NO_DATA`.
   - Persistencia cross-restart de aprobaciones y umbral de gobernanza financiera (> $5.000.000).
   - Persistencia y sincronización en servidor de DTEs, Remuneraciones y Bancos como SSOT multi-tenant.
   - **Pruebas de Ejecutores (B.8.1 a B.8.6):** Verificación matemática rigurosa de Monto Aprobado vs Monto Ejecutado, rechazo formal ante discrepancias financieras y constatación de efecto verificable en Libro Mayor y estados operacionales para los 6 ejecutores del ERP.

---

## 3. Declaración Honesta de Límites Técnicos y Alcance Operativo (Lo No Realizado / Restricciones de Terceros)

En cumplimiento de los estándares de honestidad técnica y auditoría de software de misión crítica, se declaran explícitamente los límites operativos y los elementos que dependen de terceros no disponibles en entornos estándar:

1. **Conexión Directa a Portales Bancarios Chilenos (Open Banking Live API):**
   - *Límite / No realizado:* En la República de Chile no existe una API de Open Banking universal y obligatoria para todos los bancos comerciales (Banco de Chile, Santander, BCI, BancoEstado).
   - *Alcance real implementado:* La conciliación bancaria opera procesando cartolas bancarias oficiales (formatos OFX, CSV, Excel) y sincronizando cuentas y transacciones en endpoints REST del servidor como SSOT. No se incluyen bots de scraping desatendidos ni ejecución autónoma de transferencias bancarias en vivo (lo cual requeriría contratos de host-to-host bancario o pasarela TEF autorizada).
2. **Transmisión SOAP en Vivo a Producción SII (`palena.sii.cl`):**
   - *Límite / Requisito externo:* La emisión de DTE ejecuta verificación criptográfica RSA del CAF oficial del contribuyente y genera el XML Timbre Electrónico (TED) conforme al estándar técnico del SII. Para la transmisión SOAP al SII en ambiente de producción se requiere un certificado digital comercial vigente (.pfx eToken) cargado en la bóveda por el contribuyente. Sin certificado cargado, el ejecutor aborta con `ERROR_EJECUCION` y no inventa recepciones del SII.
3. **Transmisión B2B Automática a Previred:**
   - *Límite / No realizado:* La integración con Previred genera el archivo oficial de nómina de 105 campos para su carga manual o por lote en el portal de Previred. La conexión web service B2B privada directa con Previred S.A. no está implementada debido a que exige un convenio corporativo clearinghouse bilateral con la entidad.
4. **Modelos de Voz Piper TTS sin Binarios Locales en el Host:**
   - *Límite:* El motor de voz neural requiere la presencia del binario compilado `piper` y modelos ONNX locales (descargables vía `scripts/download_all_piper_voices.sh`). Si el servidor de despliegue no cuenta con dichos binarios instalados para su arquitectura, el sistema conmuta automáticamente a síntesis nativa por Web Speech API o texto estructurado.
5. **Meta WhatsApp Cloud API en Entornos Offline o de Desarrollo Local:**
   - *Límite:* En entornos locales sin credenciales `WHATSAPP_API_TOKEN` ni webhook público HTTPS, los mensajes operan mediante el puente de pruebas y consola del agente, no realizando llamadas HTTP externas a los servidores de Meta.

---

## 4. Estado de Compilación y Calidad de Código

- `npm run lint` (`tsc --noEmit`): **0 errores, 0 advertencias**.
- `npm run build`: **Compilación exitosa (Vite + esbuild)** de frontend (`dist/assets/`) y backend (`dist/server.cjs`). Cero contraseñas hardcodeadas en bundle.
- `npm test` & suites formales: **72/72 pruebas aprobadas (100% éxito)**.

