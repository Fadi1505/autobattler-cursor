# Hero spritesheets

Drop hero spritesheets in this folder using the hero's data-`key`
(camelCase, matching `src/data/heroes.ts`) as the basename:

```
assets/sprites/heroes/infernoDrake.png
assets/sprites/heroes/grommashIronfist.png
...
```

## Expected layout

`PreloadScene` loads every hero with:

```ts
this.load.spritesheet(hero.key, `sprites/heroes/${hero.key}.png`, {
  frameWidth: 128,
  frameHeight: 128,
});
```

The URL above intentionally drops the `assets/` prefix: Vite is
configured with `publicDir: "assets"` so files inside `assets/` are
served from the URL root (e.g., `assets/sprites/heroes/foo.png` on disk
is reachable at `/sprites/heroes/foo.png` in dev, and gets copied to
`dist/sprites/heroes/foo.png` in production).

The recommended frame layout (laid out left-to-right in a single row, or
in a grid that's a multiple of 128 px) is:

| Frame range | Animation | Notes                              |
| ----------- | --------- | ---------------------------------- |
| 0–3         | `idle`    | Looped at 6 fps                    |
| 4–7         | `attack`  | Plays once, returns to idle        |
| 8–11        | `cast`    | Plays once, returns to idle        |
| 12–13       | `hit`     | 2-frame flinch                     |
| 14–17       | `death`   | Plays once and holds on last frame |

`HeroSprite` registers these animations automatically if the texture has
the expected number of frames; otherwise it falls back to procedural
tween-based animation on a colored body rectangle.

## Placeholder mode

If a hero is missing its PNG, `PreloadScene` generates a procedural
single-frame placeholder texture (role-tinted rectangle with the hero's
initial) so `CombatScene` always has something to render. Drop a real
spritesheet in and it transparently replaces the placeholder on next boot.
