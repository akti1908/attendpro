// AttendPro cloud sync config.
// Use only publishable/anon key, never service_role in browser.
window.ATTENDPRO_CLOUD = {
  url: "https://imunyaltatkctnjyezvg.supabase.co",
  anonKey: "sb_publishable_WnFi5QLBROjrx5XGskbVxA_rkTAo8dA",
  table: "attendpro_accounts"
};

// Telegram reports:
// 1) Recommended production mode: backend API (apiBaseUrl + schedulerMode: "server").
// 2) Temporary compatibility mode ("as before"): direct browser -> Telegram API via botToken/chatId.
//    Warning: in direct mode the bot token is visible in client code.
window.ATTENDPRO_TELEGRAM = {
  // Leave empty for local server mode: app.js will use current origin on localhost.
  // If you deploy backend publicly, set full URL here, e.g. https://api.your-domain.com
  apiBaseUrl: "",
  schedulerMode: "server",
  botToken: "",
  chatId: "",
  messageThreadId: ""
};
