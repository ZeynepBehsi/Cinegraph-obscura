import {
  ArrowRight,
  Calendar,
  Clock,
  Film,
  GitBranch,
  Layers,
  Loader2,
  Search,
  Star,
  Users,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { compareDirectors, getDirectors } from '../utils/api'
import GraphVisualization from './GraphVisualization'

// ── Director autocomplete input ────────────────────────────────────────────────

function DirectorSearch({ value, onChange, allDirectors, placeholder, accentColor }) {
  const [query, setQuery]   = useState(value || '')
  const [open, setOpen]     = useState(false)
  const containerRef        = useRef(null)

  // Dışarı tıklanınca kapat
  useEffect(() => {
    function handler(e) {
      if (!containerRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Dış sıfırlama (örn. Clear butonu)
  useEffect(() => { setQuery(value || '') }, [value])

  const filtered = allDirectors
    .filter(d => d.name.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 8)

  function select(name) {
    setQuery(name)
    onChange(name)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-cinema-muted" />
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-cinema-border bg-cinema-surface py-2.5 pl-9 pr-3 font-body text-sm text-cinema-text placeholder:text-cinema-muted/40 focus:outline-none focus:ring-1 transition-shadow"
          style={{ '--tw-ring-color': accentColor }}
        />
        {/* Accent indicator — seçildiğinde */}
        {value && (
          <span
            className="absolute right-0 top-0 h-full w-0.5 rounded-r-lg"
            style={{ backgroundColor: accentColor }}
          />
        )}
      </div>

      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-cinema-border bg-cinema-card shadow-xl">
          {filtered.map(d => (
            <li key={d.name}>
              <button
                type="button"
                onMouseDown={() => select(d.name)}
                className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-cinema-surface"
              >
                <span className="text-sm text-cinema-text">{d.name}</span>
                <span className="font-mono text-[10px] text-cinema-muted">{d.film_count} film</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Single director stat card ──────────────────────────────────────────────────

function DirStatCard({ name, stats, accent }) {
  return (
    <div
      className="flex-1 rounded-xl border bg-cinema-card p-5 transition-colors"
      style={{ borderColor: `${accent}50` }}
    >
      <h3 className="mb-4 font-display text-xl font-bold leading-tight" style={{ color: accent }}>
        {name}
      </h3>
      <div className="space-y-2.5">
        <StatRow icon={<Film size={12} />}     label="Film Sayısı"  value={stats.film_count} />
        <StatRow icon={<Clock size={12} />}    label="Ort. Süre"    value={stats.avg_runtime != null ? `${stats.avg_runtime} dk` : '—'} />
        <StatRow icon={<Calendar size={12} />} label="Aktif Yıllar" value={stats.year_range ?? '—'} />
        <StatRow icon={<Star size={12} />}     label="Ort. Puan"    value={stats.avg_rating ?? '—'} />
      </div>
    </div>
  )
}

function StatRow({ icon, label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-cinema-muted">
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <span className="font-mono text-sm font-semibold text-cinema-text">{value}</span>
    </div>
  )
}

// ── Section title ──────────────────────────────────────────────────────────────

function SectionTitle({ title, icon }) {
  return (
    <div className="mb-3 flex items-center gap-2 border-b border-cinema-border/50 pb-2">
      <span className="text-cinema-muted">{icon}</span>
      <span className="font-mono text-[11px] uppercase tracking-wider text-cinema-muted">{title}</span>
    </div>
  )
}

function EmptyMsg({ text }) {
  return <p className="font-mono text-[11px] italic text-cinema-muted/40">{text}</p>
}

// ── Shared collaborators ───────────────────────────────────────────────────────

function CollaboratorsList({ items, d1Name, d2Name }) {
  if (!items?.length) return <EmptyMsg text="Ortak çalışan bulunamadı" />

  // Yönetmen soyadları (kısa gösterim için)
  const short1 = d1Name.split(' ').at(-1)
  const short2 = d2Name.split(' ').at(-1)

  return (
    <div className="space-y-1.5">
      {/* Başlık satırı */}
      <div className="flex items-center justify-between px-1 font-mono text-[9px] text-cinema-muted/50">
        <span>Ad</span>
        <div className="flex gap-3">
          <span style={{ color: '#ff6b35' }}>{short1}</span>
          <span style={{ color: '#6b8aff' }}>{short2}</span>
        </div>
      </div>
      {items.slice(0, 10).map((c, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-2 rounded-md bg-cinema-surface px-2.5 py-1.5"
        >
          <span className="text-xs text-cinema-text">{c.name}</span>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span style={{ color: '#ff6b35' }}>{c.films_with_d1}</span>
            <span style={{ color: '#6b8aff' }}>{c.films_with_d2}</span>
          </div>
        </div>
      ))}
      {items.length > 10 && (
        <p className="pt-1 text-center font-mono text-[10px] text-cinema-muted/50">
          +{items.length - 10} kişi daha
        </p>
      )}
    </div>
  )
}

// ── Shared genres ──────────────────────────────────────────────────────────────

function GenreList({ items }) {
  if (!items?.length) return <EmptyMsg text="Ortak tür bulunamadı" />
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((g, i) => (
        <span
          key={i}
          className="rounded-full border border-[#6b8aff]/30 bg-[#6b8aff]/10 px-2.5 py-1 font-mono text-[11px] text-[#6b8aff]"
        >
          {g.genre}
          <span className="ml-1 text-cinema-muted/50">({g.films_d1 + g.films_d2})</span>
        </span>
      ))}
    </div>
  )
}

// ── Shared movements ───────────────────────────────────────────────────────────

function MovementList({ items }) {
  if (!items?.length) return <EmptyMsg text="Ortak akım bulunamadı" />
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((mv, i) => (
        <span
          key={i}
          className="rounded-full border border-[#c547e8]/30 bg-[#c547e8]/10 px-2.5 py-1 font-mono text-[11px] text-[#c547e8]"
        >
          {mv}
        </span>
      ))}
    </div>
  )
}

// ── Influence paths ────────────────────────────────────────────────────────────

function InfluencePaths({ paths }) {
  if (!paths?.length) return <EmptyMsg text="Doğrudan etki bağlantısı bulunamadı" />

  return (
    <div className="space-y-2">
      {paths.map((p, i) => {
        if (p.type === 'direct') {
          return (
            <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-md bg-cinema-surface px-2.5 py-2 text-xs">
              <span className="font-semibold text-cinema-accent">{p.source}</span>
              <ArrowRight size={11} className="shrink-0 text-cinema-muted" />
              <span className="font-mono text-[10px] text-cinema-muted">INFLUENCED_BY</span>
              <ArrowRight size={11} className="shrink-0 text-cinema-muted" />
              <span className="font-semibold text-cinema-accent">{p.target}</span>
            </div>
          )
        }
        if (p.type === 'common_influence') {
          return (
            <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-md bg-cinema-surface px-2.5 py-2 text-xs">
              <span className="text-cinema-muted">Her ikisi de</span>
              <span className="font-semibold text-cinema-accent">{p.common_influence}</span>
              <span className="text-cinema-muted">tarafından etkilenmiş</span>
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

// ── Main CompareView ───────────────────────────────────────────────────────────

export default function CompareView() {
  const [allDirectors, setAllDirectors] = useState([])
  const [d1, setD1]           = useState('')
  const [d2, setD2]           = useState('')
  const [result, setResult]   = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError]     = useState(null)
  const resultsRef            = useRef(null)

  // Yönetmen listesini yükle
  useEffect(() => {
    getDirectors()
      .then(res => setAllDirectors(res.directors ?? []))
      .catch(() => {})
  }, [])

  // Sonuç gelince aşağı kaydır
  useEffect(() => {
    if (result) {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [result])

  async function handleCompare() {
    if (!d1.trim() || !d2.trim()) return
    setIsLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await compareDirectors(d1.trim(), d2.trim())
      setResult(data)
    } catch (err) {
      setError(err.message ?? 'Karşılaştırma sırasında bir hata oluştu.')
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && d1.trim() && d2.trim()) handleCompare()
  }

  return (
    <div className="space-y-6" onKeyDown={handleKeyDown}>

      {/* ── Arama formu ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-cinema-border bg-cinema-card p-6">
        <h2 className="mb-1 font-display text-2xl font-bold text-cinema-text">
          Yönetmen <span className="text-cinema-accent">Karşılaştır</span>
        </h2>
        <p className="mb-5 font-mono text-[11px] text-cinema-muted">
          İki yönetmenin filmografi, işbirliği ve etki ağını karşılaştır
        </p>

        <div className="grid grid-cols-[1fr_48px_1fr] items-center gap-3">
          <DirectorSearch
            value={d1}
            onChange={setD1}
            allDirectors={allDirectors}
            placeholder="İlk yönetmen…"
            accentColor="#ff6b35"
          />

          {/* VS ayırıcı */}
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cinema-border bg-cinema-surface font-display text-sm font-bold text-cinema-muted">
            VS
          </div>

          <DirectorSearch
            value={d2}
            onChange={setD2}
            allDirectors={allDirectors}
            placeholder="İkinci yönetmen…"
            accentColor="#6b8aff"
          />
        </div>

        <div className="mt-4 flex justify-center">
          <button
            onClick={handleCompare}
            disabled={isLoading || !d1.trim() || !d2.trim()}
            className="flex items-center gap-2 rounded-lg bg-cinema-accent px-7 py-2.5 font-mono text-sm font-bold text-cinema-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Analiz ediliyor…
              </>
            ) : (
              'Karşılaştır'
            )}
          </button>
        </div>
      </div>

      {/* ── Hata ───────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="font-mono text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* ── Sonuçlar ───────────────────────────────────────────────────────── */}
      {result && (
        <div ref={resultsRef} className="animate-fade-in-up space-y-5">

          {/* Stat kartları — d1 | VS | d2 */}
          <div className="flex items-stretch gap-4">
            <DirStatCard name={d1} stats={result.director1_stats} accent="#ff6b35" />

            <div className="flex shrink-0 items-center justify-center px-1">
              <span className="font-display text-2xl font-bold text-cinema-border">VS</span>
            </div>

            <DirStatCard name={d2} stats={result.director2_stats} accent="#6b8aff" />
          </div>

          {/* Ortak veriler — 3 sütun */}
          <div className="grid grid-cols-3 gap-4">

            {/* Ortak çalışanlar */}
            <div className="rounded-xl border border-cinema-border bg-cinema-card p-4">
              <SectionTitle
                title={`Ortak Çalışanlar (${result.shared_collaborators.length})`}
                icon={<Users size={12} />}
              />
              <CollaboratorsList
                items={result.shared_collaborators}
                d1Name={d1}
                d2Name={d2}
              />
            </div>

            {/* Ortak türler */}
            <div className="rounded-xl border border-cinema-border bg-cinema-card p-4">
              <SectionTitle
                title={`Ortak Türler (${result.shared_genres.length})`}
                icon={<Layers size={12} />}
              />
              <GenreList items={result.shared_genres} />
            </div>

            {/* Akımlar + Etki yolları */}
            <div className="space-y-4">
              <div className="rounded-xl border border-cinema-border bg-cinema-card p-4">
                <SectionTitle
                  title={`Ortak Akımlar (${result.shared_movements.length})`}
                  icon={<Layers size={12} />}
                />
                <MovementList items={result.shared_movements} />
              </div>

              <div className="rounded-xl border border-cinema-border bg-cinema-card p-4">
                <SectionTitle
                  title={`Etki Bağlantıları (${result.influence_path.length})`}
                  icon={<GitBranch size={12} />}
                />
                <InfluencePaths paths={result.influence_path} />
              </div>
            </div>

          </div>

          {/* Graph görselleştirmesi */}
          {result.graph_data?.nodes?.length > 0 && (
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-cinema-muted">
                Ortak Ağ Haritası · {result.graph_data.nodes.length} node · {result.graph_data.edges.length} edge
              </p>
              <GraphVisualization graphData={result.graph_data} />
            </div>
          )}

          {/* Gemini yorumu */}
          {result.interpretation && (
            <div className="rounded-xl border border-cinema-border bg-cinema-card px-5 py-5">
              <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-cinema-muted">
                Gemini Analizi
              </p>
              <div className="interpretation-text">
                <ReactMarkdown>{result.interpretation}</ReactMarkdown>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
