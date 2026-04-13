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

- Coverage did not stabilize because the reference UI never became accessible.
- This is an active blocker, not an ambiguous capture gap.
