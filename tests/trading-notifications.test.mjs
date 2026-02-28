import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const loadTradingModule = async () => {
  const sourcePath = path.join(process.cwd(), 'src/lib/trading.ts');
  const source = readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022
    },
    fileName: 'trading.ts'
  }).outputText;

  const dataUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
  return import(dataUrl);
};

const withMockedRandom = async (value, callback) => {
  const original = Math.random;
  Math.random = () => value;
  try {
    await callback();
  } finally {
    Math.random = original;
  }
};

const baseWatchlist = (alertOverrides = {}) => [{
  id: 'wl-1',
  name: 'Main List',
  tickers: [
    {
      id: 'tk-1',
      symbol: 'AAPL',
      currentPrice: 100,
      changes: {
        daily: 0,
        weekly: 0,
        monthly: 0,
        quarterly: 0,
        yearly: 0
      },
      alerts: [
        {
          id: 'al-1',
          direction: 'above',
          threshold: 100.2,
          enabled: true,
          triggered: false,
          ...alertOverrides
        }
      ]
    }
  ]
}];

test('tickWatchlistsWithNotifications emits notification when alert crosses threshold', async () => {
  const trading = await loadTradingModule();

  await withMockedRandom(1, async () => {
    const result = trading.tickWatchlistsWithNotifications(baseWatchlist(), 1700000000000);

    assert.equal(result.notifications.length, 1);
    assert.equal(result.notifications[0].tickerSymbol, 'AAPL');
    assert.equal(result.notifications[0].watchlistName, 'Main List');
    assert.equal(result.notifications[0].direction, 'above');
    assert.equal(result.notifications[0].read, false);
    assert.equal(result.notifications[0].createdAt, new Date(1700000000000).toISOString());
    assert.equal(result.watchlists[0].tickers[0].alerts[0].triggered, true);
  });
});

test('tickWatchlistsWithNotifications does not duplicate notification for already-triggered alerts', async () => {
  const trading = await loadTradingModule();

  await withMockedRandom(1, async () => {
    const result = trading.tickWatchlistsWithNotifications(baseWatchlist({ triggered: true }), 1700000000000);

    assert.equal(result.notifications.length, 0);
    assert.equal(result.watchlists[0].tickers[0].alerts[0].triggered, true);
  });
});

test('tickWatchlistsWithNotifications supports below-threshold notifications', async () => {
  const trading = await loadTradingModule();

  const watchlists = baseWatchlist({
    direction: 'below',
    threshold: 99.8,
    triggered: false
  });

  await withMockedRandom(0, async () => {
    const result = trading.tickWatchlistsWithNotifications(watchlists, 1700000000000);

    assert.equal(result.notifications.length, 1);
    assert.equal(result.notifications[0].direction, 'below');
    assert.equal(result.watchlists[0].tickers[0].alerts[0].triggered, true);
  });
});

test('notification read helpers mark entries as read and compute unread count', async () => {
  const trading = await loadTradingModule();

  const notifications = [
    { id: 'n1', read: false },
    { id: 'n2', read: true },
    { id: 'n3', read: false }
  ];

  assert.equal(trading.unreadNotificationCount(notifications), 2);

  const oneRead = trading.markNotificationRead(notifications, 'n1');
  assert.equal(trading.unreadNotificationCount(oneRead), 1);
  assert.equal(oneRead[0].read, true);

  const allRead = trading.markAllNotificationsRead(oneRead);
  assert.equal(trading.unreadNotificationCount(allRead), 0);
  assert.ok(allRead.every((entry) => entry.read));
});
