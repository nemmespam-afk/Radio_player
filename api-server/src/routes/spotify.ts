import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const SPOTIFY_CLIENT_ID = process.env["SPOTIFY_CLIENT_ID"] ?? "";
const SPOTIFY_CLIENT_SECRET = process.env["SPOTIFY_CLIENT_SECRET"] ?? "";
const REDIRECT_URI = process.env["SPOTIFY_REDIRECT_URI"] ?? "";

const SCOPES = [
  "user-read-currently-playing",
  "user-read-playback-state",
  "user-modify-playback-state",
].join(" ");

declare module "express-serve-static-core" {
  interface Request {
    session: {
      spotifyAccessToken?: string;
      spotifyRefreshToken?: string;
      spotifyTokenExpiry?: number;
    };
  }
}

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number } | null> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) return null;
  const data = await res.json() as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

async function getValidToken(req: any): Promise<string | null> {
  const now = Date.now();
  const expiry = req.session.spotifyTokenExpiry ?? 0;

  if (req.session.spotifyAccessToken && now < expiry - 60_000) {
    return req.session.spotifyAccessToken as string;
  }

  if (req.session.spotifyRefreshToken) {
    const result = await refreshAccessToken(req.session.spotifyRefreshToken as string);
    if (result) {
      req.session.spotifyAccessToken = result.accessToken;
      req.session.spotifyTokenExpiry = now + result.expiresIn * 1000;
      return result.accessToken;
    }
  }

  return null;
}

router.get("/login", (_req, res) => {
  if (!SPOTIFY_CLIENT_ID) {
    res.status(500).json({ error: "SPOTIFY_CLIENT_ID not configured" });
    return;
  }
  const params = new URLSearchParams({
    response_type: "code",
    client_id: SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
});

router.get("/callback", async (req, res) => {
  const code = req.query["code"] as string | undefined;
  if (!code) {
    res.status(400).json({ error: "Missing code" });
    return;
  }

  const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  });

  try {
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      logger.error({ text }, "Spotify token exchange failed");
      res.status(500).json({ error: "Token exchange failed" });
      return;
    }

    const data = await tokenRes.json() as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    (req as any).session.spotifyAccessToken = data.access_token;
    (req as any).session.spotifyRefreshToken = data.refresh_token;
    (req as any).session.spotifyTokenExpiry = Date.now() + data.expires_in * 1000;

    res.redirect("/");
  } catch (err) {
    logger.error({ err }, "Spotify callback error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.get("/status", (req, res) => {
  const loggedIn = !!(req as any).session?.spotifyAccessToken;
  res.json({ loggedIn });
});

router.get("/now-playing", async (req, res) => {
  const token = await getValidToken(req);
  if (!token) {
    res.status(401).json({ error: "not_authenticated" });
    return;
  }

  try {
    const spotifyRes = await fetch("https://api.spotify.com/v1/me/player?additional_types=track", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (spotifyRes.status === 204) {
      res.json({ playing: false, track: null });
      return;
    }

    if (!spotifyRes.ok) {
      res.status(502).json({ error: "Spotify API error" });
      return;
    }

    const data = await spotifyRes.json() as any;

    const track = data.item;
    if (!track) {
      res.json({ playing: false, track: null });
      return;
    }

    res.json({
      playing: data.is_playing,
      track: {
        id: track.id,
        title: track.name,
        artist: track.artists?.map((a: any) => a.name).join(", ") ?? "",
        albumArt: track.album?.images?.[0]?.url ?? null,
        durationMs: track.duration_ms,
        progressMs: data.progress_ms,
      },
    });
  } catch (err) {
    logger.error({ err }, "now-playing error");
    res.status(500).json({ error: "Internal error" });
  }
});

router.post("/play", async (req, res) => {
  const token = await getValidToken(req);
  if (!token) { res.status(401).json({ error: "not_authenticated" }); return; }
  await fetch("https://api.spotify.com/v1/me/player/play", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });
  res.json({ ok: true });
});

router.post("/pause", async (req, res) => {
  const token = await getValidToken(req);
  if (!token) { res.status(401).json({ error: "not_authenticated" }); return; }
  await fetch("https://api.spotify.com/v1/me/player/pause", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
  });
  res.json({ ok: true });
});

router.post("/next", async (req, res) => {
  const token = await getValidToken(req);
  if (!token) { res.status(401).json({ error: "not_authenticated" }); return; }
  await fetch("https://api.spotify.com/v1/me/player/next", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  res.json({ ok: true });
});

router.post("/previous", async (req, res) => {
  const token = await getValidToken(req);
  if (!token) { res.status(401).json({ error: "not_authenticated" }); return; }
  await fetch("https://api.spotify.com/v1/me/player/previous", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  res.json({ ok: true });
});

router.post("/logout", (req, res) => {
  (req as any).session.spotifyAccessToken = undefined;
  (req as any).session.spotifyRefreshToken = undefined;
  (req as any).session.spotifyTokenExpiry = undefined;
  res.json({ ok: true });
});

export default router;
