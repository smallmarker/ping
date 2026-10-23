const test = require('node:test');
const assert = require('node:assert/strict');
const { orderReminderBook } = require('../miniprogram/utils/reminder-book-order');

test('book is creation-ascending and does not mutate home-list order', () => {
  const rows = [
    { _id: 'new', createdAt: '2026-10-15T08:00:00Z', remindAt: '2026-10-15T09:00:00Z' },
    { _id: 'old', createdAt: '2026-10-14T08:00:00Z', remindAt: '2099-01-01T00:00:00Z' },
    { _id: 'deleted', createdAt: '2026-10-16T08:00:00Z', status: 'deleted' }
  ];
  assert.deepEqual(orderReminderBook(rows).map(item => item._id), ['old', 'new']);
  assert.deepEqual(rows.map(item => item._id), ['new', 'old', 'deleted']);
  rows[0].remindAt = '2100-01-01T00:00:00Z';
  assert.deepEqual(orderReminderBook(rows).map(item => item._id), ['old', 'new'], 'editing scheduled time cannot relocate a page');
});

test('equal/missing/invalid creation times have deterministic ID order', () => {
  const rows = [{ _id: 'z', createdAt: '2026-10-15' }, { _id: 'missing' }, { _id: 'invalid', createdAt: 'invalid' }, { _id: 'a', createdAt: '2026-10-15' }];
  const expected = ['invalid', 'missing', 'a', 'z'];
  assert.deepEqual(orderReminderBook(rows).map(item => item._id), expected);
  assert.deepEqual(orderReminderBook(rows.slice().reverse()).map(item => item._id), expected);
  assert.deepEqual(orderReminderBook([]), []);
});
