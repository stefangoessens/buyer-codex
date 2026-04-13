from __future__ import annotations

from src.observability import ObservabilityContext, resolve_context


def test_resolve_context_prefers_railway_preview_environment() -> None:
    original_environ = {
        "BUYER_CODEX_ENV": "production",
        "RAILWAY_ENVIRONMENT_NAME": "preview-pr-976",
        "RAILWAY_SERVICE_NAME": "extraction",
        "SENTRY_RELEASE": "sha-123",
    }

    context = _resolve_with(original_environ)

    assert context.environment == "preview"
    assert context.deployment == "preview-pr-976"
    assert context.service == "extraction"
    assert context.release == "sha-123"


def test_resolve_context_uses_explicit_stage_without_railway_metadata() -> None:
    context = _resolve_with(
        {
            "BUYER_CODEX_ENV": "staging",
            "OBSERVABILITY_SERVICE_NAME": "buyer-codex-extraction",
        }
    )

    assert context.environment == "staging"
    assert context.deployment == "staging"
    assert context.service == "buyer-codex-extraction"


def _resolve_with(values: dict[str, str]) -> ObservabilityContext:
    import os

    previous: dict[str, str | None] = {}
    keys = {
        "BUYER_CODEX_ENV",
        "RAILWAY_ENVIRONMENT_NAME",
        "RAILWAY_ENVIRONMENT",
        "RAILWAY_SERVICE_NAME",
        "OBSERVABILITY_SERVICE_NAME",
        "SENTRY_RELEASE",
        "SOURCE_VERSION",
        "NODE_ENV",
        "SENTRY_ENVIRONMENT",
    }

    for key in keys:
        previous[key] = os.getenv(key)

    try:
        for key in keys:
            if key in values:
                os.environ[key] = values[key]
            elif key in os.environ:
                del os.environ[key]

        return resolve_context(default_service="buyer-codex-extraction", version="0.0.1")
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
