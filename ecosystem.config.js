module.exports = {
  apps: [
    {
      name: 'free-game-alarm',
      script: 'dist/bot.js',
      instances: 1,
      autorestart: true,
      watch: true,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};