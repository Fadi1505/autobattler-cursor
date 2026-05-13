# Autobattler

A browser autobattler built with [Phaser 4.1](https://phaser.io/) ("Salusa"),
[TypeScript](https://www.typescriptlang.org/), and [Vite](https://vitejs.dev/).

## Requirements

- Node.js 18+ (tested on Node 22)
- npm 9+

## Getting started

```bash
npm install
npm run dev
```

Open the URL Vite prints (defaults to `http://localhost:5173/`).

## Scripts

| Command           | Description                                         |
| ----------------- | --------------------------------------------------- |
| `npm run dev`     | Start the Vite dev server with HMR.                 |
| `npm run build`   | Type-check and produce a production build in `dist/`. |
| `npm run preview` | Preview the production build locally.               |
| `npm run typecheck` | Run `tsc --noEmit` only.                          |

## Project structure

```
autobattler/
├── assets/          # Static game assets, served at the site root by Vite
│   ├── audio/
│   ├── sprites/
│   └── ui/
├── src/
│   ├── core/        # Core systems (GameState, save, etc.)
│   ├── data/        # Static data tables (units, items, balance)
│   ├── effects/     # Visual / particle effects
│   ├── scenes/      # Phaser scenes (BootScene, PreloadScene, ...)
│   ├── ui/          # In-game UI widgets and overlays
│   ├── utils/       # Pure helpers, math, etc.
│   └── main.ts      # Game bootstrap (Phaser config + Game instance)
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Game configuration

- **Logical resolution**: 1280x720
- **Scale mode**: `Phaser.Scale.FIT` with `CENTER_BOTH`, so the canvas
  scales letter-boxed to fit any viewport (desktop and mobile).
- **Physics**: Arcade (zero gravity, ready for top-down play).
- **Path alias**: `@/*` maps to `src/*` (configured in both
  `tsconfig.json` and `vite.config.ts`).

## Adding assets

Drop files under `assets/` and they will be served from the site root,
e.g. `assets/sprites/hero.png` is loaded as `sprites/hero.png`:

```ts
this.load.image("hero", "sprites/hero.png");
```

## License

TBD.
