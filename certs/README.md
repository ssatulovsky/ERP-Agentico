# Carpeta de Certificados Digitales y CAF (SII Chile / LibreDTE)

Esta carpeta almacena de forma local y segura los archivos criptográficos requeridos por el servicio de facturación electrónica `HttpDteBillingService` para timbrar y emitir DTEs mediante HTTP-DTE (LibreDTE):

---

## 🏢 Arquitectura Multi-Empresa & Estudios Contables

En Chile, un **Estudio Contable** o holding que emite para múltiples empresas opera bajo dos realidades legales ante el SII:
1. **El CAF (XML) es 100% individual por RUT de Empresa:** Cada contribuyente solicita sus propios folios al SII. La empresa A jamás puede emitir con el CAF de la empresa B.
2. **La Firma Digital (.p12/.pfx) puede ser centralizada:** El SII autoriza que el **Certificado Digital de la persona natural del Contador o Socio** (registrado como mandatario/usuario autorizado ante el SII) firme los DTEs de múltiples empresas clientes. Alternativamente, cada cliente puede proveer su propio certificado digital.

### Estructura de Carpetas en el Servidor:

```text
certs/
├── estudio_contable/                    # Certificado centralizado del Contador / Estudio
│   ├── certificado.p12                 # Firma del mandatario autorizado en SII
│   └── password.txt                    # (Opcional si difiere del .env)
│
├── tenants/                            # Bóveda aislada por cada empresa cliente
│   ├── 76543210-9/                     # Carpeta por RUT limpio del Cliente
│   │   ├── vault-config.json           # Modo de firma ('CERTIFICADO_PROPIO' | 'MANDATO_ESTUDIO')
│   │   ├── certificado.p12             # (Opcional) Si el cliente tiene firma propia
│   │   └── caf/                        # CAFs oficiales otorgados por SII al cliente
│   │       ├── F33.xml                 # Factura Electrónica Afecta
│   │       ├── F34.xml                 # Factura No Afecta o Exenta
│   │       ├── F52.xml                 # Guía de Despacho Electrónica
│   │       ├── F56.xml                 # Nota de Débito Electrónica
│   │       └── F61.xml                 # Nota de Crédito Electrónica
│   │
│   ├── 77798901-4/
│   │   └── caf/
│   │       ├── F33.xml
│   │       ├── F52.xml
│   │       └── F61.xml
│   └── ...
│
└── caf/                                # Carpeta global de fallback / mono-empresa
    ├── F33.xml
    └── F34.xml
```

---

## ⚙️ Variables de Entorno (`.env`) y su Rol

Las variables en el `.env` actúan como:
- **Configuración predeterminada (Single-Tenant):** Para empresas individuales que solo emiten para sí mismas.
- **Firma del Estudio Contable (Multi-Tenant):** Como credenciales centrales del mandatario o fallback general del servidor.

```bash
# ------------------------------------------------------------------------------
# 8. FACTURACIÓN ELECTRÓNICA NATIVA HTTP-DTE / LIBREDTE (API REST SLIM EN LOCALHOST:8050)
# ------------------------------------------------------------------------------
HTTP_DTE_URL="http://localhost:8050"
DTE_AMBIENTE=1 # 1: Certificación (Palena/Maullin), 2: Producción

# Certificado Digital del Contador / Mandatario (Estudio Contable) o Fallback
DTE_CERT_PATH="./certs/certificado.p12"
DTE_CERT_PASSWORD="tu_password_certificado"

# Opcional: Ruta explícita al certificado del Estudio Contable
# DTE_MANDATARIO_CERT_PATH="./certs/estudio_contable/certificado.p12"
# DTE_MANDATARIO_CERT_PASSWORD="clave_estudio"

# Directorio de CAFs generales de contingencia
DTE_CAF_DIR="./certs/caf"

HTTP_DTE_TIMEOUT_MS=30000
HTTP_DTE_MAX_RETRIES=3
ALLOW_OFFLINE_DTE_SIMULATION=true
```

---

## 🚀 Resolución Criptográfica Automática del ERP

Al emitir cualquier DTE desde el ERP o mediante el Agente Autónomo de Facturación:
1. El ERP identifica el **RUT de la Empresa Emisora Activa**.
2. **CAF:** Busca automáticamente en `certs/tenants/{RUT}/caf/F{TIPO}.xml`. Si no existe, recurre a `certs/caf/F{TIPO}.xml`.
3. **Firma Digital:** 
   - Si la empresa tiene certificado propio en `certs/tenants/{RUT}/certificado.p12`, lo utiliza con su contraseña local.
   - Si está configurada bajo `MANDATO_ESTUDIO`, utiliza el certificado del Contador del Estudio Contable (`certs/estudio_contable/` o `DTE_CERT_PATH`).

