// Copy this file to config.js and fill values.
window.ATTENDPRO_CLOUD = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
  table: "attendpro_accounts"
};

// Telegram reports:
// - Recommended: backend API mode.
// - Temporary fallback: direct mode with botToken/chatId.
window.ATTENDPRO_TELEGRAM = {
  apiBaseUrl: "https://YOUR_BACKEND_BASE_URL",
  schedulerMode: "server",
  botToken: "",
  chatId: "",
  messageThreadId: ""
};
