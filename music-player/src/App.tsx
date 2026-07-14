import React, { useState, useEffect, useRef, useCallback } from "react";
import { Radio, Search, X, Heart, Music } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Station {
  stationuuid: string;
  name: string;
  url_resolved: string;
  favicon: string;
  country: string;
  tags: string;
  bitrate: number;
}

type View = "favorites" | "all";

// ─── Favorites ────────────────────────────────────────────────────────────────

const FAVORITE_DEFS = [
  {
    searchName: "RTL Radio Letzebuerg",
    displayName: "RTL Lëtzebuerg",
    fallbackUrl: "https://shoutcast.rtl.lu/rtlradio",
    country: "Luxembourg",
    tags: "luxembourgish,news,music",
    color: "#c0392b",
  },
  {
    searchName: "RTL Radio - Deutschlands Hit-Radio",
    displayName: "RTL Deutschlands Hitradio",
    fallbackUrl: "https://stream.rtlradio.de/rtl-de-national/mp3-192/",
    country: "Germany",
    tags: "pop,hits",
    color: "#e74c3c",
  },
  {
    searchName: "eldoradio",
    displayName: "Eldoradio",
    fallbackUrl: "https://sc.bce.lu/eldo",
    country: "Luxembourg",
    tags: "pop,luxembourg",
    color: "#8e44ad",
  },
  {
    searchName: "Radio 100,7",
    displayName: "Radio 100,7",
    fallbackUrl: "https://100komma7.cast.addradio.de/100komma7/live/mp3/128/stream.mp3",
    country: "Luxembourg",
    tags: "culture,luxembourg",
    color: "#2980b9",
  },
] as const;

// ─── API ──────────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = `${BASE}/api/radio`;

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.json() as Promise<T>;
}

async function searchStation(name: string): Promise<Station | null> {
  try {
    const data = await apiFetch<Station[]>(`/search?name=${encodeURIComponent(name)}&limit=5`);
    return data.find((s) => s.url_resolved) ?? null;
  } catch { return null; }
}

async function fetchTopStations(limit = 40): Promise<Station[]> {
  try {
    const data = await apiFetch<Station[]>(`/top?limit=${limit}`);
    return data.filter((s) => s.url_resolved);
  } catch { return []; }
}

async function doSearch(query: string): Promise<Station[]> {
  try {
    const data = await apiFetch<Station[]>(`/search?name=${encodeURIComponent(query)}&limit=25`);
    return data.filter((s) => s.url_resolved);
  } catch { return []; }
}

// ─── Station Logo ─────────────────────────────────────────────────────────────

function StationLogo({ url, name, color }: { url: string; name: string; color?: string }) {
  const [err, setErr] = useState(false);
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  if (!url || err) {
    return (
      <div
        className="w-full h-full flex items-center justify-center"
        style={{ background: color ?? "#333" }}
      >
        <span className="text-white font-bold select-none" style={{ fontSize: "clamp(10px,30%,20px)" }}>
          {initials}
        </span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={name}
      className="w-full h-full object-contain p-1"
      onError={() => setErr(true)}
    />
  );
}

// ─── Tonearm ──────────────────────────────────────────────────────────────────
// Pivot at SVG (298, 24). Record center in SVG space: (128, 156), radius 128.
// Arm length from pivot to needle tip: 122px.
// CSS rotate is CW positive. +28° → needle on outer groove (r≈115).
// +10° → needle lifted off record (arm swings right).

function Tonearm({ lifted, scale = 1, onClick }: { lifted: boolean; scale?: number; onClick?: () => void }) {
  const angle = lifted ? 10 : 28;
  return (
    <svg
      width={320 * scale} height={300 * scale} viewBox="0 0 320 300"
      className="absolute pointer-events-none"
      style={{ top: -28 * scale, left: 0, overflow: "visible", zIndex: 20 }}
    >
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#484848" />
          <stop offset="30%" stopColor="#c0c0c0" />
          <stop offset="65%" stopColor="#d0d0d0" />
          <stop offset="100%" stopColor="#484848" />
        </linearGradient>
        <linearGradient id="pg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#c0c0c0" />
          <stop offset="50%" stopColor="#888" />
          <stop offset="100%" stopColor="#444" />
        </linearGradient>
        <filter id="taShadow">
          <feDropShadow dx="1" dy="2" stdDeviation="2" floodOpacity="0.55" />
        </filter>
      </defs>

      {/* Arm group rotates around pivot — clickable */}
      <g
        style={{
          transform: `rotate(${angle}deg)`,
          transformOrigin: `${298 * scale}px ${24 * scale}px`,
          transition: "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
          pointerEvents: onClick ? "all" : "none",
          cursor: onClick ? "pointer" : "default",
        }}
        filter="url(#taShadow)"
        onClick={onClick}
      >
        {/* Arm body */}
        <path d="M 293 28 L 295 128 L 301 128 L 303 28 Z" fill="url(#ag)" />
        {/* Highlight */}
        <path d="M 297 28 L 297.5 128 L 299 128 L 299.5 28 Z" fill="rgba(255,255,255,0.2)" />
        {/* Cartridge head */}
        <rect x="288" y="126" width="20" height="7" rx="2" fill="#888" />
        <rect x="283" y="131" width="30" height="5" rx="2" fill="#666" />
        {/* Needle */}
        <line x1="298" y1="136" x2="298" y2="146" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="298" cy="146" r="2" fill="#bbb" />
      </g>

      {/* Static pivot */}
      <circle cx="298" cy="24" r="13" fill="url(#pg)" stroke="#888" strokeWidth="1"
        style={{ pointerEvents: onClick ? "all" : "none", cursor: onClick ? "pointer" : "default" }}
        onClick={onClick}
      />
      <circle cx="298" cy="24" r="7" fill="#222" style={{ pointerEvents: "none" }} />
      <circle cx="298" cy="24" r="3" fill="#aaa" style={{ pointerEvents: "none" }} />
      <circle cx="298" cy="24" r="1.5" fill="#555" style={{ pointerEvents: "none" }} />
      {/* Arm rest notch */}
      <rect x="311" y="20" width="12" height="4" rx="2" fill="#555" style={{ pointerEvents: "none" }} />
    </svg>
  );
}

// ─── Vinyl Record (with volume-drag) ─────────────────────────────────────────

function VinylRecord({
  station,
  stationColor,
  isPlaying,
  isBuffering,
  onVolumeRotate,
  onTonearmClick,
  size = 256,
}: {
  station: Station | null;
  stationColor?: string;
  isPlaying: boolean;
  isBuffering: boolean;
  onVolumeRotate: (delta: number) => void;
  onTonearmClick?: () => void;
  size?: number;
}) {
  const [logoErr, setLogoErr] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const recordRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const lastAngle = useRef(0);
  const rotDeg = useRef(0);
  const rafId = useRef<number | null>(null);
  const lastTs = useRef<number | null>(null);
  const isPlayingRef = useRef(isPlaying);

  // Keep ref in sync with prop (avoids stale closure in rAF)
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  useEffect(() => { setLogoErr(false); }, [station?.stationuuid]);

  // requestAnimationFrame spin loop — also used for drag rotation
  useEffect(() => {
    const RPM = 33.3;
    const DEG_PER_MS = (RPM * 360) / 60 / 1000;

    const tick = (ts: number) => {
      if (isPlayingRef.current && lastTs.current !== null) {
        rotDeg.current = (rotDeg.current + DEG_PER_MS * (ts - lastTs.current)) % 360;
        if (recordRef.current) {
          recordRef.current.style.transform = `rotate(${rotDeg.current}deg)`;
        }
      }
      lastTs.current = ts;
      rafId.current = requestAnimationFrame(tick);
    };

    rafId.current = requestAnimationFrame(tick);
    return () => { if (rafId.current !== null) cancelAnimationFrame(rafId.current); };
  }, []);

  const getPtrAngle = (e: React.PointerEvent): number => {
    const rect = containerRef.current!.getBoundingClientRect();
    return Math.atan2(
      e.clientY - (rect.top + rect.height / 2),
      e.clientX - (rect.left + rect.width / 2)
    ) * (180 / Math.PI);
  };

  const handlePtrDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDragging.current = true;
    lastAngle.current = getPtrAngle(e);
  };

  const handlePtrMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const newA = getPtrAngle(e);
    let delta = newA - lastAngle.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    lastAngle.current = newA;
    // Rotate record visually (accumulate into shared ref so rAF sees it)
    rotDeg.current = (rotDeg.current + delta) % 360;
    if (recordRef.current) {
      recordRef.current.style.transform = `rotate(${rotDeg.current}deg)`;
    }
    onVolumeRotate(delta);
  };

  const handlePtrUp = () => { isDragging.current = false; };

  const showLogo = station?.favicon && !logoErr;
  const tonearmScale = size / 256;

  return (
    <div
      className="relative select-none"
      style={{ width: size, height: size }}
    >
      {/* Ambient glow */}
      <div className="absolute -inset-6 bg-black/50 rounded-full blur-2xl pointer-events-none" />

      {/* Spinning record — rotation driven by rAF loop above */}
      <div
        ref={containerRef}
        className="rounded-full cursor-grab active:cursor-grabbing"
        style={{ width: size, height: size, touchAction: "none" }}
        onPointerDown={handlePtrDown}
        onPointerMove={handlePtrMove}
        onPointerUp={handlePtrUp}
        onPointerCancel={handlePtrUp}
      >
      <div
        ref={recordRef}
        className="w-full h-full rounded-full vinyl-grooves relative border-[4px] border-[#0a0a0a] shadow-[0_20px_60px_rgba(0,0,0,0.9),inset_0_0_15px_rgba(255,255,255,0.04)]"
      >
        <div className="vinyl-shine" />

        {/* Center label */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40%] h-[40%] rounded-full z-10 border-2 border-[#1a1a1a] overflow-hidden">
          <AnimatePresence mode="wait">
            {station ? (
              <motion.div
                key={station.stationuuid}
                className="w-full h-full bg-white"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {showLogo ? (
                  <img
                    src={station.favicon}
                    alt=""
                    className="w-full h-full object-contain p-1.5"
                    onError={() => setLogoErr(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: stationColor ?? "#333" }}>
                    <span className="text-white font-bold text-[11px] text-center leading-tight px-1">
                      {station.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                    </span>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="empty" className="w-full h-full bg-zinc-900 flex items-center justify-center">
                <Radio className="w-6 h-6 text-zinc-500" />
              </motion.div>
            )}
          </AnimatePresence>
          {/* Spindle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-zinc-700 rounded-full border border-zinc-900 z-20 pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-zinc-300 rounded-full z-20 pointer-events-none" />
        </div>
      </div>
      </div>

      <Tonearm lifted={!isPlaying || isBuffering} scale={tonearmScale} onClick={onTonearmClick} />
    </div>
  );
}

function LiveBadge() {
  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-600/20 border border-red-500/40">
      <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
      <span className="text-[10px] font-semibold text-red-400 tracking-widest uppercase">Live</span>
    </div>
  );
}

// ─── Volume ring indicator ────────────────────────────────────────────────────

function VolumeRing({ volume }: { volume: number }) {
  const R = 18;
  const C = 22;
  const pt = (deg: number) => ({
    x: C + R * Math.sin((deg * Math.PI) / 180),
    y: C - R * Math.cos((deg * Math.PI) / 180),
  });
  const A_MIN = -120, A_MAX = 120;
  const angle = A_MIN + volume * (A_MAX - A_MIN);
  const s = pt(A_MIN), e = pt(A_MAX), cur = pt(angle);
  const span = angle - A_MIN;

  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Volume2 className="w-3.5 h-3.5 flex-shrink-0" />
      <svg width="44" height="44" viewBox="0 0 44 44">
        <path d={`M ${s.x.toFixed(1)} ${s.y.toFixed(1)} A ${R} ${R} 0 1 1 ${e.x.toFixed(1)} ${e.y.toFixed(1)}`}
          fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" strokeLinecap="round" />
        {span > 0 && (
          <path d={`M ${s.x.toFixed(1)} ${s.y.toFixed(1)} A ${R} ${R} 0 ${span > 180 ? 1 : 0} 1 ${cur.x.toFixed(1)} ${cur.y.toFixed(1)}`}
            fill="none" stroke="hsl(45,60%,55%)" strokeWidth="3" strokeLinecap="round" />
        )}
      </svg>
      <span className="text-xs tabular-nums w-8">{Math.round(volume * 100)}%</span>
    </div>
  );
}

// ─── Layout hook ──────────────────────────────────────────────────────────────

function useLayout() {
  const compute = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const isLandscape = w > h * 1.15;
    // Portrait: scale up to 72% of width, but pivot must stay on-screen (scale ≤ w/340)
    // Landscape: height is the constraint; vinyl goes in left panel
    const vinylSize = isLandscape
      ? Math.min(Math.floor((h - 70) * 0.80), 240)
      : Math.min(Math.floor(w * 0.82), 340);
    return { isLandscape, vinylSize };
  };
  const [layout, setLayout] = useState(compute);
  useEffect(() => {
    const handler = () => setLayout(compute());
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return layout;
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [favorites, setFavorites] = useState<(Station & { color: string })[]>([]);
  const [allStations, setAllStations] = useState<Station[]>([]);
  const [view, setView] = useState<View>("favorites");
  const [currentStation, setCurrentStation] = useState<Station | null>(null);
  const [currentColor, setCurrentColor] = useState<string>("#333");
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [loading, setLoading] = useState(true);
  const [volume, setVolume] = useState(0.75);

  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Station[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [nowPlaying, setNowPlaying] = useState<{ title: string; artist: string; raw: string }>({ title: "", artist: "", raw: "" });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const npInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeList = view === "favorites" ? favorites : allStations;
  const currentIndex = activeList.findIndex((s) => s.stationuuid === currentStation?.stationuuid);

  // Init audio once
  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.75;
    audio.addEventListener("playing", () => { setIsPlaying(true); setIsBuffering(false); });
    audio.addEventListener("pause", () => setIsPlaying(false));
    audio.addEventListener("waiting", () => setIsBuffering(true));
    audio.addEventListener("canplay", () => setIsBuffering(false));
    audio.addEventListener("error", () => { setIsPlaying(false); setIsBuffering(false); });
    audioRef.current = audio;
    return () => { audio.pause(); audio.src = ""; };
  }, []);

  // Sync volume → audio element
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Now-playing metadata: reset on station change, poll every 15s while playing
  const fetchNowPlaying = useCallback(async (streamUrl: string) => {
    try {
      const data = await apiFetch<{ title: string; artist: string; raw: string }>(
        `/nowplaying?url=${encodeURIComponent(streamUrl)}`
      );
      if (data.raw !== undefined) setNowPlaying(data);
    } catch { }
  }, []);

  useEffect(() => {
    setNowPlaying({ title: "", artist: "", raw: "" });
  }, [currentStation?.stationuuid]);

  useEffect(() => {
    if (npInterval.current) { clearInterval(npInterval.current); npInterval.current = null; }
    if (!currentStation || !isPlaying) return;
    const url = currentStation.url_resolved;
    fetchNowPlaying(url);
    npInterval.current = setInterval(() => fetchNowPlaying(url), 15000);
    return () => { if (npInterval.current) { clearInterval(npInterval.current); npInterval.current = null; } };
  }, [currentStation?.stationuuid, isPlaying, fetchNowPlaying]);

  // Load stations on mount (no auto-play — browser requires user gesture)
  useEffect(() => {
    const makeFallback = (def: (typeof FAVORITE_DEFS)[number]): Station & { color: string } => ({
      stationuuid: `fav-${def.searchName}`,
      name: def.displayName,
      url_resolved: def.fallbackUrl,
      favicon: "",
      country: def.country,
      tags: def.tags,
      bitrate: 128,
      color: def.color,
    });

    Promise.all([
      Promise.all(
        FAVORITE_DEFS.map(async (def) => {
          const found = await searchStation(def.searchName);
          // Always use the verified fallback URL — Radio Browser's url_resolved can be stale/broken.
          // We still take favicon and other metadata from Radio Browser when available.
          return found
            ? { ...found, name: def.displayName, url_resolved: def.fallbackUrl, color: def.color }
            : makeFallback(def);
        })
      ),
      fetchTopStations(40),
    ]).then(([favs, top]) => {
      setFavorites(favs);
      setAllStations(top);
      setCurrentStation(favs[0] ?? null);
      setCurrentColor(favs[0]?.color ?? "#333");
      setLoading(false);
    });
  }, []);

  // Play a given station — MUST be called from within a user-gesture handler
  const playStation = (station: Station, color?: string) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = station.url_resolved;
    audio.load();
    setCurrentStation(station);
    if (color) setCurrentColor(color);
    setIsBuffering(true);
    audio.play().catch(() => setIsBuffering(false));
  };

  const handlePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else if (currentStation) {
      if (!audio.src) {
        audio.src = currentStation.url_resolved;
        audio.load();
      }
      setIsBuffering(true);
      audio.play().catch(() => setIsBuffering(false));
    }
  };

  const navigate = (dir: 1 | -1) => {
    if (activeList.length === 0) return;
    const idx = currentIndex >= 0 ? currentIndex : 0;
    const next = activeList[(idx + dir + activeList.length) % activeList.length];
    const col = (next as Station & { color?: string }).color;
    playStation(next, col);
  };

  // Volume via record rotation
  const handleVolumeRotate = (deltaDeg: number) => {
    setVolume((prev) => Math.max(0, Math.min(1, prev + deltaDeg / 540)));
  };

  // Live search
  useEffect(() => {
    if (!searchActive || !searchQuery.trim()) { setSearchResults([]); return; }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setIsSearching(true);
      setSearchResults(await doSearch(searchQuery));
      setIsSearching(false);
    }, 400);
  }, [searchQuery, searchActive]);

  const selectFromSearch = (station: Station) => {
    playStation(station);
    setSearchActive(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  const genreTag = currentStation?.tags.split(",")[0]?.trim() ?? "";

  const [stationListOpen, setStationListOpen] = useState(false);
  const { isLandscape, vinylSize } = useLayout();

  return (
    <div className="h-[100dvh] w-full flex flex-col wood-bg text-foreground relative overflow-hidden font-sans">
      <div className="absolute inset-0 bg-black/56 pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
        style={{
          background: "radial-gradient(circle at 50% 45%, rgba(200,80,40,0.18), transparent 65%)",
          opacity: isPlaying ? 1 : 0.2,
        }}
      />

      {/* Top bar */}
      <div className="relative z-20 flex items-center justify-between px-4 pt-[env(safe-area-inset-top,0px)]"
           style={{ paddingTop: `max(env(safe-area-inset-top, 0px), 12px)`, paddingBottom: 8 }}>
        <div className="flex items-center gap-1 bg-black/40 rounded-full p-0.5 border border-white/10">
          <button onClick={() => { setView("favorites"); setStationListOpen(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 touch-manipulation ${view === "favorites" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <Heart className="w-3 h-3" /> Lieblinge
          </button>
          <button onClick={() => { setView("all"); setStationListOpen(true); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 touch-manipulation ${view === "all" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <Radio className="w-3 h-3" /> Alle Sender
          </button>
        </div>
        <button onClick={() => setSearchActive((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-muted-foreground border border-white/10 transition-all duration-200 touch-manipulation">
          <Search className="w-3.5 h-3.5" /> Suche
        </button>
      </div>

      {/* Search overlay */}
      <AnimatePresence>
        {searchActive && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-0 top-0 z-30 bg-black/95 backdrop-blur-md border-b border-white/10 p-4"
            style={{ paddingTop: `max(env(safe-area-inset-top, 0px), 16px)` }}>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <input autoFocus type="text" placeholder="z.B. Jazz, BBC, RTL…"
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-white placeholder:text-muted-foreground outline-none text-base" />
                <button onClick={() => { setSearchActive(false); setSearchQuery(""); setSearchResults([]); }}
                  className="w-8 h-8 flex items-center justify-center text-muted-foreground touch-manipulation">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {isSearching && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Suche…
                </div>
              )}
              {searchResults.length > 0 && (
                <div className="max-h-[55vh] overflow-y-auto divide-y divide-white/5 -mx-1">
                  {searchResults.map((s) => (
                    <button key={s.stationuuid} onClick={() => selectFromSearch(s)}
                      className="w-full flex items-center gap-3 px-2 py-3 active:bg-white/5 text-left touch-manipulation">
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0">
                        <StationLogo url={s.favicon} name={s.name} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.country}{s.tags ? ` · ${s.tags.split(",")[0]}` : ""}</p>
                      </div>
                      {s.bitrate > 0 && <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{s.bitrate}k</span>}
                    </button>
                  ))}
                </div>
              )}
              {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
                <p className="text-xs text-muted-foreground">Keine Sender gefunden.</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "Alle Sender" bottom sheet */}
      <AnimatePresence>
        {stationListOpen && view === "all" && (
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="absolute inset-x-0 bottom-0 z-30 bg-black/95 backdrop-blur-md rounded-t-2xl border-t border-white/10 flex flex-col"
            style={{ maxHeight: "70dvh", paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-sm font-medium text-white">Alle Sender</span>
              <button onClick={() => setStationListOpen(false)}
                className="w-8 h-8 flex items-center justify-center text-muted-foreground touch-manipulation">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1">
              {allStations.map((s) => (
                <button key={s.stationuuid}
                  onClick={() => { playStation(s); setStationListOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 active:bg-white/5 text-left touch-manipulation border-b border-white/5 ${currentStation?.stationuuid === s.stationuuid ? "bg-primary/10" : ""}`}>
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-zinc-800 flex-shrink-0">
                    <StationLogo url={s.favicon} name={s.name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm truncate ${currentStation?.stationuuid === s.stationuuid ? "text-primary font-medium" : "text-white"}`}>{s.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.country}{s.tags ? ` · ${s.tags.split(",")[0]}` : ""}</p>
                  </div>
                  {s.bitrate > 0 && <span className="text-xs text-muted-foreground flex-shrink-0">{s.bitrate}k</span>}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center gap-2 text-muted-foreground z-10">
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          Sender werden geladen…
        </div>
      )}

      {/* Player — centred, fills remaining height */}
      {!loading && currentStation && (
        <div
          className="relative z-10 flex-1 overflow-hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }}
        >
          {isLandscape ? (
            /* ── Landscape: vinyl left, info+controls right ── */
            <div className="flex h-full items-center justify-center gap-4 px-4">

              {/* Left: vinyl */}
              <div className="flex items-center justify-center flex-shrink-0"
                   style={{ width: vinylSize + 80 }}>
                <VinylRecord
                  station={currentStation}
                  stationColor={currentColor}
                  isPlaying={isPlaying}
                  isBuffering={isBuffering}
                  onVolumeRotate={handleVolumeRotate}
                  onTonearmClick={handlePlayPause}
                  size={vinylSize}
                />
              </div>

              {/* Right: info + controls */}
              <div className="flex flex-col items-center justify-center gap-3 flex-1 min-w-0">

                {/* Sender selector */}
                {view === "favorites" ? (
                  <div className="flex flex-wrap gap-2 justify-center">
                    {favorites.map((s) => (
                      <button key={s.stationuuid} onClick={() => playStation(s, s.color)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all touch-manipulation ${
                          currentStation.stationuuid === s.stationuuid
                            ? "bg-primary text-primary-foreground border-primary"
                            : "text-muted-foreground border-white/15 bg-black/20"
                        }`}>
                        <div className="w-3.5 h-3.5 rounded-sm overflow-hidden flex-shrink-0">
                          <StationLogo url={s.favicon} name={s.name} color={s.color} />
                        </div>
                        {s.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button onClick={() => setStationListOpen(true)}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/30 border border-white/10 touch-manipulation">
                    <Radio className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs text-muted-foreground">Sender wählen</span>
                  </button>
                )}

                {/* Station name */}
                <AnimatePresence mode="wait">
                  <motion.div key={currentStation.stationuuid}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }} className="flex flex-col items-center gap-1">
                    <h1 className="text-xl font-serif font-semibold tracking-tight text-white drop-shadow line-clamp-1 text-center">
                      {currentStation.name}
                    </h1>
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      {isPlaying && <LiveBadge />}
                      {genreTag && <span className="text-[10px] text-primary tracking-widest uppercase font-light">{genreTag}</span>}
                      {currentStation.country && <span className="text-[10px] text-muted-foreground">{currentStation.country}</span>}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Now playing (landscape) */}
                <AnimatePresence>
                  {nowPlaying.raw && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-0.5 w-full px-2">
                      <p className="text-sm text-white/90 font-medium truncate w-full text-center">{nowPlaying.title || nowPlaying.raw}</p>
                      {nowPlaying.artist && <p className="text-xs text-muted-foreground truncate w-full text-center">{nowPlaying.artist}</p>}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Buffering */}
                <div className="h-4 flex items-center justify-center">
                  {isBuffering && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      Verbinde…
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* ── Portrait: vinyl top, favorites list bottom ── */
            <div className="flex flex-col items-center h-full px-5 pb-[env(safe-area-inset-bottom,0px)]" style={{ paddingBottom: "max(env(safe-area-inset-bottom,0px),12px)", gap: 0 }}>

              {/* Station info */}
              <div className="text-center flex flex-col items-center gap-1 pt-2">
                <AnimatePresence mode="wait">
                  <motion.div key={currentStation.stationuuid}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }} className="flex flex-col items-center gap-1">
                    <h1 className="text-xl font-serif font-semibold tracking-tight text-white drop-shadow line-clamp-1 text-center leading-tight">
                      {currentStation.name}
                    </h1>
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      {isPlaying && <LiveBadge />}
                      {isBuffering && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                          Verbinde…
                        </div>
                      )}
                      {genreTag && !isBuffering && <span className="text-[10px] text-primary tracking-widest uppercase font-light">{genreTag}</span>}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Now playing */}
                <AnimatePresence>
                  {nowPlaying.raw && (
                    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex flex-col items-center gap-0.5 w-full px-2">
                      <div className="flex items-center gap-1.5 max-w-[300px]">
                        <Music className="w-3 h-3 text-primary flex-shrink-0" />
                        <p className="text-xs text-white/90 font-medium truncate">{nowPlaying.title || nowPlaying.raw}</p>
                      </div>
                      {nowPlaying.artist && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-[300px]">{nowPlaying.artist}</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Vinyl — grows to fill remaining space */}
              <div className="flex-1 flex items-center justify-center min-h-0">
                <VinylRecord
                  station={currentStation}
                  stationColor={currentColor}
                  isPlaying={isPlaying}
                  isBuffering={isBuffering}
                  onVolumeRotate={handleVolumeRotate}
                  onTonearmClick={handlePlayPause}
                  size={vinylSize}
                />
              </div>

              {/* Favorites vertical list */}
              {view === "favorites" ? (
                <div className="w-full flex flex-col gap-1 py-2">
                  {favorites.map((s) => {
                    const active = currentStation.stationuuid === s.stationuuid;
                    return (
                      <button key={s.stationuuid} onClick={() => playStation(s, s.color)}
                        className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium border transition-all duration-200 touch-manipulation ${
                          active
                            ? "bg-white/10 border-white/25 text-white"
                            : "text-muted-foreground border-transparent bg-black/10 active:bg-white/5"
                        }`}>
                        <div className="w-7 h-7 rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                          <StationLogo url={s.favicon} name={s.name} color={s.color} />
                        </div>
                        <span className="flex-1 text-left truncate">{s.name}</span>
                        {active && <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="py-3">
                  <button onClick={() => setStationListOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/30 border border-white/10 touch-manipulation">
                    <Radio className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs text-muted-foreground">Sender wählen</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
