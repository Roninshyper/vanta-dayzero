# Vanta — Dayzero landing page

A landing page where dots form a statue on load, then a scroll-driven dot animation tells the three steps (hands → x-ray veins → phone), ending on a halftone glow section.

## Run it

Serve the folder with any static server and open `index.html`:

```bash
npx serve .
```

## Files

- `index.html` — the whole page (HTML, CSS and JS)
- `david-model.js` — the hero statue: a scan of Michelangelo's David baked into surface points (rebuild with `node tools/bake-stl.js David.stl`)
- `hand-model.js`, `hand3d.js` — the 3D hand used in the scroll animation (posed and skinned in the browser), plus `assets/phone.webp` for the phone screen
- `assets/phone.webp` — the phone image that slides onto the hand
