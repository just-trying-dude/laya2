import { useEffect, useMemo, useState } from "react";
import {
  getTrendingSongs,
  getTrendingAlbums,
  getTrendingArtists,
  searchSongs,
  searchAlbums,
  searchArtists,
} from "../services/api";
import SongCard from "../components/SongCard";
import AlbumCard from "../components/AlbumCard";
import ArtistCard from "../components/ArtistCard";
import SearchPreviewTray from "../components/SearchPreviewTray";
import { usePlayer } from "../context/PlayerContext";
import { useThemeAccent } from "../context/ThemeAccentContext";
import { useUiSettings, gridMinForCardSize } from "../hooks/useUiSettings";
import { loadAppSettings, APP_SETTINGS_KEY } from "../utils/appSettings";

const TRAY_DEBOUNCE_MS = 220;
const TRENDING_TARGET = 96;
const SEARCH_LIMIT = 48;

export default function Search() {
  const accent = useThemeAccent();
  const { songCardSize } = useUiSettings();
  const gridMin = gridMinForCardSize(songCardSize);
  const { setQueueAndPlay } = usePlayer();

  const [query, setQuery] = useState("");
  const [langPrefs, setLangPrefs] = useState(() => loadAppSettings().languagePreferences || ["en"]);

  const [suggested, setSuggested] = useState([]);
  const [suggestedLoading, setSuggestedLoading] = useState(true);
  const [suggestedError, setSuggestedError] = useState(null);
  const [suggestedAlbums, setSuggestedAlbums] = useState([]);
  const [suggestedArtists, setSuggestedArtists] = useState([]);

  const [trayResults, setTrayResults] = useState([]);
  const [trayLoading, setTrayLoading] = useState(false);
  const [trayError, setTrayError] = useState(null);
  const [trayOpen, setTrayOpen] = useState(false);

  const [searchResults, setSearchResults] = useState([]); // updates on submit
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const langKey = useMemo(() => langPrefs.join(","), [langPrefs]);

  useEffect(() => {
    const syncLang = () => setLangPrefs(loadAppSettings().languagePreferences || ["en"]);
    window.addEventListener("utopian-settings-updated", syncLang);
    const onStorage = (e) => {
      if (e.key === APP_SETTINGS_KEY) syncLang();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("utopian-settings-updated", syncLang);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSuggestedLoading(true);
      const { songs, error } = await getTrendingSongs({
        languagePreferences: langPrefs,
        targetCount: TRENDING_TARGET,
      });
      const [artistsRes, albumsRes] = await Promise.all([
        getTrendingArtists({ languagePreferences: langPrefs, targetCount: 18 }),
        getTrendingAlbums({ languagePreferences: langPrefs, targetCount: 18 }),
      ]);
      if (cancelled) return;
      setSuggested(songs || []);
      setSuggestedError(error);
      setSuggestedArtists(artistsRes.artists || []);
      setSuggestedAlbums(albumsRes.albums || []);
      setSuggestedLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [langKey]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setTrayResults([]);
      setTrayError(null);
      setTrayLoading(false);
      setTrayOpen(false);
      return;
    }

    setTrayOpen(true);
    setTrayLoading(true);
    const t = window.setTimeout(async () => {
      const { songs, error } = await searchSongs(q, { limit: 14 });
      setTrayResults(songs || []);
      setTrayError(error);
      setTrayLoading(false);
    }, TRAY_DEBOUNCE_MS);

    return () => clearTimeout(t);
  }, [query]);

  const showingSearch = hasSearched && query.trim().length > 0;
  const gridSongs = useMemo(
    () => (showingSearch ? searchResults : suggested),
    [showingSearch, searchResults, suggested]
  );

  const loading = showingSearch ? searchLoading : suggestedLoading;
  const error = showingSearch ? searchError : suggestedError;

  const chooseFromTray = async (track) => {
    if (!track) return;
    const title = track.title || track.name || "";
    setQuery(title);
    setTrayOpen(false);
    // Trigger a real search on click.
    const q = title.trim();
    if (!q) return;
    setHasSearched(true);
    setSearchLoading(true);
    setSearchError(null);
    const [songsRes, artistsRes, albumsRes] = await Promise.all([
      searchSongs(q, { limit: SEARCH_LIMIT }),
      searchArtists(q, { limit: 18 }),
      searchAlbums(q, { limit: 18 }),
    ]);
    setSearchResults(songsRes.songs || []);
    setSuggestedArtists(artistsRes.artists || []);
    setSuggestedAlbums(albumsRes.albums || []);
    setSearchError(songsRes.error || artistsRes.error || albumsRes.error || null);
    setSearchLoading(false);
  };

  return (
    <div className="min-h-full px-6 py-8 pb-28 text-current">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-current/45">Dig in</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Search</h1>
          <p className="text-sm text-current/55">Type anything — previews drop under the bar.</p>
        </header>

        <div className="sticky top-0 z-10 -mx-2 border-b border-white/[0.08] bg-white/[0.04] px-2 py-4 backdrop-blur-xl">
          <form
            className="relative max-w-2xl"
            onSubmit={async (e) => {
              e.preventDefault();
              const q = query.trim();
              if (!q) return;
              setHasSearched(true);
              setSearchLoading(true);
              setSearchError(null);
              const [songsRes, artistsRes, albumsRes] = await Promise.all([
                searchSongs(q, { limit: SEARCH_LIMIT }),
                searchArtists(q, { limit: 18 }),
                searchAlbums(q, { limit: 18 }),
              ]);
              setSearchResults(songsRes.songs || []);
              setSuggestedArtists(artistsRes.artists || []);
              setSuggestedAlbums(albumsRes.albums || []);
              setSearchError(songsRes.error || artistsRes.error || albumsRes.error || null);
              setSearchLoading(false);
              setTrayOpen(false);
            }}
          >
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Artists, films, vibes…"
              autoFocus
              autoComplete="off"
              title="Type for instant preview, press Enter to search"
              className={`w-full rounded-xl border border-white/[0.1] bg-white/[0.08] py-3.5 pl-11 pr-4 text-sm text-current placeholder:text-current/40 shadow-inner backdrop-blur-xl transition-all duration-200 ${accent.focusRing} focus:outline-none focus:ring-2`}
            />
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-current/40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <SearchPreviewTray
              query={query}
              songs={trayResults}
              loading={trayLoading}
              error={trayError}
              open={trayOpen}
              onRequestClose={() => setTrayOpen(false)}
              onChooseSong={chooseFromTray}
              accent={accent}
            />
            <button
              type="submit"
              title="Search"
              className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-xl px-4 py-2 text-xs font-semibold shadow-md transition-all duration-200 hover:scale-[1.02] ${accent.btn}`}
            >
              Search
            </button>
          </form>
        </div>

        <section aria-label={showingSearch ? "Search results" : "Suggested"}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-current">
              {showingSearch ? `“${query.trim()}”` : "While you’re here"}
            </h2>
            {loading && <span className={`text-xs animate-pulse ${accent.pulse}`}>Fetching…</span>}
          </div>

          {error && (
            <p className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
              {error}
            </p>
          )}

          {(suggestedArtists || []).length ? (
            <div className="mb-8 space-y-4">
              <h3 className="text-sm font-semibold text-current">Artists</h3>
              <div
                className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,var(--min)),1fr))]"
                style={{ "--min": gridMin }}
              >
                {(suggestedArtists || []).slice(0, 8).map((a) => (
                  <ArtistCard key={a.id} artist={a} onOpen={() => {}} />
                ))}
              </div>
            </div>
          ) : null}

          {(suggestedAlbums || []).length ? (
            <div className="mb-8 space-y-4">
              <h3 className="text-sm font-semibold text-current">Albums</h3>
              <div
                className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(min(100%,var(--min)),1fr))]"
                style={{ "--min": gridMin }}
              >
                {(suggestedAlbums || []).slice(0, 8).map((a) => (
                  <AlbumCard key={a.id} album={a} onOpen={() => {}} />
                ))}
              </div>
            </div>
          ) : null}

          {!loading && !gridSongs.length ? (
            <div className="rounded-2xl border border-dashed border-white/[0.12] bg-white/[0.04] px-6 py-16 text-center text-sm text-current/50">
              {showingSearch ? "Try another keyword — catalogs are huge." : "Couldn’t grab suggestions."}
            </div>
          ) : (
            <div
              className="grid gap-6 transition-opacity duration-300 [grid-template-columns:repeat(auto-fill,minmax(min(100%,var(--min)),1fr))]"
              style={{ "--min": gridMin }}
            >
              {gridSongs.map((song) => (
                <div key={song.id || `${song.title}-${song.audioUrl}`} className="transition duration-300 ease-out hover:z-10 hover:scale-[1.02]">
                  <SongCard song={song} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
