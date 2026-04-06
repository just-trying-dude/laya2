import { useCallback, useEffect, useMemo, useState } from "react";
import { usePlayer } from "../context/PlayerContext";
import { useThemeAccent } from "../context/ThemeAccentContext";
import {
  STORAGE_KEY,
  loadPlaylists,
  createPlaylistRecord,
  addPlaylist,
  removePlaylist,
  markPlaylistPlayed,
  replacePlaylist,
} from "../utils/playlists";
import SongCard from "../components/SongCard";
import { searchSongs } from "../services/api";
import { useUiSettings, gridMinForCardSize } from "../hooks/useUiSettings";
import { toast } from "../utils/toastBus";

/**
 * Library — persisted playlists / saved queues in `localStorage`.
 *
 * Storage:
 * - `loadPlaylists()` reads the JSON array written by `savePlaylists` in `../utils/playlists.js`.
 * - Keys and schema are centralized there so Queue.jsx and Library stay compatible.
 * - We listen for the `storage` event so another tab’s changes can refresh this list (same origin).
 *
 * Player:
 * - “Play playlist” calls `setQueueAndPlay(songs, 0)` to replace the live queue and start playback,
 *   then `markPlaylistPlayed` updates `lastPlayed` on that record.
 *
 * Layout:
 * - Responsive card grid; each card shows name, counts, and last played timestamp.
 */

function formatRelative(iso) {
  if (!iso) return "Never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Library() {
  const accent = useThemeAccent();
  const { setQueueAndPlay } = usePlayer();
  const { songCardSize } = useUiSettings();
  const gridMin = gridMinForCardSize(songCardSize);
  const [playlists, setPlaylists] = useState(() => loadPlaylists());
  const [activeId, setActiveId] = useState(null);
  const active = useMemo(
    () => playlists.find((p) => p.id === activeId) || null,
    [playlists, activeId]
  );

  const [addQuery, setAddQuery] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addResults, setAddResults] = useState([]);
  const [addError, setAddError] = useState("");

  const refresh = useCallback(() => {
    setPlaylists(loadPlaylists());
  }, []);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  const handleCreate = () => {
    const name = window.prompt("Playlist name", "My playlist");
    if (name === null) return;
    const record = createPlaylistRecord(name, []);
    setPlaylists((prev) => addPlaylist(prev, record));
    toast({ title: "Playlist created", message: record.name, variant: "success" });
  };

  const handlePlay = (pl) => {
    if (!pl.songs?.length) {
      toast({ title: "This playlist is empty", message: "Add a few songs to bring it to life.", variant: "info" });
      return;
    }
    setQueueAndPlay(pl.songs, 0);
    setPlaylists((prev) => markPlaylistPlayed(prev, pl.id));
    toast({ title: "Playing", message: pl.name, variant: "success" });
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Remove this playlist from your library?")) return;
    setPlaylists((prev) => removePlaylist(prev, id));
    if (activeId === id) setActiveId(null);
    toast({ title: "Removed", message: "Playlist deleted.", variant: "success" });
  };

  const removeSongFromActive = (songIdOrIdx) => {
    if (!active) return;
    setPlaylists((prev) =>
      replacePlaylist(prev, active.id, (p) => {
        const nextSongs = (p.songs || []).filter((_, idx) => idx !== songIdOrIdx);
        return { ...p, songs: nextSongs, updatedAt: new Date().toISOString() };
      })
    );
    toast({ title: "Removed from playlist", message: active.name, variant: "success" });
  };

  const addSongToActive = (song) => {
    if (!active || !song) return;
    setPlaylists((prev) =>
      replacePlaylist(prev, active.id, (p) => {
        const nextSongs = [...(p.songs || []), song];
        return { ...p, songs: nextSongs, updatedAt: new Date().toISOString() };
      })
    );
    toast({ title: "Added", message: `Added to ${active.name}`, variant: "success" });
  };

  useEffect(() => {
    const q = addQuery.trim();
    if (!active || !q) {
      setAddResults([]);
      setAddError("");
      setAddLoading(false);
      return;
    }
    let cancelled = false;
    setAddLoading(true);
    const t = window.setTimeout(async () => {
      const { songs, error } = await searchSongs(q, { limit: 18 });
      if (cancelled) return;
      setAddResults(songs || []);
      setAddError(error || "");
      setAddLoading(false);
    }, 260);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [addQuery, activeId]);

  return (
    <div className="min-h-full px-6 py-8 pb-28 text-current">
      <div className="mx-auto max-w-7xl space-y-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-current/45">Your crates</p>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Library</h1>
            <p className="mt-1 text-sm text-current/55">Mixtapes and moods you’ve saved — tap one and press play.</p>
          </div>
          <button
            type="button"
            title="Start a blank playlist"
            onClick={handleCreate}
            className={`inline-flex items-center justify-center rounded-xl px-5 py-3 text-sm font-semibold shadow-lg transition-all duration-200 hover:scale-[1.02] ${accent.btn} ${accent.focusRing} focus:outline-none focus-visible:ring-2`}
          >
            New playlist
          </button>
        </div>

        {!playlists.length ? (
          <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.04] px-6 py-16 text-center text-sm text-current/50 shadow-inner backdrop-blur-sm transition duration-300">
            Nothing saved yet — heart tracks or build a queue worth keeping.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-current/45">Playlists</p>
              <ul className="space-y-2">
                {playlists.map((pl) => {
                  const selected = pl.id === activeId;
                  return (
                    <li key={pl.id}>
                      <button
                        type="button"
                        title="Open playlist"
                        onClick={() => setActiveId(pl.id)}
                        className={[
                          "w-full rounded-2xl border px-4 py-3 text-left transition-all duration-300 backdrop-blur-xl",
                          "hover:-translate-y-0.5 hover:shadow-lg",
                          selected
                            ? `bg-white/[0.08] ring-2 ${accent.cardRing} border-white/[0.14]`
                            : "bg-white/[0.05] border-white/[0.1] hover:border-white/[0.18]",
                        ].join(" ")}
                      >
                        <p className="truncate text-sm font-semibold text-current">{pl.name}</p>
                        <p className="mt-1 text-xs text-current/55">
                          {(pl.songs && pl.songs.length) || 0} song{pl.songs?.length === 1 ? "" : "s"} · last spin{" "}
                          {formatRelative(pl.lastPlayed)}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={`inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold ${accent.btnMuted} border border-white/[0.08]`}>
                            Open
                          </span>
                          <span className={`inline-flex rounded-lg px-3 py-1.5 text-xs font-semibold ${accent.btn} shadow-md`}>
                            Play
                          </span>
                        </div>
                      </button>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          title="Play"
                          onClick={() => handlePlay(pl)}
                          className={`rounded-xl px-3 py-2 text-xs font-semibold transition hover:scale-[1.02] ${accent.btn}`}
                        >
                          Play
                        </button>
                        <button
                          type="button"
                          title="Remove playlist"
                          onClick={(e) => handleDelete(pl.id, e)}
                          className="rounded-xl border border-white/[0.1] px-3 py-2 text-xs font-medium text-current/55 transition hover:border-rose-500/40 hover:text-rose-400"
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <section className="glass-panel p-5">
              {!active ? (
                <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.04] px-6 py-16 text-center text-sm text-current/55">
                  Pick a playlist on the left — we’ll open it here.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-current/45">Now viewing</p>
                      <h2 className="truncate text-xl font-semibold tracking-tight text-current">{active.name}</h2>
                      <p className="text-xs text-current/55">{(active.songs || []).length} tracks</p>
                    </div>
                    <button
                      type="button"
                      title="Play this playlist"
                      onClick={() => handlePlay(active)}
                      disabled={!active.songs?.length}
                      className={`rounded-xl px-4 py-2.5 text-sm font-semibold shadow-lg transition-all duration-200 hover:scale-[1.02] disabled:opacity-40 ${accent.btn}`}
                    >
                      Play
                    </button>
                  </div>

                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 backdrop-blur-xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-current/45">Add songs</p>
                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                      <input
                        type="search"
                        value={addQuery}
                        onChange={(e) => setAddQuery(e.target.value)}
                        placeholder="Search and tap to add…"
                        title="Search songs to add"
                        className={`min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-white/[0.06] px-4 py-2.5 text-sm text-current placeholder:text-current/40 shadow-inner backdrop-blur-md transition duration-200 ${accent.focusRing} focus:outline-none focus:ring-2`}
                      />
                      <button
                        type="button"
                        title="Clear search"
                        onClick={() => setAddQuery("")}
                        className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${accent.btnMuted} border`}
                      >
                        Clear
                      </button>
                    </div>
                    {addLoading ? (
                      <p className={`mt-3 text-xs animate-pulse ${accent.pulse}`}>Searching…</p>
                    ) : addError ? (
                      <p className="mt-3 text-xs text-amber-200/90">{addError}</p>
                    ) : addQuery.trim() ? (
                      <div className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,var(--min)),1fr))]" style={{ "--min": gridMin }}>
                        {addResults.slice(0, 12).map((s) => (
                          <div key={s.id} className="relative">
                            <SongCard song={s} />
                            <button
                              type="button"
                              title="Add to this playlist"
                              onClick={() => addSongToActive(s)}
                              className={`absolute right-3 top-3 rounded-xl px-3 py-2 text-xs font-bold shadow-lg transition-all duration-200 hover:scale-105 ${accent.btn}`}
                            >
                              + Add
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-current/50">Type a song/artist/film and we’ll pull options.</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-current/45">Tracks</p>
                    {!active.songs?.length ? (
                      <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.04] px-6 py-14 text-center text-sm text-current/55">
                        This playlist is empty — add a few tracks above.
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {active.songs.map((song, idx) => (
                          <li
                            key={`${song.id || song.url || song.audioUrl}-${idx}`}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 backdrop-blur-xl transition-all duration-300 hover:border-white/[0.16] hover:shadow-lg"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-current">{song.title || song.name || "Untitled"}</p>
                              <p className="truncate text-xs text-current/55">{song.artist || song.primaryArtists || "—"}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <button
                                type="button"
                                title="Play from here"
                                onClick={() => setQueueAndPlay(active.songs, idx)}
                                className={`rounded-xl px-3 py-2 text-xs font-semibold transition hover:scale-[1.02] ${accent.btn}`}
                              >
                                Play
                              </button>
                              <button
                                type="button"
                                title="Remove from playlist"
                                onClick={() => removeSongFromActive(idx)}
                                className="rounded-xl border border-white/[0.1] px-3 py-2 text-xs font-semibold text-current/55 transition hover:border-rose-500/40 hover:text-rose-400"
                              >
                                Remove
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
