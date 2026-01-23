"""
Storage backend abstraction for gardenmap.

Provides two implementations:
- JSONFileStorage: uses the same JSON files as before (plants.json, garden.json).
- SQLiteStorage: stores plants in a SQLite database; supports multiple "namespaces"
  (tables) so we can keep palette and garden data separate in the same DB file.

Configuration is external: use the factory `make_storage(backend, path, namespace)`.

This module aims to maintain the same REST behavior as the previous JSON-only
implementation while offering a safer, tested SQLite option.
"""

from abc import ABC, abstractmethod
from typing import Dict, Iterable, List, Optional


class StorageError(RuntimeError):
    pass


class StorageBase(ABC):
    @abstractmethod
    def get_all(self) -> List[Dict]:
        """Return the list of plant dicts (not wrapped)."""
        ...

    @abstractmethod
    def append(self, plants: Iterable[Dict]) -> None:
        """Append plants to the backend (preserve behavior of JSON append)."""
        ...

    @abstractmethod
    def update_one(self, plant: Dict) -> None:
        """Find the first plant with matching 'id' and replace it. If not found, insert."""
        ...

    def update_many(self, plants: Iterable[Dict]) -> None:
        """Default implementation: call update_one for each element."""
        for p in plants:
            self.update_one(p)

    @abstractmethod
    def delete_by_ids(self, ids: Iterable) -> None:
        """Delete all plants whose id is in the provided iterable."""
        ...

    def get_wrapped(self) -> Dict:
        """Return same structure as existing endpoints expect: {'plantlist': [...] }"""
        return {"plantlist": self.get_all()}
