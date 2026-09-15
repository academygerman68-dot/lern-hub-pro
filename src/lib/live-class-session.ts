const LIVE_CLASS_KEY = "ga_live_class_id";
const LIVE_SESSION_KEY = "ga_live_session_id";

export function setLiveClassId(classId: string) {
  sessionStorage.setItem(LIVE_CLASS_KEY, classId);
}

export function getLiveClassId(): string | null {
  return sessionStorage.getItem(LIVE_CLASS_KEY);
}

export function clearLiveClassId() {
  sessionStorage.removeItem(LIVE_CLASS_KEY);
}

export function setLiveSessionId(sessionId: string) {
  sessionStorage.setItem(LIVE_SESSION_KEY, sessionId);
}

export function getLiveSessionId(): string | null {
  return sessionStorage.getItem(LIVE_SESSION_KEY);
}

export function clearLiveSessionId() {
  sessionStorage.removeItem(LIVE_SESSION_KEY);
}
