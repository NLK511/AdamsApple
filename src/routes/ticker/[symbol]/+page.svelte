<!--
  Ticker deep-dive view.
  Renders consensus, sentiment, fundamentals, entry plans, and cache controls.
-->
<script lang="ts">
  export let data;

  const updateSelectParam = (kind: 'entry' | 'fundamental' | 'context', event: Event) => {
    const target = event.currentTarget as HTMLSelectElement | null;
    if (!target) return;
    const url = new URL(window.location.href);
    url.searchParams.set(kind, target.value);
    window.location.href = url.toString();
  };

  const setRefreshInterval = (kind: 'refreshAllMs' | 'refreshTargetMs' | 'refreshSentimentMs' | 'refreshFundamentalMs' | 'refreshEntryMs', event: Event) => {
    const target = event.currentTarget as HTMLInputElement | null;
    if (!target) return;
    const url = new URL(window.location.href);
    const value = target.value.trim();
    if (!value) {
      url.searchParams.delete(kind);
    } else {
      url.searchParams.set(kind, value);
    }
    window.location.href = url.toString();
  };
</script>

<svelte:head>
  <title>{data.symbol} · TradeDesk Deep Analysis</title>
</svelte:head>

<main>
  <header class="hero">
    <div>
      <p class="eyebrow">Ticker deep dive</p>
      <h1>{data.symbol}</h1>
      <p>Spot price: <strong>${data.report.currentPrice.toFixed(2)}</strong></p>
      <p class="history">Context: {data.contextName}</p>
      <p class="history">Live providers: market [{data.liveSources.market.join(', ') || 'fallback'}], news [{data.liveSources.news.join(', ') || 'fallback'}]</p>
    </div>
    <a href="/" class="back">← Back to dashboard</a>
  </header>

  <section class="panel controls">
    <div>
      <label for="context-id">Analysis context</label>
      <select id="context-id"
        value={data.contextId}
        on:change={(event) => updateSelectParam('context', event)}>
        {#each data.contexts as context}
          <option value={context.id}>{context.name}</option>
        {/each}
      </select>
    </div>
    <div>
      <label for="fundamental-engine">Fundamental engine</label>
      <select id="fundamental-engine"
        value={data.fundamentalModelId ?? data.fundamentalModels[0].id}
        on:change={(event) => updateSelectParam('fundamental', event)}>
        {#each data.fundamentalModels as model}
          <option value={model.id}>{model.name}</option>
        {/each}
      </select>
    </div>
    <div>
      <label for="entry-engine">Entry-point engine</label>
      <select id="entry-engine"
        value={data.entryModelId ?? data.entryModels[0].id}
        on:change={(event) => updateSelectParam('entry', event)}>
        {#each data.entryModels as model}
          <option value={model.id}>{model.name}</option>
        {/each}
      </select>
    </div>
  </section>

  {#if (data.providerWarnings?.length ?? 0) > 0}
    <section class="panel warning">
      <h2>Provider warnings</h2>
      <ul>
        {#each data.providerWarnings as warning}
          <li>{warning}</li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="panel">
    <h2>Metadata cache settings</h2>
    <p>Global refresh interval: <strong>{data.cache.globalRefreshMs} ms</strong>. Per-metadata ticker intervals override this.</p>
    <div class="controls">
      <div>
        <label for="refresh-all">Global interval (ms)</label>
        <input id="refresh-all" type="number" min="1000" placeholder="e.g. 300000" on:change={(event) => setRefreshInterval('refreshAllMs', event)} />
      </div>
      <div>
        <label for="refresh-target">Target consensus interval (ms)</label>
        <input id="refresh-target" type="number" min="1000" placeholder="e.g. 900000" on:change={(event) => setRefreshInterval('refreshTargetMs', event)} />
      </div>
      <div>
        <label for="refresh-sentiment">Sentiment interval (ms)</label>
        <input id="refresh-sentiment" type="number" min="1000" placeholder="e.g. 3600000" on:change={(event) => setRefreshInterval('refreshSentimentMs', event)} />
      </div>
      <div>
        <label for="refresh-fundamental">Fundamental interval (ms)</label>
        <input id="refresh-fundamental" type="number" min="1000" placeholder="e.g. 86400000" on:change={(event) => setRefreshInterval('refreshFundamentalMs', event)} />
      </div>
      <div>
        <label for="refresh-entry">Entry strategy interval (ms)</label>
        <input id="refresh-entry" type="number" min="1000" placeholder="e.g. 1800000" on:change={(event) => setRefreshInterval('refreshEntryMs', event)} />
      </div>
    </div>
  </section>

  <section class="panel">
    <h2>Target price consensus and analyst breakdown</h2>
    <p>
      Consensus target: <strong>${data.report.targetConsensus.consensusTarget.toFixed(2)}</strong>
      ({data.report.targetConsensus.upsidePercent >= 0 ? '+' : ''}{data.report.targetConsensus.upsidePercent}% vs spot)
    </p>
    <table>
      <thead>
        <tr><th>Analyst</th><th>Target</th><th>Rating</th></tr>
      </thead>
      <tbody>
        {#each data.report.targetConsensus.analysts as analyst}
          <tr>
            <td>{analyst.analyst}</td>
            <td>${analyst.targetPrice.toFixed(2)}</td>
            <td>{analyst.rating.toUpperCase()}</td>
          </tr>
        {/each}
      </tbody>
    </table>
    <p class="history">Target history snapshots: {data.cache.targetHistory.length}</p>
  </section>

  <section class="panel">
    <h2>Sentiment analysis (last week X + Financial Times)</h2>
    <p>Trend: <strong>{data.report.sentiment.trend}</strong> · Score: {data.report.sentiment.score}</p>
    <ul>
      {#each data.report.sentiment.sources as source}
        <li>{source.source}: {source.signal} (confidence {Math.round(source.confidence * 100)}%)</li>
      {/each}
    </ul>
    <p class="history">Sentiment history snapshots: {data.cache.sentimentHistory.length}</p>
  </section>

  <section class="panel">
    <h2>Fundamental analysis summary</h2>
    <p><strong>Model:</strong> {data.report.fundamental.model}</p>
    <p>{data.report.fundamental.summary}</p>
    <p><strong>Valuation note:</strong> {data.report.fundamental.valuationNote}</p>
    <div class="cols">
      <div>
        <h3>Strengths</h3>
        <ul>{#each data.report.fundamental.strengths as item}<li>{item}</li>{/each}</ul>
      </div>
      <div>
        <h3>Risks</h3>
        <ul>{#each data.report.fundamental.risks as item}<li>{item}</li>{/each}</ul>
      </div>
    </div>
    <h3>Model comparison</h3>
    <ul>
      {#each data.report.comparisons.fundamentals as model}
        <li><strong>{model.model}:</strong> {model.summary}</li>
      {/each}
    </ul>
    <p class="history">Fundamental history snapshots: {data.cache.fundamentalHistory.length}</p>
  </section>

  <section class="panel">
    <h2>Buy and Sell entry/exit point</h2>
    <p><strong>Model:</strong> {data.report.entryPlan.model}</p>
    <ul>
      <li>Buy zone: {data.report.entryPlan.buyZone}</li>
      <li>Sell zone: {data.report.entryPlan.sellZone}</li>
      <li>Stop loss: {data.report.entryPlan.stopLoss}</li>
      <li>Take profit: {data.report.entryPlan.takeProfit}</li>
    </ul>
    <h3>Engine comparison</h3>
    <ul>
      {#each data.report.comparisons.entries as plan}
        <li><strong>{plan.model}:</strong> Buy {plan.buyZone}, Sell {plan.sellZone}</li>
      {/each}
    </ul>
    <p class="history">Entry strategy history snapshots: {data.cache.entryHistory.length}</p>
  </section>
</main>

<style>
  :global(body){margin:0;font-family:Inter,system-ui,sans-serif;background:#f8fafc;color:#0f172a}
  main{max-width:1000px;margin:0 auto;padding:1.25rem;display:grid;gap:1rem}
  .panel,.hero{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:1rem}
  .hero{display:flex;justify-content:space-between;align-items:start;gap:1rem}
  .eyebrow{margin:0;color:#64748b;font-size:.8rem;text-transform:uppercase;letter-spacing:.06em}
  h1{margin:.2rem 0}
  h2{margin:.2rem 0 .5rem}
  table{width:100%;border-collapse:collapse}
  th,td{padding:.45rem;border-bottom:1px solid #e2e8f0;text-align:left}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
  .controls{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
  select,input{width:100%;padding:.45rem;border:1px solid #cbd5e1;border-radius:8px}
  .history{margin:.6rem 0 0;color:#64748b;font-size:.9rem}
  .back{color:#4f46e5;text-decoration:none;font-weight:600}
  .warning{border-color:#f59e0b;background:#fffbeb}
  .warning ul{margin:.4rem 0 0;padding-left:1rem;color:#92400e}
  @media (max-width: 780px){.cols,.controls{grid-template-columns:1fr}}
</style>
