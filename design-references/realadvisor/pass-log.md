# RealAdvisor Pass Log

## Pass 1

- Viewport: browser default, then desktop (`1440x1200`)
- Goal: open the required RealAdvisor routes in Chrome DevTools
- Routes:
  - `https://realadvisor.ch/en`
  - `https://realadvisor.ch/en/find-agent`
- Output:
  - `screenshots/pass-1-cloudflare-blocker.png`
  - `screenshots/pass-1-find-agent-cloudflare-blocker.png`
- Result:
  - Both routes returned the Cloudflare interstitial instead of the reference UI.

## Pass 2

- Goal: interact with the Cloudflare verification checkbox inside the challenge iframe
- Result:
  - Checkbox interaction succeeded mechanically in DevTools, but the page did not advance to the real product surface.

## Pass 3

- Goal: verify whether a raw user-agent spoofed HTTP fetch could recover the HTML for offline inspection
- Commands used:
  - `curl -L -A 'Mozilla/5.0' -I https://realadvisor.ch/en`
  - `curl -L -A 'Mozilla/5.0' -I https://realadvisor.ch/en/find-agent`
  - `curl -L -A 'Mozilla/5.0' https://realadvisor.ch/en/find-agent`
- Result:
  - `HTTP/2 403`
  - `cf-mitigated: challenge`

## Stop Condition

- The reference UI never became accessible across repeated attempts.
- Because RealAdvisor is supplementary in the accepted hierarchy, capture stops here as durable blocker evidence rather than an open gating requirement.

## Pass 4

- Date: 2026-04-13 re-check
- Environment: fresh isolated Chrome DevTools context (`ra-check-2`)
- Emulation:
  - viewport `1440x1200`
  - user agent `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36`
- Route:
  - `https://realadvisor.ch/en/find-agent`
- Result:
  - Cloudflare briefly entered an automatic "Verifying..." state
  - the page then fell back to the manual checkbox challenge
  - clicking the checkbox again left it in a checked/disabled state but still never released the real page
  - waiting `60s` for `Find the best real estate agent` still timed out

Conclusion:

- The challenge is still active after a fresh isolated-context retry.
- RealAdvisor remains deferred supplementary evidence and does not block KIN-946 closure.
