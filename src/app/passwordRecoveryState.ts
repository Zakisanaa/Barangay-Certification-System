type RecoveryBrowser = {
  location: { search: string; hash: string };
  sessionStorage: Pick<Storage, "getItem" | "setItem" | "removeItem">;
};

const storageKey = "barangay-password-recovery";

export function createPasswordRecoveryState(browser?: RecoveryBrowser) {
  const listeners = new Set<() => void>();
  let pending = false;

  function setPending(value: boolean) {
    try {
      if (value) browser?.sessionStorage.setItem(storageKey, "1");
      else browser?.sessionStorage.removeItem(storageKey);
    } catch { /* Recovery still works when browser storage is unavailable. */ }
    if (pending === value) return;
    pending = value;
    listeners.forEach(listener => listener());
  }

  function capture() {
    if (!browser) return;
    const query = new URLSearchParams(browser.location.search);
    const fragment = new URLSearchParams(browser.location.hash.slice(1));
    let stored = false;
    try { stored = browser.sessionStorage.getItem(storageKey) === "1"; } catch {}
    if (query.get("recovery") === "1" || fragment.get("type") === "recovery" || stored) {
      setPending(true);
    }
  }

  // Capture before Supabase consumes and removes the recovery fragment.
  capture();
  return {
    capture,
    getSnapshot: () => pending,
    begin: () => setPending(true),
    clear: () => setPending(false),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export const passwordRecoveryState = createPasswordRecoveryState(
  typeof window === "undefined" ? undefined : window,
);
