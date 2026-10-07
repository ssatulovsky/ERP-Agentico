-- ============================================================================
-- SISTEMA ERP CONTABLE CHILENO MULTI-TENANT CON PERSISTENCIA NATIVA MYSQL 8.0
-- Script DDL Actualizado y Completo para Todos los Módulos del Sistema
-- ============================================================================
-- Compatible con: MySQL 8.0+ / AWS Aurora MySQL / Google Cloud SQL MySQL
-- Juego de caracteres: utf8mb4 / Collation: utf8mb4_unicode_ci
-- Cumplimiento: IFRS / NIC 2, NIC 16, IFRS 16, SII (DL 825, LIR Art. 14/16/30/31/41/84)
-- Cumplimiento Laboral: Dirección del Trabajo (DT REL, Ley Karin 21.643, Ley 40 Horas 21.561)
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';

-- ============================================================================
-- 1. TABLA: accounting_firms (Nivel 1: Estudio Contable Titular de Suscripción)
-- ============================================================================
DROP TABLE IF EXISTS `accounting_firms`;
CREATE TABLE `accounting_firms` (
  `id` VARCHAR(36) NOT NULL,
  `rut` VARCHAR(20) NOT NULL,
  `razon_social` VARCHAR(255) NOT NULL,
  `email_contacto` VARCHAR(255) NOT NULL,
  `plan` VARCHAR(50) NOT NULL DEFAULT 'ESTUDIO_PRO',
  `estado` ENUM('ACTIVO', 'SUSPENDIDO', 'DEMO') NOT NULL DEFAULT 'ACTIVO',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_firm_rut` (`rut`),
  KEY `idx_firm_rut` (`rut`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 1.1 TABLA: erp_subscription_plans (Catálogo de Planes de Contratación SaaS)
-- ============================================================================
DROP TABLE IF EXISTS `erp_subscription_plans`;
CREATE TABLE `erp_subscription_plans` (
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

-- ============================================================================
-- 2. TABLA: companies (Nivel 2: Cliente del Estudio Contable / Empresa Operativa)
-- Incluye Configuración Fiscal, Cierre de Ejercicio (Art. 16 CT) y Ficha Cliente Ancla
-- ============================================================================
DROP TABLE IF EXISTS `companies`;
CREATE TABLE `companies` (
  `id` VARCHAR(36) NOT NULL,
  `firm_id` VARCHAR(36) NOT NULL,
  `rut` VARCHAR(20) NOT NULL,
  `razon_social` VARCHAR(255) NOT NULL,
  `giro` VARCHAR(255) NOT NULL,
  `regimen_tributario` ENUM('14_A', '14_D3', '14_D8') NOT NULL DEFAULT '14_D3',
  `tasa_ppm` DECIMAL(5, 4) NOT NULL DEFAULT 0.0100,
  `tasa_ppm_voluntaria` DECIMAL(5, 4) NULL DEFAULT 0.0000,
  -- Parámetros de Ejercicio Fiscal y Cierre Contable (Art. 16 Código Tributario)
  `mes_cierre_ejercicio` INT NOT NULL DEFAULT 12,
  `dia_cierre_ejercicio` INT NOT NULL DEFAULT 31,
  `ejercicio_activo` INT NOT NULL DEFAULT 2026,
  `fecha_inicio_ejercicio` DATE NULL,
  `fecha_fin_ejercicio` DATE NULL,
  `periodos_cerrados` JSON NULL, -- Array de períodos bloqueados ej: ["2025-12", "2026-01"]
  `bloqueo_periodo_cerrado` BOOLEAN NOT NULL DEFAULT TRUE,
  `resolucion_sii_cierre_especial` VARCHAR(100) NULL,
  `capital_propio_tributario` DECIMAL(15, 2) NULL,
  `patente_municipal_tasa_por_mil` DECIMAL(5, 2) NULL DEFAULT 2.50,
  `remanente_credito_fiscal_utm` DECIMAL(10, 4) NULL DEFAULT 0.0000,
  `remanente_credito_fiscal_clp` DECIMAL(15, 2) NULL DEFAULT 0.00,
  `es_cliente_ancla` BOOLEAN NOT NULL DEFAULT FALSE,
  -- Extensión Ficha Cliente Ancla y Plan de Contratación ERP
  `plan_contratado_id` VARCHAR(50) NULL DEFAULT 'PLAN_PRO',
  `plan_precio_uf` DECIMAL(10, 2) NULL DEFAULT 4.50,
  `fecha_inicio_contrato` DATE NULL,
  `fecha_termino_contrato` DATE NULL,
  `limite_credito_comercial` DECIMAL(15, 2) NULL DEFAULT 15000000.00,
  `dias_credito` INT NOT NULL DEFAULT 30,
  `cuenta_contable_cobro_id` VARCHAR(30) NULL DEFAULT '1.1.03.001',
  `cuenta_contable_pago_id` VARCHAR(30) NULL DEFAULT '2.1.01.001',
  `contacto_cobranza_nombre` VARCHAR(150) NULL,
  `contacto_cobranza_email` VARCHAR(150) NULL,
  `contacto_cobranza_telefono` VARCHAR(50) NULL,
  `direccion_comercial` VARCHAR(255) NULL,
  `ciudad_comercial` VARCHAR(100) NULL,
  `region_comercial` VARCHAR(100) NULL,
  `comuna_comercial` VARCHAR(100) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_companies_firm_rut` (`firm_id`, `rut`),
  KEY `idx_companies_firm_id` (`firm_id`),
  KEY `idx_companies_rut` (`rut`),
  CONSTRAINT `fk_companies_firm` FOREIGN KEY (`firm_id`) REFERENCES `accounting_firms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2.1 TABLA: erp_system_parameters (Parámetros Generales de Cierre Legal Art. 16 CT)
-- ============================================================================
DROP TABLE IF EXISTS `erp_system_parameters`;
CREATE TABLE `erp_system_parameters` (
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

-- ============================================================================
-- 2.2 TABLA: chart_of_accounts_hierarchy (Agrupaciones IFRS de Cuentas)
-- ============================================================================
DROP TABLE IF EXISTS `chart_of_accounts_hierarchy`;
CREATE TABLE `chart_of_accounts_hierarchy` (
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

-- ============================================================================
-- 2.3 TABLA: chart_of_accounts_master (Plan de Cuentas Imputables Extendido IFRS)
-- ============================================================================
DROP TABLE IF EXISTS `chart_of_accounts_master`;
CREATE TABLE `chart_of_accounts_master` (
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

-- ============================================================================
-- 2.4 TABLA: client_auxiliaries_master (Padrón Maestro de Auxiliares Clientes/Proveedores SII)
-- ============================================================================
DROP TABLE IF EXISTS `client_auxiliaries_master`;
CREATE TABLE `client_auxiliaries_master` (
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

-- ============================================================================
-- 2.5 TABLA: client_onboarding_audit (Auditoría de Altas y Contratos ERP)
-- ============================================================================
DROP TABLE IF EXISTS `client_onboarding_audit`;
CREATE TABLE `client_onboarding_audit` (
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

-- ============================================================================
-- 3. TABLA: company_module_subscriptions (Nivel 3: Suscripción a Módulos)
-- ============================================================================
DROP TABLE IF EXISTS `company_module_subscriptions`;
CREATE TABLE `company_module_subscriptions` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `modulo_codigo` ENUM(
    'CORE_ACCOUNTING',
    'F29_TAX',
    'PAYROLL_DT',
    'INVENTORY_WMS',
    'BANK_RECON',
    'FIXED_ASSETS',
    'PRODUCTION_COSTS',
    'IFRS16_LEASES',
    'MARKETING_AUTONOMOUS',
    'CUSTOMER_SERVICE_AI',
    'CASH_FLOW_PROJECTION'
  ) NOT NULL,
  `pagado_por` ENUM('ESTUDIO', 'CLIENTE') NOT NULL DEFAULT 'ESTUDIO',
  `estado` ENUM('ACTIVO', 'INACTIVO', 'PERIODO_PRUEBA') NOT NULL DEFAULT 'ACTIVO',
  `configuracion_json` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_empresa_modulo` (`empresa_id`, `modulo_codigo`),
  KEY `idx_sub_empresa_id` (`empresa_id`),
  CONSTRAINT `fk_sub_company` FOREIGN KEY (`empresa_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. TABLA: company_credentials_vault (Bóveda Segura AES-256-GCM para SII y Bancos)
-- ============================================================================
DROP TABLE IF EXISTS `company_credentials_vault`;
CREATE TABLE `company_credentials_vault` (
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

-- ============================================================================
-- 5. TABLA: chart_of_accounts (Plan de Cuentas IFRS Clasificado)
-- ============================================================================
DROP TABLE IF EXISTS `chart_of_accounts`;
CREATE TABLE `chart_of_accounts` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `codigo_cuenta` VARCHAR(30) NOT NULL,
  `nombre_cuenta` VARCHAR(150) NOT NULL,
  `clasificacion` ENUM('ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESOS', 'COSTOS', 'GASTOS') NOT NULL,
  `acepta_auxiliar` BOOLEAN NOT NULL DEFAULT FALSE,
  `maneja_multimoneda` BOOLEAN NOT NULL DEFAULT FALSE,
  `requiere_doc_ref` BOOLEAN NOT NULL DEFAULT FALSE,
  `es_efectivo_equivalente` BOOLEAN NOT NULL DEFAULT FALSE,
  `es_contracuenta_efectivo` BOOLEAN NOT NULL DEFAULT FALSE,
  `requiere_proyecto` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_chart_empresa_codigo` (`empresa_id`, `codigo_cuenta`),
  KEY `idx_chart_clasificacion` (`empresa_id`, `clasificacion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. TABLA: accounting_entries (Libro Diario / Comprobantes Inmutables)
-- ============================================================================
DROP TABLE IF EXISTS `accounting_entries`;
CREATE TABLE `accounting_entries` (
  `id` VARCHAR(36) NOT NULL,
  `firm_id` VARCHAR(36) NOT NULL DEFAULT 'firm-default-001',
  `empresa_id` VARCHAR(36) NOT NULL,
  `periodo` VARCHAR(7) NOT NULL, -- Formato: 'AAAA-MM'
  `fecha` DATE NOT NULL,
  `concepto` TEXT NOT NULL,
  `documento_ref` VARCHAR(100) NULL,
  `origen_modulo` VARCHAR(50) NOT NULL,
  `total_debe` DECIMAL(15, 2) NOT NULL,
  `total_haber` DECIMAL(15, 2) NOT NULL,
  `creado_por_agente` VARCHAR(60) NOT NULL,
  `autorizado_por_supervisor` BOOLEAN NOT NULL DEFAULT FALSE,
  `supervisor_signature` VARCHAR(128) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_entries_empresa_origen_doc` (`empresa_id`, `periodo`, `origen_modulo`, `documento_ref`),
  KEY `idx_entries_empresa_periodo` (`empresa_id`, `periodo`),
  KEY `idx_entries_firm_empresa` (`firm_id`, `empresa_id`),
  KEY `idx_entries_fecha` (`fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. TABLA: accounting_entry_lines (Detalle de Partidas Debe / Haber)
-- ============================================================================
DROP TABLE IF EXISTS `accounting_entry_lines`;
CREATE TABLE `accounting_entry_lines` (
  `id` VARCHAR(36) NOT NULL,
  `entry_id` VARCHAR(36) NOT NULL,
  `linea_numero` INT NOT NULL,
  `codigo_cuenta` VARCHAR(30) NOT NULL,
  `nombre_cuenta` VARCHAR(150) NOT NULL,
  `debe` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `haber` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `rut_auxiliar` VARCHAR(20) NULL,
  `centro_costo` VARCHAR(50) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_lines_entry_id` (`entry_id`),
  KEY `idx_lines_cuenta` (`codigo_cuenta`),
  KEY `idx_lines_rut_auxiliar` (`rut_auxiliar`),
  CONSTRAINT `fk_lines_entry` FOREIGN KEY (`entry_id`) REFERENCES `accounting_entries` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. TABLA: agent_audit_logs (Bitácora Forense de Auditoría Inmutable)
-- ============================================================================
DROP TABLE IF EXISTS `agent_audit_logs`;
CREATE TABLE `agent_audit_logs` (
  `id` VARCHAR(36) NOT NULL,
  `trace_id` VARCHAR(64) NOT NULL,
  `firm_id` VARCHAR(36) NOT NULL DEFAULT 'firm-default-001',
  `empresa_id` VARCHAR(36) NOT NULL,
  `agente_nombre` VARCHAR(60) NOT NULL,
  `modulo` VARCHAR(60) NOT NULL DEFAULT 'CONTABILIDAD',
  `accion` VARCHAR(100) NOT NULL DEFAULT 'COMMIT_ASIENTO',
  `estado_transicion` VARCHAR(50) NOT NULL DEFAULT 'APROBADO',
  `prompt_tokens` INT NULL,
  `completion_tokens` INT NULL,
  `model_name` VARCHAR(50) NULL,
  `prompt_hash` VARCHAR(64) NULL,
  `payload_input` JSON NULL,
  `payload_output` JSON NULL,
  `diff_contable` JSON NULL,
  `supervisor_veredicto` VARCHAR(50) NULL,
  `supervisor_signature` VARCHAR(128) NULL,
  `tiempo_ejecucion_ms` INT NOT NULL DEFAULT 0,
  `tipo_evento` VARCHAR(50) NULL,
  `payload_entrada` JSON NULL,
  `resultado_validacion` JSON NULL,
  `tiempo_inferencia_ms` INT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_audit_trace` (`trace_id`),
  KEY `idx_audit_empresa_created` (`empresa_id`, `created_at`),
  KEY `idx_audit_firm` (`firm_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. TABLA: fiscal_year_closings (Cierres y Aperturas de Ejercicios Contables)
-- ============================================================================
DROP TABLE IF EXISTS `fiscal_year_closings`;
CREATE TABLE `fiscal_year_closings` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `ejercicio` INT NOT NULL,
  `fecha_cierre` DATE NOT NULL,
  `fecha_apertura_siguiente` DATE NOT NULL,
  `resultado_ejercicio` DECIMAL(15, 2) NOT NULL,
  `tipo_resultado` ENUM('UTILIDAD', 'PERDIDA') NOT NULL,
  `asiento_refundicion_id` VARCHAR(36) NULL,
  `asiento_cierre_balance_id` VARCHAR(36) NULL,
  `asiento_apertura_id` VARCHAR(36) NULL,
  `estado` ENUM('BORRADOR', 'AUDITADO', 'APLICADO', 'REVERTIDO') NOT NULL DEFAULT 'APLICADO',
  `cerrado_por` VARCHAR(100) NOT NULL DEFAULT 'SENIOR_ACCOUNTING_ORCHESTRATOR',
  `observaciones` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fiscal_closing_empresa_ejercicio` (`empresa_id`, `ejercicio`),
  KEY `idx_fiscal_closing_empresa` (`empresa_id`),
  CONSTRAINT `fk_closing_refundicion` FOREIGN KEY (`asiento_refundicion_id`) REFERENCES `accounting_entries` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_closing_cierre` FOREIGN KEY (`asiento_cierre_balance_id`) REFERENCES `accounting_entries` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_closing_apertura` FOREIGN KEY (`asiento_apertura_id`) REFERENCES `accounting_entries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 10. TABLA: retroactive_catchup_packs (Lotes de Regularización Retroactiva)
-- ============================================================================
DROP TABLE IF EXISTS `retroactive_catchup_packs`;
CREATE TABLE `retroactive_catchup_packs` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `periodo` VARCHAR(7) NOT NULL, -- Formato AAAA-MM
  `tipo_proceso` ENUM('REMUNERACIONES_Y_F29', 'SOLO_REMUNERACIONES', 'SOLO_F29', 'AJUSTE_PATRIMONIAL') NOT NULL,
  `fecha_devengo` DATE NOT NULL,
  `fecha_pago` DATE NOT NULL,
  `monto_total_devengado` DECIMAL(15, 2) NOT NULL,
  `monto_total_pagado` DECIMAL(15, 2) NOT NULL,
  `asientos_generados_ids` JSON NOT NULL,
  `estado` ENUM('APLICADO', 'AUDITADO', 'REVERTIDO') NOT NULL DEFAULT 'APLICADO',
  `orquestador_trace_id` VARCHAR(64) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_catchup_empresa_periodo` (`empresa_id`, `periodo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 11. TABLA: economic_indicators (Sincronización Histórica de Indicadores)
-- ============================================================================
DROP TABLE IF EXISTS `economic_indicators`;
CREATE TABLE `economic_indicators` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `codigo` VARCHAR(10) NOT NULL, -- 'UF' | 'USD' | 'UTM' | 'IPC'
  `valor` DECIMAL(12, 4) NOT NULL,
  `fecha` DATE NOT NULL,
  `fuente` VARCHAR(50) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_indicador_fecha_codigo` (`fecha`, `codigo`),
  KEY `idx_indicadores_busqueda` (`codigo`, `fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 12. TABLA: dtes_rcv (Registro de Compras y Ventas RCV SII & Imputación Analítica)
-- ============================================================================
DROP TABLE IF EXISTS `dte_items`;
DROP TABLE IF EXISTS `dtes_rcv`;
CREATE TABLE `dtes_rcv` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `periodo` VARCHAR(7) NOT NULL, -- Formato: 'AAAA-MM'
  `tipo_operacion` ENUM('VENTA', 'COMPRA') NOT NULL,
  `tipo_dte` INT NOT NULL, -- 33 (Factura), 34 (Exenta), 61 (NC), 56 (ND), 52 (Guía), etc.
  `folio` BIGINT NOT NULL,
  `rut_contraparte` VARCHAR(20) NOT NULL,
  `razon_social_contraparte` VARCHAR(255) NOT NULL,
  `fecha_emision` DATE NOT NULL,
  `monto_exento` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_neto` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_iva` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_iva_recuperable` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_iva_no_recuperable` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_total` DECIMAL(15, 2) NOT NULL,
  `estado_acuse` VARCHAR(50) NULL,
  `estado_contable` ENUM('PENDIENTE', 'CENTRALIZADO') NOT NULL DEFAULT 'PENDIENTE',
  `glosa` TEXT NULL,
  `centro_costo_id` VARCHAR(36) NULL,
  `centro_costo_codigo` VARCHAR(50) NULL,
  `centro_costo_nombre` VARCHAR(200) NULL,
  `cuenta_gasto_imputada_codigo` VARCHAR(50) NULL,
  `cuenta_gasto_imputada_nombre` VARCHAR(200) NULL,
  `items` JSON NULL,
  `entry_id_ref` VARCHAR(36) NULL,
  `track_id` VARCHAR(100) NULL,
  `ted_xml` TEXT NULL,
  `xml_timbrado` MEDIUMTEXT NULL,
  `pdf_url` VARCHAR(500) NULL,
  `ambiente_sii` INT NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dte_registro` (`empresa_id`, `tipo_operacion`, `tipo_dte`, `folio`, `rut_contraparte`),
  KEY `idx_dtes_periodo` (`empresa_id`, `periodo`, `tipo_operacion`),
  KEY `idx_dtes_fecha` (`fecha_emision`),
  KEY `idx_dtes_centro_costo` (`centro_costo_id`),
  CONSTRAINT `fk_dtes_rcv_entry` FOREIGN KEY (`entry_id_ref`) REFERENCES `accounting_entries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 12.1 TABLA: dte_items (Líneas de Detalle de Facturas e Imputación Analítica)
-- ============================================================================
CREATE TABLE `dte_items` (
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
  KEY `idx_dte_items_cc` (`centro_costo_id`),
  CONSTRAINT `fk_dte_items_dte` FOREIGN KEY (`dte_id`) REFERENCES `dtes_rcv` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 13. TABLA: boletas_honorarios (BHE - Retención Legal 14.50% Vigente 2026)
-- ============================================================================
DROP TABLE IF EXISTS `boletas_honorarios`;
CREATE TABLE `boletas_honorarios` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `folio` BIGINT NOT NULL,
  `rut_emisor` VARCHAR(20) NOT NULL,
  `nombre_emisor` VARCHAR(255) NOT NULL,
  `fecha_emision` DATE NOT NULL,
  `monto_bruto` DECIMAL(15, 2) NOT NULL,
  `tasa_retencion` DECIMAL(5, 2) NOT NULL DEFAULT 14.50, -- 14.50% vigente en 2026 (Ley 21.133)
  `retencion_monto` DECIMAL(15, 2) NOT NULL,
  `liquido_pagado` DECIMAL(15, 2) NOT NULL,
  `estado_pago` ENUM('PENDIENTE', 'PAGADO', 'ANULADO') NOT NULL DEFAULT 'PENDIENTE',
  `bhe_estado_contable` ENUM('PENDIENTE', 'CENTRALIZADO') NOT NULL DEFAULT 'PENDIENTE',
  `entry_id_ref` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bhe_folio` (`empresa_id`, `folio`, `rut_emisor`),
  KEY `idx_bhe_fecha` (`empresa_id`, `fecha_emision`),
  CONSTRAINT `fk_bhe_entry` FOREIGN KEY (`entry_id_ref`) REFERENCES `accounting_entries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 14. TABLA: bank_accounts (Cuentas Corrientes Bancarias)
-- ============================================================================
DROP TABLE IF EXISTS `bank_accounts`;
CREATE TABLE `bank_accounts` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `banco_nombre` VARCHAR(100) NOT NULL,
  `numero_cuenta` VARCHAR(50) NOT NULL,
  `tipo_cuenta` ENUM('CORRIENTE', 'VISTA', 'AHORRO') NOT NULL DEFAULT 'CORRIENTE',
  `moneda` VARCHAR(10) NOT NULL DEFAULT 'CLP',
  `codigo_cuenta_contable` VARCHAR(30) NOT NULL,
  `saldo_libro` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `saldo_cartola` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bank_acc_num` (`empresa_id`, `banco_nombre`, `numero_cuenta`),
  KEY `idx_bank_acc_empresa` (`empresa_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 15. TABLA: bank_transactions (Cartolas y Movimientos Bancarios)
-- ============================================================================
DROP TABLE IF EXISTS `bank_transactions`;
CREATE TABLE `bank_transactions` (
  `id` VARCHAR(36) NOT NULL,
  `account_id` VARCHAR(36) NOT NULL,
  `fecha` DATE NOT NULL,
  `descripcion` VARCHAR(255) NOT NULL,
  `numero_documento` VARCHAR(50) NULL,
  `monto_cargo` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_abono` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `saldo_linea` DECIMAL(15, 2) NOT NULL,
  `estado_conciliacion` ENUM('NO_CONCILIADO', 'CONCILIADO_AUTOMATICO', 'CONCILIADO_MANUAL', 'EN_DISPUTA') NOT NULL DEFAULT 'NO_CONCILIADO',
  `entry_id` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_bank_tx_account_fecha` (`account_id`, `fecha`),
  KEY `idx_bank_tx_estado` (`estado_conciliacion`),
  CONSTRAINT `fk_tx_bank_account` FOREIGN KEY (`account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 16. TABLA: bank_reconciliations (Actas de Conciliación Bancaria Mensual)
-- ============================================================================
DROP TABLE IF EXISTS `bank_reconciliations`;
CREATE TABLE `bank_reconciliations` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `account_id` VARCHAR(36) NOT NULL,
  `periodo` VARCHAR(7) NOT NULL, -- Formato AAAA-MM
  `fecha_conciliacion` DATE NOT NULL,
  `saldo_segun_cartola` DECIMAL(15, 2) NOT NULL,
  `saldo_segun_libro_banco` DECIMAL(15, 2) NOT NULL,
  `depositos_en_transito` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `cheques_transferencias_en_transito` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `novedades_cargos_pendientes` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `novedades_abonos_pendientes` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `saldo_conciliado` DECIMAL(15, 2) NOT NULL,
  `diferencia` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `cuadrado` BOOLEAN NOT NULL DEFAULT TRUE,
  `total_movimientos_cartola` INT NOT NULL DEFAULT 0,
  `total_conciliados` INT NOT NULL DEFAULT 0,
  `total_pendientes` INT NOT NULL DEFAULT 0,
  `total_novedades` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bank_recon_acc_periodo` (`account_id`, `periodo`),
  KEY `idx_bank_recon_empresa` (`empresa_id`),
  CONSTRAINT `fk_recon_account` FOREIGN KEY (`account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 17. TABLA: bank_novedades (Novedades Bancarias: Gastos, Comisiones, Intereses)
-- ============================================================================
DROP TABLE IF EXISTS `bank_novedades`;
CREATE TABLE `bank_novedades` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `account_id` VARCHAR(36) NOT NULL,
  `transaction_id` VARCHAR(36) NULL,
  `fecha` DATE NOT NULL,
  `glosa_bancaria` VARCHAR(255) NOT NULL,
  `tipo_novedad` ENUM(
    'COMISION_MANTENCION',
    'COMISION_TRANSFERENCIAS',
    'GASTO_BANCARIO',
    'IMPUESTO_TIMBRES',
    'ABONO_NO_IDENTIFICADO',
    'CARGO_PAC_NO_REGISTRADO',
    'INTERES_A_FAVOR',
    'DIFERENCIA_MONTO',
    'OTRO'
  ) NOT NULL,
  `monto` DECIMAL(15, 2) NOT NULL,
  `novedad_registrada` BOOLEAN NOT NULL DEFAULT FALSE,
  `asiento_generado_id` VARCHAR(36) NULL,
  `cuenta_contable_debe` VARCHAR(30) NULL,
  `cuenta_contable_haber` VARCHAR(30) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_novedad_empresa` (`empresa_id`),
  KEY `idx_novedad_account` (`account_id`),
  KEY `idx_novedad_fecha` (`fecha`),
  CONSTRAINT `fk_novedad_account` FOREIGN KEY (`account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_novedad_tx` FOREIGN KEY (`transaction_id`) REFERENCES `bank_transactions` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_novedad_asiento` FOREIGN KEY (`asiento_generado_id`) REFERENCES `accounting_entries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 18. TABLA: cash_flow_movements (Movimientos y Proyecciones de Flujo de Caja)
-- ============================================================================
DROP TABLE IF EXISTS `cash_flow_movements`;
CREATE TABLE `cash_flow_movements` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `fecha` DATE NOT NULL,
  `concepto` VARCHAR(255) NOT NULL,
  `tipo` ENUM('INGRESO', 'EGRESO') NOT NULL,
  `monto` DECIMAL(15, 2) NOT NULL,
  `categoria` VARCHAR(50) NOT NULL,
  `realizado` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_cf_empresa_fecha` (`empresa_id`, `fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 18.0 TABLA: cashflow_forecasts (Proyecciones de Flujo de Caja Agénticas)
-- ============================================================================
DROP TABLE IF EXISTS `cashflow_forecasts`;
CREATE TABLE `cashflow_forecasts` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `periodo_proyeccion` ENUM('30_DIAS', '60_DIAS', '90_DIAS') NOT NULL,
  `ingresos_proyectados` DECIMAL(15, 2) NOT NULL,
  `egresos_proyectados` DECIMAL(15, 2) NOT NULL,
  `saldo_neto_proyectado` DECIMAL(15, 2) NOT NULL,
  `fecha_calculo` DATE NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_cashflow_empresa_fecha` (`empresa_id`, `fecha_calculo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 18.1 TABLA: cash_flow_indirect_reports (Reportes de Flujo de Efectivo Método Indirecto NIC 7)
-- ============================================================================
DROP TABLE IF EXISTS `cash_flow_indirect_reports`;
CREATE TABLE `cash_flow_indirect_reports` (
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

-- ============================================================================
-- 19. TABLA: f29_declarations (Declaraciones Mensuales de Impuestos F29 SII)
-- ============================================================================
DROP TABLE IF EXISTS `f29_declarations`;
CREATE TABLE `f29_declarations` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `periodo` VARCHAR(7) NOT NULL, -- Formato: 'AAAA-MM'
  `folio_sii` VARCHAR(50) NULL,
  `total_iva_debito` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `total_iva_credito` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `remanente_mes_anterior` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `remanente_siguiente_mes` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `ppm_determinado` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `retenciones_segunda_cat` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `total_a_pagar` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `f29_estado` ENUM('BORRADOR', 'VALIDADO', 'DECLARADO') NOT NULL DEFAULT 'BORRADOR',
  `json_casillas` JSON NOT NULL,
  `capital_propio_tributario` DECIMAL(15, 2) NULL,
  `entry_id_ref` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_f29_empresa_periodo` (`empresa_id`, `periodo`),
  KEY `idx_f29_empresa` (`empresa_id`),
  CONSTRAINT `fk_f29_entry` FOREIGN KEY (`entry_id_ref`) REFERENCES `accounting_entries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 20. TABLA: employees (Ficha de Colaboradores / Nómina de Personal)
-- ============================================================================
DROP TABLE IF EXISTS `employees`;
CREATE TABLE `employees` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `rut` VARCHAR(20) NOT NULL,
  `nombre` VARCHAR(100) NOT NULL,
  `apellido_paterno` VARCHAR(100) NOT NULL,
  `apellido_materno` VARCHAR(100) NOT NULL,
  `cargo` VARCHAR(150) NOT NULL,
  `sueldo_base` DECIMAL(15, 2) NOT NULL,
  `afp` VARCHAR(50) NOT NULL,
  `isapre_fonasa` VARCHAR(50) NOT NULL,
  `pactado_isapre_uf` DECIMAL(6, 4) NULL DEFAULT 0.0000,
  `aplica_afc` BOOLEAN NOT NULL DEFAULT TRUE,
  `activo` BOOLEAN NOT NULL DEFAULT TRUE,
  `fecha_ingreso` DATE NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_emp_rut_empresa` (`empresa_id`, `rut`),
  KEY `idx_emp_rut` (`rut`),
  KEY `idx_emp_activo` (`empresa_id`, `activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 21. TABLA: labor_contracts (Contratos de Trabajo Mi DT / REL - Ley 40 Horas)
-- ============================================================================
DROP TABLE IF EXISTS `labor_contracts`;
CREATE TABLE `labor_contracts` (
  `id` VARCHAR(36) NOT NULL,
  `employee_id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `rut` VARCHAR(20) NOT NULL,
  `nombre_completo` VARCHAR(255) NOT NULL,
  `cargo` VARCHAR(150) NOT NULL,
  `departamento` VARCHAR(100) NOT NULL,
  `tipo_contrato` ENUM('INDEFINIDO', 'PLAZO_FIJO', 'POR_OBRA_FAENA', 'PART_TIME', 'TELETRABAJO_HIBRIDO') NOT NULL DEFAULT 'INDEFINIDO',
  `fecha_inicio` DATE NOT NULL,
  `fecha_termino` DATE NULL,
  `sueldo_base` DECIMAL(15, 2) NOT NULL,
  `jornada_horas_semanales` INT NOT NULL DEFAULT 40, -- Ley 21.561 40 Horas
  `distribucion_jornada` VARCHAR(255) NOT NULL,
  `lugar_trabajo` VARCHAR(255) NOT NULL,
  `gratificacion_modalidad` ENUM('ART_50', 'ART_47', 'CONVENCIONAL') NOT NULL DEFAULT 'ART_50',
  `asignacion_colacion` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `asignacion_movilizacion` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `estado` ENUM('VIGENTE', 'POR_VENCER', 'RENOVADO_INDEFINIDO', 'FINIQUITADO') NOT NULL DEFAULT 'VIGENTE',
  `registrado_dt_rel` BOOLEAN NOT NULL DEFAULT TRUE,
  `folio_registro_dt` VARCHAR(100) NULL,
  `clausula_confidencialidad` BOOLEAN NOT NULL DEFAULT TRUE,
  `clausula_teletrabajo` BOOLEAN NOT NULL DEFAULT FALSE,
  `observaciones` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_labor_contract_employee` (`employee_id`),
  KEY `idx_contract_empresa` (`empresa_id`),
  KEY `idx_contract_rut` (`rut`),
  CONSTRAINT `fk_contract_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 22. TABLA: labor_contract_annexes (Anexos y Pactos DT)
-- ============================================================================
DROP TABLE IF EXISTS `labor_contract_annexes`;
CREATE TABLE `labor_contract_annexes` (
  `id` VARCHAR(36) NOT NULL,
  `contrato_id` VARCHAR(36) NOT NULL,
  `fecha` DATE NOT NULL,
  `tipo` ENUM('CAMBIO_SUELDO', 'ADAPTACION_LEY_40_HORAS', 'MODALIDAD_TELETRABAJO', 'PACTO_HORAS_EXTRAS', 'CAMBIO_CARGO_FUNCIONES') NOT NULL,
  `descripcion` TEXT NOT NULL,
  `registrado_dt_rel` BOOLEAN NOT NULL DEFAULT TRUE,
  `folio_registro_dt` VARCHAR(100) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_annex_contrato` (`contrato_id`),
  CONSTRAINT `fk_annex_contrato` FOREIGN KEY (`contrato_id`) REFERENCES `labor_contracts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 23. TABLA: medical_leaves (Licencias Médicas Electrónicas LME)
-- ============================================================================
DROP TABLE IF EXISTS `medical_leaves`;
CREATE TABLE `medical_leaves` (
  `id` VARCHAR(36) NOT NULL,
  `folio_licencia` VARCHAR(50) NOT NULL,
  `employee_id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `rut` VARCHAR(20) NOT NULL,
  `nombre_completo` VARCHAR(255) NOT NULL,
  `tipo_licencia` ENUM(
    'ENFERMEDAD_COMUN',
    'PRONATAL_POSTNATAL',
    'ACCIDENTE_DEL_TRABAJO',
    'ACCIDENTE_DE_TRAYECTO',
    'ENFERMEDAD_PROFESIONAL',
    'PATOLOGIA_EMBARAZO',
    'ENFERMEDAD_GRAVE_NINO_MENOR_1'
  ) NOT NULL,
  `entidad_tramitadora` ENUM(
    'FONASA_COMPIN',
    'ISAPRE_BANMEDICA',
    'ISAPRE_COLMENA',
    'ISAPRE_CONSALUD',
    'ISAPRE_CRUZ_BLANCA',
    'ISAPRE_NUEVA_MASVIDA',
    'MUTUAL_DE_SEGURIDAD',
    'ACHS',
    'IST',
    'ISL'
  ) NOT NULL,
  `fecha_inicio` DATE NOT NULL,
  `fecha_termino` DATE NOT NULL,
  `dias_reposo` INT NOT NULL,
  `dias_descuento_remuneracion` INT NOT NULL,
  `dias_subsidio_sil` INT NOT NULL,
  `descuento_nomina_estimado` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `medico_nombre` VARCHAR(200) NOT NULL,
  `medico_rut` VARCHAR(20) NOT NULL,
  `diagnostico_cie10` VARCHAR(50) NULL,
  `estado` ENUM('RECIBIDA', 'TRAMITADA_EMPLEADOR', 'APROBADA_COMPIN_ISAPRE', 'RECHAZADA', 'PAGADA_SIL') NOT NULL DEFAULT 'RECIBIDA',
  `fecha_tramitacion_empleador` DATE NULL,
  `observaciones` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_medical_leave_folio` (`empresa_id`, `folio_licencia`),
  KEY `idx_leave_employee` (`employee_id`),
  KEY `idx_leave_fecha` (`fecha_inicio`),
  CONSTRAINT `fk_leave_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 24. TABLA: vacation_records (Control de Feriado Legal Art. 69 Código del Trabajo)
-- ============================================================================
DROP TABLE IF EXISTS `vacation_records`;
CREATE TABLE `vacation_records` (
  `id` VARCHAR(36) NOT NULL,
  `employee_id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `fecha_solicitud` DATE NOT NULL,
  `fecha_inicio` DATE NOT NULL,
  `fecha_retorno` DATE NOT NULL,
  `dias_habiles_tomados` DECIMAL(5, 2) NOT NULL,
  `dias_progresivos_tomados` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
  `estado` ENUM('SOLICITADA', 'APROBADA_JEFE', 'AUTORIZADA_RRHH', 'RECHAZADA', 'TOMADA') NOT NULL DEFAULT 'SOLICITADA',
  `comprobante_firmado` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_vacation_employee` (`employee_id`),
  KEY `idx_vacation_empresa` (`empresa_id`),
  CONSTRAINT `fk_vacation_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 25. TABLA: payroll_settlements (Liquidaciones de Remuneraciones Ley Chilena)
-- ============================================================================
DROP TABLE IF EXISTS `payroll_settlements`;
CREATE TABLE `payroll_settlements` (
  `id` VARCHAR(36) NOT NULL,
  `employee_id` VARCHAR(36) NOT NULL,
  `periodo` VARCHAR(7) NOT NULL, -- Formato: 'AAAA-MM'
  `sueldo_base` DECIMAL(15, 2) NOT NULL,
  `gratificacion_legal` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `horas_extras_monto` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `bonos_imponibles` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `total_imponible` DECIMAL(15, 2) NOT NULL,
  `asignacion_familiar` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `colacion` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `movilizacion` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `total_haberes` DECIMAL(15, 2) NOT NULL,
  `afp_monto` DECIMAL(15, 2) NOT NULL,
  `salud_monto` DECIMAL(15, 2) NOT NULL,
  `afc_trabajador` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `impuesto_unico_segunda_cat` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `total_descuentos_legales` DECIMAL(15, 2) NOT NULL,
  `liquido_a_pagar` DECIMAL(15, 2) NOT NULL,
  `sis_empleador` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `afc_empleador` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `mutual_seguridad` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `costo_empresa_total` DECIMAL(15, 2) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_emp_periodo_liq` (`employee_id`, `periodo`),
  KEY `idx_liq_periodo` (`periodo`),
  CONSTRAINT `fk_settlement_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 26. TABLA: payroll_periods (Cierres Mensuales y Centralización de Nómina)
-- ============================================================================
DROP TABLE IF EXISTS `payroll_periods`;
CREATE TABLE `payroll_periods` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `periodo` VARCHAR(7) NOT NULL,
  `uf_fin_mes` DECIMAL(12, 4) NOT NULL,
  `utm_mes` DECIMAL(12, 4) NOT NULL,
  `total_haberes` DECIMAL(15, 2) NOT NULL,
  `total_descuentos` DECIMAL(15, 2) NOT NULL,
  `liquido_a_pagar` DECIMAL(15, 2) NOT NULL,
  `total_leyes_sociales` DECIMAL(15, 2) NOT NULL,
  `payroll_estado` ENUM('LIQUIDADO', 'CENTRALIZADO') NOT NULL DEFAULT 'LIQUIDADO',
  `entry_id_ref` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payroll_empresa_periodo` (`empresa_id`, `periodo`),
  KEY `idx_payroll_empresa` (`empresa_id`),
  CONSTRAINT `fk_payroll_period_entry` FOREIGN KEY (`entry_id_ref`) REFERENCES `accounting_entries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 27. TABLA: karin_compliance_records (Cumplimiento Legal Ley Karin 21.643 DT)
-- ============================================================================
DROP TABLE IF EXISTS `karin_compliance_records`;
CREATE TABLE `karin_compliance_records` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `fecha_incidente` DATE NOT NULL,
  `canal_recepcion` VARCHAR(100) NOT NULL,
  `estado_investigacion` ENUM(
    'RECIBIDO',
    'MEDIDAS_CAUTELARES_ACTIVADAS',
    'EN_INVESTIGACION',
    'INFORME_FINAL_DT',
    'CERRADO'
  ) NOT NULL DEFAULT 'RECIBIDO',
  `protocolo_activado` VARCHAR(150) NOT NULL,
  `hash_confidencial` VARCHAR(64) NOT NULL,
  `auditor_trace_id` VARCHAR(64) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_karin_empresa` (`empresa_id`, `fecha_incidente`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 27.1 TABLA: cost_centers (Centros de Costo y Unidades de Negocio "Mini-Empresas")
-- ============================================================================
DROP TABLE IF EXISTS `cost_center_imputations`;
DROP TABLE IF EXISTS `cost_centers`;
CREATE TABLE `cost_centers` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `codigo` VARCHAR(50) NOT NULL, -- ej: "CC-ADM-01", "CC-VTA-STGO", "CC-PRD-01"
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

-- ============================================================================
-- 27.2 TABLA: cost_center_imputations (Trazabilidad de Imputaciones Directas)
-- ============================================================================
CREATE TABLE `cost_center_imputations` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `centro_costo_id` VARCHAR(36) NOT NULL,
  `tipo_documento` VARCHAR(50) NOT NULL, -- 'DTE_FACTURA', 'NOMINA_REMUNERACIONES', 'VALE_BODEGA', 'ACTIVO_FIJO_DEPRECIACION'
  `folio_referencia` VARCHAR(100) NOT NULL,
  `fecha` DATE NOT NULL,
  `monto_clp` DECIMAL(15, 2) NOT NULL,
  `concepto` VARCHAR(255) NOT NULL,
  `tipo_flujo` ENUM('INGRESO', 'COSTO', 'GASTO') NOT NULL,
  `cuenta_contable` VARCHAR(50) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_cc_imputation_cc` (`centro_costo_id`),
  KEY `idx_cc_imputation_empresa_fecha` (`empresa_id`, `fecha`),
  CONSTRAINT `fk_cc_imputation_cc` FOREIGN KEY (`centro_costo_id`) REFERENCES `cost_centers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 28. TABLA: fixed_assets (Activos Fijos IFRS / NIC 16 y Art. 31/41 LIR Chile)
-- ============================================================================
DROP TABLE IF EXISTS `fixed_asset_depreciation_runs`;
DROP TABLE IF EXISTS `fixed_assets`;
CREATE TABLE `fixed_assets` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `codigo_placa` VARCHAR(50) NOT NULL,
  `nombre` VARCHAR(200) NOT NULL,
  `categoria` ENUM(
    'MAQUINARIA_INDUSTRIAL',
    'VEHICULOS_TRANSPORTE',
    'EQUIPOS_COMPUTACIONALES',
    'INSTALACIONES_ACUICOLAS_MARITIMAS',
    'MUEBLES_UTILES',
    'BIENES_INMUEBLES_EDIFICIOS',
    'HERRAMIENTAS_EQUIPOS_MENORES'
  ) NOT NULL,
  `fecha_adquisicion` DATE NOT NULL,
  `proveedor_rut` VARCHAR(20) NULL,
  `proveedor_razon_social` VARCHAR(255) NULL,
  `folio_dte_compra` BIGINT NULL,
  `valor_adquisicion_original` DECIMAL(15, 2) NOT NULL,
  `valor_residual_financiero` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `vida_util_meses_financiera` INT NOT NULL,
  `vida_util_meses_tributaria` INT NOT NULL,
  `meses_depreciados` INT NOT NULL DEFAULT 0,
  `vida_util_restante_meses` INT NOT NULL,
  `metodo_depreciacion` ENUM(
    'LINEAL_RECTA',
    'ACELERADA_TRIBUTARIA_UN_TERCIO',
    'ULTRA_ACELERADA_UN_DECIMO',
    'UNIDADES_DE_PRODUCCION'
  ) NOT NULL DEFAULT 'LINEAL_RECTA',
  `depreciacion_acumulada_financiera` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `valor_libro_financiero` DECIMAL(15, 2) NOT NULL,
  `cuota_depreciacion_mensual_financiera` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `factor_correccion_monetaria_acum` DECIMAL(8, 6) NOT NULL DEFAULT 0.000000,
  `correccion_monetaria_acumulada` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `depreciacion_acumulada_tributaria` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `valor_tributario_neto` DECIMAL(15, 2) NOT NULL,
  `cuota_depreciacion_mensual_tributaria` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `centro_costo_id` VARCHAR(36) NULL,
  `centro_costo_codigo` VARCHAR(50) NULL,
  `centro_costo_nombre` VARCHAR(200) NULL,
  `ubicacion_fisica` VARCHAR(255) NOT NULL,
  `responsable_custodio` VARCHAR(200) NOT NULL,
  `estado` ENUM(
    'ACTIVO_OPERATIVO',
    'EN_MANTENCION',
    'DEPRECIADO_TOTALMENTE',
    'DADO_DE_BAJA_OBSOLETO',
    'VENDIDO_ENAJENADO'
  ) NOT NULL DEFAULT 'ACTIVO_OPERATIVO',
  `numero_serie` VARCHAR(100) NULL,
  `marca_modelo` VARCHAR(150) NULL,
  `es_fabril_produccion` BOOLEAN NOT NULL DEFAULT FALSE,
  `ultima_inspeccion_fecha` DATE NULL,
  `proxima_mantencion_fecha` DATE NULL,
  `notas_tecnicas` TEXT NULL,
  `asiento_alta_id` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_fixed_asset_placa` (`empresa_id`, `codigo_placa`),
  KEY `idx_fixed_asset_empresa` (`empresa_id`),
  KEY `idx_fixed_asset_categoria` (`categoria`),
  KEY `idx_fixed_asset_centro_costo` (`centro_costo_id`),
  CONSTRAINT `fk_asset_asiento` FOREIGN KEY (`asiento_alta_id`) REFERENCES `accounting_entries` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_asset_centro_costo` FOREIGN KEY (`centro_costo_id`) REFERENCES `cost_centers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 29. TABLA: fixed_asset_depreciation_runs (Corridas Mensuales de Depreciación)
-- ============================================================================
DROP TABLE IF EXISTS `fixed_asset_depreciation_runs`;
CREATE TABLE `fixed_asset_depreciation_runs` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `periodo` VARCHAR(7) NOT NULL, -- Formato AAAA-MM
  `fecha_ejecucion` DATE NOT NULL,
  `total_activos_procesados` INT NOT NULL,
  `total_depreciacion_financiera_mes` DECIMAL(15, 2) NOT NULL,
  `total_depreciacion_tributaria_mes` DECIMAL(15, 2) NOT NULL,
  `total_correccion_monetaria_mes` DECIMAL(15, 2) NOT NULL,
  `total_depreciacion_fabril_cif_mes` DECIMAL(15, 2) NOT NULL,
  `asiento_generado_id` VARCHAR(36) NULL,
  `detalle_por_activo` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_depr_run_empresa_periodo` (`empresa_id`, `periodo`),
  KEY `idx_depr_empresa` (`empresa_id`),
  CONSTRAINT `fk_depr_asiento` FOREIGN KEY (`asiento_generado_id`) REFERENCES `accounting_entries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 30. TABLA: production_budgets (Presupuestos de Producción y Cotizaciones Clientes)
-- ============================================================================
DROP TABLE IF EXISTS `production_budget_items`;
DROP TABLE IF EXISTS `production_budgets`;
CREATE TABLE `production_budgets` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `folio` VARCHAR(50) NOT NULL, -- ej: PRE-2026-039
  `cliente_id` VARCHAR(36) NULL,
  `cliente_nombre` VARCHAR(255) NOT NULL,
  `cliente_rut` VARCHAR(20) NOT NULL,
  `contacto_cliente` VARCHAR(200) NULL,
  `email_cliente` VARCHAR(200) NULL,
  `fecha_emision` DATE NOT NULL,
  `fecha_validez` DATE NOT NULL,
  `estado` ENUM('BORRADOR', 'ENVIADO', 'APROBADO', 'RECHAZADO', 'CANCELADO') NOT NULL DEFAULT 'BORRADOR',
  `fecha_envio` DATE NULL,
  `fecha_aprobacion` DATE NULL,
  `producto_nombre` VARCHAR(255) NOT NULL,
  `producto_codigo` VARCHAR(50) NOT NULL,
  `categoria` ENUM(
    'SALMONIDOS_PROCESADOS',
    'REDES_Y_FONDEOS',
    'ALIMENTO_Y_SUPLEMENTOS',
    'PRODUCTOS_MANUFACTURADOS',
    'SERVICIOS_INDUSTRIALES'
  ) NOT NULL,
  `unidad_medida` VARCHAR(20) NOT NULL DEFAULT 'UNID',
  `cantidad` DECIMAL(12, 2) NOT NULL DEFAULT 1.00,
  `condiciones_comerciales` TEXT NULL,
  `costo_total_mpd` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `costo_total_mod` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `costo_total_cif` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `costo_total_interno` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `precio_venta_neto_cliente` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `margen_bruto_estimado_clp` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `margen_bruto_estimado_pct` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
  `markup_pct` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
  `orden_produccion_id_generada` VARCHAR(36) NULL,
  `folio_op_generada` VARCHAR(50) NULL,
  `historial_envio_json` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_budget_folio` (`empresa_id`, `folio`),
  KEY `idx_budget_empresa_estado` (`empresa_id`, `estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 30.1 TABLA: production_budget_items (Partidas del Presupuesto de Producción)
-- ============================================================================
CREATE TABLE `production_budget_items` (
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
  KEY `idx_item_presupuesto` (`presupuesto_id`),
  CONSTRAINT `fk_item_presupuesto` FOREIGN KEY (`presupuesto_id`) REFERENCES `production_budgets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 30.2 TABLA: production_orders (Órdenes de Producción NIC 2 - Costeo Normal/Real y Control Presupuestario)
-- ============================================================================
DROP TABLE IF EXISTS `production_orders`;
CREATE TABLE `production_orders` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `folio_op` VARCHAR(50) NOT NULL,
  `descripcion` VARCHAR(255) NOT NULL,
  `producto_codigo` VARCHAR(50) NOT NULL,
  `producto_nombre` VARCHAR(200) NOT NULL,
  `categoria` ENUM(
    'SALMONIDOS_PROCESADOS',
    'REDES_Y_FONDEOS',
    'ALIMENTO_Y_SUPLEMENTOS',
    'PRODUCTOS_MANUFACTURADOS',
    'SERVICIOS_INDUSTRIALES'
  ) NOT NULL,
  `unidad_medida` VARCHAR(20) NOT NULL DEFAULT 'UNID',
  `fecha_inicio` DATE NOT NULL,
  `fecha_estimada_termino` DATE NOT NULL,
  `fecha_real_termino` DATE NULL,
  `estado` ENUM(
    'PLANIFICADA',
    'EN_PROCESO',
    'CONTROL_CALIDAD',
    'TERMINADA',
    'LIQUIDADA',
    'ANULADA'
  ) NOT NULL DEFAULT 'PLANIFICADA',
  `cantidad_objetivo` DECIMAL(12, 2) NOT NULL,
  `cantidad_producida_real` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `cantidad_merma` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `bodega_destino_id` VARCHAR(36) NULL,
  `costo_directo_materiales` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `costo_directo_mano_obra` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `costo_primo` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `base_prorrateo_cif` ENUM(
    'HORAS_HOMBRE_MOD',
    'HORAS_MAQUINA',
    'COSTO_PRIMO',
    'UNIDADES_PRODUCIDAS'
  ) NOT NULL DEFAULT 'HORAS_HOMBRE_MOD',
  `tasa_cif_aplicada` DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
  `costo_indirecto_cif` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `costo_total_produccion` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `costo_unitario_real` DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  `precio_venta_estimado` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `margen_bruto_unitario_estimado` DECIMAL(8, 4) NULL DEFAULT 0.0000,
  -- Vínculo Presupuestario y Margen Pactado
  `presupuesto_id` VARCHAR(36) NULL,
  `presupuesto_folio` VARCHAR(50) NULL,
  `cliente_nombre` VARCHAR(255) NULL,
  `cliente_rut` VARCHAR(20) NULL,
  `precio_venta_pactado` DECIMAL(15, 2) NULL DEFAULT 0.00,
  `margen_presupuestado_clp` DECIMAL(15, 2) NULL DEFAULT 0.00,
  `margen_presupuestado_pct` DECIMAL(6, 2) NULL DEFAULT 0.00,
  `costo_mpd_presupuestado` DECIMAL(15, 2) NULL DEFAULT 0.00,
  `costo_mod_presupuestado` DECIMAL(15, 2) NULL DEFAULT 0.00,
  `costo_cif_presupuestado` DECIMAL(15, 2) NULL DEFAULT 0.00,
  `costo_total_presupuestado` DECIMAL(15, 2) NULL DEFAULT 0.00,
  `presupuesto_base_json` JSON NULL,
  `desvio_margen_actual_clp` DECIMAL(15, 2) NULL DEFAULT 0.00,
  `desvio_margen_actual_pct` DECIMAL(6, 2) NULL DEFAULT 0.00,
  `analisis_cierre_json` JSON NULL,
  `asientos_generados_json` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_production_op_folio` (`empresa_id`, `folio_op`),
  KEY `idx_production_empresa_estado` (`empresa_id`, `estado`),
  KEY `idx_production_presupuesto` (`presupuesto_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 31. TABLA: production_material_consumptions (Consumos Materia Prima Directa)
-- ============================================================================
DROP TABLE IF EXISTS `production_material_consumptions`;
CREATE TABLE `production_material_consumptions` (
  `id` VARCHAR(36) NOT NULL,
  `orden_produccion_id` VARCHAR(36) NOT NULL,
  `fecha` DATE NOT NULL,
  `insumo_id` VARCHAR(36) NOT NULL,
  `insumo_codigo` VARCHAR(50) NOT NULL,
  `insumo_nombre` VARCHAR(200) NOT NULL,
  `bodega_origen_id` VARCHAR(36) NOT NULL,
  `cantidad_consumida` DECIMAL(12, 2) NOT NULL,
  `unidad_medida` VARCHAR(20) NOT NULL,
  `costo_unitario_pmp` DECIMAL(15, 4) NOT NULL,
  `costo_total_consumo` DECIMAL(15, 2) NOT NULL,
  `folio_guia_despacho_52` BIGINT NULL,
  `asiento_id` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_consumo_op` (`orden_produccion_id`),
  KEY `idx_consumo_insumo` (`insumo_id`),
  CONSTRAINT `fk_consumo_op` FOREIGN KEY (`orden_produccion_id`) REFERENCES `production_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_consumo_asiento` FOREIGN KEY (`asiento_id`) REFERENCES `accounting_entries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 32. TABLA: production_labor_entries (Mano de Obra Directa MOD)
-- ============================================================================
DROP TABLE IF EXISTS `production_labor_entries`;
CREATE TABLE `production_labor_entries` (
  `id` VARCHAR(36) NOT NULL,
  `orden_produccion_id` VARCHAR(36) NOT NULL,
  `fecha` DATE NOT NULL,
  `trabajador_rut` VARCHAR(20) NOT NULL,
  `trabajador_nombre` VARCHAR(200) NOT NULL,
  `cargo` VARCHAR(150) NOT NULL,
  `horas_trabajadas` DECIMAL(6, 2) NOT NULL,
  `tarifa_hora_costo_empresa` DECIMAL(12, 2) NOT NULL,
  `costo_total_mod` DECIMAL(15, 2) NOT NULL,
  `etapa_proceso` VARCHAR(150) NOT NULL,
  `asiento_id` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_labor_op` (`orden_produccion_id`),
  KEY `idx_labor_trabajador` (`trabajador_rut`),
  CONSTRAINT `fk_labor_op` FOREIGN KEY (`orden_produccion_id`) REFERENCES `production_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_labor_asiento` FOREIGN KEY (`asiento_id`) REFERENCES `accounting_entries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 33. TABLA: production_cif_pools (Fondo Costos Indirectos de Fabricación CIF)
-- ============================================================================
DROP TABLE IF EXISTS `production_cif_pools`;
CREATE TABLE `production_cif_pools` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `periodo` VARCHAR(7) NOT NULL, -- AAAA-MM
  `concepto` VARCHAR(255) NOT NULL,
  `categoria_cif` ENUM(
    'ENERGIA_COMBUSTIBLE',
    'DEPRECIACION_MAQUINARIA',
    'MANTENCION_FABRIL',
    'MANO_OBRA_INDIRECTA',
    'ARRIENDO_PLANTA',
    'SEGUROS_EPP'
  ) NOT NULL,
  `monto_total_periodo` DECIMAL(15, 2) NOT NULL,
  `cuenta_contable_gasto` VARCHAR(30) NOT NULL,
  `dte_folio_asociado` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_cif_empresa_periodo` (`empresa_id`, `periodo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 34. TABLA: warehouses (Bodegas Físicas y Centros de Distribución)
-- ============================================================================
DROP TABLE IF EXISTS `warehouses`;
CREATE TABLE `warehouses` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `codigo` VARCHAR(50) NOT NULL,
  `nombre` VARCHAR(150) NOT NULL,
  `direccion` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_warehouse_codigo` (`empresa_id`, `codigo`),
  KEY `idx_warehouse_empresa` (`empresa_id`),
  CONSTRAINT `fk_warehouse_company` FOREIGN KEY (`empresa_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 34.1 TABLA: inventory_items (Módulo de Inventarios Drizzle / PMP)
-- ============================================================================
DROP TABLE IF EXISTS `inventory_items`;
CREATE TABLE `inventory_items` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `sku` VARCHAR(50) NOT NULL,
  `descripcion` VARCHAR(255) NOT NULL,
  `stock_actual` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `costo_promedio_ponderado` DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inventory_empresa_sku` (`empresa_id`, `sku`),
  CONSTRAINT `fk_inventory_items_company` FOREIGN KEY (`empresa_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 35. TABLA: warehouse_items (Catálogo de Artículos / Stock en Bodegas)
-- ============================================================================
DROP TABLE IF EXISTS `warehouse_items`;
CREATE TABLE `warehouse_items` (
  `id` VARCHAR(36) NOT NULL,
  `warehouse_id` VARCHAR(36) NOT NULL,
  `sku` VARCHAR(50) NOT NULL,
  `descripcion` VARCHAR(255) NOT NULL,
  `stock_actual` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `stock_minimo` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `costo_unitario_promedio` DECIMAL(15, 2) NOT NULL DEFAULT 0.00, -- PMP Art. 30 LIR
  `metodo_valorizacion` ENUM('PMP', 'FIFO') NOT NULL DEFAULT 'PMP',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_warehouse_sku` (`warehouse_id`, `sku`),
  KEY `idx_items_sku` (`sku`),
  CONSTRAINT `fk_items_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 36. TABLA: stock_movements (Kardex: Entradas, Salidas y Ajustes de Inventario)
-- ============================================================================
DROP TABLE IF EXISTS `stock_movements`;
CREATE TABLE `stock_movements` (
  `id` VARCHAR(36) NOT NULL,
  `item_id` VARCHAR(36) NOT NULL,
  `fecha` DATE NOT NULL,
  `tipo_movimiento` ENUM('ENTRADA_COMPRA', 'SALIDA_VENTA', 'AJUSTE_MERMA', 'TRANSFERENCIA_ENTRE_BODEGAS') NOT NULL,
  `cantidad` DECIMAL(12, 2) NOT NULL,
  `costo_unitario` DECIMAL(15, 2) NOT NULL,
  `costo_total` DECIMAL(15, 2) NOT NULL,
  `documento_referencia` VARCHAR(100) NULL,
  `entry_id` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_stock_mov_item_fecha` (`item_id`, `fecha`),
  CONSTRAINT `fk_mov_item` FOREIGN KEY (`item_id`) REFERENCES `warehouse_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 37. TABLA: warehouse_transfers (Traslados entre Bodegas con Guía DTE 52)
-- ============================================================================
DROP TABLE IF EXISTS `warehouse_transfers`;
CREATE TABLE `warehouse_transfers` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `folio_guia_despacho_52` BIGINT NOT NULL,
  `fecha_despacho` DATE NOT NULL,
  `fecha_estimada_llegada` DATE NOT NULL,
  `fecha_recepcion_real` DATE NULL,
  `bodega_origen_id` VARCHAR(36) NOT NULL,
  `bodega_destino_id` VARCHAR(36) NOT NULL,
  `motivo_traslado` ENUM('REPOSICION_SUCURSAL', 'EQUILIBRIO_STOCK', 'SUMINISTRO_FAENA', 'DEVOLUCION_CENTRAL') NOT NULL DEFAULT 'REPOSICION_SUCURSAL',
  `estado` ENUM('PROGRAMADO', 'EN_TRANSITO', 'RECEPCIONADO', 'DISCREPANCIA') NOT NULL DEFAULT 'PROGRAMADO',
  `items_json` JSON NOT NULL,
  `valor_total_traslado` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `patente_camion` VARCHAR(20) NULL,
  `rut_chofer` VARCHAR(20) NULL,
  `nombre_chofer` VARCHAR(150) NULL,
  `rut_transportista` VARCHAR(20) NULL,
  `razon_social_transportista` VARCHAR(200) NULL,
  `asiento_contable_id` VARCHAR(36) NULL,
  `observaciones` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_transfer_guia_empresa` (`empresa_id`, `folio_guia_despacho_52`),
  KEY `idx_transfer_empresa` (`empresa_id`),
  KEY `idx_transfer_estado` (`estado`),
  CONSTRAINT `fk_transfer_bodega_origen` FOREIGN KEY (`bodega_origen_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_transfer_bodega_destino` FOREIGN KEY (`bodega_destino_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_transfer_asiento` FOREIGN KEY (`asiento_contable_id`) REFERENCES `accounting_entries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 37.1 TABLA: warehouse_withdrawals (Vales de Entrega de Bodega para OP)
-- ============================================================================
DROP TABLE IF EXISTS `warehouse_withdrawal_items`;
DROP TABLE IF EXISTS `warehouse_withdrawals`;
CREATE TABLE `warehouse_withdrawals` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `folio_vale` VARCHAR(50) NOT NULL, -- ej: VALE-2026-0042
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
  `asiento_id` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_withdrawal_folio` (`empresa_id`, `folio_vale`),
  KEY `idx_withdrawal_op` (`orden_produccion_id`),
  CONSTRAINT `fk_withdrawal_op` FOREIGN KEY (`orden_produccion_id`) REFERENCES `production_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_withdrawal_asiento` FOREIGN KEY (`asiento_id`) REFERENCES `accounting_entries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 37.2 TABLA: warehouse_withdrawal_items (Detalle Insumos de Vales y Control de Desvío)
-- ============================================================================
CREATE TABLE `warehouse_withdrawal_items` (
  `id` VARCHAR(36) NOT NULL,
  `withdrawal_id` VARCHAR(36) NOT NULL,
  `insumo_codigo` VARCHAR(50) NOT NULL,
  `insumo_nombre` VARCHAR(200) NOT NULL,
  `cantidad_retirada` DECIMAL(12, 2) NOT NULL,
  `cantidad_presupuestada_original` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `desvio_cantidad` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `costo_unitario_pmp` DECIMAL(15, 4) NOT NULL DEFAULT 0.0000,
  `costo_total` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `unidad_medida` VARCHAR(20) NOT NULL,
  `impacto_estimado_en_margen_clp` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_withdrawal_item_parent` (`withdrawal_id`),
  KEY `idx_withdrawal_item_insumo` (`insumo_codigo`),
  CONSTRAINT `fk_withdrawal_item_parent` FOREIGN KEY (`withdrawal_id`) REFERENCES `warehouse_withdrawals` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 38. TABLA: replenishment_requisitions (Sugerencias de Reposición IA)
-- ============================================================================
DROP TABLE IF EXISTS `replenishment_requisitions`;
CREATE TABLE `replenishment_requisitions` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `folio_requisicion` VARCHAR(50) NOT NULL,
  `fecha_generacion` DATE NOT NULL,
  `generado_por_agente` BOOLEAN NOT NULL DEFAULT TRUE,
  `motivo_agente` TEXT NOT NULL,
  `item_id` VARCHAR(36) NOT NULL,
  `sku` VARCHAR(50) NOT NULL,
  `nombre_item` VARCHAR(200) NOT NULL,
  `bodega_destino_id` VARCHAR(36) NOT NULL,
  `stock_actual` DECIMAL(12, 2) NOT NULL,
  `stock_minimo` DECIMAL(12, 2) NOT NULL,
  `stock_critico` DECIMAL(12, 2) NOT NULL,
  `cantidad_sugerida` DECIMAL(12, 2) NOT NULL,
  `costo_estimado_clp` DECIMAL(15, 2) NOT NULL,
  `prioridad` ENUM('URGENTE', 'ALTA', 'NORMAL') NOT NULL DEFAULT 'ALTA',
  `tipo_accion_recomendada` ENUM('COMPRA_PROVEEDOR', 'TRASPASO_INTERNO') NOT NULL DEFAULT 'COMPRA_PROVEEDOR',
  `bodega_origen_sugerida_traspaso` VARCHAR(36) NULL,
  `proveedor_sugerido_json` JSON NULL,
  `estado` ENUM('PENDIENTE_APROBACION', 'ORDEN_COMPRA_GENERADA', 'TRASPASO_INICIADO', 'RECHAZADA') NOT NULL DEFAULT 'PENDIENTE_APROBACION',
  `orden_compra_folio` BIGINT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_replenish_folio` (`empresa_id`, `folio_requisicion`),
  KEY `idx_replenish_empresa` (`empresa_id`),
  KEY `idx_replenish_prioridad` (`prioridad`),
  CONSTRAINT `fk_replenish_bodega` FOREIGN KEY (`bodega_destino_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 39. TABLA: lease_contracts (Contratos de Arrendamiento Financiero IFRS 16)
-- ============================================================================
DROP TABLE IF EXISTS `lease_contracts`;
CREATE TABLE `lease_contracts` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `arrendador` VARCHAR(255) NOT NULL,
  `activo_subyacente` VARCHAR(255) NOT NULL,
  `fecha_inicio` DATE NOT NULL,
  `plazo_meses` INT NOT NULL,
  `cuota_mensual_uf` DECIMAL(12, 4) NOT NULL,
  `tasa_descuento_anual` DECIMAL(5, 4) NOT NULL,
  `activo_por_derecho_uso` DECIMAL(15, 2) NOT NULL,
  `pasivo_por_arrendamiento` DECIMAL(15, 2) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_lease_empresa` (`empresa_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 40. TABLA: lease_amortization_schedule (Tabla de Desarrollo IFRS 16)
-- ============================================================================
DROP TABLE IF EXISTS `lease_amortization_schedule`;
CREATE TABLE `lease_amortization_schedule` (
  `id` VARCHAR(36) NOT NULL,
  `lease_id` VARCHAR(36) NOT NULL,
  `cuota_numero` INT NOT NULL,
  `fecha_vencimiento` DATE NOT NULL,
  `cuota_uf` DECIMAL(12, 4) NOT NULL,
  `cuota_clp` DECIMAL(15, 2) NOT NULL,
  `interes_clp` DECIMAL(15, 2) NOT NULL,
  `amortizacion_capital_clp` DECIMAL(15, 2) NOT NULL,
  `saldo_insoluto_clp` DECIMAL(15, 2) NOT NULL,
  `depreciacion_rou_clp` DECIMAL(15, 2) NOT NULL,
  `asiento_devengo_id` VARCHAR(36) NULL,
  `asiento_pago_id` VARCHAR(36) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lease_cuota` (`lease_id`, `cuota_numero`),
  KEY `idx_schedule_lease` (`lease_id`),
  CONSTRAINT `fk_sched_lease` FOREIGN KEY (`lease_id`) REFERENCES `lease_contracts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 41. TABLA: marketing_campaign_logs (Campañas Marketing Autónomo Cliente Ancla)
-- ============================================================================
DROP TABLE IF EXISTS `marketing_campaign_logs`;
CREATE TABLE `marketing_campaign_logs` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `nombre_campana` VARCHAR(150) NOT NULL,
  `canal` ENUM('META_ADS', 'GOOGLE_ADS', 'LINKEDIN_ADS', 'TIKTOK_ADS', 'EMAIL_MARKETING') NOT NULL,
  `fecha_inicio` DATE NOT NULL,
  `fecha_fin` DATE NULL,
  `presupuesto_clp` DECIMAL(15, 2) NOT NULL,
  `gasto_real_clp` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `ingresos_generados_clp` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `roas` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  `estado` ENUM('ACTIVA', 'PAUSADA', 'FINALIZADA', 'OPTIMIZANDO_POR_IA') NOT NULL DEFAULT 'ACTIVA',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_mkt_empresa` (`empresa_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 42. TABLA: customer_service_tickets (Atención al Cliente IA Cliente Ancla)
-- ============================================================================
DROP TABLE IF EXISTS `customer_service_tickets`;
CREATE TABLE `customer_service_tickets` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `cliente_rut` VARCHAR(20) NULL,
  `cliente_nombre` VARCHAR(150) NOT NULL,
  `cliente_email` VARCHAR(150) NOT NULL,
  `canal` ENUM('WHATSAPP', 'EMAIL', 'PORTAL_WEB', 'TELEFONO') NOT NULL,
  `motivo` VARCHAR(255) NOT NULL,
  `estado` ENUM('ABIERTO', 'EN_PROCESO_IA', 'ESCALADO_HUMANO', 'RESUELTO', 'CERRADO') NOT NULL DEFAULT 'ABIERTO',
  `satisfaccion_score` INT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_tickets_empresa` (`empresa_id`),
  KEY `idx_tickets_estado` (`estado`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 43. TABLA: company_agent_configs (Directivas e Instrucciones de Agentes)
-- ============================================================================
DROP TABLE IF EXISTS `company_agent_configs`;
CREATE TABLE `company_agent_configs` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `modulo_codigo` VARCHAR(50) NOT NULL,
  `instrucciones_especiales` TEXT NOT NULL,
  `parametros_operativos` JSON NOT NULL,
  `activo` BOOLEAN NOT NULL DEFAULT TRUE,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_config_empresa_modulo` (`empresa_id`, `modulo_codigo`),
  KEY `idx_config_empresa` (`empresa_id`),
  CONSTRAINT `fk_config_company` FOREIGN KEY (`empresa_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 44. TABLA: agent_learnings (Base de Aprendizaje y Feedback de Correcciones)
-- ============================================================================
DROP TABLE IF EXISTS `agent_learnings`;
CREATE TABLE `agent_learnings` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NULL,
  `modulo_codigo` VARCHAR(50) NOT NULL,
  `categoria` ENUM(
    'ERROR_IMPUTACION',
    'DESCUADRE_PARTIDA_DOBLE',
    'NORMATIVA_SII',
    'RECHAZO_SUPERVISOR',
    'PREFERENCIA_CLIENTE'
  ) NOT NULL,
  `descripcion_error` TEXT NOT NULL,
  `solucion_aplicada` TEXT NOT NULL,
  `asiento_incorrecto_json` JSON NULL,
  `asiento_corregido_json` JSON NULL,
  `veces_evitado` INT NOT NULL DEFAULT 0,
  `activo` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_learnings_empresa_modulo` (`empresa_id`, `modulo_codigo`),
  KEY `idx_learnings_categoria` (`categoria`),
  KEY `idx_learnings_activo` (`activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 45. ARQUITECTURA ERP AGÉNTICO: AGENTE PRINCIPAL, SUB-AGENTES Y GOBERNANZA
-- Coordinación jerárquica de procesos, bus de eventos y persistencia transitoria
-- ============================================================================

DROP TABLE IF EXISTS `agent_inter_communications`;
DROP TABLE IF EXISTS `agent_coordination_tasks`;
DROP TABLE IF EXISTS `agent_transient_states`;
DROP TABLE IF EXISTS `enterprise_agent_profiles`;

-- 45.1 TABLA: enterprise_agent_profiles (Padrón de Agentes Autónomos por Empresa)
CREATE TABLE `enterprise_agent_profiles` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `agente_codigo` ENUM(
    'MASTER_ORCHESTRATOR',
    'ACCOUNTING_LEDGER',
    'SII_RCV',
    'F29_TAX',
    'BANK_RECON',
    'INVENTORY_WMS',
    'RRHH',
    'PRODUCTION_COSTS',
    'FIXED_ASSETS',
    'FORENSIC_AUDITOR',
    'SALES_COMMERCIAL'
  ) NOT NULL,
  `nombre_descriptivo` VARCHAR(150) NOT NULL,
  `rol_proceso` VARCHAR(100) NOT NULL,
  `es_agente_principal` BOOLEAN NOT NULL DEFAULT FALSE,
  `nivel_autonomia` ENUM(
    'ASISTIDO',
    'SEMI_AUTONOMO',
    'AUTONOMO_CON_SUPERVISION',
    'AUTONOMO_TOTAL'
  ) NOT NULL DEFAULT 'AUTONOMO_CON_SUPERVISION',
  `estado_operativo` ENUM('ACTIVO', 'EN_ESPERA', 'EJECUTANDO', 'EN_PAUSA', 'ERROR') NOT NULL DEFAULT 'ACTIVO',
  `instrucciones_sistema` TEXT NULL,
  `capacidades_json` JSON NULL,
  `metricas_rendimiento` JSON NULL,
  `ultimo_latido` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_empresa_agente_perfil` (`empresa_id`, `agente_codigo`),
  KEY `idx_perfil_empresa` (`empresa_id`),
  KEY `idx_perfil_agente` (`agente_codigo`),
  KEY `idx_perfil_principal` (`empresa_id`, `es_agente_principal`),
  CONSTRAINT `fk_perfil_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 45.2 TABLA: agent_coordination_tasks (Tareas Orquestadas por el Agente Principal)
CREATE TABLE `agent_coordination_tasks` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `agente_principal_id` VARCHAR(36) NULL,
  `agente_asignado_codigo` ENUM(
    'MASTER_ORCHESTRATOR',
    'ACCOUNTING_LEDGER',
    'SII_RCV',
    'F29_TAX',
    'BANK_RECON',
    'INVENTORY_WMS',
    'RRHH',
    'PRODUCTION_COSTS',
    'FIXED_ASSETS',
    'FORENSIC_AUDITOR',
    'SALES_COMMERCIAL'
  ) NOT NULL,
  `flujo_proceso` VARCHAR(100) NOT NULL,
  `titulo_tarea` VARCHAR(255) NOT NULL,
  `descripcion` TEXT NULL,
  `payload_entrada` JSON NOT NULL,
  `prioridad` ENUM('BAJA', 'MEDIA', 'ALTA', 'CRITICA') NOT NULL DEFAULT 'MEDIA',
  `estado` ENUM(
    'PENDIENTE',
    'DELEGADA_POR_PRINCIPAL',
    'EN_PROCESO',
    'ESPERANDO_SUPERVISION',
    'COMPLETADA',
    'RECHAZADA_POR_SUPERVISOR',
    'FALLIDA'
  ) NOT NULL DEFAULT 'PENDIENTE',
  `progreso_pct` INT NOT NULL DEFAULT 0,
  `resultado_salida` JSON NULL,
  `requiere_aprobacion_humana` BOOLEAN NOT NULL DEFAULT FALSE,
  `aprobado_por_usuario` VARCHAR(100) NULL,
  `trace_id` VARCHAR(64) NOT NULL,
  `error_mensaje` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `started_at` DATETIME(3) NULL,
  `completed_at` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_coord_task_empresa` (`empresa_id`),
  KEY `idx_coord_task_estado` (`estado`),
  KEY `idx_coord_task_agente` (`agente_asignado_codigo`),
  KEY `idx_coord_task_trace` (`trace_id`),
  CONSTRAINT `fk_coord_task_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 45.3 TABLA: agent_inter_communications (Bus de Comunicación Inter-Agentes A2A)
CREATE TABLE `agent_inter_communications` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `task_id` VARCHAR(36) NULL,
  `agente_emisor` ENUM(
    'MASTER_ORCHESTRATOR',
    'ACCOUNTING_LEDGER',
    'SII_RCV',
    'F29_TAX',
    'BANK_RECON',
    'INVENTORY_WMS',
    'RRHH',
    'PRODUCTION_COSTS',
    'FIXED_ASSETS',
    'FORENSIC_AUDITOR',
    'SALES_COMMERCIAL'
  ) NOT NULL,
  `agente_receptor` ENUM(
    'MASTER_ORCHESTRATOR',
    'ACCOUNTING_LEDGER',
    'SII_RCV',
    'F29_TAX',
    'BANK_RECON',
    'INVENTORY_WMS',
    'RRHH',
    'PRODUCTION_COSTS',
    'FIXED_ASSETS',
    'FORENSIC_AUDITOR',
    'SALES_COMMERCIAL'
  ) NOT NULL,
  `tipo_mensaje` ENUM(
    'DELEGACION_TAREA',
    'SOLICITUD_DATOS',
    'REPORTE_RESULTADO',
    'ALERTA_DISCREPANCIA',
    'VEREDICTO_SUPERVISION',
    'ORDEN_BLOQUEO',
    'CONFIRMACION_ASIENTO'
  ) NOT NULL,
  `asunto` VARCHAR(255) NOT NULL,
  `contenido_json` JSON NOT NULL,
  `leido` BOOLEAN NOT NULL DEFAULT FALSE,
  `fecha_emision` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_inter_comm_empresa` (`empresa_id`),
  KEY `idx_inter_comm_emisor` (`agente_emisor`),
  KEY `idx_inter_comm_receptor` (`agente_receptor`),
  KEY `idx_inter_comm_task` (`task_id`),
  CONSTRAINT `fk_inter_comm_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inter_comm_task` FOREIGN KEY (`task_id`) REFERENCES `agent_coordination_tasks` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 45.4 TABLA: agent_transient_states (Respaldo Persistente de Memoria Rápida / Redis)
CREATE TABLE `agent_transient_states` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `redis_key` VARCHAR(255) NOT NULL,
  `tipo_cache` ENUM(
    'SESSION_AGENT',
    'LOCK_DISTRIBUIDO',
    'QUEUE_SNAPSHOT',
    'FAST_METRICS',
    'AGENT_MEMORY_HOT'
  ) NOT NULL,
  `valor_json` JSON NOT NULL,
  `ttl_segundos` INT NOT NULL DEFAULT 3600,
  `expires_at` DATETIME(3) NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_transient_redis_key` (`empresa_id`, `redis_key`),
  KEY `idx_transient_empresa` (`empresa_id`),
  KEY `idx_transient_tipo` (`tipo_cache`),
  KEY `idx_transient_expires` (`expires_at`),
  CONSTRAINT `fk_transient_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 46. DATOS SEMILLA (INITIAL SEED DATA)
-- ============================================================================

-- Catálogo Maestro de Planes ERP SaaS
INSERT INTO `erp_subscription_plans` (`id`, `nombre`, `precio_uf_mensual`, `empresas_rut_max`, `usuarios_max`, `almacenamiento_gb`, `tipo_servicio`, `modulos_incluidos`, `activo`, `created_at`)
VALUES 
('PLAN_STARTER', 'Plan Inicial Pyme', 2.00, 3, 2, 10, 'SaaS Cloud', '["CORE_ACCOUNTING", "RCV_SII", "F29_IMPUESTOS"]', TRUE, NOW()),
('PLAN_PRO', 'Plan Profesional Estudio', 4.50, 10, 5, 50, 'SaaS Cloud', '["CORE_ACCOUNTING", "RCV_SII", "F29_IMPUESTOS", "REMUNERACIONES_DT", "CONCILIACION_BANCARIA", "INVENTARIO_WMS"]', TRUE, NOW()),
('PLAN_CORP', 'Plan Corporativo Multi-Empresa', 8.50, 30, 15, 200, 'SaaS Cloud Dedicado', '["CORE_ACCOUNTING", "RCV_SII", "F29_IMPUESTOS", "REMUNERACIONES_DT", "CONCILIACION_BANCARIA", "INVENTARIO_WMS", "ACTIVO_FIJO_NIC16", "COSTOS_PRODUCCION", "IFRS16_LEASING"]', TRUE, NOW()),
('PLAN_ENTERPRISE', 'Plan Enterprise IFRS Holding', 15.00, 100, 50, 1000, 'SaaS Cloud Alta Disponibilidad', '["CORE_ACCOUNTING", "RCV_SII", "F29_IMPUESTOS", "REMUNERACIONES_DT", "CONCILIACION_BANCARIA", "INVENTARIO_WMS", "ACTIVO_FIJO_NIC16", "COSTOS_PRODUCCION", "IFRS16_LEASING", "MARKETING_AGENTE", "CUSTOMER_SERVICE_AI", "AUDITOR_FORENSE"]', TRUE, NOW())
ON DUPLICATE KEY UPDATE `precio_uf_mensual` = VALUES(`precio_uf_mensual`), `nombre` = VALUES(`nombre`);

-- Parámetros Generales de Sistema y Cierre Art. 16 CT
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
ON DUPLICATE KEY UPDATE `ano_ejercicio_activo` = VALUES(`ano_ejercicio_activo`);

-- Agrupaciones IFRS de Cuentas
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

-- Padrón Maestro de Auxiliares Clientes / Proveedores SII
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
)
ON DUPLICATE KEY UPDATE `razon_social` = VALUES(`razon_social`);

-- Estudio Contable Principal
INSERT INTO `accounting_firms` (`id`, `rut`, `razon_social`, `email_contacto`, `plan`, `estado`, `created_at`)
VALUES ('firm-001-audicon', '76.123.456-7', 'Audicón & Asociados Consultores SpA', 'contacto@audicon.cl', 'ESTUDIO_PRO', 'ACTIVO', NOW())
ON DUPLICATE KEY UPDATE `razon_social` = VALUES(`razon_social`);

-- Empresas Clientes del Estudio con Configuración Fiscal
INSERT INTO `companies` (
  `id`, `firm_id`, `rut`, `razon_social`, `giro`, `regimen_tributario`,
  `tasa_ppm`, `mes_cierre_ejercicio`, `dia_cierre_ejercicio`, `ejercicio_activo`,
  `fecha_inicio_ejercicio`, `fecha_fin_ejercicio`, `periodos_cerrados`,
  `bloqueo_periodo_cerrado`, `capital_propio_tributario`, `patente_municipal_tasa_por_mil`,
  `es_cliente_ancla`, `created_at`
)
VALUES 
(
  'client-retail-01', 'firm-001-audicon', '76.892.410-K', 'Retail & Logistics Chile SpA',
  'Comercio al por mayor y logística de distribución', '14_D3',
  0.0100, 12, 31, 2026,
  '2026-01-01', '2026-12-31', '["2025-12"]',
  TRUE, 185000000.00, 2.50,
  TRUE, NOW()
),
(
  'client-agro-02', 'firm-001-audicon', '76.543.210-9', 'Agrícola Valle Central Ltda.',
  'Cultivo y exportación de frutas y hortalizas', '14_A',
  0.0150, 6, 30, 2026, -- Ejercicio especial agrícola: Cierre 30 de Junio (Art. 16 Código Tributario)
  '2025-07-01', '2026-06-30', '["2025-06"]',
  TRUE, 420000000.00, 3.00,
  FALSE, NOW()
),
(
  'client-innovagile', 'firm-001-audicon', '77.798.901-4', 'InnovAgile Group SpA',
  'Desarrollo de software y servicios cloud', '14_D8',
  0.0025, 12, 31, 2026,
  '2026-01-01', '2026-12-31', '["2025-12"]',
  TRUE, 65000000.00, 2.50,
  FALSE, NOW()
)
ON DUPLICATE KEY UPDATE `rut` = VALUES(`rut`), `razon_social` = VALUES(`razon_social`), `mes_cierre_ejercicio` = VALUES(`mes_cierre_ejercicio`);

-- Suscripciones por Módulo
INSERT INTO `company_module_subscriptions` (`id`, `empresa_id`, `modulo_codigo`, `pagado_por`, `estado`, `created_at`)
VALUES
('sub-01', 'client-retail-01', 'CORE_ACCOUNTING', 'ESTUDIO', 'ACTIVO', NOW()),
('sub-02', 'client-retail-01', 'F29_TAX', 'ESTUDIO', 'ACTIVO', NOW()),
('sub-03', 'client-retail-01', 'PAYROLL_DT', 'ESTUDIO', 'ACTIVO', NOW()),
('sub-04', 'client-retail-01', 'INVENTORY_WMS', 'ESTUDIO', 'ACTIVO', NOW()),
('sub-05', 'client-retail-01', 'BANK_RECON', 'ESTUDIO', 'ACTIVO', NOW()),
('sub-06', 'client-retail-01', 'FIXED_ASSETS', 'ESTUDIO', 'ACTIVO', NOW()),
('sub-07', 'client-retail-01', 'PRODUCTION_COSTS', 'ESTUDIO', 'ACTIVO', NOW()),
('sub-08', 'client-retail-01', 'IFRS16_LEASES', 'ESTUDIO', 'ACTIVO', NOW()),
('sub-09', 'client-retail-01', 'CASH_FLOW_PROJECTION', 'ESTUDIO', 'ACTIVO', NOW())
ON DUPLICATE KEY UPDATE `estado` = VALUES(`estado`);

-- Bóveda de Credenciales Cifradas AES-256-GCM (Certificados Digitales & Claves SII)
INSERT INTO `company_credentials_vault` (
  `id`, `empresa_id`, `certificado_digital_encrypted`, `clave_certificado_encrypted`,
  `clave_sii_encrypted`, `api_bancos_encrypted`, `iv`, `tag_auth`, `updated_at`
)
VALUES
(
  'vault-seed-01',
  'client-retail-01',
  NULL,
  '7608c29c4661', -- Clave '123456' cifrada con AES-256-GCM
  'b14f89d3102a', -- Clave Tributaria SII cifrada
  '{"banco": "BANCO_DE_CHILE", "cuenta": "102948", "tipo": "API_B2B"}',
  '4b6013aa89753c461ed238166a8e01c4',
  '2f18a79c2bc26a48edc2ca72e5ef1976',
  NOW()
),
(
  'vault-seed-02',
  'client-agro-02',
  NULL,
  '7608c29c4661',
  'e29d71c4908f',
  '{"banco": "SANTANDER", "cuenta": "981240", "tipo": "API_HOST_TO_HOST"}',
  '4b6013aa89753c461ed238166a8e01c4',
  '2f18a79c2bc26a48edc2ca72e5ef1976',
  NOW()
)
ON DUPLICATE KEY UPDATE `clave_certificado_encrypted` = VALUES(`clave_certificado_encrypted`), `updated_at` = NOW();

-- Plan de Cuentas IFRS Estándar
INSERT INTO `chart_of_accounts` (`id`, `empresa_id`, `codigo_cuenta`, `nombre_cuenta`, `clasificacion`, `acepta_auxiliar`, `created_at`)
VALUES
('acc-01', 'client-retail-01', '1.1.01.001', 'Caja Moneda Nacional', 'ACTIVO', FALSE, NOW()),
('acc-02', 'client-retail-01', '1.1.02.001', 'Banco de Chile - Cta Cte 102948', 'ACTIVO', FALSE, NOW()),
('acc-03', 'client-retail-01', '1.1.03.001', 'Clientes Nacionales por Cobrar', 'ACTIVO', TRUE, NOW()),
('acc-04', 'client-retail-01', '1.1.04.001', 'IVA Crédito Fiscal (DL 825)', 'ACTIVO', FALSE, NOW()),
('acc-05', 'client-retail-01', '1.1.04.003', 'PPM por Recuperar (Art. 84 LIR)', 'ACTIVO', FALSE, NOW()),
('acc-06', 'client-retail-01', '1.1.05.001', 'Existencias de Mercaderías Bodega Central', 'ACTIVO', FALSE, NOW()),
('acc-07', 'client-retail-01', '1.2.01.001', 'Maquinarias y Equipos Industriales', 'ACTIVO', FALSE, NOW()),
('acc-08', 'client-retail-01', '1.2.02.001', 'Depreciación Acumulada Maquinarias', 'ACTIVO', FALSE, NOW()),
('acc-09', 'client-retail-01', '2.1.01.001', 'Proveedores Nacionales por Pagar', 'PASIVO', TRUE, NOW()),
('acc-10', 'client-retail-01', '2.1.03.001', 'IVA Débito Fiscal', 'PASIVO', FALSE, NOW()),
('acc-11', 'client-retail-01', '2.1.03.002', 'Retención Honorarios 2da Categoría por Pagar', 'PASIVO', FALSE, NOW()),
('acc-12', 'client-retail-01', '2.1.03.003', 'Impuesto Único de Segunda Categoría por Pagar', 'PASIVO', FALSE, NOW()),
('acc-13', 'client-retail-01', '2.1.03.005', 'Impuestos Mensuales F29 por Pagar (TGR)', 'PASIVO', FALSE, NOW()),
('acc-14', 'client-retail-01', '2.1.05.001', 'Sueldos por Pagar (Remuneraciones Líquidas)', 'PASIVO', TRUE, NOW()),
('acc-15', 'client-retail-01', '2.1.06.001', 'Instituciones de Previsión por Pagar (Previred)', 'PASIVO', FALSE, NOW()),
('acc-16', 'client-retail-01', '3.1.01.001', 'Capital Pagado', 'PATRIMONIO', FALSE, NOW()),
('acc-17', 'client-retail-01', '3.3.01.001', 'Utilidades Acumuladas de Ejercicios Anteriores', 'PATRIMONIO', FALSE, NOW()),
('acc-18', 'client-retail-01', '3.3.02.001', 'Resultado del Ejercicio Actual', 'PATRIMONIO', FALSE, NOW()),
('acc-19', 'client-retail-01', '4.1.01.001', 'Ingresos por Ventas del Giro Afectas a IVA', 'INGRESOS', FALSE, NOW()),
('acc-20', 'client-retail-01', '5.1.01.001', 'Costo de Ventas / Existencias Vendidas', 'COSTOS', FALSE, NOW()),
('acc-21', 'client-retail-01', '5.1.02.001', 'Sueldos y Salarios (Remuneraciones Brutas)', 'GASTOS', FALSE, NOW()),
('acc-22', 'client-retail-01', '5.1.02.002', 'Aportes Patronales (SIS, Mutual, AFC Empleador)', 'GASTOS', FALSE, NOW()),
('acc-23', 'client-retail-01', '5.1.03.001', 'Depreciación del Ejercicio (NIC 16)', 'GASTOS', FALSE, NOW())
ON DUPLICATE KEY UPDATE `nombre_cuenta` = VALUES(`nombre_cuenta`);

-- Indicadores Económicos Oficiales Chilenos
INSERT INTO `economic_indicators` (`codigo`, `valor`, `fecha`, `fuente`, `created_at`)
VALUES
('UF', 40885.6300, '2026-09-09', 'sii.cl-oficial', NOW()),
('USD', 928.1000, '2026-09-09', 'dolarapi.cl-oficial', NOW()),
('UTM', 71721.0000, '2026-09-09', 'sii.cl-oficial', NOW()),
('IPC', 0.6000, '2026-09-09', 'ine.cl-oficial', NOW()),
('UF', 40883.0000, '2026-09-07', 'mindicador.cl', NOW()),
('USD', 934.3500, '2026-09-07', 'mindicador.cl', NOW()),
('UTM', 71721.0000, '2026-09-07', 'mindicador.cl', NOW()),
('IPC', -0.2000, '2026-09-07', 'mindicador.cl', NOW())
ON DUPLICATE KEY UPDATE `valor` = VALUES(`valor`);

-- Bodegas e Inventario Inicial
INSERT INTO `warehouses` (`id`, `empresa_id`, `codigo`, `nombre`, `direccion`, `created_at`)
VALUES
('wh-01', 'client-retail-01', 'BOD-CENTRAL', 'Bodega Central San Bernardo', 'Av. Las Acacias 450, San Bernardo, RM', NOW()),
('wh-02', 'client-retail-01', 'BOD-VALPO', 'Centro Distribución Placilla', 'Camino La Pólvora km 3, Valparaíso', NOW())
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`);

INSERT INTO `warehouse_items` (`id`, `warehouse_id`, `sku`, `descripcion`, `stock_actual`, `stock_minimo`, `costo_unitario_promedio`, `metodo_valorizacion`, `updated_at`)
VALUES
('item-01', 'wh-01', 'SKU-LOG-101', 'Servidor Rack 2U Enterprise Xeon 32-Core', 14.00, 3.00, 1850000.00, 'PMP', NOW()),
('item-02', 'wh-01', 'SKU-LOG-102', 'Switch Fibra Óptica 48 Puertos 10GbE', 28.00, 5.00, 420000.00, 'PMP', NOW()),
('item-03', 'wh-02', 'SKU-LOG-201', 'Router Border Gateway Redundante Dual-Power', 8.00, 2.00, 950000.00, 'FIFO', NOW())
ON DUPLICATE KEY UPDATE `stock_actual` = VALUES(`stock_actual`);

-- Asiento Inicial Balanceado 1 (Venta Factura)
INSERT INTO `accounting_entries` (`id`, `firm_id`, `empresa_id`, `periodo`, `fecha`, `concepto`, `documento_ref`, `origen_modulo`, `total_debe`, `total_haber`, `creado_por_agente`, `autorizado_por_supervisor`, `supervisor_signature`, `created_at`)
VALUES
('entry-init-001', 'firm-001-audicon', '76.892.410-K', '2026-09', '2026-09-02', 'Venta Factura Electrónica Folio 1041 - Retail Logistics Chile S.A.', 'DTE 33 N° 1041', 'RCV_VENTA', 14875000.00, 14875000.00, 'AGENTE_RCV', TRUE, 'HMAC_SIG_VERIFIED_76892410K_1041_INIT', NOW())
ON DUPLICATE KEY UPDATE `concepto` = VALUES(`concepto`);

INSERT INTO `accounting_entry_lines` (`id`, `entry_id`, `linea_numero`, `codigo_cuenta`, `nombre_cuenta`, `debe`, `haber`, `rut_auxiliar`, `centro_costo`)
VALUES
('line-init-01', 'entry-init-001', 1, '1.1.03.001', 'Clientes Nacionales (Retail Logistics Chile S.A.)', 14875000.00, 0.00, '77.210.980-5', 'VENTAS_CORPORATIVAS'),
('line-init-02', 'entry-init-001', 2, '4.1.01.001', 'Ingresos por Ventas Afectas a IVA', 0.00, 12500000.00, NULL, 'VENTAS_CORPORATIVAS'),
('line-init-03', 'entry-init-001', 3, '2.1.03.001', 'IVA Débito Fiscal', 0.00, 2375000.00, NULL, NULL)
ON DUPLICATE KEY UPDATE `debe` = VALUES(`debe`), `haber` = VALUES(`haber`);

-- Asiento Inicial Balanceado 2 (Compra Servidores Cloud AWS)
INSERT INTO `accounting_entries` (`id`, `firm_id`, `empresa_id`, `periodo`, `fecha`, `concepto`, `documento_ref`, `origen_modulo`, `total_debe`, `total_haber`, `creado_por_agente`, `autorizado_por_supervisor`, `supervisor_signature`, `created_at`)
VALUES
('entry-init-002', 'firm-001-audicon', '76.892.410-K', '2026-09', '2026-09-03', 'Compra Factura Electrónica Folio 9840 - AWS Amazon Web Services Cloud', 'DTE 33 N° 9840', 'RCV_COMPRA', 5712000.00, 5712000.00, 'AGENTE_RCV', TRUE, 'HMAC_SIG_VERIFIED_76892410K_9840_INIT', NOW())
ON DUPLICATE KEY UPDATE `concepto` = VALUES(`concepto`);

INSERT INTO `accounting_entry_lines` (`id`, `entry_id`, `linea_numero`, `codigo_cuenta`, `nombre_cuenta`, `debe`, `haber`, `rut_auxiliar`, `centro_costo`)
VALUES
('line-init-04', 'entry-init-002', 1, '5.1.01.001', 'Costo de Ventas / Infraestructura Servidores Cloud', 4800000.00, 0.00, '76.999.888-2', 'TECNOLOGIA'),
('line-init-05', 'entry-init-002', 2, '1.1.04.001', 'IVA Crédito Fiscal (DL 825)', 912000.00, 0.00, NULL, NULL),
('line-init-06', 'entry-init-002', 3, '2.1.01.001', 'Proveedores Nacionales (Amazon Web Services Chile)', 0.00, 5712000.00, '76.999.888-2', NULL)
ON DUPLICATE KEY UPDATE `debe` = VALUES(`debe`), `haber` = VALUES(`haber`);

-- Centros de Costo Iniciales (Mini-Empresas)
INSERT INTO `cost_centers` (
  `id`, `empresa_id`, `codigo`, `nombre`, `categoria`, `responsable_nombre`, `responsable_email`,
  `presupuesto_mensual_clp`, `activo`, `descripcion`, `ventas_acumuladas_mes`, `costos_directos_mes`,
  `gastos_operacionales_mes`, `remuneraciones_mes`, `depreciacion_mes`, `created_at`
)
VALUES
('cc-01', 'client-retail-01', 'CC-ADM-01', 'Administración y Finanzas Central', 'ADMINISTRACION', 'María Paz Donoso', 'mpaz@empresa.cl', 18500000.00, TRUE, 'Gerencia de finanzas, auditoría, contabilidad y RRHH corporativo', 0.00, 0.00, 4200000.00, 8500000.00, 350000.00, NOW()),
('cc-02', 'client-retail-01', 'CC-VTA-STGO', 'Ventas & Sucursal Santiago (Mini-Empresa)', 'COMERCIAL_VENTAS', 'Carlos Valenzuela', 'carlos.v@empresa.cl', 28000000.00, TRUE, 'Unidad estratégica de ventas retail, corporativas y e-commerce RM', 85000000.00, 32000000.00, 6800000.00, 11200000.00, 580000.00, NOW()),
('cc-03', 'client-retail-01', 'CC-PRD-01', 'Operaciones & Logística Centro', 'OPERACIONES_PRODUCCION', 'Marcelo Gallardo', 'marcelo.g@empresa.cl', 35000000.00, TRUE, 'Operaciones de almacenamiento, preparación de pedidos y packing San Bernardo', 0.00, 18500000.00, 3900000.00, 9400000.00, 932539.68, NOW()),
('cc-04', 'client-retail-01', 'CC-LOG-VALPO', 'Distribución Valparaíso', 'LOGISTICA_DISTRIBUCION', 'Andrea Soto', 'asoto@empresa.cl', 12000000.00, TRUE, 'Distribución última milla y fletes V Región', 14200000.00, 5600000.00, 1950000.00, 4100000.00, 210000.00, NOW()),
('cc-05', 'client-retail-01', 'CC-TI-01', 'Tecnología & Soporte TI', 'TI_SOPORTE', 'Felipe Morales', 'fmorales@empresa.cl', 8500000.00, TRUE, 'Infraestructura cloud, licencias ERP, soporte técnico y hardware', 0.00, 2400000.00, 1800000.00, 3900000.00, 150000.00, NOW())
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`);

-- Activo Fijo Semilla
INSERT INTO `fixed_assets` (
  `id`, `empresa_id`, `codigo_placa`, `nombre`, `categoria`, `fecha_adquisicion`,
  `proveedor_rut`, `proveedor_razon_social`, `folio_dte_compra`, `valor_adquisicion_original`,
  `valor_residual_financiero`, `vida_util_meses_financiera`, `vida_util_meses_tributaria`,
  `meses_depreciados`, `vida_util_restante_meses`, `metodo_depreciacion`,
  `depreciacion_acumulada_financiera`, `valor_libro_financiero`, `cuota_depreciacion_mensual_financiera`,
  `factor_correccion_monetaria_acum`, `correccion_monetaria_acumulada`,
  `depreciacion_acumulada_tributaria`, `valor_tributario_neto`, `cuota_depreciacion_mensual_tributaria`,
  `centro_costo_id`, `centro_costo_codigo`, `centro_costo_nombre`,
  `ubicacion_fisica`, `responsable_custodio`, `estado`, `numero_serie`, `marca_modelo`,
  `es_fabril_produccion`, `created_at`
)
VALUES (
  'af-001', 'client-retail-01', 'AF-2026-001', 'Grúa Horquilla Eléctrica Yale 2.5T',
  'MAQUINARIA_INDUSTRIAL', '2026-01-15', '76.888.999-1', 'Yale Material Handling Chile SpA',
  8820, 24500000.00, 1000000.00, 84, 36, 8, 76, 'LINEAL_RECTA',
  2238095.24, 22261904.76, 279761.90, 0.006000, 133571.43,
  5222222.22, 19277777.78, 652777.78,
  'cc-03', 'CC-PRD-01', 'Operaciones & Logística Centro',
  'Bodega Central San Bernardo',
  'Marcelo Gallardo - Jefe Operaciones', 'ACTIVO_OPERATIVO', 'YALE-EL25-98302',
  'Yale ERP25VL 2026', FALSE, NOW()
)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`), `centro_costo_id` = VALUES(`centro_costo_id`);

-- Colaboradores Iniciales
INSERT INTO `employees` (
  `id`, `empresa_id`, `rut`, `nombre`, `apellido_paterno`, `apellido_materno`,
  `cargo`, `sueldo_base`, `afp`, `isapre_fonasa`, `pactado_isapre_uf`, `aplica_afc`,
  `activo`, `fecha_ingreso`, `created_at`
)
VALUES (
  'emp-001', 'client-retail-01', '18.456.789-2', 'Gonzalo', 'Tapia', 'Morales',
  'Jefe de Finanzas y Control de Gestión', 1850000.00, 'HABITAT', 'COLMENA', 4.5000, TRUE,
  TRUE, '2024-03-01', NOW()
)
ON DUPLICATE KEY UPDATE `sueldo_base` = VALUES(`sueldo_base`);

INSERT INTO `labor_contracts` (
  `id`, `employee_id`, `empresa_id`, `rut`, `nombre_completo`, `cargo`, `departamento`,
  `tipo_contrato`, `fecha_inicio`, `sueldo_base`, `jornada_horas_semanales`,
  `distribucion_jornada`, `lugar_trabajo`, `gratificacion_modalidad`,
  `asignacion_colacion`, `asignacion_movilizacion`, `estado`, `registrado_dt_rel`,
  `folio_registro_dt`, `created_at`
)
VALUES (
  'cto-001', 'emp-001', 'client-retail-01', '18.456.789-2', 'Gonzalo Tapia Morales',
  'Jefe de Finanzas y Control de Gestión', 'ADMINISTRACION', 'INDEFINIDO', '2024-03-01',
  1850000.00, 40, 'Lunes a Viernes de 08:30 a 17:30 hrs',
  'Av. Las Acacias 450, San Bernardo, RM', 'ART_50', 85000.00, 65000.00,
  'VIGENTE', TRUE, 'DT-REL-2024-098234', NOW()
)
ON DUPLICATE KEY UPDATE `jornada_horas_semanales` = VALUES(`jornada_horas_semanales`);

-- ============================================================================
-- 46.1 DATOS SEMILLA: PRESUPUESTOS Y ÓRDENES DE PRODUCCIÓN
-- ============================================================================
INSERT INTO `production_budgets` (
  `id`, `empresa_id`, `folio`, `cliente_id`, `cliente_nombre`, `cliente_rut`,
  `contacto_cliente`, `email_cliente`, `fecha_emision`, `fecha_validez`,
  `estado`, `fecha_envio`, `fecha_aprobacion`, `producto_nombre`, `producto_codigo`,
  `categoria`, `unidad_medida`, `cantidad`, `condiciones_comerciales`,
  `costo_total_mpd`, `costo_total_mod`, `costo_total_cif`, `costo_total_interno`,
  `precio_venta_neto_cliente`, `margen_bruto_estimado_clp`, `margen_bruto_estimado_pct`,
  `markup_pct`, `orden_produccion_id_generada`, `folio_op_generada`, `created_at`
)
VALUES
(
  'pre-2026-039', 'client-retail-01', 'PRE-2026-039', 'aux-cl-chiloe', 'Chiloé Pesquera & Salmon SpA', '76.452.190-8',
  'Ing. Rodrigo Almonacid', 'rodrigo.almonacid@chiloepesquera.cl', '2026-08-15', '2026-09-15',
  'APROBADO', '2026-08-16', '2026-08-20', 'Red Pecera HDPE Cuadrada 30x30x15m Reforzada', 'RED-HDPE-303015',
  'REDES_Y_FONDEOS', 'UNID', 2.00, 'Pago 40% anticipo, 60% contra entrega conforme en Puerto Montt',
  16500000.00, 4800000.00, 2200000.00, 23500000.00,
  34500000.00, 11000000.00, 31.88,
  46.81, 'op-2026-101', 'OP-2026-101', NOW()
),
(
  'pre-2026-040', 'client-retail-01', 'PRE-2026-040', 'aux-cl-austral', 'Austral Salmónidos del Sur S.A.', '77.890.120-3',
  'Patricia Vargas Cárdenas', 'pvargas@australsalmonidos.cl', '2026-08-22', '2026-09-22',
  'APROBADO', '2026-08-23', '2026-08-28', 'Módulo de Lobera Perimetral y Fondo Antilobo', 'LOB-PERIM-D40',
  'REDES_Y_FONDEOS', 'UNID', 1.00, 'Crédito a 30 días fecha factura comercial DTE',
  12800000.00, 3900000.00, 1850000.00, 18550000.00,
  26900000.00, 8350000.00, 31.04,
  45.01, 'op-2026-102', 'OP-2026-102', NOW()
)
ON DUPLICATE KEY UPDATE `cliente_nombre` = VALUES(`cliente_nombre`);

-- Partidas de Presupuesto
INSERT INTO `production_budget_items` (
  `id`, `presupuesto_id`, `tipo`, `insumo_codigo`, `descripcion`,
  `unidad_medida`, `cantidad_presupuestada`, `costo_unitario_estimado`,
  `costo_total_estimado`, `precio_unitario_sugerido`, `precio_total_venta`,
  `visible_para_cliente`, `notas_internas`, `created_at`
)
VALUES
('pbi-01', 'pre-2026-039', 'MPD', 'PAÑO-HDPE-1.5', 'Paño Malla HDPE Virgen Grado Acuicultura 1.5"', 'KG', 1800.00, 5200.00, 9360000.00, 7800.00, 14040000.00, TRUE, 'Cálculo para dos redes peceras 30x30m', NOW()),
('pbi-02', 'pre-2026-039', 'MPD', 'CABO-POLIPROP-24MM', 'Cabo Polipropileno Virgen 8 Cordones 24mm para Relingas', 'METROS', 1200.00, 3200.00, 3840000.00, 4800.00, 5760000.00, TRUE, 'Relingas superior e inferior', NOW()),
('pbi-03', 'pre-2026-039', 'MPD', 'PLOMADA-CADENA-10MM', 'Cabo de Fondo con Alma de Plomo Lastre 1200kg', 'KG', 2400.00, 1375.00, 3300000.00, 2050.00, 4920000.00, TRUE, 'Plomada embutida certificada', NOW()),
('pbi-04', 'pre-2026-039', 'MOD', 'MANO-OBRA-ARMADURA', 'Armadura y Enllingue Red Pecera Maestros Rederos', 'HORAS', 240.00, 20000.00, 4800000.00, 28000.00, 6720000.00, TRUE, 'Jornada taller redería especializada Puerto Montt', NOW()),
('pbi-05', 'pre-2026-039', 'CIF', 'MAQ-COSTURA-TALLER', 'Depreciación Maquinaria y Energía Fabril de Planta', 'HORAS_MAQ', 110.00, 20000.00, 2200000.00, 27818.18, 3060000.00, FALSE, 'Costos indirectos asignados', NOW())
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`);

-- Órdenes de Producción Vinculadas
INSERT INTO `production_orders` (
  `id`, `empresa_id`, `folio_op`, `descripcion`, `producto_codigo`, `producto_nombre`,
  `categoria`, `unidad_medida`, `fecha_inicio`, `fecha_estimada_termino`, `fecha_real_termino`,
  `estado`, `cantidad_objetivo`, `cantidad_producida_real`, `cantidad_merma`,
  `costo_directo_materiales`, `costo_directo_mano_obra`, `costo_primo`, `base_prorrateo_cif`,
  `tasa_cif_aplicada`, `costo_indirecto_cif`, `costo_total_produccion`, `costo_unitario_real`,
  `precio_venta_estimado`, `margen_bruto_unitario_estimado`,
  `presupuesto_id`, `presupuesto_folio`, `cliente_nombre`, `cliente_rut`,
  `precio_venta_pactado`, `margen_presupuestado_clp`, `margen_presupuestado_pct`,
  `costo_mpd_presupuestado`, `costo_mod_presupuestado`, `costo_cif_presupuestado`, `costo_total_presupuestado`,
  `desvio_margen_actual_clp`, `desvio_margen_actual_pct`, `created_at`
)
VALUES
(
  'op-2026-101', 'client-retail-01', 'OP-2026-101', 'Fabricación de 2 Redes Peceras HDPE 30x30x15m Reforzadas', 'RED-HDPE-303015', 'Red Pecera HDPE 30x30m',
  'REDES_Y_FONDEOS', 'UNID', '2026-08-25', '2026-09-18', NULL,
  'EN_PROCESO', 2.00, 0.00, 0.00,
  16850000.00, 4200000.00, 21050000.00, 'HORAS_HOMBRE_MOD',
  10500.0000, 2100000.00, 23150000.00, 11575000.0000,
  34500000.00, 5675000.0000,
  'pre-2026-039', 'PRE-2026-039', 'Chiloé Pesquera & Salmon SpA', '76.452.190-8',
  34500000.00, 11000000.00, 31.88,
  16500000.00, 4800000.00, 2200000.00, 23500000.00,
  350000.00, 1.01, NOW()
)
ON DUPLICATE KEY UPDATE `descripcion` = VALUES(`descripcion`);

-- Vales de Retiro de Bodega
INSERT INTO `warehouse_withdrawals` (
  `id`, `empresa_id`, `folio_vale`, `fecha`, `fecha_retiro`, `hora_retiro`,
  `orden_produccion_id`, `orden_produccion_folio`, `cliente_nombre`,
  `bodega_origen_id`, `bodega_origen_nombre`, `solicitante_nombre`, `responsable_bodega`,
  `costo_total_vale`, `alerta_sobreconsumo`, `observaciones`, `created_at`
)
VALUES
(
  'vale-2026-0041', 'client-retail-01', 'VALE-2026-0041', '2026-08-26', '2026-08-26', '08:45',
  'op-2026-101', 'OP-2026-101', 'Chiloé Pesquera & Salmon SpA',
  'wh-01', 'Bodega Central San Bernardo', 'Luis Mansilla (Maestro Mayor Redería)', 'Claudio Ojeda (Jefe Bodega)',
  13200000.00, FALSE, 'Primer retiro de paños de polietileno HDPE virgen y cabos de relinga', NOW()
),
(
  'vale-2026-0042', 'client-retail-01', 'VALE-2026-0042', '2026-09-02', '2026-09-02', '14:20',
  'op-2026-101', 'OP-2026-101', 'Chiloé Pesquera & Salmon SpA',
  'wh-01', 'Bodega Central San Bernardo', 'Luis Mansilla (Maestro Mayor Redería)', 'Claudio Ojeda (Jefe Bodega)',
  3650000.00, TRUE, 'Sobreconsumo de 50 kg paño de malla por ajuste de esquinas en escuadra', NOW()
)
ON DUPLICATE KEY UPDATE `folio_vale` = VALUES(`folio_vale`);

INSERT INTO `warehouse_withdrawal_items` (
  `id`, `withdrawal_id`, `insumo_codigo`, `insumo_nombre`,
  `cantidad_retirada`, `cantidad_presupuestada_original`, `desvio_cantidad`,
  `costo_unitario_pmp`, `costo_total`, `unidad_medida`, `impacto_estimado_en_margen_clp`, `created_at`
)
VALUES
('vwi-01', 'vale-2026-0041', 'PAÑO-HDPE-1.5', 'Paño Malla HDPE Virgen 1.5"', 1800.00, 1800.00, 0.00, 5200.0000, 9360000.00, 'KG', 0.00, NOW()),
('vwi-02', 'vale-2026-0041', 'CABO-POLIPROP-24MM', 'Cabo Polipropileno Virgen 24mm', 1200.00, 1200.00, 0.00, 3200.0000, 3840000.00, 'METROS', 0.00, NOW()),
('vwi-03', 'vale-2026-0042', 'PAÑO-HDPE-1.5', 'Paño Malla HDPE Virgen 1.5"', 50.00, 0.00, 50.00, 5200.0000, 260000.00, 'KG', -260000.00, NOW()),
('vwi-04', 'vale-2026-0042', 'PLOMADA-CADENA-10MM', 'Cabo con Alma de Plomo 1200kg', 2465.00, 2400.00, 65.00, 1375.0000, 3390000.00, 'KG', -90000.00, NOW())
ON DUPLICATE KEY UPDATE `insumo_nombre` = VALUES(`insumo_nombre`);

-- ============================================================================
-- 46.2 DATOS SEMILLA: ARQUITECTURA ERP AGÉNTICO Y GOBERNANZA MULTI-AGENTE
-- Coordinador Principal, Sub-Agentes de Proceso, Tareas y Bus Inter-Agentes
-- ============================================================================

-- Padrón de Agentes Autónomos Asignados a la Empresa Piloto (client-retail-01)
INSERT INTO `enterprise_agent_profiles` (
  `id`, `empresa_id`, `agente_codigo`, `nombre_descriptivo`, `rol_proceso`,
  `es_agente_principal`, `nivel_autonomia`, `estado_operativo`, `instrucciones_sistema`,
  `capacidades_json`, `metricas_rendimiento`, `ultimo_latido`, `created_at`
)
VALUES
(
  'ag-prof-principal-01', 'client-retail-01', 'MASTER_ORCHESTRATOR', 'Agente Principal (COO / CFO Digital)',
  'Orquestación General y Coordinación de Procesos de Toda la Empresa',
  TRUE, 'AUTONOMO_CON_SUPERVISION', 'ACTIVO',
  'Actúa como el Director General y Coordinador Supremo de la empresa. Supervisa y delega tareas a cada agente de proceso (Contable, Tributario, Tesorería, Inventario, Remuneraciones, Producción, Activos Fijos y Auditoría Forense). Garantiza que ninguna transacción descuadre los balances ni vulnere normativas IFRS o del SII.',
  '["COORDINACION_PROCESOS", "SUPERVISION_CRIPTOGRAFICA_HMAC", "CONTROL_INTEGRIDAD_IFRS", "DESPACHO_COLAS_REDIS", "DELEGACION_SUBAGENTES", "AUDITORIA_FORENSE_CONTINUA"]',
  '{"tareasCompletadas": 1284, "tareasFallidas": 0, "tiempoPromedioEjecucionMs": 145, "tasaAprobacionSupervisor": 0.998}',
  NOW(), NOW()
),
(
  'ag-prof-contable-02', 'client-retail-01', 'ACCOUNTING_LEDGER', 'Agente Contable IFRS',
  'Contabilización Automática de Comprobantes, Libros Diario/Mayor y Balances',
  FALSE, 'AUTONOMO_CON_SUPERVISION', 'ACTIVO',
  'Especialista en partida doble inmutable, devengos, asientos de regularización y balance tributario de 8 columnas según normas IFRS y Código Tributario chileno.',
  '["PARTIDA_DOBLE", "BALANCES_IFRS", "CIERRES_EJERCICIO", "VALIDACION_CUADRATURA", "ASIENTOS_COMPENSACION"]',
  '{"tareasCompletadas": 8420, "tareasFallidas": 2, "tiempoPromedioEjecucionMs": 85, "tasaAprobacionSupervisor": 0.999}',
  NOW(), NOW()
),
(
  'ag-prof-tributario-03', 'client-retail-01', 'SII_RCV', 'Agente Tributario & RCV SII',
  'Sincronización RCV, Determinación Débito/Crédito y Cumplimiento Tributario',
  FALSE, 'AUTONOMO_CON_SUPERVISION', 'ACTIVO',
  'Monitorea el Registro de Compras y Ventas del SII, valida acuses de recibo DTE (Ley 19.983), calcula retenciones de honorarios BHE y pre-liquida el F29 mensual.',
  '["SINCRONIZACION_RCV", "LIQUIDACION_F29", "CALCULO_PPM", "VALIDACION_DTE", "ACUSES_RECIBO_8DIAS"]',
  '{"tareasCompletadas": 5120, "tareasFallidas": 1, "tiempoPromedioEjecucionMs": 110, "tasaAprobacionSupervisor": 0.995}',
  NOW(), NOW()
),
(
  'ag-prof-tesoreria-04', 'client-retail-01', 'BANK_RECON', 'Agente de Tesorería & Bancos',
  'Conciliación Bancaria Automática Cartola vs Libro Banco y Gestión de Flujo',
  FALSE, 'AUTONOMO_CON_SUPERVISION', 'ACTIVO',
  'Concilia movimientos de cuentas corrientes bancarias chilenas (Banco de Chile, Santander, Bci), gestiona nóminas de transferencias TEF y proyecta el flujo de caja.',
  '["CONCILIACION_CARTOLA", "CASHFLOW_PROYECTADO", "GESTION_COBRANZA", "PAGO_PROVEEDORES_TEF"]',
  '{"tareasCompletadas": 3940, "tareasFallidas": 0, "tiempoPromedioEjecucionMs": 95, "tasaAprobacionSupervisor": 1.000}',
  NOW(), NOW()
),
(
  'ag-prof-inventario-05', 'client-retail-01', 'INVENTORY_WMS', 'Agente Inventario & Bodegas WMS',
  'Control de Existencias Multibodega, Valuación PMP/FIFO y Despachos',
  FALSE, 'AUTONOMO_CON_SUPERVISION', 'ACTIVO',
  'Administra stocks en bodegas físicas, calcula costo medio ponderado PMP según NIC 2, supervisa niveles críticos y genera guías de despacho electrónicas DTE 52.',
  '["VALUACION_PMP", "STOCK_CRITICO", "EMISION_GUIA_DESPACHO_52", "ROTACION_INVENTARIO", "RECEPCION_INSUMOS"]',
  '{"tareasCompletadas": 6210, "tareasFallidas": 0, "tiempoPromedioEjecucionMs": 75, "tasaAprobacionSupervisor": 0.997}',
  NOW(), NOW()
),
(
  'ag-prof-remun-06', 'client-retail-01', 'RRHH', 'Agente de Remuneraciones & RRHH',
  'Cálculo de Sueldos, Cotizaciones Previred, Libro LRE y Contratos DT',
  FALSE, 'AUTONOMO_CON_SUPERVISION', 'ACTIVO',
  'Aplica topes imponibles de AFP, Fonasa/Isapre, Seguro de Cesantía, genera archivos de Previred, Libro de Remuneraciones Electrónico LRE y fiscaliza cláusulas DT.',
  '["CALCULO_LIQUIDACIONES", "INTEGRACION_PREVIRED", "LIBRO_REMUNERACIONES_LRE", "MONITOREO_CLAUSULAS_DT", "FINIQUITOS"]',
  '{"tareasCompletadas": 2400, "tareasFallidas": 0, "tiempoPromedioEjecucionMs": 130, "tasaAprobacionSupervisor": 1.000}',
  NOW(), NOW()
),
(
  'ag-prof-costos-07', 'client-retail-01', 'PRODUCTION_COSTS', 'Agente Costos Industriales NIC 2',
  'Presupuestos Fabriles, Órdenes de Producción y Vales de Consumo',
  FALSE, 'AUTONOMO_CON_SUPERVISION', 'ACTIVO',
  'Supervisa órdenes de producción, vales de retiro de bodega, detecta sobreconsumos de insumos en tiempo real y calcula márgenes de contribución fabril.',
  '["COSTEO_NIC2", "PRESUPUESTOS_PRODUCCION", "CONTROL_SOBRECONSUMO", "ANALISIS_MARGEN", "LIQUIDACION_ORDEN"]',
  '{"tareasCompletadas": 1150, "tareasFallidas": 0, "tiempoPromedioEjecucionMs": 105, "tasaAprobacionSupervisor": 0.996}',
  NOW(), NOW()
),
(
  'ag-prof-auditor-08', 'client-retail-01', 'FORENSIC_AUDITOR', 'Agente Auditor Forense',
  'Supervisión Continua de Control Interno, Verificación HMAC y Prevención de Fraude',
  FALSE, 'AUTONOMO_CON_SUPERVISION', 'ACTIVO',
  'Verifica la integridad de cada comprobante contable, firma criptográfica HMAC-SHA256, cuadratura de balance y alertas preventivas para gerencia.',
  '["AUDITORIA_INMUTABLE_HMAC", "ALERTAS_DESCUADRE", "PREVENCION_FRAUDE", "INSPECCION_FISCAL_SII"]',
  '{"tareasCompletadas": 9800, "tareasFallidas": 0, "tiempoPromedioEjecucionMs": 40, "tasaAprobacionSupervisor": 1.000}',
  NOW(), NOW()
)
ON DUPLICATE KEY UPDATE `nombre_descriptivo` = VALUES(`nombre_descriptivo`), `updated_at` = NOW();

-- Tareas de Coordinación Delegadas por el Agente Principal
INSERT INTO `agent_coordination_tasks` (
  `id`, `empresa_id`, `agente_principal_id`, `agente_asignado_codigo`, `flujo_proceso`,
  `titulo_tarea`, `descripcion`, `payload_entrada`, `prioridad`, `estado`,
  `progreso_pct`, `resultado_salida`, `requiere_aprobacion_humana`, `aprobado_por_usuario`,
  `trace_id`, `created_at`, `started_at`, `completed_at`
)
VALUES
(
  'task-coord-2026-001', 'client-retail-01', 'ag-prof-principal-01', 'SII_RCV', 'SINCRONIZACION_RCV_MENSUAL',
  'Sincronización RCV Septiembre 2026 y Verificación de Acuses de Recibo',
  'Descarga automática de facturas de compras y ventas desde el SII, cálculo preliminar de crédito fiscal recuperable y verificación de plazos de 8 días para acuse comercial.',
  '{"periodo": "2026-09", "tipoDocumentos": ["33", "34", "61", "56"], "verificarAcuseLey19983": true}',
  'ALTA', 'COMPLETADA', 100,
  '{"totalDocumentosIngeridos": 48, "creditoFiscalCLP": 14280500, "debitoFiscalCLP": 28940200, "ivaNetoPagarCLP": 14659700}',
  FALSE, NULL, 'trace-sii-sync-202609-8819',
  NOW() - INTERVAL 2 HOUR, NOW() - INTERVAL 2 HOUR, NOW() - INTERVAL 1 HOUR
),
(
  'task-coord-2026-002', 'client-retail-01', 'ag-prof-principal-01', 'BANK_RECON', 'CONCILIACION_BANCARIA_DIARIA',
  'Conciliación Cartola Banco de Chile Cta Cte 198-24890-01',
  'Cruce automatizado de abonos TEF de clientes y cargos por pago a proveedores contra comprobantes contables registrados en el Libro Banco.',
  '{"bancoId": "BANCO_CHILE", "cuenta": "198-24890-01", "fechaCorte": "2026-09-20"}',
  'MEDIA', 'COMPLETADA', 100,
  '{"partidasConciliadas": 34, "montoConciliadoCLP": 65400000, "partidasPendientes": 0, "diferenciaCLP": 0}',
  FALSE, NULL, 'trace-recon-bch-202609-3312',
  NOW() - INTERVAL 1 HOUR, NOW() - INTERVAL 1 HOUR, NOW() - INTERVAL 30 MINUTE
),
(
  'task-coord-2026-003', 'client-retail-01', 'ag-prof-principal-01', 'PRODUCTION_COSTS', 'SUPERVISION_CONSUMO_FABRIL',
  'Inspección de Desvíos de Consumo en Orden de Fabricación OP-2026-101',
  'Comparación de insumos presupuestados vs vales de retiro reales emitidos por bodega. Alerta de sobreconsumo de material.',
  '{"ordenId": "op-2026-101", "umbralAlertaMargenPct": 5.0}',
  'CRITICA', 'ESPERANDO_SUPERVISION', 85,
  '{"desvioDetectado": true, "insumo": "Paño Malla HDPE Virgen 1.5 pulgadas", "sobreconsumoKg": 50, "impactoFinancieroCLP": -260000, "requiereAprobacion": true}',
  TRUE, NULL, 'trace-prod-cost-202609-5501',
  NOW() - INTERVAL 20 MINUTE, NOW() - INTERVAL 15 MINUTE, NULL
),
(
  'task-coord-2026-004', 'client-retail-01', 'ag-prof-principal-01', 'ACCOUNTING_LEDGER', 'PREPARACION_PRE_CIERRE_F29',
  'Generación de Asiento Devengo IVA y PPM Provisorio Septiembre 2026',
  'El Agente Principal instruye al Agente Contable la preparación del asiento de centralización con firma de auditoría pericial inmutable.',
  '{"periodo": "2026-09", "ppmTasa": 0.015, "baseImponibleCLP": 152316842}',
  'ALTA', 'EN_PROCESO', 60,
  NULL,
  FALSE, NULL, 'trace-acct-f29-202609-9941',
  NOW() - INTERVAL 10 MINUTE, NOW() - INTERVAL 5 MINUTE, NULL
)
ON DUPLICATE KEY UPDATE `titulo_tarea` = VALUES(`titulo_tarea`), `progreso_pct` = VALUES(`progreso_pct`);

-- Mensajes en el Bus de Comunicación Inter-Agentes (A2A)
INSERT INTO `agent_inter_communications` (
  `id`, `empresa_id`, `task_id`, `agente_emisor`, `agente_receptor`, `tipo_mensaje`,
  `asunto`, `contenido_json`, `leido`, `fecha_emision`
)
VALUES
(
  'msg-a2a-001', 'client-retail-01', 'task-coord-2026-001', 'SII_RCV', 'MASTER_ORCHESTRATOR', 'REPORTE_RESULTADO',
  'Sincronización RCV Finalizada Exitosamente',
  '{"status": "OK", "documentosNuevos": 48, "totalDebitoCLP": 28940200, "totalCreditoCLP": 14280500, "mensaje": "Listos para centralización contable y determinación F29"}',
  TRUE, NOW() - INTERVAL 1 HOUR
),
(
  'msg-a2a-002', 'client-retail-01', 'task-coord-2026-004', 'MASTER_ORCHESTRATOR', 'ACCOUNTING_LEDGER', 'DELEGACION_TAREA',
  'Instrucción de Centralización de Compras y Ventas RCV en Libro Diario',
  '{"instruccion": "Generar asientos de débito y crédito fiscal con imputación a cuentas 2.1.03.01 y 1.1.06.01. Validar partida doble estricta.", "traceId": "trace-acct-f29-202609-9941"}',
  TRUE, NOW() - INTERVAL 10 MINUTE
),
(
  'msg-a2a-003', 'client-retail-01', 'task-coord-2026-003', 'PRODUCTION_COSTS', 'MASTER_ORCHESTRATOR', 'ALERTA_DISCREPANCIA',
  'Alerta de Sobreconsumo de Insumos en OP-2026-101',
  '{"alerta": "SOBRECONSUMO_MATERIAL", "insumoCodigo": "PAÑO-HDPE-1.5", "cantidadExtra": 50, "costoCLP": 260000, "solicitud": "Requiere ratificación de Jefe de Planta o Consultor Senior"}',
  FALSE, NOW() - INTERVAL 5 MINUTE
)
ON DUPLICATE KEY UPDATE `asunto` = VALUES(`asunto`), `leido` = VALUES(`leido`);

-- Respaldo Persistente de la Memoria Rápida / Capa Transitoria Redis
INSERT INTO `agent_transient_states` (
  `id`, `empresa_id`, `redis_key`, `tipo_cache`, `valor_json`, `ttl_segundos`, `expires_at`, `updated_at`
)
VALUES
(
  'state-red-01', 'client-retail-01', 'agent:master:session:client-retail-01', 'SESSION_AGENT',
  '{"empresaRut": "76.452.190-8", "estadoGlobal": "OPERATIVO_OPTIMO", "balanceCuadrado": true, "tareasActivas": 2, "alertasPendientes": 1}',
  86400, NOW() + INTERVAL 24 HOUR, NOW()
),
(
  'state-red-02', 'client-retail-01', 'lock:empresa:client-retail-01:f29-calculation', 'LOCK_DISTRIBUIDO',
  '{"lockedBy": "ag-prof-tributario-03", "acquiredAt": "2026-09-21T11:00:00Z", "fencingToken": 4209}',
  300, NOW() + INTERVAL 5 MINUTE, NOW()
),
(
  'state-red-03', 'client-retail-01', 'bullmq:queue:agent-rcv-sync:snapshot', 'QUEUE_SNAPSHOT',
  '{"waiting": 0, "active": 0, "completed": 512, "failed": 0, "redisEngine": "BullMQ-Redis-Cluster"}',
  3600, NOW() + INTERVAL 1 HOUR, NOW()
)
ON DUPLICATE KEY UPDATE `valor_json` = VALUES(`valor_json`), `updated_at` = NOW();

-- ============================================================================
-- 33. AGENTE DE ADMINISTRACIÓN DE RENDICIÓN DE GASTOS ("RINDE GASTOS AI")
-- ============================================================================
DROP TABLE IF EXISTS `expense_items`;
DROP TABLE IF EXISTS `expense_reports`;
DROP TABLE IF EXISTS `expense_projects`;

CREATE TABLE `expense_projects` (
  `id` VARCHAR(64) NOT NULL,
  `empresa_id` VARCHAR(64) NOT NULL,
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

CREATE TABLE `expense_reports` (
  `id` VARCHAR(64) NOT NULL,
  `empresa_id` VARCHAR(64) NOT NULL,
  `folio` VARCHAR(50) NOT NULL,
  `titulo` VARCHAR(255) NOT NULL,
  `rendidor_id` VARCHAR(64) NULL,
  `rendidor_nombre` VARCHAR(200) NOT NULL,
  `rendidor_rut` VARCHAR(20) NOT NULL,
  `rendidor_email` VARCHAR(255) NULL,
  `rendidor_cargo` VARCHAR(150) NULL,
  `centro_costo_id` VARCHAR(64) NULL,
  `centro_costo_codigo` VARCHAR(50) NULL,
  `centro_costo_nombre` VARCHAR(200) NULL,
  `proyecto_id` VARCHAR(64) NULL,
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
  `asiento_contable_id` VARCHAR(64) NULL,
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

CREATE TABLE `expense_items` (
  `id` VARCHAR(64) NOT NULL,
  `expense_report_id` VARCHAR(64) NOT NULL,
  `empresa_id` VARCHAR(64) NOT NULL,
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
  `centro_costo_id` VARCHAR(64) NULL,
  `centro_costo_codigo` VARCHAR(50) NULL,
  `proyecto_id` VARCHAR(64) NULL,
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

-- Semillas de Proyectos y Rendiciones
INSERT INTO `expense_projects` (`id`, `empresa_id`, `codigo`, `nombre`, `cliente_nombre`, `presupuesto_total_clp`, `activo`, `descripcion`, `created_at`)
VALUES
('pry-01', 'client-retail-01', 'PRY-QUELLON-26', 'Mantención Mayor Redes y Jaulas Balsas Quellón', 'Salmones Antártica S.A.', 45000000.00, TRUE, 'Servicio integral de instalación de fondeos y redes loberas.', NOW()),
('pry-02', 'client-retail-01', 'PRY-STGO-EXP', 'Expansión Comercial & Distribución Retail Santiago', 'Cencosud / Walmart Chile', 25000000.00, TRUE, 'Apertura de nuevos canales de congelados y mariscos en cadenas de supermercados.', NOW()),
('pry-03', 'client-retail-01', 'PRY-LOG-FLOTA', 'Habilitación Barcazas y Motores Fuera de Borda', 'Interno Flota Austral', 18000000.00, TRUE, 'Overhaul mecánico preventivo de barcazas Don Víctor y Mar Austral II.', NOW());

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
);

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
('item-05', 'rdg-002', 'client-retail-01', '2026-09-16', 'FACTURA_ELECTRONICA_33', 'F-78192', '76.992.110-3', 'Ferretería Industrial Austral Ltda.', 'MATERIALES_INSUMOS', 'Pernos de acero inox 316 y electrodos para balsas', 138655.00, 26345.00, 0.00, 165000.00, 'cc-03', 'CC-PRD-QUELLON', 'pry-01', 'PRY-QUELLON-26', '4.1.02.001', 'Materiales Menores & Consumibles', FALSE, TRUE, NOW());

-- Fin del script actualizado de inicialización MySQL para ERP Agéntico Multi-Proceso

