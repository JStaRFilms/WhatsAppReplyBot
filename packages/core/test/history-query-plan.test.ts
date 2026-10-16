import test from 'node:test';
import assert from 'node:assert/strict';
import { SqliteStore } from '../src/store.ts';
import { chat, message } from './fixtures.ts';

const phone = '15550000001@s.whatsapp.net', lid = '123@lid';
test('limited member history uses the existing paging index without a pre-limit sort', t => {
  const store = new SqliteStore();
  try {
    store.saveConversation(chat(phone)); store.saveConversation({ ...chat(lid), kind: 'unknown' });
    store.saveWaAlias('a', lid, phone);
    for (let i = 0; i < 80; i++) store.saveMessage({ ...message('row-'+String(i).padStart(3, '0'), i % 2 ? lid : phone), occurredAt: Math.floor(i / 3) });
    const db = store['db']; const prepare = db.prepare.bind(db); const plans: string[][] = [];
    t.mock.method(db, 'prepare', (sql: string) => {
      if (sql.startsWith('SELECT result.payload')) {
        const plan = prepare('EXPLAIN QUERY PLAN '+sql).all(...Array.from({ length: sql.split('?').length-1 }, () => null));
        plans.push(plan.map(row => String(row.detail)));
      }
      return prepare(sql);
    });
    const latest = store.historyPage('a', phone, { limit: 5 });
    assert.deepEqual(latest.messages.map(m => m.id), ['row-075', 'row-076', 'row-077', 'row-078', 'row-079']);
    assert.ok(latest.beforeCursor);
    const before = store.historyPage('a', phone, { limit: 5, before: latest.beforeCursor });
    assert.ok(before.afterCursor);
    assert.deepEqual(store.historyPage('a', phone, { limit: 5, after: before.afterCursor }).messages, latest.messages);
    assert.ok(store.historyPage('a', phone, { limit: 5, around: 'row-040' }).messages.some(m => m.id === 'row-040'));
    store.contextMessages('a', phone);
    assert.ok(plans.length > 10, 'exercise latest, before, after, around, inbound and style scans');
    for (const plan of plans) {
      assert.ok(plan.some(detail => /SEARCH m USING INDEX message_paging/.test(detail)), plan.join('\n'));
      assert.equal(plan.filter(detail => /USE TEMP B-TREE FOR ORDER BY/.test(detail)).length, 1,
        'only the bounded merge across members may sort\n'+plan.join('\n'));
    }
  } finally { store.close(); }
});

test('indexed limits retain earliest physical alias representatives across rowid fences and tied times', () => {
  const store = new SqliteStore();
  try {
    store.saveConversation(chat(phone)); store.saveConversation({ ...chat(lid), kind: 'unknown' });
    store.saveWaAlias('a', lid, phone);
    store.saveMessage({ ...message('first', lid), transportId: 'duplicate', occurredAt: 10 });
    store.saveMessage({ ...message('copy', phone), transportId: 'duplicate', occurredAt: 10 });
    store.saveMessage({ ...message('tie-a', phone), occurredAt: 10 });
    store.saveMessage({ ...message('tie-b', lid), occurredAt: 10 });
    const db = store['db'];
    const bound = db.prepare('SELECT MAX(rowid) AS fence FROM messages').get()?.fence;
    assert.equal(typeof bound, 'number'); if (typeof bound !== 'number') return;
    store.saveMessage({ ...message('late-old', phone), occurredAt: 1 });
    store.saveMessage({ ...message('late-tie', lid), occurredAt: 10 });
    const members = [phone, lid];
    const rows = (limit: number, edge?: { at: number; id: string; direction: 'before' | 'after' }) =>
      store['historyRows']('a', members, bound, limit, edge).map(m => m.id);
    assert.deepEqual(rows(2), ['tie-b', 'tie-a']);
    assert.deepEqual(rows(5), ['tie-b', 'tie-a', 'first']);
    assert.deepEqual(rows(5, { at: 10, id: 'tie-a', direction: 'before' }), ['first']);
    assert.deepEqual(rows(5, { at: 10, id: 'first', direction: 'after' }), ['tie-a', 'tie-b']);
    assert.deepEqual(store['historyRows']('b', members, bound, 5), []);
  } finally { store.close(); }
});
