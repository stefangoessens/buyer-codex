# Design References

Durable capture pack for `KIN-946`.

## Reference Status

| Reference | Status | Directory |
| --- | --- | --- |
| PayFit | Captured | `design-references/payfit/` |
| Hosman | Captured | `design-references/hosman/` |
| shadcn preset `b2D0wqNxS` | Captured with preview mismatch note | `design-references/shadcn-b2D0wqNxS/` |
| RealAdvisor | Blocked by Cloudflare | `design-references/realadvisor/` |

## Shared Outputs

- `component-catalog.md` - harvested components, adoption status, and surface mapping for `KIN-945`
- `core-primitives.md` - shared primitives and provisional gaps for `KIN-945`
- `token-candidates.json` - machine-readable token proposal for `KIN-944`
- `tokens.ts` - TypeScript export of the adopted candidate tokens
- `tokens.css` - CSS custom properties mirroring the adopted candidate tokens

## Notes

- The PayFit/Hosman/shadcn captures are stable enough for downstream agents to work from without re-opening those sources.
- RealAdvisor is the only unresolved reference. Its blocker pack includes screenshots and raw transport evidence so a future agent can resume from a concrete stopping point instead of rediscovering the failure mode.
