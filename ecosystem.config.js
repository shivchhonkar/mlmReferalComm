module.exports = {
  apps: [
    {
      name: "sambhariya-web",
      cwd: "/root/projects/mlmReferalComm",
      script: "node",
      args: "server.mjs",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        BACKEND_URL: "http://localhost:4001",
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "600M",
    },
    {
      name: "sambhariya-api",
      cwd: "/root/projects/mlmReferalComm/backend",
      script: "node",
      args: "dist/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 4001,
        CORS_ORIGIN: "http://localhost:4000",
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "600M",
    },
  ],
};
