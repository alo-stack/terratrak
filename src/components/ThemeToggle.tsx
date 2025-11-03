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
        "toggle-btn grid place-items-center transition-colors",
        "w-9 h-9 md:w-8 md:h-8 rounded-full",
        active
          ? "bg-[hsl(var(--muted))] dark:bg-white/12 shadow-inner"
          : "hover:bg-black/[0.05] dark:hover:bg-white/[0.08]"
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
        "bg-[hsl(var(--card))] backdrop-blur",
        "border border-[hsl(var(--border))] dark:border-white/12",
        sweeping ? "toggle-sweep" : ""
      ].join(" ")}
      tabIndex={-1}
    >
      {/* Moon (top / left) */}
      <Btn active={dark} label="Dark mode" onClick={() => switchTo(true)}>
        <Icon
          name="moon"
          className={[
            "w-4 h-4 transition-colors duration-300",
            dark
              ? "text-gray-100 drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]"
              : "text-gray-600",
            popping === "moon" ? "icon-pop" : ""
          ].join(" ")}
        />
      </Btn>

      {/* Sun (bottom / right) */}
      <Btn active={!dark} label="Light mode" onClick={() => switchTo(false)}>
        <Icon
          name="sun"
          className={[
            "w-4 h-4 transition-colors duration-300",
            !dark
              ? "text-yellow-500 drop-shadow-[0_0_8px_rgba(255,200,0,0.7)]"
              : "text-gray-400",
            popping === "sun" ? "icon-pop" : ""
          ].join(" ")}
        />
      </Btn>
    </div>
  )
}
