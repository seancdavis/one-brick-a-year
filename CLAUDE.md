# one-brick-a-year

You are Sean's development partner on this project. Work collaboratively, make decisions within established patterns, and ask when something is ambiguous.

## What this is

An interactive web page for an eight-year-old, and for sharing, that makes 4.6 billion years feel long. One LEGO brick for every year, stacked back in time, while she scrolls. Scrolling forward builds the stack and scrolling back undoes it, instantly and in proportion to how far she scrolls. The stack passes things she knows (a door, her house, the Eiffel Tower, airplanes, the space station) on its way to wrapping around the Earth, compacting ten bricks into one whenever it would otherwise outgrow the screen so it always stays visible. The feeling comes from cost: a vigorous, sustained scroll takes about a minute and a half to finish, and that's the lesson. Every ratio on screen is real. Icons are labels, not to scale.

## Project Documentation

- **Current state:** `docs/principles.md` — architecture, conventions, and principles as they are now. Read this first.
- **Decisions:** `docs/decisions/` — ADRs explaining why each rule exists. Read when a rule seems arbitrary.
- **Session logs:** `docs/sessions/` — outcomes of past grill sessions. Skim recent ones for context.
- **Autopilot specs:** `docs/autopilot/` — settled specs for unattended runs.
- **Prototype:** `docs/prototype/brick-stack.html` — the single-file prototype this grew from. The reference for pacing, camera behavior, and landmark math.

When Sean wants to align on upcoming work, he uses `/grill-me`.

## Tech Stack

- **Framework:** Vite with vanilla TypeScript. No UI framework. One page, one canvas, a small HTML HUD.
- **Styling:** plain CSS with the picture-book tokens in `src/style.css`; Fredoka and Patrick Hand from Google Fonts. No Tailwind: it is one screen and most pixels are canvas-drawn.
- **Hosting:** Netlify, via `@netlify/vite-plugin` and `netlify.toml`.
- **Database:** Netlify Database via `@netlify/database`; SQL migrations in `netlify/database/migrations/<timestamp>_<slug>/migration.sql`, applied by Netlify on deploy; functions in `netlify/functions/` with `_shared/` for cross-function code, `path` declared in the function file.
- **Tests:** Vitest, for the pure modules only.

## Development

```bash
npm run dev        # Vite dev server (the Netlify plugin injects environment)
npm run build      # typecheck, then vite build to dist/
npm run typecheck  # tsc --noEmit
npm test           # vitest run
npm run preview    # serve dist/
```

## Project Conventions

- Pure logic lives in `src/lib/` and never touches the DOM or canvas, so it can be unit tested. Every file in `src/lib/` has a sibling `*.test.ts`.
- Rendering lives in `src/render/`. It reads state and draws. It never mutates state.
- DOM glue (input, HUD, cards, audio, start screen) lives at the top of `src/`, one file per concern, wired together in `src/main.ts`.
- Every number that shapes the feel (brick height, pacing constants, zoom thresholds) lives in `src/lib/constants.ts` with a one-line comment saying what it does.
- Facts (ages, heights) live in `src/lib/landmarks.ts` and `src/lib/beats.ts` with a source comment. Do not invent facts. If a number is uncertain, round and say "about".
- Copy is written for an eight-year-old who can read: short sentences, concrete nouns, no jargon.
- Accessibility baseline: keyboard scroll equivalents (arrow keys, space, page up/down), visible focus states, `prefers-reduced-motion` respected, sound off by default and only started by a user gesture.

## Skills Reference

- `/skills/vite-best-practices` — Netlify plugin config and scripts. The React, Router, and data-fetching sections do not apply here.
- `/skills/ui-design` — visual conventions and accessibility baseline.
- `/skills/seo` — meta and Open Graph tags for sharing.
- Netlify MCP `get-netlify-coding-context` — current Netlify platform guidance when touching deploy config.

## Commit Guidelines

- Make atomic commits with clear messages
- Use conventional commit format: `type: description`
- Types: feat, fix, refactor, docs, style, test, chore
