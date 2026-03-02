import logging

from neo4j import GraphDatabase

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

URI = "bolt://localhost:7687"

# ── Eklenecek dış Person'lar ───────────────────────────────────────────────────
NEW_EXTERNAL_PERSONS: list[dict] = [
    {"name": "Anton Chekhov", "role": "Writer"},
]

# ── Eklenecek INFLUENCED_BY ilişkileri ────────────────────────────────────────
# (etkileyen, etkilenen) → (etkilenen)-[:INFLUENCED_BY]->(etkileyen)
ADD_INFLUENCES: list[tuple[str, str]] = [
    ("Robert Bresson", "Nuri Bilge Ceylan"),
    ("Ingmar Bergman", "Nuri Bilge Ceylan"),
    ("Anton Chekhov",  "Nuri Bilge Ceylan"),
]

# ── Silinecek INFLUENCED_BY ilişkileri ────────────────────────────────────────
# (etkileyen, etkilenen) — yetersiz kanıt nedeniyle çıkarıldı
REMOVE_INFLUENCES: list[tuple[str, str]] = [
    ("Akira Kurosawa", "Federico Fellini"),  # Karşılıklı hayranlık var, etki belgelenmemiş
    ("Jean Renoir",    "Federico Fellini"),  # Spesifik kanıt bulunamadı
]


# ── Yardımcı ──────────────────────────────────────────────────────────────────

def run(tx, query: str, **params):
    tx.run(query, **params)


# ── Adımlar ───────────────────────────────────────────────────────────────────

def add_external_persons(session) -> None:
    """Yeni dış Person node'larını ekle (zaten varsa dokunma)."""
    log.info("Yeni dış Person node'ları ekleniyor...")

    for person in NEW_EXTERNAL_PERSONS:
        session.execute_write(
            run,
            "MERGE (:Person {name: $name})",
            name=person["name"],
        )
        log.info(f"  MERGE Person: {person['name']} ({person['role']})")

    log.info(f"{len(NEW_EXTERNAL_PERSONS)} dış Person işlendi.")


def add_influenced_by(session) -> None:
    """Yeni INFLUENCED_BY ilişkilerini ekle."""
    log.info("Yeni INFLUENCED_BY ilişkileri ekleniyor...")

    skipped = 0
    for influencer_name, influenced_name in ADD_INFLUENCES:
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
            log.info(f"  + ({influenced_name})-[:INFLUENCED_BY]->({influencer_name})")
        except Exception as e:
            log.warning(f"  Atlandı — ({influenced_name})->({influencer_name}): {e}")
            skipped += 1

    log.info(f"{len(ADD_INFLUENCES) - skipped} ilişki eklendi, {skipped} atlandı.")


def remove_influenced_by(session) -> None:
    """Kanıtsız INFLUENCED_BY ilişkilerini sil."""
    log.info("Geçersiz INFLUENCED_BY ilişkileri siliniyor...")

    removed = 0
    for influencer_name, influenced_name in REMOVE_INFLUENCES:
        result = session.run(
            """
            MATCH (influenced:Person {name: $influenced})
                  -[r:INFLUENCED_BY]->
                  (influencer:Person {name: $influencer})
            DELETE r
            RETURN count(r) AS deleted
            """,
            influencer=influencer_name,
            influenced=influenced_name,
        )
        # Memgraph'ta DELETE sonrası count döner
        record = result.single()
        n = record["deleted"] if record else 0
        removed += n
        log.info(f"  - ({influenced_name})-[:INFLUENCED_BY]->({influencer_name}): {n} ilişki silindi")

    log.info(f"Toplam {removed} INFLUENCED_BY ilişkisi silindi.")


def verify(session) -> None:
    """Güncel durum doğrulama sorguları. (Memgraph: aggregation WITH'te olmalı)"""
    log.info("─" * 55)
    log.info("Doğrulama sorguları çalışıyor...")

    influenced_by_count = session.run(
        "MATCH ()-[r:INFLUENCED_BY]->() WITH count(r) AS c RETURN c"
    ).single()["c"]

    part_of_movement_count = session.run(
        "MATCH ()-[r:PART_OF_MOVEMENT]->() WITH count(r) AS c RETURN c"
    ).single()["c"]

    movement_count = session.run(
        "MATCH (m:Movement) WITH count(m) AS c RETURN c"
    ).single()["c"]

    person_count = session.run(
        "MATCH (p:Person) WITH count(p) AS c RETURN c"
    ).single()["c"]

    log.info("─" * 55)
    log.info(f"Toplam Person node sayısı           : {person_count}")
    log.info(f"Toplam Movement node sayısı         : {movement_count}")
    log.info(f"Toplam INFLUENCED_BY ilişki sayısı  : {influenced_by_count}")
    log.info(f"Toplam PART_OF_MOVEMENT ilişki sayısı: {part_of_movement_count}")
    log.info("─" * 55)


# ── Ana akış ──────────────────────────────────────────────────────────────────

def main():
    driver = GraphDatabase.driver(URI, auth=None)

    with driver.session() as session:
        add_external_persons(session)
        add_influenced_by(session)
        remove_influenced_by(session)
        verify(session)

    driver.close()
    log.info("Bağlantı kapatıldı. Güncelleme tamamlandı.")


if __name__ == "__main__":
    main()
