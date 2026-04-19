import React from "react"
import { motion } from "framer-motion"
// Firestore integration for alert email persistence + history logging
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore"
import { db } from "../lib/firebase"
import { getDummyDataEnabled, onDummyDataChange, setDummyDataEnabled } from "../lib/dummyData"

type ThresholdField = { min: number | ""; max: number | "" }
type Thresholds = {
  temperature: ThresholdField
  moisture: ThresholdField
  n: ThresholdField
  p: ThresholdField
  k: ThresholdField
}

const THRESHOLDS_KEY = "tt_thresholds"

const DEFAULTS = {
  temperature: { min: 15, max: 65 },
  moisture: { min: 40, max: 80 },
  n: { min: 150, max: 900 },
  p: { min: 50, max: 300 },
  k: { min: 100, max: 800 },
}

const asNum = (v: any): number | "" => {
  if (v === "" || v === undefined || v === null) return ""
  const n = Number(v)
  return Number.isFinite(n) ? n : ""
}

function migrateThresholds(saved: any): Thresholds {
  const t = typeof saved === "string" ? JSON.parse(saved) : saved || {}
  return {
    temperature: {
      min: asNum(t?.temperature?.min) || DEFAULTS.temperature.min,
      max: asNum(t?.temperature?.max) || DEFAULTS.temperature.max,
    },
    moisture: {
      min: asNum(t?.moisture?.min) || DEFAULTS.moisture.min,
      max: asNum(t?.moisture?.max) || DEFAULTS.moisture.max,
    },
    n: {
      min: asNum(t?.n?.min) || DEFAULTS.n.min,
      max: asNum(t?.n?.max) || DEFAULTS.n.max,
    },
    p: {
      min: asNum(t?.p?.min) || DEFAULTS.p.min,
      max: asNum(t?.p?.max) || DEFAULTS.p.max,
    },
    k: {
      min: asNum(t?.k?.min) || DEFAULTS.k.min,
      max: asNum(t?.k?.max) || DEFAULTS.k.max,
    },
  }
}

export default function Settings() {
  // Simple email+password auth state
  const [userEmail, setUserEmail] = React.useState<string | null>(null)
  const [loginEmail, setLoginEmail] = React.useState("")
  const [loginPassword, setLoginPassword] = React.useState("")
  const [authError, setAuthError] = React.useState<string | null>(null)
  const [authLoading, setAuthLoading] = React.useState(false)
  const [recipients, setRecipients] = React.useState<string[]>([])

  // Change password state
  const [showChangePassword, setShowChangePassword] = React.useState(false)
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [newPasswordConfirm, setNewPasswordConfirm] = React.useState("")
  const [passwordError, setPasswordError] = React.useState<string | null>(null)
  const [passwordLoading, setPasswordLoading] = React.useState(false)

  // Load recipients list once
  React.useEffect(() => {
    const ref = doc(db, "email_addresses", "recipients")
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const emails = snap.get("emails") as string[]
        setRecipients(Array.isArray(emails) ? emails.map(e => e.toLowerCase()) : [])
      }
    }, () => {
      console.warn("Failed to load recipients")
    })
    return () => unsub()
  }, [])

  // Check if user is logged in on mount
  React.useEffect(() => {
    const saved = localStorage.getItem("tt_user_email")
    if (saved) {
      setUserEmail(saved)
    }
  }, [])

  // Handle login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    setAuthLoading(true)

    try {
      const email = loginEmail.trim().toLowerCase()
      const password = loginPassword.trim()

      // Check if email is in recipients
      if (!recipients.includes(email)) {
        setAuthError("Email not found in recipients list")
        setAuthLoading(false)
        return
      }

      // Get stored password (or default "terratrak")
      const accountRef = doc(db, "user_accounts", email)
      const accountSnap = await getDoc(accountRef)
      const storedPassword = accountSnap.exists() ? accountSnap.get("password") : "terratrak"

      if (password !== storedPassword) {
        setAuthError("Incorrect password")
        setAuthLoading(false)
        return
      }

      // Success - save to localStorage
      localStorage.setItem("tt_user_email", email)
      setUserEmail(email)
      setLoginEmail("")
      setLoginPassword("")
    } catch (err: any) {
      setAuthError(err.message || "Login failed")
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("tt_user_email")
    setUserEmail(null)
    setThresholds(DEFAULTS)
    setLoginEmail("")
    setLoginPassword("")
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)

    if (!userEmail) {
      setPasswordError("Not logged in")
      return
    }

    if (!currentPassword.trim()) {
      setPasswordError("Enter current password")
      return
    }

    if (!newPassword.trim()) {
      setPasswordError("Enter new password")
      return
    }

    if (newPassword !== newPasswordConfirm) {
      setPasswordError("Passwords don't match")
      return
    }

    setPasswordLoading(true)

    try {
      // Verify current password
      const accountRef = doc(db, "user_accounts", userEmail)
      const accountSnap = await getDoc(accountRef)
      const storedPassword = accountSnap.exists() ? accountSnap.get("password") : "terratrak"

      if (currentPassword !== storedPassword) {
        setPasswordError("Current password is incorrect")
        setPasswordLoading(false)
        return
      }

      // Update password
      await setDoc(accountRef, { 
        password: newPassword,
        updated_at: serverTimestamp()
      }, { merge: true })

      setBanner({ kind: "ok", msg: "Password changed successfully." })
      setCurrentPassword("")
      setNewPassword("")
      setNewPasswordConfirm("")
      setShowChangePassword(false)
      setTimeout(() => setBanner(null), 2200)
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password")
    } finally {
      setPasswordLoading(false)
    }
  }

  // Thresholds state - only load if user is logged in
  const [thresholds, setThresholds] = React.useState<Thresholds>(() => {
    const saved = localStorage.getItem(THRESHOLDS_KEY)
    return saved ? migrateThresholds(saved) : DEFAULTS
  })
  const [emailInput, setEmailInput] = React.useState<string>("")
  const [emailList, setEmailList] = React.useState<string[]>([])
  const [savedEmails, setSavedEmails] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState<"thresholds" | "email" | null>(null)
  const [banner, setBanner] = React.useState<{ kind: "ok" | "err"; msg: string } | null>(null)
  const [savedPulse, setSavedPulse] = React.useState<"t" | "e" | null>(null)
  const [loadingEmail, setLoadingEmail] = React.useState<boolean>(false)
  const emailListRef = React.useRef<string[]>([])
  const savedEmailsRef = React.useRef<string[]>([])
  const [dummyEnabled, setDummyEnabled] = React.useState<boolean>(getDummyDataEnabled())

  // Sprinkler control state
  const [sprinklerState, setSprinklerState] = React.useState<"unknown" | "on" | "off">("unknown")
  const [sprinklerLoading, setSprinklerLoading] = React.useState<boolean>(false)

  React.useEffect(() => onDummyDataChange(() => setDummyEnabled(getDummyDataEnabled())), [])

  // Load initial sprinkler state from Firebase on mount
  React.useEffect(() => {
    let active = true
    try {
      const ref = doc(db, "device_controls", "sprinkler")
      const unsub = onSnapshot(ref, (snap) => {
        if (!active) return
        if (!snap.exists()) {
          setSprinklerState("off")
          return
        }
        const state = snap.get("state")
        if (state === "on" || state === "off") {
          setSprinklerState(state)
        }
      }, (err) => {
        console.warn("Could not load sprinkler state", err)
        if (active) setSprinklerState("off")
      })
      return () => { active = false; unsub() }
    } catch (e) {
      console.warn("Could not subscribe to sprinkler control", e)
      if (active) setSprinklerState("off")
      return () => { active = false }
    }
  }, [])

  // Load user's thresholds from Firestore when logged in
  React.useEffect(() => {
    if (!userEmail) {
      setThresholds(DEFAULTS)
      return
    }

    let active = true
    try {
      const userThresholdRef = doc(db, "user_accounts", userEmail, "thresholds", "config")
      const unsub = onSnapshot(userThresholdRef, (snap) => {
        if (!active) return
        if (snap.exists()) {
          const cloud = snap.data() || {}
          if (cloud) {
            const migrated = migrateThresholds(cloud)
            setThresholds(migrated)
            setBanner({ kind: "ok", msg: "Thresholds loaded from your account." })
            setTimeout(() => setBanner(null), 2200)
          }
        }
      }, (err) => {
        console.warn('thresholds snapshot failed', err)
      })
      return () => { active = false; unsub() }
    } catch (e) {
      console.warn('could not subscribe to user thresholds', e)
      return () => { active = false }
    }
  }, [userEmail])

  const toggleSprinkler = async () => {
    setSprinklerLoading(true)
    try {
      const nextState = sprinklerState === "on" ? "off" : "on"
      const controlRef = doc(db, "device_controls", "sprinkler")
      await setDoc(controlRef, { state: nextState, updated_at: serverTimestamp() }, { merge: true })
      setSprinklerState(nextState)
      setBanner({ kind: "ok", msg: `Sprinkler turned ${nextState}.` })
      setTimeout(() => setBanner(null), 2200)
    } catch (err) {
      console.error("Failed to control sprinkler", err)
      setBanner({ kind: "err", msg: "Failed to control sprinkler." })
      setTimeout(() => setBanner(null), 2200)
    } finally {
      setSprinklerLoading(false)
    }
  }

  const setField = (group: keyof Thresholds, bound: "min" | "max", value: string) => {
    if (value === "" || /^-?\d+(\.\d+)?$/.test(value)) {
      setThresholds((prev) => ({
        ...prev,
        [group]: { ...prev[group], [bound]: value === "" ? "" : Number(value) },
      }))
    }
  }

  const labelFor = (k: keyof Thresholds) => {
    if (k === "temperature") return "Temperature"
    if (k === "moisture") return "Moisture"
    if (k === "n") return "Nitrogen (N)"
    if (k === "p") return "Phosphorus (P)"
    return "Potassium (K)"
  }

  const validateThresholds = (t: Thresholds): string | null => {
    for (const k of Object.keys(t) as (keyof Thresholds)[]) {
      const { min, max } = t[k]
      if (min === "" || max === "") return "All threshold fields must be filled."
      if (typeof min !== "number" || typeof max !== "number") return "Thresholds must be numbers."
      if (max < min) return `For ${labelFor(k)}, max must be greater than min.`
    }
    return null
  }

  const isDirty = React.useMemo(() => {
    const saved = localStorage.getItem(THRESHOLDS_KEY)
    const now = JSON.stringify(thresholds)
    return saved ? saved !== now : true
  }, [thresholds])

  const saveThresholds = () => {
    if (!userEmail) {
      setBanner({ kind: "err", msg: "Must be logged in to save thresholds." })
      return
    }

    const err = validateThresholds(thresholds)
    if (err) {
      setBanner({ kind: "err", msg: err })
      return
    }
    setSaving("thresholds")
    
    try {
      const userThresholdRef = doc(db, "user_accounts", userEmail, "thresholds", "config")
      setDoc(userThresholdRef, { 
        ...thresholds, 
        updated_at: serverTimestamp(),
        email: userEmail
      }, { merge: true }).catch((e) => console.warn('failed to save thresholds to cloud', e))
    } catch (e) {
      console.warn('failed to queue threshold cloud write', e)
    }
    
    setTimeout(() => {
      setSaving(null)
      setSavedPulse("t")
      setBanner({ kind: "ok", msg: "Thresholds saved to your account. Alerts will use these values." })
      setTimeout(() => setSavedPulse(null), 900)
    }, 300)
  }

  const validateEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())
  const maskEmail = (email: string): string => {
    const [localRaw, domainRaw] = email.trim().toLowerCase().split("@")
    if (!localRaw || !domainRaw) return "***"

    const localMasked = localRaw.length <= 2
      ? `${localRaw[0] || "*"}*`
      : `${localRaw.slice(0, 2)}${"*".repeat(Math.max(localRaw.length - 2, 3))}`

    const domainParts = domainRaw.split(".")
    const host = domainParts[0] || ""
    const tld = domainParts.slice(1).join(".")
    const hostMasked = host.length <= 1
      ? "*"
      : `${host[0]}${"*".repeat(Math.max(host.length - 1, 2))}`

    return tld ? `${localMasked}@${hostMasked}.${tld}` : `${localMasked}@${hostMasked}`
  }

  const normalizeEmails = (emails: string[]) =>
    emails
      .map((e) => e.trim().toLowerCase())
      .filter((e) => validateEmail(e))
      .sort()

  const emailDirty = React.useMemo(() => {
    return JSON.stringify(normalizeEmails(emailList)) !== JSON.stringify(normalizeEmails(savedEmails))
  }, [emailList, savedEmails])

  React.useEffect(() => {
    emailListRef.current = emailList
  }, [emailList])

  React.useEffect(() => {
    savedEmailsRef.current = savedEmails
  }, [savedEmails])

  const addEmail = () => {
    const val = emailInput.trim()
    if (!validateEmail(val)) {
      setBanner({ kind: "err", msg: "Please enter a valid email address." })
      return
    }
    setEmailList((prev) => {
      const next = Array.from(new Set([...prev, val]))
      return next
    })
    setEmailInput("")
  }

  const persistRecipients = (emails: string[]) => {
    const emailDocRef = doc(db, "email_addresses", "recipients")
    return setDoc(emailDocRef, { emails, updated_at: serverTimestamp() }, { merge: true })
  }

  const removeEmail = (value: string) => {
    const next = emailListRef.current.filter((e) => e !== value)
    setEmailList(next)
    setSaving("email")
    persistRecipients(normalizeEmails(next))
      .then(() => {
        setSavedEmails(normalizeEmails(next))
        setSaving(null)
        setSavedPulse("e")
        setBanner({ kind: "ok", msg: "Recipient removed." })
        setTimeout(() => setSavedPulse(null), 900)
      })
      .catch((err) => {
        console.error("Failed to remove email from Firestore", err)
        setSaving(null)
        setSavedPulse("e")
        setBanner({ kind: "err", msg: "Failed to remove recipient." })
        setTimeout(() => setSavedPulse(null), 900)
      })
  }

  const saveEmail = () => {
    setSaving("email")
    const sanitized = normalizeEmails(emailList)
    // References: recipients doc + logs doc (both in email_addresses collection)
    const logsDocRef = doc(db, "email_addresses", "logs")

    // Write current recipient list + append to logs
    Promise.all([
      persistRecipients(sanitized),
      setDoc(logsDocRef, { 
        entries: arrayUnion({ emails: sanitized, savedAt: new Date().toISOString() })
      }, { merge: true }),
    ])
      .then(async () => {
        setSaving(null)
        setSavedEmails(sanitized)
        setSavedPulse("e")
        setBanner({ kind: "ok", msg: "Alert recipients saved to cloud." })
        setTimeout(() => setSavedPulse(null), 900)
      })
      .catch((err) => {
        console.error("Failed to save email to Firestore", err)
        setSaving(null)
        setSavedPulse("e")
        setBanner({ kind: "err", msg: "Failed to save recipients to cloud." })
        setTimeout(() => setSavedPulse(null), 900)
      })
  }

  const migrateLegacyRecipients = async (): Promise<string[]> => {
    try {
      const legacyDoc = await getDoc(doc(db, "email_addresses", "email_address"))
      const legacyEmail = legacyDoc.exists() ? legacyDoc.get("email") : null

      const logsDoc = await getDoc(doc(db, "email_addresses", "logs"))
      const logEntries = logsDoc.exists() ? logsDoc.get("entries") : []

      const collected: string[] = []
      if (typeof legacyEmail === "string") collected.push(legacyEmail)

      if (Array.isArray(logEntries)) {
        logEntries.forEach((entry) => {
          if (typeof entry?.email === "string") collected.push(entry.email)
          if (Array.isArray(entry?.emails)) collected.push(...entry.emails)
        })
      }

      const merged = normalizeEmails(collected)
      if (merged.length) {
        await persistRecipients(merged)
      }
      return merged
    } catch (e) {
      console.warn("Could not migrate legacy recipients", e)
      return []
    }
  }

  // Load & subscribe to recipient list from Firestore only after user is logged in.
  React.useEffect(() => {
    if (!userEmail) {
      setLoadingEmail(false)
      return
    }

    let active = true
    setLoadingEmail(true)
    try {
      const ref = doc(db, "email_addresses", "recipients")
      const unsub = onSnapshot(ref, (snap) => {
        if (!active) return
        const cloudEmails = Array.isArray(snap.get("emails")) ? snap.get("emails") : []
        const cleaned = normalizeEmails(cloudEmails)

        if (cleaned.length === 0) {
          migrateLegacyRecipients().then((merged) => {
            if (!active) return
            setSavedEmails(merged)
            setEmailList(merged)
            setLoadingEmail(false)
          })
          return
        }

        setSavedEmails(cleaned)
        setEmailList(cleaned)
        setLoadingEmail(false)
      }, (err) => {
        console.warn("Could not load emails from Firestore", err)
        if (active) setLoadingEmail(false)
      })
      return () => { active = false; unsub() }
    } catch (e) {
      console.warn("Could not subscribe to email recipients", e)
      if (active) setLoadingEmail(false)
      return () => { active = false }
    }
  }, [userEmail])

  // Load & subscribe to threshold config from Firestore (for backward compat, but user's personal thresholds take precedence)
  React.useEffect(() => {
    if (userEmail) return // User has personal thresholds, skip global config
    
    let active = true
    try {
      const ref = doc(db, "alert_configs", "default")
      const unsub = onSnapshot(ref, (snap) => {
        if (!active) return
        if (!snap.exists()) return
        try {
          const cloud = snap.data() || {}
          if (cloud.thresholds) {
            const migrated = migrateThresholds(cloud.thresholds)
            setThresholds(migrated)
            try { localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(migrated)) } catch (e) { /* ignore */ }
            setBanner({ kind: "ok", msg: "Thresholds synced from cloud." })
            setTimeout(() => setBanner(null), 2200)
          }
        } catch (e) {
          console.warn('failed to apply cloud thresholds', e)
        }
      }, (err) => {
        console.warn('thresholds snapshot failed', err)
      })
      return () => { active = false; unsub() }
    } catch (e) {
      console.warn('could not subscribe to threshold config', e)
      return () => { active = false }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail])

  return (
    <div className="relative">
      {!userEmail ? (
        // Login form
        <div className="max-w-md mx-auto mt-12 p-6 border rounded-lg bg-white/80 dark:bg-[hsl(var(--card))]/85 backdrop-blur border-[hsl(var(--border))] dark:border-white/10">
          <h2 className="text-2xl font-bold mb-6">Settings</h2>
          <p className="text-sm opacity-70 mb-4">Sign in to manage your alert thresholds.</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold opacity-60">Email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border rounded bg-white/60 dark:bg-gray-900 border-[hsl(var(--border))] dark:border-white/10"
                placeholder="you@example.com"
                required
              />
            </div>
            
            <div>
              <label className="text-xs font-semibold opacity-60">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border rounded bg-white/60 dark:bg-gray-900 border-[hsl(var(--border))] dark:border-white/10"
                placeholder="••••••••"
                required
              />
            </div>
            
            {authError && (
              <div className="text-xs text-rose-600 dark:text-rose-400">
                {authError}
              </div>
            )}
            
            <button
              type="submit"
              disabled={authLoading}
              className="w-full px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              {authLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 animate-fade-in-up">
      
      {banner && (
        <div className="xl:col-span-12 banner-enter rounded-xl px-4 py-2 border text-sm bg-white/80 dark:bg-[hsl(var(--card))]/85 backdrop-blur border-[hsl(var(--border))] dark:border-white/10">
          <span className={banner.kind === "ok" ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
            {banner.msg}
          </span>
        </div>
      )}

      {/* Thresholds */}
      <section
        className={[
          "xl:col-span-7 setting-card p-4 sm:p-6 overflow-hidden relative",
          savedPulse === "t" ? "glow-on-save" : "",
          "animate-fade-in-up",
        ].join(" ")}
        style={{ animationDelay: "60ms" }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60 bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50" />
        <div className="absolute inset-0 -z-10 text-emerald-600 dark:text-emerald-400 bg-dots" />
        <div className="pointer-events-none absolute -top-12 -right-16 w-56 h-56 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />

        <Header
          title="Threshold calibration"
          subtitle="Define safe ranges TerraTrak should maintain."
          icon={<ThermoIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          chip={isDirty ? "Unsaved changes" : "Saved"}
          chipVariant={isDirty ? "muted" : "success"}
        />

        <div className="mt-4 grid gap-4">
          <ThresholdRow
            label="Temperature"
            unit="°C"
            hint="Guideline range: 25–35°C. Keep values within this band for stable activity."
            tooltip="We monitor compost core temp. Too hot can harm worms; too low slows decomposition."
            min={thresholds.temperature.min}
            max={thresholds.temperature.max}
            onMin={(v) => setField("temperature", "min", v)}
            onMax={(v) => setField("temperature", "max", v)}
          />
          <Divider />
          <ThresholdRow
            label="Moisture"
            unit="%"
            hint="Guideline range: 40–80% relative moisture (like a wrung-out sponge)."
            tooltip="Moisture keeps worms active and prevents overheating. Above ~80% can cause anaerobic zones."
            min={thresholds.moisture.min}
            max={thresholds.moisture.max}
            onMin={(v) => setField("moisture", "min", v)}
            onMax={(v) => setField("moisture", "max", v)}
          />
          <Divider />
          <ThresholdRow
            label="Nitrogen (N)"
            unit="ppm"
            hint="Guideline range: 50–100 ppm. Helps indicate balanced nitrogen availability."
            tooltip="We read N from your NPK sensor. Tune bounds to your sensor’s scale and desired feedstock ratio."
            min={thresholds.n.min}
            max={thresholds.n.max}
            onMin={(v) => setField("n", "min", v)}
            onMax={(v) => setField("n", "max", v)}
          />
          <ThresholdRow
            label="Phosphorus (P)"
            unit="ppm"
            hint="Guideline range: 5–15 ppm. Supports root development and compost maturity tracking."
            tooltip="Use this to track nutrient maturity trends. Calibrate with your sensor’s docs."
            min={thresholds.p.min}
            max={thresholds.p.max}
            onMin={(v) => setField("p", "min", v)}
            onMax={(v) => setField("p", "max", v)}
          />
          <ThresholdRow
            label="Potassium (K)"
            unit="ppm"
            hint="Guideline range: 100–180 ppm. Supports plant vigor and overall nutrient balance."
            tooltip="If K is low while N is high, consider more brown/carbon feedstock."
            min={thresholds.k.min}
            max={thresholds.k.max}
            onMin={(v) => setField("k", "min", v)}
            onMax={(v) => setField("k", "max", v)}
          />
        </div>

        {/* Save bar */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={saveThresholds}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60 w-full sm:w-auto justify-center"
            disabled={saving === "thresholds" || !isDirty}
          >
            {saving === "thresholds" ? <Spinner /> : null}
            Save thresholds
          </button>
          <button
            onClick={() => {
              setThresholds(DEFAULTS)
              setBanner(null)
            }}
            className="rounded-xl px-4 py-2 border border-[hsl(var(--border))] dark:border-white/15 hover:bg-[hsl(var(--muted))] dark:hover:bg-white/[0.06] transition-colors w-full sm:w-auto"
          >
            Reset
          </button>

          <div className="ml-auto flex flex-wrap gap-2 justify-center w-full sm:w-auto">
            <PreviewChip label="Temp" value={`${thresholds.temperature.min || "–"}–${thresholds.temperature.max || "–"}°C`} />
            <PreviewChip label="Moist" value={`${thresholds.moisture.min || "–"}–${thresholds.moisture.max || "–"}%`} />
            <PreviewChip label="N" value={`${thresholds.n.min || "–"}–${thresholds.n.max || "–"} ppm`} />
            <PreviewChip label="P" value={`${thresholds.p.min || "–"}–${thresholds.p.max || "–"} ppm`} />
            <PreviewChip label="K" value={`${thresholds.k.min || "–"}–${thresholds.k.max || "–"} ppm`} />
          </div>
        </div>
      </section>

      {/* Alerts */}
      <section
        className={[
          "xl:col-span-5 setting-card p-4 sm:p-6 overflow-hidden relative",
          savedPulse === "e" ? "glow-on-save" : "",
          "animate-fade-in-up",
        ].join(" ")}
        style={{ animationDelay: "140ms" }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60 bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50" />
        <div className="pointer-events-none absolute -bottom-14 -left-10 w-56 h-56 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />

        <Header
          title="Alert preferences"
          subtitle="Choose where TerraTrak should send notifications."
          icon={<BellIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          chip={emailDirty ? "Unsaved changes" : emailList.length ? "Saved" : "Not set"}
          chipVariant={emailDirty ? "muted" : emailList.length ? "success" : "muted"}
        />

        <div className="mt-4 max-w-xl">
          <label className="block text-sm font-medium mb-1 flex items-center gap-2">
            Alert recipients
            <InfoTip text="We’ll email everyone on this list when readings breach thresholds or the sensor goes offline." />
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              inputMode="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addEmail() }}
              placeholder="Add email (e.g. team@company.com)"
              className="input flex-1"
              disabled={loadingEmail}
            />
            <button
              onClick={addEmail}
              className="rounded-xl px-4 py-2 border border-[hsl(var(--border))] dark:border-white/15 hover:bg-[hsl(var(--muted))] dark:hover:bg-white/[0.06] transition-colors disabled:opacity-60"
              disabled={loadingEmail || saving === "email"}
            >
              Add
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {emailList.length === 0 ? (
              <span className="text-xs text-gray-600 dark:text-gray-300">No recipients yet.</span>
            ) : (
              emailList.map((addr) => (
                <span
                  key={addr}
                  className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs bg-[hsl(var(--muted))] dark:bg-white/[0.06] border border-[hsl(var(--border))] dark:border-white/10"
                >
                  <span className="text-gray-700 dark:text-gray-200">{maskEmail(addr)}</span>
                  <button
                    onClick={() => removeEmail(addr)}
                    className="text-gray-500 hover:text-rose-600"
                    aria-label="Remove recipient"
                    type="button"
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={saveEmail}
              className="rounded-xl px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
              disabled={loadingEmail || saving === "email" || !emailDirty}
            >
              {loadingEmail ? "Loading…" : saving === "email" ? "Saving…" : "Save recipients"}
            </button>
            <span className="text-xs text-gray-600 dark:text-gray-300">All saved emails receive the same alerts.</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-2 gap-3">
          <MiniBadge>Daily summary</MiniBadge>
          <MiniBadge>Threshold breach</MiniBadge>
          <MiniBadge>Sensor offline</MiniBadge>
          <MiniBadge>Firmware update</MiniBadge>
        </div>
      </section>

      {/* Testing tools */}
      <section
        className={[
          "xl:col-span-12 setting-card p-4 sm:p-6 overflow-hidden relative",
          "animate-fade-in-up",
        ].join(" ")}
        style={{ animationDelay: "220ms" }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60 bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50" />
        <div className="pointer-events-none absolute -top-10 -right-16 w-56 h-56 rounded-full bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10" />

        <Header
          title="Testing tools"
          subtitle="Use simulated readings for demos and UI testing."
          chip={dummyEnabled ? "Dummy data on" : "Live data only"}
          chipVariant={dummyEnabled ? "success" : "muted"}
        />

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-4">
          <ToggleSwitch
            label="Enable dummy data"
            enabled={dummyEnabled}
            onChange={(next) => {
              setDummyEnabled(next)
              setDummyDataEnabled(next)
            }}
          />
          <p className="text-xs text-gray-600 dark:text-gray-300">
            When off, charts and cards only show live readings from Firebase.
          </p>
        </div>
      </section>

      {/* Troubleshooting */}
      <section
        className={[
          "xl:col-span-12 setting-card p-4 sm:p-6 overflow-hidden relative",
          "animate-fade-in-up",
        ].join(" ")}
        style={{ animationDelay: "300ms" }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60 bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50" />
        <div className="pointer-events-none absolute -bottom-10 -right-16 w-56 h-56 rounded-full bg-blue-400/15 blur-2xl dark:bg-blue-300/10" />

        <Header
          title="Troubleshooting"
          subtitle="Manual device controls and diagnostics."
          icon={<WrenchIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
          chip={sprinklerState !== "unknown" ? `Sprinkler ${sprinklerState}` : "Status unknown"}
          chipVariant={sprinklerState === "on" ? "success" : "muted"}
        />

        <div className="mt-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div>
              <h3 className="text-sm font-medium">Sprinkler control</h3>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Manually toggle the sprinkler on or off for testing and maintenance.</p>
            </div>
            <button
              onClick={toggleSprinkler}
              disabled={sprinklerLoading || sprinklerState === "unknown"}
              className={[
                "ml-auto rounded-xl px-4 py-2 font-medium transition-colors disabled:opacity-60 flex items-center gap-2 whitespace-nowrap",
                sprinklerState === "on"
                  ? "bg-rose-600 text-white hover:bg-rose-700"
                  : "bg-blue-600 text-white hover:bg-blue-700",
              ].join(" ")}
            >
              {sprinklerLoading ? <Spinner /> : null}
              {sprinklerState === "on" ? "Turn Off" : "Turn On"}
            </button>
          </div>
        </div>
      </section>

      {/* Account section */}
      <div className="xl:col-span-12">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowChangePassword(!showChangePassword)}
            className="px-4 py-2 text-sm font-semibold border rounded hover:bg-white/50 dark:hover:bg-white/10 transition"
          >
            Change Password
          </button>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-semibold border rounded hover:bg-white/50 dark:hover:bg-white/10 transition"
          >
            Sign Out
          </button>
        </div>

        {showChangePassword && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-4 p-4 border rounded-lg bg-white/60 dark:bg-gray-900/40"
          >
            <h3 className="font-semibold mb-3">Change Password</h3>
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="text-xs font-semibold opacity-60">Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded bg-white/60 dark:bg-gray-800 border-[hsl(var(--border))] dark:border-white/10"
                  placeholder="••••••••"
                  required
                />
              </div>
              
              <div>
                <label className="text-xs font-semibold opacity-60">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded bg-white/60 dark:bg-gray-800 border-[hsl(var(--border))] dark:border-white/10"
                  placeholder="••••••••"
                  required
                />
              </div>
              
              <div>
                <label className="text-xs font-semibold opacity-60">Confirm New Password</label>
                <input
                  type="password"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-sm border rounded bg-white/60 dark:bg-gray-800 border-[hsl(var(--border))] dark:border-white/10"
                  placeholder="••••••••"
                  required
                />
              </div>
              
              {passwordError && (
                <div className="text-xs text-rose-600 dark:text-rose-400">
                  {passwordError}
                </div>
              )}
              
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={passwordLoading}
                  className="flex-1 px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {passwordLoading ? "Updating..." : "Update Password"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePassword(false)
                    setCurrentPassword("")
                    setNewPassword("")
                    setNewPasswordConfirm("")
                    setPasswordError(null)
                  }}
                  className="px-4 py-2 text-sm font-semibold border rounded hover:bg-white/50 dark:hover:bg-white/10 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </div>
      </div>
      )}
    </div>
  )
}

function Header({ title, subtitle, icon, chip, chipVariant = "muted" }: { title: string; subtitle?: string; icon?: React.ReactNode; chip?: string; chipVariant?: "muted" | "success" }) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {icon ?? <AccentDot />}
        <h2 className="text-base sm:text-lg font-semibold">{title}</h2>
        {chip && (
          <span
            className={[
              "ml-2 px-2 py-0.5 rounded-full text-[11px]",
              chipVariant === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-200 dark:border-emerald-400/20"
                : "bg-[hsl(var(--muted))] text-gray-700 border border-[hsl(var(--border))] dark:bg-white/[0.06] dark:text-gray-200 dark:border-white/10",
            ].join(" ")}
          >
            {chip}
          </span>
        )}
      </div>
      {subtitle && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{subtitle}</p>}
    </div>
  )
}

function AccentDot() {
  return <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shadow-[0_0_0_3px_rgba(16,185,129,0.15)]" />
}

function Divider() {
  return <div className="h-px bg-[hsl(var(--border))] dark:bg-white/10" />
}

function ThresholdRow(props: { label: string; unit: string; min: number | ""; max: number | ""; onMin: (v: string) => void; onMax: (v: string) => void; hint?: string; tooltip?: string }) {
  const { label, unit, min, max, onMin, onMax, hint, tooltip } = props
  return (
    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
      <div className="sm:col-span-4">
        <div className="text-sm font-medium flex items-center gap-2">
          {label}
          {tooltip ? <InfoTip text={tooltip} /> : null}
        </div>
        {hint && <div className="text-xs text-gray-600 dark:text-gray-300">{hint}</div>}
      </div>
      <div className="sm:col-span-8 grid grid-cols-2 gap-3">
        <NumberInput label="Min" value={min} onChange={onMin} unit={unit} />
        <NumberInput label="Max" value={max} onChange={onMax} unit={unit} />
      </div>
    </div>
  )
}

function NumberInput({ label, value, onChange, unit }: { label: string; value: number | ""; onChange: (v: string) => void; unit: string }) {
  return (
    <label className="w-full">
      <div className="text-xs text-gray-600 dark:text-gray-300 mb-1">{label}</div>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="0"
          className="input w-full pr-12"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400 select-none">{unit}</span>
      </div>
    </label>
  )
}

function PreviewChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-[hsl(var(--muted))] dark:bg-white/[0.06] border border-[hsl(var(--border))] dark:border-white/10">
      <span className="w-1 h-1 rounded-full bg-emerald-500" />
      <span className="text-gray-700 dark:text-gray-200">{label}:</span>
      <span className="font-medium">{value}</span>
    </span>
  )
}

function MiniBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-[hsl(var(--muted))] dark:bg-white/[0.06] border border-[hsl(var(--border))] dark:border-white/10">
      <span className="w-1 h-1 rounded-full bg-emerald-500" />
      {children}
    </span>
  )
}

function ToggleSwitch({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className="inline-flex items-center gap-3"
    >
      <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{label}</span>
      <span
        className={[
          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
          enabled ? "bg-emerald-600" : "bg-gray-300 dark:bg-white/15",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
            enabled ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </span>
    </button>
  )
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"></circle>
      <path className="opacity-75" d="M12 2a10 10 0 0 1 10 10h-3A7 7 0 0 0 12 5V2z" fill="currentColor"></path>
    </svg>
  )
}

function InfoTip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex items-center">
      <svg className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 17v-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="8" r="1" fill="currentColor" />
      </svg>
      <span className="absolute left-1/2 -translate-x-1/2 top-[130%] w-56 sm:w-64 z-10 hidden group-hover:block text-xs p-2 rounded-md bg-black/80 text-white shadow-lg">
        {text}
      </span>
    </span>
  )
}

function ThermoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M10 4a2 2 0 1 1 4 0v7.1a4.5 4.5 0 1 1-4 0V4z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 13v-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function BellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 5a5 5 0 0 0-5 5v2.5l-1.3 2.2a1 1 0 0 0 .9 1.5h10.8a1 1 0 0 0 .9-1.5L17 12.5V10a5 5 0 0 0-5-5z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function WrenchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M6 14l-3.5 3.5a2 2 0 0 0 0 2.83l2.67 2.67a2 2 0 0 0 2.83 0L11.5 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 4a4 4 0 0 0-5.66 0l-5.66 5.66" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
