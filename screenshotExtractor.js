const puppeteer = require("puppeteer");
const sharp     = require("sharp");
const path      = require("path");
const fs        = require("fs");
const os        = require("os");

/**
 * Parse "HH:MM:SS" or "MM:SS" or "SS" duration string → total seconds
 */
function parseDuration(str) {
  const parts = str.trim().split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0];
}

/**
 * Pick `count` timestamps spread across 4 equal sections of the video.
 * Avoids the first 5% and last 5% (intros/outros).
 */
function pickTimestamps(durationSecs, count = 4) {
  const start = durationSecs * 0.05;
  const end   = durationSecs * 0.95;
  const span  = end - start;
  const sectionSize = span / count;

  return Array.from({ length: count }, (_, i) => {
    const sectionStart = start + i * sectionSize;
    return sectionStart + Math.random() * sectionSize;
  });
}

/**
 * Extract 4 screenshots from a YouTube video using a headless browser.
 * Seeks the video player to each timestamp and screenshots the video element.
 * Returns array of "image/png;base64,..." strings for pptxgenjs.
 * Returns null if extraction fails entirely (caller falls back to placeholders).
 */
async function extractYouTubeScreenshots(videoUrl, count = 4, onProgress = null) {
  let browser;
  try {
    console.log(`[Screenshot] Launching headless browser for: ${videoUrl}`);

    // Find Chrome/Chromium executable — try bundled Puppeteer first, then system
    let executablePath;
    try {
      const { executablePath: bundled } = require("puppeteer");
      executablePath = bundled();
    } catch (_) {}
    if (!executablePath) {
      const systemPaths = [
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium-browser",
        "/usr/bin/chromium",
      ];
      const fs2 = require("fs");
      executablePath = systemPaths.find(p => { try { return fs2.existsSync(p); } catch(_){return false;} });
    }

    browser = await puppeteer.launch({
      headless: "new",
      executablePath: executablePath || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--mute-audio",
        "--autoplay-policy=no-user-gesture-required",
        "--disable-blink-features=AutomationControlled",
        "--window-size=1280,720",
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Use a realistic user-agent so YouTube doesn't block headless detection
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Navigate with autoplay + mute params for cleaner loading
    const url = new URL(videoUrl);
    url.searchParams.set("autoplay", "1");
    url.searchParams.set("mute", "1");

    console.log("[Screenshot] Loading YouTube page...");
    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 60000 });

    // Wait a bit for JS to run
    await new Promise(r => setTimeout(r, 3000));

    // Dismiss cookie/consent/age-gate banners — try multiple selectors
    for (const sel of [
      'button[aria-label*="Accept all"]',
      'button[aria-label*="Accept All"]',
      'button[aria-label*="accept"]',
      'form[action*="consent"] button',
      'button.yt-spec-button-shape-next[aria-label*="ccept"]',
      '#dialog button',
      'tp-yt-paper-button[aria-label*="ccept"]',
    ]) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          console.log(`[Screenshot] Dismissed consent banner via: ${sel}`);
          await new Promise(r => setTimeout(r, 2000));
          break;
        }
      } catch (_) {}
    }

    // Wait for the video element to appear
    await page.waitForSelector("video", { timeout: 30000 });

    // Click play to trigger media load
    await page.evaluate(() => {
      const v = document.querySelector("video");
      if (v) v.play().catch(() => {});
    });

    // Wait until video.duration is a valid finite number (not NaN / 0)
    console.log("[Screenshot] Waiting for video duration to load...");
    await page.waitForFunction(
      () => {
        const v = document.querySelector("video");
        return v && isFinite(v.duration) && v.duration > 10;
      },
      { timeout: 30000 }
    );

    const durationSecs = await page.evaluate(() => {
      const v = document.querySelector("video");
      return v ? v.duration : 0;
    });

    if (!durationSecs || durationSecs < 10) {
      throw new Error(`Invalid video duration: ${durationSecs}s`);
    }

    console.log(`[Screenshot] Video duration: ${durationSecs.toFixed(1)}s`);

    await new Promise(r => setTimeout(r, 1000)); // brief settle

    const timestamps = pickTimestamps(durationSecs, count);
    console.log(`[Screenshot] Timestamps: ${timestamps.map(t => t.toFixed(1) + "s").join(", ")}`);

    const base64Images = [];

    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      try {
        // Seek to the timestamp via JavaScript
        await page.evaluate((seekTo) => {
          const v = document.querySelector("video");
          if (v) {
            v.currentTime = seekTo;
            v.pause(); // pause so the frame is stable
          }
        }, ts);

        // Wait for the seeked event + a short settle time
        await page.waitForFunction(
          (seekTo) => {
            const v = document.querySelector("video");
            return v && Math.abs(v.currentTime - seekTo) < 3;
          },
          { timeout: 10000 },
          ts
        );
        await new Promise(r => setTimeout(r, 800));

        // Find the video element's bounding box and screenshot just that area
        const videoEl = await page.$("video");
        if (!videoEl) throw new Error("Video element not found");

        const box = await videoEl.boundingBox();
        if (!box || box.width < 10) throw new Error("Video element not visible");

        const screenshotBuf = await page.screenshot({
          clip: {
            x: Math.max(0, box.x),
            y: Math.max(0, box.y),
            width:  Math.min(box.width,  1280),
            height: Math.min(box.height, 720),
          },
          type: "png",
        });

        // Resize to 960px wide for consistent PPT embedding
        const resized = await sharp(screenshotBuf)
          .resize(960, undefined, { fit: "inside" })
          .png()
          .toBuffer();

        base64Images.push("image/png;base64," + resized.toString("base64"));
        console.log(`[Screenshot] Frame ${i + 1}/${count} captured at ${ts.toFixed(1)}s`);
        onProgress?.(i + 1);
      } catch (frameErr) {
        console.warn(`[Screenshot] Frame ${i + 1} failed at ${ts.toFixed(1)}s: ${frameErr.message}`);
        base64Images.push(null);
      }
    }

    return base64Images;

  } catch (err) {
    console.error("[Screenshot] Extraction failed:", err.message);
    return null;
  } finally {
    if (browser) {
      try { await browser.close(); } catch (_) {}
    }
  }
}

module.exports = { extractYouTubeScreenshots };
