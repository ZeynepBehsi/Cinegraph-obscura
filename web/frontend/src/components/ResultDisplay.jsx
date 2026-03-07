import { ChevronDown, ChevronUp, Code, MessageSquare, Table } from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useLang } from '../i18n/LanguageContext'
import GraphVisualization from './GraphVisualization'

export default function ResultDisplay({ result, onNodeClick }) {
  const { t } = useLang()
  const [cipherOpen, setCipherOpen] = useState(false)
  const [tableOpen, setTableOpen]   = useState(false)

  if (!result) return null


  const { question, cypher_query, raw_results, interpretation, graph_data, error } = result
  const hasGraph = graph_data?.nodes?.length > 0
  const hasRows  = raw_results?.length > 0
  const cols     = hasRows ? Object.keys(raw_results[0]) : []

  return (
    <div className="animate-fade-in-up space-y-4">

      {/* ── 1. Soru echo ─────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-xl border border-cinema-border bg-cinema-card px-4 py-3">
        <MessageSquare size={16} className="mt-0.5 shrink-0 text-cinema-accent" />
        <p className="font-body text-sm text-cinema-text">{question}</p>
      </div>

      {/* ── 2. Hata kutusu ───────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="font-mono text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* ── 3. Interpretation (Markdown) ─────────────────────────────────── */}
      {interpretation && (
        <div className="rounded-xl border border-cinema-border bg-cinema-card px-5 py-4">
          <div className="interpretation-text">
            <ReactMarkdown>{interpretation}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* ── 4. Graph görselleştirmesi ─────────────────────────────────────── */}
      {hasGraph && (
        <GraphVisualization graphData={graph_data} onNodeClick={onNodeClick} />
      )}

      {/* ── 5. Cypher (collapsible) ───────────────────────────────────────── */}
      {cypher_query && (
        <div className="overflow-hidden rounded-xl border border-cinema-border bg-cinema-card">
          <button
            onClick={() => setCipherOpen(v => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-cinema-surface"
          >
            <div className="flex items-center gap-2">
              <Code size={14} className="text-cinema-accent" />
              <span className="font-mono text-xs text-cinema-muted">{t.result.cypherQuery}</span>
            </div>
            {cipherOpen
              ? <ChevronUp size={14} className="text-cinema-muted" />
              : <ChevronDown size={14} className="text-cinema-muted" />
            }
          </button>

          {cipherOpen && (
            <div className="border-t border-cinema-border px-4 pb-4 pt-3">
              <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-cinema-accent">
                {cypher_query}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ── 6. Ham veriler (collapsible) ──────────────────────────────────── */}
      {hasRows && (
        <div className="overflow-hidden rounded-xl border border-cinema-border bg-cinema-card">
          <button
            onClick={() => setTableOpen(v => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-cinema-surface"
          >
            <div className="flex items-center gap-2">
              <Table size={14} className="text-cinema-accent" />
              <span className="font-mono text-xs text-cinema-muted">
                {t.result.rawData}
              </span>
              <span className="rounded-full bg-cinema-surface px-2 py-0.5 font-mono text-[10px] text-cinema-muted">
                {t.result.rows(raw_results.length)}
              </span>
            </div>
            {tableOpen
              ? <ChevronUp size={14} className="text-cinema-muted" />
              : <ChevronDown size={14} className="text-cinema-muted" />
            }
          </button>

          {tableOpen && (
            <div className="border-t border-cinema-border overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b border-cinema-border bg-cinema-surface">
                  <tr>
                    {cols.map(col => (
                      <th
                        key={col}
                        className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-cinema-muted"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {raw_results.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-cinema-border/50 transition-colors hover:bg-cinema-surface"
                    >
                      {cols.map(col => (
                        <td
                          key={col}
                          className="px-4 py-2 font-mono text-xs text-cinema-text"
                        >
                          <CellValue value={row[col]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

// ── Hücre değerini tipin göre render et ───────────────────────────────────────

function CellValue({ value }) {
  if (value === null || value === undefined) {
    return <span className="text-cinema-muted/50">—</span>
  }
  if (Array.isArray(value)) {
    return (
      <span className="text-cinema-muted">
        [{value.map((v, i) => (
          <span key={i}>
            {i > 0 && ', '}
            <span className="text-cinema-accent">{String(v)}</span>
          </span>
        ))}]
      </span>
    )
  }
  if (typeof value === 'number') {
    return <span className="text-cinema-highlight">{value.toLocaleString('tr-TR')}</span>
  }
  return <span>{String(value)}</span>
}
