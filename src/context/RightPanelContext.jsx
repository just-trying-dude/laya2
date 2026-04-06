import { createContext, useContext, useMemo, useState } from "react";

/**
 * RightPanelContext — premium side panel system (lyrics now, extendable later).
 * This avoids prop drilling from App → Player.
 */

const RightPanelContext = createContext(null);

export function RightPanelProvider({ children }) {
  const [panel, setPanel] = useState({ type: null, payload: null });

  const value = useMemo(
    () => ({
      panel,
      openLyrics(payload) {
        setPanel({ type: "lyrics", payload: payload || null });
      },
      close() {
        setPanel({ type: null, payload: null });
      },
      toggleLyrics(payload) {
        setPanel((p) =>
          p.type === "lyrics" ? { type: null, payload: null } : { type: "lyrics", payload: payload || null }
        );
      },
    }),
    [panel]
  );

  return <RightPanelContext.Provider value={value}>{children}</RightPanelContext.Provider>;
}

export function useRightPanel() {
  const ctx = useContext(RightPanelContext);
  if (!ctx) throw new Error("useRightPanel must be used within RightPanelProvider");
  return ctx;
}

