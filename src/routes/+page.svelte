<script lang="ts">
  import { browser } from '$app/environment';
  import {
    addAlert,
    addTicker,
    defaultWatchlists,
    removeAlert,
    tickWatchlists,
    toggleAlert,
    type Ticker,
    type Watchlist
  } from '$lib/trading';

  const STORAGE_KEY = 'trade-desk-watchlists-v1';

  let watchlists: Watchlist[] = defaultWatchlists();
  let selectedWatchlistId = watchlists[0]?.id ?? '';
  let newWatchlistName = '';
  let tickerSymbol = '';
  let alertDrafts: Record<string, { direction: 'above' | 'below'; threshold: string }> = {};

  const currency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  });

  const signed = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'always'
  });

  if (browser) {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Watchlist[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          watchlists = parsed;
          selectedWatchlistId = parsed[0].id;
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    const handle = setInterval(() => {
      watchlists = tickWatchlists(watchlists);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlists));
    }, 2800);

    window.addEventListener('beforeunload', () => clearInterval(handle));
  }

  $: selectedWatchlist =
    watchlists.find((watchlist) => watchlist.id === selectedWatchlistId) ?? watchlists[0] ?? null;
  $: triggeredCount = watchlists.flatMap((watchlist) => watchlist.tickers).flatMap((t) => t.alerts).filter((a) => a.triggered).length;

  const persist = () => {
    if (!browser) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlists));
  };

  const createWatchlist = () => {
    if (!newWatchlistName.trim()) return;
    const item: Watchlist = {
      id: crypto.randomUUID(),
      name: newWatchlistName.trim(),
      tickers: []
    };
    watchlists = [...watchlists, item];
    selectedWatchlistId = item.id;
    newWatchlistName = '';
    persist();
  };

  const createTicker = () => {
    if (!selectedWatchlist || !tickerSymbol.trim()) return;
    watchlists = watchlists.map((watchlist) =>
      watchlist.id === selectedWatchlist.id ? addTicker(watchlist, tickerSymbol.trim()) : watchlist
    );
    tickerSymbol = '';
    persist();
  };

  const getAlertDraft = (tickerId: string) =>
    alertDrafts[tickerId] ?? {
      direction: 'above' as const,
      threshold: ''
    };

  const setAlertDirection = (tickerId: string, direction: 'above' | 'below') => {
    alertDrafts = {
      ...alertDrafts,
      [tickerId]: {
        ...getAlertDraft(tickerId),
        direction
      }
    };
  };


  const normalizeDirection = (value: string): 'above' | 'below' =>
    value === 'below' ? 'below' : 'above';

  const setAlertThreshold = (tickerId: string, threshold: string) => {
    alertDrafts = {
      ...alertDrafts,
      [tickerId]: {
        ...getAlertDraft(tickerId),
        threshold
      }
    };
  };


  const onAlertDirectionChange = (tickerId: string, event: Event) => {
    const target = event.currentTarget as HTMLSelectElement | null;
    setAlertDirection(tickerId, normalizeDirection(target?.value ?? 'above'));
  };

  const onAlertThresholdInput = (tickerId: string, event: Event) => {
    const target = event.currentTarget as HTMLInputElement | null;
    setAlertThreshold(tickerId, target?.value ?? '');
  };

  const createAlert = (ticker: Ticker) => {
    const draft = getAlertDraft(ticker.id);
    const parsed = Number(draft.threshold);
    if (Number.isNaN(parsed) || parsed <= 0 || !selectedWatchlist) return;
    watchlists = watchlists.map((watchlist) => {
      if (watchlist.id !== selectedWatchlist.id) return watchlist;
      return {
        ...watchlist,
        tickers: watchlist.tickers.map((t) =>
          t.id === ticker.id ? addAlert(t, draft.direction, parsed) : t
        )
      };
    });
    alertDrafts = {
      ...alertDrafts,
      [ticker.id]: {
        ...draft,
        threshold: ''
      }
    };
    persist();
  };

  const deleteAlert = (tickerId: string, alertId: string) => {
    if (!selectedWatchlist) return;
    watchlists = watchlists.map((watchlist) => {
      if (watchlist.id !== selectedWatchlist.id) return watchlist;
      return {
        ...watchlist,
        tickers: watchlist.tickers.map((ticker) =>
          ticker.id === tickerId ? removeAlert(ticker, alertId) : ticker
        )
      };
    });
    persist();
  };

  const flipAlert = (tickerId: string, alertId: string) => {
    if (!selectedWatchlist) return;
    watchlists = watchlists.map((watchlist) => {
      if (watchlist.id !== selectedWatchlist.id) return watchlist;
      return {
        ...watchlist,
        tickers: watchlist.tickers.map((ticker) =>
          ticker.id === tickerId ? toggleAlert(ticker, alertId) : ticker
        )
      };
    });
    persist();
  };
</script>

<main>
  <section class="hero">
    <h1>TradeDesk Advisor</h1>
    <p>Monitor curated watchlists, track price momentum, and react quickly with threshold alerts.</p>
    <div class="stats">
      <article>
        <span>{watchlists.length}</span>
        <small>Watchlists</small>
      </article>
      <article>
        <span>{watchlists.reduce((sum, list) => sum + list.tickers.length, 0)}</span>
        <small>Tracked Tickers</small>
      </article>
      <article>
        <span>{triggeredCount}</span>
        <small>Triggered Alerts</small>
      </article>
    </div>
  </section>

  <section class="controls">
    <div class="control-group">
      <label for="watchlist">Watchlist</label>
      <select id="watchlist" bind:value={selectedWatchlistId}>
        {#each watchlists as watchlist}
          <option value={watchlist.id}>{watchlist.name}</option>
        {/each}
      </select>
    </div>

    <div class="control-group compact">
      <label for="new-watchlist">New watchlist</label>
      <div class="inline">
        <input id="new-watchlist" bind:value={newWatchlistName} placeholder="e.g. Dividend Focus" />
        <button on:click={createWatchlist}>Create</button>
      </div>
    </div>

    <div class="control-group compact">
      <label for="ticker">Add ticker</label>
      <div class="inline">
        <input id="ticker" bind:value={tickerSymbol} maxlength="6" placeholder="e.g. AMZN" />
        <button on:click={createTicker}>Add</button>
      </div>
    </div>
  </section>

  {#if selectedWatchlist}
    <section class="table-panel">
      <h2>{selectedWatchlist.name}</h2>
      {#if selectedWatchlist.tickers.length === 0}
        <p class="empty">No tickers yet. Add symbols to start tracking this watchlist.</p>
      {:else}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Price</th>
                <th>Daily</th>
                <th>Weekly</th>
                <th>Monthly</th>
                <th>Quarterly</th>
                <th>Yearly</th>
                <th>Alerts</th>
              </tr>
            </thead>
            <tbody>
              {#each selectedWatchlist.tickers as ticker}
                <tr>
                  <td class="symbol">{ticker.symbol}</td>
                  <td>{currency.format(ticker.currentPrice)}</td>
                  <td class:up={ticker.changes.daily >= 0} class:down={ticker.changes.daily < 0}>{signed.format(ticker.changes.daily)}%</td>
                  <td class:up={ticker.changes.weekly >= 0} class:down={ticker.changes.weekly < 0}>{signed.format(ticker.changes.weekly)}%</td>
                  <td class:up={ticker.changes.monthly >= 0} class:down={ticker.changes.monthly < 0}>{signed.format(ticker.changes.monthly)}%</td>
                  <td class:up={ticker.changes.quarterly >= 0} class:down={ticker.changes.quarterly < 0}>{signed.format(ticker.changes.quarterly)}%</td>
                  <td class:up={ticker.changes.yearly >= 0} class:down={ticker.changes.yearly < 0}>{signed.format(ticker.changes.yearly)}%</td>
                  <td>
                    <div class="alerts">
                      {#if ticker.alerts.length === 0}
                        <small>None</small>
                      {:else}
                        {#each ticker.alerts as alert}
                          <div class:triggered={alert.triggered} class="alert-chip">
                            <span>{alert.direction === 'above' ? '↑' : '↓'} {currency.format(alert.threshold)}</span>
                            <button title="toggle" on:click={() => flipAlert(ticker.id, alert.id)}>
                              {alert.enabled ? 'On' : 'Off'}
                            </button>
                            <button title="remove" on:click={() => deleteAlert(ticker.id, alert.id)}>✕</button>
                          </div>
                        {/each}
                      {/if}
                      <div class="inline">
                        <select
                          value={getAlertDraft(ticker.id).direction}
                          on:change={(event) => onAlertDirectionChange(ticker.id, event)}>
                          <option value="above">Above</option>
                          <option value="below">Below</option>
                        </select>
                        <input
                          value={getAlertDraft(ticker.id).threshold}
                          on:input={(event) => onAlertThresholdInput(ticker.id, event)}
                          type="number"
                          min="0.01"
                          step="0.01"
                          placeholder="Price" />
                        <button on:click={() => createAlert(ticker)}>Set</button>
                      </div>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </section>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
    background: linear-gradient(170deg, #f8fafc 0%, #eef2ff 100%);
    color: #0f172a;
  }

  main {
    max-width: 1120px;
    margin: 0 auto;
    padding: 2.5rem 1.2rem 3rem;
    display: grid;
    gap: 1.2rem;
  }

  .hero,
  .controls,
  .table-panel {
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid #dbe2f2;
    border-radius: 16px;
    padding: 1.2rem 1.25rem;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
  }

  .hero h1 {
    margin: 0;
    font-size: 1.85rem;
  }

  .hero p {
    margin: 0.4rem 0 1rem;
    color: #334155;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(120px, 1fr));
    gap: 0.8rem;
  }

  .stats article {
    background: #f8fafc;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    padding: 0.75rem;
  }

  .stats span {
    display: block;
    font-size: 1.3rem;
    font-weight: 700;
  }

  .stats small {
    color: #475569;
  }

  .controls {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 0.85rem;
  }

  .control-group {
    display: grid;
    gap: 0.35rem;
  }

  .inline {
    display: flex;
    gap: 0.45rem;
    align-items: center;
  }

  input,
  select,
  button {
    border-radius: 10px;
    border: 1px solid #cbd5e1;
    padding: 0.48rem 0.62rem;
    font: inherit;
    background: white;
  }

  button {
    cursor: pointer;
    border-color: #a5b4fc;
    background: #4f46e5;
    color: white;
    font-weight: 600;
  }

  .table-panel h2 {
    margin: 0 0 0.75rem;
  }

  .table-wrap {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 1024px;
    font-size: 0.94rem;
  }

  th,
  td {
    padding: 0.6rem;
    border-bottom: 1px solid #e2e8f0;
    text-align: left;
    vertical-align: top;
  }

  th {
    color: #334155;
    font-weight: 700;
    background: #f8fafc;
  }

  .symbol {
    font-weight: 700;
    letter-spacing: 0.02em;
  }

  .up {
    color: #0f766e;
    font-weight: 600;
  }

  .down {
    color: #b91c1c;
    font-weight: 600;
  }

  .alerts {
    display: grid;
    gap: 0.4rem;
    min-width: 240px;
  }

  .alert-chip {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: #eef2ff;
    border: 1px solid #c7d2fe;
    border-radius: 999px;
    padding: 0.2rem 0.45rem;
    width: fit-content;
  }

  .alert-chip button {
    padding: 0.1rem 0.32rem;
    font-size: 0.72rem;
  }

  .alert-chip.triggered {
    background: #dcfce7;
    border-color: #22c55e;
  }

  .empty {
    margin: 0;
    color: #475569;
  }

  @media (max-width: 980px) {
    .controls {
      grid-template-columns: 1fr;
    }

    .stats {
      grid-template-columns: 1fr;
    }
  }
</style>
