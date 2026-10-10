from __future__ import annotations

from datetime import datetime, timedelta, timezone
from threading import Lock
from typing import Any
from uuid import uuid4

WORKSPACE_TTL = timedelta(hours=4)

_STORE: dict[str, dict[str, Any]] = {}
_LOCK = Lock()


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _cleanup_locked() -> None:
    now = _utc_now()
    expired = [
        workspace_id
        for workspace_id, payload in _STORE.items()
        if datetime.fromisoformat(payload["expires_at"]) <= now
    ]
    for workspace_id in expired:
        _STORE.pop(workspace_id, None)


def create_workspace(payload: dict[str, Any]) -> dict[str, Any]:
    with _LOCK:
        _cleanup_locked()
        workspace_id = uuid4().hex
        expires_at = (_utc_now() + WORKSPACE_TTL).isoformat()
        record = {
            **payload,
            "workspace_id": workspace_id,
            "expires_at": expires_at,
            "created_at": _utc_now().isoformat(),
        }
        _STORE[workspace_id] = record
        return record


def get_workspace(workspace_id: str) -> dict[str, Any] | None:
    with _LOCK:
        _cleanup_locked()
        return _STORE.get(workspace_id)


def update_workspace(workspace_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    with _LOCK:
        _cleanup_locked()
        existing = _STORE.get(workspace_id)
        if existing is None:
            return None
        existing.update(updates)
        _STORE[workspace_id] = existing
        return existing
