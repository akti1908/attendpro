const express = require("express");
const path = require("path");

const app = express();
const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 8080);
const rootDir = __dirname;

app.disable("x-powered-by");

// Disable browser cache for faster update visibility after deploy/pull.
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use(express.json({ limit: "256kb" }));

app.post("/api/telegram/send-report", async (req, res) => {
  const botToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const chatId = String(process.env.TELEGRAM_CHAT_ID || "").trim();
  const messageThreadIdRaw = String(process.env.TELEGRAM_MESSAGE_THREAD_ID || "").trim();
  const text = String(req.body?.text || "").trim();

  if (!botToken || !chatId) {
    return res.status(400).json({
      ok: false,
      message: "Telegram не настроен на сервере: задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID."
    });
  }

  if (!text) {
    return res.status(400).json({
      ok: false,
      message: "Пустой отчет не может быть отправлен."
    });
  }

  if (typeof fetch !== "function") {
    return res.status(500).json({
      ok: false,
      message: "Текущая версия Node.js не поддерживает fetch. Обновите Node.js до 18+."
    });
  }

  const payload = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    allow_sending_without_reply: true
  };

  const messageThreadId = Number(messageThreadIdRaw);
  if (Number.isInteger(messageThreadId) && messageThreadId > 0) {
    payload.message_thread_id = messageThreadId;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let parsed = null;
    try {
      parsed = responseText ? JSON.parse(responseText) : null;
    } catch (_error) {
      parsed = null;
    }

    if (!response.ok || !parsed?.ok) {
      const detail = parsed?.description || `HTTP ${response.status}`;
      return res.status(502).json({
        ok: false,
        message: `Ошибка Telegram API: ${detail}`
      });
    }

    return res.json({
      ok: true,
      message: "Отчет отправлен в Telegram."
    });
  } catch (error) {
    console.error("Telegram send-report error:", error);
    return res.status(500).json({
      ok: false,
      message: "Не удалось связаться с Telegram API."
    });
  }
});

app.use(express.static(rootDir, { extensions: ["html"] }));

app.get("*", (_req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

app.listen(port, host, () => {
  console.log(`AttendPro local server started: http://${host}:${port}`);
});
