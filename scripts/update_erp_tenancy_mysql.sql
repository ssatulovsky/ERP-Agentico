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
ALTER TABLE `companies` ADD COLUMN `plan_contratado_id` VARCHAR(50) NULL DEFAULT 'PLAN_PRO';
ALTER TABLE `companies` ADD COLUMN `plan_precio_uf` DECIMAL(10, 2) NULL DEFAULT 4.50;
ALTER TABLE `companies` ADD COLUMN `fecha_inicio_contrato` DATE NULL;
ALTER TABLE `companies` ADD COLUMN `fecha_termino_contrato` DATE NULL;
ALTER TABLE `companies` ADD COLUMN `limite_credito_comercial` DECIMAL(15, 2) NULL DEFAULT 15000000.00;
ALTER TABLE `companies` ADD COLUMN `dias_credito` INT NOT NULL DEFAULT 30;
ALTER TABLE `companies` ADD COLUMN `cuenta_contable_cobro_id` VARCHAR(30) NULL DEFAULT '1.1.03.001';
ALTER TABLE `companies` ADD COLUMN `cuenta_contable_pago_id` VARCHAR(30) NULL DEFAULT '2.1.01.001';
ALTER TABLE `companies` ADD COLUMN `contacto_cobranza_nombre` VARCHAR(150) NULL;
ALTER TABLE `companies` ADD COLUMN `contacto_cobranza_email` VARCHAR(150) NULL;
ALTER TABLE `companies` ADD COLUMN `contacto_cobranza_telefono` VARCHAR(50) NULL;
ALTER TABLE `companies` ADD COLUMN `direccion_comercial` VARCHAR(255) NULL;
ALTER TABLE `companies` ADD COLUMN `ciudad_comercial` VARCHAR(100) NULL;
ALTER TABLE `companies` ADD COLUMN `region_comercial` VARCHAR(100) NULL;
ALTER TABLE `companies` ADD COLUMN `comuna_comercial` VARCHAR(100) NULL;

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
  `es_efectivo_equivalente` BOOLEAN NOT NULL DEFAULT FALSE,
  `es_contracuenta_efectivo` BOOLEAN NOT NULL DEFAULT FALSE,
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
  `exige_conciliacion`, `es_efectivo_equivalente`, `es_contracuenta_efectivo`,
  `aplica_ifrs`, `exige_centro_costo`, `dimension_2`, `det_habita`, `proyecto`, `created_at`
)
VALUES
('cma-001', 'client-retail-01', '1.1.01.001', 'Caja Central Moneda Nacional', 'ACTIVO', '1.1.01', 'E01', 'S01', 'OPE_CAJA', 'Efectivo en caja chica y recaudación', TRUE, FALSE, FALSE, 'CLP', FALSE, TRUE, TRUE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, NOW()),
('cma-002', 'client-retail-01', '1.1.01.002', 'Banco Santander Cuenta Corriente CLP', 'ACTIVO', '1.1.01', 'E02', 'S02', 'OPE_BANCO', 'Cuenta corriente operativa principal', TRUE, FALSE, FALSE, 'CLP', TRUE, TRUE, TRUE, FALSE, TRUE, FALSE, FALSE, FALSE, FALSE, NOW()),
('cma-003', 'client-retail-01', '1.1.03.001', 'Clientes Nacionales por Cobrar', 'ACTIVO', '1.1.03', 'E03', 'S03', 'OPE_COBRO', 'Facturas de venta a crédito pendientes', TRUE, TRUE, FALSE, 'CLP', TRUE, FALSE, FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, NOW()),
('cma-004', 'client-retail-01', '2.1.01.001', 'Proveedores Nacionales por Pagar', 'PASIVO', '2.1.01', 'E04', 'S04', 'OPE_PAGO', 'Facturas recibidas de proveedores', TRUE, TRUE, FALSE, 'CLP', TRUE, FALSE, FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, NOW()),
('cma-005', 'client-retail-01', '4.1.01.001', 'Ingresos por Ventas Afectas a IVA', 'RESULTADO_GANANCIA', '4', 'E05', 'S05', 'OPE_VENTAS', 'Ingresos del giro comercial habitual', TRUE, FALSE, FALSE, 'CLP', TRUE, FALSE, FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, FALSE, NOW()),
('cma-006', 'client-retail-01', '5.1.01.001', 'Costo de Ventas Existencias', 'RESULTADO_PERDIDA', '5', 'E06', 'S06', 'OPE_COSTO', 'Costo de mercaderías enajenadas', TRUE, FALSE, FALSE, 'CLP', FALSE, FALSE, FALSE, FALSE, TRUE, TRUE, FALSE, FALSE, TRUE, NOW())
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
  `categoria` VARCHAR(100) NOT NULL DEFAULT 'ADMINISTRACION',
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

-- Asegurar que la columna categoria sea VARCHAR(100) por si la tabla ya existía con el ENUM anterior
ALTER TABLE `cost_centers` MODIFY COLUMN `categoria` VARCHAR(100) NOT NULL DEFAULT 'ADMINISTRACION';

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
ALTER TABLE `dtes_rcv` ADD COLUMN `track_id` VARCHAR(100) NULL AFTER `items`;
ALTER TABLE `dtes_rcv` ADD COLUMN `ted_xml` TEXT NULL AFTER `track_id`;
ALTER TABLE `dtes_rcv` ADD COLUMN `xml_timbrado` MEDIUMTEXT NULL AFTER `ted_xml`;
ALTER TABLE `dtes_rcv` ADD COLUMN `pdf_url` VARCHAR(500) NULL AFTER `xml_timbrado`;
ALTER TABLE `dtes_rcv` ADD COLUMN `ambiente_sii` INT NOT NULL DEFAULT 1 AFTER `pdf_url`;

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
ALTER TABLE `cost_centers` MODIFY COLUMN `categoria` VARCHAR(100) NOT NULL DEFAULT 'ADMINISTRACION';
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
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `categoria` = VALUES(`categoria`);

-- ----------------------------------------------------------------------------
-- 13. ACTUALIZACIÓN INTEGRAL DE TESORERÍA, CONCILIACIÓN BANCARIA Y FLUJO DE CAJA
-- ----------------------------------------------------------------------------
-- Extensión Multidivisa en Cuentas Bancarias
ALTER TABLE `bank_accounts` ADD COLUMN `tipo_conexion` VARCHAR(50) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE `bank_accounts` ADD COLUMN `estado_conexion` VARCHAR(50) NOT NULL DEFAULT 'CONECTADO';
ALTER TABLE `bank_accounts` ADD COLUMN `es_principal` BOOLEAN NOT NULL DEFAULT FALSE;

-- Extensión Multidivisa y Match Inteligente en Transacciones de Cartola
ALTER TABLE `bank_transactions` ADD COLUMN `moneda` VARCHAR(10) NOT NULL DEFAULT 'CLP';
ALTER TABLE `bank_transactions` ADD COLUMN `tipo_cambio` DECIMAL(12, 4) NOT NULL DEFAULT 1.0000;
ALTER TABLE `bank_transactions` ADD COLUMN `monto_clp_equivalente` DECIMAL(15, 2) NULL;
ALTER TABLE `bank_transactions` ADD COLUMN `match_certeza` INT NULL;
ALTER TABLE `bank_transactions` ADD COLUMN `match_sugerido_id` VARCHAR(36) NULL;
ALTER TABLE `bank_transactions` ADD COLUMN `match_sugerido_glosa` VARCHAR(255) NULL;
ALTER TABLE `bank_transactions` ADD COLUMN `origen_importacion` VARCHAR(50) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE `bank_transactions` ADD COLUMN `raw_hash_transaction` VARCHAR(64) NULL;

-- Extensión NIC 21 Diferencial de Cambio en Conciliaciones
ALTER TABLE `bank_reconciliations` ADD COLUMN `moneda` VARCHAR(10) NOT NULL DEFAULT 'CLP';
ALTER TABLE `bank_reconciliations` ADD COLUMN `tipo_cambio_cierre` DECIMAL(12, 4) NOT NULL DEFAULT 1.0000;
ALTER TABLE `bank_reconciliations` ADD COLUMN `diferencial_cambio_monto` DECIMAL(15, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE `bank_reconciliations` ADD COLUMN `asiento_diferencial_cambio_id` VARCHAR(36) NULL;

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

-- ============================================================================
-- TABLAS DEL AGENTE RRHH & GESTIÓN DE PERSONAS (LICENCIAS, VACACIONES Y AUSENTISMO)
-- ============================================================================

-- TABLA: medical_leaves (Licencias Médicas Electrónicas LME - COMPIN / ISAPRE)
CREATE TABLE IF NOT EXISTS `medical_leaves` (
  `id` VARCHAR(36) NOT NULL,
  `folio_licencia` VARCHAR(50) NOT NULL,
  `employee_id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(20) NOT NULL,
  `rut` VARCHAR(20) NOT NULL,
  `nombre_completo` VARCHAR(255) NOT NULL,
  `tipo_licencia` VARCHAR(50) NOT NULL,
  `entidad_tramitadora` VARCHAR(50) NOT NULL,
  `fecha_inicio` DATE NOT NULL,
  `fecha_termino` DATE NOT NULL,
  `dias_reposo` INT NOT NULL,
  `dias_descuento_remuneracion` INT NOT NULL DEFAULT 0,
  `dias_subsidio_sil` INT NOT NULL DEFAULT 0,
  `descuento_nomina_estimado` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `medico_nombre` VARCHAR(200) NOT NULL,
  `medico_rut` VARCHAR(20) NOT NULL,
  `diagnostico_cie10` VARCHAR(50) NULL,
  `estado` VARCHAR(30) NOT NULL DEFAULT 'RECIBIDA',
  `fecha_tramitacion_empleador` DATE NULL,
  `observaciones` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_leave_empresa` (`empresa_id`),
  KEY `idx_leave_employee` (`employee_id`),
  KEY `idx_leave_fecha` (`fecha_inicio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLA: vacation_records (Control de Feriado Legal Art. 67-70 Código del Trabajo)
CREATE TABLE IF NOT EXISTS `vacation_records` (
  `id` VARCHAR(36) NOT NULL,
  `employee_id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(20) NOT NULL,
  `fecha_solicitud` DATE NOT NULL,
  `fecha_inicio` DATE NOT NULL,
  `fecha_retorno` DATE NOT NULL,
  `dias_habiles_tomados` DECIMAL(5, 2) NOT NULL,
  `dias_progresivos_tomados` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `estado` VARCHAR(30) NOT NULL DEFAULT 'SOLICITADA',
  `comprobante_firmado` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_vacation_empresa` (`empresa_id`),
  KEY `idx_vacation_employee` (`employee_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLA: absenteeism_records (Control de Ausencias e Inasistencias Art. 160 N° 3)
CREATE TABLE IF NOT EXISTS `absenteeism_records` (
  `id` VARCHAR(36) NOT NULL,
  `employee_id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(20) NOT NULL,
  `rut` VARCHAR(20) NOT NULL,
  `nombre_completo` VARCHAR(255) NOT NULL,
  `fecha` DATE NOT NULL,
  `tipo` VARCHAR(50) NOT NULL,
  `duracion_texto` VARCHAR(150) NOT NULL,
  `minutos_atraso` INT DEFAULT 0,
  `dias_inasistencia` INT DEFAULT 0,
  `justificativo_presentado` TEXT NULL,
  `impacto_descuento_pesos` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `alerta_causal_art160_n3` BOOLEAN NOT NULL DEFAULT FALSE,
  `estado` VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_REVISION',
  `observaciones` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_absenteeism_empresa` (`empresa_id`),
  KEY `idx_absenteeism_employee` (`employee_id`),
  KEY `idx_absenteeism_fecha` (`fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLAS DEL AGENTE COMERCIAL & COTIZACIONES (PRESUPUESTOS Y VARIACIONES)
-- ============================================================================

-- TABLA: production_budgets (Presupuestos de Producción y Cotizaciones Clientes)
CREATE TABLE IF NOT EXISTS `production_budgets` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `folio` VARCHAR(50) NOT NULL,
  `cliente_nombre` VARCHAR(255) NOT NULL,
  `cliente_rut` VARCHAR(20) NOT NULL,
  `fecha_emision` DATE NOT NULL,
  `fecha_validez` DATE NOT NULL,
  `estado` VARCHAR(30) NOT NULL DEFAULT 'BORRADOR',
  `fecha_envio` DATE NULL,
  `fecha_aprobacion` DATE NULL,
  `producto_nombre` VARCHAR(255) NOT NULL,
  `producto_codigo` VARCHAR(50) NOT NULL,
  `categoria` VARCHAR(50) NOT NULL,
  `unidad_medida` VARCHAR(20) NOT NULL DEFAULT 'UNID',
  `cantidad` DECIMAL(12, 2) NOT NULL DEFAULT 1.00,
  `costo_total_interno` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `precio_venta_neto_cliente` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `margen_bruto_estimado_clp` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `margen_bruto_estimado_pct` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
  `markup_pct` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
  `orden_produccion_id_generada` VARCHAR(36) NULL,
  `folio_op_generada` VARCHAR(50) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_budget_empresa` (`empresa_id`),
  KEY `idx_budget_estado` (`estado`),
  KEY `idx_budget_folio` (`folio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLA: production_budget_items (Desglose de Costos de Cotización: MPD, MOD, CIF)
CREATE TABLE IF NOT EXISTS `production_budget_items` (
  `id` VARCHAR(36) NOT NULL,
  `presupuesto_id` VARCHAR(36) NOT NULL,
  `tipo` ENUM('MPD', 'MOD', 'CIF', 'OTRO') NOT NULL,
  `insumo_id` VARCHAR(36) NULL,
  `insumo_codigo` VARCHAR(50) NULL,
  `descripcion` VARCHAR(255) NOT NULL,
  `unidad_medida` VARCHAR(20) NOT NULL,
  `cantidad_presupuestada` DECIMAL(12, 2) NOT NULL,
  `costo_unitario_estimado` DECIMAL(15, 2) NOT NULL,
  `costo_total_estimado` DECIMAL(15, 2) NOT NULL,
  `precio_unitario_sugerido` DECIMAL(15, 2) NULL,
  `precio_total_venta` DECIMAL(15, 2) NULL,
  `visible_para_cliente` BOOLEAN NOT NULL DEFAULT TRUE,
  `notas_internas` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_item_presupuesto` (`presupuesto_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLA: warehouse_withdrawals (Vales de Entrega de Bodega para OP)
CREATE TABLE IF NOT EXISTS `warehouse_withdrawals` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `folio_vale` VARCHAR(50) NOT NULL,
  `fecha` DATE NOT NULL,
  `fecha_retiro` DATE NULL,
  `hora_retiro` VARCHAR(10) NULL,
  `orden_produccion_id` VARCHAR(36) NOT NULL,
  `orden_produccion_folio` VARCHAR(50) NOT NULL,
  `cliente_nombre` VARCHAR(255) NULL,
  `bodega_origen_id` VARCHAR(36) NOT NULL,
  `bodega_origen_nombre` VARCHAR(150) NOT NULL,
  `solicitante_nombre` VARCHAR(200) NOT NULL,
  `responsable_bodega` VARCHAR(200) NOT NULL,
  `costo_total_vale` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `alerta_sobreconsumo` BOOLEAN NOT NULL DEFAULT FALSE,
  `folio_guia_despacho_52` BIGINT NULL,
  `observaciones` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_vale_empresa` (`empresa_id`),
  KEY `idx_vale_op` (`orden_produccion_id`),
  KEY `idx_vale_folio` (`folio_vale`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- TABLA: cash_flow_indirect_reports (Reportes de Flujo de Efectivo Método Indirecto NIC 7)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `cash_flow_indirect_reports` (
  `id` VARCHAR(36) NOT NULL,
  `firm_id` VARCHAR(36) NOT NULL DEFAULT 'firm-default-001',
  `empresa_id` VARCHAR(36) NOT NULL,
  `periodo` VARCHAR(7) NOT NULL,
  `periodo_comparativo` VARCHAR(7) NULL,
  `fecha_emision` DATE NOT NULL,
  `resultado_neto` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `total_ajustes_no_efectivo` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `total_variacion_capital_trabajo` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `flujo_neto_operacional` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `flujo_neto_inversion` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `flujo_neto_financiamiento` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `variacion_neta_efectivo` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `saldo_inicial_efectivo` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `saldo_final_efectivo` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `efecto_tipo_cambio` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `diferencia_cuadratura` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `esta_cuadrado` BOOLEAN NOT NULL DEFAULT TRUE,
  `partidas_operacion` JSON NOT NULL,
  `partidas_inversion` JSON NOT NULL,
  `partidas_financiamiento` JSON NOT NULL,
  `desglose_efectivo` JSON NOT NULL,
  `diagnostico_agente` JSON NOT NULL,
  `agente_auditor_nombre` VARCHAR(100) NOT NULL DEFAULT 'Agente Especialista Flujo de Efectivo NIF/NIC 7',
  `agente_signature` VARCHAR(128) NOT NULL,
  `hash_integridad_sha256` VARCHAR(64) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_cash_flow_empresa_periodo` (`empresa_id`, `periodo`),
  KEY `idx_cash_flow_periodo` (`empresa_id`, `periodo`),
  KEY `idx_cash_flow_firm` (`firm_id`, `empresa_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 15. AGENTE DE ADMINISTRACIÓN DE RENDICIÓN DE GASTOS ("RINDE GASTOS AI")
-- ----------------------------------------------------------------------------

-- TABLA: expense_projects (Proyectos y Obras para Imputación de Gastos)
CREATE TABLE IF NOT EXISTS `expense_projects` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `codigo` VARCHAR(50) NOT NULL,
  `nombre` VARCHAR(200) NOT NULL,
  `cliente_nombre` VARCHAR(200) NULL,
  `presupuesto_total_clp` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `activo` BOOLEAN NOT NULL DEFAULT TRUE,
  `descripcion` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_expense_project_empresa_codigo` (`empresa_id`, `codigo`),
  KEY `idx_expense_project_empresa` (`empresa_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLA: expense_reports (Informes y Cabeceras de Rendición)
CREATE TABLE IF NOT EXISTS `expense_reports` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `folio` VARCHAR(50) NOT NULL,
  `titulo` VARCHAR(255) NOT NULL,
  `rendidor_id` VARCHAR(36) NULL,
  `rendidor_nombre` VARCHAR(200) NOT NULL,
  `rendidor_rut` VARCHAR(20) NOT NULL,
  `rendidor_email` VARCHAR(255) NULL,
  `rendidor_cargo` VARCHAR(150) NULL,
  `centro_costo_id` VARCHAR(36) NULL,
  `centro_costo_codigo` VARCHAR(50) NULL,
  `centro_costo_nombre` VARCHAR(200) NULL,
  `proyecto_id` VARCHAR(36) NULL,
  `proyecto_codigo` VARCHAR(50) NULL,
  `proyecto_nombre` VARCHAR(200) NULL,
  `fondo_asignado_clp` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_total_rendido_clp` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `saldo_reembolsar_clp` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `saldo_reintegrar_clp` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `moneda` VARCHAR(10) NOT NULL DEFAULT 'CLP',
  `estado` VARCHAR(40) NOT NULL DEFAULT 'BORRADOR',
  `fecha_inicio` DATE NOT NULL,
  `fecha_cierre` DATE NOT NULL,
  `fecha_aprobacion` DATE NULL,
  `fecha_pago_reembolso` DATE NULL,
  `aprobador_nombre` VARCHAR(200) NULL,
  `aprobador_email` VARCHAR(255) NULL,
  `observaciones_aprobador` TEXT NULL,
  `asiento_contable_id` VARCHAR(36) NULL,
  `agente_auditor_score` INT NOT NULL DEFAULT 100,
  `agente_auditor_diagnostico` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_expense_report_empresa_folio` (`empresa_id`, `folio`),
  KEY `idx_expense_report_empresa_estado` (`empresa_id`, `estado`),
  KEY `idx_expense_report_rendidor` (`empresa_id`, `rendidor_rut`),
  KEY `idx_expense_report_cc` (`centro_costo_id`),
  KEY `idx_expense_report_proyecto` (`proyecto_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TABLA: expense_items (Comprobantes y Documentos Digitales)
CREATE TABLE IF NOT EXISTS `expense_items` (
  `id` VARCHAR(36) NOT NULL,
  `expense_report_id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `fecha` DATE NOT NULL,
  `tipo_documento` VARCHAR(50) NOT NULL,
  `folio_documento` VARCHAR(100) NOT NULL,
  `proveedor_rut` VARCHAR(20) NOT NULL,
  `proveedor_razon_social` VARCHAR(255) NOT NULL,
  `categoria` VARCHAR(50) NOT NULL,
  `descripcion_glosa` VARCHAR(255) NOT NULL,
  `monto_neto` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_iva` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_exento` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_total_clp` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `moneda_original` VARCHAR(10) NOT NULL DEFAULT 'CLP',
  `monto_original` DECIMAL(15, 2) NULL,
  `tipo_cambio` DECIMAL(12, 4) NOT NULL DEFAULT 1.0000,
  `centro_costo_id` VARCHAR(36) NULL,
  `centro_costo_codigo` VARCHAR(50) NULL,
  `proyecto_id` VARCHAR(36) NULL,
  `proyecto_codigo` VARCHAR(50) NULL,
  `cuenta_contable_codigo` VARCHAR(50) NOT NULL,
  `cuenta_contable_nombre` VARCHAR(150) NULL,
  `comprobante_archivo_nombre` VARCHAR(255) NULL,
  `comprobante_url` TEXT NULL,
  `comprobante_preview_base64` MEDIUMTEXT NULL,
  `es_gasto_rechazado_art21` BOOLEAN NOT NULL DEFAULT FALSE,
  `validado_por_agente` BOOLEAN NOT NULL DEFAULT TRUE,
  `observacion_agente` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_expense_item_report` (`expense_report_id`),
  KEY `idx_expense_item_empresa_fecha` (`empresa_id`, `fecha`),
  KEY `idx_expense_item_proveedor` (`proveedor_rut`),
  KEY `idx_expense_item_cuenta` (`cuenta_contable_codigo`),
  CONSTRAINT `fk_expense_item_report` FOREIGN KEY (`expense_report_id`) REFERENCES `expense_reports` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Semillas de Proyectos Iniciales
INSERT INTO `expense_projects` (`id`, `empresa_id`, `codigo`, `nombre`, `cliente_nombre`, `presupuesto_total_clp`, `activo`, `descripcion`, `created_at`)
VALUES
('pry-01', 'client-retail-01', 'PRY-QUELLON-26', 'Mantención Mayor Redes y Jaulas Balsas Quellón', 'Salmones Antártica S.A.', 45000000.00, TRUE, 'Servicio integral de instalación de fondeos y redes loberas.', NOW()),
('pry-02', 'client-retail-01', 'PRY-STGO-EXP', 'Expansión Comercial & Distribución Retail Santiago', 'Cencosud / Walmart Chile', 25000000.00, TRUE, 'Apertura de nuevos canales de congelados y mariscos en cadenas de supermercados.', NOW()),
('pry-03', 'client-retail-01', 'PRY-LOG-FLOTA', 'Habilitación Barcazas y Motores Fuera de Borda', 'Interno Flota Austral', 18000000.00, TRUE, 'Overhaul mecánico preventivo de barcazas Don Víctor y Mar Austral II.', NOW())
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `presupuesto_total_clp` = VALUES(`presupuesto_total_clp`);

-- Semillas de Rendiciones de Gastos ("RindeGastos")
INSERT INTO `expense_reports` (
  `id`, `empresa_id`, `folio`, `titulo`, `rendidor_id`, `rendidor_nombre`, `rendidor_rut`, `rendidor_email`, `rendidor_cargo`,
  `centro_costo_id`, `centro_costo_codigo`, `centro_costo_nombre`, `proyecto_id`, `proyecto_codigo`, `proyecto_nombre`,
  `fondo_asignado_clp`, `monto_total_rendido_clp`, `saldo_reembolsar_clp`, `saldo_reintegrar_clp`, `moneda`, `estado`,
  `fecha_inicio`, `fecha_cierre`, `fecha_aprobacion`, `aprobador_nombre`, `agente_auditor_score`, `agente_auditor_diagnostico`, `created_at`
)
VALUES
(
  'rdg-001', 'client-retail-01', 'RDG-2026-001', 'Visita Técnica Clientes Salmoaustral y Supervisión Centro Dalcahue',
  'emp-001', 'Gonzalo Silva Valenzuela', '14.238.192-8', 'gonzalo.silva@maraustral.cl', 'Supervisor Comercial & Operaciones',
  'cc-02', 'CC-VTA-STGO', 'Ventas & Distribución Zona Central', 'pry-01', 'PRY-QUELLON-26', 'Mantención Mayor Redes y Jaulas Balsas Quellón',
  150000.00, 184500.00, 34500.00, 0.00, 'CLP', 'PENDIENTE_APROBACION',
  '2026-09-24', '2026-09-28', NULL, 'Carla Morales Troncoso', 95,
  '{"calificacion": "APROBADO_LIMPIO", "scoreGlobal": 95, "totalComprobantesValidos": 4, "totalComprobantesObjetados": 0, "montoIvaCreditoRecuperable": 16150, "montoGastoRechazadoArt21": 0, "alertas": [], "recomendaciones": ["Gasto de combustible rendido con boleta. Se sugiere solicitar Factura para recuperar IVA Crédito."], "verificacionRutDuplicados": true, "resumenTributario": "Comprobantes íntegros con respaldo fidedigno Art. 31 LIR. Saldo a reembolsar: $34.500 CLP."}',
  NOW()
),
(
  'rdg-002', 'client-retail-01', 'RDG-2026-002', 'Adquisición de Insumos y Repuestos Urgentes Maestranza Quellón',
  'emp-002', 'Ing. Rodrigo Cárdenas Soto', '13.914.882-K', 'rodrigo.cardenas@maraustral.cl', 'Jefe de Planta Quellón',
  'cc-03', 'CC-PRD-QUELLON', 'Planta Fabril & Maestranza Quellón', 'pry-01', 'PRY-QUELLON-26', 'Mantención Mayor Redes y Jaulas Balsas Quellón',
  200000.00, 165000.00, 0.00, 35000.00, 'CLP', 'APROBADA',
  '2026-09-15', '2026-09-18', '2026-09-20', 'Carla Morales Troncoso', 100,
  '{"calificacion": "APROBADO_LIMPIO", "scoreGlobal": 100, "totalComprobantesValidos": 2, "totalComprobantesObjetados": 0, "montoIvaCreditoRecuperable": 26345, "montoGastoRechazadoArt21": 0, "alertas": [], "recomendaciones": [], "verificacionRutDuplicados": true, "resumenTributario": "Aprobado por jefatura. El colaborador debe reintegrar $35.000 a la cuenta corriente de la empresa."}',
  NOW()
)
ON DUPLICATE KEY UPDATE `titulo` = VALUES(`titulo`), `monto_total_rendido_clp` = VALUES(`monto_total_rendido_clp`);

-- Semillas de Comprobantes
INSERT INTO `expense_items` (
  `id`, `expense_report_id`, `empresa_id`, `fecha`, `tipo_documento`, `folio_documento`,
  `proveedor_rut`, `proveedor_razon_social`, `categoria`, `descripcion_glosa`,
  `monto_neto`, `monto_iva`, `monto_exento`, `monto_total_clp`,
  `centro_costo_id`, `centro_costo_codigo`, `proyecto_id`, `proyecto_codigo`,
  `cuenta_contable_codigo`, `cuenta_contable_nombre`, `es_gasto_rechazado_art21`, `validado_por_agente`, `created_at`
)
VALUES
('item-01', 'rdg-001', 'client-retail-01', '2026-09-25', 'BOLETA_ELECTRONICA', 'B-481920', '99.520.000-7', 'Compañía de Petróleos de Chile COPEC S.A.', 'COMBUSTIBLE', 'Carga de Diesel camioneta terreno traslado Chiloé', 37815.00, 7185.00, 0.00, 45000.00, 'cc-02', 'CC-VTA-STGO', 'pry-01', 'PRY-QUELLON-26', '4.2.01.009', 'Combustibles & Lubricantes', FALSE, TRUE, NOW()),
('item-02', 'rdg-001', 'client-retail-01', '2026-09-26', 'FACTURA_ELECTRONICA_33', '91283', '76.128.490-2', 'Hotelera & Turismo del Sur SpA (Hotel Castro)', 'ALOJAMIENTO', 'Hospedaje 2 noches personal técnico en terreno', 85000.00, 16150.00, 0.00, 101150.00, 'cc-02', 'CC-VTA-STGO', 'pry-01', 'PRY-QUELLON-26', '4.2.01.007', 'Alojamiento & Estadía Terreno', FALSE, TRUE, NOW()),
('item-03', 'rdg-001', 'client-retail-01', '2026-09-26', 'BOLETA_ELECTRONICA', 'B-12839', '77.819.200-5', 'Restaurante Rincón Chilote Castro', 'ALIMENTACION', 'Cena y almuerzo en terreno durante supervisión', 23824.00, 4526.00, 0.00, 28350.00, 'cc-02', 'CC-VTA-STGO', 'pry-01', 'PRY-QUELLON-26', '4.2.01.006', 'Gastos de Alimentación & Viáticos', FALSE, TRUE, NOW()),
('item-04', 'rdg-001', 'client-retail-01', '2026-09-27', 'TICKET_PEAJE', 'TAG-98124', '96.812.390-1', 'Sociedad Concesionaria Ruta del Canal S.A.', 'PEAJES_ESTACIONAMIENTOS', 'Peajes y transbordo canal de Chacao ida y vuelta', 0.00, 0.00, 10000.00, 10000.00, 'cc-02', 'CC-VTA-STGO', 'pry-01', 'PRY-QUELLON-26', '4.2.01.010', 'Peajes & Tag Autopistas', FALSE, TRUE, NOW()),
('item-05', 'rdg-002', 'client-retail-01', '2026-09-16', 'FACTURA_ELECTRONICA_33', 'F-78192', '76.992.110-3', 'Ferretería Industrial Austral Ltda.', 'MATERIALES_INSUMOS', 'Pernos de acero inox 316 y electrodos para balsas', 138655.00, 26345.00, 0.00, 165000.00, 'cc-03', 'CC-PRD-QUELLON', 'pry-01', 'PRY-QUELLON-26', '4.1.02.001', 'Materiales Menores & Consumibles', FALSE, TRUE, NOW())
ON DUPLICATE KEY UPDATE `descripcion_glosa` = VALUES(`descripcion_glosa`), `monto_total_clp` = VALUES(`monto_total_clp`);

-- ----------------------------------------------------------------------------
-- 15. ACTUALIZACIÓN PERSISTENCIA CONCILIACIÓN BANCARIA, MULTIMONEDA Y GOBERNANZA
-- ----------------------------------------------------------------------------

-- A. companies: Parámetros de Reapertura Extraordinaria y Multimoneda
ALTER TABLE `companies` ADD COLUMN `ejercicios_cerrados` JSON NULL;
ALTER TABLE `companies` ADD COLUMN `reapertura_extraordinaria_activa` JSON NULL;
ALTER TABLE `companies` ADD COLUMN `auditoria_reaperturas` JSON NULL;
ALTER TABLE `companies` ADD COLUMN `moneda_defecto` VARCHAR(10) NOT NULL DEFAULT 'CLP';
ALTER TABLE `companies` ADD COLUMN `monedas_habilitadas` JSON NULL;
ALTER TABLE `companies` ADD COLUMN `cuenta_dif_cambio_ganancia_id` VARCHAR(30) NULL DEFAULT '7.1.01.002';
ALTER TABLE `companies` ADD COLUMN `cuenta_dif_cambio_perdida_id` VARCHAR(30) NULL DEFAULT '7.2.01.002';

-- B. chart_of_accounts: Moneda y Notas Explicativas
ALTER TABLE `chart_of_accounts` ADD COLUMN `moneda_codigo` VARCHAR(10) NULL DEFAULT 'CLP';
ALTER TABLE `chart_of_accounts` ADD COLUMN `notas_explicativas` JSON NULL;

-- C. accounting_entries: Multi-Estudio, Documentos de Referencia Extendidos e Índices
ALTER TABLE `accounting_entries` ADD COLUMN `firm_id` VARCHAR(36) NOT NULL DEFAULT 'firm-default-001';
ALTER TABLE `accounting_entries` ADD COLUMN `documento_referencia` VARCHAR(150) NULL;
ALTER TABLE `accounting_entries` ADD COLUMN `tipo_documento_ref` VARCHAR(50) NULL;
ALTER TABLE `accounting_entries` ADD COLUMN `folio_documento_ref` VARCHAR(100) NULL;
ALTER TABLE `accounting_entries` ADD KEY `idx_entries_empresa_origen_doc` (`empresa_id`, `periodo`, `origen_modulo`, `documento_ref`);

-- D. accounting_entry_lines: Documentos de Respaldo No-SII, Correlativo y Multimoneda (NIC 21)
ALTER TABLE `accounting_entry_lines` ADD COLUMN `linea_numero` INT NOT NULL DEFAULT 1;
ALTER TABLE `accounting_entry_lines` ADD COLUMN `documento_ref` VARCHAR(150) NULL;
ALTER TABLE `accounting_entry_lines` ADD COLUMN `dte_id_asociado` VARCHAR(36) NULL;
ALTER TABLE `accounting_entry_lines` ADD COLUMN `tipo_documento_ref` VARCHAR(50) NULL;
ALTER TABLE `accounting_entry_lines` ADD COLUMN `folio_documento_ref` VARCHAR(100) NULL;
ALTER TABLE `accounting_entry_lines` ADD COLUMN `monto_documento_ref` DECIMAL(15, 2) NULL;
ALTER TABLE `accounting_entry_lines` ADD COLUMN `fecha_documento_ref` DATE NULL;
ALTER TABLE `accounting_entry_lines` ADD COLUMN `fecha_vencimiento_ref` DATE NULL;
ALTER TABLE `accounting_entry_lines` ADD COLUMN `documento_operacion` VARCHAR(100) NULL;
ALTER TABLE `accounting_entry_lines` ADD COLUMN `tipo_documento_operacion` VARCHAR(50) NULL;
ALTER TABLE `accounting_entry_lines` ADD COLUMN `fecha_documento_operacion` DATE NULL;
ALTER TABLE `accounting_entry_lines` ADD COLUMN `documento_conciliacion` VARCHAR(100) NULL;
ALTER TABLE `accounting_entry_lines` ADD COLUMN `tipo_documento_conciliacion` VARCHAR(50) NULL;
ALTER TABLE `accounting_entry_lines` ADD COLUMN `moneda_original` VARCHAR(10) NULL;
ALTER TABLE `accounting_entry_lines` ADD COLUMN `monto_moneda_original` DECIMAL(15, 2) NULL;
ALTER TABLE `accounting_entry_lines` ADD COLUMN `tipo_cambio` DECIMAL(12, 4) NULL;

-- E. bank_transactions: Conciliación, Criterios y Desambiguación
ALTER TABLE `bank_transactions` ADD COLUMN `cargo` DECIMAL(15, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE `bank_transactions` ADD COLUMN `abono` DECIMAL(15, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE `bank_transactions` ADD COLUMN `documento_ref` VARCHAR(100) NULL;
ALTER TABLE `bank_transactions` ADD COLUMN `codigo_conciliacion` VARCHAR(50) NULL;
ALTER TABLE `bank_transactions` ADD COLUMN `fecha_conciliacion` DATETIME(3) NULL;
ALTER TABLE `bank_transactions` ADD COLUMN `match_criterio` VARCHAR(255) NULL;
ALTER TABLE `bank_transactions` ADD COLUMN `usuario_conciliador` VARCHAR(100) NULL;
ALTER TABLE `bank_transactions` ADD COLUMN `asiento_generado_id` VARCHAR(36) NULL;
ALTER TABLE `bank_transactions` ADD COLUMN `partida_contable_detalle` JSON NULL;
ALTER TABLE `bank_transactions` ADD COLUMN `es_ambiguo` BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE `bank_transactions` ADD COLUMN `candidatos_matches_count` INT NULL DEFAULT 0;

SET FOREIGN_KEY_CHECKS = 1;
-- ============================================================================
-- FIN DEL SCRIPT DE ACTUALIZACIÓN MYSQL ERP
-- ============================================================================
