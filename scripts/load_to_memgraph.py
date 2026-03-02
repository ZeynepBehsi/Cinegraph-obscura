import json
import logging
from pathlib import Path

from neo4j import GraphDatabase

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"
URI = "bolt://localhost:7687"


def rel_type(raw: str) -> str:
    """'Director of Photography' → 'DIRECTOR_OF_PHOTOGRAPHY'"""
    return raw.strip().upper().replace(" ", "_").replace("-", "_")


def load_json(filename: str) -> list:
    path = DATA_DIR / filename
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def run(tx, query: str, **params):
    tx.run(query, **params)


def main():
    driver = GraphDatabase.driver(URI, auth=None)

    with driver.session() as session:
        # ── 1. DB temizle ─────────────────────────────────────────────────────
        log.info("DB temizleniyor...")
        session.run("MATCH (n) DETACH DELETE n")
        log.info("DB temizlendi.")

        # ── 2. Film node'ları ─────────────────────────────────────────────────
        films = load_json("films.json")
        log.info(f"{len(films)} film yükleniyor...")

        for film in films:
            session.execute_write(
                run,
                "CREATE (:Film {tmdb_id: $tmdb_id, title: $title, year: $year, runtime: $runtime})",
                tmdb_id=film["id"],
                title=film["title"],
                year=film.get("year"),
                runtime=film.get("runtime"),
            )

        log.info(f"{len(films)} Film node'u oluşturuldu.")

        # ── 3. Person node'ları ───────────────────────────────────────────────
        persons = load_json("persons.json")
        log.info(f"{len(persons)} kişi yükleniyor...")

        for person in persons:
            session.execute_write(
                run,
                "CREATE (:Person {tmdb_id: $tmdb_id, name: $name})",
                tmdb_id=person["id"],
                name=person["name"],
            )

        log.info(f"{len(persons)} Person node'u oluşturuldu.")

        # ── 4. Genre / Studio / Country node'ları ve film bağlantıları ────────
        log.info("Genre, Studio, Country node'ları oluşturuluyor...")

        for film in films:
            film_id = film["id"]

            for genre in film.get("genres", []):
                session.execute_write(
                    run,
                    """
                    MERGE (g:Genre {name: $name})
                    WITH g
                    MATCH (f:Film {tmdb_id: $film_id})
                    CREATE (f)-[:HAS_GENRE]->(g)
                    """,
                    name=genre,
                    film_id=film_id,
                )

            for studio in film.get("studios", []):
                session.execute_write(
                    run,
                    """
                    MERGE (s:Studio {name: $name})
                    WITH s
                    MATCH (f:Film {tmdb_id: $film_id})
                    CREATE (f)-[:PRODUCED_BY]->(s)
                    """,
                    name=studio,
                    film_id=film_id,
                )

            for country in film.get("countries", []):
                session.execute_write(
                    run,
                    """
                    MERGE (c:Country {name: $name})
                    WITH c
                    MATCH (f:Film {tmdb_id: $film_id})
                    CREATE (f)-[:FROM_COUNTRY]->(c)
                    """,
                    name=country,
                    film_id=film_id,
                )

        log.info("Genre / Studio / Country bağlantıları tamamlandı.")

        # ── 5. Person–Film ilişkileri ─────────────────────────────────────────
        relationships = load_json("relationships.json")
        log.info(f"{len(relationships)} ilişki yükleniyor...")

        skipped = 0
        for rel in relationships:
            rtype = rel_type(rel["relationship_type"])
            extras = rel.get("extras") or {}

            # Cypher'da dinamik relationship type için backtick ile yaz
            query = f"""
                MATCH (p:Person {{tmdb_id: $person_id}})
                MATCH (f:Film   {{tmdb_id: $film_id}})
                CREATE (p)-[:`{rtype}` $props]->(f)
            """
            try:
                session.execute_write(
                    run,
                    query,
                    person_id=rel["person_id"],
                    film_id=rel["film_id"],
                    props=extras,
                )
            except Exception as e:
                log.warning(f"İlişki atlandı ({rel}): {e}")
                skipped += 1

        log.info(f"{len(relationships) - skipped} ilişki oluşturuldu, {skipped} atlandı.")

        # ── 6. Özet sayım ─────────────────────────────────────────────────────
        node_count = session.run("MATCH (n) RETURN count(n) AS c").single()["c"]
        rel_count = session.run("MATCH ()-[r]->() RETURN count(r) AS c").single()["c"]

        log.info("─" * 50)
        log.info(f"Toplam node       : {node_count}")
        log.info(f"Toplam ilişki     : {rel_count}")
        log.info("─" * 50)

    driver.close()
    log.info("Bağlantı kapatıldı. Yükleme tamamlandı.")


if __name__ == "__main__":
    main()
