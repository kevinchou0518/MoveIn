# Snack Overflow slides

This is the independent presentation workspace on `codex/slides-open-slide`.
Run all commands below from `presentation/`, not the application root.

## Codex quick start

```bash
cd presentation
npm ci
npm run dev
```

Open the local URL printed by the server. The official skills are installed in
`presentation/.agents/skills/` and linked from the repository's `.agents/skills/`
so Codex can discover them from the project root on the next turn.

Example prompt:

> Use create-slide to draft a Snack Overflow presentation. Work in presentation/
> and read presentation/AGENTS.md first. Ask me about audience, length, and style.

Available skills: `create-slide`, `slide-authoring`, `apply-comments`,
`create-theme`, and `current-slide`. All paths mentioned by these skills are
relative to `presentation/`.

Build with `npm run build`; preview the build with `npm run preview`.
After updating the framework, refresh the bundled skills with `npm run sync:skills`.
Commit `package-lock.json` along with the workspace for reproducible installs.

Initialized using the official scaffolder:
`npx --yes @open-slide/cli init presentation --name snack-overflow-slides --use-npm --no-git`.
See [official setup documentation](https://open-slide.dev/docs/getting-started).

## Framework reference

Slides as React components. Each slide lives under `slides/<id>/index.tsx` and default-exports an array of page components. The `@open-slide/core` runtime handles layout, scaling, navigation, thumbnails, and fullscreen play mode — you just write the pages.

## Getting started

```bash
pnpm install
pnpm dev
```

Then open the dev server and edit `slides/getting-started/index.tsx`, or create a new slide at `slides/<your-slide>/index.tsx`.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the dev server with hot reload. |
| `pnpm build` | Build a static bundle you can deploy. |
| `pnpm preview` | Preview the built bundle locally. |

## Authoring a slide

```tsx
// slides/my-slide/index.tsx
import type { Page, SlideMeta } from '@open-slide/core';

const Cover: Page = () => (
  <div style={{ width: '100%', height: '100%' }}>Hello</div>
);

export const meta: SlideMeta = { title: 'My slide' };
export default [Cover] satisfies Page[];
```

Every page renders into a fixed **1920 × 1080** canvas — design with absolute pixel values. Put images, videos, and fonts under `slides/<id>/assets/` and import them directly.

See [`CLAUDE.md`](./CLAUDE.md) for the full authoring guide.

## Navigation

- Arrow keys / PageUp / PageDown move between pages.
- `F` enters fullscreen play mode; Esc exits.
- In play mode: Space / → next, ← prev.

## Claude Code integration

This workspace ships with Claude Code skills preconfigured under `.claude/skills/` and `.agents/skills/`. Ask Claude Code to "make slides about X" and the `create-slide` skill takes over. Use `apply-comments` to iterate via inspector-style markers inside your source.

## Config

Optional `open-slide.config.ts` at the workspace root:

```ts
import type { OpenSlideConfig } from '@open-slide/core';

const openSlideConfig: OpenSlideConfig = {
  port: 5173,
};

export default openSlideConfig;
```

Supported fields: `slidesDir`, `port`.
