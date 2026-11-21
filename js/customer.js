const S = requireRole("customer");
let products = [], cats = [], cart = {}, profile = null, orders = [], page = 1;
const catName = id => (cats.find(c => c.id === id) || {}).name || "-";
const LOW = 15, ACCOUNT = ["orders", "profile", "security"];
const used = () => sum(orders.filter(o => o.payment_type === "credit"), o => o.total);

/* ---------- navigation (hash based: #shop #cart #orders #profile #security) ---------- */
function show(name) {
  if (!["shop", "cart", ...ACCOUNT].includes(name)) name = "shop";
  const sec = ACCOUNT.includes(name) ? "account" : name;
  $(".sec").hide(); $("#" + sec).show();
  if (sec === "account") {
    $(".atab").removeClass("active").filter(`[data-go="${name}"]`).addClass("active");
    $(".apane").hide(); $("#pane-" + name).show();
  }
  $(".acct-menu .mi").removeClass("current").filter(`[data-go="${name}"]`).addClass("current");
  $("#acct").removeClass("open"); $("#acctBtn").attr("aria-expanded", "false");
  window.scrollTo({ top: 0 });
}
function go(name) { if (location.hash.slice(1) === name) show(name); else location.hash = name; }

$(function () {
  if (!S) return;
  $("#who").text(S.email); $("#resetEmail").text(S.email); $("#pf_email").val(S.email); $("#acctEmail").text(S.email);
  $("#yr").text(new Date().getFullYear());
  setAvatar();

  $(document).on("click", "[data-go]", function (e) { e.preventDefault(); go($(this).attr("data-go")); });
  $(window).on("hashchange", () => show(location.hash.slice(1)));
  $("#acctBtn").on("click", function (e) { e.stopPropagation(); const o = $("#acct").toggleClass("open").hasClass("open"); $(this).attr("aria-expanded", o); });
  $(document).on("click", e => { if (!$(e.target).closest("#acct").length) $("#acct").removeClass("open"); });
  $(document).on("keydown", e => { if (e.key === "Escape") $("#acct").removeClass("open"); });

  $("#hsearch").on("input", () => { page = 1; if ($("#shop").is(":hidden")) go("shop"); renderShop(); });
  $("#catFilter, #sortBy").on("change", () => { page = 1; syncCats(); renderShop(); });
  $("#catGrid").on("click", ".cat-card", function () {
    const id = $(this).attr("data-id"), same = $("#catFilter").val() === id;
    $("#catFilter").val(same ? "" : id); page = 1; syncCats(); renderShop();
    if (!same) document.getElementById("allProducts").scrollIntoView({ behavior: "smooth" });
  });

  // Add to cart (works for both the deals row and the main grid)
  $("#shop").on("click", ".add", async function () {
    const id = $(this).attr("data-id"), q = $(this).closest(".pcard").find(".q").val();
    const p = products.find(x => x.id === id), inCart = (cart[id] && cart[id].qty) || 0;
    const errs = validate([[q, V.posInt, "Quantity must be a whole number greater than 0."]]);
    if (!errs.length && inCart + Number(q) > p.qty) errs.push(`Only ${p.qty} in stock (${inCart} already in your cart).`);
    if (errs.length) return UI.msg(errs[0], "err");
    if (await UI.run(Cart.set(S.uid, id, inCart + Number(q))) === undefined) return;
    cart[id] = { product_id: id, qty: inCart + Number(q) };
    UI.msg(`Added ${q} x ${p.title} to your cart.`); renderCart();
  });

  // Cart: quantity stepper + remove
  $("#cartList").on("click", ".inc,.dec", async function () {
    const id = $(this).attr("data-id"), p = products.find(x => x.id === id), cur = cart[id].qty, next = cur + ($(this).hasClass("inc") ? 1 : -1);
    if (next < 1) return;
    if (next > p.qty) return UI.msg(`Only ${p.qty} in stock.`, "err");
    if (await UI.run(Cart.set(S.uid, id, next)) === undefined) return;
    cart[id].qty = next; renderCart();
  }).on("click", ".rm", async function () {
    const id = $(this).attr("data-id");
    if (await UI.run(Cart.remove(S.uid, id)) === undefined) return;
    delete cart[id]; renderCart();
  });

  $("#checkoutBtn").on("click", async () => {
    const order = await UI.run(placeOrder(S, $("input[name=pay]:checked").val()));
    if (order === undefined) return;
    UI.msg("Order placed successfully.");
    $("#billBody").html(billHtml(order)); UI.open("#billBox");
    Mail.send(S.email, order.customer_name, "Your bill " + order.order_id, billText(order));
    loadAll(); go("orders");
  });

  $("#orderBody").on("click", ".view", function () {
    $("#billBody").html(billHtml(orders.find(x => x.order_id === $(this).attr("data-id")))); UI.open("#billBox");
  });

  // Profile
  $("#profForm").on("submit", async e => {
    e.preventDefault();
    const name = $("#pf_name").val().trim(), mob = $("#pf_mobile").val().trim();
    if (!UI.errors("#e_prof", validate([[name, V.required, "Name is required."], [mob, V.mobile, "Mobile must be 10 digits and start with 6-9."]]))) return;
    const r = await UI.run(profile ? Customers.patch(S.uid, { name, mobile: mob }) : Customers.save({ id: S.uid, name, email: S.email, mobile: mob, credit_limit: 0 }));
    if (r === undefined) return;
    UI.msg("Profile updated."); loadAll();
  });

  // Security
  $("#resetBtn").on("click", async () => {
    if (await UI.run(Auth.resetPassword(S.email)) !== undefined) UI.msg("A password reset link has been sent to " + S.email + ".");
  });
  $("#pwForm").on("submit", async e => {
    e.preventDefault();
    const a = $("#pw_new").val(), b = $("#pw_new2").val(), errs = validate([[a, V.password, "Password must be at least 6 characters."]]);
    if (a !== b) errs.push("Passwords do not match.");
    if (!UI.errors("#e_pw", errs)) return;
    const d = await UI.run(Auth.changePassword(Session.get().idToken, a));
    if (d === undefined) return;
    Session.set({ ...Session.get(), idToken: d.idToken, refreshToken: d.refreshToken });
    $("#pwForm")[0].reset(); UI.msg("Your password has been updated.");
  });

  show(location.hash.slice(1));
  loadAll();
});

function setAvatar() {
  const n = (profile && profile.name) || S.email, ch = n.trim().charAt(0).toUpperCase() || "U";
  $("#avatar, #avatar2").text(ch);
  $("#hello").text(profile ? profile.name.split(" ")[0] : "Account");
  $("#menuName, #acctName").text(profile ? profile.name : "My account");
}

async function loadAll() {
  const r = await UI.run(Promise.all([Products.all(), Categories.all(), Cart.get(S.uid), Customers.one(S.uid), Orders.mine(S.uid)]));
  if (r === undefined) return;
  [products, cats, cart, profile, orders] = r; cart = cart || {};
  const cur = $("#catFilter").val() || "";
  $("#catFilter").html('<option value="">All categories</option>' + cats.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("")).val(cur);
  if (profile) { $("#pf_name").val(profile.name); $("#pf_mobile").val(profile.mobile); }
  setAvatar(); renderCatGrid(); renderShop(); renderCart(); renderOrders();
}

/* ---------- shop ---------- */
function renderCatGrid() {
  const cur = $("#catFilter").val();
  $("#catGrid").html(cats.map(c => {
    const n = products.filter(p => p.active && p.cat_id === c.id).length;
    return `<button class="cat-card ${cur === c.id ? "on" : ""}" data-id="${esc(c.id)}" type="button">${imgTag(c.image, c.name, "", c.placeholder)}
      <span class="ct"><b>${esc(c.name)}</b><span>${n} item${n === 1 ? "" : "s"}</span></span></button>`;
  }).join("") || '<p class="empty">No categories yet.</p>');
}
function syncCats() { const cur = $("#catFilter").val(); $("#catGrid .cat-card").each(function () { $(this).toggleClass("on", $(this).attr("data-id") === cur); }); }

function card(p) {
  const badge = p.qty <= 0 ? '<span class="badge out">Out of stock</span>' : p.qty < LOW ? `<span class="badge low">Only ${p.qty} left</span>` : `<span class="badge">${esc(catName(p.cat_id))}</span>`;
  return `<article class="pcard"><div class="pimg">${imgTag(p.image, p.title, "", p.placeholder)}${badge}</div>
    <div class="pbody"><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p><div class="price"><small>Rs.</small> ${money(p.price)}</div>
    ${p.qty > 0 ? `<div class="buyrow"><input class="q" type="number" min="1" value="1" aria-label="Quantity"><button class="b primary add" data-id="${esc(p.id)}">${ic("cart")}Add</button></div>`
      : '<div class="buyrow"><button class="b" disabled>Unavailable</button></div>'}</div></article>`;
}

function renderShop() {
  const q = $("#hsearch").val().trim().toLowerCase(), cat = $("#catFilter").val(), sort = $("#sortBy").val(), size = CONFIG.SHOP_PAGE_SIZE || CONFIG.PAGE_SIZE;
  const active = products.filter(p => p.active);
  const deals = active.filter(p => p.qty > 0 && p.qty < LOW);
  $("#deals").html(deals.map(card).join("")); $("#dealsWrap").toggle(deals.length > 0);

  let list = active.filter(p => (!cat || p.cat_id === cat) && (!q || (p.title + " " + p.description + " " + catName(p.cat_id)).toLowerCase().includes(q)));
  if (sort === "lo") list.sort((a, b) => a.price - b.price); else if (sort === "hi") list.sort((a, b) => b.price - a.price); else if (sort === "az") list.sort((a, b) => a.title.localeCompare(b.title));
  page = Math.min(page, Math.max(1, Math.ceil(list.length / size)));
  $("#resultCount").text(`${list.length} product${list.length === 1 ? "" : "s"}` + (q ? ` for "${$("#hsearch").val().trim()}"` : ""));
  $("#shopGrid").html(UI.paginate(list, page, size).map(card).join("") ||
    `<div class="empty">${ic("search")}<p>No products match your search.</p></div>`);
  UI.pager("#shopPager", list.length, page, size, n => { page = n; renderShop(); document.getElementById("allProducts").scrollIntoView({ behavior: "smooth" }); });
}

/* ---------- cart ---------- */
function renderCart() {
  const items = Object.values(cart); let total = 0, count = 0;
  $("#cartList").html(items.map(it => {
    const p = products.find(x => x.id === it.product_id), ok = p && p.active, amt = ok ? it.qty * p.price : 0;
    total += amt; count += it.qty;
    return `<div class="citem">${imgTag(p && p.image, p ? p.title : "", "", p && p.placeholder)}
      <div><h4>${esc(p ? p.title : it.product_id)}</h4>${ok ? `<small>Rs. ${money(p.price)} each</small>` : "<small>No longer available</small>"}<br>
      <div class="stepper"><button class="dec" data-id="${esc(it.product_id)}" aria-label="Decrease quantity">${ic("minus")}</button><span>${it.qty}</span><button class="inc" data-id="${esc(it.product_id)}" aria-label="Increase quantity">${ic("plus")}</button></div></div>
      <div class="amt"><b>${money(amt)}</b><button class="b danger rm" data-id="${esc(it.product_id)}">${ic("trash")}Remove</button></div></div>`;
  }).join("") || `<div class="empty-note">${ic("bag")}<p>Your cart is empty.</p><button class="b primary" data-go="shop">Start shopping</button></div>`);
  $("#cartTotal").text(money(total)); $("#cartItems").text(count); $("#cartCount").text(count);
  const limit = creditLimitOf(profile), u = used();
  $("#creditInfo").text(`Credit limit ${money(limit)}, used ${money(u)}, available ${money(Math.max(0, limit - u))}`);
  $("#checkoutBtn").prop("disabled", !items.length);
}

/* ---------- account ---------- */
function renderOrders() {
  const list = [...orders].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  $("#orderBody").html(list.map(o => `<tr><td><b>${esc(o.order_id)}</b></td><td>${esc(o.date)}</td><td><span class="pill ${o.payment_type === "credit" ? "warn" : "ok"}">${esc(o.payment_type)}</span></td>
    <td>${sum(o.items, i => i.qty)}</td><td>${money(o.total)}</td><td><button class="b view" data-id="${esc(o.order_id)}">${ic("eye")}View bill</button></td></tr>`).join("")
    || '<tr><td colspan="6" class="empty-note">No orders yet. Your purchases will show up here.</td></tr>');
  $("#spent").text(money(sum(orders, o => o.total))); $("#orderCount").text(orders.length);
  const limit = creditLimitOf(profile), u = used();
  $("#pc_limit").text(money(limit)); $("#pc_used").text(money(u)); $("#pc_avail").text(money(Math.max(0, limit - u)));
}
