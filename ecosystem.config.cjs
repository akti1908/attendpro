module.exports = {
  apps: [
    {
      name: "attendpro",
      script: "server.js",
      cwd: __dirname,
      watch: [
        "index.html",
        "style.css",
        "app.js",
        "components",
        "config.js"
      ],
      ignore_watch: [
        "node_modules",
        ".git",
        ".github"
      ],
      env: {
        HOST: "0.0.0.0",
        PORT: "8080"
      }
    }
  ]
};
