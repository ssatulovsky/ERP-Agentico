# Tabla de valores por defecto en las herramientas del motor agéntico (tarea 2.4)

Clasificación de cada `args.x || valor` de `src/services/autonomousAgentEngine.ts`.
Regla: **dato contable** (monto, fecha, RUT, período, empresa, tipo de documento) → prohibido el default; la herramienta devuelve `MISSING_PARAMS` con la lista `faltantes`. **Parámetro técnico** → permitido y documentado aquí.

## Datos contables: default eliminado (devuelven `MISSING_PARAMS`)

| Herramienta | Antes | Ahora |
| :--- | :--- | :--- |
| (todas) empresa | `'Empresa Cliente SpA'`, Av. Providencia 1208 | Empresa del contexto, de la persistencia o de ejemplo (solo `DEMO_MODE`); si no existe, `faltantes: ['empresa']` |
| `tool_hr_calculate_finiquito` | `sueldoBase \|\| 1000000` | obligatorio |
| | `fechaIngreso \|\| '2024-01-01'` | obligatorio, fecha válida |
| | `fechaDespido \|\| hoy` | obligatorio (`fechaDespido` o `fechaTermino`) |
| | `causal` vacía | obligatoria |
| | `diasVacacionesPendientes \|\| 0` | obligatorio (puede ser 0 si se informa) |
| | `diasAvisoPrevioOtorgados \|\| 0` | obligatorio con causal Art. 161 |
| `tool_hr_calculate_payroll` | `sueldoBase \|\| 1200000`, `afpNombre \|\| 'HABITAT'`, `saludTipo \|\| 'FONASA'`, `tipoContrato \|\| 'INDEFINIDO'`, `rut \|\| '15.342.119-4'`, `nombreCompleto \|\| 'Colaborador'` | obligatorios |
| `tool_sii_query_rcv` | `periodo \|\| '2026-08'`, `tipoOperacion \|\| 'COMPRAS'` | obligatorios (período también desde `context.selectedPeriod`) |
| `tool_tax_calculate_f29` | `periodo \|\| '2026-08'`, `tasaPpm \|\| 0.015`, ficha `'Empresa Contribuyente SpA'` | período obligatorio; tasa PPM del argumento o de la ficha de la empresa; empresa real |
| `tool_fixed_assets_depreciate_period`, `tool_fixed_assets_propose_entry` | `periodo \|\| mes actual` | obligatorio |
| `tool_production_propose_closure_entry` | `fechaCierre \|\| hoy` | obligatoria |
| `tool_procurement_create_rfq` | `items \|\| []` | obligatorio (al menos un ítem) |
| `tool_procurement_award_purchase_order` | `montoTotalNeto \|\| 0` | obligatorio, mayor que 0 |
| `tool_billing_draft_dte` | `tipoDte \|\| 33`, `giroReceptor \|\| 'Comercio General'`, `cantidad \|\| 1`, `precioUnitario \|\| 0` | obligatorios |
| `tool_sii_ingest_csv` | `periodo \|\| mes actual`, `tipoOperacion \|\| 'COMPRAS'`; informaba "registros ingresados" sin guardar nada | obligatorios; ahora parsea el CSV y guarda los documentos, o devuelve `NO_DATA` |
| `tool_sii_reconcile_rcv_vs_ledger` | `periodo \|\| mes actual` | obligatorio |
| `tool_submit_governance_approval` | `titulo` sin validar | `titulo` y `descripcion` obligatorios |
| `tool_accounting_propose_entry` | sin líneas → asiento vacío | `lineas` obligatorias |

## Parámetros técnicos: default permitido

| Herramienta | Parámetro | Default | Motivo |
| :--- | :--- | :--- | :--- |
| `tool_hr_calculate_payroll` | `horasExtrasCantidad`, `bonosImponibles` | 0 | Ausencia = sin haberes variables; el usuario los declara si existen |
| `tool_hr_calculate_payroll` | `cargo` | `''` | Texto descriptivo, no afecta el cálculo |
| `tool_hr_calculate_finiquito` | `descuentoAfcEmpleador` | estimado 1,6 % mensual | Se marca `descuentoAfcEsEstimado: true` en la salida |
| `tool_accounting_propose_entry` | `glosaGeneral` | `'Asiento contable propuesto'` | Texto descriptivo |
| `tool_bank_reconcile_movement` | `cuentaBancaria` | `'Sin cuenta seleccionada'` / `'Cuenta Principal'` | Etiqueta de presentación; el calce usa los movimientos reales |
| `tool_cashflow_simulate_scenario` | `variacionVentasPct`, `retrasoCobranzaDias`, `aumentoCostosPct` | 0 | 0 = sin variación en el escenario |
| `tool_procurement_create_rfq` | `titulo` | `'Solicitud de cotización'` | Texto descriptivo |
| `tool_procurement_create_rfq` | `proveedoresRuts` | `[]` | Lista vacía = proveedores registrados |
| `tool_fixed_assets_propose_writeoff` | `precioVentaNeto` | 0 | Baja sin venta |
| `tool_submit_governance_approval` | `nivelRiesgo` | `'MEDIO'` | Clasificación revisable por el aprobador |
| todas | `indicators` | `DEFAULT_INDICATORS` | Indicadores económicos de referencia (UF, UTM) cuando la UI no los envía |

## Pendiente para la re-auditoría (fuera de las 25 herramientas)

- Empresa por defecto `'76.892.410-K'` en `accountingJournalController.ts`, `mysqlClient.ts`, `agentContextBuilderService.ts`, `journalEntryNormalizer.ts` y otros (ver `grep -rn "76.892.410-K" src`).
