import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlayer } from "../context/PlayerContext";
import { useThemeAccent } from "../context/ThemeAccentContext";
import { useUiSettings } from "../hooks/useUiSettings";
import { mergeAppSettings } from "../utils/appSettings";
import { toast } from "../utils/toastBus";
import { useRightPanel } from "../context/RightPanelContext";

/**
 * Player — glass “now playing” strip + transport + seek + volume.
 * Kept intentionally simple and robust so audio output is browser‑reliable.
 */

function formatTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const s = Math.floor(totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function IconPrev({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 6h2v12H6V6Zm12 0-8 6 8 6V6Z" />
    </svg>
  );
}

function IconNext({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 18 14 12 6 6v12Zm8-12h2v12h-2V6Z" />
    </svg>
  );
}

function IconPlay({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7L8 5Z" />
    </svg>
  );
}

function IconPause({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 5h4v14H6V5Zm8 0h4v14h-4V5Z" />
    </svg>
  );
}

function IconShuffle({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 3h5v5M4 20l7.5-7.5M4 4l7.5 7.5M21 16v5h-5" />
    </svg>
  );
}

function IconRepeat({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

function IconVolume({ className, level }) {
  const muted = level === 0;
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      {muted ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 9l4 4m0-4-4 4M6 9H4v6h2l4 4V5L6 9Z" />
      ) : (
        <>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5 6 9H4v6h2l5 4V5Z" />
          <path strokeLinecap="round" d="M15.54 8.46a5 5 0 0 1 0 7.07M17.66 6.34a8 8 0 0 1 0 11.32" className={level < 0.5 ? "opacity-40" : ""} />
        </>
      )}
    </svg>
  );
}

export default function Player() {
  const accent = useThemeAccent();
  const { showSongCardImages, playerBarCollapsed, playerBarSize } = useUiSettings();
  const { toggleLyrics } = useRightPanel();
  const {
    audioRef,
    currentSong,
    isPlaying,
    playbackError,
    togglePlayPause,
    next,
    previous,
    shuffle,
    setShuffle,
    repeat,
    setRepeat,
    volume,
    setVolume,
    toggleMute,
    isMuted,
    advanceAfterTrackEnded,
    getStreamUrl,
    setQueueAndPlay,
  } = usePlayer();

  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);

  const scrubbingRef = useRef(false);
  const trackRef = useRef(null);
  const [audioError, setAudioError] = useState("");

  // Spatial audio removed to guarantee reliable playback across browsers.

  const title = currentSong?.title || currentSong?.name || "Nothing playing";
  const artist = currentSong?.artist || currentSong?.primaryArtists || "—";
  const image = currentSong?.image || "";
  const streamUrl = currentSong ? getStreamUrl(currentSong) : "";

  const compactDock = playerBarSize === "compact";
  const expandedDock = playerBarSize === "expanded";

  const progress = useMemo(() => {
    if (!durationSec || durationSec <= 0) return 0;
    return Math.min(1, Math.max(0, currentTimeSec / durationSec));
  }, [currentTimeSec, durationSec]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onStall = () => {
      if (!currentSong) return;
      setAudioError("Buffering… if it takes too long, we’ll switch streams.");
    };

    const onError = async () => {
      // Surface a friendly message and attempt a couple of automatic recoveries.
      setAudioError("This track won’t play right now. Trying a better source…");
      toast({ title: "Playback hiccup", message: "Switching stream source…", variant: "info" });

      // If API provided tiered URLs, try the next one down.
      const song = currentSong;
      const candidates = Array.isArray(song?.audioUrls) ? song.audioUrls : [];
      const cur = getStreamUrl(song);
      const idx = candidates.findIndex((u) => u === cur);
      const nextUrl = idx >= 0 ? candidates[idx - 1] : "";
      if (nextUrl) {
        try {
          audio.src = nextUrl;
          audio.load();
          await audio.play();
          setAudioError("");
          return;
        } catch {
          // continue to “details refetch” fallback below
        }
      }

      // Last resort: refetch details by id (different host might provide a working stream).
      const sid = String(song?.id || "").trim();
      if (sid) {
        try {
          const mod = await import("../services/api");
          const details = await mod.getSongDetails(sid);
          if (details?.song?.audioUrl) {
            setQueueAndPlay([{ ...song, ...details.song, url: details.song.audioUrl }], 0);
            setAudioError("");
            return;
          }
        } catch {
          // ignore
        }
      }

      setAudioError("Can’t reach a playable stream for this track. Try another one.");
      toast({ title: "Can’t play this track", message: "Try a different song or retry later.", variant: "error" });
    };

    const sync = () => {
      setCurrentTimeSec(audio.currentTime || 0);
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) setDurationSec(d);
    };

    const onMeta = () => {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) setDurationSec(d);
      setCurrentTimeSec(audio.currentTime || 0);
    };

    audio.addEventListener("timeupdate", sync);
    audio.addEventListener("seeked", sync);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("error", onError);
    audio.addEventListener("stalled", onStall);
    audio.addEventListener("waiting", onStall);
    audio.addEventListener("playing", () => setAudioError(""));

    return () => {
      audio.removeEventListener("timeupdate", sync);
      audio.removeEventListener("seeked", sync);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("stalled", onStall);
      audio.removeEventListener("waiting", onStall);
    };
  }, [audioRef, currentSong, getStreamUrl, setQueueAndPlay]);

  useEffect(() => {
    setCurrentTimeSec(0);
    setDurationSec(0);
  }, [currentSong?.id]);

  const seekToRatio = useCallback(
    (ratio) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(durationSec) || durationSec <= 0) return;
      const nextTime = Math.min(durationSec, Math.max(0, ratio * durationSec));
      audio.currentTime = nextTime;
      setCurrentTimeSec(nextTime);
    },
    [audioRef, durationSec]
  );

  const seekToClientX = useCallback(
    (clientX) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;
      seekToRatio(Math.min(1, Math.max(0, ratio)));
    },
    [seekToRatio]
  );

  useEffect(() => {
    const onMove = (e) => {
      if (!scrubbingRef.current) return;
      seekToClientX(e.clientX);
    };
    const onUp = () => {
      scrubbingRef.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [seekToClientX]);

  const onTrackPointerDown = (e) => {
    e.preventDefault();
    scrubbingRef.current = true;
    seekToClientX(e.clientX);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const cycleRepeat = () => {
    const order = ["off", "all", "one"];
    const i = order.indexOf(repeat);
    setRepeat(order[(i + 1) % order.length]);
  };

  const repeatLabel =
    repeat === "off" ? "Repeat off" : repeat === "all" ? "Repeat queue" : "Repeat one";

  return (
    <div className="w-full">
      <audio
        ref={audioRef}
        preload="metadata"
        onEnded={advanceAfterTrackEnded}
        className="hidden"
        aria-hidden
      />

      <div
        className={[
          "relative rounded-2xl border border-white/[0.08] bg-zinc-950/55 shadow-2xl shadow-black/40",
          "backdrop-blur-2xl backdrop-saturate-150 transition-all duration-300",
          "ring-1 ring-inset ring-white/[0.04]",
          playerBarSize === "compact" ? "p-2.5" : playerBarSize === "expanded" ? "p-6" : "p-4",
        ].join(" ")}
      >
        <button
          type="button"
          title={playerBarCollapsed ? "Expand player" : "Minimize player"}
          onClick={() => mergeAppSettings({ playerBarCollapsed: !playerBarCollapsed })}
          className={[
            "absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-2xl",
            "border border-white/10 bg-white/[0.06] text-current/70 shadow-lg backdrop-blur-2xl",
            "transition-all duration-200 hover:scale-105 hover:bg-white/[0.1]",
          ].join(" ")}
        >
          {playerBarCollapsed ? "▢" : "—"}
        </button>
        {playbackError || audioError ? (
          <div className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-50/90">
            {audioError || playbackError}
          </div>
        ) : null}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
          {!compactDock && !playerBarCollapsed ? (
            <div
              className={[
                "relative mx-auto shrink-0 overflow-hidden rounded-xl shadow-lg ring-1 ring-white/10 transition duration-300 hover:ring-current/25 lg:mx-0",
                expandedDock ? "h-36 w-36" : "h-28 w-28 lg:h-32 lg:w-32",
              ].join(" ")}
            >
              {showSongCardImages && image ? (
                <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div
                  className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${accent.gradient} text-3xl text-white/70`}
                >
                  ♪
                </div>
              )}
            </div>
          ) : null}

          <div className={["min-w-0 flex-1", playerBarCollapsed ? "space-y-2" : "space-y-3"].join(" ")}>
            <div className="space-y-0.5 text-center lg:text-left">
              <h2 className="truncate text-base font-semibold tracking-tight text-current" title={title}>
                {title}
              </h2>
              <p className="truncate text-sm text-current/55" title={artist}>
                {artist}
              </p>
            </div>

            {!playerBarCollapsed && !compactDock ? (
              <div className="space-y-1.5">
              <div
                ref={trackRef}
                role="slider"
                tabIndex={0}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                aria-label="Seek position"
                className={`group relative h-2 w-full cursor-pointer rounded-full bg-white/[0.06] outline-none transition-all duration-200 hover:bg-white/[0.09] focus-visible:ring-2 ${accent.focusRing}`}
                onPointerDown={onTrackPointerDown}
                onKeyDown={(e) => {
                  if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    const audio = audioRef.current;
                    if (audio) audio.currentTime = Math.max(0, audio.currentTime - 5);
                  }
                  if (e.key === "ArrowRight") {
                    e.preventDefault();
                    const audio = audioRef.current;
                    if (audio && durationSec) {
                      audio.currentTime = Math.min(durationSec, audio.currentTime + 5);
                    }
                  }
                }}
              >
                <div
                  className={`pointer-events-none absolute left-0 top-0 h-full rounded-full bg-gradient-to-r ${accent.gradient} transition-[width] duration-75 ease-linear`}
                  style={{ width: `${progress * 100}%` }}
                />
                <div
                  className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-md transition-opacity group-hover:opacity-100"
                  style={{ left: `calc(${progress * 100}% - 6px)` }}
                />
              </div>
              <div className="flex justify-between text-[11px] tabular-nums text-current/45">
                <span>{formatTime(currentTimeSec)}</span>
                <span>{formatTime(durationSec)}</span>
              </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <button
                type="button"
                onClick={() => setShuffle(!shuffle)}
                title={shuffle ? "Shuffle on — surprise order" : "Shuffle off — play in list order"}
                className={[
                  "inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200",
                  shuffle ? `border-current/25 ${accent.chip} shadow-md` : `${accent.btnMuted} border border-white/[0.08] hover:scale-105`,
                ].join(" ")}
              >
                <IconShuffle className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={previous}
                title="Previous track (or restart if past 3s)"
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-current transition-all duration-200 hover:scale-105 hover:bg-white/[0.08] ${accent.btnMuted}`}
              >
                <IconPrev className="h-6 w-6" />
              </button>

              <button
                type="button"
                onClick={togglePlayPause}
                title={isPlaying ? "Pause" : "Play"}
                disabled={!currentSong}
                className={[
                  "inline-flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-200 hover:scale-[1.05]",
                  accent.btn,
                  !currentSong ? "cursor-not-allowed opacity-40" : "",
                ].join(" ")}
              >
                {isPlaying ? <IconPause className="h-7 w-7" /> : <IconPlay className="h-7 w-7 pl-0.5" />}
              </button>

              <button
                type="button"
                onClick={next}
                title="Skip to next track"
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-current transition-all duration-200 hover:scale-105 hover:bg-white/[0.08] ${accent.btnMuted}`}
              >
                <IconNext className="h-6 w-6" />
              </button>

              <button
                type="button"
                onClick={cycleRepeat}
                title={`${repeatLabel} — click to cycle`}
                className={[
                  "relative inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-200",
                  repeat !== "off" ? `border-current/25 ${accent.chip} shadow-md` : `${accent.btnMuted} border border-white/[0.08] hover:scale-105`,
                ].join(" ")}
              >
                <IconRepeat className="h-5 w-5" />
                {repeat === "one" && (
                  <span className="absolute bottom-1 right-1 rounded bg-black/80 px-0.5 text-[9px] font-bold leading-none text-current">
                    1
                  </span>
                )}
              </button>

              <button
                type="button"
                title="Lyrics"
                onClick={() => {
                  if (!currentSong) return;
                  toggleLyrics({ title, artist });
                }}
                disabled={!currentSong}
                className={[
                  "inline-flex h-10 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition-all duration-200",
                  currentSong
                    ? `${accent.btnMuted} border border-white/[0.08] hover:scale-105`
                    : "cursor-not-allowed opacity-40",
                ].join(" ")}
              >
                Lyrics
              </button>

              <a
                href={streamUrl || "#"}
                target="_blank"
                rel="noreferrer"
                title={streamUrl ? "Download / open audio source" : "No stream URL"}
                onClick={(e) => {
                  if (!streamUrl) {
                    e.preventDefault();
                    toast({ title: "No download source", message: "This track has no direct stream URL.", variant: "info" });
                    return;
                  }
                  toast({ title: "Opening source", message: "If your browser allows it, you can save the file.", variant: "success" });
                }}
                className={[
                  "inline-flex h-10 items-center justify-center rounded-xl border px-3 text-xs font-semibold transition-all duration-200",
                  streamUrl
                    ? `${accent.btnMuted} border border-white/[0.08] hover:scale-105`
                    : "pointer-events-none opacity-40",
                ].join(" ")}
              >
                Download
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-current/55">
                Space
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-current/55">
                ← →
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-current/55">
                M
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3 border-t border-white/[0.06] pt-4 lg:w-48 lg:flex-col lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            {/* Minimize moved to top-right corner for visibility */}
            <button
              type="button"
              onClick={toggleMute}
              title={isMuted ? "Unmute audio" : "Mute audio"}
              className="rounded-lg p-2 text-current/50 transition-all duration-200 hover:scale-105 hover:bg-white/[0.06] hover:text-current"
            >
              <IconVolume className="h-6 w-6" level={isMuted ? 0 : volume} />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              title="Volume level"
              className="utopian-range h-1.5 w-full max-w-[200px] cursor-pointer appearance-none rounded-full bg-white/[0.08] lg:max-w-none"
              aria-label="Volume"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
