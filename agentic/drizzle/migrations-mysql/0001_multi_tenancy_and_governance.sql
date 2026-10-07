-- ============================================================================
-- MIGRACIÓN 0001: MULTI-TENANCY, MÓDULOS ERP Y GOBERNANZA AGÉNTICA MYSQL 8.0
-- Archivo: drizzle/migrations-mysql/0001_multi_tenancy_and_governance.sql
-- ============================================================================

-- 1. TABLA: accounting_firms (Nivel 1: Estudio Contable)
CREATE TABLE IF NOT EXISTS `accounting_firms` (
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
--> statement-breakpoint

-- 2. TABLA: companies (Nivel 2: Empresa Cliente del Estudio)
CREATE TABLE IF NOT EXISTS `companies` (
  `id` VARCHAR(36) NOT NULL,
  `firm_id` VARCHAR(36) NOT NULL,
  `rut` VARCHAR(20) NOT NULL,
  `razon_social` VARCHAR(255) NOT NULL,
  `giro` VARCHAR(255) NOT NULL,
  `regimen_tributario` ENUM('14_A', '14_D3', '14_D8') NOT NULL DEFAULT '14_D3',
  `es_cliente_ancla` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_companies_firm_id` (`firm_id`),
  KEY `idx_companies_rut` (`rut`),
  UNIQUE KEY `uq_companies_firm_rut` (`firm_id`, `rut`),
  CONSTRAINT `fk_companies_firm` FOREIGN KEY (`firm_id`) REFERENCES `accounting_firms` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

-- 3. TABLA: company_module_subscriptions (Nivel 3: Suscripción por Módulo)
CREATE TABLE IF NOT EXISTS `company_module_subscriptions` (
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
--> statement-breakpoint

-- 4. TABLA: company_credentials_vault (Vault Seguro AES-256-GCM)
CREATE TABLE IF NOT EXISTS `company_credentials_vault` (
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
--> statement-breakpoint

-- 5. TABLA: chart_of_accounts (Plan de Cuentas Estándar IFRS Chile)
CREATE TABLE IF NOT EXISTS `chart_of_accounts` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `codigo` VARCHAR(30) NOT NULL,
  `nombre` VARCHAR(150) NOT NULL,
  `nivel` INT NOT NULL,
  `tipo` ENUM('ACTIVO', 'PASIVO', 'PATRIMONIO', 'RESULTADO_PERDIDA', 'RESULTADO_GANANCIA') NOT NULL,
  `clasificacion_ifrs` VARCHAR(100) NOT NULL,
  `acepta_movimiento` BOOLEAN NOT NULL DEFAULT TRUE,
  `exige_rut_auxiliar` BOOLEAN NOT NULL DEFAULT FALSE,
  `exige_centro_costo` BOOLEAN NOT NULL DEFAULT FALSE,
  `activo` BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_chart_empresa_codigo` (`empresa_id`, `codigo`),
  KEY `idx_chart_empresa_codigo` (`empresa_id`, `codigo`),
  KEY `idx_chart_tipo` (`empresa_id`, `tipo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

-- 6. TABLA: boletas_honorarios (Boletas de Honorarios Electrónicas BHE)
CREATE TABLE IF NOT EXISTS `boletas_honorarios` (
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
  KEY `idx_bhe_fecha` (`empresa_id`, `fecha_emision`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

-- 7. TABLA: bank_accounts (Cuentas Corrientes y Bancarias)
CREATE TABLE IF NOT EXISTS `bank_accounts` (
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
--> statement-breakpoint

-- 8. TABLA: bank_transactions (Movimientos de Cartola Bancaria)
CREATE TABLE IF NOT EXISTS `bank_transactions` (
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
--> statement-breakpoint

-- 9. TABLA: f29_declarations (Declaraciones Mensuales F29 SII)
CREATE TABLE IF NOT EXISTS `f29_declarations` (
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
  UNIQUE KEY `uq_f29_empresa_periodo` (`empresa_id`, `periodo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

-- 10. TABLA: payroll_periods (Cierres Mensuales de Remuneraciones DT)
CREATE TABLE IF NOT EXISTS `payroll_periods` (
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
  UNIQUE KEY `uq_payroll_empresa_periodo` (`empresa_id`, `periodo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

-- 11. TABLA: karin_compliance_records (Cumplimiento Legal Ley Karin 21.643 DT)
CREATE TABLE IF NOT EXISTS `karin_compliance_records` (
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
--> statement-breakpoint

-- 12. TABLA: warehouses (Bodegas WMS)
CREATE TABLE IF NOT EXISTS `warehouses` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `codigo` VARCHAR(50) NOT NULL,
  `nombre` VARCHAR(150) NOT NULL,
  `direccion` VARCHAR(255) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_warehouses_empresa_codigo` (`empresa_id`, `codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

-- 13. TABLA: warehouse_items (Artículos y Control de Existencias)
CREATE TABLE IF NOT EXISTS `warehouse_items` (
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
--> statement-breakpoint

-- 14. TABLA: inventory_movements (Movimientos de Inventario y DTE 52)
CREATE TABLE IF NOT EXISTS `inventory_movements` (
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
  CONSTRAINT `fk_movement_item` FOREIGN KEY (`item_id`) REFERENCES `warehouse_items` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

-- 15. TABLA: company_agent_configs (Gobernanza: Directivas Especiales Ad-Hoc)
CREATE TABLE IF NOT EXISTS `company_agent_configs` (
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
--> statement-breakpoint

-- 16. TABLA: agent_learnings (Base de Conocimiento y Memoria de Aprendizaje)
CREATE TABLE IF NOT EXISTS `agent_learnings` (
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
