module.exports = {
  apps: [
    {
      name: "sambhariya-web",
      cwd: "/root/projects/mlmReferalComm",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 4000",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "600M",
    },
  ],
};
