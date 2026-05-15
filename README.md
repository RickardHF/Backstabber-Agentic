# Backstabber

A top-down 2D stealth game built with Next.js, React, and HTML Canvas — with a twist: **the game itself can be rewritten while you play it**, powered by an in-game AI coding agent.

Kill enemies to earn credits, spend them at an NPC to prompt an AI agent that can read and edit the game's source code in real time. Change the rules, add features, break things — all without leaving the arena.

## ⚡ In-Game AI Agent

Backstabber embeds a fully functional AI coding agent inside the game loop. An NPC called **Toasty Llama** sits near your spawn point. Walk up, press interact, and a terminal-style chat overlay opens — backed by the [GitHub Copilot SDK](https://github.com/github/copilot-sdk) (`@github/copilot-sdk`).

**How it works:**
- Every enemy you backstab earns **1 credit**.
- Each prompt to the agent costs **1 credit** — so you have to _play_ to _code_.
- The agent runs a full Copilot session with tool use: it can read files, run commands, and edit source code in the project's working directory.
- Streaming responses, reasoning traces, and tool-call progress are all visible in the overlay in real time.

**What can you do with it?** Anything the SDK supports — ask it to tweak enemy speed, add a new item type, change the map, refactor a module, or explain how the vision-cone math works. The session persists across prompts, so you can iterate.

**Point it at any project.** Set `COPILOT_WORKING_DIR` to a different repo and the agent operates there instead. Backstabber becomes a gamified front-end for AI-assisted coding on whatever codebase you choose.

> This is a reference implementation showing how to integrate the Copilot SDK into a Next.js app — streaming events, tool-call visualization, session management, and a credit-gated economy — all in ~200 lines (`api/prompt/route.ts` + `PromptModal.tsx`).

## Story

You are **Cedric Bearsbane**, trapped by the Norse gods in a chamber between the worlds of the living and the dead — a realm called **Kinunda**. Armed only with a gilded dagger, you must outwit the wretched guards placed there for the gods' entertainment. Circle unseen, pierce the blind side, vanish before the echo.

## Gameplay

- **Backstabbing** — Enemies can only be killed by attacking from outside their vision cone (behind them). Frontal contact means death.
- **Vision cones** — Both the player (220°) and enemies have visible vision cones. Line-of-sight is blocked by walls.
- **Items** — Defeated enemies drop items:
  - **Speed Potion** (~80% drop) — Temporary speed boost.
  - **Emerald Inferno** (~20% drop) — Temporarily allows killing enemies from any direction.
- **Credits** — Each kill earns a credit, spendable at the Prompt NPC.

## Controls

### Desktop
| Key | Action |
|---|---|
| W / S | Move forward / backward |
| A / D | Rotate left / right |
| Space | Attack |

### Mobile
- **Left joystick** — Movement and rotation
- **Attack button** — On-screen attack button
- Fullscreen toggle available

## AI Enemies

- Managed by an `AIManager` that spawns multiple enemies over time (configurable max bots, spawn intervals).
- Enemies patrol randomly, but will chase the player on sight.
- Vision is blocked by walls — use obstacles to stay hidden.
- Death animations play on kill.

## Map System (Tiled TMJ)

Arena layouts are authored in the free [Tiled](https://www.mapeditor.org/) editor and saved as `.tmj` JSON files. The game loads `public/maps/arena.tmj` at runtime. A larger variant, `arena_large.tmj`, is also included.

**Layers:**
1. **Walls** (object layer) — Rectangle objects with `type = wall` become collision boxes.
2. **Spawns** (object layer) — Point objects with `type = spawn` and property `spawnType` = `user` or `ai`.

**Edit workflow:**
1. Open a `.tmj` file in Tiled.
2. Adjust wall rectangles (default map: 20×15 tiles @ 40 px → 800×600 px).
3. Move or add spawn points (set property `spawnType`).
4. Save and refresh the browser.

If loading the TMJ fails, the game falls back to the hardcoded layout in `MapLayout.ts`.

Add new maps by placing another `.tmj` in `public/maps/` and calling `loadMapFromTiled('/maps/yourmap.tmj')`.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

All optional — the game runs fine without them; the Prompt NPC simply won't connect.

| Variable | Description |
|---|---|
| `GH_TOKEN` or `GITHUB_TOKEN` | A GitHub token with Copilot access. Only needed if you want the in-game AI agent to work. Falls back gracefully if missing. |
| `COPILOT_WORKING_DIR` | Absolute path to the directory the agent should operate in. Defaults to the project root. Set this to point the agent at a different codebase entirely. |

## Tech Stack

- **Framework** — [Next.js](https://nextjs.org/) (App Router, Turbopack)
- **Rendering** — HTML Canvas with sprite sheets
- **Sprites** — Custom sprite sheets in `public/sprites/` (source `.xcf` files in `images/`)
- **AI Chat** — [@github/copilot-sdk](https://github.com/github/copilot-sdk)
- **Styling** — [Tailwind CSS](https://tailwindcss.com/)
- **Language** — TypeScript

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Main page with title and game wrapper
│   ├── layout.tsx            # Root layout
│   └── api/prompt/route.ts   # Copilot SDK API endpoint
├── components/
│   ├── Game.tsx              # Core game loop and state
│   ├── StartScreen.tsx       # Main menu
│   ├── LoreScreen.tsx        # Scrolling backstory
│   ├── PromptModal.tsx       # AI chat overlay
│   ├── ClientGameWrapper.tsx # Client-side wrapper
│   └── game/
│       ├── AIManager.ts      # Multi-enemy spawning and lifecycle
│       ├── AIPlayer.ts       # Enemy AI behavior and vision
│       ├── HumanPlayer.ts    # Player movement and backstab logic
│       ├── MapLayout.ts      # Map loading and wall generation
│       ├── PromptNPC.ts      # Toasty Llama NPC
│       ├── MobileControls.tsx# Joystick and on-screen buttons
│       ├── collision.ts      # Collision detection
│       ├── rendering.ts      # Canvas draw routines
│       ├── sprites.ts        # Sprite sheet management
│       ├── types.ts          # Shared type definitions
│       ├── constants.ts      # Color palettes
│       └── utils.ts          # Math and geometry helpers
└── utils/
    └── debugSprites.ts       # Sprite loading diagnostics
```
