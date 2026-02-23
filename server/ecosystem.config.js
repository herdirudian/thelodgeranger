module.exports = {
  apps: [{
    name: "server-api",
    script: "./index.js",
    instances: "max", // Or a specific number like 2 or 4 depending on VPS cores
    exec_mode: "cluster",
    env: {
      NODE_ENV: "production",
    }
  }]
}
