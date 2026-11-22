# Colorpoop site

Stay Creative, Stay Weird. A static, dependency-free site for Colorpoop.

- `index.html` — all copy and sections (Colorpoop, Stories, Goods, Drop I, Ra)
- `styles.css` — layout, dark theme and the "Lights" (lilac + electric blue) theme
- `main.js` — doodle-able particle home, draggable windows, pixel-mosaic background, hash routing
- `assets/img/` — artwork cropped from the Colorpoop launch presentation

## Run locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. (Opening `index.html` straight from disk also works; the wordmark then falls back to text.)

## Editing

- Add a section: add an `<a class="win" href="#name">` inside `#desk`, a matching `<section class="sec" id="sec-name">`, and a position for the new window in `styles.css` (`.win:nth-child(n)`).
- Swap images: replace files in `assets/img/` or edit the `<figure>` entries in a `.strip`.
- Not yet wired up: social links, contact email and a shop / mailing list.

## Deploy

Pushes to `main` publish to GitHub Pages through `.github/workflows/pages.yml`. If the first run fails at "Setup Pages", set Settings → Pages → Source to "GitHub Actions" once and re-run it.
