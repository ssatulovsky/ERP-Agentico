/**
 * ============================================================================
 * PM2 Ecosystem File - ERP Agéntico Contable y Financiero Chile
 * Servidores de Producción Ubuntu/Debian Linux con Node.js 20+ y Redis 7
 * ============================================================================
 */
module.exports = {
  apps: [
    {
      name: "erpremia",
      script: "./dist/server.cjs",
      // Una sola instancia: los datos en disco y el despachador de tareas programadas no se
      // coordinan entre procesos (en modo cluster las tareas se ejecutarían una vez por núcleo).
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1024M",
      listen_timeout: 10000,
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
