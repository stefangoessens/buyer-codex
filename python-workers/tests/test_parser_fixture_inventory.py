"""Guardrails for the shared parser-fixture manifest and HTML inventory."""

from __future__ import annotations

from pathlib import Path

from fixtures.parser_cases import load_parser_fixture_manifest, load_portal_cases


def test_manifest_covers_the_three_supported_portals() -> None:
    manifest = load_parser_fixture_manifest()
    assert set(manifest.keys()) == {"zillow", "redfin", "realtor"}


def test_each_portal_has_the_canonical_five_cases() -> None:
    for portal in ("zillow", "redfin", "realtor"):
        assert len(load_portal_cases(portal)) == 5


def test_every_manifested_fixture_file_exists() -> None:
    root = Path(__file__).resolve().parent.parent / "fixtures" / "html"
    for portal in ("zillow", "redfin", "realtor"):
        for case in load_portal_cases(portal):
            fixture_path = root / portal / case["fixture"]
            assert fixture_path.exists(), f"Missing fixture file: {fixture_path}"
            assert case["fixture"].startswith(f"{portal}_")


def test_each_portal_covers_structured_and_fallback_paths() -> None:
    cases_by_portal = {
        portal: load_portal_cases(portal) for portal in ("zillow", "redfin", "realtor")
    }

    for portal, cases in cases_by_portal.items():
        assert any(case["signals"]["htmlFallback"] for case in cases), portal
        assert any(case["signals"]["jsonLd"] for case in cases), portal

    assert any(case["signals"]["apollo"] for case in cases_by_portal["zillow"])
    assert any(case["signals"]["redux"] for case in cases_by_portal["redfin"])
    assert any(case["signals"]["nextData"] for case in cases_by_portal["realtor"])
