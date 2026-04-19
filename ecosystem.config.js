module.exports = {
  apps: [
    {
      name: 'free-game-alarm',
      script: 'dist/bot.js',
      cwd: 'D:/freeGameAlarm',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};