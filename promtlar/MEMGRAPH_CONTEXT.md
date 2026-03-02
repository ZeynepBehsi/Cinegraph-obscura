1. Veritabanı Şeması — Referans
İlişki Tipleri (Relationship Types)
İlişkiSayıYönACTOR3,141(Person)-[:ACTOR]->(Film)PRODUCED_BY689(Film)-[:PRODUCED_BY]->(Studio)HAS_GENRE684(Film)-[:HAS_GENRE]->(Genre)FROM_COUNTRY439(Film)-[:FROM_COUNTRY]->(Country)DIRECTOR436(Person)-[:DIRECTOR]->(Film)DIRECTOR_OF_PHOTOGRAPHY411(Person)-[:DIRECTOR_OF_PHOTOGRAPHY]->(Film)EDITOR380(Person)-[:EDITOR]->(Film)ORIGINAL_MUSIC_COMPOSER241(Person)-[:ORIGINAL_MUSIC_COMPOSER]->(Film)SOUND_DESIGNER92(Person)-[:SOUND_DESIGNER]->(Film)
Node Tipleri (Node Labels)
LabelAçıklamaProperty'lerPersonYönetmen, oyuncu, besteci vb.tmdb_id, nameFilmFilmlertmdb_id, title, year, runtimeGenreTürlernameStudioYapım şirketlerinameCountryÜlkelername
Seed Yönetmenler (14)
Andrei Tarkovsky, Stanley Kubrick, Ingmar Bergman, Woody Allen, Alfred Hitchcock, Federico Fellini, Akira Kurosawa, Jean Renoir, David Fincher, Quentin Tarantino, Paul Thomas Anderson, Nuri Bilge Ceylan, Zeki Demirkubuz, David Lynch

1. Bu prompt'u Claude Code'a her Cypher sorgusu yazdırmak istediğinde başa ekle:


Bağlam: Memgraph Cinema Graph Projesi
Memgraph graph veritabanında sinema ilişki ağı var. Sorguları Memgraph'ın Cypher uyumlu söz dizimine göre yaz.
Memgraph Cypher kuralları:

Aggregation fonksiyonları (count, sum, avg, collect vb.) doğrudan RETURN'de kullanılMAZ. Önce WITH clause'da aggregate et, sonra RETURN et.
Örnek: MATCH (n) WITH labels(n) AS lbl, count(n) AS cnt RETURN lbl, cnt ORDER BY cnt DESC;
Path döndürürken RETURN p kullan (graph görselleştirmesi için gerekli).
RETURN node1, node2 yerine MATCH p=... RETURN p tercih et.

Node Labels: Person, Film, Genre, Studio, Country
Node Property'leri:

Person: tmdb_id (int), name (string)
Film: tmdb_id (int), title (string), year (int), runtime (int)
Genre: name (string)
Studio: name (string)
Country: name (string)

Relationship Types (tam olarak bu isimlerle):

(Person)-[:DIRECTOR]->(Film) — yönetmen
(Person)-[:ACTOR]->(Film) — oyuncu (character property olabilir)
(Person)-[:DIRECTOR_OF_PHOTOGRAPHY]->(Film) — görüntü yönetmeni
(Person)-[:ORIGINAL_MUSIC_COMPOSER]->(Film) — besteci
(Person)-[:EDITOR]->(Film) — kurgucu
(Person)-[:SOUND_DESIGNER]->(Film) — ses tasarımcısı
(Film)-[:HAS_GENRE]->(Genre) — tür
(Film)-[:PRODUCED_BY]->(Studio) — yapım şirketi
(Film)-[:FROM_COUNTRY]->(Country) — ülke

14 Seed Yönetmen: Andrei Tarkovsky, Stanley Kubrick, Ingmar Bergman, Woody Allen, Alfred Hitchcock, Federico Fellini, Akira Kurosawa, Jean Renoir, David Fincher, Quentin Tarantino, Paul Thomas Anderson, Nuri Bilge Ceylan, Zeki Demirkubuz, David Lynch