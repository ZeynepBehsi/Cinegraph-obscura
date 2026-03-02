"""
Graph şeması ve örnek sorgular — Gemini system prompt'u için bağlam kaynağı.
"""

GRAPH_SCHEMA: dict = {
    "node_labels": {
        "Person": {
            "description": (
                "Yönetmenler, oyuncular, görüntü yönetmenleri (DP), besteciler, "
                "kurgucular, ses tasarımcıları ve edebi/sanatsal etkiler (Dostoevsky, Chekhov vb.)"
            ),
            "properties": {
                "name": "string — kişinin tam adı",
                "tmdb_id": "int — TMDB kimlik numarası (dış Person'larda olmayabilir)",
            },
        },
        "Film": {
            "description": "Seed yönetmenlerin filmleri ve filmografik eser kayıtları.",
            "properties": {
                "title": "string — filmin orijinal adı",
                "tmdb_id": "int — TMDB kimlik numarası",
                "year": "int — yapım yılı",
                "runtime": "int — dakika cinsinden süre",
            },
        },
        "Genre": {
            "description": "Film türleri. Örnek: Drama, Thriller, Comedy, Science Fiction.",
            "properties": {
                "name": "string",
            },
        },
        "Studio": {
            "description": "Yapım şirketleri. Örnek: Warner Bros., Mosfilm, Janus Films.",
            "properties": {
                "name": "string",
            },
        },
        "Country": {
            "description": "Yapım ülkeleri. Örnek: France, United States, Soviet Union.",
            "properties": {
                "name": "string",
            },
        },
        "Movement": {
            "description": (
                "Sinema akımları ve dönemleri. "
                "Örnek: French New Wave, Soviet Poetic Cinema, New Hollywood, "
                "Italian Neorealism, Scandinavian Art Cinema, New Turkish Cinema."
            ),
            "properties": {
                "name": "string",
            },
        },
    },

    "relationship_types": {
        "DIRECTOR":                  "(Person)-[:DIRECTOR]->(Film)",
        "ACTOR":                     "(Person)-[:ACTOR]->(Film)",
        "DIRECTOR_OF_PHOTOGRAPHY":   "(Person)-[:DIRECTOR_OF_PHOTOGRAPHY]->(Film)",
        "ORIGINAL_MUSIC_COMPOSER":   "(Person)-[:ORIGINAL_MUSIC_COMPOSER]->(Film)",
        "EDITOR":                    "(Person)-[:EDITOR]->(Film)",
        "SOUND_DESIGNER":            "(Person)-[:SOUND_DESIGNER]->(Film)",
        "HAS_GENRE":                 "(Film)-[:HAS_GENRE]->(Genre)",
        "PRODUCED_BY":               "(Film)-[:PRODUCED_BY]->(Studio)",
        "FROM_COUNTRY":              "(Film)-[:FROM_COUNTRY]->(Country)",
        "PART_OF_MOVEMENT":          "(Person)-[:PART_OF_MOVEMENT]->(Movement)",
        "INFLUENCED_BY": (
            "(Person)-[:INFLUENCED_BY]->(Person) — "
            "A kişisi B kişisinden etkilenmiş; yön: (etkilenen)-[:INFLUENCED_BY]->(etkileyen)"
        ),
    },

    "seed_directors": [
        "Andrei Tarkovsky", "Stanley Kubrick", "Ingmar Bergman", "Woody Allen",
        "Alfred Hitchcock", "Federico Fellini", "Akira Kurosawa", "Jean Renoir",
        "David Fincher", "Quentin Tarantino", "Paul Thomas Anderson",
        "Nuri Bilge Ceylan", "Zeki Demirkubuz", "David Lynch",
    ],

    "memgraph_rules": [
        "Aggregation fonksiyonları (count, sum, collect, avg vb.) doğrudan RETURN'de kullanılamaz. "
        "Önce WITH clause'da aggregate et, sonra RETURN et. "
        "Doğru: MATCH (n) WITH count(n) AS c RETURN c  "
        "Yanlış: MATCH (n) RETURN count(n)",

        "MAGE algoritmaları CALL ile çağrılır: "
        "pagerank.get(), "
        "betweenness_centrality.get(FALSE, FALSE), "
        "community_detection.get()",

        "String karşılaştırma operatörleri: CONTAINS, STARTS WITH, ENDS WITH — büyük/küçük harf duyarlıdır.",

        "Path görselleştirmesi için: MATCH p=(...)-[...]-(...) RETURN p",

        "Dinamik ilişki tipi adları (boşluk içeriyorsa) backtick ile yazılır: -[:`DIRECTOR OF PHOTOGRAPHY`]->",
    ],

    "example_queries": [
        {
            "question": "Tarkovsky'nin filmlerini listele",
            "cypher": (
                "MATCH (d:Person {name: 'Andrei Tarkovsky'})-[:DIRECTOR]->(f:Film) "
                "RETURN f.title AS title, f.year AS year "
                "ORDER BY f.year;"
            ),
        },
        {
            "question": "Hitchcock ve Kubrick'in ortak oyuncuları",
            "cypher": (
                "MATCH (hitchcock:Person {name: 'Alfred Hitchcock'})-[:DIRECTOR]->(f1:Film)"
                "<-[:ACTOR]-(actor:Person)-[:ACTOR]->(f2:Film)"
                "<-[:DIRECTOR]-(kubrick:Person {name: 'Stanley Kubrick'}) "
                "WITH actor, collect(DISTINCT f1.title) AS hitchcock_films, "
                "collect(DISTINCT f2.title) AS kubrick_films "
                "RETURN actor.name AS actor, hitchcock_films, kubrick_films;"
            ),
        },
        {
            "question": "En çok film çeken 10 yönetmen",
            "cypher": (
                "MATCH (d:Person)-[:DIRECTOR]->(f:Film) "
                "WITH d.name AS director, count(f) AS film_count "
                "RETURN director, film_count "
                "ORDER BY film_count DESC "
                "LIMIT 10;"
            ),
        },
        {
            "question": "Nuri Bilge Ceylan kimlerden etkilenmiş",
            "cypher": (
                "MATCH (ceylan:Person {name: 'Nuri Bilge Ceylan'})"
                "-[:INFLUENCED_BY]->(influence:Person) "
                "RETURN influence.name AS influenced_by;"
            ),
        },
        {
            "question": "Sven Nykvist hangi yönetmenlerle çalışmış",
            "cypher": (
                "MATCH (nykvist:Person {name: 'Sven Nykvist'})"
                "-[:DIRECTOR_OF_PHOTOGRAPHY]->(f:Film)"
                "<-[:DIRECTOR]-(d:Person) "
                "WITH d.name AS director, collect(f.title) AS films "
                "RETURN director, films "
                "ORDER BY size(films) DESC;"
            ),
        },
        {
            "question": "Betweenness centrality en yüksek 10 kişi",
            "cypher": (
                "CALL betweenness_centrality.get(FALSE, FALSE) "
                "YIELD node, betweenness_centrality "
                "WITH node, betweenness_centrality AS bc "
                "WHERE 'Person' IN labels(node) AND bc > 0 "
                "RETURN node.name AS name, bc "
                "ORDER BY bc DESC "
                "LIMIT 10;"
            ),
        },
        {
            "question": "Community detection sonuçları — en büyük 10 küme",
            "cypher": (
                "CALL community_detection.get() "
                "YIELD node, community_id "
                "WITH community_id, collect(node.name) AS members, count(node) AS size "
                "RETURN community_id, size, members[0..8] AS sample_members "
                "ORDER BY size DESC "
                "LIMIT 10;"
            ),
        },
        {
            "question": "Drama ve Thriller türünde filmler",
            "cypher": (
                "MATCH (f:Film)-[:HAS_GENRE]->(g:Genre) "
                "WHERE g.name IN ['Drama', 'Thriller'] "
                "WITH f, collect(g.name) AS genres "
                "WHERE size(genres) = 2 "
                "RETURN f.title AS title, f.year AS year, genres "
                "ORDER BY f.year;"
            ),
        },
    ],
}


def get_schema_prompt() -> str:
    """
    GRAPH_SCHEMA dict'ini Gemini'ye gönderilecek düz metin system prompt'una çevirir.
    """
    s = GRAPH_SCHEMA

    # ── Node Labels ──────────────────────────────────────────────────────────
    nodes_text = "NODE LABELS VE PROPERTY'LER:\n"
    for label, info in s["node_labels"].items():
        nodes_text += f"\n  {label}: {info['description']}\n"
        for prop, desc in info["properties"].items():
            nodes_text += f"    - {prop}: {desc}\n"

    # ── Relationship Types ───────────────────────────────────────────────────
    rels_text = "\nİLİŞKİ TİPLERİ (tam olarak bu isimlerle kullan):\n"
    for rel_type, pattern in s["relationship_types"].items():
        rels_text += f"  {rel_type}: {pattern}\n"

    # ── Seed Directors ───────────────────────────────────────────────────────
    directors_text = (
        "\nSEED YÖNETMENLER (14 kişi — hepsi Person node'u olarak graph'ta mevcut):\n"
        "  " + ", ".join(s["seed_directors"]) + "\n"
    )

    # ── Memgraph Rules ───────────────────────────────────────────────────────
    rules_text = "\nMEMGRAPH CYPHER KURALLARI (kesinlikle uy):\n"
    for i, rule in enumerate(s["memgraph_rules"], 1):
        rules_text += f"  {i}. {rule}\n"

    # ── Example Queries ──────────────────────────────────────────────────────
    examples_text = "\nÖRNEK SORGULAR:\n"
    for ex in s["example_queries"]:
        examples_text += f"\n  Soru : {ex['question']}\n"
        examples_text += f"  Cypher: {ex['cypher']}\n"

    return (
        "Sen bir Memgraph graph veritabanı uzmanısın. "
        "Kullanıcının doğal dil sorularını geçerli Memgraph Cypher sorgularına çeviriyorsun.\n\n"
        + nodes_text
        + rels_text
        + directors_text
        + rules_text
        + examples_text
        + "\nYalnızca geçerli Cypher sorgusu üret. Açıklama veya markdown kod bloğu ekleme."
    )
