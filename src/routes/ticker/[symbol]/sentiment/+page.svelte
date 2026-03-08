<script lang="ts">
  export let data;
</script>

<svelte:head>
  <title>{data.symbol} sentiment rationale</title>
</svelte:head>

<main>
  <header class="hero">
    <div>
      <p class="eyebrow">Sentiment rationale</p>
      <h1>{data.symbol}</h1>
      <p class="history">Context: {data.contextName}</p>
      <p class="history">Providers: news [{data.providers.news}], social [{data.providers.social}]</p>
    </div>
    <a href="/" class="back">← Back to dashboard</a>
  </header>

  <section class="panel" id="news">
    <h2>News sentiment score: {data.news.score}</h2>
    <p>{data.news.rationale}</p>
    {#if data.news.signals.length === 0}
      <p class="empty">No news signals available.</p>
    {:else}
      <ul>
        {#each data.news.signals as row}
          <li>
            <strong>{row.source}</strong> · confidence {Math.round(row.confidence * 100)}% · raw {row.rawScore} · weighted {row.weightedContribution.toFixed(2)}
            <p>{row.signal}</p>
            <small>positive tokens: {row.positiveMatches.join(', ') || 'none'} · negative tokens: {row.negativeMatches.join(', ') || 'none'}</small>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <section class="panel" id="social">
    <h2>Social sentiment score: {data.social.score}</h2>
    <p>{data.social.rationale}</p>
    {#if data.social.signals.length === 0}
      <p class="empty">No social signals available.</p>
    {:else}
      <ul>
        {#each data.social.signals as row}
          <li>
            <strong>{row.source}</strong> · confidence {Math.round(row.confidence * 100)}% · raw {row.rawScore} · weighted {row.weightedContribution.toFixed(2)}
            <p>{row.signal}</p>
            <small>positive tokens: {row.positiveMatches.join(', ') || 'none'} · negative tokens: {row.negativeMatches.join(', ') || 'none'}</small>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</main>

<style>
  :global(body){margin:0;font-family:Inter,system-ui,sans-serif;background:#f8fafc;color:#0f172a}
  main{max-width:1000px;margin:0 auto;padding:1.25rem;display:grid;gap:1rem}
  .panel,.hero{background:white;border:1px solid #e2e8f0;border-radius:14px;padding:1rem}
  .hero{display:flex;justify-content:space-between;align-items:start;gap:1rem}
  .eyebrow{margin:0;color:#64748b;font-size:.8rem;text-transform:uppercase;letter-spacing:.06em}
  .history{margin:.3rem 0;color:#64748b;font-size:.9rem}
  ul{margin:.6rem 0 0;padding-left:1rem;display:grid;gap:.75rem}
  li p{margin:.35rem 0}
  .empty{color:#64748b}
  .back{color:#4f46e5;text-decoration:none;font-weight:600}
</style>
