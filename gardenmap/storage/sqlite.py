
from contextlib import closing
import json
import os
from typing import Dict, Iterable, List
import sqlite3

from . import StorageBase, StorageError



class SQLiteStorage(StorageBase):
    """
    SQLite-based storage.

    Table layout (per namespace):
      CREATE TABLE IF NOT EXISTS <table> (
        rowid INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT,
        data TEXT NOT NULL
      );

    - We deliberately do NOT enforce a UNIQUE constraint on id to mirror the JSON
      backend semantics where duplicates are possible.
    - For update_one we update the first row (ORDER BY rowid) that matches the id.
    - For delete_by_ids we delete all rows with matching id (mirrors JSON filter behavior).
    """
    def __init__(self, db_path: str, table: str = "plants") -> None:
        self.db_path = os.fspath(db_path)
        # allow table name safe usage (basic check)
        if not table.isidentifier():
            raise StorageError("invalid table/namespace name")
        self.table = table
        # ensure directory exists
        db_dir = os.path.dirname(self.db_path)
        if db_dir and not os.path.exists(db_dir):
            try:
                os.makedirs(db_dir, exist_ok=True)
            except OSError as e:
                raise StorageError("could not create db directory") from e
        # initialize DB
        self._ensure_table()

    def _connect(self) -> sqlite3.Connection:
        # Create a new connection per operation to avoid cross-thread issues
        conn = sqlite3.connect(self.db_path, timeout=5, isolation_level="DEFERRED")
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.row_factory = lambda cursor, row: row
        return conn

    def _ensure_table(self) -> None:
        sql = f"""
        CREATE TABLE IF NOT EXISTS "{self.table}" (
          rowid INTEGER PRIMARY KEY AUTOINCREMENT,
          id TEXT,
          data TEXT NOT NULL
        );
        """
        try:
            with closing(self._connect()) as conn:
                conn.execute(sql)
                conn.commit()
        except sqlite3.Error as e:
            raise StorageError("failed to initialize sqlite storage") from e

    def get_all(self) -> List[Dict]:
        sql = f'SELECT data FROM "{self.table}" ORDER BY rowid ASC;'
        try:
            with closing(self._connect()) as conn:
                cur = conn.execute(sql)
                rows = cur.fetchall()
                result = []
                for (data_text,) in rows:
                    try:
                        obj = json.loads(data_text)
                        if isinstance(obj, dict):
                            result.append(obj)
                    except json.JSONDecodeError:
                        # skip malformed row but continue
                        continue
                return result
        except sqlite3.Error as e:
            raise StorageError("sqlite read error") from e

    def append(self, plants: Iterable[Dict]) -> None:
        sql = f'INSERT INTO "{self.table}" (id, data) VALUES (?, ?);'
        try:
            with closing(self._connect()) as conn:
                cur = conn.cursor()
                for p in plants:
                    pid = p.get("id")
                    cur.execute(sql, (pid, json.dumps(p, ensure_ascii=False)))
                conn.commit()
        except sqlite3.Error as e:
            raise StorageError("sqlite write error") from e

    def update_one(self, plant: Dict) -> None:
        # find first row with this id
        select_sql = f'SELECT rowid, data FROM "{self.table}" WHERE id = ? ORDER BY rowid ASC LIMIT 1;'
        update_sql = f'UPDATE "{self.table}" SET data = ? WHERE rowid = ?;'
        insert_sql = f'INSERT INTO "{self.table}" (id, data) VALUES (?, ?);'
        pid = plant.get("id")
        try:
            with closing(self._connect()) as conn:
                cur = conn.cursor()
                cur.execute(select_sql, (pid,))
                row = cur.fetchone()
                if row:
                    rowid = row[0]
                    cur.execute(update_sql, (json.dumps(plant, ensure_ascii=False), rowid))
                else:
                    cur.execute(insert_sql, (pid, json.dumps(plant, ensure_ascii=False)))
                conn.commit()
        except sqlite3.Error as e:
            raise StorageError("sqlite write error") from e

    def update_many(self, plants: Iterable[Dict]) -> None:
        """
        For each updated plant, find first row with matching id, merge with existing
        dict (existing | updated) to preserve original 'merge' behavior, then update.
        If not found, insert the updated plant as new row.
        """
        select_sql = f'SELECT rowid, data FROM "{self.table}" WHERE id = ? ORDER BY rowid ASC LIMIT 1;'
        update_sql = f'UPDATE "{self.table}" SET data = ? WHERE rowid = ?;'
        insert_sql = f'INSERT INTO "{self.table}" (id, data) VALUES (?, ?);'
        try:
            with closing(self._connect()) as conn:
                cur = conn.cursor()
                for upd in plants:
                    pid = upd.get("id")
                    cur.execute(select_sql, (pid,))
                    row = cur.fetchone()
                    if row:
                        rowid, existing_text = row[0], row[1]
                        try:
                            existing = json.loads(existing_text) if existing_text else {}
                        except json.JSONDecodeError:
                            existing = {}
                        merged = {**existing, **upd}
                        cur.execute(update_sql, (json.dumps(merged, ensure_ascii=False), rowid))
                    else:
                        cur.execute(insert_sql, (pid, json.dumps(upd, ensure_ascii=False)))
                conn.commit()
        except sqlite3.Error as e:
            raise StorageError("sqlite write error") from e

    def delete_by_ids(self, ids: Iterable) -> None:
        # Build placeholders safely
        ids_list = list(ids)
        if not ids_list:
            return
        placeholders = ",".join("?" for _ in ids_list)
        sql = f'DELETE FROM "{self.table}" WHERE id IN ({placeholders});'
        try:
            with closing(self._connect()) as conn:
                conn.execute(sql, tuple(ids_list))
                conn.commit()
        except sqlite3.Error as e:
            raise StorageError("sqlite delete error") from e
