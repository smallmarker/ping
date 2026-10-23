// 无网络、无模型依赖的时间解析。只删除已确认的时间片段，无法消歧时返回手动草稿。
const NUM = '(?:\\d+(?:\\.\\d+)?|[零〇一二两三四五六七八九十百千]+)';
const PERIOD = '凌晨|早上|早晨|上午|中午|下午|傍晚|晚上|夜里|今晚|明早|明晚';
const MINUTE = 60000;
const DAY = 86400000;
const MAX_MINUTES = 525600;
const parts = date => {
  const value = new Date(date.getTime() + 8 * 60 * MINUTE);
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate(), weekday: value.getUTCDay() || 7 };
};
const at = (date, hour = 0, minute = 0) => new Date(Date.UTC(date.year, date.month - 1, date.day, hour - 8, minute));
const shift = (date, days) => parts(new Date(at(date).getTime() + days * DAY));
const validDate = date => {
  const actual = parts(at(date));
  return date.year >= 100 && date.year <= 9999 && actual.year === date.year && actual.month === date.month && actual.day === date.day;
};
const normalize = text => text.replace(/[０-９]/g, char => String(char.charCodeAt(0) - 0xff10)).replace(/[：﹕]/g, ':').replace(/．/g, '.');
const number = text => {
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
  const digits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (/^[零〇一二两三四五六七八九]+$/.test(text)) return Number([...text].map(char => digits[char]).join(''));
  let total = 0; let digit = 0; let previousUnit = Infinity;
  for (const char of text) {
    if (char in digits) { digit = digits[char]; continue; }
    const unit = { 十: 10, 百: 100, 千: 1000 }[char];
    if (!unit || unit >= previousUnit) return NaN;
    total += (digit || 1) * unit; digit = 0; previousUnit = unit;
  }
  return total + digit;
};
const token = (match, data = {}) => ({ start: match.index, end: match.index + match[0].length, raw: match[0], ...data });
const overlap = (a, b) => a.start < b.end && b.start < a.end;
const uniqueTokens = tokens => {
  const selected = [];
  for (const item of tokens.sort((a, b) => (b.end - b.start) - (a.end - a.start))) {
    if (!selected.some(other => overlap(item, other))) selected.push(item);
  }
  return selected.sort((a, b) => a.start - b.start);
};
const removeSpans = (text, spans) => text.split('').map((char, index) => spans.some(span => index >= span.start && index < span.end) ? '' : char).join('');
const titleFrom = (text, spans) => removeSpans(text, spans)
  .replace(/(?:请)?提醒我(?:一下)?|请提醒|记得提醒我|帮我记一下/g, '')
  .replace(/^[\s，,。:：；;！!]*(?:请|麻烦|帮我|等会儿?|一会儿?|待会儿?|到时候|在|到)\s*/g, '')
  .replace(/^[\s，,。:：；;！!]+|[\s，,。:：；;！!]+$/g, '').trim().slice(0, 60);
const manual = (text, warning) => ({ title: text.slice(0, 60), remindAt: null, remindOffsetMinutes: 0, location: '', note: '', confidence: 0, missingFields: ['date', 'time'], rawTimeText: '', timePrecision: 'unknown', parseWarnings: [warning] });

function durations(text) {
  const re = new RegExp(`(${NUM}|半)(?:\\s*个)?(半)?\\s*(分钟|小时|钟头|分|天|周|星期)(半)?`, 'g');
  const units = { 分钟: 1, 分: 1, 小时: 60, 钟头: 60, 天: 1440, 周: 10080, 星期: 10080 };
  const items = [];
  for (const match of text.matchAll(re)) {
    const value = match[1] === '半' ? 0.5 : number(match[1]);
    items.push(token(match, { minutes: (value + (match[2] || match[4] ? 0.5 : 0)) * units[match[3]], calendar: /天|周|星期/.test(match[3]) }));
  }
  const combined = [];
  for (const item of items) {
    const previous = combined.at(-1);
    if (previous && /^[\s零又]*$/.test(text.slice(previous.end, item.start))) {
      previous.end = item.end; previous.raw = text.slice(previous.start, item.end); previous.minutes += item.minutes; previous.calendar ||= item.calendar;
    } else combined.push({ ...item });
  }
  return combined.map(item => {
    const before = text.slice(0, item.start);
    const after = text.slice(item.end);
    const prefix = before.match(/提前\s*$|前\s*$|(?:再)?过\s*$/);
    const suffix = after.match(/^\s*(以后|之后|后|以前|之前|前)/);
    const kind = /^(?:提前|前)$/.test(prefix?.[0].trim() || '') || /以前|之前|前/.test(suffix?.[1] || '') ? 'offset' : suffix || prefix ? 'relative' : 'unbound';
    const start = prefix ? item.start - prefix[0].length : item.start;
    const end = suffix ? item.end + suffix[0].length : item.end;
    const badBoundary = /[\d.负-]$/.test(text.slice(0, item.start)) || /[零〇一二两三四五六七八九十百千]$/.test(text.slice(0, item.start));
    return { ...item, start, end, raw: text.slice(start, end), kind, invalid: badBoundary || !Number.isFinite(item.minutes) || item.minutes < 0 || item.minutes > MAX_MINUTES || !Number.isInteger(item.minutes) };
  });
}

function clocks(text, durationTokens) {
  const tokens = [];
  const re = new RegExp(`(?:(${PERIOD})\\s*)?(?:((?:\\d{1,3}))\\s*:\\s*(\\d{1,3})(?!\\d)|(${NUM})\\s*(?:点|时)(?:\\s*(半|一刻|三刻|${NUM})\\s*分?)?)`, 'g');
  for (const match of text.matchAll(re)) {
    let item = token(match, { period: match[1] || '', hour: number(match[2] || match[4]), minute: match[3] ? number(match[3]) : match[5] ? ({ 半: 30, 一刻: 15, 三刻: 45 }[match[5]] ?? number(match[5])) : 0, colon: !!match[2], precise: !!(match[3] || match[5]) });
    const overlappingDuration = durationTokens.find(other => other.kind !== 'unbound' && overlap(item, other));
    if (overlappingDuration) {
      // “三点55分后”不能丢掉“三点”后当成“55分钟后”。
      if (item.start < overlappingDuration.start) tokens.push({ ...item, invalid: true });
      continue;
    }
    const before = text.slice(0, item.start);
    const after = text.slice(item.end);
    // “三点五升”“两点五倍”是数量；不要当成时间，也不要截取数字尾部。
    if (/^\s*(?:升|毫升|公斤|千克|克|米|厘米|元|块|倍|成|度|万|亿)/.test(after)) continue;
    const subtract = before.match(new RegExp(`差\\s*(${NUM})\\s*分(?:钟)?\\s*$`));
    if (subtract) {
      item.start -= subtract[0].length; item.subtract = number(subtract[1]); item.precise = true;
      const period = text.slice(0, item.start).match(new RegExp(`(${PERIOD})\\s*$`));
      if (period) { item.period = period[1]; item.start -= period[0].length; }
      item.raw = text.slice(item.start, item.end);
    }
    item.invalid = /[\d.负-]$/.test(text.slice(0, item.start)) || !Number.isInteger(item.hour) || !Number.isInteger(item.minute) || item.hour < 0 || item.hour > 23 || item.minute < 0 || item.minute > 59 || (item.subtract !== undefined && (!Number.isInteger(item.subtract) || item.subtract < 1 || item.subtract > 59));
    if (/^\s*(?:秒|:|多|左右|前后|之前|之后|am\b|pm\b)/i.test(after)) item.invalid = true;
    tokens.push(item);
  }
  return tokens;
}

function dates(text, current) {
  const tokens = [];
  const collect = (re, convert) => { for (const match of text.matchAll(re)) tokens.push(token(match, convert(match))); };
  collect(/(?:(\d{4})\s*年\s*)?(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/g, match => ({ date: { year: Number(match[1] || current.year), month: Number(match[2]), day: Number(match[3]) }, annual: !match[1] }));
  collect(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/g, match => ({ date: { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } }));
  collect(/(?<![\d/-])(\d{1,2})[-/](\d{1,2})(?![\d/-])/g, match => ({ date: { year: current.year, month: Number(match[1]), day: Number(match[2]) }, annual: true }));
  collect(new RegExp(`(?:(下下|下|本|这|上)个月\\s*)?(${NUM})\\s*[日号]`, 'g'), match => {
    const monthDelta = { 下下: 2, 下: 1, 本: 0, 这: 0, 上: -1 }[match[1]] || 0;
    const month = parts(at({ year: current.year, month: current.month + monthDelta, day: 1 }));
    return { date: { year: month.year, month: month.month, day: number(match[2]) }, monthly: !match[1] };
  });
  collect(/大后天|后天|明天|今天|今日|明早|明晚|今晚|昨晚|昨天|前天/g, match => ({ date: shift(current, { 大后天: 3, 后天: 2, 明天: 1, 明早: 1, 明晚: 1, 昨晚: -1, 昨天: -1, 前天: -2 }[match[0]] || 0) }));
  collect(/(下下|下|本|这|上)?(?:周|星期|礼拜)([一二三四五六日天])/g, match => {
    const weekday = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7 }[match[2]];
    const weekDelta = { 下下: 2, 下: 1, 本: 0, 这: 0, 上: -1 }[match[1]] || 0;
    return { date: shift(current, weekday - current.weekday + weekDelta * 7), weekday, nearestWeek: !match[1] };
  });
  return uniqueTokens(tokens);
}

function resolveHour(clock) {
  let hour = clock.hour; let nextDay = 0; const period = clock.period;
  if (/凌晨|早上|早晨|上午|明早/.test(period)) {
    if (hour > 12 || (/凌晨/.test(period) && hour > 6 && hour !== 12)) return null;
    if (/凌晨/.test(period) && hour === 12) hour = 0;
  } else if (/下午|傍晚|晚上|夜里|今晚|明晚/.test(period)) {
    if (hour === 0 && /下午|傍晚/.test(period)) return null;
    if ([0, 12].includes(hour) && /晚上|夜里|今晚|明晚/.test(period)) { hour = 0; nextDay = 1; }
    else if (hour < 6 && /晚上|夜里|今晚|明晚/.test(period)) return null;
    else if (hour < 12) hour += 12;
    if (hour < 12 && !nextDay) return null;
  } else if (/中午/.test(period)) {
    if (hour === 0) return null;
    if (hour < 11) hour += 12;
    if (hour > 14) return null;
  }
  return { hour, nextDay };
}

function parseText(original, now = new Date()) {
  const text = normalize(original); const current = parts(now); const warnings = []; const spans = [];
  const durationTokens = durations(text);
  const clockTokens = clocks(text, durationTokens);
  const dateTokens = dates(text, current);
  if (dateTokens.some(date => clockTokens.some(clock => overlap(date, clock) && !(date.raw === clock.period && /明早|明晚|今晚/.test(date.raw))))) return manual(original, '星期与钟点表达有歧义，请写明具体时间');
  if (/(?:每(?:天|日|周|星期|月|年)|工作日|周末)(?:\s*(?:的)?\s*(?:凌晨|上午|下午|晚上)?\s*[零〇一二两三四五六七八九十\d]|\s*(?:提醒|定时))/.test(text)) return manual(original, '重复提醒暂不支持，请选择一次提醒的具体日期和时间');
  if (new RegExp(`每(?:隔)?\\s*${NUM}\\s*(?:分钟|小时|天|周|月|年)`).test(text)) return manual(original, '重复提醒暂不支持，请选择一次提醒的具体日期和时间');
  if (durationTokens.some(item => item.invalid && item.kind !== 'unbound') || clockTokens.some(item => item.invalid)) return manual(original, '时间格式或时长不合法，请手动确认');
  const offsets = durationTokens.filter(item => item.kind === 'offset');
  const relatives = durationTokens.filter(item => item.kind === 'relative');
  const onTime = text.match(/不提前|准时提醒/g);
  if (offsets.length > 1 || relatives.length > 1 || (offsets.length && onTime)) return manual(original, '识别到多个提醒时间或提前量，请手动确认');
  const offset = offsets[0]?.minutes || 0;
  if (/提前/.test(removeSpans(text, offsets).replace(/不提前/g, ''))) return manual(original, '提前时间还不明确，请选择具体提前量');
  spans.push(...offsets);
  if (onTime) for (const match of text.matchAll(/不提前|准时(?=提醒)/g)) spans.push(token(match));
  let clock = clockTokens[0];
  if (clockTokens.length > 1) {
    const final = clockTokens.at(-1);
    const between = text.slice(clockTokens.at(-2).end, final.start);
    if (!/改成|改为|改到|换成|而是/.test(between) || /或者|或是|还是/.test(text)) return manual(original, '这句有多个时间，请拆成一条提醒或手动选择');
    clock = final;
    if (!clock.period) clock = { ...clock, period: clockTokens.at(-2).period };
    const negation = text.slice(0, clockTokens[0].start).match(/不是\s*$/);
    spans.push({ start: clockTokens[0].start - (negation?.[0].length || 0), end: final.end });
    warnings.push('已按最后修改的时间理解，请确认');
  }
  if (clockTokens.length === 1 && (/(?:不要|别|不在|不是|取消|不用)\s*$/.test(text.slice(0, clock.start)) || /^\s*(?:不要|别|取消|不用)提醒/.test(text.slice(clock.end)))) return manual(original, '这句包含取消或否定，请确认要设置的时间');
  const boundDates = dateTokens.filter(item => {
    const anchor = clock?.start ?? relatives[0]?.start ?? text.length;
    if (item.start > anchor) return /^\s*[，,]?\s*$/.test(text.slice(clock?.end ?? anchor, item.start));
    const between = text.slice(item.end, anchor);
    return !/的|检查|整理|查看|买|准备/.test(between);
  });
  if (boundDates.length > 1 && !boundDates.every(item => at(item.date).getTime() === at(boundDates[0].date).getTime())) return manual(original, '日期表达不一致，请手动确认');
  let chosenDate = boundDates[0];
  if (relatives.length) {
    const relative = relatives[0];
    if (relative.minutes <= 0) return manual(original, '提醒时间需晚于现在，请选择未来时间');
    if (relative.calendar && Number.isInteger(relative.minutes / 1440) && clock && !chosenDate) {
      chosenDate = { ...relative, date: shift(current, relative.minutes / 1440) }; spans.push(relative);
    } else {
      if (clock || chosenDate) return manual(original, '相对时长与具体时间同时出现，请确认以哪个时间为准');
      const remindAt = new Date(Math.ceil((now.getTime() + relative.minutes * MINUTE) / MINUTE) * MINUTE);
      return finish(remindAt, relative, [...spans, relative], offset);
    }
  }
  if (!clock) return manual(original, '未识别到具体时间，请手动选择');
  const beforeClock = text.slice(0, clock.start);
  if (/差\s*[^，,。；;]*$/.test(beforeClock) && clock.subtract === undefined) return manual(original, '这句的时间需要手动确认');
  const prefix = removeSpans(beforeClock, boundDates);
  if (/农历|阴历|月底|月末|月初|年后|明年|后年|春节|中秋|国庆|端午|元旦|除夕|\d{4}年|\d+[/-]\d+|[一二三四五六七八九十]+月|下个月|下周|本周|明天|后天|今天|昨天|前天/.test(prefix)) return manual(original, '这句的日期还需确认，请选择具体日期');
  if (chosenDate && !validDate(chosenDate.date)) return manual(original, '日期不合法，请手动选择');
  const resolved = resolveHour(clock);
  if (!resolved) return manual(original, '时段与钟点不一致，请手动确认');
  let date = chosenDate ? { ...chosenDate.date } : { ...current };
  const dayDelta = resolved.nextDay;
  if (chosenDate?.annual && at(date, 23, 59) < now) { date.year += 1; warnings.push('该日期今年已过，已按下一年理解，请确认'); }
  if (chosenDate?.monthly && at(date, 23, 59) < now) {
    const next = parts(at({ year: date.year, month: date.month + 1, day: 1 })); date = { ...next, day: date.day }; warnings.push('本月该日期已过，已按下个月理解，请确认');
  }
  if (!validDate(date)) return manual(original, '日期不合法，请手动选择');
  const ambiguous = !clock.colon && !clock.period && clock.hour >= 1 && clock.hour <= 12;
  const hours = ambiguous ? [clock.hour % 12, clock.hour % 12 + 12] : [resolved.hour];
  const buildCandidates = value => hours.map(hour => new Date(at(shift(value, dayDelta), hour, clock.minute).getTime() - (clock.subtract || 0) * MINUTE));
  let candidates = buildCandidates(date);
  if (!chosenDate) candidates.push(...buildCandidates(shift(date, 1)));
  if (chosenDate?.nearestWeek && candidates.every(value => value.getTime() <= now.getTime())) {
    date = shift(date, 7); candidates = buildCandidates(date); warnings.push('本周该时间已过，已按下周理解，请确认');
  }
  const remindAt = candidates.filter(value => value.getTime() > now.getTime()).sort((a, b) => a - b)[0];
  if (!remindAt) return manual(original, offset ? '提前提醒的时间已过去，请修改时间或提前量' : '指定时间已过去，请重新选择未来的日期和时间');
  if (ambiguous) warnings.push('未指定上午或下午，已按最近可用的未来时间理解，请确认');
  if (dayDelta) warnings.push('晚上十二点已按当晚结束后的零点理解，请确认日期');
  if (!chosenDate && parts(remindAt).day !== current.day) warnings.push('今天该时间已过，已按明天理解，请确认');
  spans.push(clock, ...boundDates);
  return finish(remindAt, clock, spans, offset);

  function finish(remindAt, time, remove, remindOffsetMinutes) {
    if (remindAt.getTime() - remindOffsetMinutes * MINUTE <= now.getTime()) return manual(original, '提前提醒的时间已过去，请修改时间或提前量');
    const title = titleFrom(text, remove);
    if (!title) return manual(original, '请补充需要提醒的事项');
    return { title, remindAt: remindAt.toISOString(), remindOffsetMinutes, location: '', note: '', confidence: warnings.length ? 0.55 : 0.8, missingFields: [], rawTimeText: time.raw.trim(), timePrecision: time.precise === false ? 'hour' : 'minute', parseWarnings: [...new Set(warnings)] };
  }
}

module.exports = { parseText };
