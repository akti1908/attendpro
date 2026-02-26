# AttendPro Runbook

## 1. Деплой (production)

1. Обновить код:
```powershell
cd "C:\Users\Akti\Desktop\Attend Pro\AttendPro"
git pull --ff-only origin main
```

2. Установить зависимости:
```powershell
npm install --omit=dev
```

3. Перезапустить приложение:
```powershell
pm2 restart attendpro
pm2 save
```

4. Проверить health:
```powershell
curl http://127.0.0.1:8080/api/health
```

Ожидается:
- `ok: true`
- `scheduler.enabled: true`
- `integrations.telegramConfigured: true`
- `integrations.supabaseConfigured: true`

## 2. Откат

1. Найти стабильный commit:
```powershell
git log --oneline -n 20
```

2. Переключить рабочую копию:
```powershell
git checkout <STABLE_COMMIT_HASH>
```

3. Перезапустить сервер:
```powershell
npm install --omit=dev
pm2 restart attendpro
pm2 save
```

4. Повторно проверить `/api/health`.

## 3. Аварийный сценарий (нет отправки отчетов)

1. Проверить `/api/health`.
2. Проверить env:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
3. Проверить наличие таблицы `attendpro_report_runs` в Supabase.
4. Перезапустить PM2 процесс.

## 4. Ежедневные проверки

1. `/api/health` отвечает `ok: true`.
2. В `scheduler.lastStats` нет роста `failed`.
3. Размеры `attendpro_report_runs` и `attendpro_accounts` в норме.
