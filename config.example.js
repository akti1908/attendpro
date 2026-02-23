// Пример конфига облачной синхронизации AttendPro.
// Скопируйте файл в config.js и подставьте свои значения.
window.ATTENDPRO_CLOUD = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
  table: "attendpro_accounts"
};

// Опционально: внешний backend для Telegram-отчетов.
// Нужен, если приложение открывается с GitHub Pages.
// Пример: https://attendpro-api.example.com
window.ATTENDPRO_TELEGRAM = {
  apiBaseUrl: "",
  botToken: "",
  chatId: "",
  messageThreadId: ""
};
