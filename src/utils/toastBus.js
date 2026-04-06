/**
 * Tiny event-based toast bus.
 * We use a DOM CustomEvent so any component can fire a toast without prop drilling.
 */

export const TOAST_EVENT = "laya-toast";

/**
 * @param {{ title: string, message?: string, variant?: "info"|"success"|"error", icon?: string }} toast
 */
export function toast(toast) {
  try {
    window.dispatchEvent(
      new CustomEvent(TOAST_EVENT, {
        detail: {
          id: `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          title: toast?.title || "",
          message: toast?.message || "",
          variant: toast?.variant || "info",
          icon: toast?.icon || "",
        },
      })
    );
  } catch {
    // ignore
  }
}

