import { useEffect, useMemo, useState } from "react";
import { useRightPanel } from "../context/RightPanelContext";
import { useThemeAccent } from "../context/ThemeAccentContext";
import { getLyrics } from "../services/lyrics";
import { usePlayer } from "../context/PlayerContext";

function clamp(s, n = 220) {
  const x = String(s || "").trim();
  if (x.length <= n) return x;
  return `${x.slice(0, n)}…`;
}

export default function RightPanel() {
  const accent = useThemeAccent();
  const { panel, close } = useRightPanel();
  const open = panel?.type === "lyrics";
  const { audioRef } = usePlayer();

  const meta = useMemo(() => panel?.payload || null, [panel?.payload]);
  const title = meta?.title || "";
  const artist = meta?.artist || "";

  const [state, setState] = useState({ loading: false, lyrics: "", error: "", source: "" });
  const [playhead, setPlayhead] = useState({ t: 0, d: 0 });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setState({ loading: true, lyrics: "", error: "", source: "" });
      const res = await getLyrics({ artist, title });
      if (cancelled) return;
      if (res.ok) {
        setState({ loading: false, lyrics: res.lyrics, error: "", source: res.source || "" });
      } else {
        setState({ loading: false, lyrics: "", error: res.error || "No lyrics yet.", source: "" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, artist, title]);

  // Lightweight playhead polling for a “karaoke feel” even without timed LRC.
  useEffect(() => {
    if (!open) return;
    const tick = () => {
      const a = audioRef.current;
      if (!a) return;
      const t = Number(a.currentTime) || 0;
      const d = Number(a.duration) || 0;
      setPlayhead({ t, d });
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [open, audioRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const lines = (state.lyrics || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const idx =
    lines.length > 0 && playhead.d > 0
      ? Math.min(lines.length - 1, Math.max(0, Math.floor((playhead.t / playhead.d) * lines.length)))
      : 0;

  return (
    <div className="fixed right-0 top-0 z-[70] h-screen w-[min(92vw,420px)] border-l border-white/[0.12] bg-black/35 backdrop-blur-3xl backdrop-saturate-150">
      <div className="flex h-full flex-col">
        {/* Premium “door handle” close control */}
        <button
          type="button"
          title="Close lyrics"
          onClick={close}
          className={[
            "absolute left-0 top-1/2 -translate-y-1/2",
            "rounded-r-2xl border border-white/[0.14] bg-white/[0.06] px-3 py-4",
            "text-current shadow-2xl backdrop-blur-3xl",
            "transition-all duration-200 hover:translate-x-0.5 hover:bg-white/[0.1]",
          ].join(" ")}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M14.5 6.5 9 12l5.5 5.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="flex items-start justify-between gap-3 border-b border-white/[0.12] px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-current/45">Lyrics</p>
            <p className="mt-1 truncate text-sm font-semibold text-current" title={title}>
              {title || "—"}
            </p>
            <p className="truncate text-xs text-current/55" title={artist}>
              {artist || "—"}
            </p>
          </div>
          <button
            type="button"
            title="Close"
            onClick={close}
            className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-current/70 transition-all duration-200 hover:scale-105 hover:bg-white/[0.09]"
          >
            Esc
          </button>
        </div>

        <div className="flex-1 overflow-y-auto utopian-scrollbar px-5 py-5">
          {state.loading ? (
            <div className="space-y-3">
              <div className={`h-3 w-32 animate-pulse rounded bg-gradient-to-r ${accent.gradient} opacity-40`} />
              <div className="h-3 w-64 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-56 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-72 animate-pulse rounded bg-white/10" />
            </div>
          ) : state.error ? (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 text-sm text-current/65">
              <p className="font-semibold text-current">No lyrics yet</p>
              <p className="mt-1 text-xs text-current/55">{state.error}</p>
              <p className="mt-4 text-xs text-current/45">
                Tip: try a slightly different spelling, or search another version of the track.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {lines.map((l, i) => {
                const hot = i === idx;
                return (
                  <p
                    key={`${i}-${l.slice(0, 18)}`}
                    className={[
                      "whitespace-pre-wrap break-words text-sm leading-relaxed transition-all duration-200",
                      hot
                        ? `text-current drop-shadow-[0_6px_18px_rgba(0,0,0,0.35)] ${accent.pulse} scale-[1.01]`
                        : "text-current/65",
                    ].join(" ")}
                  >
                    {l}
                  </p>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-white/[0.12] px-5 py-4">
          <p className="text-[11px] text-current/45">
            {state.source ? `Source: ${state.source}` : "Lyrics are best‑effort and may vary by track."}
          </p>
          <p className="mt-2 text-[11px] text-current/45">
            {clamp("We’ll keep this panel lightweight so playback stays smooth.")}
          </p>
        </div>
      </div>
    </div>
  );
}

