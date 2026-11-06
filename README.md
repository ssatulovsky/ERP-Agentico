# ERPremIA — Sistema ERP Contable y Tributario con asistentes de IA para Chile


> **Estado (plan de corrección, nov 2026):** los módulos funcionan como *asistentes con herramientas*: responden cuando el usuario los invoca, usan herramientas con datos reales y piden aprobación humana. La autonomía (herramientas por agente, memoria y ejecuciones programadas) corresponde a la Fase 3 del plan y aún no está implementada. Con `DEMO_MODE=true` se cargan empresas y datos de ejemplo con una franja visible "DEMOSTRACIÓN".

**ERPremIA** es una plataforma integral de planificación de recursos empresariales (ERP) diseñada bajo la normativa legal, contable y tributaria de la República de Chile (Servicio de Impuestos Internos - SII, Dirección del Trabajo - DT, Superintendencia de Pensiones). 

El sistema combina un núcleo transaccional ACID en **MySQL 8.0**, sincronización automática con el SII vía DTE y RCV, un motor de remuneraciones adaptado a la reforma previsional **Ley 21.735**, y un equipo de **asistentes de IA con herramientas** con control de gobernanza y aprobación humana (*Human-in-the-Loop*).

---

## 🏛️ Arquitectura del Sistema

```
                            ┌──────────────────────────────────────────────┐
                            │               ERPremIA Web UI                │
                            │   React 19 + TypeScript + Tailwind CSS       │
                            └──────────────────────┬───────────────────────┘
                                                   │ API REST / JSON
                                                   ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   ERPremIA Core Server (Node.js)                                 │
├──────────────────────────┬──────────────────────────────┬────────────────────────────────────────┤
│     Módulos Fiscales     │    Gestión & Operaciones     │     Inteligencia Multi-Agente          │
├──────────────────────────┼──────────────────────────────┼────────────────────────────────────────┤
│ • DTE & Folios CAF       │ • Rendiciones de Gastos      │ • Agente Gerente Contable Sr.          │
│ • Libro Diario / Mayor   │ • Auxiliares & Proyectos     │ • Agente Gerente RRHH & Equipo         │
│ • RCV (Art. 23 DL 825)   │ • Conciliación Bancaria      │ • Gobernanza y Aprobaciones            │
│ • F29 / Balance 8 Col.   │ • Remuneraciones (L21.735)   │ • Síntesis de Voz Híbrida (Gemini/TTS) │
└──────────────────────────┴──────────────┬───────────────┴────────────────────────────────────────┘
                                          │
                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Capa de Datos & Seguridad                                      │
├─────────────────────────────────────────────────┬────────────────────────────────────────────────┤
│ MySQL 8.0 InnoDB (75+ Tablas Relacionales)      │ Criptografía & Certificación                   │
│ • Partida Doble estricta (Centavos, sin delta)  │ • Passwords: Salt 128-bit + SHA-256            │
│ • Folios CAF atómicos (`FOR UPDATE`)            │ • Certificados SII: AES-256-GCM                │
│ • Trazabilidad & Auditoría Transaccional        │ • Sesiones tokenizadas y RBAC                  │
└─────────────────────────────────────────────────┴────────────────────────────────────────────────┘
```

---

## 📋 Módulos Principales y Cumplimiento Normativo

### 1. Contabilidad General & Partida Doble
- **Consistencia Matemática Estricta:** Registro en centavos con validación de equilibrio $\sum \text{Debe} = \sum \text{Haber}$. Cero tolerancia a descuadres.
- **Libros Oficiales:** Libro Diario, Libro Mayor, Balance Tributario de 8 Columnas y Estados Financieros bajo normas IFRS/NIIF y formato SII.
- **Multi-Empresa:** Aislamiento lógico y separación completa de datos por RUT de empresa activa.

### 2. Facturación Electrónica (DTE) y Asignación Atómica de Folios CAF
- **Emisión Certificada:** Facturas Electrónicas (33), Facturas Exentas (34), Boletas Electrónicas (39/41), Notas de Crédito (61), Notas de Débito (56) y Guías de Despacho (52).
- **Control de Folios CAF:** Asignación secuencial atómica gobernada por MySQL `dte_caf_sequences` con bloqueo transaccional `SELECT ... FOR UPDATE` y mirror en disco.
- **Validación Criptográfica:** Parsing de archivos CAF autorizados por el SII, validación estricta de rango autorizado (`RNG`), fecha de vigencia y firma digital RSA con firma XML (Enveloping/Enveloped).

### 3. Registro de Compras y Ventas (RCV) & Art. 23 N° 1 DL 825
- **Sincronización SII:** Consulta automática y robotizada del RCV con persistencia de documentos tributarios recibidos y emitidos.
- **Tratamiento de IVA No Recuperable:** Si la empresa es exenta de IVA o registra compras con IVA de uso común o no deducible, el motor contable imputa automáticamente el impuesto a la cuenta de pérdida o costo correspondiente (`5.2.11 - Costo / Gasto IVA No Recuperable Art. 23`), reflejando la realidad tributaria en los libros contables.

### 4. Motor de Remuneraciones & Cumplimiento Ley 21.735 (2026)
- **Topes Imponibles Actualizados:**
  - AFP / Salud: **90.0 UF**
  - Seguro de Cesantía (AFC): **135.2 UF**
- **Aporte Patronal Ley 21.735:** Centralización contable del **1.0%** de cargo del empleador (`5.2.06 Aporte Patronal` al Debe vs. `2.1.12 Ley 21.735 por Pagar` al Haber).
- **Histórico de Liquidaciones & Reliquidaciones:** Módulo dedicado para archivo histórico de liquidaciones por período y trabajador, con reliquidación retroactiva bajo **Art. 46 LIR** indexada por UTM histórica.
- **Libro de Remuneraciones Electrónico (LRE):** Estructura compatible con el formato estándar exigido por la Dirección del Trabajo (DT).

### 5. Rendiciones de Gastos & Trazabilidad de Proyectos
- **Auxiliares Dedicados:** Selección y filtrado inteligente priorizando cuentas tipo `RENDICION` y `EMPLEADO`.
- **Integración con Facturas y RCV:** Las facturas rendidas se asientan directamente contra proveedores (`2.1.01`) y actualizan el RCV.
- **Balance Contable en Reintegros:** Algoritmo de contabilización que equilibra gastos, anticipos y reintegros a caja/banco sin descuadres en el comprobante diario.
- **Proyectos de Faena:** Asignación de centros de costo y proyectos verificados en MySQL (`PRY-QUELLON-26`, `PRY-STGO-EXP`, etc.).
- **Edición y Corrección:** Interfaz y endpoint `PUT /api/expenses/reports/:id` para subsanar errores en rendiciones antes o después de la rendición.

### 6. Motor de asistentes con herramientas (ReAct Loop, Function Calling & Human-in-the-Loop)
- **Arquitectura Híbrida Verificable:**
  - *Núcleo Determinístico:* Todos los cálculos contables, tributarios (F29, IVA Art. 23 DL 825) y laborales (Art. 161/163 CT, Topes UF, Ley 21.735, Previred 105 campos) son ejecutados por funciones matemáticas y normativas determinísticas sin riesgo de alucinación ni redondeos ficticios.
  - *Capa Agéntica con Function Calling:* Motor multi-turno ReAct (`src/services/autonomousAgentEngine.ts`) donde los agentes razonan, planifican, invocan herramientas reales del servidor (`tool_hr_calculate_finiquito`, `tool_sii_query_rcv`, `tool_accounting_propose_entry`, etc.) e inspeccionan las salidas antes de emitir un dictamen.
- **Matriz de Aprobaciones (*Human-in-the-Loop*):** Ningún agente ejecuta operaciones de mutación de alto impacto financiero o legal (centralizaciones en el Libro Mayor, desembolso de finiquitos, emisión masiva de DTE) sin registrar una solicitud en `moduleAgentApprovals` y recibir la autorización de un supervisor humano.
- **Transparencia Auditada:** Se eliminaron simulaciones con retardos artificiales o respuestas prefabricadas de balance; cada consulta refleja el estado matemático real del libro diario y las tablas MySQL/disco.
- **Síntesis de Voz Híbrida:** Voz natural mediante Gemini Speech API como motor primario y Piper TTS local (redes neuronales Onnx) como contingencia offline.

---

## 🔒 Seguridad y Criptografía Auditada

1. **Autenticación Bearer & RBAC Estricto:** Todas las rutas `/api/*` (excepto endpoints públicos auditados `/api/health`, `/api/indicators`, `/api/auth/login`) requieren token Bearer válido, administrado por el middleware central `authenticateApiToken`.
2. **Derivación Robusta de Contraseñas (scrypt):** Las contraseñas se almacenan mediante derivación de claves criptográficas **scrypt** (`scrypt:<salt>:<hash>`), resistente a ataques de fuerza bruta y GPU, con migración transparente para hashes heredados.
3. **Higienización de Contexto de IA:** Sanitizador recursivo (`aiSecuritySanitizer.ts`) que elimina de raíz claves del SII, contraseñas, tokens y llaves privadas antes de enviar cualquier contexto a los modelos de lenguaje.
4. **Enmascaramiento de Claves de Administración:** El endpoint `GET /api/admin/ai-config` devuelve claves enmascaradas (`AIzaSy...****`) para prevenir filtraciones en interfaces de usuario o logs.
5. **Custodia de Certificados Digitales:** Los certificados tributarios de firma electrónica (`.pfx` / `.p12`) se resguardan cifrados con **AES-256-GCM** mediante llave maestra derivada de entorno.

---

## 🚀 Puesta en Marcha

### Requisitos Previos
- **Node.js:** Versión 20.x o 22.x LTS.
- **MySQL:** Versión 8.0+ con soporte InnoDB y transacciones ACID.
- **npm** o **pnpm**.

### 1. Instalación de Dependencias
```bash
npm install
```

### 2. Configuración de Entorno
Cree o configure el archivo `.env.local`:
```env
# Base de Datos MySQL
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=erpremia_user
MYSQL_PASSWORD=tu_password_seguro
MYSQL_DATABASE=erpremia_db

# Seguridad & Criptografía
JWT_SECRET=super_secret_jwt_key_2026
CERTIFICATE_ENCRYPTION_KEY=clave_maestra_aes256_32bytes_hex

# Integraciones de IA y Voz
GEMINI_API_KEY=AIzaSy...
```

### 3. Inicialización y Migración de Base de Datos
Ejecute el script de inicialización DDL para crear las 75+ tablas y secuencias:
```bash
npm run db:init:mysql
```

### 4. Ejecución en Modo Desarrollo
```bash
npm run dev
```
El servidor y la interfaz web estarán disponibles en `http://localhost:3000`.

### 5. Compilación y Despliegue para Producción
```bash
npm run build
npm run start
```

---

---

## 📊 Veredicto de Auditoría Técnica & Mejoras Versión 3

| Dimensión Auditada | Estado | Racional Técnico y Resolución Auditada (V3) |
|:---|:---:|:---|
| **Estructura de Paquete & Repositorio** | ✅ Conforme | Repositorio unificado, `package.json` bautizado como `erpremia` v2.0.0, documentación corporativa completa. |
| **Contrato Frontend-Backend Agéntico** | ✅ Conforme | Parámetros unificados en `/api/agents/autonomous/execute` (`module`/`modulo`, `query`/`prompt`, `context`/`contextData`). La UI procesa trazas reales ReAct (`steps`), herramientas ejecutadas y dictámenes. |
| **Grounding de Herramientas (Cero Datos Ficticios)** | ✅ Conforme | Eliminación total de respuestas inventadas en F29, Kardex, Conciliación Bancaria y RCV. Si no hay datos, se reporta con honestidad contable (`NO_DATA` o sin movimiento). |
| **Cálculo Legal de Finiquitos (Art. 163 CT & AFC)** | ✅ Conforme | Antigüedad computable calculada estrictamente según Código del Trabajo (mínimo 1 año cumplido, fracción > 6 meses suma 1 año, tope 11 años). Imputación de aporte AFC empleador según Art. 13 Ley 19.728 (1.6% base imponible mensual acumulada). |
| **Seguridad de Acceso & Cero Puertas Traseras** | ✅ Conforme | Erradicación total del token de respaldo estático. Las sesiones de desarrollo requieren explícitamente `ERP_DEV_AUTH_TOKEN` fuera de producción. Persistencia de sesiones en disco para tolerancia a fallos en PM2. |
| **Interceptor Global de Autenticación** | ✅ Conforme | Interceptor central (`apiClient.ts`) instalado en bootstrap (`main.tsx`) que inyecta automáticamente cabecera Bearer a las 64+ llamadas a la API sin fugas por Query Params (`?token=`). |
| **Higienización de Contexto de IA** | ✅ Conforme | Detección profunda de credenciales (`claveSiiRepresentante`, `claveTgr`, certificados, contraseñas, llaves privadas RSA) eliminando cualquier secreto antes del envío a LLMs. |
| **Bóveda Criptográfica y Folios CAF** | ✅ Conforme | Validación de archivos CAF reales en la bóveda criptográfica del contribuyente. Eliminación completa de plantillas CAF con claves RSA simuladas. |
| **Síntesis de Voz Neuronal & Contingencia** | ✅ Conforme | Endpoint `/api/voice/tts` protegido con Bearer. Modelos Gemini (`gemini-2.5-flash`, `gemini-2.5-pro`) con modalidad de audio. Piper TTS local con saneamiento automático de enums para Python 3.13. |
| **Integridad Contable (Libro Diario)** | ✅ Conforme | Partida doble en centavos, sin tolerancia a descuadres, control transaccional ACID. |
| **Normativa Previsional (Ley 21.735)** | ✅ Conforme | Topes 2026 (90.0 UF / 135.2 UF), cálculo y centralización del 1% patronal, reliquidaciones Art. 46 LIR con UTM histórica. |
| **Tratamiento Tributario RCV** | ✅ Conforme | Detección de empresas exentas e imputación obligatoria a IVA No Recuperable (Art. 23 DL 825). |
| **Rendiciones de Gastos** | ✅ Conforme | Flujos de edición, priorización de cuentas auxiliares `RENDICION`/`EMPLEADO`, balance automático de reintegros y enlace con proveedores. |
| **Gobernanza Agéntica** | ✅ Conforme | Protocolo *Human-in-the-Loop* con matriz de aprobaciones jerárquicas en cada módulo. |

---

## 📄 Licencia y Derechos
© 2026 ERPremIA. Todos los derechos reservados. Desarrollado para operaciones empresariales en Chile.
