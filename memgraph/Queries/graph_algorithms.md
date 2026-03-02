# Graph Algoritmaları — Cinema Graph

Memgraph MAGE kütüphanesi üzerinden çalıştırılan temel graph algoritmalarının sorguları,
yorumlama rehberi ve sinema graph'ına özgü beklentiler.

**Ön koşul:** Memgraph `localhost:3000` adresinde çalışıyor olmalı.
**Arayüz:** Cypher Editor → `http://localhost:3000`

---

## 1. PageRank — "En Merkezi" İsimler

### Teori

PageRank, bir düğümün önemini kendisine gelen bağlantıların **kalitesine** göre ölçer.
Google'ın web sayfalarını sıralamasında kullandığı algoritmanın graph versiyonudur.

- Çok sayıda önemli düğümden bağlantı alan düğüm yüksek rank alır
- Sinema graph'ında: pek çok film ve yönetmenle ilişkili oyuncular öne çıkar
- Film node'ları da rank alır; pek çok ünlü kişiyle bağlantılı filmler yükselir

### Sorgu

```cypher
CALL pagerank.get()
YIELD node, rank
WITH node, rank
WHERE rank > 0.001
RETURN node.name AS name, labels(node) AS type, rank
ORDER BY rank DESC
LIMIT 30;
```

### Beklenen Sonuç Yorumu

| Sıra | Beklenen İsim / Node | Sebep |
|------|----------------------|-------|
| 1–3 | Popüler oyuncular | Birden fazla ünlü yönetmenin filminde oynadılar |
| 4–10 | Seed yönetmenler | 14 yönetmenin hepsi birbiriyle INFLUENCED_BY ile bağlı |
| Üst sıra | Kubrick, Bergman, Hitchcock | En fazla etkilendikleri yönetmenler |

**Dikkat edilecek nokta:** PageRank tüm ilişki tiplerini (ACTOR, DIRECTOR, INFLUENCED_BY, PART_OF_MOVEMENT) birlikte değerlendirir. Dolayısıyla çok filmde oynayan oyuncular yönetmenleri geçebilir.

### Sadece Kişileri Filtrele

```cypher
CALL pagerank.get()
YIELD node, rank
WITH node, rank
WHERE rank > 0.001 AND "Person" IN labels(node)
RETURN node.name AS name, rank
ORDER BY rank DESC
LIMIT 20;
```

### Sadece Filmleri Filtrele

```cypher
CALL pagerank.get()
YIELD node, rank
WITH node, rank
WHERE rank > 0.001 AND "Film" IN labels(node)
RETURN node.title AS title, node.year AS year, rank
ORDER BY rank DESC
LIMIT 20;
```

---

## 2. Betweenness Centrality — "Köprü" Kişiler

### Teori

Betweenness Centrality, graph'taki tüm çiftler arasındaki **en kısa yolların kaç tanesinin**
bir düğümden geçtiğini ölçer.

- Yüksek skor → o düğüm kaldırılırsa graph parçalanır
- Sinema graph'ında: farklı yönetmenlerin filmlerinde oynamış oyuncular köprü görevi görür
- `FALSE, FALSE` parametreleri: yönsüz (`undirected`) + normalize edilmemiş (`unnormalized`)

### Sorgu

```cypher
CALL betweenness_centrality.get(FALSE, FALSE)
YIELD node, betweenness_centrality
WITH node, betweenness_centrality AS bc
WHERE bc > 0
RETURN node.name AS name, labels(node) AS type, bc
ORDER BY bc DESC
LIMIT 30;
```

### Parametre Seçenekleri

| Parametre | Değer | Açıklama |
|-----------|-------|----------|
| 1. arg (directed) | `FALSE` | Yönsüz — ilişki yönünü yok say |
| 1. arg (directed) | `TRUE` | Yönlü — ACTOR → Film gibi yönü dikkate al |
| 2. arg (normalize) | `FALSE` | Ham sayı — graph büyüklüğüne göre ölçeklenmez |
| 2. arg (normalize) | `TRUE` | 0–1 arası normalize edilmiş değer |

### Beklenen Sonuç Yorumu

**Köprü kişi profili:** Farklı "dünyaları" birbirine bağlayan isimler.

Örnek beklentiler:

- **Kubrick & Fincher filmlerinde oynayan oyuncular** — Post-Classical Hollywood köprüsü
- **Tarkovsky & Bergman'ın ortak bağlantıları** — INFLUENCED_BY zinciri üzerinden
- **Çok tür filmlerde oynayan oyuncular** — Genre-crossing aktörler

### Sadece Oyuncuları Filtrele

```cypher
CALL betweenness_centrality.get(FALSE, FALSE)
YIELD node, betweenness_centrality
WITH node, betweenness_centrality AS bc
WHERE bc > 0 AND "Person" IN labels(node)
RETURN node.name AS name, bc
ORDER BY bc DESC
LIMIT 20;
```

### Köprü Oyuncunun Filmlerini Gör

En yüksek bc skorlu oyuncuyu bulduktan sonra (`$actor_name` yerine gerçek ismi yaz):

```cypher
MATCH p=(actor:Person {name: $actor_name})-[:ACTOR]->(f:Film)<-[:DIRECTOR]-(d:Person)
RETURN p;
```

---

## 3. Community Detection — Doğal Kümeler

### Teori

Community Detection (Louvain yöntemi), graph'taki **doğal toplulukları** otomatik keşfeder.
Birbirleriyle yoğun bağlantılı düğümler aynı `community_id`'yi alır.

Sinema graph'ında olası kümeler:

| Küme tipi | Açıklama |
|-----------|----------|
| Yönetmen bazlı | Kubrick'in sabit ekibi, Fellini'nin İtalyan kadrosu |
| Genre bazlı | Drama + Arthouse bir küme, Thriller başka bir küme |
| Ülke bazlı | Sovyet sineması, İsveç sineması, Japon sineması |
| Hareket bazlı | New Hollywood, Italian Neorealism |

### Sorgu

```cypher
CALL community_detection.get()
YIELD node, community_id
WITH community_id, collect(node.name) AS members, count(node) AS size
RETURN community_id, size, members[0..10] AS sample_members
ORDER BY size DESC
LIMIT 15;
```

### Küme İçeriğini Derinlemesiyle İncele

Büyük kümelerden birini (`$cid` yerine gerçek community_id yaz) detaylı gör:

```cypher
CALL community_detection.get()
YIELD node, community_id
WITH node, community_id
WHERE community_id = $cid
RETURN labels(node) AS type, node.name AS name
ORDER BY type, name;
```

### Küme Kompozisyonunu Analiz Et (label dağılımı)

```cypher
CALL community_detection.get()
YIELD node, community_id
WITH community_id, labels(node)[0] AS label, count(node) AS cnt
RETURN community_id, label, cnt
ORDER BY community_id, cnt DESC;
```

### Kümeleri Görselleştir

Belirli bir kümenin tüm bağlantılarını graph olarak çek:

```cypher
CALL community_detection.get()
YIELD node, community_id
WITH node, community_id
WHERE community_id = $cid
WITH collect(node) AS cluster_nodes
UNWIND cluster_nodes AS n
MATCH p=(n)-[r]-(m)
WHERE m IN cluster_nodes
RETURN p;
```

---

## 4. Algoritmaları Birleştir — Ranking Karşılaştırması

PageRank ve Betweenness sonuçlarını yan yana görmek için ayrı ayrı çalıştır,
ardından sonuçları karşılaştır. (Memgraph'ta iki ayrı CALL aynı sorguda birleştirilemez.)

### PageRank — Kişi filtreli

```cypher
CALL pagerank.get()
YIELD node, rank
WITH node, rank
WHERE "Person" IN labels(node) AND rank > 0.001
RETURN node.name AS name, rank AS pagerank
ORDER BY pagerank DESC
LIMIT 15;
```

### Betweenness — Kişi filtreli

```cypher
CALL betweenness_centrality.get(FALSE, FALSE)
YIELD node, betweenness_centrality
WITH node, betweenness_centrality AS bc
WHERE "Person" IN labels(node) AND bc > 0
RETURN node.name AS name, bc AS betweenness
ORDER BY betweenness DESC
LIMIT 15;
```

**Yorumlama:** PageRank'te üst sırada ama Betweenness'te alt sıradaysa → o kişi önemli
ama köprü değil, tek bir kümenin içinde yoğun bağlantılı. İkisinde de üst sıradaysa →
gerçek anlamda merkezi ve köprü bir düğüm.

---

## 5. Beklenen Bulgular — Sorular & Hipotezler

### PageRank birincisi kim?

**Hipotez:** Birden fazla seed yönetmenin filminde oynayan ve INFLUENCED_BY zincirinin
ortasında olan bir oyuncu ya da **Ingmar Bergman** (hem Tarkovsky'yi hem Allen'ı etkileyen,
Scandinavian Art Cinema hareketi lideri).

Doğrulamak için:

```cypher
MATCH (p:Person {name: "Ingmar Bergman"})
MATCH (other:Person)-[:INFLUENCED_BY]->(p)
WITH p, collect(other.name) AS influenced_list
RETURN p.name, influenced_list;
```

### Betweenness'te "köprü" oyuncular kimler?

**Hipotez:** Hem Kubrick hem Hitchcock filmlerinde oynayan oyuncular öne çıkacak.
Ayrıca Tarkovsky & Bergman'ı INFLUENCED_BY üzerinden bağlayan düğümler.

Doğrulamak için (köprü oyuncuyu bulduktan sonra):

```cypher
MATCH (actor:Person {name: $bridge_actor})
MATCH (actor)-[:ACTOR]->(f:Film)<-[:DIRECTOR]-(d:Person)
WITH actor, collect(DISTINCT d.name) AS directors_worked_with
RETURN actor.name, directors_worked_with;
```

### Community Detection hangi kümeleri buldu?

**Hipotez:** Graph hem film-odaklı hem kişi-odaklı bağlantılar içerdiğinden kümeler karışık çıkabilir.

Olası kümeler:
- **Küme A:** Sovyet/Avrupa sinema dünyası — Tarkovsky, Bergman, Bresson, Chekhov, Ceylan
- **Küme B:** Amerikan sinema — Kubrick, Fincher, PTA, Hitchcock, Lynch, Tarantino
- **Küme C:** İtalyan sinema — Fellini, İtalyan Neorealism filmleri
- **Küme D:** Türk sinema — Ceylan, Demirkubuz, New Turkish Cinema hareketi
- **Büyük kümeler:** Genre ve Studio node'ları kendi alt kümelerini oluşturabilir

---

## 6. Hızlı Referans

| Algoritma | MAGE Prosedürü | Amaç |
|-----------|---------------|-------|
| PageRank | `pagerank.get()` | Düğüm önemi (bağlantı kalitesi) |
| Betweenness Centrality | `betweenness_centrality.get(directed, normalize)` | Köprü düğümler |
| Community Detection | `community_detection.get()` | Doğal kümeler (Louvain) |

**MAGE dokümantasyon:** `https://memgraph.com/docs/mage`

---

## 7. Skorlar Nasıl Yorumlanır

### PageRank

Google'ın web sayfalarını sıralamak için icat ettiği algoritmanın aynısı. Mantığı şu:
**"Sana çok bağlantı gelen ve sana bağlantı verenler de önemli kişilerse, sen önemlisin."**

- Skor **0 ile 1 arasında**, tüm düğümlerin toplamı 1 eder.
- Drama'nın `0.038` skoru → graph'taki tüm "önem"in **%3.8'i** Drama düğümünde toplanmış demektir.
- Bir kişi için yüksek PageRank: o kişinin birçok önemli filmde yer aldığını ve o filmlerin de
  önemli kişilerle dolu olduğunu gösterir.

| Skor aralığı | Yorum |
|--------------|-------|
| `> 0.01` | Çok merkezi — graph'ın omurgasında |
| `0.001 – 0.01` | Orta düzey bağlantılı |
| `< 0.001` | Çevre düğüm — az bağlantı veya izole |

### Betweenness Centrality

PageRank'ten farklı bir şeyi ölçer:
**"Graph'taki herhangi iki düğüm arasındaki en kısa yolların kaçı senin üzerinden geçiyor?"**

- Yüksek skor → o düğüm kaldırılırsa graph parçalanır.
- Farklı kümeleri birbirine bağlayan **köprü rolündeki** düğümleri tespit eder.
- Örnek: Alfred Hitchcock'un `261.000` skoru → hem İngiliz sinemasını hem Hollywood'u
  kapsayan 54 filmlik kariyeriyle graph'ta farklı toplulukları birbirine bağlayan kritik bir düğümdür.
  Onu çıkarırsan en çok yol kopar.

| Skor | Yorum |
|------|-------|
| `> 100.000` | Kritik köprü — graph'ın bağlantı omurgası |
| `10.000 – 100.000` | Önemli köprü — birden fazla topluluğu bağlıyor |
| `1.000 – 10.000` | Yerel köprü — kendi alt kümesinde bağlayıcı |
| `< 1.000` | Köprü değil — tek bir topluluk içinde |

---

## 8. Komutlar ve Yorumları

### Komut 1 — Betweenness: Sadece Kişiler

```cypher
CALL betweenness_centrality.get(FALSE, FALSE)
YIELD node, betweenness_centrality
WITH node, betweenness_centrality AS bc
WHERE "Person" IN labels(node) AND bc > 0
RETURN node.name AS name, bc
ORDER BY bc DESC
LIMIT 20;
```

**Çıktı Yorumu — Betweenness Centrality Sıralaması**

Bu liste "farklı sinema dünyalarını birbirine bağlayan köprü kişiler" anlamına geliyor:

| Sıra | İsim | Skor | Yorum |
|------|------|------|-------|
| 1 | Alfred Hitchcock | 261K | Açık ara birinci. 54 filmle hem British Cinema hem Classical Hollywood'u kapsıyor. Uzun kariyeri boyunca çok farklı dönemlerden oyuncu ve ekip üyesiyle çalışmış. Graph'ta onu çıkarırsan en çok yol kopar. |
| 2 | David Lynch | 174K | Sürrealist sineması farklı dünyaları birbirine bağlıyor. Hem Hollywood hem Avrupa sanat sineması arasında köprü. |
| 3 | Woody Allen | 156K | 52 filmle devasa bir ağ. Amerikan komedisinden Avrupa sanat sinemasına köprü. |
| 4 | Ingmar Bergman | 79K | İskandinav sinemasını dünyaya bağlayan isim. INFLUENCED_BY ilişkileriyle birçok yönetmene bağlı. |
| 9 | Sven Nykvist | 23K | **İlginç!** Nykvist bir görüntü yönetmeni — hem Bergman hem Tarkovsky hem Woody Allen ile çalışmış. Farklı yönetmenlerin dünyalarını fiziksel olarak birbirine bağlayan nadir bir isim. Betweenness centrality'nin yakalamak istediği tam da bu. |
| 11 | Nuri Bilge Ceylan | 18K | Türk sineması ile dünya sanat sineması arasında köprü. INFLUENCED_BY ilişkileriyle Tarkovsky, Bergman, Bresson, Chekhov'a bağlı olması skoru yükseltmiş. |

---

### Komut 2 — En Çok Bağlantıya Sahip Kişiler

```cypher
MATCH (p:Person)-[r]-()
WITH p.name AS name, count(r) AS connections
RETURN name, connections
ORDER BY connections DESC
LIMIT 20;
```

**Çıktı Yorumu**

Bu sorgu "en çok bağlantıya sahip kişiler" listesini verir — ham bağlantı sayısı.
PageRank veya Betweenness'ten farklı olarak bağlantıların kalitesini ölçmez,
sadece **kaç ilişkisi olduğunu** sayar. Uzun kariyerli yönetmen ve oyuncular öne çıkar.

---

### Komut 3 — Community Detection: Doğal Kümeler

```cypher
CALL community_detection.get()
YIELD node, community_id
WITH community_id, collect(node.name) AS members, count(node) AS size
RETURN community_id, size, members[0..10] AS sample_members
ORDER BY size DESC
LIMIT 15;
```

**Çıktı Yorumu**

> YORUM EKLENECEK

---

## 9. Önemli Bulgular

| Algoritma | Bulgu |
|-----------|-------|
| **Betweenness Centrality** | Hitchcock en merkezi köprü isim. Sven Nykvist "gizli bağlayıcı" olarak ortaya çıktı — bir görüntü yönetmeninin bu kadar yüksek köprü skoru alması dikkat çekici. |
| **Degree Centrality** | Woody Allen en bağlantılı kişi (83 bağlantı). Allen'ın kurgucuları Sandy Morse ve Alisa Lepselter "gizli kahramanlar" olarak listeye girdi — onlarca Allen filminde imzaları var. |
| **Community Detection** | Tarkovsky–Fellini aynı kümeye düştü (İtalya bağlantısı: Nostalgia Roma'da çekildi). Bergman–Ceylan aynı kümeye düştü (INFLUENCED_BY ilişkisi graph'ta bu yakınlığı doğal olarak yansıttı). |
