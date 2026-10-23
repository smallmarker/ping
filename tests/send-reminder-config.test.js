const assert = require('node:assert/strict');
const config = require('../cloudfunctions/sendReminder/config.json');

assert.deepEqual(config.permissions.openapi, ['subscribeMessage.send']);
assert.equal(config.triggers.length, 1);
assert.deepEqual(config.triggers[0], {
  name: 'pingReminderEveryMinute',
  type: 'timer',
  config: '0 * * * * * *'
});
console.log('PASS notification permission and timer deployment config');
