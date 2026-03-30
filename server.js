const express = require("express");
const path    = require("path");
const fs      = require("fs");
const crypto  = require("crypto");
const { generatePPTContent }           = require("./groqClient");
const { buildPPT }                     = require("./pptGenerator");
const { COLOR_THEMES, autoSelectTheme }= require("./colorThemes");
const { extractYouTubeScreenshots }    = require("./screenshotExtractor");

const app  = express();
const PORT = 3000;

const OUTPUT_DIR = path.join(__dirname, "output");
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ── Job + SSE storage ─────────────────────────────────────────────────────────
const jobs      = new Map(); // jobId → job object
const sseClients= new Map(); // jobId → SSE response

function makeId() { return crypto.randomBytes(8).toString("hex"); }

function sendProgress(jobId, progress, message, status = "running") {
  const job = jobs.get(jobId);
  if (job) { job.progress = progress; job.message = message; job.status = status; }
  const client = sseClients.get(jobId);
  if (client && !client.destroyed) {
    client.write(`data: ${JSON.stringify({ jobId, progress, message, status })}\n\n`);
    if (status === "complete" || status === "error") {
      setTimeout(() => { try { client.end(); } catch (_) {} sseClients.delete(jobId); }, 3000);
    }
  }
}

// Auto-clean files older than 1 hour
setInterval(() => {
  const cutoff = Date.now() - 3_600_000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) {
      if (job.outputPath) { try { fs.unlinkSync(job.outputPath); } catch (_) {} }
      jobs.delete(id);
    }
  }
}, 300_000);

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/themes", (_req, res) => {
  res.json(Object.entries(COLOR_THEMES).map(([key, v]) => ({
    key, name: v.name, description: v.description,
    primaryHex: "#" + v.primary, accentHex: "#" + v.accent,
  })));
});

// Start a new generation job
app.post("/generate", (req, res) => {
  const { title, description, technologies, demoVideo, colorTheme } = req.body;
  const apiKey = req.headers["x-groq-api-key"] || null;

  if (!title || !description)
    return res.status(400).json({ error: "Title and description are required." });

  const themeKey = (colorTheme && colorTheme !== "auto" && COLOR_THEMES[colorTheme])
    ? colorTheme : autoSelectTheme(title, description);

  const jobId = makeId();
  jobs.set(jobId, {
    id: jobId, title, themeKey, status: "running",
    progress: 0, message: "Starting...",
    outputPath: null, error: null, createdAt: Date.now()
  });

  res.json({ jobId, themeKey }); // respond immediately — job runs in background

  runJob(jobId, { title, description, technologies, demoVideo, colorTheme: themeKey }, apiKey)
    .catch(err => {
      console.error(`[Job ${jobId}] Unhandled:`, err.message);
      sendProgress(jobId, 0, "❌ " + err.message, "error");
    });
});

async function runJob(jobId, params, apiKey) {
  const send = (pct, msg, st = "running") => sendProgress(jobId, pct, msg, st);
  const C    = COLOR_THEMES[params.colorTheme];
  const isYT = /youtu(\.be|be\.com)/i.test(params.demoVideo);

  try {
    send(5, "Initializing…");

    send(8, isYT
      ? "🤖 Calling Groq AI  &  📽 Launching browser for screenshots…"
      : "🤖 Calling Groq AI to generate slide content…");

    const [pptData, screenshots] = await Promise.all([
      generatePPTContent(params, apiKey),
      isYT
        ? extractYouTubeScreenshots(params.demoVideo, 4, (frameNum) =>
            send(10 + frameNum * 10, `📷 Screenshot ${frameNum}/4 captured`))
        : Promise.resolve(null)
    ]);

    send(55, "✅ Content ready — building presentation…");

    const safeTitle = params.title
      .replace(/[^a-zA-Z0-9 _-]/g, "").replace(/\s+/g, "_").slice(0, 40);
    const outputPath = path.join(OUTPUT_DIR, `${safeTitle}_${jobId}.pptx`);

    await buildPPT(pptData, C, outputPath, screenshots, (slideNum) =>
      send(55 + Math.round((slideNum / 15) * 40), `📄 Building slide ${slideNum} / 15…`));

    const job = jobs.get(jobId);
    if (job) job.outputPath = outputPath;

    send(100, "✅ Presentation ready to download!", "complete");
    console.log(`[Job ${jobId}] Done → ${outputPath}`);

  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message || "Unknown error";
    console.error(`[Job ${jobId}] Error:`, msg);
    const job = jobs.get(jobId);
    if (job) job.error = msg;
    send(0, "❌ " + msg, "error");
  }
}

// SSE stream for a specific job
app.get("/progress/:jobId", (req, res) => {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.flushHeaders();

  const { jobId } = req.params;
  sseClients.set(jobId, res);

  // Send current state immediately on connect
  const job = jobs.get(jobId);
  if (job) {
    res.write(`data: ${JSON.stringify({
      jobId, progress: job.progress, message: job.message, status: job.status
    })}\n\n`);
  }

  req.on("close", () => sseClients.delete(jobId));
});

// Download completed PPT
app.get("/download/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job || !job.outputPath || !fs.existsSync(job.outputPath))
    return res.status(404).json({ error: "File not found or expired." });
  const fname = job.title.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_").slice(0, 40) + ".pptx";
  res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  res.sendFile(path.resolve(job.outputPath));
});

// List all jobs (metadata only)
app.get("/jobs", (_req, res) => {
  res.json(
    [...jobs.values()]
      .map(j => ({
        id: j.id, title: j.title, themeKey: j.themeKey,
        status: j.status, progress: j.progress, message: j.message,
        createdAt: j.createdAt,
        hasFile: !!(j.outputPath && fs.existsSync(j.outputPath))
      }))
      .sort((a, b) => b.createdAt - a.createdAt)
  );
});

// Delete a job
app.delete("/jobs/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (job?.outputPath) { try { fs.unlinkSync(job.outputPath); } catch (_) {} }
  jobs.delete(req.params.jobId);
  res.json({ ok: true });
});

// Test API key
app.post("/test-api-key", async (req, res) => {
  const apiKey = req.headers["x-groq-api-key"] || null;
  const axios  = require("axios");
  try {
    await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      { model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [{ role: "user", content: "Reply with just: OK" }],
        max_tokens: 5 },
      { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, timeout: 15000 }
    );
    res.json({ ok: true });
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    res.status(400).json({ ok: false, error: msg });
  }
});

app.listen(PORT, () => {
  console.log(`\n  AI PPT Generator  →  http://localhost:${PORT}\n`);
});
