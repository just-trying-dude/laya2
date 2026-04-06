/**
 * Lyrics fetching (browser-safe, CORS-friendly when available).
 *
 * Sources (best-effort):
 * - `lyrics.ovh` (simple/plaintext) — often works for English, sometimes for Indian tracks.
 * - `lrclib.net` (timed/plain) — community database, may be sparse.
 *
 * If all fail, we return a friendly message and never crash UI.
 */

const DEFAULT_TIMEOUT_MS = 12_000;

async function fetchJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function clean(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

export async function getLyrics({ artist, title }) {
  const a = clean(artist);
  const t = clean(title);
  if (!a || !t) return { ok: false, lyrics: "", source: null, error: "Missing artist/title" };

  // 1) lyrics.ovh (typically English-friendly)
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(a)}/${encodeURIComponent(t)}`;
    const data = await fetchJson(url);
    const lyrics = String(data?.lyrics || "").trim();
    if (lyrics) return { ok: true, lyrics, source: "lyrics.ovh", error: null };
  } catch {
    // ignore
  }

  // 2) lrclib — try to get any lyric text
  try {
    const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(a)}&track_name=${encodeURIComponent(t)}`;
    const data = await fetchJson(url);
    const lyrics = String(data?.plainLyrics || data?.syncedLyrics || "").trim();
    if (lyrics) return { ok: true, lyrics, source: "lrclib", error: null };
  } catch {
    // ignore
  }

  // 3) As a last “cheap” attempt, try search endpoint (lrclib) and pick first match
  try {
    const url = `https://lrclib.net/api/search?q=${encodeURIComponent(`${a} ${t}`)}`;
    const txt = await fetchText(url);
    const arr = JSON.parse(txt);
    if (Array.isArray(arr) && arr.length) {
      const first = arr[0];
      const lyrics = String(first?.plainLyrics || first?.syncedLyrics || "").trim();
      if (lyrics) return { ok: true, lyrics, source: "lrclib", error: null };
    }
  } catch {
    // ignore
  }

  return {
    ok: false,
    lyrics: "",
    source: null,
    error: "English lyrics aren’t available for this track yet.",
  };
}

