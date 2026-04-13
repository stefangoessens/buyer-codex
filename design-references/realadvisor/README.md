# RealAdvisor

Role in hierarchy: supplementary reference for score badges, ranking chips, and data-dense property/search surfaces.

## Deferred Status

RealAdvisor is retained here as supplementary evidence only. A persistent Cloudflare challenge blocked live Chrome DevTools capture and raw HTTP fetches, so this reference was explicitly deferred and does not block the accepted PayFit + Hosman + shadcn reference pack.

Routes attempted:

- `https://realadvisor.ch/en`
- `https://realadvisor.ch/en/find-agent`

Observed behavior:

- Chrome DevTools lands on "Just a moment..." / "Performing security verification"
- In a fresh isolated browser context with a normal desktop Chrome user agent, the page may briefly switch to Cloudflare "Verifying..." and then fall back to the checkbox challenge
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

## Impact On Accepted Pack

The accepted reference pack closes without this source. These areas remain optional future refinements rather than open blockers:

- score badge styling
- ranking chip styling
- final search-density tuning for property/search result surfaces

Temporary fallback until unblocked:

- use Hosman's property rail and DPE-like chip density
- use shadcn metric chips/cards for compact score framing

## Resume Condition

If a non-blocked browser path becomes available later, another agent can resume from this evidence pack instead of re-running blind attempts.
