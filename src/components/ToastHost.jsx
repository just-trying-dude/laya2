import { useEffect, useMemo, useState } from "react";
import { TOAST_EVENT } from "../utils/toastBus";
import { useThemeAccent } from "../context/ThemeAccentContext";

/**
 * ToastHost — premium, glassy confirmations (queue add, saved, error).
 * Mounted once in `App.jsx`.
 */

function variantClasses(variant, accent) {
  if (variant === "success") return `border-emerald-500/30 bg-emerald-500/10 text-emerald-50`;
  if (variant === "error") return `border-rose-500/30 bg-rose-500/10 text-rose-50`;
  return `border-white/[0.12] bg-white/[0.06] text-current`;
}

export default function ToastHost() {
  const accent = useThemeAccent();
  const [items, setItems] = useState([]);

  useEffect(() => {
    const onToast = (e) => {
      const t = e?.detail;
      if (!t?.id || !t.title) return;
      setItems((prev) => [...prev, { ...t, createdAt: Date.now() }].slice(-4));
      window.setTimeout(() => {
        setItems((prev) => prev.filter((x) => x.id !== t.id));
      }, 2600);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  const stack = useMemo(() => items, [items]);

  return (
    <div className="pointer-events-none fixed right-5 top-5 z-[80] flex w-[min(92vw,360px)] flex-col gap-2">
      {stack.map((t) => (
        <div
          key={t.id}
          className={[
            "pointer-events-auto overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-2xl",
            "ring-1 ring-inset ring-white/[0.05]",
            "animate-[toast-in_240ms_ease-out_both]",
            variantClasses(t.variant, accent),
          ].join(" ")}
        >
          <div className="flex items-start gap-3 px-4 py-3">
            <div
              className={[
                "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                "bg-gradient-to-br",
                accent.gradient,
                "text-white shadow-lg ring-1 ring-white/15",
              ].join(" ")}
              aria-hidden
            >
              {t.icon || "♪"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{t.title}</p>
              {t.message ? <p className="mt-0.5 line-clamp-2 text-xs opacity-80">{t.message}</p> : null}
            </div>
          </div>
          <div className={`h-1 w-full bg-gradient-to-r ${accent.gradient}`} aria-hidden />
        </div>
      ))}

      <style>
        {`
          @keyframes toast-in {
            from { opacity: 0; transform: translateY(-8px) scale(0.98); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}
      </style>
    </div>
  );
}

