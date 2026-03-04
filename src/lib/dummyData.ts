const DUMMY_DATA_KEY = "tt_dummy_data_enabled"
const DUMMY_DATA_EVENT = "tt-dummy-data"

export function getDummyDataEnabled(): boolean {
  try {
    const raw = localStorage.getItem(DUMMY_DATA_KEY)
    if (raw === null) return true
    return raw === "1" || raw === "true"
  } catch {
    return true
  }
}

export function setDummyDataEnabled(enabled: boolean) {
  try {
    localStorage.setItem(DUMMY_DATA_KEY, enabled ? "1" : "0")
  } catch {}
  window.dispatchEvent(new Event(DUMMY_DATA_EVENT))
}

export function onDummyDataChange(handler: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === DUMMY_DATA_KEY) handler()
  }
  const onCustom = () => handler()
  window.addEventListener("storage", onStorage)
  window.addEventListener(DUMMY_DATA_EVENT, onCustom)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(DUMMY_DATA_EVENT, onCustom)
  }
}
