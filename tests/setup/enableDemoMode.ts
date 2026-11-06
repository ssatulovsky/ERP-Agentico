/**
 * Las suites de integración usan las empresas de ejemplo (client-innovagile, client-retail-01, ...)
 * como fixtures, por lo que corren con DEMO_MODE=true. Debe importarse ANTES que cualquier servicio.
 * La prueba de Fase 0 verifica por separado que con DEMO_MODE=false no se entregan datos semilla.
 */
process.env.DEMO_MODE = 'true';
export {};
