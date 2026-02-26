# AttendPro: локальный сервер 24/7 (Windows)

## 1. Установка

```powershell
cd "C:\Users\Akti\Desktop\Attend Pro\AttendPro"
npm install
npm install -g pm2
```

## 2. Безопасная настройка секретов (без хранения в Git)

1. Создайте файл `.env` рядом с `server.js`:

```powershell
cd "C:\Users\Akti\Desktop\Attend Pro\AttendPro"
Copy-Item .env.example .env
```

2. Откройте `.env` и заполните:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

3. Убедитесь, что `.env` не попадет в Git:
- файл уже добавлен в `.gitignore`.

## 3. Применение SQL-миграции в Supabase (обязательно)

1. Откройте `https://supabase.com/dashboard`.
2. Выберите проект AttendPro.
3. В левом меню: `SQL Editor`.
4. Нажмите `New query`.
5. Откройте файл `supabase/migrations/202602260001_attendpro_report_runs.sql`.
6. Скопируйте весь SQL в редактор Supabase.
7. Нажмите `Run`.
8. Убедитесь, что статус выполнения `Success`.

Эта миграция добавляет таблицу идемпотентности `attendpro_report_runs` для защиты от дублей отчетов.

## 4. Запуск сервера и scheduler

```powershell
cd "C:\Users\Akti\Desktop\Attend Pro\AttendPro"
pm2 start ecosystem.config.cjs
pm2 save
```

Проверка:

```powershell
curl http://127.0.0.1:8080/api/health
```

В ответе должно быть:
- `"ok": true`
- `"telegramConfigured": true`
- `"supabaseConfigured": true`

## 5. Настройка клиента (GitHub Pages / PWA)

В `config.js`:

```js
window.ATTENDPRO_TELEGRAM = {
  apiBaseUrl: "https://ВАШ-БЭКЕНД-ДОМЕН",
  schedulerMode: "server"
};
```

Важно:
- не добавляйте `botToken` в `config.js`;
- `schedulerMode: "server"` отключает критическую зависимость от открытого браузера.

## 6. Автозапуск после перезагрузки Windows

```powershell
pm2 startup
pm2 save
```

Выполните команду, которую вернет `pm2 startup` (она запускается один раз от администратора).

## 7. Обновление приложения из GitHub

```powershell
cd "C:\Users\Akti\Desktop\Attend Pro\AttendPro"
.\update-and-restart.ps1 -Branch main
```

## 8. Ротация уже скомпрометированного Telegram токена

1. Откройте Telegram и перейдите к `@BotFather`.
2. Команда `/mybots`.
3. Выберите вашего бота.
4. Нажмите `API Token` -> `Revoke current token`.
5. Сразу нажмите `Generate new token`.
6. Скопируйте новый токен.
7. Обновите `TELEGRAM_BOT_TOKEN` в `.env`.
8. Перезапустите сервер:

```powershell
cd "C:\Users\Akti\Desktop\Attend Pro\AttendPro"
pm2 restart attendpro
pm2 save
```

9. Проверьте `GET /api/health` и ручную отправку отчета из приложения.

## 9. Если нужно удалить задачу автообновления Windows Scheduler

```powershell
schtasks /Delete /TN AttendProAutoUpdate /F
```
