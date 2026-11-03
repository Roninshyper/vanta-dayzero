# Vanta — Dayzero landing page

A landing page where dots form a statue on load, then a scroll-driven dot animation tells the three steps (hands → x-ray veins → phone), ending on a halftone glow section.

## Run it

Serve the folder with any static server and open `index.html`:

```bash
npx serve .
```

## Files

- `index.html` — the whole page (HTML, CSS and JS)
- `hero-image.js`, `touch-image.js`, `vein-hand-image.js`, `hand-image.js` — the artwork, embedded as data so the dots can be sampled from any server
- `assets/phone.webp` — the phone image that slides onto the hand
