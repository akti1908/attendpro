// AttendPro cloud sync config.
// Use only publishable/anon key, never service_role in browser.
window.ATTENDPRO_CLOUD = {
  url: "https://imunyaltatkctnjyezvg.supabase.co",
  anonKey: "sb_publishable_WnFi5QLBROjrx5XGskbVxA_rkTAo8dA",
  table: "attendpro_accounts"
};

// Telegram reports must go through backend API only.
// - apiBaseUrl: full backend URL (for GitHub Pages), e.g. https://attendpro-api.example.com
// - schedulerMode:
//   - "server" (default) -> auto reports are sent by backend scheduler
//   - "browser" -> local fallback from browser timer (not recommended for production)
window.ATTENDPRO_TELEGRAM = {
  apiBaseUrl: "",
  schedulerMode: "server"
};
