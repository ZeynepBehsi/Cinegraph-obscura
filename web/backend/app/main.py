import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

log = logging.getLogger(__name__)

from .agents.query_agent import CinemaQueryAgent
from .agents.schema_context import GRAPH_SCHEMA
from .db import MemgraphClient

# ── Singleton'lar ──────────────────────────────────────────────────────────────

db: MemgraphClient | None = None
agent: CinemaQueryAgent | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global db, agent
    db = MemgraphClient()
    agent = CinemaQueryAgent()
    yield
    db.close()


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(title="Cinema Graph API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic modeller ──────────────────────────────────────────────────────────

class QueryRequest(BaseModel):
    question: str
    conversation_id: str | None = None


class GraphData(BaseModel):
    nodes: list[dict]
    edges: list[dict]


class QueryResponse(BaseModel):
    question: str
    cypher_query: str
    raw_results: list[dict]
    interpretation: str
    graph_data: GraphData
    error: str | None = None


class CompareRequest(BaseModel):
    director1: str
    director2: str


class DirectorStats(BaseModel):
    film_count: int
    avg_runtime: float | None
    year_range: str | None
    avg_rating: float | None


class CompareResponse(BaseModel):
    director1_stats: DirectorStats
    director2_stats: DirectorStats
    shared_collaborators: list[dict]
    shared_genres: list[dict]
    shared_movements: list[str]
    influence_path: list[dict]
    interpretation: str
    graph_data: GraphData


# ── GET /debug/models ──────────────────────────────────────────────────────────

@app.get("/debug/models")
def debug_models():
    import os
    import google.generativeai as genai
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    available = [
        m.name
        for m in genai.list_models()
        if "generateContent" in m.supported_generation_methods
    ]
    return {"available_models": available, "count": len(available)}


# ── GET /health ────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    connected = db.ping()
    return {
        "status": "ok" if connected else "degraded",
        "memgraph": "connected" if connected else "unreachable",
    }


# ── GET /schema ────────────────────────────────────────────────────────────────

@app.get("/schema")
def schema():
    return GRAPH_SCHEMA


# ── GET /stats ─────────────────────────────────────────────────────────────────

@app.get("/stats")
def stats():
    node_rows = db.execute_query(
        "MATCH (n) WITH labels(n)[0] AS label, count(n) AS cnt "
        "RETURN label, cnt ORDER BY cnt DESC"
    )
    rel_rows = db.execute_query(
        "MATCH ()-[r]->() WITH type(r) AS rel_type, count(r) AS cnt "
        "RETURN rel_type, cnt ORDER BY cnt DESC"
    )
    total_nodes = sum(r["cnt"] for r in node_rows)
    total_rels = sum(r["cnt"] for r in rel_rows)

    return {
        "nodes": {"total": total_nodes, "by_label": node_rows},
        "relationships": {"total": total_rels, "by_type": rel_rows},
    }


# ── GET /directors ─────────────────────────────────────────────────────────────

@app.get("/directors")
def directors():
    rows = db.execute_query(
        "MATCH (d:Person)-[:DIRECTOR]->(f:Film) "
        "WITH d.name AS name, count(f) AS film_count "
        "WHERE film_count >= 5 "
        "RETURN name, film_count "
        "ORDER BY film_count DESC"
    )
    return {"directors": rows, "total": len(rows)}


# ── GET /director/{name} ───────────────────────────────────────────────────────

@app.get("/director/{name}")
def director_detail(name: str):
    films = db.execute_query(
        "MATCH (d:Person {name: $name})-[:DIRECTOR]->(f:Film) "
        "OPTIONAL MATCH (f)-[:HAS_GENRE]->(g:Genre) "
        "OPTIONAL MATCH (f)-[:FROM_COUNTRY]->(c:Country) "
        "WITH f, collect(DISTINCT g.name) AS genres, collect(DISTINCT c.name) AS countries "
        "RETURN f.title AS title, f.year AS year, f.runtime AS runtime, "
        "       f.rating AS rating, f.vote_count AS vote_count, genres, countries "
        "ORDER BY f.year",
        {"name": name},
    )
    if not films:
        raise HTTPException(status_code=404, detail=f"'{name}' bulunamadı.")

    influenced_by = db.execute_query(
        "MATCH (d:Person {name: $name})-[:INFLUENCED_BY]->(i:Person) "
        "RETURN i.name AS name",
        {"name": name},
    )
    movements = db.execute_query(
        "MATCH (d:Person {name: $name})-[:PART_OF_MOVEMENT]->(m:Movement) "
        "RETURN m.name AS movement",
        {"name": name},
    )

    return {
        "name": name,
        "film_count": len(films),
        "films": films,
        "influenced_by": [r["name"] for r in influenced_by],
        "movements": [r["movement"] for r in movements],
    }


# ── GET /explore/{node_name} ───────────────────────────────────────────────────

@app.get("/explore/{node_name}")
def explore(node_name: str, depth: int = 1):
    depth = max(1, min(depth, 2))  # 1 veya 2 ile sınırla

    rows = db.execute_query(
        "MATCH (n)-[r]-(m) "
        "WHERE n.name = $name OR n.title = $name "
        "WITH n, type(r) AS rel_type, m "
        "RETURN "
        "  coalesce(n.name, n.title) AS source, labels(n) AS source_type, "
        "  rel_type, "
        "  coalesce(m.name, m.title) AS target, labels(m) AS target_type "
        "LIMIT 100",
        {"name": node_name},
    )
    if not rows:
        raise HTTPException(status_code=404, detail=f"'{node_name}' bulunamadı.")

    return _build_graph_json(rows)


# ── POST /query ────────────────────────────────────────────────────────────────

@app.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest):
    # 1. Cypher üret
    cypher, gen_error = await agent.generate_cypher(req.question)
    if not cypher:
        log.warning("generate_cypher boş döndü — soru: %s | hata: %s", req.question, gen_error)
        return QueryResponse(
            question=req.question,
            cypher_query="",
            raw_results=[],
            interpretation="",
            graph_data=GraphData(nodes=[], edges=[]),
            error=gen_error or "Cypher sorgusu üretilemedi.",
        )

    # 2. Memgraph'ta çalıştır; hata olursa düzelt ve tekrar dene
    results: list[dict] = []
    error_msg: str | None = None
    try:
        results = db.execute_query(cypher)
    except Exception as exc:
        fixed = await agent.fix_cypher(cypher, str(exc))
        if fixed:
            try:
                cypher = fixed
                results = db.execute_query(cypher)
            except Exception as exc2:
                error_msg = str(exc2)
        else:
            error_msg = str(exc)

    # 3. Graph görselleştirme verisi
    graph_data = _extract_graph_data(results, cypher)

    # 4. Yorumla (hata olsa bile mevcut sonuçlarla dene)
    interpretation = ""
    if results:
        interpretation = await agent.interpret_results(req.question, cypher, results)

    return QueryResponse(
        question=req.question,
        cypher_query=cypher,
        raw_results=results[:100],
        interpretation=interpretation,
        graph_data=GraphData(**graph_data),
        error=error_msg,
    )


# ── POST /compare ──────────────────────────────────────────────────────────────

@app.post("/compare", response_model=CompareResponse)
async def compare(req: CompareRequest):
    d1, d2 = req.director1, req.director2

    # 1. Her iki yönetmenin istatistikleri
    def fetch_stats(name: str) -> DirectorStats:
        rows = db.execute_query(
            "MATCH (d:Person {name: $name})-[:DIRECTOR]->(f:Film) "
            "WITH count(f) AS film_count, avg(f.runtime) AS avg_runtime, "
            "     min(f.year) AS year_from, max(f.year) AS year_to, "
            "     avg(f.rating) AS avg_rating "
            "RETURN film_count, avg_runtime, year_from, year_to, avg_rating",
            {"name": name},
        )
        if not rows:
            return DirectorStats(film_count=0, avg_runtime=None, year_range=None, avg_rating=None)
        r = rows[0]
        year_from = r.get("year_from")
        year_to   = r.get("year_to")
        year_range = f"{year_from}–{year_to}" if year_from and year_to else None
        avg_rating = r.get("avg_rating")
        avg_rating = round(avg_rating, 2) if avg_rating is not None else None
        avg_runtime = r.get("avg_runtime")
        avg_runtime = round(avg_runtime, 1) if avg_runtime is not None else None
        return DirectorStats(
            film_count=r.get("film_count", 0),
            avg_runtime=avg_runtime,
            year_range=year_range,
            avg_rating=avg_rating,
        )

    stats1 = fetch_stats(d1)
    stats2 = fetch_stats(d2)

    if stats1.film_count == 0:
        raise HTTPException(status_code=404, detail=f"'{d1}' bulunamadı veya filmi yok.")
    if stats2.film_count == 0:
        raise HTTPException(status_code=404, detail=f"'{d2}' bulunamadı veya filmi yok.")

    # 2. Ortak çalışanlar (oyuncu, DP, besteci, kurgu)
    shared_collaborators = db.execute_query(
        "MATCH (d1:Person {name: $name1})-[:DIRECTOR]->(f1:Film)"
        "<-[:ACTOR|DIRECTOR_OF_PHOTOGRAPHY|ORIGINAL_MUSIC_COMPOSER|EDITOR]-(p:Person) "
        "MATCH (d2:Person {name: $name2})-[:DIRECTOR]->(f2:Film)"
        "<-[:ACTOR|DIRECTOR_OF_PHOTOGRAPHY|ORIGINAL_MUSIC_COMPOSER|EDITOR]-(p) "
        "WHERE p.name <> $name1 AND p.name <> $name2 "
        "WITH p.name AS name, count(DISTINCT f1) AS films_with_d1, count(DISTINCT f2) AS films_with_d2 "
        "RETURN name, films_with_d1, films_with_d2 "
        "ORDER BY films_with_d1 + films_with_d2 DESC "
        "LIMIT 20",
        {"name1": d1, "name2": d2},
    )

    # 3. Ortak türler
    shared_genres = db.execute_query(
        "MATCH (d1:Person {name: $name1})-[:DIRECTOR]->(f1:Film)-[:HAS_GENRE]->(g:Genre) "
        "MATCH (d2:Person {name: $name2})-[:DIRECTOR]->(f2:Film)-[:HAS_GENRE]->(g) "
        "WITH g.name AS genre, count(DISTINCT f1) AS films_d1, count(DISTINCT f2) AS films_d2 "
        "RETURN genre, films_d1, films_d2 "
        "ORDER BY films_d1 + films_d2 DESC",
        {"name1": d1, "name2": d2},
    )

    # 4. Ortak akımlar
    movement_rows = db.execute_query(
        "MATCH (d1:Person {name: $name1})-[:PART_OF_MOVEMENT]->(m:Movement)"
        "<-[:PART_OF_MOVEMENT]-(d2:Person {name: $name2}) "
        "RETURN m.name AS movement",
        {"name1": d1, "name2": d2},
    )
    shared_movements = [r["movement"] for r in movement_rows]

    # 5. INFLUENCED_BY bağlantıları
    influence_paths: list[dict] = []

    direct_d1_to_d2 = db.execute_query(
        "MATCH (d1:Person {name: $name1})-[:INFLUENCED_BY]->(d2:Person {name: $name2}) "
        "RETURN $name1 AS source, $name2 AS target",
        {"name1": d1, "name2": d2},
    )
    for r in direct_d1_to_d2:
        influence_paths.append({"type": "direct", "source": r["source"], "target": r["target"]})

    direct_d2_to_d1 = db.execute_query(
        "MATCH (d2:Person {name: $name2})-[:INFLUENCED_BY]->(d1:Person {name: $name1}) "
        "RETURN $name2 AS source, $name1 AS target",
        {"name1": d1, "name2": d2},
    )
    for r in direct_d2_to_d1:
        influence_paths.append({"type": "direct", "source": r["source"], "target": r["target"]})

    common_influencers = db.execute_query(
        "MATCH (d1:Person {name: $name1})-[:INFLUENCED_BY]->(m:Person)"
        "<-[:INFLUENCED_BY]-(d2:Person {name: $name2}) "
        "WITH m.name AS common_influence "
        "RETURN common_influence",
        {"name1": d1, "name2": d2},
    )
    for r in common_influencers:
        influence_paths.append({"type": "common_influence", "common_influence": r["common_influence"]})

    # 6. Graph verisi
    graph_data = _build_compare_graph(d1, d2, shared_collaborators, shared_genres, shared_movements, influence_paths)

    # 7. Gemini yorumu
    interpretation = await agent.interpret_comparison(
        director1=d1,
        director2=d2,
        stats1=stats1.model_dump(),
        stats2=stats2.model_dump(),
        shared_collaborators=shared_collaborators,
        shared_genres=shared_genres,
        shared_movements=shared_movements,
        influence_paths=influence_paths,
    )

    return CompareResponse(
        director1_stats=stats1,
        director2_stats=stats2,
        shared_collaborators=shared_collaborators,
        shared_genres=shared_genres,
        shared_movements=shared_movements,
        influence_path=influence_paths,
        interpretation=interpretation,
        graph_data=GraphData(**graph_data),
    )


# ── Helpers ────────────────────────────────────────────────────────────────────

# Hangi field adları entity içerir
_ENTITY_FIELDS = {
    "name", "title", "actor", "director", "person", "film",
    "genre", "country", "studio", "movement",
    "influenced_by", "influencer", "influenced",
}

# Field adına göre node tipi
_FIELD_TYPE_MAP = {
    "title": "Film",
    "film": "Film",
    "genre": "Genre",
    "country": "Country",
    "studio": "Studio",
    "movement": "Movement",
}


def _node_type(field_name: str) -> str:
    fl = field_name.lower()
    for key, ntype in _FIELD_TYPE_MAP.items():
        if key in fl:
            return ntype
    return "Person"


def _extract_graph_data(results: list[dict], cypher: str) -> dict:
    """
    Sorgu sonuçlarından graph görselleştirme için nodes + edges üretir.
    - String entity alanları → node
    - Liste entity alanları → node (her eleman ayrı node)
    - Aynı satırdaki string entity ↔ liste entity arasında edge kurulur
    - Tekrar eden edge'ler source+target anahtarıyla deduplicate edilir
    """
    nodes: dict[str, dict] = {}
    edges: dict[str, dict] = {}  # "src→tgt" → edge dict (dedup için)

    def upsert_node(value: str, ntype: str) -> str:
        nid = f"{ntype}:{value}"
        if nid not in nodes:
            nodes[nid] = {"id": nid, "label": value, "type": ntype}
        return nid

    def upsert_edge(source: str, target: str, rel_type: str = "RELATED_TO"):
        eid = f"{source}→{target}"
        if eid not in edges:
            edges[eid] = {"id": eid, "source": source, "target": target, "type": rel_type}

    for row in results:
        row_string_ids: list[str] = []
        row_list_ids: list[str] = []

        for field, value in row.items():
            fl = field.lower()
            is_entity_field = any(ef in fl for ef in _ENTITY_FIELDS)

            if isinstance(value, str) and is_entity_field and value:
                nid = upsert_node(value, _node_type(fl))
                row_string_ids.append(nid)

            elif isinstance(value, list) and is_entity_field:
                for item in value:
                    if isinstance(item, str) and item:
                        nid = upsert_node(item, _node_type(fl))
                        row_list_ids.append(nid)

        # String entity'ler birbirine bağlı (zincir)
        for i in range(len(row_string_ids) - 1):
            upsert_edge(row_string_ids[i], row_string_ids[i + 1])

        # Her string entity, satırdaki liste item'larına bağlı
        for str_nid in row_string_ids:
            for list_nid in row_list_ids:
                upsert_edge(str_nid, list_nid)

    return {"nodes": list(nodes.values()), "edges": list(edges.values())}


def _build_graph_json(rows: list[dict]) -> dict:
    """
    /explore endpoint'i için MATCH (n)-[r]-(m) sonuçlarından graph JSON üretir.
    Her row: source, source_type, rel_type, target, target_type
    """
    nodes: dict[str, dict] = {}
    edges: list[dict] = []

    for row in rows:
        src = row.get("source") or ""
        tgt = row.get("target") or ""
        src_type = (row.get("source_type") or ["Unknown"])[0]
        tgt_type = (row.get("target_type") or ["Unknown"])[0]
        rel = row.get("rel_type", "RELATED_TO")

        if not src or not tgt:
            continue

        src_id = f"{src_type}:{src}"
        tgt_id = f"{tgt_type}:{tgt}"

        if src_id not in nodes:
            nodes[src_id] = {"id": src_id, "label": src, "type": src_type}
        if tgt_id not in nodes:
            nodes[tgt_id] = {"id": tgt_id, "label": tgt, "type": tgt_type}

        edges.append({
            "id": f"{src_id}-{rel}-{tgt_id}",
            "source": src_id,
            "target": tgt_id,
            "type": rel,
        })

    return {"nodes": list(nodes.values()), "edges": edges}


def _build_compare_graph(
    director1: str,
    director2: str,
    shared_collaborators: list[dict],
    shared_genres: list[dict],
    shared_movements: list[str],
    influence_paths: list[dict],
) -> dict:
    """
    /compare endpoint'i için iki yönetmenin bağlantı ağını birleştiren graph JSON üretir.
    """
    nodes: dict[str, dict] = {}
    edges: list[dict] = []

    def add_node(nid: str, label: str, ntype: str):
        if nid not in nodes:
            nodes[nid] = {"id": nid, "label": label, "type": ntype}

    def add_edge(source: str, target: str, rel_type: str):
        eid = f"{source}-{rel_type}-{target}"
        edges.append({"id": eid, "source": source, "target": target, "type": rel_type})

    d1_id = f"Person:{director1}"
    d2_id = f"Person:{director2}"
    add_node(d1_id, director1, "Person")
    add_node(d2_id, director2, "Person")

    for collab in shared_collaborators:
        nid = f"Person:{collab['name']}"
        add_node(nid, collab["name"], "Person")
        add_edge(d1_id, nid, "COLLABORATED")
        add_edge(d2_id, nid, "COLLABORATED")

    for genre_row in shared_genres:
        nid = f"Genre:{genre_row['genre']}"
        add_node(nid, genre_row["genre"], "Genre")
        add_edge(d1_id, nid, "HAS_GENRE")
        add_edge(d2_id, nid, "HAS_GENRE")

    for mv in shared_movements:
        nid = f"Movement:{mv}"
        add_node(nid, mv, "Movement")
        add_edge(d1_id, nid, "PART_OF_MOVEMENT")
        add_edge(d2_id, nid, "PART_OF_MOVEMENT")

    for path in influence_paths:
        if path.get("type") == "direct":
            src = f"Person:{path['source']}"
            tgt = f"Person:{path['target']}"
            add_node(src, path["source"], "Person")
            add_node(tgt, path["target"], "Person")
            add_edge(src, tgt, "INFLUENCED_BY")
        elif path.get("type") == "common_influence":
            mid_label = path["common_influence"]
            mid = f"Person:{mid_label}"
            add_node(mid, mid_label, "Person")
            add_edge(d1_id, mid, "INFLUENCED_BY")
            add_edge(d2_id, mid, "INFLUENCED_BY")

    return {"nodes": list(nodes.values()), "edges": edges}
