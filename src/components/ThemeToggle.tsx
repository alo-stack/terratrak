import React from "react"
import Icon from "./Icon"

export default function ThemeToggle() {
  const THEME_EVENT = "terratrak-theme-change"

  const initial = (): boolean => {
    const rootDark = document.documentElement.classList.contains("dark")
    if (rootDark) return true
    const saved = localStorage.getItem("theme")
    if (saved === "dark") return true
    if (saved === "light") return false
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
  }

  const applyTheme = React.useCallback((nextDark: boolean, emit = false) => {
    const root = document.documentElement
    root.classList.toggle("dark", nextDark)
    localStorage.setItem("theme", nextDark ? "dark" : "light")

    if (emit) {
      window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { dark: nextDark } }))
    }
  }, [])

  const [dark, setDark] = React.useState<boolean>(initial)
  const [sweeping, setSweeping] = React.useState(false)
  const [popping, setPopping] = React.useState<"sun" | "moon" | null>(null)

  React.useEffect(() => {
    applyTheme(dark)
  }, [dark, applyTheme])

  React.useEffect(() => {
    const onThemeEvent = (ev: Event) => {
      const customEv = ev as CustomEvent<{ dark?: boolean }>
      if (typeof customEv.detail?.dark === "boolean") {
        setDark(customEv.detail.dark)
      }
    }

    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== "theme") return
      if (ev.newValue === "dark") setDark(true)
      if (ev.newValue === "light") setDark(false)
    }

    window.addEventListener(THEME_EVENT, onThemeEvent as EventListener)
    window.addEventListener("storage", onStorage)

    return () => {
      window.removeEventListener(THEME_EVENT, onThemeEvent as EventListener)
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  const switchTo = (nextDark: boolean) => {
    if (dark === nextDark) return
    applyTheme(nextDark, true)
    setDark(nextDark)
    setSweeping(true)
    setPopping(nextDark ? "moon" : "sun")
    window.setTimeout(() => setSweeping(false), 600)
    window.setTimeout(() => setPopping(null), 380)
  }

  const Btn = ({
    active,
    label,
    onClick,
    children
  }: {
    active: boolean
    label: string
    onClick: () => void
    children: React.ReactNode
  }) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={[
        "toggle-btn grid place-items-center transition-all duration-200",
        "touch-manipulation",
        "w-10 h-10 md:w-8 md:h-8 rounded-full",
        active
          ? "bg-emerald-500/20 dark:bg-emerald-500/15 shadow-inner scale-105"
          : "hover:bg-black/[0.12] dark:hover:bg-white/[0.20] active:bg-black/20 dark:active:bg-white/25 active:scale-95"
      ].join(" ")}
    >
      <span className="sr-only">{label}</span>
      {children}
    </button>
  )

  return (
    <div
      className={[
        // horizontal on mobile, vertical on md+
        "toggle-capsule flex md:flex-col items-center gap-1 md:gap-1.5",
        // sizing
        "md:w-12 md:py-1.5 md:rounded-2xl w-auto px-2 py-1.5 rounded-full",
        // visuals
        "bg-white/35 dark:bg-zinc-900/45 backdrop-blur",
        "border border-white/50 dark:border-white/35",
        "shadow-[0_4px_14px_rgba(0,0,0,0.12)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]",
        sweeping ? "toggle-sweep" : ""
      ].join(" ")}
      tabIndex={-1}
      style={{ WebkitBackdropFilter: 'blur(12px)' }}
    >
      {/* Moon (top / left) */}
      <Btn active={dark} label="Dark mode" onClick={() => switchTo(true)}>
        <Icon
          name="moon"
          className={[
            "w-5 h-5 md:w-4 md:h-4 transition-all duration-300",
            dark
              ? "text-gray-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] scale-110"
              : "text-gray-600 dark:text-gray-300",
            popping === "moon" ? "icon-pop" : ""
          ].join(" ")}
        />
      </Btn>

      {/* Sun (bottom / right) */}
      <Btn active={!dark} label="Light mode" onClick={() => switchTo(false)}>
        <Icon
          name="sun"
          className={[
            "w-5 h-5 md:w-4 md:h-4 transition-all duration-300",
            !dark
              ? "text-yellow-500 drop-shadow-[0_0_10px_rgba(255,200,0,0.8)] scale-110"
              : "text-gray-600 dark:text-gray-300",
            popping === "sun" ? "icon-pop" : ""
          ].join(" ")}
        />
      </Btn>
    </div>
  )
}
