const V = {
  required: v => String(v == null ? "" : v).trim() !== "",
  email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim()),
  mobile: v => /^[6-9]\d{9}$/.test(String(v).trim()),
  password: v => String(v).length >= 6,
  num: v => String(v).trim() !== "" && isFinite(v),
  nonNegNum: v => V.num(v) && +v >= 0,
  intNonNeg: v => /^\d+$/.test(String(v).trim()),
  posInt: v => /^\d+$/.test(String(v).trim()) && +v > 0,
  url: v => String(v).trim() === "" || /^https?:\/\/\S+$/i.test(String(v).trim()),
  id: v => /^[A-Za-z0-9_-]+$/.test(String(v))   // safe Firebase keys
};
// rules: [[value, checkFn, message], ...] -> array of failed messages
function validate(rules) { return rules.filter(r => !r[1](r[0])).map(r => r[2]); }
