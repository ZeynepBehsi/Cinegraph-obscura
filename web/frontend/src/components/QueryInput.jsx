import { Loader2, Search, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useLang } from '../i18n/LanguageContext'

export default function QueryInput({ onSubmit, isLoading, centered = false }) {
  const { t } = useLang()
  const [value, setValue] = useState('')

  const examples = t.query.examples

  function handleSubmit(e) {
    e.preventDefault()
    const q = value.trim()
    if (!q || isLoading) return
    onSubmit(q)
  }

  function handleChip(question) {
    setValue(question)
    if (!isLoading) onSubmit(question)
  }

  return (
    <div className="w-full space-y-5">
      {/* ── Arama çubuğu ─────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="group relative">
        <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-cinema-accent/40 via-cinema-highlight/30 to-cinema-accent/40 opacity-0 blur-sm transition-opacity duration-300 group-focus-within:opacity-100" />

        <div className={`relative flex items-center overflow-hidden rounded-2xl border border-cinema-border bg-cinema-card transition-colors duration-200 group-focus-within:border-cinema-accent/60 ${centered ? 'shadow-lg' : ''}`}>
          <Search
            size={centered ? 20 : 18}
            className="ml-5 shrink-0 text-cinema-muted transition-colors group-focus-within:text-cinema-accent"
          />

          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            disabled={isLoading}
            autoFocus={centered}
            placeholder={t.query.placeholder}
            className={`flex-1 bg-transparent px-4 font-body text-cinema-text placeholder:text-cinema-muted focus:outline-none disabled:opacity-50 ${centered ? 'py-5 text-base' : 'py-4 text-sm'}`}
          />

          <button
            type="submit"
            disabled={!value.trim() || isLoading}
            className={`mr-2 flex shrink-0 items-center gap-2 rounded-xl bg-cinema-accent font-body font-semibold text-cinema-bg transition-all duration-200 hover:bg-cinema-accent/90 disabled:cursor-not-allowed disabled:opacity-40 ${centered ? 'px-5 py-3 text-sm' : 'px-4 py-2 text-sm'}`}
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {t.query.thinking}
              </>
            ) : (
              <>
                <Sparkles size={14} />
                {t.query.submit}
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── Örnek sorular (sadece centered modda) ────────────────────────── */}
      {centered && (
        <div className="flex flex-col items-center gap-3">
          {[examples.slice(0, 3), examples.slice(3, 5), examples.slice(5, 6)].map(
            (row, rowIdx) => (
              <div key={rowIdx} className="flex justify-center gap-3">
                {row.map(q => (
                  <button
                    key={q}
                    onClick={() => handleChip(q)}
                    disabled={isLoading}
                    className="whitespace-nowrap rounded-xl border border-cinema-border bg-cinema-card px-4 py-3 font-body text-sm text-cinema-muted transition-all duration-150 hover:border-cinema-accent/50 hover:bg-cinema-surface hover:text-cinema-accent disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
