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
        PORT: "8080",
        TELEGRAM_BOT_TOKEN: "8747256544:AAFOwJ0k1Z5EUV2StPGBwOWwFKbYt-u9QJw",
        TELEGRAM_CHAT_ID: "873271733",
        TELEGRAM_MESSAGE_THREAD_ID: ""
      }
    }
  ]
};
