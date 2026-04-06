import { useCallback, useEffect, useState } from "react";
import { loadAppSettings } from "../utils/appSettings";

function pickUi() {
  const p = loadAppSettings();
  return {
    songCardSize:
      p.songCardSize === "micro" ||
      p.songCardSize === "compact" ||
      p.songCardSize === "cozy" ||
      p.songCardSize === "comfortable" ||
      p.songCardSize === "spacious"
        ? p.songCardSize
        : "cozy",
    showSongCardImages: p.showSongCardImages !== false,
    playerBarSize:
      p.playerBarSize === "compact" || p.playerBarSize === "expanded"
        ? p.playerBarSize
        : "normal",
    playerBarCollapsed: Boolean(p.playerBarCollapsed),
  };
}

/** Live UI prefs from `utopian-app-settings` (card density + artwork visibility). */
export function useUiSettings() {
  const [ui, setUi] = useState(pickUi);

  const refresh = useCallback(() => setUi(pickUi()), []);

  useEffect(() => {
    window.addEventListener("utopian-settings-updated", refresh);
    return () => window.removeEventListener("utopian-settings-updated", refresh);
  }, [refresh]);

  return ui;
}

/** Map size preset → CSS min width for grids */
export function gridMinForCardSize(size) {
  if (size === "micro") return "170px";
  if (size === "compact") return "200px";
  if (size === "cozy") return "232px";
  if (size === "comfortable") return "268px";
  if (size === "spacious") return "320px";
  return "232px";
}
