-- ============================================================================
-- SCRIPT DE ACTUALIZACIÓN DDL Y MIGRACIÓN MYSQL 8.0 / GOOGLE CLOUD SQL
-- Módulos: Planes ERP SaaS, Alta Cliente Onboarding, Cliente Ancla, 
-- Parámetros Generales de Sistema (Art. 16 Código Tributario), Plan Cuentas IFRS y Auxiliares SII
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------------------------
-- 1. TABLA: erp_subscription_plans (Catálogo de Planes de Contratación)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `erp_subscription_plans` (
  `id` VARCHAR(50) NOT NULL,
  `nombre` VARCHAR(150) NOT NULL,
  `precio_uf_mensual` DECIMAL(10, 2) NOT NULL,
  `empresas_rut_max` INT NOT NULL,
  `usuarios_max` INT NOT NULL,
  `almacenamiento_gb` INT NOT NULL DEFAULT 20,
  `tipo_servicio` VARCHAR(50) NOT NULL DEFAULT 'SaaS Cloud',
  `modulos_incluidos` JSON NOT NULL,
  `activo` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Semillas de Planes de Contratación
INSERT INTO `erp_subscription_plans` (`id`, `nombre`, `precio_uf_mensual`, `empresas_rut_max`, `usuarios_max`, `almacenamiento_gb`, `tipo_servicio`, `modulos_incluidos`, `activo`, `created_at`)
VALUES 
('PLAN_STARTER', 'Plan Inicial Pyme', 2.00, 3, 2, 10, 'SaaS Cloud', '["CORE_ACCOUNTING", "RCV_SII", "F29_IMPUESTOS"]', TRUE, NOW()),
('PLAN_PRO', 'Plan Profesional Estudio', 4.50, 10, 5, 50, 'SaaS Cloud', '["CORE_ACCOUNTING", "RCV_SII", "F29_IMPUESTOS", "REMUNERACIONES_DT", "CONCILIACION_BANCARIA", "INVENTARIO_WMS"]', TRUE, NOW()),
('PLAN_CORP', 'Plan Corporativo Multi-Empresa', 8.50, 30, 15, 200, 'SaaS Cloud Dedicado', '["CORE_ACCOUNTING", "RCV_SII", "F29_IMPUESTOS", "REMUNERACIONES_DT", "CONCILIACION_BANCARIA", "INVENTARIO_WMS", "ACTIVO_FIJO_NIC16", "COSTOS_PRODUCCION", "IFRS16_LEASING"]', TRUE, NOW()),
('PLAN_ENTERPRISE', 'Plan Enterprise IFRS Holding', 15.00, 100, 50, 1000, 'SaaS Cloud Alta Disponibilidad', '["CORE_ACCOUNTING", "RCV_SII", "F29_IMPUESTOS", "REMUNERACIONES_DT", "CONCILIACION_BANCARIA", "INVENTARIO_WMS", "ACTIVO_FIJO_NIC16", "COSTOS_PRODUCCION", "IFRS16_LEASING", "MARKETING_AGENTE", "CUSTOMER_SERVICE_AI", "AUDITOR_FORENSE"]', TRUE, NOW())
ON DUPLICATE KEY UPDATE `precio_uf_mensual` = VALUES(`precio_uf_mensual`), `nombre` = VALUES(`nombre`), `modulos_incluidos` = VALUES(`modulos_incluidos`);

-- ----------------------------------------------------------------------------
-- 2. MODIFICACIÓN TABLA: companies (Extensión Cliente Ancla y Planes)
-- ----------------------------------------------------------------------------
ALTER TABLE `companies`
  ADD COLUMN IF NOT EXISTS `plan_contratado_id` VARCHAR(50) NULL DEFAULT 'PLAN_PRO',
  ADD COLUMN IF NOT EXISTS `plan_precio_uf` DECIMAL(10, 2) NULL DEFAULT 4.50,
  ADD COLUMN IF NOT EXISTS `fecha_inicio_contrato` DATE NULL,
  ADD COLUMN IF NOT EXISTS `fecha_termino_contrato` DATE NULL,
  ADD COLUMN IF NOT EXISTS `limite_credito_comercial` DECIMAL(15, 2) NULL DEFAULT 15000000.00,
  ADD COLUMN IF NOT EXISTS `dias_credito` INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS `cuenta_contable_cobro_id` VARCHAR(30) NULL DEFAULT '1.1.03.001',
  ADD COLUMN IF NOT EXISTS `cuenta_contable_pago_id` VARCHAR(30) NULL DEFAULT '2.1.01.001',
  ADD COLUMN IF NOT EXISTS `contacto_cobranza_nombre` VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS `contacto_cobranza_email` VARCHAR(150) NULL,
  ADD COLUMN IF NOT EXISTS `contacto_cobranza_telefono` VARCHAR(50) NULL,
  ADD COLUMN IF NOT EXISTS `direccion_comercial` VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `ciudad_comercial` VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS `region_comercial` VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS `comuna_comercial` VARCHAR(100) NULL;

-- ----------------------------------------------------------------------------
-- 3. TABLA: erp_system_parameters (Parámetros Generales de Cierre Art. 16 CT)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `erp_system_parameters` (
  `id` VARCHAR(36) NOT NULL,
  `firm_id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NULL,
  `ano_ejercicio_activo` INT NOT NULL DEFAULT 2026,
  `mes_cierre_ejercicio` INT NOT NULL DEFAULT 12,
  `dia_cierre_ejercicio` INT NOT NULL DEFAULT 31,
  `tipo_cierre_legal` ENUM('ART_16_CODIGO_TRIBUTARIO', 'RESOLUCION_ESPECIAL_SII') NOT NULL DEFAULT 'ART_16_CODIGO_TRIBUTARIO',
  `resolucion_sii` VARCHAR(100) NULL,
  `moneda_nacional` VARCHAR(10) NOT NULL DEFAULT 'CLP',
  `multimoneda_activo` BOOLEAN NOT NULL DEFAULT FALSE,
  `tolerancia_centavos_asiento` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `cuenta_ajuste_sencillo` VARCHAR(30) NOT NULL DEFAULT '5.2.09.099',
  `cuenta_diferencia_cambio_ganancia` VARCHAR(30) NOT NULL DEFAULT '4.2.01.005',
  `cuenta_diferencia_cambio_perdida` VARCHAR(30) NOT NULL DEFAULT '5.2.01.008',
  `cuenta_correccion_monetaria` VARCHAR(30) NOT NULL DEFAULT '5.2.01.009',
  `cuenta_resultado_ejercicio` VARCHAR(30) NOT NULL DEFAULT '3.3.02.001',
  `fecha_minima_imputacion` DATE NULL,
  `fecha_maxima_imputacion` DATE NULL,
  `bloquear_periodos_cerrados` BOOLEAN NOT NULL DEFAULT TRUE,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_params_firm_empresa` (`firm_id`, `empresa_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Parámetros Generales Semilla por Defecto
INSERT INTO `erp_system_parameters` (
  `id`, `firm_id`, `empresa_id`, `ano_ejercicio_activo`, `mes_cierre_ejercicio`, `dia_cierre_ejercicio`,
  `tipo_cierre_legal`, `resolucion_sii`, `moneda_nacional`, `multimoneda_activo`,
  `tolerancia_centavos_asiento`, `cuenta_ajuste_sencillo`, `cuenta_diferencia_cambio_ganancia`,
  `cuenta_diferencia_cambio_perdida`, `cuenta_correccion_monetaria`, `cuenta_resultado_ejercicio`,
  `fecha_minima_imputacion`, `fecha_maxima_imputacion`, `bloquear_periodos_cerrados`, `updated_at`
)
VALUES (
  'params-global-001', 'firm-001-audicon', NULL, 2026, 12, 31,
  'ART_16_CODIGO_TRIBUTARIO', 'Resolución Exenta SII Ordinaria General', 'CLP', FALSE,
  0.00, '5.2.09.099', '4.2.01.005', '5.2.01.008', '5.2.01.009', '3.3.02.001',
  '2026-01-01', '2026-12-31', TRUE, NOW()
)
ON DUPLICATE KEY UPDATE `ano_ejercicio_activo` = VALUES(`ano_ejercicio_activo`), `updated_at` = NOW();

-- ----------------------------------------------------------------------------
-- 4. TABLA: chart_of_accounts_hierarchy (Agrupaciones IFRS de Cuentas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `chart_of_accounts_hierarchy` (
  `id` VARCHAR(36) NOT NULL,
  `codigo` VARCHAR(30) NOT NULL,
  `descripcion` VARCHAR(255) NOT NULL,
  `tipo_cuenta` ENUM('ACTIVO', 'PASIVO', 'PATRIMONIO', 'RESULTADO') NOT NULL,
  `cod_padre` VARCHAR(30) NULL,
  `orden_fecu` INT DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_hierarchy_codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Semillas de Agrupación IFRS
INSERT INTO `chart_of_accounts_hierarchy` (`id`, `codigo`, `descripcion`, `tipo_cuenta`, `cod_padre`, `orden_fecu`, `created_at`)
VALUES
('hier-01', '1', 'ACTIVO TOTAL', 'ACTIVO', NULL, 10, NOW()),
('hier-02', '1.1', 'ACTIVO CORRIENTE (CIRCULANTE)', 'ACTIVO', '1', 20, NOW()),
('hier-03', '1.1.01', 'Efectivo y Equivalentes de Efectivo', 'ACTIVO', '1.1', 30, NOW()),
('hier-04', '1.1.03', 'Deudores Comerciales y Cuentas por Cobrar', 'ACTIVO', '1.1', 40, NOW()),
('hier-05', '1.1.04', 'Inventarios y Activos Biológicos', 'ACTIVO', '1.1', 50, NOW()),
('hier-06', '1.2', 'ACTIVO NO CORRIENTE (FIJO E INTANGIBLE)', 'ACTIVO', '1', 60, NOW()),
('hier-07', '1.2.01', 'Propiedades, Planta y Equipo (NIC 16)', 'ACTIVO', '1.2', 70, NOW()),
('hier-08', '2', 'PASIVO TOTAL', 'PASIVO', NULL, 80, NOW()),
('hier-09', '2.1', 'PASIVO CORRIENTE', 'PASIVO', '2', 90, NOW()),
('hier-10', '2.1.01', 'Cuentas por Pagar Comerciales y Proveedores', 'PASIVO', '2.1', 100, NOW()),
('hier-11', '2.1.03', 'Impuestos y Retenciones F29 por Pagar', 'PASIVO', '2.1', 110, NOW()),
('hier-12', '3', 'PATRIMONIO NETO', 'PATRIMONIO', NULL, 120, NOW()),
('hier-13', '4', 'INGRESOS OPERACIONALES Y NO OPERACIONALES', 'RESULTADO', NULL, 130, NOW()),
('hier-14', '5', 'COSTOS Y GASTOS DE OPERACIÓN', 'RESULTADO', NULL, 140, NOW())
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`);

-- ----------------------------------------------------------------------------
-- 5. TABLA: chart_of_accounts_master (Plan de Cuentas Imputables Extendido IFRS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `chart_of_accounts_master` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `codigo` VARCHAR(30) NOT NULL,
  `nombre` VARCHAR(200) NOT NULL,
  `clasificacion` ENUM('ACTIVO', 'PASIVO', 'PATRIMONIO', 'RESULTADO_GANANCIA', 'RESULTADO_PERDIDA') NOT NULL,
  `agrupacion_codigo` VARCHAR(30) NOT NULL,
  `codigo_e` VARCHAR(20) NULL,
  `codigo_s` VARCHAR(20) NULL,
  `codigo_flujo_efectivo` VARCHAR(50) NULL,
  `notas` TEXT NULL,
  -- Banderas de Validación Contable
  `es_activo` BOOLEAN NOT NULL DEFAULT TRUE,
  `exige_auxiliar` BOOLEAN NOT NULL DEFAULT FALSE,
  `es_multimoneda` BOOLEAN NOT NULL DEFAULT FALSE,
  `moneda_base` VARCHAR(10) NOT NULL DEFAULT 'CLP',
  `exige_doc_ref` BOOLEAN NOT NULL DEFAULT FALSE,
  `exige_conciliacion` BOOLEAN NOT NULL DEFAULT FALSE,
  `aplica_ifrs` BOOLEAN NOT NULL DEFAULT TRUE,
  `exige_centro_costo` BOOLEAN NOT NULL DEFAULT FALSE,
  `dimension_2` BOOLEAN NOT NULL DEFAULT FALSE,
  `det_habita` BOOLEAN NOT NULL DEFAULT FALSE,
  `proyecto` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_master_account_empresa_codigo` (`empresa_id`, `codigo`),
  KEY `idx_master_account_agrupacion` (`agrupacion_codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Semillas de Cuentas Maestras
INSERT INTO `chart_of_accounts_master` (
  `id`, `empresa_id`, `codigo`, `nombre`, `clasificacion`, `agrupacion_codigo`,
  `codigo_e`, `codigo_s`, `codigo_flujo_efectivo`, `notas`, `es_activo`,
  `exige_auxiliar`, `es_multimoneda`, `moneda_base`, `exige_doc_ref`,
  `exige_conciliacion`, `aplica_ifrs`, `exige_centro_costo`, `dimension_2`,
  `det_habita`, `proyecto`, `created_at`
)
VALUES
('cma-001', 'client-retail-01', '1.1.01.001', 'Caja Central Moneda Nacional', 'ACTIVO', '1.1.01', 'E01', 'S01', 'OPE_CAJA', 'Efectivo en caja chica y recaudación', TRUE, FALSE, FALSE, 'CLP', FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, NOW()),
('cma-002', 'client-retail-01', '1.1.01.002', 'Banco Santander Cuenta Corriente CLP', 'ACTIVO', '1.1.01', 'E02', 'S02', 'OPE_BANCO', 'Cuenta corriente operativa principal', TRUE, FALSE, FALSE, 'CLP', TRUE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, NOW()),
('cma-003', 'client-retail-01', '1.1.03.001', 'Clientes Nacionales por Cobrar', 'ACTIVO', '1.1.03', 'E03', 'S03', 'OPE_COBRO', 'Facturas de venta a crédito pendientes', TRUE, TRUE, FALSE, 'CLP', TRUE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, NOW()),
('cma-004', 'client-retail-01', '2.1.01.001', 'Proveedores Nacionales por Pagar', 'PASIVO', '2.1.01', 'E04', 'S04', 'OPE_PAGO', 'Facturas recibidas de proveedores', TRUE, TRUE, FALSE, 'CLP', TRUE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, NOW()),
('cma-005', 'client-retail-01', '4.1.01.001', 'Ingresos por Ventas Afectas a IVA', 'RESULTADO_GANANCIA', '4', 'E05', 'S05', 'OPE_VENTAS', 'Ingresos del giro comercial habitual', TRUE, FALSE, FALSE, 'CLP', TRUE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, NOW()),
('cma-006', 'client-retail-01', '5.1.01.001', 'Costo de Ventas Existencias', 'RESULTADO_PERDIDA', '5', 'E06', 'S06', 'OPE_COSTO', 'Costo de mercaderías enajenadas', TRUE, FALSE, FALSE, 'CLP', FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, NOW())
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`);

-- ----------------------------------------------------------------------------
-- 6. TABLA: client_auxiliaries_master (Padrón de Auxiliares Clientes/Proveedores SII)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `client_auxiliaries_master` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `rut_completo` VARCHAR(20) NOT NULL,
  `codigo_auxiliar` VARCHAR(50) NOT NULL,
  `razon_social` VARCHAR(255) NOT NULL,
  `nombre_fantasia` VARCHAR(255) NULL,
  `giro_comercial` VARCHAR(255) NOT NULL,
  `inactivo` BOOLEAN NOT NULL DEFAULT FALSE,
  `telefono_principal` VARCHAR(50) NULL,
  `email_contacto` VARCHAR(150) NULL,
  `nombre_contacto` VARCHAR(150) NULL,
  `email_dte` VARCHAR(150) NOT NULL,
  `direccion` VARCHAR(255) NOT NULL,
  `region` VARCHAR(100) NOT NULL,
  `ciudad` VARCHAR(100) NOT NULL,
  `comuna` VARCHAR(100) NOT NULL,
  `tipo_auxiliar` ENUM('CLIENTE', 'PROVEEDOR', 'AMBOS', 'HONORARIOS') NOT NULL DEFAULT 'CLIENTE',
  `limite_credito` DECIMAL(15, 2) DEFAULT 0.00,
  `terminos_pago` VARCHAR(100) DEFAULT '30 días factura',
  `vendedor` VARCHAR(150) NULL,
  `descuento_porcentaje` DECIMAL(5, 2) DEFAULT 0.00,
  `sucursales` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_auxiliar_empresa_rut` (`empresa_id`, `rut_completo`),
  KEY `idx_auxiliar_empresa_tipo` (`empresa_id`, `tipo_auxiliar`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Semillas de Auxiliares Clientes / Proveedores SII
INSERT INTO `client_auxiliaries_master` (
  `id`, `empresa_id`, `rut_completo`, `codigo_auxiliar`, `razon_social`,
  `nombre_fantasia`, `giro_comercial`, `inactivo`, `telefono_principal`,
  `email_contacto`, `nombre_contacto`, `email_dte`, `direccion`,
  `region`, `ciudad`, `comuna`, `tipo_auxiliar`, `limite_credito`,
  `terminos_pago`, `vendedor`, `descuento_porcentaje`, `sucursales`,
  `created_at`, `updated_at`
)
VALUES
(
  'aux-seed-001', 'client-retail-01', '76.888.999-1', 'AUX-CL-001', 'Yale Material Handling Chile SpA',
  'Yale Equipos Industriales', 'Venta y Arriendo de Maquinaria Industrial y Grúas', FALSE, '+56 2 2840 5000',
  'contacto@yalechile.cl', 'Eduardo Baeza Oyarzún', 'dte@yalechile.cl', 'Av. Presidente Eduardo Frei Montalva 9500',
  'Metropolitana de Santiago', 'Santiago', 'Quilicura', 'PROVEEDOR', 50000000.00,
  '30 días contra factura DTE', 'Carolina Morales', 0.00,
  '[{"codigo": "SUC-01", "nombre": "Casa Matriz Quilicura", "direccion": "Av. Frei Montalva 9500", "ciudad": "Santiago"}]',
  NOW(), NOW()
),
(
  'aux-seed-002', 'client-retail-01', '77.210.980-5', 'AUX-CL-002', 'Retail Logistics Chile S.A.',
  'Retail Logistics Chile', 'Servicios de Bodegaje, Transporte y Distribución', FALSE, '+56 2 2990 4000',
  'finanzas@retaillogistics.cl', 'Ignacio Valdés Correa', 'dte@retaillogistics.cl', 'Camino a Melipilla 12400',
  'Metropolitana de Santiago', 'Santiago', 'Maipú', 'CLIENTE', 35000000.00,
  '45 días fecha emisión DTE', 'Felipe Cárdenas', 5.00,
  '[{"codigo": "SUC-01", "nombre": "Centro Logístico Maipú", "direccion": "Camino a Melipilla 12400", "ciudad": "Santiago"}]',
  NOW(), NOW()
),
(
  'aux-seed-003', 'client-retail-01', '76.999.888-2', 'AUX-CL-003', 'Amazon Web Services Cloud Chile SpA',
  'AWS Cloud Chile', 'Servicios de Computación en la Nube e Infraestructura Cloud', FALSE, '+56 2 2500 8000',
  'facturacion@aws.com', 'Claudia Henríquez', 'dte-chile@amazon.com', 'Av. Isidora Goyenechea 3000, Piso 21',
  'Metropolitana de Santiago', 'Santiago', 'Las Condes', 'PROVEEDOR', 10000000.00,
  'Contado / Cargo Automático', 'Enterprise Accounts', 0.00,
  '[{"codigo": "SUC-01", "nombre": "Oficinas Santiago", "direccion": "Isidora Goyenechea 3000", "ciudad": "Santiago"}]',
  NOW(), NOW()
)
ON DUPLICATE KEY UPDATE `razon_social` = VALUES(`razon_social`), `updated_at` = NOW();

-- ----------------------------------------------------------------------------
-- 7. TABLA: client_onboarding_audit (Auditoría de Altas y Contratos ERP)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `client_onboarding_audit` (
  `id` VARCHAR(36) NOT NULL,
  `firm_id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `plan_id` VARCHAR(50) NOT NULL,
  `valor_uf_mensual` DECIMAL(10, 2) NOT NULL,
  `fecha_inicio_contrato` DATE NOT NULL,
  `fecha_termino_contrato` DATE NULL,
  `aprobado_por` VARCHAR(100) NOT NULL DEFAULT 'SISTEMA',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_onboarding_firm_empresa` (`firm_id`, `empresa_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `client_onboarding_audit` (`id`, `firm_id`, `empresa_id`, `plan_id`, `valor_uf_mensual`, `fecha_inicio_contrato`, `fecha_termino_contrato`, `aprobado_por`, `created_at`)
VALUES
('onboard-001', 'firm-001-audicon', 'client-retail-01', 'PLAN_PRO', 4.50, '2026-01-01', '2026-12-31', 'admin@audicon.cl', NOW())
ON DUPLICATE KEY UPDATE `valor_uf_mensual` = VALUES(`valor_uf_mensual`);

-- ----------------------------------------------------------------------------
-- 8. TABLA: cost_centers (Centros de Costo / Unidades de Negocio "Mini-Empresas")
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cost_centers` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `codigo` VARCHAR(50) NOT NULL,
  `nombre` VARCHAR(200) NOT NULL,
  `categoria` VARCHAR(50) NOT NULL,
  `responsable_nombre` VARCHAR(200) NOT NULL,
  `responsable_email` VARCHAR(255) NULL,
  `presupuesto_mensual_clp` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `activo` BOOLEAN NOT NULL DEFAULT TRUE,
  `descripcion` TEXT NULL,
  `ventas_acumuladas_mes` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `costos_directos_mes` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `gastos_operacionales_mes` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `remuneraciones_mes` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `depreciacion_mes` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cost_center_empresa_codigo` (`empresa_id`, `codigo`),
  KEY `idx_cost_center_empresa` (`empresa_id`),
  KEY `idx_cost_center_categoria` (`categoria`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 9. TABLA: cost_center_imputations (Trazabilidad de Imputaciones Analíticas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cost_center_imputations` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `centro_costo_id` VARCHAR(36) NOT NULL,
  `tipo_documento` VARCHAR(50) NOT NULL,
  `folio_referencia` VARCHAR(100) NOT NULL,
  `fecha` DATE NOT NULL,
  `monto_clp` DECIMAL(15, 2) NOT NULL,
  `concepto` VARCHAR(255) NOT NULL,
  `tipo_flujo` ENUM('INGRESO', 'COSTO', 'GASTO') NOT NULL,
  `cuenta_contable` VARCHAR(50) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_cc_imputation_cc` (`centro_costo_id`),
  KEY `idx_cc_imputation_empresa_fecha` (`empresa_id`, `fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 10. TABLA: dte_items (Líneas de Detalle de Facturas e Imputación Analítica)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `dte_items` (
  `id` VARCHAR(36) NOT NULL,
  `dte_id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `codigo` VARCHAR(50) NULL,
  `nombre` VARCHAR(200) NOT NULL,
  `descripcion` TEXT NULL,
  `cantidad` DECIMAL(12, 4) NOT NULL DEFAULT 1.0000,
  `unidad_medida` VARCHAR(20) NULL,
  `precio_unitario` DECIMAL(15, 4) NOT NULL,
  `descuento_pct` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `es_exento` BOOLEAN NOT NULL DEFAULT FALSE,
  `monto_total` DECIMAL(15, 2) NOT NULL,
  `centro_costo_id` VARCHAR(36) NULL,
  `centro_costo_codigo` VARCHAR(50) NULL,
  `centro_costo_nombre` VARCHAR(200) NULL,
  `cuenta_codigo` VARCHAR(50) NULL,
  `cuenta_nombre` VARCHAR(200) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_dte_items_dte` (`dte_id`),
  KEY `idx_dte_items_cc` (`centro_costo_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 11. COLUMNAS DE INTEGRACIÓN HTTP-DTE / LIBREDTE (dtes_rcv)
-- ----------------------------------------------------------------------------
ALTER TABLE `dtes_rcv`
  ADD COLUMN IF NOT EXISTS `track_id` VARCHAR(100) NULL AFTER `items`,
  ADD COLUMN IF NOT EXISTS `ted_xml` TEXT NULL AFTER `track_id`,
  ADD COLUMN IF NOT EXISTS `xml_timbrado` MEDIUMTEXT NULL AFTER `ted_xml`,
  ADD COLUMN IF NOT EXISTS `pdf_url` VARCHAR(500) NULL AFTER `xml_timbrado`,
  ADD COLUMN IF NOT EXISTS `ambiente_sii` INT NOT NULL DEFAULT 1 AFTER `pdf_url`;

-- ----------------------------------------------------------------------------
-- 12. TABLA: company_credentials_vault (Bóveda Segura AES-256-GCM para SII y Certificados)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `company_credentials_vault` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `certificado_digital_encrypted` MEDIUMTEXT NULL,
  `clave_certificado_encrypted` TEXT NULL,
  `clave_sii_encrypted` TEXT NULL,
  `api_bancos_encrypted` JSON NULL,
  `iv` VARCHAR(32) NOT NULL,
  `tag_auth` VARCHAR(32) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vault_empresa` (`empresa_id`),
  KEY `idx_vault_empresa` (`empresa_id`),
  CONSTRAINT `fk_vault_company` FOREIGN KEY (`empresa_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Semillas de Bóveda Criptográfica AES-256-GCM
INSERT INTO `company_credentials_vault` (
  `id`, `empresa_id`, `certificado_digital_encrypted`, `clave_certificado_encrypted`,
  `clave_sii_encrypted`, `api_bancos_encrypted`, `iv`, `tag_auth`, `updated_at`
)
VALUES
(
  'vault-seed-01', 'client-retail-01', NULL,
  '7608c29c4661', 'b14f89d3102a',
  '{"banco": "BANCO_DE_CHILE", "cuenta": "102948", "tipo": "API_B2B"}',
  '4b6013aa89753c461ed238166a8e01c4', '2f18a79c2bc26a48edc2ca72e5ef1976', NOW()
),
(
  'vault-seed-02', 'client-agro-02', NULL,
  '7608c29c4661', 'e29d71c4908f',
  '{"banco": "SANTANDER", "cuenta": "981240", "tipo": "API_HOST_TO_HOST"}',
  '4b6013aa89753c461ed238166a8e01c4', '2f18a79c2bc26a48edc2ca72e5ef1976', NOW()
)
ON DUPLICATE KEY UPDATE `clave_certificado_encrypted` = VALUES(`clave_certificado_encrypted`), `updated_at` = NOW();

-- Semillas de Centros de Costo (Mini-Empresas)
INSERT INTO `cost_centers` (
  `id`, `empresa_id`, `codigo`, `nombre`, `categoria`, `responsable_nombre`, `responsable_email`,
  `presupuesto_mensual_clp`, `activo`, `descripcion`, `ventas_acumuladas_mes`, `costos_directos_mes`,
  `gastos_operacionales_mes`, `remuneraciones_mes`, `depreciacion_mes`, `created_at`
)
VALUES
('cc-01', 'client-retail-01', 'CC-ADM-01', 'Administración Central & Finanzas', 'ADMINISTRACION', 'Carla Morales Troncoso', 'carla.morales@maraustral.cl', 14500000.00, TRUE, 'Gestión corporativa, contraloría interna, legal, compras generales y RRHH central.', 0.00, 0.00, 4850000.00, 7200000.00, 450000.00, NOW()),
('cc-02', 'client-retail-01', 'CC-VTA-STGO', 'Ventas & Distribución Zona Central (Mini-Empresa)', 'VENTAS', 'Gonzalo Silva Valenzuela', 'gonzalo.silva@maraustral.cl', 28000000.00, TRUE, 'Unidad comercial metropolitana y de exportaciones. Opera como centro de utilidad independiente.', 48500000.00, 18200000.00, 3400000.00, 5800000.00, 350000.00, NOW()),
('cc-03', 'client-retail-01', 'CC-PRD-QUELLON', 'Planta Fabril & Maestranza Quellón (Mini-Empresa)', 'PRODUCCION', 'Ing. Rodrigo Cárdenas Soto', 'rodrigo.cardenas@maraustral.cl', 52000000.00, TRUE, 'Fabricación y reparación de redes peceras, loberas y estructuras HDPE de acuicultura.', 64200000.00, 28900000.00, 6200000.00, 14800000.00, 2100000.00, NOW()),
('cc-04', 'client-retail-01', 'CC-LOG-SUR', 'Logística & Transporte Fluvial Décima Región', 'LOGISTICA', 'Patricio Almonacid Vera', 'patricio.almonacid@maraustral.cl', 18500000.00, TRUE, 'Flota de barcazas, camiones rampla, despacho de insumos a centros de cultivo.', 12000000.00, 6400000.00, 2100000.00, 4900000.00, 980000.00, NOW())
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`);

-- ----------------------------------------------------------------------------
-- 13. ACTUALIZACIÓN INTEGRAL DE TESORERÍA, CONCILIACIÓN BANCARIA Y FLUJO DE CAJA
-- ----------------------------------------------------------------------------
-- Extensión Multidivisa en Cuentas Bancarias
ALTER TABLE `bank_accounts`
  ADD COLUMN IF NOT EXISTS `tipo_conexion` VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS `estado_conexion` VARCHAR(50) NOT NULL DEFAULT 'CONECTADO',
  ADD COLUMN IF NOT EXISTS `es_principal` BOOLEAN NOT NULL DEFAULT FALSE;

-- Extensión Multidivisa y Match Inteligente en Transacciones de Cartola
ALTER TABLE `bank_transactions`
  ADD COLUMN IF NOT EXISTS `moneda` VARCHAR(10) NOT NULL DEFAULT 'CLP',
  ADD COLUMN IF NOT EXISTS `tipo_cambio` DECIMAL(12, 4) NOT NULL DEFAULT 1.0000,
  ADD COLUMN IF NOT EXISTS `monto_clp_equivalente` DECIMAL(15, 2) NULL,
  ADD COLUMN IF NOT EXISTS `match_certeza` INT NULL,
  ADD COLUMN IF NOT EXISTS `match_sugerido_id` VARCHAR(36) NULL,
  ADD COLUMN IF NOT EXISTS `match_sugerido_glosa` VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS `origen_importacion` VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS `raw_hash_transaction` VARCHAR(64) NULL;

-- Extensión NIC 21 Diferencial de Cambio en Conciliaciones
ALTER TABLE `bank_reconciliations`
  ADD COLUMN IF NOT EXISTS `moneda` VARCHAR(10) NOT NULL DEFAULT 'CLP',
  ADD COLUMN IF NOT EXISTS `tipo_cambio_cierre` DECIMAL(12, 4) NOT NULL DEFAULT 1.0000,
  ADD COLUMN IF NOT EXISTS `diferencial_cambio_monto` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS `asiento_diferencial_cambio_id` VARCHAR(36) NULL;

-- TABLA: cash_flow_movements (Proyecciones y Partidas Diarias de Tesorería)
CREATE TABLE IF NOT EXISTS `cash_flow_movements` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `fecha_estimada` DATE NOT NULL,
  `fecha_real` DATE NULL,
  `concepto` VARCHAR(255) NOT NULL,
  `contraparte` VARCHAR(255) NOT NULL,
  `rut_contraparte` VARCHAR(20) NULL,
  `monto_neto` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_iva` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_total` DECIMAL(15, 2) NOT NULL,
  `monto_clp` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `moneda` ENUM('CLP', 'UF', 'USD', 'EUR') NOT NULL DEFAULT 'CLP',
  `valor_uf_referencia` DECIMAL(12, 4) NULL,
  `tipo_cambio` DECIMAL(12, 4) NOT NULL DEFAULT 1.0000,
  `estado` ENUM('PENDIENTE', 'FACTURADO', 'COBRADO', 'PAGADO', 'VENCIDO') NOT NULL DEFAULT 'PENDIENTE',
  `tipo` ENUM('INGRESO', 'EGRESO') NOT NULL,
  `categoria` VARCHAR(50) NOT NULL,
  `dte_folio_asociado` INT NULL,
  `origen_modulo` VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
  `probabilidad_cobro_pct` INT NOT NULL DEFAULT 100,
  `cuenta_bancaria_id` VARCHAR(36) NULL,
  `alerta_riesgo` VARCHAR(255) NULL,
  `documento_referencia` VARCHAR(100) NULL,
  `fecha_original` DATE NULL,
  `reprogramado` BOOLEAN NOT NULL DEFAULT FALSE,
  `motivo_reprogramacion` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_cf_empresa_fecha` (`empresa_id`, `fecha_estimada`),
  KEY `idx_cf_tipo_estado` (`empresa_id`, `tipo`, `estado`),
  KEY `idx_cf_cuenta_banco` (`cuenta_bancaria_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLA: cash_flow_excel_styles (Plantillas y Diseños Gráficos Excel Personalizados)
CREATE TABLE IF NOT EXISTS `cash_flow_excel_styles` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `nombre_tema` VARCHAR(100) NOT NULL,
  `config_json` VARCHAR(4000) NOT NULL,
  `es_default` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_excel_styles_empresa` (`empresa_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLA: treasury_expense_provisions (Provisiones de Egresos Contables vs Extracontables e IVA 19%)
CREATE TABLE IF NOT EXISTS `treasury_expense_provisions` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `concepto` VARCHAR(255) NOT NULL,
  `tipo_provision` VARCHAR(50) NOT NULL DEFAULT 'OTRO',
  `naturaleza` VARCHAR(20) NOT NULL DEFAULT 'CONTABLE',
  `afectacion_iva` VARCHAR(30) NOT NULL DEFAULT 'AFECTO_IVA_19',
  `periodicidad` VARCHAR(30) NOT NULL DEFAULT 'NO_PERIODICA_PUNTUAL',
  `fecha_estimada_pago` DATE NOT NULL,
  `monto_neto` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_iva` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_total` DECIMAL(15, 2) NOT NULL,
  `tasa_iva_pct` DECIMAL(5, 2) NOT NULL DEFAULT 19.00,
  `simular_credito_fiscal_f29` BOOLEAN NOT NULL DEFAULT TRUE,
  `proveedor_nombre` VARCHAR(255) NULL,
  `proveedor_rut` VARCHAR(20) NULL,
  `probabilidad_pct` INT NOT NULL DEFAULT 90,
  `cuenta_contable_provision` VARCHAR(30) NOT NULL,
  `cuenta_gasto_asociada` VARCHAR(30) NULL,
  `centro_costo_id` VARCHAR(36) NULL,
  `estado` VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
  `asiento_contable_generado` BOOLEAN NOT NULL DEFAULT FALSE,
  `asiento_contable_id` VARCHAR(50) NULL,
  `observaciones` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_provisions_empresa` (`empresa_id`),
  KEY `idx_provisions_fecha` (`fecha_estimada_pago`),
  KEY `idx_provisions_naturaleza` (`naturaleza`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
-- ============================================================================
-- FIN DEL SCRIPT DE ACTUALIZACIÓN MYSQL ERP
-- ============================================================================
