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
-- 4. TABLA: company_credentials_vault (Bóveda Segura AES-256-GCM)
-- ============================================================================
DROP TABLE IF EXISTS `company_credentials_vault`;
CREATE TABLE `company_credentials_vault` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `servicio` ENUM('SII_CERT_DIGITAL', 'SII_CLAVE_TRIBUTARIA', 'PREVIRED', 'BANCO_API', 'DT_MI_DIRECTORIO') NOT NULL,
  `encrypted_payload` TEXT NOT NULL,
  `iv` VARCHAR(64) NOT NULL,
  `auth_tag` VARCHAR(64) NOT NULL,
  `key_version` INT NOT NULL DEFAULT 1,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vault_empresa_servicio` (`empresa_id`, `servicio`),
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
  `modulo` VARCHAR(50) NOT NULL,
  `agente_nombre` VARCHAR(60) NOT NULL,
  `tipo_evento` ENUM('REGISTRO_ASIENTO', 'VALIDACION_NORMATIVA', 'DESCUADRE_DETECTADO', 'AUTO_CORRECCION', 'RECHAZO_SUPERVISOR', 'FIRMA_HMAC_APLICADA') NOT NULL,
  `payload_entrada` JSON NOT NULL,
  `resultado_validacion` JSON NOT NULL,
  `tiempo_inferencia_ms` INT NOT NULL DEFAULT 0,
  `supervisor_signature` VARCHAR(128) NOT NULL,
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
-- 12. TABLA: dtes_rcv (Registro de Compras y Ventas RCV SII)
-- ============================================================================
DROP TABLE IF EXISTS `dtes_rcv`;
CREATE TABLE `dtes_rcv` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `tipo_operacion` ENUM('VENTA', 'COMPRA') NOT NULL,
  `tipo_dte` INT NOT NULL, -- 33 (Factura), 34 (Exenta), 61 (Nota Crédito), 56 (Nota Débito), etc.
  `folio` BIGINT NOT NULL,
  `fecha_emision` DATE NOT NULL,
  `rut_contraparte` VARCHAR(20) NOT NULL,
  `razon_social_contraparte` VARCHAR(255) NOT NULL,
  `monto_exento` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_neto` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_iva` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_total` DECIMAL(15, 2) NOT NULL,
  `estado_sii` VARCHAR(50) NOT NULL DEFAULT 'ACEPTADO',
  `estado_contable` ENUM('PENDIENTE', 'CONTABILIZADO', 'RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',
  `acuse_recibo_ley19983` BOOLEAN NOT NULL DEFAULT FALSE,
  `fecha_acuse_recibo` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dte_registro` (`empresa_id`, `tipo_operacion`, `tipo_dte`, `folio`, `rut_contraparte`),
  KEY `idx_dte_empresa_fecha` (`empresa_id`, `fecha_emision`),
  KEY `idx_dte_estado_contable` (`estado_contable`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 13. TABLA: boletas_honorarios (BHE - Retención Legal 14.50% Vigente 2026)
-- ============================================================================
DROP TABLE IF EXISTS `boletas_honorarios`;
CREATE TABLE `boletas_honorarios` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `folio` BIGINT NOT NULL,
  `fecha_emision` DATE NOT NULL,
  `rut_prestador` VARCHAR(20) NOT NULL,
  `nombre_prestador` VARCHAR(255) NOT NULL,
  `bruto` DECIMAL(15, 2) NOT NULL,
  `tasa_retencion` DECIMAL(5, 4) NOT NULL DEFAULT 0.1450, -- 14.50% vigente en 2026 (Ley 21.133)
  `retencion` DECIMAL(15, 2) NOT NULL,
  `liquido` DECIMAL(15, 2) NOT NULL,
  `descripcion_servicio` TEXT NOT NULL,
  `estado_contable` ENUM('PENDIENTE', 'CONTABILIZADO', 'PAGADO') NOT NULL DEFAULT 'PENDIENTE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bhe_empresa_folio` (`empresa_id`, `folio`),
  KEY `idx_bhe_empresa_fecha` (`empresa_id`, `fecha_emision`)
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
-- 19. TABLA: f29_declarations (Declaraciones Mensuales de Impuestos F29 SII)
-- ============================================================================
DROP TABLE IF EXISTS `f29_declarations`;
CREATE TABLE `f29_declarations` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `periodo` VARCHAR(7) NOT NULL, -- Formato: 'AAAA-MM'
  `debito_fiscal` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `credito_fiscal` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `remanente_mes_anterior` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `remanente_mes_siguiente` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `iva_determinado` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `ppm_determinado` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `retenciones_segunda_categoria` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `total_a_pagar` DECIMAL(15, 2) NOT NULL,
  `estado` ENUM('BORRADOR', 'CALCULADO', 'VALIDADO_SUPERVISOR', 'ENVIADO_SII', 'PAGADO') NOT NULL DEFAULT 'BORRADOR',
  `folio_sii` BIGINT NULL,
  `casillas_json` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_f29_empresa_periodo` (`empresa_id`, `periodo`),
  KEY `idx_f29_empresa` (`empresa_id`)
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
  `total_trabajadores` INT NOT NULL,
  `total_liquido` DECIMAL(15, 2) NOT NULL,
  `total_imposiciones_previred` DECIMAL(15, 2) NOT NULL,
  `total_impuesto_unico` DECIMAL(15, 2) NOT NULL,
  `total_costo_empresa` DECIMAL(15, 2) NOT NULL,
  `centralizado_contable` BOOLEAN NOT NULL DEFAULT FALSE,
  `entry_id` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payroll_empresa_periodo` (`empresa_id`, `periodo`),
  KEY `idx_payroll_empresa` (`empresa_id`)
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
-- 28. TABLA: fixed_assets (Activos Fijos IFRS / NIC 16 y Art. 31/41 LIR Chile)
-- ============================================================================
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
  CONSTRAINT `fk_asset_asiento` FOREIGN KEY (`asiento_alta_id`) REFERENCES `accounting_entries` (`id`) ON DELETE SET NULL
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
-- 45. MÓDULO INGENIERÍA NAVAL Y ACUICULTURA CHILENA (RG 1821 / RG 941)
-- Detección de anomalías, auditoría 3D, inspección ROV/taller y trazabilidad
-- ============================================================================

-- 45.1 TABLA: aquaculture_centers (Centros de Cultivo de Salmónidos con Código RNA)
DROP TABLE IF EXISTS `aquaculture_anomalies`;
DROP TABLE IF EXISTS `aquaculture_inspections`;
DROP TABLE IF EXISTS `aquaculture_mooring_lines`;
DROP TABLE IF EXISTS `aquaculture_components`;
DROP TABLE IF EXISTS `aquaculture_nets`;
DROP TABLE IF EXISTS `aquaculture_drawings`;
DROP TABLE IF EXISTS `aquaculture_modules`;
DROP TABLE IF EXISTS `aquaculture_centers`;

CREATE TABLE `aquaculture_centers` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `codigo_rna` VARCHAR(20) NOT NULL, -- Código RNA Sernapesca ej: 102450
  `nombre_centro` VARCHAR(150) NOT NULL,
  `titular_nombre` VARCHAR(200) NOT NULL,
  `titular_rut` VARCHAR(20) NOT NULL,
  `region` VARCHAR(100) NOT NULL,
  `comuna` VARCHAR(100) NOT NULL,
  `agrupacion_concesiones_acs` VARCHAR(50) NULL,
  `coordenadas_utm_norte` DECIMAL(12, 2) NOT NULL,
  `coordenadas_utm_este` DECIMAL(12, 2) NOT NULL,
  `latitud` DECIMAL(10, 7) NULL,
  `longitud` DECIMAL(10, 7) NULL,
  `profundidad_media_metros` DECIMAL(6, 2) NOT NULL,
  `profundidad_maxima_metros` DECIMAL(6, 2) NOT NULL,
  `tipo_fondo_marino` ENUM('FANGO_BLANDO', 'ARENA_COMPACTA', 'ROCOSO', 'MIXTO') NOT NULL,
  `corriente_maxima_nudos` DECIMAL(5, 2) NOT NULL,
  `altura_ola_significativa_hs` DECIMAL(5, 2) NOT NULL,
  `memoria_calculo_fondeo_rg941_url` VARCHAR(500) NULL,
  `certificacion_naval_vigente` BOOLEAN NOT NULL DEFAULT TRUE,
  `fecha_vencimiento_certificado` DATE NULL,
  `estado_operativo` ENUM('EN_OPERACION', 'DESCANSO_SANITARIO', 'INSTALACION', 'MANTENCION') NOT NULL DEFAULT 'EN_OPERACION',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_centro_rna` (`codigo_rna`),
  KEY `idx_centro_empresa` (`empresa_id`),
  KEY `idx_centro_region` (`region`),
  CONSTRAINT `fk_centro_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 45.2 TABLA: aquaculture_modules (Trenes y Módulos de Balsas Jaulas)
CREATE TABLE `aquaculture_modules` (
  `id` VARCHAR(36) NOT NULL,
  `centro_id` VARCHAR(36) NOT NULL,
  `codigo_tren` VARCHAR(50) NOT NULL,
  `numero_jaulas` INT NOT NULL,
  `tipo_geometria` ENUM('CUADRADA_30X30', 'CUADRADA_40X40', 'CIRCULAR_D30', 'CIRCULAR_D40', 'RECTANGULAR') NOT NULL,
  `dimension_largo_m` DECIMAL(6, 2) NOT NULL,
  `dimension_ancho_m` DECIMAL(6, 2) NOT NULL,
  `material_pasillos` VARCHAR(100) NOT NULL DEFAULT 'HDPE Termofusionado Grado PE100',
  `azimut_orientacion_grados` DECIMAL(5, 1) NOT NULL DEFAULT 0.0,
  `posicion_relativa_x` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  `posicion_relativa_y` DECIMAL(8, 2) NOT NULL DEFAULT 0.00,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_modulo_codigo` (`centro_id`, `codigo_tren`),
  KEY `idx_modulo_centro` (`centro_id`),
  CONSTRAINT `fk_modulo_centro` FOREIGN KEY (`centro_id`) REFERENCES `aquaculture_centers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 45.3 TABLA: aquaculture_drawings (Ingesta de Planos de Ingeniería Naval en PDF/CAD)
CREATE TABLE `aquaculture_drawings` (
  `id` VARCHAR(36) NOT NULL,
  `centro_id` VARCHAR(36) NOT NULL,
  `tipo_plano` ENUM(
    'PLANO_GENERAL_CENTRO',
    'PLANO_FONDEO_BATIMETRIA',
    'PLANO_RED_PECERA',
    'PLANO_RED_LOBERA',
    'PLANO_SISTEMA_SEPARADORES',
    'PLANO_DETALLE_RELIÑAS_LASTRES'
  ) NOT NULL,
  `titulo_plano` VARCHAR(255) NOT NULL,
  `codigo_plano` VARCHAR(100) NOT NULL,
  `revision` VARCHAR(10) NOT NULL DEFAULT 'Rev.0',
  `ingeniero_naval_firma` VARCHAR(150) NOT NULL,
  `registro_colegio_naval` VARCHAR(50) NULL,
  `archivo_pdf_url` VARCHAR(500) NOT NULL,
  `archivo_cad_url` VARCHAR(500) NULL,
  `datos_ingeridos_json` JSON NULL,
  `modelo_3d_vertices_json` JSON NULL,
  `es_plano_oficial_vigente` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_plano_centro` (`centro_id`),
  KEY `idx_plano_tipo` (`tipo_plano`),
  CONSTRAINT `fk_plano_centro` FOREIGN KEY (`centro_id`) REFERENCES `aquaculture_centers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 45.4 TABLA: aquaculture_nets (Padrón de Redes Peceras y Loberas)
CREATE TABLE `aquaculture_nets` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `centro_id` VARCHAR(36) NULL,
  `modulo_id` VARCHAR(36) NULL,
  `codigo_red` VARCHAR(50) NOT NULL,
  `tipo_red` ENUM(
    'PECERA',
    'LOBERA_PERIMETRAL',
    'LOBERA_FONDO',
    'PAJARERA_TECHO',
    'SEGREGADOR_INTERNO'
  ) NOT NULL,
  `crotal_oficial_sernapesca` VARCHAR(50) NULL,
  `dimension_boca_m` DECIMAL(6, 2) NOT NULL,
  `dimension_profundidad_m` DECIMAL(6, 2) NOT NULL,
  `material_filamento` ENUM(
    'HDPE_ALTA_DENSIDAD',
    'NYLON_POLIAMIDA_PA6',
    'UHMWPE_ULTRA_RESISTENTE',
    'POLIESTER_ALTA_TENACIDAD',
    'ACERO_INOX_COPPER_ALLOY'
  ) NOT NULL,
  `tipo_tejido` ENUM('RASCHEL_SIN_NUDO', 'INGLES_CON_NUDO', 'TRENZADO_KNOTLESS') NOT NULL,
  `tamano_malla_pulgadas` DECIMAL(4, 2) NOT NULL,
  `denier_filamento` INT NULL,
  `carga_rotura_malla_kg` DECIMAL(6, 2) NOT NULL,
  `relinga_superior_cabo_mm` DECIMAL(5, 2) NOT NULL DEFAULT 24.00,
  `relinga_inferior_plomada_kg` DECIMAL(8, 2) NOT NULL DEFAULT 1200.00,
  `horas_inmersion_acumuladas` INT NOT NULL DEFAULT 0,
  `fecha_ultimo_bano_antifouling` DATE NULL,
  `taller_mantencion_ultimo` VARCHAR(150) NULL,
  `orden_produccion_origen_id` VARCHAR(36) NULL,
  `estado_conservacion` ENUM(
    'OPTIMO_NUEVO',
    'OPERATIVO_CONFORME',
    'OBSERVADO_REQUIERE_MANTENCION',
    'CRITICO_RIESGO_ROTURA',
    'EN_TALLER_REPARACION',
    'DADA_DE_BAJA'
  ) NOT NULL DEFAULT 'OPTIMO_NUEVO',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_red_codigo` (`empresa_id`, `codigo_red`),
  KEY `idx_red_crotal` (`crotal_oficial_sernapesca`),
  KEY `idx_red_centro` (`centro_id`),
  KEY `idx_red_estado` (`estado_conservacion`),
  CONSTRAINT `fk_red_centro` FOREIGN KEY (`centro_id`) REFERENCES `aquaculture_centers` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_red_modulo` FOREIGN KEY (`modulo_id`) REFERENCES `aquaculture_modules` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_red_op` FOREIGN KEY (`orden_produccion_origen_id`) REFERENCES `production_orders` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 45.5 TABLA: aquaculture_components (Separadores, Crotales y Lastres)
CREATE TABLE `aquaculture_components` (
  `id` VARCHAR(36) NOT NULL,
  `centro_id` VARCHAR(36) NOT NULL,
  `modulo_id` VARCHAR(36) NULL,
  `tipo_componente` ENUM(
    'SEPARADOR_PECERA_LOBERA',
    'CROTAL_TRAZABILIDAD_RG1821',
    'PESO_LASTRE_FONDO',
    'BOYA_TENSION_LOBERA',
    'GRILLETE_INSPECCIONADO',
    'TENSIOMETRO_LINEA'
  ) NOT NULL,
  `codigo_identificador` VARCHAR(50) NOT NULL,
  `separacion_real_metros` DECIMAL(5, 2) NULL,
  `separacion_normativa_minima_m` DECIMAL(5, 2) NULL DEFAULT 1.50,
  `material` VARCHAR(100) NOT NULL,
  `peso_kg` DECIMAL(8, 2) NULL,
  `posicion_jaula_cara` ENUM('NORTE', 'SUR', 'ESTE', 'OESTE', 'ESQUINA_NE', 'ESQUINA_NO', 'ESQUINA_SE', 'ESQUINA_SO', 'FONDO') NOT NULL,
  `estado_normativo` ENUM('CONFORME_RG1821', 'EN_RIESGO_CONTACTO', 'COLAPSADO_ROTURA', 'EXTRAVIADO') NOT NULL DEFAULT 'CONFORME_RG1821',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_componente_centro` (`centro_id`),
  KEY `idx_componente_tipo` (`tipo_componente`),
  CONSTRAINT `fk_comp_centro` FOREIGN KEY (`centro_id`) REFERENCES `aquaculture_centers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_comp_modulo` FOREIGN KEY (`modulo_id`) REFERENCES `aquaculture_modules` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 45.6 TABLA: aquaculture_mooring_lines (Líneas de Fondeo y Fondeaderos RG 941)
CREATE TABLE `aquaculture_mooring_lines` (
  `id` VARCHAR(36) NOT NULL,
  `centro_id` VARCHAR(36) NOT NULL,
  `codigo_linea` VARCHAR(50) NOT NULL,
  `cuadrante_geografico` ENUM('NORTE', 'SUR', 'ESTE', 'OESTE', 'NORESTE', 'NOROESTE', 'SURESTE', 'SUROESTE') NOT NULL,
  `longitud_total_metros` DECIMAL(8, 2) NOT NULL,
  `tipo_anclaje` ENUM('BLOQUE_HORMIGON_MUERTO', 'ANCLA_STEVPRIS', 'ANCLA_DANFORTH', 'PASADOR_ROCA_MICROPOZOS') NOT NULL,
  `peso_anclaje_toneladas` DECIMAL(6, 2) NOT NULL,
  `diametro_cabo_principal_mm` DECIMAL(6, 2) NOT NULL,
  `material_cabo` VARCHAR(100) NOT NULL DEFAULT 'Polipropileno Virgen 8 Cordones Multifilamento',
  `tramo_cadena_grado_mm` VARCHAR(100) NOT NULL DEFAULT 'Cadena Grado 2 D=32mm 15m fondo',
  `carga_rotura_certificada_mbl_tn` DECIMAL(6, 2) NOT NULL,
  `factor_seguridad_diseno` DECIMAL(4, 2) NOT NULL DEFAULT 2.50,
  `tension_trabajo_estimada_ton` DECIMAL(6, 2) NOT NULL,
  `ultima_inspeccion_acustica_fecha` DATE NULL,
  `estado_estructural` ENUM('APTO_OPERACION', 'TENSION_ANORMAL', 'CORROSION_CADENA_AVANZADA', 'DESPLAZAMIENTO_MUERTO', 'REEMPLAZO_INMEDIATO') NOT NULL DEFAULT 'APTO_OPERACION',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_linea_codigo` (`centro_id`, `codigo_linea`),
  KEY `idx_linea_centro` (`centro_id`),
  CONSTRAINT `fk_mooring_centro` FOREIGN KEY (`centro_id`) REFERENCES `aquaculture_centers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 45.7 TABLA: aquaculture_inspections (Inspecciones Submarinas ROV y Taller de Redes)
CREATE TABLE `aquaculture_inspections` (
  `id` VARCHAR(36) NOT NULL,
  `centro_id` VARCHAR(36) NOT NULL,
  `fecha_inspeccion` DATE NOT NULL,
  `tipo_inspeccion` ENUM(
    'ROV_SUBMARINA_ROBOTICA',
    'TALLER_REDES_RECEPCION',
    'TALLER_REDES_POST_LAVADO',
    'FONDEO_BATIMETRIA_ACUSTICA',
    'AUDITORIA_PERICIAL_SERNAPESCA'
  ) NOT NULL,
  `inspector_naval_nombre` VARCHAR(150) NOT NULL,
  `matricula_armada_o_identificacion` VARCHAR(50) NOT NULL,
  `empresa_certificadora` VARCHAR(150) NOT NULL,
  `robot_rov_modelo` VARCHAR(100) NULL,
  `profundidad_maxima_alcanzada_m` DECIMAL(6, 2) NOT NULL,
  `total_horas_grabacion` DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
  `total_fotografias_analizadas` INT NOT NULL DEFAULT 0,
  `total_anomalias_detectadas` INT NOT NULL DEFAULT 0,
  `anomalias_criticas_rg1821` INT NOT NULL DEFAULT 0,
  `dictamen_conformidad` ENUM(
    'CONFORME_100_NORMATIVO',
    'CONFORME_CON_OBSERVACIONES_MENORES',
    'NO_CONFORME_CRITICO_REQUIERE_ACCION_INMEDIATA',
    'CLAUSURA_PREVENTIVA_JAULA'
  ) NOT NULL,
  `video_evidencia_url` VARCHAR(500) NULL,
  `informe_tecnico_pdf_url` VARCHAR(500) NULL,
  `observaciones_tecnicas` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_inspeccion_centro_fecha` (`centro_id`, `fecha_inspeccion`),
  KEY `idx_inspeccion_dictamen` (`dictamen_conformidad`),
  CONSTRAINT `fk_insp_centro` FOREIGN KEY (`centro_id`) REFERENCES `aquaculture_centers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 45.8 TABLA: aquaculture_anomalies (Mapeo de Anomalías y Roturas sobre Modelo 3D)
CREATE TABLE `aquaculture_anomalies` (
  `id` VARCHAR(36) NOT NULL,
  `inspeccion_id` VARCHAR(36) NOT NULL,
  `centro_id` VARCHAR(36) NOT NULL,
  `modulo_id` VARCHAR(36) NULL,
  `net_id` VARCHAR(36) NULL,
  `tipo_anomalia` ENUM(
    'ROTURA_MALLA_CORTE_FILAMENTO',
    'DESGASTE_POR_ABRASION_ROCE',
    'CORTE_CABO_RELINGA',
    'PERDIDA_CROTAL_TRAZABILIDAD',
    'FALLA_SEPARADOR_CONTACTO_REDES',
    'DESPRENDIMIENTO_LASTRE_FONDO',
    'FATIGA_FONDEO_GRILLADA',
    'INCUMPLIMIENTO_NORMATIVO_RG1821',
    'INCUMPLIMIENTO_NORMATIVO_RG941'
  ) NOT NULL,
  `nivel_criticidad` ENUM(
    'LEVE_MONITOREO',
    'MEDIA_PROGRAMAR_TALLER',
    'CRITICA_ALTO_RIESGO_ESCAPE_SALMONES',
    'EMERGENCIA_ACCION_SUBMARINA_INMEDIATA'
  ) NOT NULL,
  `tamano_abertura_cm` DECIMAL(6, 2) NULL DEFAULT 0.00,
  `numero_mallas_cortadas` INT NULL DEFAULT 0,
  -- Coordenadas Tridimensionales Espaciales relativas a la Jaula (en metros)
  `coordenada_relativa_x` DECIMAL(6, 2) NOT NULL,
  `coordenada_relativa_y` DECIMAL(6, 2) NOT NULL,
  `profundidad_z_metros` DECIMAL(6, 2) NOT NULL,
  `cara_jaula` ENUM('NORTE', 'SUR', 'ESTE', 'OESTE', 'FONDO_PLANCHA', 'RELINGA_SUPERIOR', 'CABO_FONDEO') NOT NULL,
  `fotograma_evidencia_url` VARCHAR(500) NOT NULL,
  `timestamp_video_segundo` INT NULL,
  `orden_produccion_reparacion_id` VARCHAR(36) NULL,
  `estado_reparacion` ENUM(
    'DETECTADA_PENDIENTE',
    'REPARADA_IN_SITU_BUZO',
    'REPARADA_EN_TALLER_REDERIA',
    'VALIDADA_POR_INSPECTOR_NAVAL',
    'DESESTIMADA_FALSO_POSITIVO'
  ) NOT NULL DEFAULT 'DETECTADA_PENDIENTE',
  `fecha_reparacion` DATE NULL,
  `observacion_naval` TEXT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_anomalia_inspeccion` (`inspeccion_id`),
  KEY `idx_anomalia_centro` (`centro_id`),
  KEY `idx_anomalia_criticidad` (`nivel_criticidad`),
  KEY `idx_anomalia_estado` (`estado_reparacion`),
  CONSTRAINT `fk_anom_inspeccion` FOREIGN KEY (`inspeccion_id`) REFERENCES `aquaculture_inspections` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_anom_centro` FOREIGN KEY (`centro_id`) REFERENCES `aquaculture_centers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_anom_modulo` FOREIGN KEY (`modulo_id`) REFERENCES `aquaculture_modules` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_anom_net` FOREIGN KEY (`net_id`) REFERENCES `aquaculture_nets` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_anom_op` FOREIGN KEY (`orden_produccion_reparacion_id`) REFERENCES `production_orders` (`id`) ON DELETE SET NULL
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
  'client-innovagile', 'firm-001-audicon', '77.210.980-5', 'InnovAgile Software SpA',
  'Desarrollo de software y servicios cloud', '14_D8',
  0.0025, 12, 31, 2026,
  '2026-01-01', '2026-12-31', '["2025-12"]',
  TRUE, 65000000.00, 2.50,
  FALSE, NOW()
)
ON DUPLICATE KEY UPDATE `razon_social` = VALUES(`razon_social`), `mes_cierre_ejercicio` = VALUES(`mes_cierre_ejercicio`);

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

-- Activo Fijo Semilla
INSERT INTO `fixed_assets` (
  `id`, `empresa_id`, `codigo_placa`, `nombre`, `categoria`, `fecha_adquisicion`,
  `proveedor_rut`, `proveedor_razon_social`, `folio_dte_compra`, `valor_adquisicion_original`,
  `valor_residual_financiero`, `vida_util_meses_financiera`, `vida_util_meses_tributaria`,
  `meses_depreciados`, `vida_util_restante_meses`, `metodo_depreciacion`,
  `depreciacion_acumulada_financiera`, `valor_libro_financiero`, `cuota_depreciacion_mensual_financiera`,
  `factor_correccion_monetaria_acum`, `correccion_monetaria_acumulada`,
  `depreciacion_acumulada_tributaria`, `valor_tributario_neto`, `cuota_depreciacion_mensual_tributaria`,
  `ubicacion_fisica`, `responsable_custodio`, `estado`, `numero_serie`, `marca_modelo`,
  `es_fabril_produccion`, `created_at`
)
VALUES (
  'af-001', 'client-retail-01', 'AF-2026-001', 'Grúa Horquilla Eléctrica Yale 2.5T',
  'MAQUINARIA_INDUSTRIAL', '2026-01-15', '76.888.999-1', 'Yale Material Handling Chile SpA',
  8820, 24500000.00, 1000000.00, 84, 36, 8, 76, 'LINEAL_RECTA',
  2238095.24, 22261904.76, 279761.90, 0.006000, 133571.43,
  5222222.22, 19277777.78, 652777.78, 'Bodega Central San Bernardo',
  'Marcelo Gallardo - Jefe Operaciones', 'ACTIVO_OPERATIVO', 'YALE-EL25-98302',
  'Yale ERP25VL 2026', FALSE, NOW()
)
ON DUPLICATE KEY UPDATE `nombre` = VALUES(`nombre`);

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
-- 46.2 DATOS SEMILLA: INGENIERÍA NAVAL Y ACUICULTURA (RG 1821 / RG 941)
-- ============================================================================

-- Centros de Cultivo de Salmónidos con Código RNA Oficial
INSERT INTO `aquaculture_centers` (
  `id`, `empresa_id`, `codigo_rna`, `nombre_centro`, `titular_nombre`, `titular_rut`,
  `region`, `comuna`, `agrupacion_concesiones_acs`, `coordenadas_utm_norte`, `coordenadas_utm_este`,
  `latitud`, `longitud`, `profundidad_media_metros`, `profundidad_maxima_metros`,
  `tipo_fondo_marino`, `corriente_maxima_nudos`, `altura_ola_significativa_hs`,
  `memoria_calculo_fondeo_rg941_url`, `certificacion_naval_vigente`, `fecha_vencimiento_certificado`,
  `estado_operativo`, `created_at`
)
VALUES
(
  'centro-rna-102450', 'client-retail-01', '102450', 'Centro Punta Pilluco', 'Salmones del Fiordo Reloncaví S.A.', '76.320.440-1',
  'Región de Los Lagos', 'Hornopirén', 'ACS 17A', 5354200.00, 684300.00,
  -41.9324000, -72.4821000, 48.50, 72.00,
  'FANGO_BLANDO', 1.85, 2.10,
  'https://storage.armada.cl/fondeos/102450_memoria_rg941.pdf', TRUE, '2027-06-30',
  'EN_OPERACION', NOW()
),
(
  'centro-rna-103890', 'client-retail-01', '103890', 'Centro Canal Lemuy - Cheniao', 'Chiloé Pesquera & Salmon SpA', '76.452.190-8',
  'Región de Los Lagos', 'Puqueldón / Quellón', 'ACS 18B', 5289100.00, 621450.00,
  -42.5412000, -73.6120000, 36.00, 55.00,
  'ARENA_COMPACTA', 2.40, 2.80,
  'https://storage.armada.cl/fondeos/103890_memoria_rg941.pdf', TRUE, '2027-11-15',
  'EN_OPERACION', NOW()
)
ON DUPLICATE KEY UPDATE `nombre_centro` = VALUES(`nombre_centro`);

-- Módulos y Trenes de Jaulas
INSERT INTO `aquaculture_modules` (
  `id`, `centro_id`, `codigo_tren`, `numero_jaulas`, `tipo_geometria`,
  `dimension_largo_m`, `dimension_ancho_m`, `material_pasillos`,
  `azimut_orientacion_grados`, `posicion_relativa_x`, `posicion_relativa_y`, `created_at`
)
VALUES
(
  'mod-pilluco-tren-norte', 'centro-rna-102450', 'TREN-NORTE-01', 8, 'CUADRADA_30X30',
  120.00, 60.00, 'HDPE Termofusionado PE100 con Pasillos Antideslizantes',
  315.0, 0.00, 0.00, NOW()
),
(
  'mod-pilluco-tren-sur', 'centro-rna-102450', 'TREN-SUR-02', 8, 'CUADRADA_30X30',
  120.00, 60.00, 'HDPE Termofusionado PE100 con Pasillos Antideslizantes',
  315.0, 0.00, 90.00, NOW()
)
ON DUPLICATE KEY UPDATE `codigo_tren` = VALUES(`codigo_tren`);

-- Planos de Ingeniería Naval Ingeridos
INSERT INTO `aquaculture_drawings` (
  `id`, `centro_id`, `tipo_plano`, `titulo_plano`, `codigo_plano`, `revision`,
  `ingeniero_naval_firma`, `registro_colegio_naval`, `archivo_pdf_url`,
  `datos_ingeridos_json`, `modelo_3d_vertices_json`, `es_plano_oficial_vigente`, `created_at`
)
VALUES
(
  'plano-pilluco-gen-01', 'centro-rna-102450', 'PLANO_GENERAL_CENTRO',
  'Plano General Disposición de Módulos y Trenes de Cultivo RNA 102450', 'PLN-NAV-102450-G01', 'Rev.3',
  'Ing. Naval Christian E. Heins (UACH Valdivia)', 'CIN-CHILE-3942',
  'https://archivos-acuicultura.cl/planos/PLN-NAV-102450-G01-Rev3.pdf',
  '{"trenes": 2, "jaulas_totales": 16, "dimension_jaula": "30x30m", "espacio_entre_trenes_m": 90, "azimut": 315}',
  '{"vertices": [{"x":0,"y":0,"z":0},{"x":30,"y":0,"z":0},{"x":30,"y":30,"z":0},{"x":0,"y":30,"z":0},{"x":0,"y":0,"z":-15},{"x":30,"y":0,"z":-15},{"x":30,"y":30,"z":-15},{"x":0,"y":30,"z":-15}]}',
  TRUE, NOW()
),
(
  'plano-pilluco-red-02', 'centro-rna-102450', 'PLANO_RED_PECERA',
  'Memoria y Plano Estructural Red Pecera HDPE 30x30x15m Reforzada', 'PLN-RED-303015-PE', 'Rev.2',
  'Ing. Naval Christian E. Heins (UACH Valdivia)', 'CIN-CHILE-3942',
  'https://archivos-acuicultura.cl/planos/PLN-RED-303015-PE-Rev2.pdf',
  '{"malla": "1.5 pulgadas", "material": "HDPE Virgen", "relinga_superior": "24mm", "lastre_fondo_kg": 1200, "carga_rotura_kg": 185}',
  '{"malla_3d": {"caras": ["Norte", "Sur", "Este", "Oeste", "Fondo"], "profundidad_m": 15.0}}',
  TRUE, NOW()
)
ON DUPLICATE KEY UPDATE `titulo_plano` = VALUES(`titulo_plano`);

-- Redes Peceras y Loberas con Crotales Oficiales RG 1821
INSERT INTO `aquaculture_nets` (
  `id`, `empresa_id`, `centro_id`, `modulo_id`, `codigo_red`, `tipo_red`,
  `crotal_oficial_sernapesca`, `dimension_boca_m`, `dimension_profundidad_m`,
  `material_filamento`, `tipo_tejido`, `tamano_malla_pulgadas`, `denier_filamento`,
  `carga_rotura_malla_kg`, `relinga_superior_cabo_mm`, `relinga_inferior_plomada_kg`,
  `horas_inmersion_acumuladas`, `fecha_ultimo_bano_antifouling`, `taller_mantencion_ultimo`,
  `orden_produccion_origen_id`, `estado_conservacion`, `created_at`
)
VALUES
(
  'net-pecera-j01', 'client-retail-01', 'centro-rna-102450', 'mod-pilluco-tren-norte',
  'RED-PEC-TN-J01', 'PECERA', 'CRT-SERNA-2026-08819', 30.00, 15.00,
  'HDPE_ALTA_DENSIDAD', 'RASCHEL_SIN_NUDO', 1.50, 21048, 185.00, 24.00, 1200.00,
  2480, '2026-05-10', 'Taller Redería Austral Puerto Montt', 'op-2026-101',
  'OPERATIVO_CONFORME', NOW()
),
(
  'net-lobera-j01', 'client-retail-01', 'centro-rna-102450', 'mod-pilluco-tren-norte',
  'RED-LOB-TN-J01', 'LOBERA_PERIMETRAL', 'CRT-SERNA-2026-09402', 34.00, 18.00,
  'UHMWPE_ULTRA_RESISTENTE', 'TRENZADO_KNOTLESS', 8.00, 42080, 850.00, 32.00, 2500.00,
  4200, '2026-01-15', 'Taller Redería Austral Puerto Montt', NULL,
  'OPERATIVO_CONFORME', NOW()
)
ON DUPLICATE KEY UPDATE `codigo_red` = VALUES(`codigo_red`);

-- Separadores Pecera-Lobera y Componentes RG 1821
INSERT INTO `aquaculture_components` (
  `id`, `centro_id`, `modulo_id`, `tipo_componente`, `codigo_identificador`,
  `separacion_real_metros`, `separacion_normativa_minima_m`, `material`,
  `peso_kg`, `posicion_jaula_cara`, `estado_normativo`, `created_at`
)
VALUES
(
  'comp-sep-01', 'centro-rna-102450', 'mod-pilluco-tren-norte', 'SEPARADOR_PECERA_LOBERA', 'SEP-TN-J01-OESTE',
  1.85, 1.50, 'Tubería HDPE D=110mm Rígida con Grilletes Inox 316', 42.00, 'OESTE', 'CONFORME_RG1821', NOW()
),
(
  'comp-sep-02', 'centro-rna-102450', 'mod-pilluco-tren-norte', 'SEPARADOR_PECERA_LOBERA', 'SEP-TN-J01-NORTE',
  1.10, 1.50, 'Tubería HDPE D=110mm Rígida con Grilletes Inox 316', 42.00, 'NORTE', 'EN_RIESGO_CONTACTO', NOW()
),
(
  'comp-lastre-01', 'centro-rna-102450', 'mod-pilluco-tren-norte', 'PESO_LASTRE_FONDO', 'LST-TN-J01-ESQ-SO',
  NULL, 1.50, 'Bloque de Plomo Forrado en Goma de Alta Resistencia', 350.00, 'ESQUINA_SO', 'CONFORME_RG1821', NOW()
)
ON DUPLICATE KEY UPDATE `codigo_identificador` = VALUES(`codigo_identificador`);

-- Líneas de Fondeo RG 941
INSERT INTO `aquaculture_mooring_lines` (
  `id`, `centro_id`, `codigo_linea`, `cuadrante_geografico`, `longitud_total_metros`,
  `tipo_anclaje`, `peso_anclaje_toneladas`, `diametro_cabo_principal_mm`,
  `material_cabo`, `tramo_cadena_grado_mm`, `carga_rotura_certificada_mbl_tn`,
  `factor_seguridad_diseno`, `tension_trabajo_estimada_ton`,
  `ultima_inspeccion_acustica_fecha`, `estado_estructural`, `created_at`
)
VALUES
(
  'moor-nw-01', 'centro-rna-102450', 'FONDEO-NW-01', 'NOROESTE', 240.00,
  'BLOQUE_HORMIGON_MUERTO', 15.00, 64.00,
  'Polipropileno Virgen 8 Cordones Multifilamento', 'Cadena Grado 2 D=38mm tramo 20m fondo', 85.00,
  2.85, 22.40, '2026-07-20', 'APTO_OPERACION', NOW()
),
(
  'moor-se-02', 'centro-rna-102450', 'FONDEO-SE-02', 'SURESTE', 220.00,
  'ANCLA_STEVPRIS', 5.00, 64.00,
  'Polipropileno Virgen 8 Cordones Multifilamento', 'Cadena Grado 3 D=32mm tramo 25m fondo', 92.00,
  3.10, 19.80, '2026-07-20', 'APTO_OPERACION', NOW()
)
ON DUPLICATE KEY UPDATE `codigo_linea` = VALUES(`codigo_linea`);

-- Inspección Submarina ROV y Taller
INSERT INTO `aquaculture_inspections` (
  `id`, `centro_id`, `fecha_inspeccion`, `tipo_inspeccion`,
  `inspector_naval_nombre`, `matricula_armada_o_identificacion`, `empresa_certificadora`,
  `robot_rov_modelo`, `profundidad_maxima_alcanzada_m`, `total_horas_grabacion`,
  `total_fotografias_analizadas`, `total_anomalias_detectadas`, `anomalias_criticas_rg1821`,
  `dictamen_conformidad`, `video_evidencia_url`, `informe_tecnico_pdf_url`,
  `observaciones_tecnicas`, `created_at`
)
VALUES
(
  'insp-rov-2026-0912', 'centro-rna-102450', '2026-09-12', 'ROV_SUBMARINA_ROBOTICA',
  'Sebastián Bahamonde Cárdenas (Piloto ROV)', 'MAT-ARMADA-7419-PMO', 'Austral Robotic Subsea Surveys SpA',
  'BlueROV2 Heavy HD 4K Sonar Micron', 18.50, 3.50,
  142, 3, 1,
  'NO_CONFORME_CRITICO_REQUIERE_ACCION_INMEDIATA',
  'https://storage.inspecciones.cl/videos/ROV-102450-20260912-4K.mp4',
  'https://storage.inspecciones.cl/informes/INF-TEC-ROV-102450-0912.pdf',
  'Inspección pericial en Jaula 01 Tren Norte detecta rotura de malla por desgarro en paño lateral cara Oeste a -8.5 metros de profundidad. Separador norte presenta inclinación con distancia a lobera reducida a 1.10m (incumple mínimo 1.50m RG 1821).',
  NOW()
)
ON DUPLICATE KEY UPDATE `inspector_naval_nombre` = VALUES(`inspector_naval_nombre`);

-- Mapeo 3D de Anomalías y Roturas Detectadas
INSERT INTO `aquaculture_anomalies` (
  `id`, `inspeccion_id`, `centro_id`, `modulo_id`, `net_id`,
  `tipo_anomalia`, `nivel_criticidad`, `tamano_abertura_cm`, `numero_mallas_cortadas`,
  `coordenada_relativa_x`, `coordenada_relativa_y`, `profundidad_z_metros`,
  `cara_jaula`, `fotograma_evidencia_url`, `timestamp_video_segundo`,
  `orden_produccion_reparacion_id`, `estado_reparacion`, `fecha_reparacion`,
  `observacion_naval`, `created_at`
)
VALUES
(
  'anom-rotura-01', 'insp-rov-2026-0912', 'centro-rna-102450', 'mod-pilluco-tren-norte', 'net-pecera-j01',
  'ROTURA_MALLA_CORTE_FILAMENTO', 'CRITICA_ALTO_RIESGO_ESCAPE_SALMONES', 24.50, 6,
  15.20, 0.00, -8.50,
  'OESTE', 'https://storage.inspecciones.cl/evidencias/ANOM-102450-ROTURA-8M5-OESTE.jpg', 1845,
  'op-2026-101', 'DETECTADA_PENDIENTE', NULL,
  'Corte limpio de 6 mallas consecutivas con apertura elástica de 24.5 cm en paño HDPE lateral a 8.5 metros de profundidad. Alerta inmediata Sernapesca según protocolo RG 1821 para evitar escape de peces.',
  NOW()
),
(
  'anom-separador-02', 'insp-rov-2026-0912', 'centro-rna-102450', 'mod-pilluco-tren-norte', 'net-pecera-j01',
  'FALLA_SEPARADOR_CONTACTO_REDES', 'MEDIA_PROGRAMAR_TALLER', 0.00, 0,
  15.00, 30.00, -6.00,
  'NORTE', 'https://storage.inspecciones.cl/evidencias/ANOM-102450-SEP-NORTE.jpg', 2420,
  NULL, 'DETECTADA_PENDIENTE', NULL,
  'Separador HDPE con deformación angular por tensión de corrientes submarinas. Separación efectiva medida con sónar láser es 1.10 metros, inferior a los 1.50 metros mínimos obligatorios estipulados en la RG 1821.',
  NOW()
),
(
  'anom-relinga-03', 'insp-rov-2026-0912', 'centro-rna-102450', 'mod-pilluco-tren-norte', 'net-pecera-j01',
  'DESGASTE_POR_ABRASION_ROCE', 'LEVE_MONITOREO', 0.00, 0,
  2.40, 0.00, -1.20,
  'RELINGA_SUPERIOR', 'https://storage.inspecciones.cl/evidencias/ANOM-102450-ROCE-PASILLO.jpg', 615,
  NULL, 'DETECTADA_PENDIENTE', NULL,
  'Abrasión superficial en protección de cabo de relinga superior por roce contra estructura flotante de pasillo HDPE en esquina Noroeste. Sin compromiso de carga de rotura.',
  NOW()
)
ON DUPLICATE KEY UPDATE `observacion_naval` = VALUES(`observacion_naval`);

-- Fin del script actualizado de inicialización MySQL

