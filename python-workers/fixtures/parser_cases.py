"""Structured parser-fixture manifest shared across parser suites."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal, TypedDict, cast

PortalName = Literal["zillow", "redfin", "realtor"]


class ParserFixtureSignals(TypedDict):
    jsonLd: bool
    apollo: bool
    redux: bool
    nextData: bool
    htmlFallback: bool


class ParserFixtureWebParser(TypedDict, total=False):
    primaryStrategy: str


class ParserFixtureCanonical(TypedDict, total=False):
    addressLine1: str
    addressFormatted: str
    city: str
    state: str
    postalCode: str
    priceUsd: int
    beds: float
    baths: float
    bathsFull: int
    bathsHalf: int
    livingAreaSqft: int
    lotSizeSqft: int
    yearBuilt: int
    propertyType: str
    propertyTypeDisplay: str
    daysOnMarket: int
    hoaMonthlyUsd: int


class ParserFixtureCase(TypedDict, total=False):
    fixture: str
    sourceUrl: str
    signals: ParserFixtureSignals
    canonical: ParserFixtureCanonical
    webParser: ParserFixtureWebParser


_FIXTURES_DIR = Path(__file__).resolve().parent
_HTML_DIR = _FIXTURES_DIR / "html"
_MANIFEST_PATH = _FIXTURES_DIR / "parser_cases.json"


@lru_cache(maxsize=1)
def load_parser_fixture_manifest() -> dict[str, list[ParserFixtureCase]]:
    raw = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
    portals = raw.get("portals")
    if not isinstance(portals, dict):
        raise ValueError("parser_cases.json is missing a 'portals' object")
    return cast(dict[str, list[ParserFixtureCase]], portals)


def load_portal_cases(portal: PortalName) -> list[ParserFixtureCase]:
    manifest = load_parser_fixture_manifest()
    return list(manifest[portal])


def load_portal_expectations(portal: PortalName) -> dict[str, dict[str, Any]]:
    return {
        case["fixture"]: {
            "source_url": case["sourceUrl"],
            "address_line1": case["canonical"].get("addressLine1"),
            "city": case["canonical"]["city"],
            "state": case["canonical"]["state"],
            "postal_code": case["canonical"]["postalCode"],
            "price_usd": case["canonical"]["priceUsd"],
            "beds": case["canonical"]["beds"],
            "baths": case["canonical"]["baths"],
            "living_area_sqft": case["canonical"]["livingAreaSqft"],
            "lot_size_sqft": case["canonical"].get("lotSizeSqft"),
            "year_built": case["canonical"]["yearBuilt"],
            "property_type": case["canonical"]["propertyType"],
            "days_on_market": case["canonical"].get("daysOnMarket"),
            "hoa_monthly_usd": case["canonical"].get("hoaMonthlyUsd"),
        }
        for case in load_portal_cases(portal)
    }


def read_portal_fixture(portal: PortalName, fixture_name: str) -> str:
    return (_HTML_DIR / portal / fixture_name).read_text(encoding="utf-8")
