const SESSION_STORAGE_KEY = "memento.sessionId";

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") {
    return `session-${Date.now()}`;
  }

  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const created = `session-${Date.now()}`;
  window.localStorage.setItem(SESSION_STORAGE_KEY, created);
  return created;
}
