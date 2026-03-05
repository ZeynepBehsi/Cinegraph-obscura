import json
import logging
import os
import re

import google.generativeai as genai

from .schema_context import get_schema_prompt

log = logging.getLogger(__name__)

MODEL = "gemini-2.5-flash"


class CinemaQueryAgent:
    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            log.warning("GEMINI_API_KEY ayarlanmamış — .env dosyasını kontrol et.")
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(MODEL)
        self.schema_text = get_schema_prompt()

    # ── Public methods ─────────────────────────────────────────────────────────

    async def generate_cypher(self, question: str) -> tuple[str, str | None]:
        """Doğal dil sorusunu Memgraph Cypher sorgusuna çevirir.
        Returns: (cypher, error_message) — hata yoksa error_message=None."""
        prompt = (
            f"{self.schema_text}\n\n"
            f"Kullanıcı sorusu: {question}\n\n"
            "Yalnızca geçerli Cypher sorgusu yaz. "
            "Açıklama, yorum veya markdown kod bloğu ekleme."
        )
        try:
            response = await self.model.generate_content_async(prompt)
            cypher = self._clean_cypher(self._safe_text(response))
            return cypher, None
        except Exception as exc:
            log.error("generate_cypher hatası: %s", exc, exc_info=True)
            # İlk satırı al — kota/auth hataları için yeterince açıklayıcı
            first_line = str(exc).splitlines()[0] if str(exc) else repr(exc)
            return "", f"Gemini API hatası: {first_line}"

    async def interpret_results(
        self,
        question: str,
        cypher: str,
        results: list[dict],
    ) -> str:
        """Sorgu sonuçlarını Türkçe, sinema tarihi bağlamında yorumlar."""
        truncated = results[:30]
        prompt = (
            "Sen bir sinema tarihi uzmanısın. "
            "Aşağıdaki graph veritabanı sorgu sonuçlarını Türkçe yorumla.\n\n"
            f"Kullanıcı sorusu: {question}\n\n"
            f"Çalıştırılan Cypher:\n{cypher}\n\n"
            f"Sonuçlar ({len(truncated)} satır):\n"
            f"{json.dumps(truncated, ensure_ascii=False, indent=2)}\n\n"
            "Kurallar:\n"
            "- Markdown formatında yaz\n"
            "- Sinema tarihi bağlamında ilginç bağlantıları vurgula\n"
            "- Maksimum 3-4 paragraf, kısa ve öz\n"
            "- Sayısal veriler varsa öne çıkar"
        )
        try:
            response = await self.model.generate_content_async(prompt)
            return self._safe_text(response).strip()
        except Exception as exc:
            log.error("interpret_results hatası: %s", exc, exc_info=True)
            return "Sonuçlar yorumlanamadı."

    async def interpret_comparison(
        self,
        director1: str,
        director2: str,
        stats1: dict,
        stats2: dict,
        shared_collaborators: list[dict],
        shared_genres: list[dict],
        shared_movements: list[str],
        influence_paths: list[dict],
    ) -> str:
        """İki yönetmeni sinema tarihi bağlamında Türkçe karşılaştırır."""
        data = {
            "director1": {"name": director1, "stats": stats1},
            "director2": {"name": director2, "stats": stats2},
            "shared_collaborators_count": len(shared_collaborators),
            "shared_collaborators_top10": shared_collaborators[:10],
            "shared_genres": shared_genres,
            "shared_movements": shared_movements,
            "influence_connections": influence_paths,
        }
        prompt = (
            "Sen bir sinema tarihi uzmanısın. "
            "Aşağıdaki verileri kullanarak iki yönetmeni kapsamlı şekilde Türkçe karşılaştır.\n\n"
            f"{json.dumps(data, ensure_ascii=False, indent=2)}\n\n"
            "Kurallar:\n"
            "- Markdown formatında yaz (## başlıklar, listeler kullan)\n"
            "- Sinematografik benzerlikler ve farklılıkları vurgula\n"
            "- Ortak çalışanlar, türler ve akımların sinema tarihi önemini belirt\n"
            "- Etki/ilham bağlantıları varsa ayrıntılı açıkla\n"
            "- Maksimum 5-6 bölüm, her bölüm kısa ve öz\n"
            "- Sayısal verileri karşılaştırmalı olarak öne çıkar"
        )
        try:
            response = await self.model.generate_content_async(prompt)
            return self._safe_text(response).strip()
        except Exception as exc:
            log.error("interpret_comparison hatası: %s", exc, exc_info=True)
            return "Karşılaştırma yorumlanamadı."

    async def fix_cypher(self, broken_cypher: str, error_msg: str) -> str:
        """Hatalı Cypher'ı hata mesajına göre düzeltir."""
        prompt = (
            "Aşağıdaki Cypher sorgusu çalıştırıldığında hata verdi. "
            "Hatayı düzelt ve yalnızca düzeltilmiş Cypher'ı yaz.\n\n"
            f"Hatalı sorgu:\n{broken_cypher}\n\n"
            f"Hata mesajı:\n{error_msg}\n\n"
            "Düzeltemiyorsan sadece boş satır döndür."
        )
        try:
            response = await self.model.generate_content_async(prompt)
            return self._clean_cypher(self._safe_text(response))
        except Exception as exc:
            log.error("fix_cypher hatası: %s", exc, exc_info=True)
            return ""

    # ── Private helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _safe_text(response) -> str:
        """response.text'e güvenli erişim — safety block durumunda "" döner."""
        try:
            return response.text or ""
        except Exception:
            # İçerik güvenlik filtresiyle bloklandıysa candidates boş gelir
            try:
                return response.candidates[0].content.parts[0].text or ""
            except Exception:
                return ""

    @staticmethod
    def _clean_cypher(text: str) -> str:
        """Gemini çıktısındaki markdown kod bloklarını ve fazladan boşlukları temizler."""
        text = re.sub(r"```(?:cypher)?\s*", "", text, flags=re.IGNORECASE)
        text = text.replace("```", "")
        return text.strip()
