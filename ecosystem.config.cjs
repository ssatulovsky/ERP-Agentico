/**
 * ============================================================================
 * PM2 Ecosystem File - ERP Agéntico Contable y Financiero Chile
 * Servidores de Producción Ubuntu/Debian Linux con Node.js 20+ y Redis 7
 * ============================================================================
 */
module.exports = {
  apps: [
    {
      name: "erp-agentico-app",
      script: "./dist/server.cjs",
      instances: "max", // Escalamiento horizontal multinúcleo en Linux
      exec_mode: "cluster",
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
