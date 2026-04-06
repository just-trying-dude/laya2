import { useThemeAccent } from "../context/ThemeAccentContext";
import { useUiSettings } from "../hooks/useUiSettings";

/**
 * AlbumCard — distinct chrome from SongCard so users understand “this is an album”.
 * Clicking triggers a parent-provided handler (usually: load album songs / show album page).
 */

export default function AlbumCard({ album, onOpen }) {
  const accent = useThemeAccent();
  const { showSongCardImages } = useUiSettings();
  if (!album) return null;

  const title = album.title || album.name || "Untitled album";
  const artist = album.artist || album.primaryArtists || "—";
  const image = album.image || "";
  const year = album.year ? String(album.year) : "";

  return (
    <button
      type="button"
      title={`Open album: ${title}`}
      onClick={() => onOpen?.(album)}
      className={[
        "group relative flex w-full flex-col overflow-hidden rounded-2xl border text-left",
        "border-white/[0.08] bg-white/[0.05] shadow-lg backdrop-blur-xl",
        "ring-1 ring-inset ring-white/[0.04]",
        "transition-[transform,box-shadow,border-color] duration-300 ease-out",
        "hover:-translate-y-1 hover:scale-[1.01] hover:border-current/20 hover:shadow-xl",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white/80 backdrop-blur-md">
        Album
      </div>

      {showSongCardImages ? (
        <div className="relative aspect-square w-full overflow-hidden bg-black/20">
          {image ? (
            <img
              src={image}
              alt=""
              className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${accent.gradient} text-3xl text-white/80`}>
              ⬡
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent opacity-80" />
        </div>
      ) : null}

      <div className="space-y-1 p-4">
        <p className="truncate text-sm font-semibold tracking-tight text-current">{title}</p>
        <p className="truncate text-xs text-current/55">{artist}</p>
        <p className="text-[11px] text-current/45">{year ? `Released · ${year}` : "Tap to explore"}</p>
      </div>
    </button>
  );
}

