import logging

from neo4j import GraphDatabase

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

URI = "bolt://localhost:7687"

# ── Veri tanımları ─────────────────────────────────────────────────────────────

# (yönetmen adı, [hareket adları])
DIRECTOR_MOVEMENTS: list[tuple[str, list[str]]] = [
    ("Andrei Tarkovsky",      ["Soviet Poetic Cinema"]),
    ("Stanley Kubrick",       ["New Hollywood"]),
    ("Ingmar Bergman",        ["Scandinavian Art Cinema"]),
    ("Woody Allen",           ["New Hollywood"]),
    ("Alfred Hitchcock",      ["Classical Hollywood", "British Cinema"]),
    ("Federico Fellini",      ["Italian Neorealism", "Italian Art Cinema"]),
    ("Akira Kurosawa",        ["Japanese Golden Age Cinema"]),
    ("Jean Renoir",           ["French Poetic Realism"]),
    ("David Fincher",         ["Post-Classical Hollywood"]),
    ("Quentin Tarantino",     ["Post-Modern Cinema"]),
    ("Paul Thomas Anderson",  ["Post-Classical Hollywood"]),
    ("Nuri Bilge Ceylan",     ["New Turkish Cinema"]),
    ("Zeki Demirkubuz",       ["New Turkish Cinema"]),
    ("David Lynch",           ["Surrealist Cinema"]),
]

# DB'de olmayan dış kişiler
EXTERNAL_PERSONS: list[dict] = [
    {"name": "Robert Bresson",    "role": "Director"},
    {"name": "Fyodor Dostoevsky", "role": "Writer"},
]

# (etkileyen, etkilenen) → (etkilenen)-[:INFLUENCED_BY]->(etkileyen)
INFLUENCES: list[tuple[str, str]] = [
    ("Andrei Tarkovsky",  "Nuri Bilge Ceylan"),
    ("Ingmar Bergman",    "Andrei Tarkovsky"),
    ("Ingmar Bergman",    "Woody Allen"),
    ("Akira Kurosawa",    "Federico Fellini"),
    ("Jean Renoir",       "Federico Fellini"),
    ("Alfred Hitchcock",  "David Lynch"),
    ("Alfred Hitchcock",  "David Fincher"),
    ("Federico Fellini",  "David Lynch"),
    ("Stanley Kubrick",   "Paul Thomas Anderson"),
    ("Stanley Kubrick",   "David Fincher"),
    ("Robert Bresson",    "Andrei Tarkovsky"),
    ("Fyodor Dostoevsky", "Zeki Demirkubuz"),
]


# ── Yardımcı ──────────────────────────────────────────────────────────────────

def run(tx, query: str, **params):
    tx.run(query, **params)


# ── Adımlar ───────────────────────────────────────────────────────────────────

def load_movements(session) -> None:
    """Movement node'larını ve (Person)-[:PART_OF_MOVEMENT]->(Movement) ilişkilerini ekle."""
    log.info("Movement node'ları ve PART_OF_MOVEMENT ilişkileri ekleniyor...")

    total_rels = 0
    for director_name, movements in DIRECTOR_MOVEMENTS:
        for movement_name in movements:
            session.execute_write(
                run,
                """
                MERGE (m:Movement {name: $movement})
                WITH m
                MATCH (p:Person {name: $director})
                MERGE (p)-[:PART_OF_MOVEMENT]->(m)
                """,
                movement=movement_name,
                director=director_name,
            )
            total_rels += 1

    log.info(f"{total_rels} PART_OF_MOVEMENT ilişkisi işlendi.")


def load_external_persons(session) -> None:
    """DB'de bulunmayan dış Person node'larını ekle."""
    log.info("Dış Person node'ları ekleniyor...")

    for person in EXTERNAL_PERSONS:
        session.execute_write(
            run,
            "MERGE (:Person {name: $name})",
            name=person["name"],
        )
        log.info(f"  MERGE Person: {person['name']} ({person['role']})")

    log.info(f"{len(EXTERNAL_PERSONS)} dış Person işlendi.")


def load_influenced_by(session) -> None:
    """(etkilenen)-[:INFLUENCED_BY]->(etkileyen) ilişkilerini ekle."""
    log.info("INFLUENCED_BY ilişkileri ekleniyor...")

    skipped = 0
    for influencer_name, influenced_name in INFLUENCES:
        try:
            session.execute_write(
                run,
                """
                MATCH (influencer:Person {name: $influencer})
                MATCH (influenced:Person {name: $influenced})
                MERGE (influenced)-[:INFLUENCED_BY]->(influencer)
                """,
                influencer=influencer_name,
                influenced=influenced_name,
            )
        except Exception as e:
            log.warning(f"  Atlandı — {influenced_name} -[:INFLUENCED_BY]-> {influencer_name}: {e}")
            skipped += 1

    loaded = len(INFLUENCES) - skipped
    log.info(f"{loaded} INFLUENCED_BY ilişkisi oluşturuldu, {skipped} atlandı.")


def verify(session) -> None:
    """Doğrulama sorgularını çalıştır ve logla. (Memgraph: aggregation WITH'te olmalı)"""
    log.info("─" * 55)
    log.info("Doğrulama sorguları çalışıyor...")

    movement_count = session.run(
        "MATCH (m:Movement) WITH count(m) AS c RETURN c"
    ).single()["c"]

    influenced_by_count = session.run(
        "MATCH ()-[r:INFLUENCED_BY]->() WITH count(r) AS c RETURN c"
    ).single()["c"]

    part_of_movement_count = session.run(
        "MATCH ()-[r:PART_OF_MOVEMENT]->() WITH count(r) AS c RETURN c"
    ).single()["c"]

    log.info("─" * 55)
    log.info(f"Toplam Movement node sayısı      : {movement_count}")
    log.info(f"Toplam INFLUENCED_BY ilişki sayısı  : {influenced_by_count}")
    log.info(f"Toplam PART_OF_MOVEMENT ilişki sayısı: {part_of_movement_count}")
    log.info("─" * 55)


# ── Ana akış ──────────────────────────────────────────────────────────────────

def main():
    driver = GraphDatabase.driver(URI, auth=None)

    with driver.session() as session:
        load_external_persons(session)
        load_movements(session)
        load_influenced_by(session)
        verify(session)

    driver.close()
    log.info("Bağlantı kapatıldı. Zenginleştirme tamamlandı.")


if __name__ == "__main__":
    main()
