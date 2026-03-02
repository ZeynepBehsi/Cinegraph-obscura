# 🎬 Cinema Graph — Faz 5B: Agent + Web Arayüzü
# Claude Code Komuta Rehberi

> Bu dosya, VS Code + Claude Code ile adım adım web arayüzü ve agent sistemi kurmanı sağlar.
> Her adımda: (1) senin yapacakların, (2) Claude Code'a vereceğin prompt, (3) doğrulama adımları var.

---

## ÖN KOŞULLAR

Başlamadan önce şunların hazır olduğundan emin ol:
- ✅ Docker Desktop çalışıyor
- ✅ Memgraph container aktif (`docker ps` ile kontrol et)
- ✅ Memgraph'ta veri yüklü (değilse: `python scripts/load_to_memgraph.py`)
- ✅ Gemini API key var (https://aistudio.google.com/apikey adresinden al)
- ✅ Node.js kurulu (`node --version` ile kontrol et, yoksa: `brew install node`)

---

## ADIM 1: Proje Yapısını Oluştur

### 🧑 Sen yap:
VS Code'da `cinema-graph` klasörünü aç. Terminal'i aç.

### 🤖 Claude Code'a ver:

```
cinema-graph projesinin içinde bir web arayüzü oluşturacağız. Şu klasör yapısını kur:

cinema-graph/
├── web/
│   ├── backend/          # FastAPI Python backend
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── main.py
│   │   │   ├── db.py
│   │   │   └── agents/
│   │   │       ├── __init__.py
│   │   │       ├── query_agent.py
│   │   │       └── schema_context.py
│   │   ├── requirements.txt
│   │   ├── .env.example
│   │   └── run.sh
│   └── frontend/         # React + Vite frontend
│       ├── index.html
│       ├── package.json
│       ├── vite.config.js
│       ├── tailwind.config.js
│       ├── postcss.config.js
│       └── src/
│           ├── main.jsx
│           ├── index.css
│           ├── App.jsx
│           ├── utils/
│           │   └── api.js
│           └── components/
│               ├── Header.jsx
│               ├── QueryInput.jsx
│               ├── ResultDisplay.jsx
│               └── GraphVisualization.jsx

Sadece klasörleri ve boş dosyaları oluştur, içeriklerini sonra yazacağız.
```

### ✅ Doğrula:
```bash
find web -type f | sort
```

---

## ADIM 2: Backend — Memgraph Client

### 🤖 Claude Code'a ver:

```
web/backend/app/db.py dosyasını yaz.

Bu dosya Memgraph veritabanına bağlanan bir client sınıfı olacak.

Gereksinimler:
- neo4j Python driver kullan (pip install neo4j)
- Sınıf adı: MemgraphClient
- __init__: MEMGRAPH_URI environment variable'dan oku, default "bolt://localhost:7687"
- auth: ("", "") — Memgraph varsayılan olarak auth gerektirmez
- ping() metodu: bağlantı testi, True/False döner
- execute_query(cypher, params=None) metodu: Cypher sorgusu çalıştır, list of dict döner
- close() metodu: driver'ı kapat

Basit ve temiz tut.
```

---

## ADIM 3: Backend — Graph Schema Context

### 🤖 Claude Code'a ver:

```
web/backend/app/agents/schema_context.py dosyasını yaz.

Bu dosya, Gemini AI'a graph veritabanının yapısını açıklayan bağlam bilgisi sağlar.
Agent doğru Cypher sorguları üretebilsin diye graph şemasını bilmesi gerekiyor.

GRAPH_SCHEMA dict'i şunları içermeli:

Node Labels ve Properties:
- Person: name (string), tmdb_id (int) — Yönetmenler, oyuncular, DP'ler, besteciler, kurgucular, ses tasarımcıları, edebi/sanatsal etkiler
- Film: title (string), tmdb_id (int), year (int), runtime (int)
- Genre: name (string) — Drama, Thriller, Comedy vb.
- Studio: name (string) — Yapım şirketleri
- Country: name (string) — Yapım ülkeleri
- Movement: name (string) — French New Wave, Soviet Poetic Cinema, New Hollywood vb.

Relationship Types (tam olarak bu isimlerle):
- DIRECTOR: (Person)-[:DIRECTOR]->(Film)
- ACTOR: (Person)-[:ACTOR]->(Film)
- DIRECTOR_OF_PHOTOGRAPHY: (Person)-[:DIRECTOR_OF_PHOTOGRAPHY]->(Film)
- ORIGINAL_MUSIC_COMPOSER: (Person)-[:ORIGINAL_MUSIC_COMPOSER]->(Film)
- EDITOR: (Person)-[:EDITOR]->(Film)
- SOUND_DESIGNER: (Person)-[:SOUND_DESIGNER]->(Film)
- HAS_GENRE: (Film)-[:HAS_GENRE]->(Genre)
- PRODUCED_BY: (Film)-[:PRODUCED_BY]->(Studio)
- FROM_COUNTRY: (Film)-[:FROM_COUNTRY]->(Country)
- PART_OF_MOVEMENT: (Person)-[:PART_OF_MOVEMENT]->(Movement)
- INFLUENCED_BY: (Person)-[:INFLUENCED_BY]->(Person) — A was influenced by B

Seed Directors (14):
Andrei Tarkovsky, Stanley Kubrick, Ingmar Bergman, Woody Allen, Alfred Hitchcock, Federico Fellini, Akira Kurosawa, Jean Renoir, David Fincher, Quentin Tarantino, Paul Thomas Anderson, Nuri Bilge Ceylan, Zeki Demirkubuz, David Lynch

Ayrıca en az 8 örnek Cypher sorgusu ekle (soru-cevap formatında). Örnekler:
- "Tarkovsky'nin filmlerini listele"
- "Hitchcock ve Kubrick'in ortak oyuncuları"
- "En çok film çeken 10 yönetmen"
- "Nuri Bilge Ceylan kimlerden etkilenmiş"
- "Sven Nykvist hangi yönetmenlerle çalışmış"
- "Betweenness centrality en yüksek 10 kişi"
- "Community detection sonuçları"
- "Drama ve Thriller türünde filmler"

Önemli Memgraph kuralları:
- Aggregation (count, collect vb.) doğrudan RETURN'de kullanılMAZ, önce WITH ile aggregate et
- MAGE algoritmaları: pagerank.get(), betweenness_centrality.get(FALSE, FALSE), community_detection.get()
- String operatörleri: CONTAINS, STARTS WITH, ENDS WITH

get_schema_prompt() fonksiyonu: GRAPH_SCHEMA dict'ini LLM system prompt'u için düz metin formatına çeviren fonksiyon yaz.
```

---

## ADIM 4: Backend — Gemini Query Agent

### 🤖 Claude Code'a ver:

```
web/backend/app/agents/query_agent.py dosyasını yaz.

Bu dosya Gemini Pro API kullanarak 3 temel görev yapan bir agent sınıfı:

Sınıf: CinemaQueryAgent
Kütüphane: google-generativeai (pip install google-generativeai)
Model: gemini-2.0-flash

__init__:
- GEMINI_API_KEY environment variable'dan oku
- genai.configure(api_key=...) ile yapılandır
- genai.GenerativeModel("gemini-2.0-flash") oluştur
- schema_context.py'deki get_schema_prompt() fonksiyonunu çağırıp şema metnini hazırla

Metod 1 — async generate_cypher(question: str) -> str:
- Doğal dilde soruyu Cypher sorgusuna çevir
- System prompt'ta: şema bilgisi + kurallar + örnek sorgular
- Kullanıcı Türkçe sorabilir, Cypher üretilecek
- Çıktıdan ``` markdown işaretlerini temizle
- SADECE geçerli Cypher döndür

Metod 2 — async interpret_results(question, cypher, results) -> str:
- Sorgu sonuçlarını Türkçe yorumla
- Sinema tarihi bağlamında ilginç bağlantıları vurgula
- Markdown formatında yaz
- Kısa ve öz tut (max 3-4 paragraf)
- results'ı 30 satırla sınırla (prompt uzamasın)

Metod 3 — async fix_cypher(broken_cypher, error_msg) -> str:
- Hatalı Cypher sorgusunu hata mesajına göre düzelt
- Düzeltilmiş Cypher döndür veya düzeltemezse boş string

_system_prompt() helper: Şema bilgisi + Memgraph kurallarını birleştiren system prompt oluştur.

Tüm Gemini çağrılarını try/except ile sar, hata durumunda boş string veya fallback mesaj döndür.
```

---

## ADIM 5: Backend — FastAPI Ana Uygulama

### 🤖 Claude Code'a ver:

```
web/backend/app/main.py dosyasını yaz. Bu FastAPI uygulamasının ana dosyası.

Gereksinimler:

1. FastAPI app oluştur, CORS middleware ekle (origins: localhost:3001, localhost:5173)
2. MemgraphClient ve CinemaQueryAgent singleton'ları oluştur

Endpoints:

GET /health — Memgraph bağlantı durumu
GET /schema — Graph şemasını döndür (debug için)
GET /stats — Graph istatistikleri (node label bazında sayılar, relationship type bazında sayılar)
GET /directors — Seed yönetmenleri listele (en az 5 film yönetmiş Person'lar)
GET /director/{name} — Bir yönetmenin film listesi, genre'ları, ülkeleri
GET /explore/{node_name}?depth=1 — Bir düğümün komşuluk ağını graph-ready JSON olarak döndür

POST /query — ANA ENDPOINT. Request body: { question: string }
  Akış:
  1. agent.generate_cypher(question) → Cypher sorgusu üret
  2. db.execute_query(cypher) → Memgraph'ta çalıştır
  3. _extract_graph_data(results, cypher) → Sonuçlardan graph görselleştirme verisi çıkar
  4. agent.interpret_results(question, cypher, results) → Gemini ile yorumla
  5. Hata olursa → agent.fix_cypher(cypher, error) ile düzelt ve tekrar dene
  
  Response: {
    question, cypher_query, raw_results (max 100),
    interpretation, graph_data (nodes + edges), error
  }

_extract_graph_data helper:
- Sorgu sonuçlarından name/title gibi alanları tespit et
- Person tipi node'lar ve Film tipi node'lar oluştur
- Aynı satırdaki değerler arasında edge oluştur
- { nodes: [...], edges: [...] } formatında döndür

_build_graph_json helper:
- explore endpoint'i için path query sonuçlarından graph JSON oluştur

QueryRequest model: question (str), conversation_id (optional str)
QueryResponse model: question, cypher_query, raw_results, interpretation, graph_data, error
```

---

## ADIM 6: Backend — Konfigürasyon Dosyaları

### 🤖 Claude Code'a ver:

```
web/backend/ altında şu dosyaları oluştur:

1. requirements.txt:
fastapi==0.115.0
uvicorn[standard]==0.30.0
neo4j==5.25.0
google-generativeai==0.8.0
pydantic==2.9.0
python-dotenv==1.0.1

2. .env.example:
MEMGRAPH_URI=bolt://localhost:7687
GEMINI_API_KEY=your_gemini_api_key_here

3. run.sh (executable):
#!/bin/bash
set -a
source .env 2>/dev/null || true
set +a
echo "🎬 Cinema Graph Agent — Backend"
echo "Memgraph: ${MEMGRAPH_URI:-bolt://localhost:7687}"
echo "Gemini: $([ -n "$GEMINI_API_KEY" ] && echo 'configured ✓' || echo 'NOT SET ✗')"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

4. app/__init__.py: boş dosya
5. app/agents/__init__.py:
from .query_agent import CinemaQueryAgent
from .schema_context import GRAPH_SCHEMA, get_schema_prompt
```

---

## ADIM 7: Backend'i Test Et

### 🧑 Sen yap:

```bash
cd web/backend
pip install -r requirements.txt
cp .env.example .env
# .env dosyasını aç ve GEMINI_API_KEY'ini yaz
chmod +x run.sh
./run.sh
```

### ✅ Doğrula:
Tarayıcıda:
- http://localhost:8000/health → {"status": "ok", "memgraph": true}
- http://localhost:8000/stats → node ve relationship sayıları
- http://localhost:8000/directors → yönetmen listesi

### 🔧 Sorun çıkarsa:
Claude Code'a şunu ver:
```
Backend çalıştırınca şu hata aldım: [hatayı yapıştır]
web/backend/ altındaki dosyaları kontrol edip hatayı düzelt.
```

---

## ADIM 8: Frontend — Proje Kurulumu

### 🤖 Claude Code'a ver:

```
web/frontend/ altında React + Vite + Tailwind projesi kur.

package.json dependencies:
- react, react-dom (^18.3)
- react-markdown (^9.0)
- cytoscape (^3.30), react-cytoscapejs (^2.0)
- lucide-react (^0.400)

devDependencies:
- @vitejs/plugin-react, vite (^5.3)
- tailwindcss (^3.4), postcss, autoprefixer

vite.config.js:
- Port: 3001
- Proxy: /api → http://localhost:8000 (rewrite /api prefix'ini kaldır)

tailwind.config.js:
- Sinema temalı dark renk paleti:
  cinema-bg: #0a0a0f, cinema-surface: #12121a, cinema-card: #1a1a26,
  cinema-border: #2a2a3a, cinema-accent: #e8c547 (altın sarısı),
  cinema-text: #e8e6e3, cinema-muted: #8a8a9a, cinema-highlight: #ff6b35 (turuncu)
- Font aileleri: Playfair Display (display), DM Sans (body), JetBrains Mono (mono)

index.html:
- Google Fonts CDN'den Playfair Display, DM Sans, JetBrains Mono yükle
- Title: "Cinema Graph — Sinema İlişki Haritası"

postcss.config.js: standart tailwind + autoprefixer

src/index.css:
- Tailwind directives (@tailwind base/components/utilities)
- Custom scrollbar stili (koyu tema)
- Film grain overlay (SVG noise texture, opacity 0.03)
- Markdown yorumlama stilleri (.interpretation-text)
- fadeInUp animasyonu
```

---

## ADIM 9: Frontend — API Utility

### 🤖 Claude Code'a ver:

```
web/frontend/src/utils/api.js dosyasını yaz.

Backend'e istek atan helper fonksiyonlar:
- queryAgent(question) → POST /api/query
- getStats() → GET /api/stats
- getDirectors() → GET /api/directors
- getHealth() → GET /api/health
- exploreNode(name, depth) → GET /api/explore/{name}?depth={depth}

Her fonksiyon: fetch ile istek at, hata kontrolü yap, JSON parse edip döndür.
```

---

## ADIM 10: Frontend — Header Component

### 🤖 Claude Code'a ver:

```
web/frontend/src/components/Header.jsx dosyasını yaz.

Props: stats (object veya null)

İçerik:
- Sol: Film ikonu + "Cinema Graph" başlık (Playfair Display) + "Sinema İlişki Haritası" alt başlık (mono, uppercase)
- Sağ: stats varsa → film sayısı, kişi sayısı badge'leri + "Gemini Agent" etiketi
- Koyu arka plan, border-bottom, backdrop-blur

lucide-react'tan Film, Database, Cpu ikonları kullan.
Tailwind ile stil ver, sinema teması renklerini kullan.
```

---

## ADIM 11: Frontend — QueryInput Component

### 🤖 Claude Code'a ver:

```
web/frontend/src/components/QueryInput.jsx dosyasını yaz.

Props: onSubmit(question), isLoading

İçerik:
1. Arama çubuğu:
   - Input: placeholder "Sinema graph'ını keşfet... (Türkçe veya İngilizce)"
   - Submit butonu: "Sor" (Sparkles ikonu), loading durumunda "Düşünüyor..." (Loader2 + spin)
   - Glow efektli border (gradient hover)

2. Örnek sorular (clickable chips):
   - "Tarkovsky'nin filmlerini listele"
   - "Hitchcock ve Kubrick'in ortak oyuncuları kimler?"
   - "En çok bağlantıya sahip 10 kişi kimdir?"
   - "Nuri Bilge Ceylan kimlerden etkilenmiş?"
   - "Sven Nykvist hangi yönetmenlerle çalışmış?"
   - "Drama ve gerilim türünde filmler hangileri?"
   - "Graph'taki toplulukları göster"
   - "Woody Allen'ın en çok çalıştığı oyuncular?"

Tıklanan chip hem input'u doldursun hem submit etsin.
lucide-react: Search, Loader2, Sparkles
```

---

## ADIM 12: Frontend — GraphVisualization Component

### 🤖 Claude Code'a ver:

```
web/frontend/src/components/GraphVisualization.jsx dosyasını yaz.

Cytoscape.js kullanarak interaktif graph görselleştirmesi.

Props: graphData ({ nodes: [], edges: [] }), onNodeClick(node)

Renk paleti (node tipine göre):
- person: #e8c547 (altın), film: #ff6b35 (turuncu), genre: #6b8aff (mavi)
- studio: #47e8a0 (yeşil), country: #e84747 (kırmızı), movement: #c547e8 (mor)

Cytoscape style:
- Node: background-color data'dan, label göster, 28px boyut, text-outline koyu
- Edge: ince (1.5px), koyu gri, ok işaretli, label göster (8px mono)
- Selected node: beyaz border, büyüt (36px)
- Layout: cose (force-directed), animate, gravity 0.25

Legend: sağ üstte küçük kutu, her node tipinin rengini göster

Node tıklandığında onNodeClick callback'i çağır (id, label, type bilgisiyle).

Container yüksekliği: 450px, koyu arka plan, border.
Component graphData değiştiğinde önceki instance'ı destroy edip yenisini oluştur.
graphData boşsa null döndür (hiçbir şey render etme).
```

---

## ADIM 13: Frontend — ResultDisplay Component

### 🤖 Claude Code'a ver:

```
web/frontend/src/components/ResultDisplay.jsx dosyasını yaz.

Props: result (QueryResponse object), onNodeClick

Gösterecekleri (yukarıdan aşağıya):

1. Soru echo: MessageSquare ikonu + kullanıcının sorusu
2. Hata varsa: kırmızı kutu içinde hata mesajı
3. Interpretation: markdown olarak render et (react-markdown kullan). 
   Wrapper'a "interpretation-text" class'ı ver (CSS'te stili var)
4. Graph visualization: GraphVisualization component'i (graph_data varsa)
5. Cypher sorgusu (collapsible): Code ikonu + tıkla aç/kapa + pre tag
6. Ham veriler (collapsible): Table ikonu + satır sayısı + tıkla aç/kapa + table

Collapsible'lar için useState kullan. Varsayılan kapalı.
Her şeye fadeInUp animasyonu uygula.
lucide-react: Code, MessageSquare, Table, ChevronDown, ChevronUp
```

---

## ADIM 14: Frontend — App.jsx (Ana Uygulama)

### 🤖 Claude Code'a ver:

```
web/frontend/src/App.jsx dosyasını yaz.

State:
- stats: graph istatistikleri (useEffect ile mount'ta getStats() çağır)
- results: sorgu sonuçları listesi (array)
- isLoading: boolean

Mount'ta getStats() çağır, hata olursa null set et.

handleQuery(question):
- isLoading = true
- queryAgent(question) çağır
- Sonucu results array'ine ekle
- Hata olursa error mesajlı result ekle
- isLoading = false

handleNodeClick(node):
- node.label ile yeni bir query yap: '"X" hakkında detaylı bilgi ver'

Render:
1. film-grain overlay div
2. Header component (stats prop)
3. Main content (max-w-6xl, centered):
   a. Welcome state (results boşken): büyük başlık "Sinema Evrenini Keşfet" + açıklama + stat kartları
   b. Results listesi: her result için ResultDisplay component
   c. Auto-scroll: son result'a smooth scroll (useRef + useEffect)
4. Sticky bottom: QueryInput component

src/main.jsx: standart React 18 createRoot + StrictMode
```

---

## ADIM 15: Frontend'i Test Et

### 🧑 Sen yap:

```bash
cd web/frontend
npm install
npm run dev
```

### ✅ Doğrula:
1. http://localhost:3001 aç
2. Stat kartları görünüyor mu? (Film, Kişi sayıları)
3. Bir örnek soruya tıkla
4. Gemini'den yorum + graph görselleştirme geliyor mu?
5. Cypher sorgusu expandable mı?

### 🔧 Sorun çıkarsa:
Claude Code'a şunu ver:
```
Frontend'te şu hata var: [hatayı yapıştır]
Browser console'da şu hatalar görünüyor: [console logları]
web/frontend/ altındaki dosyaları kontrol edip düzelt.
Backend http://localhost:8000'de çalışıyor, /api proxy'si vite.config.js'te tanımlı.
```

---

## ADIM 16: Hata Ayıklama ve İyileştirme

### Olası sorunlar ve Claude Code prompt'ları:

**Gemini yanlış Cypher üretiyor:**
```
web/backend/app/agents/query_agent.py dosyasındaki generate_cypher metodunu iyileştir.
Şu soru için yanlış Cypher üretildi:
Soru: [soru]
Üretilen: [yanlış cypher]
Beklenen: [doğru cypher veya açıklama]
Schema context'te daha fazla örnek ekle veya system prompt'u güçlendir.
```

**Graph görselleştirme çalışmıyor:**
```
GraphVisualization.jsx'te graph doğru render edilmiyor.
Backend'den gelen graph_data şu formatta: [örnek veri]
Cytoscape.js elements doğru oluşturulmuyor. Kontrol edip düzelt.
```

**CORS hatası:**
```
Frontend'den backend'e istek atınca CORS hatası alıyorum.
Backend: localhost:8000, Frontend: localhost:3001
web/backend/app/main.py'deki CORS ayarını kontrol et.
```

---

## BONUS: Tüm Sistemi Tek Komutla Başlatma

### 🤖 Claude Code'a ver (opsiyonel):

```
cinema-graph/ kök dizininde bir start.sh scripti oluştur.
Bu script:
1. Docker'da memgraph-platform çalışıyor mu kontrol et, çalışmıyorsa başlat
2. Backend'i arka planda başlat (cd web/backend && ./run.sh &)
3. Frontend'i başlat (cd web/frontend && npm run dev)
4. Ctrl+C ile her ikisini de durdur (trap ile)
```

---

## ÖZEt: Komut Sırası

| Adım | Ne | Kim |
|------|-----|-----|
| 1 | Klasör yapısı oluştur | Claude Code |
| 2 | db.py — Memgraph client | Claude Code |
| 3 | schema_context.py — Graph şeması | Claude Code |
| 4 | query_agent.py — Gemini agent | Claude Code |
| 5 | main.py — FastAPI endpoints | Claude Code |
| 6 | Config dosyaları | Claude Code |
| 7 | Backend test | Sen (terminal) |
| 8 | Frontend proje kurulumu | Claude Code |
| 9 | api.js — API utility | Claude Code |
| 10 | Header.jsx | Claude Code |
| 11 | QueryInput.jsx | Claude Code |
| 12 | GraphVisualization.jsx | Claude Code |
| 13 | ResultDisplay.jsx | Claude Code |
| 14 | App.jsx + main.jsx | Claude Code |
| 15 | Frontend test | Sen (tarayıcı) |
| 16 | Hata ayıklama | Claude Code |
