// ==============================================
// NovaConnect Gateway - PM2 Configuration
// ==============================================

module.exports = {
  apps: [
    {
      name: 'novaconnect-gateway',
      script: 'src/server.ts',
      interpreter: 'bun',
      interpreter_args: 'run',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        DATABASE_PATH: './data',
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3001,
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,
    },
  ],

  deploy: {
    production: {
      user: 'node',
      host: 'your-gateway-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-org/novaconnect.git',
      path: '/var/www/novaconnect-gateway',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && bun run build && pm2 reload ecosystem.config.cjs --env production',
      'pre-setup': '',
    },
  },
};
