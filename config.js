// Конфиг облачной синхронизации AttendPro.
// Важно: используйте только publishable/anon ключ Supabase, не service_role.
window.ATTENDPRO_CLOUD = {
  url: "https://imunyaltatkctnjyezvg.supabase.co",
  anonKey: "sb_publishable_WnFi5QLBROjrx5XGskbVxA_rkTAo8dA",
  table: "attendpro_accounts"
};

// Опционально: внешний backend для Telegram-отчетов.
// Оставьте пустым для локального запуска с server.js.
window.ATTENDPRO_TELEGRAM = {
  apiBaseUrl: ""
};
