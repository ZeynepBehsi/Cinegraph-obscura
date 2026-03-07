import { Clapperboard, Cpu, Database, Film, GitCompareArrows, Search } from 'lucide-react'
import { useLang } from '../i18n/LanguageContext'

const TAB_IDS = [
  { id: 'explore',  icon: Search },
  { id: 'compare',  icon: GitCompareArrows },
  { id: 'timeline', icon: Clapperboard },
]

export default function Header({ stats, activeTab, onTabChange }) {
  const { lang, setLang, t } = useLang()
  const filmCount   = stats?.nodes?.by_label?.find(r => r.label === 'Film')?.cnt ?? null
  const personCount = stats?.nodes?.by_label?.find(r => r.label === 'Person')?.cnt ?? null

  return (
    <header className="sticky top-0 z-50 border-b border-cinema-border bg-cinema-surface/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">

        {/* Sol — logo + başlık */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cinema-accent/10 ring-1 ring-cinema-accent/30">
            <Film size={18} className="text-cinema-accent" />
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold leading-none text-cinema-text">
              Cinema-Obscura
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-widest text-cinema-muted">
              {t.header.subtitle}
            </p>
          </div>
        </div>

        {/* Sağ — badge'ler + dil seçici + agent etiketi */}
        <div className="flex items-center gap-3">
          {filmCount !== null && (
            <Badge icon={<Film size={12} />} label={`${filmCount} ${t.welcome.statFilm}`} />
          )}
          {personCount !== null && (
            <Badge icon={<Database size={12} />} label={`${personCount} ${t.welcome.statPerson}`} />
          )}

          {/* Dil seçici */}
          <div className="flex overflow-hidden rounded-full border border-cinema-border bg-cinema-card">
            {['tr', 'en'].map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-1 font-mono text-[11px] font-semibold uppercase transition-colors ${
                  lang === l
                    ? 'bg-cinema-accent text-cinema-bg'
                    : 'text-cinema-muted hover:text-cinema-text'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-cinema-highlight/30 bg-cinema-highlight/10 px-3 py-1">
            <Cpu size={12} className="text-cinema-highlight" />
            <span className="font-mono text-[11px] font-medium text-cinema-highlight">
              Gemini Agent
            </span>
          </div>
        </div>

      </div>

      {/* Tab bar */}
      <div className="mx-auto flex max-w-7xl gap-1 px-4">
        {TAB_IDS.map(({ id, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange?.(id)}
            className={`relative flex items-center gap-2 px-4 py-2.5 font-mono text-xs transition-colors ${
              activeTab === id
                ? 'text-cinema-accent'
                : 'text-cinema-muted hover:text-cinema-text'
            }`}
          >
            <Icon size={13} />
            {t.header.tabs[id]}
            {activeTab === id && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-cinema-accent" />
            )}
          </button>
        ))}
      </div>
    </header>
  )
}

function Badge({ icon, label }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-cinema-border bg-cinema-card px-3 py-1">
      <span className="text-cinema-muted">{icon}</span>
      <span className="font-mono text-[11px] text-cinema-muted">{label}</span>
    </div>
  )
}
