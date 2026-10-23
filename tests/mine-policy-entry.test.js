const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const markup = fs.readFileSync(path.join(__dirname, '../miniprogram/pages/mine/mine.wxml'), 'utf8');
assert.doesNotMatch(markup, /用户协议/);
assert.match(markup, /隐私政策/);
assert.match(markup, /bindtap="goAbout"/);
console.log('PASS remove optional empty agreement entry, preserve privacy and about');
