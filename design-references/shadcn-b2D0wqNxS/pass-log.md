# shadcn preset Pass Log

## Pass 1

- Viewport: desktop (`1440x1200`)
- Goal: capture the full preset preview and confirm whether the shell matched the Linear description
- Output: `screenshots/pass-1-desktop-preview-full.png`
- New findings:
  - The preview behaves like a component lab rather than the expected dashboard-shell demo.
  - It is still valuable as the app-card and dense-form reference.

## Pass 2

- Viewport: desktop (`1440x1200`)
- Goal: isolate reusable app-card and analytics-card surfaces
- Output:
  - `screenshots/pass-2-desktop-card-surface.png`
  - `screenshots/pass-2-desktop-analytics-cards.png`
- New findings:
  - App cards share a common radius, ring, and shadow treatment.
  - Chart and analytics surfaces are strong candidates for buyer dashboard and internal console cards.

## Pass 3

- Viewport: mobile (`390x844`)
- Goal: confirm responsive stacking behavior and check for shell-specific primitives
- Output:
  - `screenshots/pass-3-mobile-preview-full.png`
  - `screenshots/pass-3-mobile-stack.png`
- New findings:
  - Cards stack cleanly with no new mobile-specific primitives.
  - Coverage stabilized for the live preset preview surfaces; exact shell geometry is already covered in `dashboard-shell-contract.md`.
