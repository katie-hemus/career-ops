# Career Ops Web Dashboard

Static web dashboard for the Katie Hemus & Claire Holden job search pipeline.

## Quick Start

```bash
cd web/
python3 -m http.server 8080
# Open http://localhost:8080
```

Or serve with any static HTTP server (Caddy, nginx, Vercel, Netlify).

## Structure

```
web/
  index.html      — Single-page dashboard (password-gated)
  app.js          — Dashboard logic (vanilla JS, no framework)
  styles.css      — Studio aesthetic styling
  data/
    katie-roles.json   — Katie's structured role data
    claire-roles.json  — Claire's structured role data
  README.md       — This file
```

## Password Gate

The dashboard uses a client-side password gate with SHA-256 hashing via SubtleCrypto.
Default password hash is embedded in `app.js`. Once unlocked, a session stays open
until the user clicks the lock button or clears localStorage.

To change the password, update the `DEFAULT_HASH` constant in `app.js` with a new
SHA-256 hash. Generate one:

```bash
echo -n "your-password" | sha256sum
```

## Data Format

See `../data/katie-roles.json` and `../data/claire-roles.json` for the role schema.
The dashboard fetches these from `data/` relative to itself — works on any static host.

## Design

- **Colors:** Sage green (#5b8c6e), cream (#fbf7f0), charcoal (#2d2a26)
- **Frameworks:** None — vanilla HTML/CSS/JS
- **Responsive:** Mobile-friendly, card-based layout
- **Filters:** Salary-clears-only, minimum fit score, company

## Deployment

Works on any static host (Vercel, Netlify, GitHub Pages, S3 + CloudFront).
Just deploy the `web/` directory as root.

For Vercel:
```
vercel web/
```

For a private deployment, add HTTP Basic Auth or IP allowlisting in front of
the static server. The client-side password gate is convenience only — not a
replacement for server-side auth in production.
