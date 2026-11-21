/* All REST/Axios logic lives here. No DOM code in this file. */
const AUTH_URL = "https://identitytoolkit.googleapis.com/v1/accounts:";
const http = axios.create({ timeout: 15000 });

const Session = {
  get() { try { return JSON.parse(sessionStorage.getItem("session")); } catch (e) { return null; } },
  set(s) { sessionStorage.setItem("session", JSON.stringify(s)); },
  clear() { sessionStorage.removeItem("session"); }
};
const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// Expired token -> sign out (a rules denial is also 401 but says "Permission denied")
http.interceptors.response.use(r => r, e => {
  const d = e.response && e.response.data && e.response.data.error;
  if (e.response && e.response.status === 401 && typeof d === "string" && /token/i.test(d) && Session.get()) {
    Session.clear(); alert("Your session expired. Please sign in again."); location.href = "index.html";
  }
  return Promise.reject(e);
});

const AUTH_MSG = {
  EMAIL_EXISTS: "This email is already registered.",
  INVALID_LOGIN_CREDENTIALS: "Incorrect email or password.",
  EMAIL_NOT_FOUND: "No account found for this email.",
  INVALID_PASSWORD: "Incorrect password.",
  INVALID_EMAIL: "Enter a valid email address.",
  USER_DISABLED: "This account has been disabled.",
  CREDENTIAL_TOO_OLD_LOGIN_AGAIN: "For security, please sign out, sign in again and then change your password.",
  TOKEN_EXPIRED: "Your session expired. Please sign in again.",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts. Try again later."
};
function errMsg(e) {
  if (e.response) {
    const d = e.response.data && e.response.data.error;
    if (d && d.message) {
      const k = d.message.split(" ")[0];
      if (k.startsWith("WEAK_PASSWORD")) return "Password must be at least 6 characters.";
      return AUTH_MSG[k] || d.message;
    }
    if (typeof d === "string") return d === "Permission denied" ? "You are not allowed to do this." : d;
    return "Server error (" + e.response.status + ").";
  }
  if (e.request) return "Network error. Check your connection and try again.";
  return e.message || "Something went wrong.";
}

/* ---------- Firebase Authentication REST ---------- */
const Auth = {
  async _post(action, body) {
    const { data } = await http.post(AUTH_URL + action, body, { params: { key: CONFIG.API_KEY } });
    return data;
  },
  signUp: (email, password) => Auth._post("signUp", { email, password, returnSecureToken: true }),
  signIn: (email, password) => Auth._post("signInWithPassword", { email, password, returnSecureToken: true }),
  changePassword: (idToken, password) => Auth._post("update", { idToken, password, returnSecureToken: true }),
  resetPassword: email => Auth._post("sendOobCode", { requestType: "PASSWORD_RESET", email })
};

/* ---------- Realtime Database REST (GET / POST / PUT / PATCH / DELETE) ---------- */
const DB = {
  _u: p => `${CONFIG.DB_URL}/${p}.json`,
  _a: () => ({ auth: Session.get().idToken }),
  async get(p) { return (await http.get(DB._u(p), { params: DB._a() })).data; },
  async list(p) { const d = await DB.get(p); return d ? Object.values(d) : []; },
  async post(p, b) { return (await http.post(DB._u(p), b, { params: DB._a() })).data; },
  async put(p, b) { await http.put(DB._u(p), b, { params: DB._a() }); return true; },
  async patch(p, b) { await http.patch(DB._u(p), b, { params: DB._a() }); return true; },
  async del(p) { await http.delete(DB._u(p), { params: DB._a() }); return true; }
};

const Categories = {
  all: () => DB.list("categories"),
  save: c => DB.put("categories/" + c.id, c),
  remove: id => DB.del("categories/" + id)
};
const Products = {
  all: () => DB.list("products"),
  one: id => DB.get("products/" + id),
  save: p => DB.put("products/" + p.id, p),
  patch: (id, b) => DB.patch("products/" + id, b),
  setQty: (id, q) => DB.put(`products/${id}/qty`, q),
  remove: id => DB.del("products/" + id)
};
const Customers = {
  all: () => DB.list("customers"),
  one: id => DB.get("customers/" + id),
  save: c => DB.put("customers/" + c.id, c),
  patch: (id, b) => DB.patch("customers/" + id, b),
  remove: id => DB.del("customers/" + id)
};
const Cart = {
  get: u => DB.get(`carts/${u}`),
  set: (u, p, q) => DB.put(`carts/${u}/${p}`, { product_id: p, qty: q }),
  remove: (u, p) => DB.del(`carts/${u}/${p}`),
  clear: u => DB.del(`carts/${u}`)
};
const Orders = {
  mine: u => DB.list(`orders/${u}`),
  async all() { const d = await DB.get("orders"); return d ? Object.values(d).flatMap(u => Object.values(u)) : []; },
  save: o => DB.put(`orders/${o.customer_id}/${o.order_id}`, o)
};

/* ---------- Email via EmailJS (public key only, no secrets) ---------- */
const Mail = {
  async send(to, name, subject, message) {
    const e = CONFIG.EMAILJS;
    if (!e.publicKey) return false;
    try {
      await http.post("https://api.emailjs.com/api/v1.0/email/send", {
        service_id: e.serviceId, template_id: e.templateId, user_id: e.publicKey,
        template_params: { to_email: to, to_name: name || to, subject, message }
      });
      return true;
    } catch (_) { return false; }
  }
};
function billText(o) {
  return `Order ${o.order_id} (${o.date}) - ${o.payment_type.toUpperCase()}\n` +
    o.items.map(i => `${i.title} x ${i.qty} @ ${i.price} = ${(i.qty * i.price).toFixed(2)}`).join("\n") +
    `\nTOTAL: ${o.total.toFixed(2)}`;
}

/* ---------- Checkout: stock + credit validation, order creation ---------- */
async function creditUsed(uid) {
  return (await Orders.mine(uid)).filter(o => o.payment_type === "credit").reduce((s, o) => s + o.total, 0);
}
function creditLimitOf(c) { return Math.min(Number((c && c.credit_limit) || 0), CONFIG.CREDIT_CAP); }

async function placeOrder(session, payment) {
  if (!["cash", "credit"].includes(payment)) throw new Error("Choose Cash or Credit.");
  const items = Object.values((await Cart.get(session.uid)) || {});
  if (!items.length) throw new Error("Your cart is empty.");
  const products = await Products.all();
  const pm = Object.fromEntries(products.map(p => [p.id, p]));
  const lines = items.map(it => {
    const p = pm[it.product_id];
    if (!p || !p.active) throw new Error("A product in your cart is no longer available. Remove it and try again.");
    if (!(it.qty > 0)) throw new Error("Invalid quantity for " + p.title + ".");
    if (it.qty > p.qty) throw new Error(`Insufficient stock for "${p.title}". Available: ${p.qty}.`);
    return { product_id: p.id, title: p.title, cat_id: p.cat_id, qty: it.qty, price: p.price };
  });
  const total = Math.round(lines.reduce((s, l) => s + l.qty * l.price, 0) * 100) / 100;
  const cust = await Customers.one(session.uid);
  if (payment === "credit") {
    const limit = creditLimitOf(cust), used = await creditUsed(session.uid);
    if (used + total > limit)
      throw new Error(`Credit limit exceeded. Limit: ${limit.toFixed(2)}, used: ${used.toFixed(2)}, this order: ${total.toFixed(2)}.`);
  }
  const done = [];
  try {
    for (const l of lines) { await Products.setQty(l.product_id, pm[l.product_id].qty - l.qty); done.push(l); }
  } catch (e) {
    for (const l of done) { try { await Products.setQty(l.product_id, pm[l.product_id].qty); } catch (_) {} }
    throw e;
  }
  const order = {
    order_id: newId("o"), customer_id: session.uid, customer_email: session.email,
    customer_name: (cust && cust.name) || session.email,
    date: new Date().toLocaleDateString("en-CA"), created_at: new Date().toISOString(),
    items: lines, total, payment_type: payment
  };
  await Orders.save(order);
  await Cart.clear(session.uid);
  return order;
}
