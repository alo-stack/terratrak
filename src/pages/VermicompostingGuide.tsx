import React from "react"
import { Link } from "react-router-dom"
import Icon from "../components/Icon"

type LanguageMode = "en" | "tl" | "both"

const LanguageModeContext = React.createContext<LanguageMode>("both")

export default function VermicompostingGuide() {
  const [languageMode, setLanguageMode] = React.useState<LanguageMode>("both")

  return (
    <LanguageModeContext.Provider value={languageMode}>
      <div className="grid grid-cols-1 gap-4 animate-fade-in-up">
        <section className="relative card card-live p-5 md:p-6 overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] animate-shimmer opacity-60
                     bg-gradient-to-r from-transparent via-white to-transparent dark:via-white/50"
        />
        <div
          className="pointer-events-none absolute -top-10 -right-14 w-48 h-48 rounded-full
                     bg-emerald-400/15 blur-2xl dark:bg-emerald-300/10"
        />

        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <Header
              icon={<Icon name="info" className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
              title="African Night Crawler (ANC) Guide"
            />
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 max-w-2xl">
              Simple, practical care notes for daily vermiculture management.
            </p>
          </div>
          <div className="flex w-full sm:w-auto items-center justify-between sm:justify-start gap-2">
            <div className="inline-flex items-center rounded-md border border-[hsl(var(--border))] dark:border-white/10 p-0.5 bg-white/50 dark:bg-white/[0.03]">
              <LangButton label="EN" active={languageMode === "en"} onClick={() => setLanguageMode("en")} />
              <LangButton label="TL" active={languageMode === "tl"} onClick={() => setLanguageMode("tl")} />
              <LangButton label="Both" active={languageMode === "both"} onClick={() => setLanguageMode("both")} />
            </div>
            <Link
              to="/about"
              className="inline-flex items-center rounded-md border border-[hsl(var(--border))] dark:border-white/10 px-3 py-1.5 text-xs
                         hover:bg-[hsl(var(--muted))] dark:hover:bg-white/[0.06] transition-colors"
            >
              Back to About
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-300/30 dark:border-emerald-400/20 bg-gradient-to-br from-emerald-50/60 via-white/60 to-cyan-50/40 dark:from-emerald-500/10 dark:via-transparent dark:to-cyan-500/5 p-4 md:p-5 animate-fade-in-up">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
            <Pill icon="info">First step after delivery</Pill>
            <Pill icon="moon">Night behavior control</Pill>
            <Pill icon="gauge">Target moisture: 70%</Pill>
            <Pill icon="sun">Hot-climate friendly worms</Pill>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700 dark:text-gray-200">
            <InfoCard title="Upon Receiving" accent="emerald" icon="plus" delay={80}>
              <BilingualText
                en="Open the kit or sack right away so the worms can settle and breathe after transport."
                tl="Pagkarating, buksan agad ang kit o sako para makapag-settle at makahinga ang mga bulate matapos ang biyahe."
              />
            </InfoCard>
            <InfoCard title="During Nighttime" accent="sky" icon="moon" delay={160}>
              <BilingualText
                en="African Night Crawlers are more active at night or in dim areas, so they may try to explore or escape. Keep the setup under a lamp or in a well-lit area at night so it feels like daytime and reduces escape behavior."
                tl="Mas aktibo ang African Night Crawlers sa gabi o sa madilim na lugar kaya maaari silang gumala o tumakas. Maglagay ng ilaw o ilipat sa maliwanag na lugar sa gabi para magmukhang daytime at mabawasan ang pagtakas."
              />
            </InfoCard>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="rounded-xl border border-emerald-300/30 dark:border-emerald-400/20 bg-emerald-50/40 dark:bg-emerald-500/10 p-4 md:p-5 animate-fade-in-up" style={{ animationDelay: "220ms" }}>
            <h4 className="text-base font-semibold text-emerald-800 dark:text-emerald-200 mb-3 flex items-center gap-2">
              <span className="inline-grid place-items-center w-6 h-6 rounded-full bg-emerald-600 text-white">
                <Icon name="plus" className="w-3.5 h-3.5" />
              </span>
              Do's
            </h4>
            <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-3">
              <li>
                <strong>Food</strong>
                <BilingualText
                  en="Feed chopped vegetable scraps (retasong gulay), dry leaves, pesticide-free grass, and grass-fed animal manure (cow, carabao, goat, or horse)."
                  tl="Pakainin ng tinadtad na tirang gulay (retasong gulay), tuyong dahon, damong walang pesticide, at dumi ng grass-fed na hayop (baka, kalabaw, kambing, o kabayo)."
                />
              </li>
              <li>
                <strong>Mix the bedding</strong>
                <BilingualText
                  en="Mix or turn the compost once a week to prevent clumping and improve aeration."
                  tl="Haluin o i-turn ang compost isang beses kada linggo para hindi mamuo at para mas maayos ang aeration."
                />
              </li>
              <li>
                <strong>Watering</strong>
                <BilingualText
                  en="Keep the worm bed around 70% moisture. Water only as needed and avoid drowning the worms."
                  tl="Panatilihing nasa humigit-kumulang 70% ang moisture ng worm bed. Diligan lang kapag kailangan at iwasang malunod ang mga bulate."
                />
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-rose-300/30 dark:border-rose-400/20 bg-rose-50/35 dark:bg-rose-500/10 p-4 md:p-5 animate-fade-in-up" style={{ animationDelay: "300ms" }}>
            <h4 className="text-base font-semibold text-rose-800 dark:text-rose-200 mb-3 flex items-center gap-2">
              <span className="inline-grid place-items-center w-6 h-6 rounded-full bg-rose-600 text-white">
                <Icon name="more" className="w-3.5 h-3.5 rotate-90" />
              </span>
              Don'ts
            </h4>
            <ul className="text-sm text-gray-700 dark:text-gray-200 space-y-3">
              <li>
                <BilingualText
                  en="Do not place the bed under direct sunlight or rain. If there is no roof, cover it with a sack."
                  tl="Huwag ilagay sa direktang araw o ulan. Kapag walang bubong ang worm bed, takpan ito ng sako."
                />
              </li>
              <li>
                <BilingualText
                  en="Do not overwater. Excess water causes clumping, poor airflow, and can suffocate worms."
                  tl="Huwag sosobrahan ang tubig. Ang sobrang basa ay nagdudulot ng pamumuo, mahinang daloy ng hangin, at puwedeng ikasuffocate ng bulate."
                />
              </li>
              <li>
                <BilingualText
                  en="Keep substrate or compost at about half of the bin height to reduce the chance of worms escaping."
                  tl="Panatilihing hanggang kalahati lang ng taas ng lalagyan ang substrate o compost para mabawasan ang pagtakas ng mga bulate."
                />
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-[hsl(var(--border))] dark:border-white/10 bg-white/50 dark:bg-gray-900/40 p-4 md:p-5 animate-fade-in-up" style={{ animationDelay: "380ms" }}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="inline-grid place-items-center w-6 h-6 rounded-full bg-cyan-600 text-white">
                <Icon name="dashboard" className="w-3.5 h-3.5" />
              </span>
              Food Scraps Guide
            </h4>
            <span className="hidden sm:inline text-xs text-gray-600 dark:text-gray-300">Progress: 3 steps</span>
          </div>

          <div className="h-2 rounded-full bg-cyan-100 dark:bg-cyan-900/30 mb-4 overflow-hidden">
            <div className="h-full w-full bg-gradient-to-r from-cyan-500 via-emerald-500 to-lime-500" />
          </div>

          <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="hidden lg:block absolute top-8 left-[10%] right-[10%] h-[2px] bg-gradient-to-r from-cyan-400/50 via-emerald-400/50 to-lime-400/50" />
            <StepCard number="1" title="Hakbang 1" delay={440}>
              <p className="font-semibold">Gumamit ng Karaniwang Basura sa Kusina (Urban Food Scraps)</p>
              <BilingualText
                en="Use common kitchen waste such as vegetable peels (potato, carrots, squash), fruit peels (banana, papaya, mango, watermelon), coffee grounds, and tea bags."
                tl="Gumamit ng karaniwang basura sa kusina gaya ng balat ng gulay (patatas, carrots, kalabasa), balat ng prutas (saging, papaya, mangga, pakwan), coffee grounds, at tea bags."
              />
              <BilingualText
                en="OK: Chop food scraps into small pieces."
                tl="OK: Tadtarin nang maliliit ang food scraps."
              />
              <BilingualText
                en="Avoid oily, salty, and spicy food."
                tl="Iwasan ang mamantika, maalat, at maanghang."
              />
            </StepCard>

            <StepCard number="2" title="Hakbang 2" delay={520}>
              <p className="font-semibold">Ihanda ang Pagkain para sa Mainit na Panahon</p>
              <BilingualText
                en="For hot weather: dry scraps for 1-2 days, bury them 2-3 inches under the bedding, then feed small amounts more frequently."
                tl="Para sa mainit na panahon: patuyuin nang 1-2 araw, ibaon nang 2-3 pulgada sa ilalim ng bedding, at pakainin nang kaunti pero madalas."
              />
            </StepCard>

            <StepCard number="3" title="Hakbang 3" delay={600}>
              <p className="font-semibold">Panatilihin ang Tamang Moisture at Lamig</p>
              <BilingualText
                en="Mix in dry paper or cardboard, keep the bedding moist, and place the setup in a shaded area."
                tl="Haluan ng tuyong papel o karton, panatilihing mamasa-masa ang bedding, at ilagay sa may lilim."
              />
            </StepCard>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-[hsl(var(--border))] dark:border-white/10 bg-[hsl(var(--card))] p-4 md:p-5 animate-fade-in-up" style={{ animationDelay: "680ms" }}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="inline-grid place-items-center w-6 h-6 rounded-full bg-indigo-600 text-white">
                <Icon name="cog" className="w-3.5 h-3.5" />
              </span>
              Full Vermiculture Guide
            </h4>
            <span className="hidden sm:inline text-xs text-gray-600 dark:text-gray-300">Progress: 6 steps</span>
          </div>

          <div className="h-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 mb-4 overflow-hidden">
            <div className="h-full w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
          </div>

          <div className="rounded-lg border border-[hsl(var(--border))] dark:border-white/10 bg-[hsl(var(--muted))/0.35] dark:bg-white/[0.03] p-3 text-sm text-gray-700 dark:text-gray-200">
            <strong>Mga Kagamitang Kailangan / Materials Needed:</strong>
            <BilingualText
              en="Container with cover, drill or nail, grass or topsoil, African Night Crawlers, food scraps, and water."
              tl="Lagayan na may takip, drill o pako, damo o topsoil, African Night Crawlers, food scraps, at tubig."
            />
          </div>

          <ol className="mt-4 space-y-3 text-sm text-gray-700 dark:text-gray-200">
            <TimelineStep number="1" title="Ihanda ang lagayan" delay={760}>
              <BilingualText
                en="Prepare the container: Add holes for airflow and drainage."
                tl="Ihanda ang lagayan: Butasan ang lalagyan para sa hangin at paglabas ng tubig."
              />
            </TimelineStep>
            <TimelineStep number="2" title="Ihanda ang sapin" delay={840}>
              <BilingualText
                en="Prepare the bedding: Add moist bedding."
                tl="Ihanda ang sapin: Magdagdag ng basang sapin."
              />
            </TimelineStep>
            <TimelineStep number="3" title="Ilagay ang uod" delay={920}>
              <BilingualText
                en="Add the worms: Place the African Night Crawlers into the bed."
                tl="Ilagay ang uod: Ilagay ang African Night Crawlers."
              />
            </TimelineStep>
            <TimelineStep number="4" title="Pakainin ang uod" delay={1000}>
              <BilingualText
                en="Feed the worms: Add vegetable leftovers, fruit peels, coffee grounds, and crushed eggshells."
                tl="Pakainin ang uod: Magdagdag ng tira ng gulay, balat ng prutas, upos ng kape, at dinurog na eggshells."
              />
            </TimelineStep>
            <TimelineStep number="5" title="Panatilihin ang kulungan ng uod" delay={1080}>
              <BilingualText
                en="Maintain the worm bed: Keep the bed consistently moist."
                tl="Panatilihin ang kulungan ng uod: Panatilihing mamasa-masa ang bed."
              />
            </TimelineStep>
            <TimelineStep number="6" title="Anihin ang kompost" delay={1160}>
              <BilingualText
                en="Harvest the compost: Collect the rich vermicompost once it is ready."
                tl="Anihin ang kompost: Kolektahin ang mayamang vermicompost kapag handa na."
              />
            </TimelineStep>
          </ol>

          <div className="mt-4 rounded-lg border border-amber-300/30 dark:border-amber-400/20 bg-amber-50/40 dark:bg-amber-500/10 p-3 text-sm text-gray-800 dark:text-gray-100">
            <strong>Mahalagang Tip / Important Tip:</strong>
            <BilingualText
              en="Avoid meat, dairy, and salty or oily food. Do not overfeed the worms. African Night Crawlers perform better in warm climates."
              tl="Iwasan ang karne, dairy, at maalat o mamantikang pagkain. Huwag labis na pakainin ang mga uod. Mas mainam ang African Night Crawlers sa mainit na klima."
            />
          </div>
        </div>
        </section>
      </div>
    </LanguageModeContext.Provider>
  )
}

function Header({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <h2 className="text-lg md:text-lg font-semibold">{title}</h2>
    </div>
  )
}

function LangButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-1.5 text-xs rounded min-h-[34px]",
        "transition-colors duration-200",
        active
          ? "bg-emerald-600 text-white"
          : "text-gray-700 dark:text-gray-200 hover:bg-[hsl(var(--muted))] dark:hover:bg-white/[0.08]"
      ].join(" ")}
      aria-pressed={active}
    >
      {label}
    </button>
  )
}

function Pill({ children, icon }: { children: React.ReactNode; icon: "info" | "moon" | "gauge" | "sun" }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium
                     bg-white/75 text-emerald-800 border border-emerald-300/30
                     dark:bg-white/10 dark:text-emerald-200 dark:border-emerald-400/20">
      <Icon name={icon} className="w-3.5 h-3.5" />
      {children}
    </span>
  )
}

function InfoCard({
  title,
  accent,
  icon,
  delay,
  children,
}: {
  title: string
  accent: "emerald" | "sky"
  icon: "plus" | "moon"
  delay?: number
  children: React.ReactNode
}) {
  const accentClass = accent === "emerald"
    ? "border-emerald-300/30 dark:border-emerald-400/20"
    : "border-sky-300/30 dark:border-sky-400/20"

  return (
    <div
      className={`rounded-lg border ${accentClass} bg-white/55 dark:bg-white/[0.03] p-4 animate-fade-in-up`}
      style={{ animationDelay: `${delay ?? 0}ms` }}
    >
      <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
        <span className="inline-grid place-items-center w-6 h-6 rounded-full bg-white/80 dark:bg-white/10 border border-[hsl(var(--border))] dark:border-white/10">
          <Icon name={icon} className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300" />
        </span>
        {title}
      </h4>
      <div className="leading-6">{children}</div>
    </div>
  )
}

function StepCard({
  number,
  title,
  delay,
  children,
}: {
  number: string
  title: string
  delay?: number
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-lg border border-[hsl(var(--border))] dark:border-white/10 bg-[hsl(var(--card))] p-3 relative z-10 animate-fade-in-up"
      style={{ animationDelay: `${delay ?? 0}ms` }}
    >
      <div className="inline-flex items-center gap-2 mb-2">
        <span className="inline-grid place-items-center w-6 h-6 rounded-full text-xs font-semibold
                         bg-emerald-600 text-white ring-4 ring-emerald-200/60 dark:ring-emerald-900/40">
          {number}
        </span>
        <h5 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h5>
      </div>
      <div className="text-sm text-gray-700 dark:text-gray-200 space-y-2 leading-6">{children}</div>
    </div>
  )
}

function TimelineStep({
  number,
  title,
  delay,
  children,
}: {
  number: string
  title: string
  delay?: number
  children: React.ReactNode
}) {
  return (
    <li className="relative pl-11 animate-fade-in-up" style={{ animationDelay: `${delay ?? 0}ms` }}>
      <span className="absolute left-3 top-0 bottom-0 w-px bg-indigo-300/50 dark:bg-indigo-500/30" />
      <span className="absolute left-0 top-1 inline-grid place-items-center w-6 h-6 rounded-full text-xs font-semibold
                       bg-indigo-600 text-white ring-4 ring-indigo-200/60 dark:ring-indigo-900/40">
        {number}
      </span>
      <div className="rounded-lg border border-[hsl(var(--border))] dark:border-white/10 p-3">
        <strong>{number}) {title}:</strong> {children}
      </div>
    </li>
  )
}

function BilingualText({ en, tl }: { en: string; tl: string }) {
  const mode = React.useContext(LanguageModeContext)

  return (
    <div className="space-y-1 mt-1">
      {(mode === "en" || mode === "both") && <p>{en}</p>}
      {(mode === "tl" || mode === "both") && <p className="text-gray-600 dark:text-gray-300">{tl}</p>}
    </div>
  )
}
