const path = require("node:path");

const root = __dirname;

module.exports = {
  apps: [
    {
      name: "hexapanel-api",
      cwd: path.join(root, "apps/panel-api"),
      script: "dist/index.js",
      env: {
        NODE_ENV: "production",
      },
      max_restarts: 20,
    },
    {
      name: "hexapanel-web",
      cwd: path.join(root, "apps/panel-web"),
      script: "npx",
      args: "vite preview --host 127.0.0.1 --port 4173",
      env: {
        NODE_ENV: "production",
      },
      max_restarts: 20,
    },
  ],
};
