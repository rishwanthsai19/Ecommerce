const isAdmin = e => String(e).toLowerCase() === CONFIG.ADMIN_EMAIL.toLowerCase();
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => Number(n || 0).toFixed(2);
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);

/* Images: remote (Unsplash) link first, local placeholder if it cannot load */
const IMG_FALLBACK = "img/placeholder.svg";
const imgTag = (src, alt, cls, fb) => `<img ${cls ? `class="${cls}" ` : ""}src="${esc(src || fb || IMG_FALLBACK)}" alt="${esc(alt)}" loading="lazy" data-fb="${esc(fb || IMG_FALLBACK)}">`;
document.addEventListener("error", e => {
  const t = e.target;
  if (t && t.tagName === "IMG" && t.dataset.fb && !t.src.endsWith(t.dataset.fb)) t.src = t.dataset.fb;
}, true);

/* Icons (inline SVG, stroke style) */
const ICONS = {
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 001 .8h8.9a1 1 0 001-.8L20 8H6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-7 8-7s8 3 8 7"/>',
  orders: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3"/>',
  logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14c2.5.6 4 2.6 4 6"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/>',
  eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  power: '<path d="M12 2v10M6.3 6.3a8 8 0 1011.4 0"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0L3 13V3h10l7.6 7.6a2 2 0 010 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  minus: '<path d="M5 12h14"/>',
  bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
  flame: '<path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-7-1 2-2 3-3 3 0-4-1-7-4-9 0 4-4 6-4 12 0 4 3 8 7 8z"/>'
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ""}</svg>`;

// Route guard (the real protection is the Firebase rules)
function requireRole(role) {
  const s = Session.get();
  if (!s) { location.href = "index.html"; return null; }
  const admin = isAdmin(s.email);
  if ((role === "admin" && !admin) || (role === "customer" && admin)) {
    location.href = admin ? "admin.html" : "customer.html"; return null;
  }
  return s;
}
function logout() { Session.clear(); location.href = "index.html"; }

const UI = {
  _n: 0,
  loading(on) { UI._n = Math.max(0, UI._n + (on ? 1 : -1)); $("#loader").css("display", UI._n ? "grid" : "none"); },
  msg(text, type) {
    const $m = $("#msg").attr("class", "msg " + (type || "ok")).html((type === "err" ? "" : ic("shield")) + `<span>${esc(text)}</span>`).css("display", "flex");
    clearTimeout(UI._t); UI._t = setTimeout(() => $m.hide(), 5000);
  },
  // Runs a promise with loading state; shows the error and returns undefined on failure
  async run(p) {
    UI.loading(true);
    try { return await p; }
    catch (e) { UI.msg(errMsg(e), "err"); return undefined; }
    finally { UI.loading(false); }
  },
  errors(sel, list) {
    $(sel).html(list.length ? "<ul>" + list.map(e => `<li>${esc(e)}</li>`).join("") + "</ul>" : "").toggle(list.length > 0);
    return list.length === 0;
  },
  open(sel) { $(sel).css("display", "flex"); },
  close(sel) { $(sel).hide(); },
  confirm(text, title, yes) {
    return new Promise(res => {
      $("#confirmTitle").text(title || "Are you sure?"); $("#confirmText").text(text); $("#yesBtn").text(yes || "Delete");
      $("#confirmBox").css("display", "flex");
      $("#yesBtn").off().on("click", () => { $("#confirmBox").hide(); res(true); });
      $("#noBtn").off().on("click", () => { $("#confirmBox").hide(); res(false); });
    });
  },
  paginate: (list, page, size) => list.slice((page - 1) * size, page * size),
  pager(sel, total, page, size, cb) {
    const pages = Math.max(1, Math.ceil(total / size));
    let h = `<button ${page <= 1 ? "disabled" : ""} data-p="${page - 1}">Prev</button>`;
    for (let i = 1; i <= pages; i++) h += `<button class="${i === page ? "on" : ""}" data-p="${i}">${i}</button>`;
    h += `<button ${page >= pages ? "disabled" : ""} data-p="${page + 1}">Next</button> <span>${total} record(s)</span>`;
    $(sel).html(h).off("click").on("click", "button:not(:disabled)", function () { cb(+$(this).attr("data-p")); });
  },
  tbl(cols, rows) {
    if (!rows.length) return '<p class="empty-note">No records found.</p>';
    return "<table><tr>" + cols.map(c => `<th>${esc(c.replace(/_/g, " "))}</th>`).join("") + "</tr>" +
      rows.map(r => "<tr>" + cols.map(c => `<td>${esc(r[c])}</td>`).join("") + "</tr>").join("") + "</table>";
  }
};

function billHtml(o) {
  return `<h3>Bill ${esc(o.order_id)}</h3><p>${esc(o.customer_name || o.customer_email)} on ${esc(o.date)}. Paid by <b>${esc(o.payment_type)}</b>.</p>
  <table><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr>` +
    o.items.map(i => `<tr><td>${esc(i.title)}</td><td>${i.qty}</td><td>${money(i.price)}</td><td>${money(i.qty * i.price)}</td></tr>`).join("") +
    `<tr><th colspan="3">Total</th><th>${money(o.total)}</th></tr></table>`;
}

// Shared page setup: app name, icons, modal close buttons
$(function () {
  $(".app-name").text(CONFIG.APP_NAME);
  if (CONFIG.TAGLINE) $(".tagline").text(CONFIG.TAGLINE);
  document.title = CONFIG.APP_NAME + document.title.replace(/^[^:]*/, "");
  $("[data-ic]").each(function () { $(this).html(ic($(this).attr("data-ic"))); });
  $(".modal.closable").on("mousedown", function (e) { if (e.target === this) $(this).hide(); });
  $(document).on("click", "[data-close]", function () { $(this).closest(".modal").hide(); });
  $(document).on("keydown", e => { if (e.key === "Escape") $(".modal.closable:visible").hide(); });
});
