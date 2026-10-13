-- ============================================================================
-- MIGRACIÓN 0003: CONCILIACIÓN BANCARIA, MULTIMONEDA Y GOBERNANZA FISCAL
-- Archivo: drizzle/migrations-mysql/0003_reconciliation_multicurrency_governance.sql
-- ============================================================================

-- 1. EXTENSIÓN TABLA: companies (Reaperturas Extraordinarias y Multimoneda NIC 21)
ALTER TABLE `companies` ADD COLUMN `ejercicios_cerrados` JSON NULL;
--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `reapertura_extraordinaria_activa` JSON NULL;
--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `auditoria_reaperturas` JSON NULL;
--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `moneda_defecto` VARCHAR(10) NOT NULL DEFAULT 'CLP';
--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `monedas_habilitadas` JSON NULL;
--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `cuenta_dif_cambio_ganancia_id` VARCHAR(30) NULL DEFAULT '7.1.01.002';
--> statement-breakpoint
ALTER TABLE `companies` ADD COLUMN `cuenta_dif_cambio_perdida_id` VARCHAR(30) NULL DEFAULT '7.2.01.002';
--> statement-breakpoint

-- 2. EXTENSIÓN TABLA: chart_of_accounts (Moneda de Cuenta y Notas Explicativas NIIF)
ALTER TABLE `chart_of_accounts` ADD COLUMN `moneda_codigo` VARCHAR(10) NULL DEFAULT 'CLP';
--> statement-breakpoint
ALTER TABLE `chart_of_accounts` ADD COLUMN `notas_explicativas` JSON NULL;
--> statement-breakpoint

-- 3. EXTENSIÓN TABLA: accounting_entries (Multi-Estudio, Documentos de Referencia Extendidos e Índices)
ALTER TABLE `accounting_entries` ADD COLUMN `firm_id` VARCHAR(36) NOT NULL DEFAULT 'firm-default-001';
--> statement-breakpoint
ALTER TABLE `accounting_entries` ADD COLUMN `documento_referencia` VARCHAR(150) NULL;
--> statement-breakpoint
ALTER TABLE `accounting_entries` ADD COLUMN `tipo_documento_ref` VARCHAR(50) NULL;
--> statement-breakpoint
ALTER TABLE `accounting_entries` ADD COLUMN `folio_documento_ref` VARCHAR(100) NULL;
ALTER TABLE `accounting_entries` ADD KEY `idx_entries_empresa_origen_doc` (`empresa_id`, `periodo`, `origen_modulo`, `documento_ref`);
--> statement-breakpoint

-- 4. EXTENSIÓN TABLA: accounting_entry_lines (Documentos de Respaldo No-SII, Correlativo y Multimoneda)
ALTER TABLE `accounting_entry_lines` ADD COLUMN `linea_numero` INT NOT NULL DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `accounting_entry_lines` ADD COLUMN `documento_ref` VARCHAR(150) NULL;
--> statement-breakpoint
ALTER TABLE `accounting_entry_lines` ADD COLUMN `dte_id_asociado` VARCHAR(36) NULL;
--> statement-breakpoint
ALTER TABLE `accounting_entry_lines` ADD COLUMN `tipo_documento_ref` VARCHAR(50) NULL;
--> statement-breakpoint
ALTER TABLE `accounting_entry_lines` ADD COLUMN `folio_documento_ref` VARCHAR(100) NULL;
--> statement-breakpoint
ALTER TABLE `accounting_entry_lines` ADD COLUMN `monto_documento_ref` DECIMAL(15, 2) NULL;
--> statement-breakpoint
ALTER TABLE `accounting_entry_lines` ADD COLUMN `documento_operacion` VARCHAR(100) NULL;
--> statement-breakpoint
ALTER TABLE `accounting_entry_lines` ADD COLUMN `tipo_documento_operacion` VARCHAR(50) NULL;
--> statement-breakpoint
ALTER TABLE `accounting_entry_lines` ADD COLUMN `documento_conciliacion` VARCHAR(100) NULL;
--> statement-breakpoint
ALTER TABLE `accounting_entry_lines` ADD COLUMN `tipo_documento_conciliacion` VARCHAR(50) NULL;
--> statement-breakpoint
ALTER TABLE `accounting_entry_lines` ADD COLUMN `moneda_original` VARCHAR(10) NULL;
--> statement-breakpoint
ALTER TABLE `accounting_entry_lines` ADD COLUMN `monto_moneda_original` DECIMAL(15, 2) NULL;
--> statement-breakpoint
ALTER TABLE `accounting_entry_lines` ADD COLUMN `tipo_cambio` DECIMAL(12, 4) NULL;
--> statement-breakpoint

-- 5. EXTENSIÓN TABLA: bank_transactions (Conciliación Bancaria Formal, Criterios y Desambiguación)
ALTER TABLE `bank_transactions` ADD COLUMN `cargo` DECIMAL(15, 2) NOT NULL DEFAULT 0.00;
--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD COLUMN `abono` DECIMAL(15, 2) NOT NULL DEFAULT 0.00;
--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD COLUMN `documento_ref` VARCHAR(100) NULL;
--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD COLUMN `codigo_conciliacion` VARCHAR(50) NULL;
--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD COLUMN `fecha_conciliacion` DATETIME(3) NULL;
--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD COLUMN `match_criterio` VARCHAR(255) NULL;
--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD COLUMN `usuario_conciliador` VARCHAR(100) NULL;
--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD COLUMN `asiento_generado_id` VARCHAR(36) NULL;
--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD COLUMN `partida_contable_detalle` JSON NULL;
--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD COLUMN `es_ambiguo` BOOLEAN NOT NULL DEFAULT FALSE;
--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD COLUMN `candidatos_matches_count` INT NULL DEFAULT 0;
