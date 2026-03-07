import { useEffect, useRef, useState } from 'react'
import CompareView from './components/CompareView'
import Header from './components/Header'
import QueryInput from './components/QueryInput'
import ResultDisplay from './components/ResultDisplay'
import TimelineView from './components/TimelineView'
import { useLang } from './i18n/LanguageContext'
import { getStats, queryAgent } from './utils/api'

export default function App() {
  const { t } = useLang()
  const [activeTab, setActiveTab] = useState('explore')
  const [stats, setStats]         = useState(null)
  const [results, setResults]     = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef(null)

  // ── Mount: istatistikleri çek ──────────────────────────────────────────────
  useEffect(() => {
    getStats().then(setStats).catch(() => setStats(null))
  }, [])

  // ── Yeni result gelince smooth scroll ─────────────────────────────────────
  useEffect(() => {
    if (results.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [results])

  // ── Sorgu gönder ───────────────────────────────────────────────────────────
  async function handleQuery(question) {
    setIsLoading(true)
    try {
      const data = await queryAgent(question)
      setResults(prev => [...prev, data])
    } catch (err) {
      setResults(prev => [
        ...prev,
        {
          question,
          cypher_query: '',
          raw_results: [],
          interpretation: '',
          graph_data: { nodes: [], edges: [] },
          error: err.message ?? 'Beklenmeyen bir hata oluştu.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  // ── Node tıklandığında detay sorgusu ──────────────────────────────────────
  function handleNodeClick(node) {
    if (!node?.label) return
    handleQuery(`"${node.label}" hakkında detaylı bilgi ver`)
  }

  // ── Timeline'dan film tıklaması → Keşfet'e geç + sorgu çalıştır ──────────
  function handleFilmClick(film) {
    setActiveTab('explore')
    handleQuery(`"${film.title}" (${film.year}) filmini detaylı anlat`)
  }

  const hasResults = results.length > 0 || isLoading

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-cinema-bg font-body text-cinema-text">

      {/* Film grain overlay */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[9999] opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundSize: '300px 300px',
        }}
      />

      {/* Header (tabs dahil) */}
      <Header stats={stats} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main */}
      <main
        className={`mx-auto max-w-4xl px-4 pt-8 ${
          activeTab === 'explore' && hasResults ? 'pb-48' : 'pb-16'
        }`}
      >
        {activeTab === 'explore' ? (
          <>
            {/* ── Merkezi hero: sonuç yokken ── */}
            {!hasResults && (
              <div className="flex min-h-[calc(100vh-10rem)] flex-col items-center justify-center">
                <WelcomeState stats={stats} />
                <div className="mt-10 w-full max-w-2xl">
                  <QueryInput onSubmit={handleQuery} isLoading={isLoading} centered />
                </div>
              </div>
            )}

            {/* ── Sonuç listesi ── */}
            {hasResults && (
              <div className="space-y-8">
                {results.map((result, i) => (
                  <ResultDisplay key={i} result={result} onNodeClick={handleNodeClick} />
                ))}
              </div>
            )}

            {/* Loading indicator */}
            {isLoading && (
              <div className="mt-8 flex items-center justify-center gap-3 text-cinema-muted">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cinema-accent [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cinema-accent [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-cinema-accent [animation-delay:300ms]" />
                <span className="font-mono text-xs">{t.query.agentThinking}</span>
              </div>
            )}

            <div ref={bottomRef} />
          </>
        ) : activeTab === 'compare' ? (
          <CompareView />
        ) : (
          <TimelineView onFilmClick={handleFilmClick} />
        )}
      </main>

      {/* Sticky bottom — sonuç varsa göster */}
      {activeTab === 'explore' && hasResults && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-cinema-border bg-cinema-surface/90 backdrop-blur-md">
          <div className="mx-auto max-w-4xl px-4 py-4">
            <QueryInput onSubmit={handleQuery} isLoading={isLoading} />
          </div>
        </div>
      )}

    </div>
  )
}

// ── Welcome state ──────────────────────────────────────────────────────────────

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-xl border border-cinema-border bg-cinema-card px-6 py-5 text-center">
      <p className="font-display text-3xl font-bold" style={{ color }}>
        {value ?? '—'}
      </p>
      <p className="mt-1 font-mono text-xs uppercase tracking-widest text-cinema-muted">
        {label}
      </p>
    </div>
  )
}

function WelcomeState({ stats }) {
  const { t } = useLang()
  const filmCount   = stats?.nodes?.by_label?.find(r => r.label === 'Film')?.cnt
  const personCount = stats?.nodes?.by_label?.find(r => r.label === 'Person')?.cnt
  const relCount    = stats?.relationships?.total

  return (
    <div className="animate-fade-in-up text-center">
      <h2 className="font-display text-5xl font-bold leading-tight text-cinema-text">
        {t.welcome.titleLine}{' '}
        <span className="text-cinema-accent">{t.welcome.titleAccent}</span>
      </h2>
      <p className="mx-auto mt-4 max-w-xl font-body text-base text-cinema-muted">
        {t.welcome.description}
      </p>

      {stats && (
        <div className="mx-auto mt-8 grid max-w-lg grid-cols-3 gap-4">
          <StatCard label={t.welcome.statFilm}     value={filmCount}   color="#ff6b35" />
          <StatCard label={t.welcome.statPerson}   value={personCount} color="#e8c547" />
          <StatCard label={t.welcome.statRelation} value={relCount}    color="#6b8aff" />
        </div>
      )}
    </div>
  )
}
