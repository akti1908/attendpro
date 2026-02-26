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
        PORT: "8080",

        // Telegram (server-side only).
        TELEGRAM_BOT_TOKEN: "",
        TELEGRAM_CHAT_ID: "",
        TELEGRAM_MESSAGE_THREAD_ID: "",

        // Supabase admin access for server scheduler and idempotency log.
        SUPABASE_URL: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
        SUPABASE_TABLE: "attendpro_accounts",
        SUPABASE_REPORT_RUNS_TABLE: "attendpro_report_runs",

        // Scheduler.
        AUTO_REPORT_SCHEDULER_ENABLED: "true",
        AUTO_REPORT_POLL_MS: "60000",
        REPORTS_TIMEZONE: "Asia/Bishkek"
      }
    }
  ]
};
