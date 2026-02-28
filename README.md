# TradeDesk Advisor (SvelteKit)

A clean and professional SvelteKit trading advisor UI that lets you:

- Create and switch between multiple ticker watchlists.
- Track current prices with daily/weekly/monthly/quarterly/yearly change snapshots.
- Set threshold alerts for each ticker when price moves above or below a value.
- Deliver alert notifications to an inbox with read/unread state that is auto-marked as read when viewed.
- Persist watchlist and notification state in local storage.
- Click any ticker to open a new tab with deep analysis (target consensus, sentiment, fundamentals, and entry/exit plans).
- Swap and compare multiple analysis engines for fundamentals and entry logic.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL shown by Vite (typically `http://localhost:5173`).

## Windows / WSL npm EPERM fix

If your repo is on a mounted Windows path (for example `/mnt/c/...`) and `npm install` fails with:

- `EPERM: operation not permitted, chmod .../node_modules/@sveltejs/kit/svelte-kit.js`

this project includes `.npmrc` with `bin-links=false` so npm does not create chmod-dependent bin links on mounted filesystems.

The npm scripts in `package.json` call CLI entry points through `node ./node_modules/...` directly, so they continue to work without `.bin` symlinks.

## Security-focused tests

Run:

```bash
npm run test
```

This includes static security checks that fail if the app source introduces high-risk patterns such as:

- dynamic code execution (`eval`, `new Function`)
- unsafe HTML sinks (`innerHTML`, `outerHTML`, `insertAdjacentHTML`)
- process or filesystem access in app source (`child_process`, `fs`)
- common prompt-injection / agent-threat surfaces (message handlers, wildcard `postMessage`, dynamic `fetch` targets)
- localStorage access outside authorized app keys (`trade-desk-watchlists-v1`, `trade-desk-notifications-v1`)
