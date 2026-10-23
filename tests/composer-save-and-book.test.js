const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../miniprogram');
function setup({ fails = false, navigationFails = false } = {}) {
  const app = { globalData: { suppressClipboardOnce: false, savedComposerText: null } };
  let home;
  const services = { reconcileReminders: rows => rows, getCachedReminders: () => null, getReminders: async () => [], createReminder: async () => { if (fails) throw new Error('offline'); } };
  const wx = { showToast() {}, switchTab(options) { if (navigationFails) options.fail(); else home.onShow(); } };
  const load = file => {
    let definition; const filename = path.join(root, file);
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      Page(value) { definition = value; }, getApp: () => app, wx,
      require(name) { if (name.includes('/services/reminder')) return services; if (name.includes('/utils/notification')) return { requestNotificationPermission: async () => 'authorized' }; return require(path.resolve(path.dirname(filename), name)); }
    }, { filename });
    return { ...definition, data: { ...definition.data }, setData(patch) { Object.assign(this.data, patch); } };
  };
  home = load('pages/index/index.js'); const confirm = load('pages/confirm/confirm.js');
  home.data.text = '  明天提醒我吃饭  '; home.data.parseError = 'old warning'; home.data.clipboardText = home.data.clipboardFullText = 'old clipboard'; home.data.clipboardVisible = true;
  confirm.applyReminder({ text: '明天提醒我吃饭', title: '吃饭', remindAt: '2099-01-02T12:00:00Z' });
  return { app, home, confirm };
}

test('successful creation clears only the submitted composer and its stale preview on home return', async () => {
  const { home, confirm, app } = setup();
  await confirm.onConfirm();
  assert.equal(home.data.text, ''); assert.equal(home.data.parseError, '');
  assert.equal(home.data.clipboardText, ''); assert.equal(home.data.clipboardFullText, ''); assert.equal(home.data.clipboardVisible, false);
  assert.equal(app.globalData.savedComposerText, null, 'success marker is consumed exactly once');
  home.data.text = '明天提醒我吃饭'; home.onShow();
  assert.equal(home.data.text, '明天提醒我吃饭', 'later input of the same words is a new draft');
});

test('cancelled confirmation and failed saves retain the original input', async () => {
  const { home, confirm, app } = setup({ fails: true });
  home.onShow(); assert.equal(home.data.text, '  明天提醒我吃饭  ', 'returning without saving never clears text');
  await confirm.onConfirm(); home.onShow();
  assert.equal(home.data.text, '  明天提醒我吃饭  ');
  assert.equal(app.globalData.savedComposerText, null); assert.equal(confirm.data.isSaving, false);
});

test('navigation failure after a confirmed save still clears on the next manual return', async () => {
  const { home, confirm, app } = setup({ navigationFails: true });
  await confirm.onConfirm(); assert.equal(app.globalData.savedComposerText, '明天提醒我吃饭');
  assert.equal(home.data.text, '  明天提醒我吃饭  ');
  home.onShow(); assert.equal(home.data.text, ''); assert.equal(app.globalData.savedComposerText, null);
});

test('a successful older save cannot erase a different newer draft', async () => {
  const { home, confirm, app } = setup(); home.data.text = '后天提醒我散步';
  await confirm.onConfirm();
  assert.equal(home.data.text, '后天提醒我散步'); assert.equal(app.globalData.savedComposerText, null);
});

test('removing a reminder does not clear an unrelated composer draft', () => {
  const { home, app } = setup(); app.globalData.suppressClipboardOnce = true;
  home.onShow(); assert.equal(home.data.text, '  明天提醒我吃饭  ');
});

test('input and placeholder share typography, line origin and explicit native padding reset', () => {
  const css = fs.readFileSync(path.join(root, 'pages/index/index.wxss'), 'utf8');
  const markup = fs.readFileSync(path.join(root, 'pages/index/index.wxml'), 'utf8');
  assert.match(css, /\.writing-guides\s*\{[^}]*top:32rpx/);
  assert.match(css, /\.composer\s*\{[^}]*padding:32rpx/);
  assert.match(markup, /disable-default-padding="\{\{true\}\}"/);
  assert.match(css, /\.writing-line\s*\{[^}]*height:48rpx/);
  assert.match(css, /\.sentence-input\s*\{[^}]*font-family:inherit;[^}]*font-size:30rpx;\s*line-height:48rpx/);
  assert.match(markup, /placeholder-style="[^"]*font-size:30rpx;\s*line-height:48rpx/);
  assert.equal((markup.match(/class="writing-line"/g) || []).length, 4);
});
