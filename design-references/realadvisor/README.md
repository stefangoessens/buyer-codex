# RealAdvisor

Role in hierarchy: supplementary reference for score badges, ranking chips, and data-dense property/search surfaces.

## Blocker Status

RealAdvisor is currently blocked by Cloudflare in both the required Chrome DevTools workflow and raw HTTP fetches.

Routes attempted:

- `https://realadvisor.ch/en`
- `https://realadvisor.ch/en/find-agent`

Observed behavior:

- Chrome DevTools lands on "Just a moment..." / "Performing security verification"
- Interacting with the verification checkbox does not release the page into the real product UI
- Raw `curl -L -A 'Mozilla/5.0'` requests return `HTTP/2 403`
- Response headers include `cf-mitigated: challenge`

## Evidence

Screenshots:

- `screenshots/pass-1-cloudflare-blocker.png`
- `screenshots/pass-1-find-agent-cloudflare-blocker.png`

Header proof from raw fetch:

```text
HTTP/2 403
cf-mitigated: challenge
server: cloudflare
```

## Impact

The following decisions remain provisional:

- score badge styling
- ranking chip styling
- final search-density tuning for property/search result surfaces

Temporary fallback until unblocked:

- use Hosman's property rail and DPE-like chip density
- use shadcn metric chips/cards for compact score framing

## Unblock Requirement

This reference needs a non-blocked browser path. The capture pack here is intentionally explicit so the next agent can resume from a verified blocker instead of re-running blind attempts.
