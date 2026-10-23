const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('mine feedback card directly opens native feedback without a custom form or fake success', () => {
  const markup = read('miniprogram/pages/mine/mine.wxml');
  const button = markup.match(/<button\b[^>]*class="co-create"[^>]*>[\s\S]*?<\/button>/)?.[0];
  assert.ok(button);
  assert.match(button, /open-type="feedback"/);
  assert.match(button, /aria-label="意见反馈/);
  assert.match(button, /一起把 Ping 变得更好/);
  assert.match(button, /有一个你希望它记住的新场景吗？/);
  assert.doesNotMatch(button, /bindtap|bindgetuserinfo|bindcontact|bindsuccess/);
  for (const extension of ['js', 'ts']) {
    assert.doesNotMatch(read(`miniprogram/pages/mine/mine.${extension}`), /goFeedback|submitFeedback|pages\/feedback/);
  }
  assert.ok(!JSON.parse(read('miniprogram/app.json')).pages.includes('pages/feedback/feedback'));
});

test('native feedback keeps card layout and documents legacy data without claiming new retention', () => {
  const css = read('miniprogram/pages/mine/mine.wxss');
  assert.match(css, /\.co-create\s*\{[^}]*background:#f4f0fa/);
  assert.match(css, /\.mine-page \.co-create\s*\{[^}]*width:100%[^}]*font-family:inherit[^}]*font-weight:400[^}]*line-height:normal[^}]*text-align:left/);
  assert.match(css, /\.co-create::after\s*\{\s*border:0/);
  assert.match(css, /\.co-create-pressed/);
  const privacy = read('miniprogram/pages/privacy/privacy.wxml');
  assert.match(privacy, /通过微信公众平台查看和处理/);
  assert.match(privacy, /不再将反馈正文写入 Ping 自建反馈数据库/);
  assert.match(privacy, /没有到期时间的更早历史反馈不自动批量清理/);
  assert.match(privacy, /不适用自建数据库的 180 天清理任务/);
  assert.ok(fs.existsSync(path.join(__dirname, '../cloudfunctions/submitFeedback/index.js')));
  assert.ok(fs.existsSync(path.join(__dirname, '../cloudfunctions/privacyMaintenance/index.js')));
});
