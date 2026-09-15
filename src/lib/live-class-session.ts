const LIVE_CLASS_KEY = "ga_live_class_id";

export function setLiveClassId(classId: string) {
  sessionStorage.setItem(LIVE_CLASS_KEY, classId);
}

export function getLiveClassId(): string | null {
  return sessionStorage.getItem(LIVE_CLASS_KEY);
}

export function clearLiveClassId() {
  sessionStorage.removeItem(LIVE_CLASS_KEY);
}
