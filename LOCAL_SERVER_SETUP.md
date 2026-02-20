# AttendPro: локальный сервер 24/7 (Windows)

## 1. Установка зависимостей

```powershell
cd "C:\Users\Akti\Desktop\Attend Pro\AttendPro"
npm install
npm install -g pm2
```

## 2. Первый запуск сервера

```powershell
pm2 start ecosystem.config.cjs
pm2 save
```

Проверка в браузере:

`http://localhost:8080`

Если нужно открыть для других устройств в вашей сети:

`http://<IP_вашего_ПК>:8080`

## 3. Автозапуск после перезагрузки Windows

Выполните команду и запустите ту строку, которую покажет PM2:

```powershell
pm2 startup
```

После этого еще раз:

```powershell
pm2 save
```

## 4. Обновление приложения из GitHub

Один раз:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Далее при каждом обновлении:

```powershell
cd "C:\Users\Akti\Desktop\Attend Pro\AttendPro"
.\update-and-restart.ps1 -Branch main
```

Этот скрипт:
- подтянет изменения из GitHub,
- обновит `node_modules`,
- перезапустит сервер PM2.

## 5. Автообновление без ручного запуска (опционально)

Создать задачу Windows Scheduler, которая будет обновлять приложение автоматически:

```powershell
cd "C:\Users\Akti\Desktop\Attend Pro\AttendPro"
.\create-auto-update-task.ps1 -Branch main -EveryMinutes 10
```

Удалить задачу, если нужно:

```powershell
schtasks /Delete /TN AttendProAutoUpdate /F
```
