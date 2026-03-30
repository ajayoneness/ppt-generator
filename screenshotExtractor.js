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
 * Fetch a YouTube thumbnail URL and return as base64 PNG string for pptxgenjs.
 * Returns null if fetch fails.
 */
async function fetchThumbnail(thumbUrl) {
  try {
    const resp = await axios.get(thumbUrl, {
      responseType: "arraybuffer",
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    // YouTube returns a tiny 120x90 placeholder for missing thumbnails — skip those
    if (resp.data.byteLength < 5000) return null;

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
 * Extract 4 frame thumbnails from a YouTube video using YouTube's thumbnail API.
 * YouTube auto-generates thumbnails at 4 points in every video:
 *   /vi/{id}/1.jpg  (start quarter)
 *   /vi/{id}/2.jpg  (mid quarter)
 *   /vi/{id}/3.jpg  (end quarter)
 *   /vi/{id}/maxresdefault.jpg  (main thumbnail)
 *
 * This works on any VPS with no browser needed — pure HTTP fetch.
 * Returns array of "image/png;base64,..." strings (null entries for failures).
 * Returns null if all 4 fail entirely.
 */
async function extractYouTubeScreenshots(videoUrl, count = 4, onProgress = null) {
  const videoId = extractVideoId(videoUrl);

  if (!videoId) {
    console.error("[Screenshot] Could not extract video ID from URL:", videoUrl);
    return null;
  }

  console.log(`[Screenshot] Fetching thumbnails for video ID: ${videoId}`);

  // YouTube's auto-generated frame thumbnails (spread across the video timeline)
  const thumbUrls = [
    `https://img.youtube.com/vi/${videoId}/1.jpg`,       // ~25% into video
    `https://img.youtube.com/vi/${videoId}/2.jpg`,       // ~50% into video
    `https://img.youtube.com/vi/${videoId}/3.jpg`,       // ~75% into video
    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`, // main thumbnail
  ];

  const base64Images = [];

  for (let i = 0; i < Math.min(count, thumbUrls.length); i++) {
    const img = await fetchThumbnail(thumbUrls[i]);

    // If maxresdefault fails, try hqdefault as fallback
    const result = img || (i === 3 ? await fetchThumbnail(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`) : null);

    if (result) {
      console.log(`[Screenshot] Thumbnail ${i + 1}/${count} fetched`);
    } else {
      console.warn(`[Screenshot] Thumbnail ${i + 1}/${count} failed`);
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
