-- ============================================================================
-- MIGRACIÓN 0002: HOMOLOGACIÓN INTEGRAL DTEs/RCV Y MÓDULOS DE GESTIÓN MYSQL 8.0
-- Archivo: drizzle/migrations-mysql/0002_schema_alignment_dtes_rcv_and_modules.sql
-- ============================================================================

-- 1. EXTENSIÓN Y ALINEACIÓN DE TABLA: dtes_rcv
ALTER TABLE `dtes_rcv` ADD COLUMN `periodo` VARCHAR(7) NOT NULL DEFAULT '2026-08';
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD COLUMN `monto_iva` DECIMAL(15, 2) NOT NULL DEFAULT 0.00;
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD COLUMN `monto_iva_recuperable` DECIMAL(15, 2) NOT NULL DEFAULT 0.00;
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD COLUMN `monto_iva_no_recuperable` DECIMAL(15, 2) NOT NULL DEFAULT 0.00;
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD COLUMN `estado_acuse` VARCHAR(50) NULL;
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD COLUMN `estado_contable` ENUM('PENDIENTE', 'CENTRALIZADO') NOT NULL DEFAULT 'PENDIENTE';
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD COLUMN `glosa` TEXT NULL;
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD COLUMN `centro_costo_id` VARCHAR(36) NULL;
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD COLUMN `centro_costo_codigo` VARCHAR(50) NULL;
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD COLUMN `centro_costo_nombre` VARCHAR(200) NULL;
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD COLUMN `cuenta_gasto_imputada_codigo` VARCHAR(50) NULL;
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD COLUMN `cuenta_gasto_imputada_nombre` VARCHAR(200) NULL;
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD COLUMN `items` JSON NULL;
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD COLUMN `entry_id_ref` VARCHAR(36) NULL;
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD COLUMN `track_id` VARCHAR(100) NULL;
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD COLUMN `ted_xml` TEXT NULL;
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD COLUMN `xml_timbrado` MEDIUMTEXT NULL;
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD COLUMN `pdf_url` VARCHAR(500) NULL;
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD COLUMN `ambiente_sii` INT NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD KEY `idx_dtes_periodo` (`empresa_id`, `periodo`, `tipo_operacion`);
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD KEY `idx_dtes_fecha` (`fecha_emision`);
--> statement-breakpoint
ALTER TABLE `dtes_rcv` ADD KEY `idx_dtes_entry_ref` (`entry_id_ref`);
--> statement-breakpoint

-- 2. TABLA: boletas_honorarios (Homologación BHE SII)
CREATE TABLE IF NOT EXISTS `boletas_honorarios` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `folio` BIGINT NOT NULL,
  `rut_emisor` VARCHAR(20) NOT NULL,
  `nombre_emisor` VARCHAR(255) NOT NULL,
  `fecha_emision` DATE NOT NULL,
  `periodo` VARCHAR(7) NOT NULL,
  `monto_bruto` DECIMAL(15, 2) NOT NULL,
  `tasa_retencion` DECIMAL(5, 4) NOT NULL DEFAULT 0.1450,
  `retencion_monto` DECIMAL(15, 2) NOT NULL,
  `liquido_pagado` DECIMAL(15, 2) NOT NULL,
  `descripcion_servicio` TEXT NULL,
  `bhe_estado_contable` ENUM('PENDIENTE', 'CENTRALIZADO') NOT NULL DEFAULT 'PENDIENTE',
  `entry_id_ref` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_bhe_empresa_folio` (`empresa_id`, `folio`),
  KEY `idx_bhe_periodo` (`empresa_id`, `periodo`),
  KEY `idx_bhe_emisor` (`empresa_id`, `rut_emisor`),
  CONSTRAINT `fk_bhe_company` FOREIGN KEY (`empresa_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

-- 3. TABLA: f29_declarations (Homologación Formulario 29 SII)
CREATE TABLE IF NOT EXISTS `f29_declarations` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `periodo` VARCHAR(7) NOT NULL,
  `folio_declaracion` BIGINT NULL,
  `total_iva_debito` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `total_iva_credito` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `remanente_siguiente_mes` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `ppm_determinado` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `retenciones_segunda_cat` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `total_a_pagar` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `estado_declaracion` ENUM('PROPUESTA', 'DECLARADO', 'PAGADO') NOT NULL DEFAULT 'PROPUESTA',
  `json_casillas` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_f29_empresa_periodo` (`empresa_id`, `periodo`),
  CONSTRAINT `fk_f29_company` FOREIGN KEY (`empresa_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

-- 4. TABLA: payroll_periods (Homologación Remuneraciones DT / Previred)
CREATE TABLE IF NOT EXISTS `payroll_periods` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `periodo` VARCHAR(7) NOT NULL,
  `uf_fin_mes` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `utm_mes` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  `total_haberes` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `total_descuentos` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `liquido_a_pagar` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `total_leyes_sociales` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `payroll_estado` ENUM('BORRADOR', 'CERRADO', 'PAGADO', 'PREVIRED_GENERADO') NOT NULL DEFAULT 'BORRADOR',
  `entry_id_ref` VARCHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payroll_empresa_periodo` (`empresa_id`, `periodo`),
  CONSTRAINT `fk_payroll_company` FOREIGN KEY (`empresa_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

-- 5. TABLA: inventory_items (Homologación Catálogo PMP Inventarios)
CREATE TABLE IF NOT EXISTS `inventory_items` (
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
--> statement-breakpoint

-- 6. TABLA: cashflow_forecasts (Homologación Proyecciones Flujo de Caja)
CREATE TABLE IF NOT EXISTS `cashflow_forecasts` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(36) NOT NULL,
  `fecha_proyeccion` DATE NOT NULL,
  `saldo_inicial_estimado` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `ingresos_estimados` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `egresos_estimados` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `saldo_final_estimado` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `metodo` ENUM('SARIMAX', 'MONTE_CARLO', 'LINEAL', 'COMBINADO') NOT NULL DEFAULT 'COMBINADO',
  `metadata_modelo` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_cashflow_empresa_fecha` (`empresa_id`, `fecha_proyeccion`),
  CONSTRAINT `fk_cashflow_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
