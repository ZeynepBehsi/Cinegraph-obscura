import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getDirectorDetail, getDirectors } from '../utils/api'

// ── Sabit renkler (tailwind.config ile uyumlu) ────────────────────────────────

const C = {
  bg:      '#0a0a0f',
  surface: '#12121a',
  card:    '#1a1a26',
  border:  '#2a2a3a',
  accent:  '#e8c547',
  text:    '#e8e6e3',
  muted:   '#8a8a9a',
}

const GENRE_COLORS = {
  'Drama':            '#6b8aff',
  'Thriller':         '#ff6b35',
  'Comedy':           '#e8c547',
  'Crime':            '#47e8a0',
  'Romance':          '#e84747',
  'Mystery':          '#c547e8',
  'Horror':           '#8a4ae8',
  'Adventure':        '#47c5e8',
  'War':              '#e8a547',
  'Biography':        '#a0e847',
  'History':          '#e8d047',
  'Fantasy':          '#e847b4',
  'Animation':        '#47e8c5',
  'Documentary':      '#c5a47a',
  'Science Fiction':  '#47b4e8',
  'Music':            '#c5e847',
  'Western':          '#e8a07a',
  'Family':           '#a0c5e8',
}

const DEFAULT_COLOR = '#8a8a9a'

// ── SVG sabitleri ─────────────────────────────────────────────────────────────

const PAD   = { top: 52, right: 50, bottom: 62, left: 56 }
const SVG_H = 420                              // toplam yükseklik
const CHART_H   = SVG_H - PAD.top - PAD.bottom  // çizim alanı yüksekliği
const CHART_MID = PAD.top + CHART_H / 2         // orta çizgi y
const AXIS_Y    = PAD.top + CHART_H             // x ekseni y konumu
const DOT_MIN_R = 5
const DOT_MAX_R = 11

// ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────

function filmColor(film) {
  for (const g of (film.genres ?? [])) {
    if (GENRE_COLORS[g]) return GENRE_COLORS[g]
  }
  return DEFAULT_COLOR
}

function filmRadius(film) {
  if (film.rating == null) return 7
  return DOT_MIN_R + ((film.rating / 10) * (DOT_MAX_R - DOT_MIN_R))
}

// Aynı yıldaki filmler dikey olarak istiflenir; ölçülü boşlukla ortalanır
function computeLayout(films, svgW) {
  const valid = films.filter(f => f.year != null)
  if (!valid.length) return []

  const years  = valid.map(f => f.year)
  const minY   = Math.min(...years)
  const maxY   = Math.max(...years)
  const span   = maxY - minY || 1
  const chartW = svgW - PAD.left - PAD.right

  const xOf = yr => PAD.left + ((yr - minY) / span) * chartW

  // Yıla göre grupla
  const byYear = {}
  valid.forEach(f => {
    byYear[f.year] = byYear[f.year] ?? []
    byYear[f.year].push(f)
  })

  return valid.map(f => {
    const group   = byYear[f.year]
    const idx     = group.indexOf(f)
    const count   = group.length
    const r       = filmRadius(f)
    const spacing = r * 2 + 7
    const totalH  = (count - 1) * spacing
    const yStart  = CHART_MID - totalH / 2

    return {
      ...f,
      cx:    xOf(f.year),
      cy:    yStart + idx * spacing,
      r,
      color: filmColor(f),
    }
  })
}

// Yıl ekseni için tick hesapla
function buildTicks(films, svgW) {
  const years = films.filter(f => f.year).map(f => f.year)
  if (!years.length) return []

  const minY   = Math.min(...years)
  const maxY   = Math.max(...years)
  const span   = maxY - minY || 1
  const chartW = svgW - PAD.left - PAD.right
  const xOf    = yr => PAD.left + ((yr - minY) / span) * chartW

  const interval = span > 50 ? 10 : span > 25 ? 5 : span > 12 ? 2 : 1
  const ticks = []
  const start = Math.ceil(minY / interval) * interval
  for (let y = start; y <= maxY; y += interval) {
    ticks.push({ year: y, x: xOf(y) })
  }
  return ticks
}

// ── Tooltip (HTML, container'a göre mutlak konumlu) ───────────────────────────

function Tooltip({ film, pos, maxX }) {
  if (!film || !pos) return null

  const TW   = 208
  const left = Math.min(pos.x + 14, maxX - TW - 8)
  const top  = Math.max(pos.y - 110, 6)

  return (
    <div
      className="pointer-events-none absolute z-40 rounded-xl border border-cinema-border bg-cinema-card p-3.5 shadow-2xl"
      style={{ left, top, width: TW }}
    >
      <p className="mb-1.5 font-display text-sm font-bold leading-tight text-cinema-accent">
        {film.title}
      </p>

      <div className="space-y-0.5 font-mono text-[11px]">
        <p className="text-cinema-muted">{film.year}</p>
        {film.runtime   != null && <p className="text-cinema-muted">{film.runtime} dk</p>}
        {film.rating    != null && (
          <p style={{ color: C.accent }}>★ {Number(film.rating).toFixed(1)}</p>
        )}
        {film.vote_count != null && (
          <p className="text-cinema-muted/60">{film.vote_count.toLocaleString('tr-TR')} oy</p>
        )}
        {film.genres?.length > 0 && (
          <p className="mt-1 text-cinema-muted/70">{film.genres.slice(0, 3).join(' · ')}</p>
        )}
      </div>

      {/* Alt renk şerit */}
      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl opacity-60"
        style={{ backgroundColor: filmColor(film) }}
      />
    </div>
  )
}

// ── Tür renk göstergesi ───────────────────────────────────────────────────────

function GenreLegend({ films }) {
  const present = useMemo(() => {
    const seen = new Set()
    const out  = []
    for (const f of films) {
      for (const g of (f.genres ?? [])) {
        if (!seen.has(g)) { seen.add(g); out.push(g) }
      }
    }
    return out.sort()
  }, [films])

  if (!present.length) return null

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {present.map(g => (
        <div key={g} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: GENRE_COLORS[g] ?? DEFAULT_COLOR }}
          />
          <span className="font-mono text-[10px] text-cinema-muted">{g}</span>
        </div>
      ))}
    </div>
  )
}

// ── Film tablosu (collapsible) ────────────────────────────────────────────────

function FilmTable({ films, onFilmClick }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="overflow-hidden rounded-xl border border-cinema-border bg-cinema-card">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-cinema-surface"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-cinema-muted">Film Listesi</span>
          <span className="rounded-full bg-cinema-surface px-2 py-0.5 font-mono text-[10px] text-cinema-muted">
            {films.length}
          </span>
        </div>
        {open
          ? <ChevronUp  size={14} className="text-cinema-muted" />
          : <ChevronDown size={14} className="text-cinema-muted" />
        }
      </button>

      {open && (
        <div className="border-t border-cinema-border overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-cinema-border bg-cinema-surface">
              <tr>
                {['Film', 'Yıl', 'Süre', 'Puan', 'Türler'].map(h => (
                  <th
                    key={h}
                    className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-cinema-muted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {films.map((f, i) => (
                <tr
                  key={i}
                  onClick={() => onFilmClick?.(f)}
                  className="cursor-pointer border-b border-cinema-border/50 transition-colors hover:bg-cinema-surface"
                >
                  <td className="px-4 py-2 font-body text-xs text-cinema-text">{f.title}</td>
                  <td className="px-4 py-2 font-mono text-xs text-cinema-muted">{f.year ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs text-cinema-muted">
                    {f.runtime != null ? `${f.runtime} dk` : '—'}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs" style={{ color: C.accent }}>
                    {f.rating != null ? `★ ${Number(f.rating).toFixed(1)}` : '—'}
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px] text-cinema-muted">
                    {f.genres?.slice(0, 3).join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────

export default function TimelineView({ onFilmClick }) {
  const [allDirectors, setAllDirectors] = useState([])
  const [selectedName, setSelectedName] = useState('')
  const [detail,       setDetail]       = useState(null)
  const [isLoading,    setIsLoading]    = useState(false)
  const [error,        setError]        = useState(null)
  const [hovered,      setHovered]      = useState(null) // { film, pos }
  const [svgW,         setSvgW]         = useState(900)

  const containerRef = useRef(null)

  // Yönetmen listesini yükle
  useEffect(() => {
    getDirectors()
      .then(r => setAllDirectors(r.directors ?? []))
      .catch(() => {})
  }, [])

  // Container genişliğini ölç (responsive)
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(([entry]) => setSvgW(entry.contentRect.width))
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [detail]) // detail değişince yeniden observe et (dom yeniden oluşabilir)

  // Seçili yönetmenin detayını çek
  useEffect(() => {
    if (!selectedName) return
    setIsLoading(true)
    setError(null)
    setDetail(null)
    setHovered(null)
    getDirectorDetail(selectedName)
      .then(setDetail)
      .catch(e => setError(e.message ?? 'Yüklenemedi.'))
      .finally(() => setIsLoading(false))
  }, [selectedName])

  const films   = detail?.films ?? []
  const plotted = useMemo(() => computeLayout(films, svgW), [films, svgW])
  const ticks   = useMemo(() => buildTicks(films, svgW),   [films, svgW])

  const filmYears   = films.filter(f => f.year).map(f => f.year)
  const minYear     = filmYears.length ? Math.min(...filmYears) : 1960
  const maxYear     = filmYears.length ? Math.max(...filmYears) : 2000

  // Kariyer çizgisi başı ve sonu
  const careerX1 = plotted[0]?.cx ?? PAD.left
  const careerX2 = plotted[plotted.length - 1]?.cx ?? svgW - PAD.right

  // SVG'nin fiili genişliği: kısa karriyerlerde konteyner doldurulur,
  // uzun kariyerlerde yatay kaydırma etkinleşir
  const effectiveW = Math.max(svgW, (maxYear - minYear + 2) * 28 + PAD.left + PAD.right)

  function handleSvgMouseMove(e) {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setHovered(prev =>
      prev ? { ...prev, pos: { x: e.clientX - rect.left, y: e.clientY - rect.top } } : prev,
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Yönetmen seçici + özet ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-5 rounded-xl border border-cinema-border bg-cinema-card p-5">

        <div className="min-w-64 flex-1">
          <label className="mb-1.5 block font-mono text-[11px] uppercase tracking-wider text-cinema-muted">
            Yönetmen
          </label>
          <select
            value={selectedName}
            onChange={e => setSelectedName(e.target.value)}
            className="w-full rounded-lg border border-cinema-border bg-cinema-surface px-3 py-2.5 font-body text-sm text-cinema-text focus:outline-none focus:ring-1 focus:ring-cinema-accent/50"
          >
            <option value="">— Bir yönetmen seç —</option>
            {allDirectors.map(d => (
              <option key={d.name} value={d.name}>
                {d.name} ({d.film_count} film)
              </option>
            ))}
          </select>
        </div>

        {detail && (
          <div className="space-y-1 text-right">
            <p className="font-display text-2xl font-bold text-cinema-accent">{detail.name}</p>
            <p className="font-mono text-xs text-cinema-muted">
              {minYear} – {maxYear} &nbsp;·&nbsp; {films.length} film
            </p>
            {detail.movements?.length > 0 && (
              <p className="font-mono text-[11px] text-cinema-muted/60">
                {detail.movements.join(' · ')}
              </p>
            )}
            {detail.influenced_by?.length > 0 && (
              <p className="font-mono text-[11px] text-cinema-muted/50">
                Etkiler: {detail.influenced_by.slice(0, 4).join(', ')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Hata / yükleniyor ─────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="font-mono text-xs text-red-400">{error}</p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-3 py-16 text-cinema-muted">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cinema-accent [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cinema-accent [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cinema-accent [animation-delay:300ms]" />
          <span className="font-mono text-xs">Filmografi yükleniyor…</span>
        </div>
      )}

      {/* ── SVG Timeline ──────────────────────────────────────────────────── */}
      {plotted.length > 0 && (
        <div
          ref={containerRef}
          className="relative overflow-x-auto rounded-xl border border-cinema-border bg-cinema-bg"
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={() => setHovered(null)}
        >
          {/* HTML tooltip */}
          <Tooltip film={hovered?.film} pos={hovered?.pos} maxX={svgW} />

          <svg
            width={effectiveW}
            height={SVG_H}
            style={{ display: 'block' }}
          >
            {/* ── Arka plan dikey ızgara çizgileri ──────────────────── */}
            {ticks.map(({ year, x }) => (
              <line
                key={year}
                x1={x} y1={PAD.top - 8}
                x2={x} y2={AXIS_Y}
                stroke={C.border}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            ))}

            {/* ── X ekseni çizgisi ──────────────────────────────────── */}
            <line
              x1={PAD.left} y1={AXIS_Y}
              x2={effectiveW - PAD.right} y2={AXIS_Y}
              stroke={C.border}
              strokeWidth={1.5}
            />

            {/* ── Yıl tick'leri + etiketler ─────────────────────────── */}
            {ticks.map(({ year, x }) => (
              <g key={year}>
                <line
                  x1={x} y1={AXIS_Y}
                  x2={x} y2={AXIS_Y + 6}
                  stroke={C.muted}
                  strokeWidth={1}
                />
                <text
                  x={x} y={AXIS_Y + 20}
                  textAnchor="middle"
                  fill={C.muted}
                  fontSize={11}
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {year}
                </text>
              </g>
            ))}

            {/* ── Kariyer çizgisi (ilk → son film) ─────────────────── */}
            <line
              x1={careerX1} y1={CHART_MID}
              x2={careerX2} y2={CHART_MID}
              stroke={C.border}
              strokeWidth={1.5}
            />

            {/* ── Orta referans çizgisi (soluk) ─────────────────────── */}
            <line
              x1={PAD.left} y1={CHART_MID}
              x2={effectiveW - PAD.right} y2={CHART_MID}
              stroke={C.border}
              strokeWidth={0.5}
              strokeDasharray="2 6"
            />

            {/* ── Film noktaları ─────────────────────────────────────── */}
            {plotted.map((film, i) => (
              <g key={i}>
                {/* Yüksek puanlı filmler için halka efekti */}
                {film.rating != null && film.rating >= 7.5 && (
                  <circle
                    cx={film.cx}
                    cy={film.cy}
                    r={film.r + 5}
                    fill="none"
                    stroke={film.color}
                    strokeWidth={1}
                    opacity={0.25}
                  />
                )}

                {/* Ana nokta */}
                <circle
                  cx={film.cx}
                  cy={film.cy}
                  r={film.r}
                  fill={film.color}
                  stroke={C.bg}
                  strokeWidth={2}
                  style={{ cursor: 'pointer', transition: 'r 0.1s' }}
                  onMouseEnter={e => {
                    if (!containerRef.current) return
                    const rect = containerRef.current.getBoundingClientRect()
                    setHovered({
                      film,
                      pos: { x: e.clientX - rect.left, y: e.clientY - rect.top },
                    })
                  }}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onFilmClick?.(film)}
                />

                {/* X ekseninde renkli tick */}
                <line
                  x1={film.cx} y1={AXIS_Y}
                  x2={film.cx} y2={AXIS_Y + 4}
                  stroke={film.color}
                  strokeWidth={2}
                  opacity={0.5}
                />
              </g>
            ))}

            {/* ── Başlık ───────────────────────────────────────────────── */}
            <text
              x={PAD.left}
              y={PAD.top - 20}
              fill={C.text}
              fontSize={14}
              fontFamily="'Playfair Display', Georgia, serif"
              fontWeight="bold"
            >
              {detail?.name} — Kariyer Zaman Çizelgesi
            </text>

            {/* ── Puan ölçeği notu ──────────────────────────────────── */}
            <text
              x={effectiveW - PAD.right}
              y={PAD.top - 20}
              textAnchor="end"
              fill={C.muted}
              fontSize={9}
              fontFamily="'JetBrains Mono', monospace"
            >
              ○ boyut = TMDB puanı  ·  renk = tür
            </text>
          </svg>

          {/* Tür göstergesi */}
          <div className="border-t border-cinema-border px-5 py-3">
            <GenreLegend films={films} />
          </div>
        </div>
      )}

      {/* ── Film tablosu ──────────────────────────────────────────────────── */}
      {detail && films.length > 0 && (
        <FilmTable films={films} onFilmClick={onFilmClick} />
      )}

    </div>
  )
}
