const assert = require('node:assert/strict');
const path = require('node:path');

const notificationPath = path.join(__dirname, '..', 'miniprogram/utils/notification.js');
const originalWx = global.wx;
const { requestNotificationPermission } = require(notificationPath);
const templateId = 'HtgkJMyjVsj_7LwYSBDY5KtpseqrA8hh5cTBHuEojTI';

(async () => {
  try {
    let calls = 0;
    global.wx = { requestSubscribeMessage(options) {
      calls += 1;
      assert.deepEqual(options.tmplIds, [templateId]);
      options.success({ [templateId]: 'accept' });
    } };
    assert.equal(await requestNotificationPermission(), 'authorized');
    assert.equal(calls, 1);

    global.wx.requestSubscribeMessage = (options) => options.success({ [templateId]: 'reject' });
    assert.equal(await requestNotificationPermission(), 'denied');

    global.wx.requestSubscribeMessage = (options) => options.fail({ errMsg: 'requestSubscribeMessage:fail' });
    assert.equal(await requestNotificationPermission(), 'denied');

    global.wx.requestSubscribeMessage = undefined;
    assert.equal(await requestNotificationPermission(), null);
    console.log('PASS notification permission template and outcomes');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    global.wx = originalWx;
  }
})();
