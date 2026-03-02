import os

from neo4j import GraphDatabase


class MemgraphClient:
    def __init__(self):
        uri = os.getenv("MEMGRAPH_URI", "bolt://localhost:7687")
        self.driver = GraphDatabase.driver(uri, auth=("", ""))

    def ping(self) -> bool:
        try:
            self.driver.verify_connectivity()
            return True
        except Exception:
            return False

    def execute_query(self, cypher: str, params: dict | None = None) -> list[dict]:
        with self.driver.session() as session:
            result = session.run(cypher, params or {})
            return [record.data() for record in result]

    def close(self) -> None:
        self.driver.close()
