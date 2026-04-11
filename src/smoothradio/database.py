"""SQLite metadata persistence for file-to-bucket mappings."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterable, Iterator, Optional

DEFAULT_DB_PATH = Path("metadata.db")


class MetadataDB:
    """Persist AI-assigned bucket labels for files, keyed by absolute path.

    Backed by SQLite so repeated runs can skip redundant AI API calls by
    looking up previously categorized files before re-requesting a bucket.
    """

    def __init__(self, db_path: str | Path = DEFAULT_DB_PATH) -> None:
        self.db_path = Path(db_path)
        if self.db_path.parent and str(self.db_path.parent) not in ("", "."):
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.execute("PRAGMA foreign_keys = ON")
            yield conn
            conn.commit()
        finally:
            conn.close()

    def _init_schema(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS file_buckets (
                    file_path   TEXT PRIMARY KEY,
                    bucket_name TEXT NOT NULL,
                    updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                );

                CREATE INDEX IF NOT EXISTS idx_file_buckets_bucket
                    ON file_buckets(bucket_name);
                """
            )

    @staticmethod
    def _normalize(file_path: str | Path) -> str:
        return str(Path(file_path).expanduser().resolve())

    def get_bucket(self, file_path: str | Path) -> Optional[str]:
        key = self._normalize(file_path)
        with self._connect() as conn:
            row = conn.execute(
                "SELECT bucket_name FROM file_buckets WHERE file_path = ?",
                (key,),
            ).fetchone()
            return row[0] if row else None

    def set_bucket(self, file_path: str | Path, bucket_name: str) -> None:
        if not bucket_name:
            raise ValueError("bucket_name must be a non-empty string")
        key = self._normalize(file_path)
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO file_buckets (file_path, bucket_name, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(file_path) DO UPDATE SET
                    bucket_name = excluded.bucket_name,
                    updated_at  = CURRENT_TIMESTAMP
                """,
                (key, bucket_name),
            )

    def set_many(self, items: Iterable[tuple[str | Path, str]]) -> None:
        payload = [(self._normalize(p), b) for p, b in items if b]
        if not payload:
            return
        with self._connect() as conn:
            conn.executemany(
                """
                INSERT INTO file_buckets (file_path, bucket_name, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(file_path) DO UPDATE SET
                    bucket_name = excluded.bucket_name,
                    updated_at  = CURRENT_TIMESTAMP
                """,
                payload,
            )

    def delete(self, file_path: str | Path) -> bool:
        key = self._normalize(file_path)
        with self._connect() as conn:
            cur = conn.execute(
                "DELETE FROM file_buckets WHERE file_path = ?", (key,)
            )
            return cur.rowcount > 0

    def list_by_bucket(self, bucket_name: str) -> list[str]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT file_path FROM file_buckets WHERE bucket_name = ? ORDER BY file_path",
                (bucket_name,),
            ).fetchall()
            return [r[0] for r in rows]

    def all_buckets(self) -> dict[str, str]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT file_path, bucket_name FROM file_buckets"
            ).fetchall()
            return {path: bucket for path, bucket in rows}

    def count(self) -> int:
        with self._connect() as conn:
            (n,) = conn.execute("SELECT COUNT(*) FROM file_buckets").fetchone()
            return int(n)

    def clear(self) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM file_buckets")
