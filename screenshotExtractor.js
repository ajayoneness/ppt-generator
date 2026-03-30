const axios = require("axios");
const sharp = require("sharp");

/**
 * Extract the YouTube video ID from any YouTube URL format.
 */
function extractVideoId(url) {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0];
    return u.searchParams.get("v") || null;
  } catch (_) {
    return null;
  }
}

/**
 * Fetch a single YouTube thumbnail URL → base64 PNG for pptxgenjs.
 * minSize: minimum byte size to accept (filters out YouTube's grey "missing" placeholder ~1.2KB)
 */
async function fetchThumbnail(thumbUrl, minSize = 1500) {
  try {
    const resp = await axios.get(thumbUrl, {
      responseType: "arraybuffer",
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (resp.data.byteLength < minSize) return null;

    const resized = await sharp(Buffer.from(resp.data))
      .resize(960, undefined, { fit: "inside" })
      .png()
      .toBuffer();

    return "image/png;base64," + resized.toString("base64");
  } catch (_) {
    return null;
  }
}

/**
 * Extract 4 thumbnails from a YouTube video using YouTube's public thumbnail CDN.
 *
 * Priority per slot:
 *  Slot 0 → maxresdefault (1280×720) → sddefault (640×480) → hqdefault (480×360)
 *  Slot 1 → 1.jpg (frame ~25% in)    → hqdefault fallback
 *  Slot 2 → 2.jpg (frame ~50% in)    → sddefault fallback
 *  Slot 3 → 3.jpg (frame ~75% in)    → mqdefault fallback
 *
 * All fetched via plain HTTPS — no browser, works on any VPS.
 * Returns array of "image/png;base64,..." strings (null for failures).
 * Returns null only if every single slot fails.
 */
async function extractYouTubeScreenshots(videoUrl, count = 4, onProgress = null) {
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    console.error("[Screenshot] Could not extract video ID from URL:", videoUrl);
    return null;
  }

  console.log(`[Screenshot] Fetching thumbnails for video ID: ${videoId}`);

  const base = `https://img.youtube.com/vi/${videoId}`;

  // Each slot: ordered list of URLs to try until one succeeds.
  // Prioritize high-res variants — 1/2/3.jpg are only 120x90 and look blurry when upscaled.
  const slots = [
    [`${base}/maxresdefault.jpg`, `${base}/sddefault.jpg`,  `${base}/hqdefault.jpg`],
    [`${base}/sddefault.jpg`,     `${base}/maxresdefault.jpg`, `${base}/hqdefault.jpg`],
    [`${base}/hqdefault.jpg`,     `${base}/sddefault.jpg`,  `${base}/maxresdefault.jpg`],
    [`${base}/mqdefault.jpg`,     `${base}/hqdefault.jpg`,  `${base}/sddefault.jpg`],
  ];

  const base64Images = [];

  for (let i = 0; i < Math.min(count, slots.length); i++) {
    let result = null;
    for (const url of slots[i]) {
      result = await fetchThumbnail(url, 3000);
      if (result) break;
    }

    if (result) {
      console.log(`[Screenshot] Thumbnail ${i + 1}/${count} fetched`);
    } else {
      console.warn(`[Screenshot] Thumbnail ${i + 1}/${count} failed (all fallbacks exhausted)`);
    }

    base64Images.push(result);
    onProgress?.(i + 1);
  }

  const successCount = base64Images.filter(Boolean).length;
  if (successCount === 0) {
    console.error("[Screenshot] All thumbnails failed");
    return null;
  }

  console.log(`[Screenshot] ${successCount}/${count} thumbnails captured`);
  return base64Images;
}

module.exports = { extractYouTubeScreenshots };
