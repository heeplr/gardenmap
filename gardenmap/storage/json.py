
import json
import os
import tempfile

from filelock import FileLock, Timeout
from typing import Dict, Iterable, List
from . import StorageBase, StorageError


class JSONFileStorage(StorageBase):
    def __init__(self, path: str, lock_timeout: float = 5.0) -> None:
        self.path = os.fspath(path)
        self.lock = FileLock(f"{self.path}.lock", timeout=lock_timeout)

        # Ensure file exists
        if not os.path.exists(self.path):
            try:
                with open(self.path, "w", encoding="utf-8") as f:
                    json.dump({"plantlist": []}, f)
            except OSError as e:
                # Defer error until first operation
                raise StorageError(f"could not create storage file {self.path}: {e}") from e

    def _read(self) -> Dict:
        try:
            with self.lock:
                with open(self.path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if not isinstance(data, dict) or "plantlist" not in data:
                        return {"plantlist": []}
                    if not isinstance(data["plantlist"], list):
                        data["plantlist"] = []
                    return data
        except Timeout as e:
            raise StorageError("resource busy (file lock)") from e
        except (FileNotFoundError, json.JSONDecodeError):
            # Return safe default if file missing or invalid
            return {"plantlist": []}

    def _write(self, data: Dict) -> None:
        # Write atomically by writing to a temp file then renaming.
        try:
            with self.lock:
                # Use temp file in same dir to ensure atomic rename on POSIX
                dirpath = os.path.dirname(self.path) or "."
                fd, tmp = tempfile.mkstemp(dir=dirpath)
                try:
                    with os.fdopen(fd, "w", encoding="utf-8") as f:
                        json.dump(data, f, indent=2, ensure_ascii=False)
                        f.flush()
                        os.fsync(f.fileno())
                    os.replace(tmp, self.path)
                finally:
                    # If replace failed, ensure tmp removed
                    if os.path.exists(tmp):
                        try:
                            os.remove(tmp)
                        except OSError:
                            pass
        except Timeout as e:
            raise StorageError("resource busy (file lock)") from e
        except OSError as e:
            raise StorageError("failed to write storage file") from e

    def get_all(self) -> List[Dict]:
        return self._read().get("plantlist", [])

    def append(self, plants: Iterable[Dict]) -> None:
        data = self._read()
        data["plantlist"] += list(plants)
        self._write(data)

    def update_one(self, plant: Dict) -> None:
        data = self._read()
        updated = False
        for i, p in enumerate(data["plantlist"]):
            if p.get("id") == plant.get("id"):
                data["plantlist"][i] = plant
                updated = True
                break
        if not updated:
            # match JSON behavior: if no match, append
            data["plantlist"].append(plant)
        self._write(data)

    def delete_by_ids(self, ids: Iterable) -> None:
        ids_set = set(ids)
        data = self._read()
        data["plantlist"] = [p for p in data.get("plantlist", []) if p.get("id") not in ids_set]
        self._write(data)
