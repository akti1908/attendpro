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

app.use(express.static(rootDir, { extensions: ["html"] }));

app.get("*", (_req, res) => {
  res.sendFile(path.join(rootDir, "index.html"));
});

app.listen(port, host, () => {
  console.log(`AttendPro local server started: http://${host}:${port}`);
});
