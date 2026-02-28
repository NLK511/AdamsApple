# TradeDesk Advisor (SvelteKit)

A clean and professional SvelteKit trading advisor UI that lets you:

- Create and switch between multiple ticker watchlists.
- Track current prices with daily/weekly/monthly/quarterly/yearly change snapshots.
- Set threshold alerts for each ticker when price moves above or below a value.
- Persist watchlist state in local storage.

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
