const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const markup = fs.readFileSync(path.join(__dirname, '../miniprogram/pages/confirm/confirm.wxml'), 'utf8');
assert.equal((markup.match(/bindtap="openEditor"/g) || []).length, 1);
assert.ok(markup.indexOf('bindtap="openEditor"') < markup.indexOf('class="confirm-card"'));
assert.match(markup, />修改提醒<\/button>/);
assert.match(markup, /disabled="\{\{isSaving\}\}"/);
console.log('PASS single whole-reminder edit entry in page heading');
