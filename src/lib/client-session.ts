const SESSION_KEY = "memento-session-id";

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) {
    return existing;
  }

  const created = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  window.localStorage.setItem(SESSION_KEY, created);
  return created;
}
