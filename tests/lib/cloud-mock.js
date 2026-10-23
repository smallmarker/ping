const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const scalar = value => value instanceof Date ? value.getTime() : value;
const condition = (actual, expected) => {
  if (!expected?.op) return scalar(actual) === scalar(expected);
  const a = scalar(actual); const b = scalar(expected.value);
  if (expected.op === 'and') return expected.conditions.every(item => condition(actual, item));
  if (expected.op === 'exists') return (actual !== undefined) === expected.value;
  if (expected.op === 'in') return expected.value.includes(actual);
  if (expected.op === 'neq') return a !== b;
  if (actual === undefined) return false;
  return expected.op === 'lt' ? a < b : expected.op === 'lte' ? a <= b : expected.op === 'gt' ? a > b : expected.op === 'gte' ? a >= b : false;
};
const matches = (row, query) => query.op === 'and' ? query.conditions.every(item => matches(row, item)) : query.op === 'or' ? query.conditions.some(item => matches(row, item)) : Object.entries(query).every(([key, value]) => condition(row[key], value));
exports.fixture = () => {
  const rows = { reminders: [], feedback: [] }; const sent = []; let serial = 0;
  const state = { owner: 'owner', source: 'wx_trigger', beforeUpdate: null, beforeGet: null, beforeRemove: null, send: null, now: null, calls: { get: 0, update: 0, remove: 0 } };
  const command = { and: conditions => ({ op: 'and', conditions }), or: conditions => ({ op: 'or', conditions }), remove: () => ({ op: 'remove' }) };
  for (const op of ['lt', 'lte', 'gt', 'gte', 'neq', 'exists', 'in']) command[op] = value => ({ op, value });
  const db = { command, serverDate: () => new Date(), createCollection: async () => ({}), collection: name => ({
    async add({ data }) { const id = data._id || `id-${++serial}`; if (rows[name].some(row => row._id === id)) throw new Error('duplicate ID'); rows[name].push({ ...data, _id: id }); return { _id: id }; },
    where(query) {
      const orders = []; let count = Infinity;
      const selected = () => rows[name].filter(row => matches(row, query)).sort((a, b) => {
        for (const [key, direction] of orders) { const x = scalar(a[key]); const y = scalar(b[key]); const result = x === y ? 0 : x < y ? -1 : 1; if (result) return result * (direction === 'desc' ? -1 : 1); } return 0;
      }).slice(0, count);
      const chain = {
        orderBy(key, direction) { orders.push([key, direction]); return chain; }, limit(value) { count = value; return chain; },
        async get() { state.calls.get++; if (state.beforeGet) await state.beforeGet(name); return { data: selected().map(row => ({ ...row })) }; },
        async count() { return { total: selected().length }; },
        async update({ data }) {
          state.calls.update++;
          if (state.beforeUpdate) await state.beforeUpdate(name, query, data);
          const current = selected();
          for (const row of current) for (const [key, value] of Object.entries(data)) { if (value?.op === 'remove') delete row[key]; else row[key] = value; }
          return { stats: { updated: current.length } };
        },
        async remove() { state.calls.remove++; if (state.beforeRemove) await state.beforeRemove(name); const current = selected(); rows[name] = rows[name].filter(row => !current.includes(row)); return { stats: { removed: current.length } }; }
      }; return chain;
    }
  }) };
  const cloud = { init() {}, DYNAMIC_CURRENT_ENV: 'mock', database: () => db, getWXContext: () => ({ OPENID: state.owner, SOURCE: state.source }), openapi: { subscribeMessage: { async send(message) { sent.push(message); if (state.send) await state.send(message); } } } };
  const load = name => {
    const filename = path.join(__dirname, '../../cloudfunctions', name, 'index.js'); const exports = {};
    class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [state.now ?? Date.now()])); } static now() { return state.now ?? Date.now(); } }
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { exports, require: module => module === 'wx-server-sdk' ? cloud : require(module), Date: ClockDate, Buffer, process, console, Set, Number, String, Intl, setTimeout, clearTimeout }, { filename });
    return exports.main;
  };
  return { rows, state, sent, load };
};
