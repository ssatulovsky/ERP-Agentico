-- ============================================================================
-- ESQUEMA COMPLETO Y DEFINITIVO DE BASE DE DATOS MYSQL 8.0
-- SISTEMA ERP CONTABLE CHILENO CON GOBERNANZA AGÉNTICA E IFRS
-- Archivo: scripts/init_mysql_database.sql
-- Motor: InnoDB | Charset: utf8mb4 | Collation: utf8mb4_unicode_ci
-- ============================================================================

-- 1. CREACIÓN Y SELECCIÓN DE LA BASE DE DATOS
CREATE DATABASE IF NOT EXISTS `chile_erp` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `chile_erp`;

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- 2. TABLA: accounting_firms (Nivel 1: Estudio Contable / Multi-Tenant Principal)
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
-- 3. TABLA: companies (Nivel 2: Empresa Cliente del Estudio)
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
  `es_cliente_ancla` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_companies_firm_id` (`firm_id`),
  KEY `idx_companies_rut` (`rut`),
  UNIQUE KEY `uq_companies_firm_rut` (`firm_id`, `rut`),
  CONSTRAINT `fk_companies_firm` FOREIGN KEY (`firm_id`) REFERENCES `accounting_firms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. TABLA: company_module_subscriptions (Nivel 3: Suscripción por Módulo)
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
    'IFRS16_LEASES',
    'MARKETING_AGENT',
    'CUSTOMER_SERVICE_AI'
  ) NOT NULL,
  `pagado_por` ENUM('ESTUDIO', 'CLIENTE_DIRECTO') NOT NULL DEFAULT 'ESTUDIO',
  `estado` ENUM('ACTIVO', 'SUSPENDIDO') NOT NULL DEFAULT 'ACTIVO',
  `fecha_renovacion` DATE NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_company_modulo` (`empresa_id`, `modulo_codigo`),
  KEY `idx_subscription_empresa` (`empresa_id`),
  CONSTRAINT `fk_subscription_company` FOREIGN KEY (`empresa_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. TABLA: company_credentials_vault (Bóveda Criptográfica AES-256-GCM)
-- ============================================================================
DROP TABLE IF EXISTS `company_credentials_vault`;
CREATE TABLE `company_credentials_vault` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `certificado_digital_encrypted` TEXT NULL,
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
-- 6. TABLA: chart_of_accounts (Plan de Cuentas IFRS Chile)
-- ============================================================================
DROP TABLE IF EXISTS `chart_of_accounts`;
CREATE TABLE `chart_of_accounts` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `codigo_cuenta` VARCHAR(30) NOT NULL,
  `nombre_cuenta` VARCHAR(200) NOT NULL,
  `clasificacion` ENUM(
    'ACTIVO',
    'PASIVO',
    'PATRIMONIO',
    'INGRESOS',
    'COSTOS',
    'GASTOS'
  ) NOT NULL,
  `acepta_auxiliar` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_chart_empresa_codigo` (`empresa_id`, `codigo_cuenta`),
  KEY `idx_chart_clasificacion` (`empresa_id`, `clasificacion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. TABLA: accounting_entries (Cabecera Libro Diario General Ledger)
-- ============================================================================
DROP TABLE IF EXISTS `accounting_entries`;
CREATE TABLE `accounting_entries` (
  `id` VARCHAR(36) NOT NULL,
  `firm_id` VARCHAR(36) NOT NULL DEFAULT 'firm-default-001',
  `empresa_id` VARCHAR(36) NOT NULL,
  `periodo` VARCHAR(7) NOT NULL,
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
-- 8. TABLA: accounting_entry_lines (Partidas Contables con Integridad Referencial)
-- ============================================================================
DROP TABLE IF EXISTS `accounting_entry_lines`;
CREATE TABLE `accounting_entry_lines` (
  `id` VARCHAR(36) NOT NULL,
  `entry_id` VARCHAR(36) NOT NULL,
  `linea_numero` INT NOT NULL DEFAULT 1,
  `codigo_cuenta` VARCHAR(30) NOT NULL,
  `nombre_cuenta` VARCHAR(200) NOT NULL,
  `debe` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `haber` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `rut_auxiliar` VARCHAR(20) NULL,
  `centro_costo` VARCHAR(100) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_lines_entry_id` (`entry_id`),
  KEY `idx_lines_cuenta_rut` (`codigo_cuenta`, `rut_auxiliar`),
  CONSTRAINT `fk_lines_entry` FOREIGN KEY (`entry_id`) REFERENCES `accounting_entries` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 9. TABLA: agent_audit_logs (Bitácora Forense de Auditoría Agéntica Inmutable)
-- ============================================================================
DROP TABLE IF EXISTS `agent_audit_logs`;
CREATE TABLE `agent_audit_logs` (
  `id` VARCHAR(36) NOT NULL,
  `trace_id` VARCHAR(64) NOT NULL,
  `firm_id` VARCHAR(36) NOT NULL DEFAULT 'firm-default-001',
  `empresa_id` VARCHAR(36) NOT NULL,
  `agente_nombre` VARCHAR(60) NOT NULL,
  `modulo` VARCHAR(60) NOT NULL DEFAULT 'CONTABILIDAD',
  `accion` VARCHAR(100) NOT NULL,
  `estado_transicion` VARCHAR(50) NOT NULL,
  `prompt_tokens` INT NULL,
  `completion_tokens` INT NULL,
  `model_name` VARCHAR(50) NULL,
  `prompt_hash` VARCHAR(64) NULL,
  `payload_input` JSON NOT NULL,
  `payload_output` JSON NOT NULL,
  `diff_contable` JSON NULL,
  `supervisor_veredicto` VARCHAR(50) NULL,
  `supervisor_signature` VARCHAR(128) NULL,
  `tiempo_ejecucion_ms` INT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_audit_trace` (`trace_id`),
  KEY `idx_audit_empresa_created` (`empresa_id`, `created_at`),
  KEY `idx_audit_firm` (`firm_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 10. TABLA: economic_indicators (Sincronización Diaria de Indicadores Chilenos)
-- ============================================================================
DROP TABLE IF EXISTS `economic_indicators`;
CREATE TABLE `economic_indicators` (
  `id` INT AUTO_INCREMENT NOT NULL,
  `codigo` VARCHAR(10) NOT NULL,
  `valor` DECIMAL(12, 4) NOT NULL,
  `fecha` DATE NOT NULL,
  `fuente` VARCHAR(50) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_indicador_fecha_codigo` (`fecha`, `codigo`),
  KEY `idx_indicadores_busqueda` (`codigo`, `fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 11. TABLA: dtes_rcv (Registro de Compras y Ventas del SII)
-- ============================================================================
DROP TABLE IF EXISTS `dtes_rcv`;
CREATE TABLE `dtes_rcv` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `periodo` VARCHAR(7) NOT NULL,
  `tipo_operacion` ENUM('COMPRA', 'VENTA') NOT NULL,
  `tipo_dte` INT NOT NULL,
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
  `entry_id_ref` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dtes_rcv_folio` (`empresa_id`, `tipo_operacion`, `tipo_dte`, `folio`, `rut_contraparte`),
  KEY `idx_dtes_periodo` (`empresa_id`, `periodo`),
  KEY `idx_dtes_estado` (`empresa_id`, `estado_contable`),
  KEY `idx_dtes_fecha` (`fecha_emision`),
  CONSTRAINT `fk_dtes_entry` FOREIGN KEY (`entry_id_ref`) REFERENCES `accounting_entries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 12. TABLA: boletas_honorarios (Boletas de Honorarios Electrónicas BHE)
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
  `tasa_retencion` DECIMAL(5, 2) NOT NULL DEFAULT 14.50,
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
-- 13. TABLA: employees (Ficha Laboral y Contrato del Trabajador)
-- ============================================================================
DROP TABLE IF EXISTS `employees`;
CREATE TABLE `employees` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(20) NOT NULL,
  `rut` VARCHAR(20) NOT NULL,
  `nombre_completo` VARCHAR(255) NOT NULL,
  `cargo` VARCHAR(150) NOT NULL,
  `departamento` VARCHAR(100) NOT NULL,
  `fecha_ingreso` DATE NOT NULL,
  `tipo_contrato` VARCHAR(30) NOT NULL DEFAULT 'INDEFINIDO',
  `sueldo_base` DECIMAL(15, 2) NOT NULL,
  `gratificacion_modalidad` VARCHAR(30) NOT NULL DEFAULT 'ART_50',
  `horas_extras_cantidad` DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
  `comisiones_bonos_imponibles` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `asignacion_colacion` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `asignacion_movilizacion` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `viaticos_asignacion_familiar` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `afp_nombre` VARCHAR(50) NOT NULL DEFAULT 'HABITAT',
  `salud_tipo` VARCHAR(20) NOT NULL DEFAULT 'FONASA',
  `salud_plan_uf` DECIMAL(8, 4) NULL DEFAULT 0.0000,
  `otros_descuentos` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `activo` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_employees_empresa_rut` (`empresa_id`, `rut`),
  KEY `idx_employees_empresa_activo` (`empresa_id`, `activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 14. TABLA: payroll_settlements (Liquidaciones Mensuales de Sueldos)
-- ============================================================================
DROP TABLE IF EXISTS `payroll_settlements`;
CREATE TABLE `payroll_settlements` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(20) NOT NULL,
  `periodo` VARCHAR(7) NOT NULL,
  `employee_id` VARCHAR(36) NOT NULL,
  `rut_empleado` VARCHAR(20) NOT NULL,
  `nombre_empleado` VARCHAR(255) NOT NULL,
  `dias_trabajados` INT NOT NULL DEFAULT 30,
  `sueldo_base` DECIMAL(15, 2) NOT NULL,
  `horas_extras_monto` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `gratificacion_legal` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `comisiones_bonos` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `total_imponible` DECIMAL(15, 2) NOT NULL,
  `total_no_imponible` DECIMAL(15, 2) NOT NULL,
  `total_bruto` DECIMAL(15, 2) NOT NULL,
  `afp_nombre` VARCHAR(50) NOT NULL,
  `afp_monto` DECIMAL(15, 2) NOT NULL,
  `salud_tipo` VARCHAR(20) NOT NULL,
  `salud_monto` DECIMAL(15, 2) NOT NULL,
  `afc_trabajador_monto` DECIMAL(15, 2) NOT NULL,
  `impuesto_unico_monto` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `total_descuentos` DECIMAL(15, 2) NOT NULL,
  `sueldo_liquido` DECIMAL(15, 2) NOT NULL,
  `sis_empleador_monto` DECIMAL(15, 2) NOT NULL,
  `mutual_empleador_monto` DECIMAL(15, 2) NOT NULL,
  `afc_empleador_monto` DECIMAL(15, 2) NOT NULL,
  `costo_total_empresa` DECIMAL(15, 2) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payroll_empresa_periodo_empleado` (`empresa_id`, `periodo`, `employee_id`),
  KEY `idx_payroll_periodo` (`empresa_id`, `periodo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 15. TABLA: payroll_periods (Cierres Mensuales de Remuneraciones DT)
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
  CONSTRAINT `fk_payroll_entry` FOREIGN KEY (`entry_id_ref`) REFERENCES `accounting_entries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 16. TABLA: bank_accounts (Cuentas Corrientes Bancarias)
-- ============================================================================
DROP TABLE IF EXISTS `bank_accounts`;
CREATE TABLE `bank_accounts` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `banco_codigo` VARCHAR(30) NOT NULL,
  `numero_cuenta` VARCHAR(50) NOT NULL,
  `tipo_cuenta` ENUM('CORRIENTE', 'VISTA', 'AHORRO') NOT NULL DEFAULT 'CORRIENTE',
  `moneda` VARCHAR(10) NOT NULL DEFAULT 'CLP',
  `saldo_contable` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `saldo_cartola` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bank_account_num` (`empresa_id`, `banco_codigo`, `numero_cuenta`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 17. TABLA: bank_transactions (Movimientos de Cartola Bancaria)
-- ============================================================================
DROP TABLE IF EXISTS `bank_transactions`;
CREATE TABLE `bank_transactions` (
  `id` VARCHAR(36) NOT NULL,
  `account_id` VARCHAR(36) NOT NULL,
  `fecha` DATE NOT NULL,
  `descripcion` VARCHAR(255) NOT NULL,
  `cargo` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `abono` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `documento_ref` VARCHAR(100) NULL,
  `estado_conciliacion` ENUM('PENDIENTE', 'CONCILIADO', 'NOVEDAD') NOT NULL DEFAULT 'PENDIENTE',
  `matched_dte_id` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_tx_account_fecha` (`account_id`, `fecha`),
  KEY `idx_tx_estado` (`account_id`, `estado_conciliacion`),
  CONSTRAINT `fk_tx_account` FOREIGN KEY (`account_id`) REFERENCES `bank_accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 18. TABLA: f29_declarations (Declaraciones Mensuales F29 SII)
-- ============================================================================
DROP TABLE IF EXISTS `f29_declarations`;
CREATE TABLE `f29_declarations` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `periodo` VARCHAR(7) NOT NULL,
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
  CONSTRAINT `fk_f29_entry` FOREIGN KEY (`entry_id_ref`) REFERENCES `accounting_entries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 19. TABLA: warehouses (Bodegas WMS)
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
  UNIQUE KEY `uq_warehouses_empresa_codigo` (`empresa_id`, `codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 20. TABLA: warehouse_items (Artículos y Control de Existencias)
-- ============================================================================
DROP TABLE IF EXISTS `warehouse_items`;
CREATE TABLE `warehouse_items` (
  `id` VARCHAR(36) NOT NULL,
  `warehouse_id` VARCHAR(36) NOT NULL,
  `sku` VARCHAR(50) NOT NULL,
  `descripcion` VARCHAR(255) NOT NULL,
  `stock_actual` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `stock_minimo` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  `costo_unitario_promedio` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `metodo_valorizacion` ENUM('PMP', 'FIFO') NOT NULL DEFAULT 'PMP',
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_warehouse_items_sku` (`warehouse_id`, `sku`),
  CONSTRAINT `fk_item_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 21. TABLA: inventory_movements (Movimientos de Inventario y Kardex)
-- ============================================================================
DROP TABLE IF EXISTS `inventory_movements`;
CREATE TABLE `inventory_movements` (
  `id` VARCHAR(36) NOT NULL,
  `item_id` VARCHAR(36) NOT NULL,
  `tipo_movimiento` ENUM('ENTRADA_COMPRA', 'SALIDA_VENTA', 'TRASPASO_BODEGA', 'AJUSTE_MERMA') NOT NULL,
  `cantidad` DECIMAL(12, 2) NOT NULL,
  `costo_unitario` DECIMAL(15, 2) NOT NULL,
  `documento_ref` VARCHAR(100) NULL,
  `guia_despacho_folio` BIGINT NULL,
  `entry_id_ref` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_movements_item` (`item_id`),
  CONSTRAINT `fk_movement_item` FOREIGN KEY (`item_id`) REFERENCES `warehouse_items` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_movement_entry` FOREIGN KEY (`entry_id_ref`) REFERENCES `accounting_entries` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 22. TABLA: company_agent_configs (Gobernanza Agéntica y Directivas Especiales)
-- ============================================================================
DROP TABLE IF EXISTS `company_agent_configs`;
CREATE TABLE `company_agent_configs` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `modulo_codigo` ENUM(
    'RRHH',
    'SII_RCV',
    'F29_TAX',
    'BANK_RECON',
    'INVENTORY_WMS',
    'ACCOUNTING_LEDGER'
  ) NOT NULL,
  `instrucciones_especiales` TEXT NULL,
  `parametros_operativos` JSON NOT NULL,
  `activo` BOOLEAN NOT NULL DEFAULT TRUE,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_empresa_modulo` (`empresa_id`, `modulo_codigo`),
  KEY `idx_config_empresa` (`empresa_id`),
  KEY `idx_config_modulo` (`modulo_codigo`),
  CONSTRAINT `fk_config_company` FOREIGN KEY (`empresa_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 23. TABLA: agent_learnings (Base de Aprendizaje y Feedback de Correcciones)
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
-- 24. TABLA: karin_compliance_records (Cumplimiento Legal Ley Karin 21.643 DT)
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
-- 25. TABLA: cash_flow_movements (Movimientos y Proyecciones de Flujo de Caja)
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
-- 26. TABLA: lease_contracts (Contratos de Arrendamiento Financiero IFRS 16)
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

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- 27. DATOS SEMILLA (INITIAL SEED DATA)
-- ============================================================================

-- Estudio Contable Principal
INSERT INTO `accounting_firms` (`id`, `rut`, `razon_social`, `email_contacto`, `plan`, `estado`, `created_at`)
VALUES ('firm-001-audicon', '76.123.456-7', 'Audicón & Asociados Consultores SpA', 'contacto@audicon.cl', 'ESTUDIO_PRO', 'ACTIVO', NOW())
ON DUPLICATE KEY UPDATE `razon_social` = VALUES(`razon_social`);

-- Empresas Clientes del Estudio
INSERT INTO `companies` (`id`, `firm_id`, `rut`, `razon_social`, `giro`, `regimen_tributario`, `tasa_ppm`, `es_cliente_ancla`, `created_at`)
VALUES 
('client-retail-01', 'firm-001-audicon', '76.892.410-K', 'Retail & Logistics Chile SpA', 'Comercio al por mayor y logística de distribución', '14_D3', 0.0100, TRUE, NOW()),
('client-agro-02', 'firm-001-audicon', '76.543.210-9', 'Agrícola Valle Central Ltda.', 'Cultivo y exportación de frutas y hortalizas', '14_A', 0.0150, FALSE, NOW()),
('client-innovagile', 'firm-001-audicon', '77.210.980-5', 'InnovAgile Software SpA', 'Desarrollo de software y servicios cloud', '14_D8', 0.0025, FALSE, NOW())
ON DUPLICATE KEY UPDATE `razon_social` = VALUES(`razon_social`);

-- Suscripciones por Módulo para Retail & Logistics Chile SpA
INSERT INTO `company_module_subscriptions` (`id`, `empresa_id`, `modulo_codigo`, `pagado_por`, `estado`, `created_at`)
VALUES
('sub-01', 'client-retail-01', 'CORE_ACCOUNTING', 'ESTUDIO', 'ACTIVO', NOW()),
('sub-02', 'client-retail-01', 'F29_TAX', 'ESTUDIO', 'ACTIVO', NOW()),
('sub-03', 'client-retail-01', 'PAYROLL_DT', 'ESTUDIO', 'ACTIVO', NOW()),
('sub-04', 'client-retail-01', 'INVENTORY_WMS', 'ESTUDIO', 'ACTIVO', NOW()),
('sub-05', 'client-retail-01', 'BANK_RECON', 'ESTUDIO', 'ACTIVO', NOW()),
('sub-06', 'client-retail-01', 'IFRS16_LEASES', 'ESTUDIO', 'ACTIVO', NOW())
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
('acc-07', 'client-retail-01', '2.1.01.001', 'Proveedores Nacionales por Pagar', 'PASIVO', TRUE, NOW()),
('acc-08', 'client-retail-01', '2.1.03.001', 'IVA Débito Fiscal', 'PASIVO', FALSE, NOW()),
('acc-09', 'client-retail-01', '2.1.03.002', 'Retención Honorarios 2da Categoría por Pagar', 'PASIVO', FALSE, NOW()),
('acc-10', 'client-retail-01', '2.1.03.003', 'Impuesto Único de Segunda Categoría por Pagar', 'PASIVO', FALSE, NOW()),
('acc-11', 'client-retail-01', '2.1.03.005', 'Impuestos Mensuales F29 por Pagar (TGR)', 'PASIVO', FALSE, NOW()),
('acc-12', 'client-retail-01', '2.1.05.001', 'Sueldos por Pagar (Remuneraciones Líquidas)', 'PASIVO', TRUE, NOW()),
('acc-13', 'client-retail-01', '2.1.06.001', 'Instituciones de Previsión por Pagar (Previred)', 'PASIVO', FALSE, NOW()),
('acc-14', 'client-retail-01', '4.1.01.001', 'Ingresos por Ventas del Giro Afectas a IVA', 'INGRESOS', FALSE, NOW()),
('acc-15', 'client-retail-01', '5.1.01.001', 'Costo de Ventas / Existencias Vendidas', 'COSTOS', FALSE, NOW()),
('acc-16', 'client-retail-01', '5.1.02.001', 'Sueldos y Salarios (Remuneraciones Brutas)', 'GASTOS', FALSE, NOW()),
('acc-17', 'client-retail-01', '5.1.02.002', 'Aportes Patronales (SIS, Mutual, AFC Empleador)', 'GASTOS', FALSE, NOW())
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
