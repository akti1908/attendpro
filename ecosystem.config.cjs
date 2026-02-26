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
        "config.js",
        "server.js"
      ],
      ignore_watch: [
        "node_modules",
        ".git",
        ".github",
        "supabase"
      ],
      env: {
        HOST: "0.0.0.0",
        PORT: "8080"
      },
      env_production: {
        HOST: "0.0.0.0",
        PORT: "8080",

        // Scheduler.
        AUTO_REPORT_SCHEDULER_ENABLED: "true",
        AUTO_REPORT_POLL_MS: "60000",
        REPORTS_TIMEZONE: "Asia/Bishkek"
      }
    }
  ]
};
