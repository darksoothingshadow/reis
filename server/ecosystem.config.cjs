module.exports = {
  apps: [{
    name: 'reis-server',
    script: 'npx',
    args: 'tsx src/index.ts',
    cwd: '/root/reis/server',
    env: {
      NODE_ENV: 'production',
    },
    watch: false,
    instances: 1,
    autorestart: true,
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/root/reis/server/logs/error.log',
    out_file: '/root/reis/server/logs/out.log',
    merge_logs: true,
  }]
};
