import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();
const RB_BASE = "https://de1.api.radio-browser.info/json";
const HEADERS = { "User-Agent": "VinylPlayer/1.0", Accept: "application/json" };

async function rbFetch(path: string) {
  const res = await fetch(`${RB_BASE}${path}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`Radio Browser error ${res.status}`);
  return res.json();
}

router.get("/top", async (req, res) => {
  const limit = Number(req.query["limit"] ?? 40);
  try {
    const data = await rbFetch(`/stations/topvote/${limit}?hidebroken=true&order=votes&reverse=true`);
    res.json(data);
  } catch (err) {
    logger.error({ err }, "radio /top error");
    res.status(502).json({ error: "upstream error" });
  }
});

router.get("/search", async (req, res) => {
  const name = req.query["name"] ?? "";
  const limit = Number(req.query["limit"] ?? 20);
  try {
    const params = new URLSearchParams({
      name: String(name),
      limit: String(limit),
      hidebroken: "true",
      order: "clickcount",
      reverse: "true",
    });
    const data = await rbFetch(`/stations/search?${params}`);
    res.json(data);
  } catch (err) {
    logger.error({ err }, "radio /search error");
    res.status(502).json({ error: "upstream error" });
  }
});

router.get("/nowplaying", async (req, res) => {
  const url = String(req.query["url"] ?? "");
  if (!url.startsWith("http")) return res.status(400).json({ error: "invalid url" });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, {
      headers: { "Icy-MetaData": "1", "User-Agent": "VinylPlayer/1.0", "Range": "bytes=0-65535" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const icyName = response.headers.get("icy-name") ?? "";
    const metaIntStr = response.headers.get("icy-metaint");
    const metaInt = metaIntStr ? parseInt(metaIntStr) : 0;

    if (!metaInt || !response.body) {
      return res.json({ title: "", artist: "", station: icyName, raw: "" });
    }

    // Read until we have enough bytes to reach the first metadata block
    const need = metaInt + 1 + 255 * 16;
    const reader = response.body.getReader();
    let buf = new Uint8Array(0);

    while (buf.length < need) {
      const { done, value } = await reader.read();
      if (done) break;
      const next = new Uint8Array(buf.length + value.length);
      next.set(buf); next.set(value, buf.length);
      buf = next;
    }
    reader.cancel().catch(() => {});

    if (buf.length <= metaInt) return res.json({ title: "", artist: "", station: icyName, raw: "" });

    const metaLen = buf[metaInt]! * 16;
    if (metaLen === 0) return res.json({ title: "", artist: "", station: icyName, raw: "" });

    const metaStr = new TextDecoder()
      .decode(buf.slice(metaInt + 1, metaInt + 1 + metaLen))
      .replace(/\0+$/, "");

    const streamTitle = metaStr.match(/StreamTitle='([^']*)'/)?.[1] ?? "";
    const dash = streamTitle.indexOf(" - ");
    const artist = dash > -1 ? streamTitle.slice(0, dash).trim() : "";
    const title  = dash > -1 ? streamTitle.slice(dash + 3).trim() : streamTitle;

    return res.json({ title, artist, station: icyName, raw: streamTitle });
  } catch (err: unknown) {
    clearTimeout(timeout);
    if ((err as Error).name === "AbortError") return res.status(504).json({ error: "timeout" });
    req.log.error({ err }, "radio /nowplaying error");
    return res.status(502).json({ error: "upstream error" });
  }
});

router.get("/click/:uuid", async (req, res) => {
  try {
    await fetch(`${RB_BASE}/url/${req.params["uuid"]}`, { headers: HEADERS });
  } catch {
    // fire and forget, ignore errors
  }
  res.json({ ok: true });
});

export default router;
