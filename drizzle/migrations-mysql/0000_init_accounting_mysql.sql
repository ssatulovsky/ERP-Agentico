-- ============================================================================
-- MIGRACIÓN INICIAL NATIVA PARA MYSQL 8.0 (ENGINE=InnoDB, CHARSET=utf8mb4)
-- Sistema ERP Contable con Auditoría Criptográfica e Indicadores Económicos
-- Archivo: drizzle/migrations-mysql/0000_init_accounting_mysql.sql
-- ============================================================================

-- 1. TABLA: accounting_entries (Cabecera del Libro Diario)
CREATE TABLE IF NOT EXISTS `accounting_entries` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(20) NOT NULL,
  `periodo` VARCHAR(7) NOT NULL,
  `fecha` DATE NOT NULL,
  `concepto` TEXT NOT NULL,
  `documento_ref` VARCHAR(100) NULL,
  `total_debe` DECIMAL(15, 2) NOT NULL,
  `total_haber` DECIMAL(15, 2) NOT NULL,
  `origen_modulo` VARCHAR(50) NOT NULL,
  `creado_por_agente` VARCHAR(50) NOT NULL,
  `autorizado_por_supervisor` BOOLEAN NOT NULL DEFAULT FALSE,
  `supervisor_signature` VARCHAR(128) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_entries_empresa_periodo` (`empresa_id`, `periodo`),
  KEY `idx_entries_fecha` (`fecha`),
  UNIQUE KEY `uq_entries_empresa_doc` (`empresa_id`, `periodo`, `origen_modulo`, `documento_ref`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
-- 2. TABLA: accounting_entry_lines (Partidas Contables con Integridad Referencial)
CREATE TABLE IF NOT EXISTS `accounting_entry_lines` (
  `id` VARCHAR(36) NOT NULL,
  `entry_id` VARCHAR(36) NOT NULL,
  `codigo_cuenta` VARCHAR(20) NOT NULL,
  `nombre_cuenta` VARCHAR(150) NOT NULL,
  `debe` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `haber` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `rut_auxiliar` VARCHAR(20) NULL,
  `centro_costo` VARCHAR(50) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_lines_entry_id` (`entry_id`),
  KEY `idx_lines_cuenta` (`codigo_cuenta`),
  KEY `idx_lines_rut` (`rut_auxiliar`),
  CONSTRAINT `fk_lines_entry` FOREIGN KEY (`entry_id`) REFERENCES `accounting_entries` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
-- 3. TABLA: agent_audit_logs (Bitácora Forense Inmutable de Agentes IA)
CREATE TABLE IF NOT EXISTS `agent_audit_logs` (
  `id` VARCHAR(36) NOT NULL,
  `trace_id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(20) NOT NULL,
  `agente_nombre` VARCHAR(50) NOT NULL,
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
  KEY `idx_audit_empresa_created` (`empresa_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
-- 4. TABLA: economic_indicators (Sincronización de Indicadores Financieros)
CREATE TABLE IF NOT EXISTS `economic_indicators` (
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
--> statement-breakpoint
-- 5. TABLA: dtes_rcv (Registro de Compras y Ventas del SII)
CREATE TABLE IF NOT EXISTS `dtes_rcv` (
  `id` VARCHAR(36) NOT NULL,
  `empresa_id` VARCHAR(20) NOT NULL,
  `periodo` VARCHAR(7) NOT NULL,
  `tipo_operacion` ENUM('COMPRA', 'VENTA') NOT NULL,
  `tipo_dte` INT NOT NULL,
  `folio` BIGINT NOT NULL,
  `rut_contraparte` VARCHAR(20) NOT NULL,
  `razon_social_contraparte` VARCHAR(255) NOT NULL,
  `fecha_emision` DATE NOT NULL,
  `monto_exento` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_neto` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_iva_recuperable` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_iva_no_recuperable` DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  `monto_total` DECIMAL(15, 2) NOT NULL,
  `estado_acuse` VARCHAR(50) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_dte_registro` (`empresa_id`, `tipo_operacion`, `tipo_dte`, `folio`, `rut_contraparte`),
  KEY `idx_dtes_periodo` (`empresa_id`, `periodo`, `tipo_operacion`),
  KEY `idx_dtes_fecha` (`fecha_emision`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
-- 6. TABLA: employees (Ficha Laboral y de Contrato DT)
CREATE TABLE IF NOT EXISTS `employees` (
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
  `activo` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_employees_empresa_rut` (`empresa_id`, `rut`),
  KEY `idx_employees_empresa_activo` (`empresa_id`, `activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint
-- 7. TABLA: payroll_settlements (Liquidaciones Mensuales de Sueldos)
CREATE TABLE IF NOT EXISTS `payroll_settlements` (
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

