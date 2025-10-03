import React from "react"
import Icon from "./Icon"

/**
 * Vertical theme toggle with tasteful motion:
 * - Hover: capsule lifts + subtle glow
 * - Switch: quick emerald sweep across capsule + icon pop/rotate
 * - Active icon glows (sun in light, moon in dark)
 * - Persists preference in localStorage; respects prefers-color-scheme
 */
export default function ThemeToggle(){
  const initial = (): boolean => {
    const saved = localStorage.getItem("theme")
    if (saved === "dark") return true
    if (saved === "light") return false
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
  }

  const [dark, setDark] = React.useState<boolean>(initial)
  const [sweeping, setSweeping] = React.useState(false) // for the sweep animation
  const [popping, setPopping] = React.useState<"sun"|"moon"|null>(null)

  React.useEffect(() => {
    const root = document.documentElement
    if (dark) { root.classList.add("dark"); localStorage.setItem("theme","dark") }
    else { root.classList.remove("dark"); localStorage.setItem("theme","light") }
  }, [dark])

  const switchTo = (nextDark: boolean) => {
    if (dark === nextDark) return
    setDark(nextDark)
    setSweeping(true)
    setPopping(nextDark ? "moon" : "sun")
    // clear effects after they run
    window.setTimeout(() => setSweeping(false), 600)
    window.setTimeout(() => setPopping(null), 380)
  }

  const Btn = ({
    active, label, onClick, children
  }: {
    active: boolean; label: string; onClick: () => void; children: React.ReactNode
  }) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={[
        "toggle-btn w-7 h-7 rounded-full grid place-items-center",
        active
          ? "bg-[hsl(var(--muted))] dark:bg-white/15 shadow-inner"
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
        "toggle-capsule w-10 py-1 rounded-full relative",
        "bg-white/90 dark:bg-[hsl(var(--card))]/90 backdrop-blur",
        "border border-[hsl(var(--border))] dark:border-white/10",
        "flex flex-col items-center gap-1",
        sweeping ? "toggle-sweep" : ""
      ].join(" ")}
      // subtle focus ring when focusing the container (via tab -> buttons)
      tabIndex={-1}
    >
      {/* Moon (top) */}
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

      {/* Sun (bottom) */}
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
