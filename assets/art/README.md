# Illustrations

Flat vector scenes used across the site: service and guide heroes, picture-led
index cards, the home page story bands and the "three ways to be seen" section
on /about.

## Where they come from

Every file here started as an illustration from [unDraw](https://undraw.co) by
Katerina Limpitsouni, obtained through the MIT-licensed
[`undraw-svg`](https://www.npmjs.com/package/undraw-svg) package. unDraw's own
licence allows free commercial use without attribution or permission, so these
can ship on the live site as they are.

## What was changed

unDraw ships everything on a pink/indigo accent, which reads as borrowed on a
teal-and-green site. Each file was pushed through one colour classifier:

- **skin tones and white** are left exactly as they were,
- **flat greys** keep their value but pick up a faint teal tint, so they sit on
  the page background instead of on top of it,
- **flat black** is lifted into a deep teal ink, which reads calmer,
- **everything else** is re-hued to the brand teal, or to the brand green if it
  was already leafy, keeping its original lightness so the shading survives,
- **`currentColor`**, which is unDraw's accent slot, is baked to `#0f9aa8`:
  these ship as `<img>`, which has no inheriting context to take a colour from.

The script that does this lives in the commit that added this folder; re-run it
against a fresh `undraw-svg` download if more scenes are ever needed.

## Using them

They are plain `<img>` elements, never inlined, so the browser caches them once
and reuses them across pages:

```html
<img class="ill" src="/assets/art/family.svg" alt="…" width="453" height="472"
     loading="lazy" decoding="async">
```

Always pass the `width`/`height` from the file's own `viewBox` so the page does
not reflow when the drawing lands, and always write a real `alt`: these carry
meaning, they are not decoration.

Every frame that holds one (`.ill-frame`, `.card-art`) keeps a light background
even in dark mode. That is deliberate — the drawings carry their own pale greys,
and on a dark panel they float with nothing behind them.
