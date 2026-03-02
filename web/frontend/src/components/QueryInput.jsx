import { Loader2, Search, Sparkles } from 'lucide-react'
import { useState } from 'react'

const EXAMPLE_QUESTIONS = [
  "Tarkovsky'nin filmlerini listele",
  'Hitchcock ve Kubrick\'in ortak oyuncuları kimler?',
  'En çok bağlantıya sahip 10 kişi kimdir?',
  'Nuri Bilge Ceylan kimlerden etkilenmiş?',
  'Sven Nykvist hangi yönetmenlerle çalışmış?',
  'Drama ve gerilim türünde filmler hangileri?',
  "Graph'taki toplulukları göster",
  "Woody Allen'ın en çok çalıştığı oyuncular?",
]

export default function QueryInput({ onSubmit, isLoading }) {
  const [value, setValue] = useState('')

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
    <div className="w-full space-y-4">
      {/* ── Arama çubuğu ─────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="group relative">
        {/* Glow: sadece focus-within'de görünür */}
        <div className="pointer-events-none absolute -inset-px rounded-xl bg-gradient-to-r from-cinema-accent/40 via-cinema-highlight/30 to-cinema-accent/40 opacity-0 blur-sm transition-opacity duration-300 group-focus-within:opacity-100" />

        <div className="relative flex items-center overflow-hidden rounded-xl border border-cinema-border bg-cinema-card transition-colors duration-200 group-focus-within:border-cinema-accent/60">
          {/* Search ikonu */}
          <Search
            size={18}
            className="ml-4 shrink-0 text-cinema-muted transition-colors group-focus-within:text-cinema-accent"
          />

          {/* Input */}
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            disabled={isLoading}
            placeholder="Sinema graph'ını keşfet... (Türkçe veya İngilizce)"
            className="flex-1 bg-transparent px-3 py-4 font-body text-sm text-cinema-text placeholder:text-cinema-muted focus:outline-none disabled:opacity-50"
          />

          {/* Submit butonu */}
          <button
            type="submit"
            disabled={!value.trim() || isLoading}
            className="mr-2 flex shrink-0 items-center gap-2 rounded-lg bg-cinema-accent px-4 py-2 font-body text-sm font-semibold text-cinema-bg transition-all duration-200 hover:bg-cinema-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Düşünüyor...
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Sor
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── Örnek sorular ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUESTIONS.map(q => (
          <button
            key={q}
            onClick={() => handleChip(q)}
            disabled={isLoading}
            className="rounded-full border border-cinema-border bg-cinema-surface px-3 py-1.5 font-body text-xs text-cinema-muted transition-all duration-150 hover:border-cinema-accent/50 hover:bg-cinema-card hover:text-cinema-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
