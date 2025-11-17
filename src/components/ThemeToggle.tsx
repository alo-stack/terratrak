import React from "react"
import Icon from "./Icon"

export default function ThemeToggle() {
  const initial = (): boolean => {
    const saved = localStorage.getItem("theme")
    if (saved === "dark") return true
    if (saved === "light") return false
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
  }

  const [dark, setDark] = React.useState<boolean>(initial)
  const [sweeping, setSweeping] = React.useState(false)
  const [popping, setPopping] = React.useState<"sun" | "moon" | null>(null)

  React.useEffect(() => {
    const root = document.documentElement
    if (dark) {
      root.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      root.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }, [dark])

  const switchTo = (nextDark: boolean) => {
    if (dark === nextDark) return
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
        "w-9 h-9 md:w-8 md:h-8 rounded-full",
        active
          ? "bg-emerald-500/15 dark:bg-emerald-500/10 shadow-inner scale-105"
          : "hover:bg-black/[0.08] dark:hover:bg-white/[0.1] active:bg-black/10 dark:active:bg-white/15 active:scale-95"
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
        "md:w-12 md:py-1.5 md:rounded-2xl w-auto px-1.5 py-1 rounded-full",
        // visuals
        "bg-white/15 dark:bg-white/[0.08] backdrop-blur",
        "border border-white/25 dark:border-white/15",
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
            "w-4 h-4 transition-all duration-300",
            dark
              ? "text-gray-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] scale-110"
              : "text-gray-500 dark:text-gray-400",
            popping === "moon" ? "icon-pop" : ""
          ].join(" ")}
        />
      </Btn>

      {/* Sun (bottom / right) */}
      <Btn active={!dark} label="Light mode" onClick={() => switchTo(false)}>
        <Icon
          name="sun"
          className={[
            "w-4 h-4 transition-all duration-300",
            !dark
              ? "text-yellow-500 drop-shadow-[0_0_10px_rgba(255,200,0,0.8)] scale-110"
              : "text-gray-500 dark:text-gray-400",
            popping === "sun" ? "icon-pop" : ""
          ].join(" ")}
        />
      </Btn>
    </div>
  )
}
