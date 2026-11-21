const S = requireRole("admin");
let cats = [], prods = [], custs = [], pPage = 1;
const LOW = 15;
const catName = id => (cats.find(c => c.id === id) || {}).name || "-";
const r2 = n => Math.round(n * 100) / 100;
const stat = (label, value, cls) => `<div class="stat ${cls || ""}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
const ibtn = (cls, id, icon, tip) => `<button class="ib ${cls}" data-id="${esc(id)}" title="${tip}" aria-label="${tip}">${ic(icon)}</button>`;

// Live image preview inside the popups (falls back to the local placeholder)
function previewImg(inp, img, fb) {
  const $i = $(img).attr("data-fb", fb || IMG_FALLBACK);
  const set = () => { const v = $(inp).val().trim(); $i.attr("src", /^https?:\/\//i.test(v) ? v : $i.attr("data-fb")); };
  $(inp).off("input.pv").on("input.pv", set); set();
}

$(function () {
  if (!S) return;
  $("#who").text(S.email);
  $(".nav-item").on("click", function () {
    $(".nav-item").removeClass("active"); $(this).addClass("active");
    $(".sec").hide(); $("#" + $(this).attr("data-t")).show();
    $("#sidebar").removeClass("open");
  });
  $("#menuBtn").on("click", () => $("#sidebar").toggleClass("open"));
  bindCats(); bindProds(); bindCusts(); bindReports(); refreshAll();
});

async function refreshAll() {
  const r = await UI.run(Promise.all([Categories.all(), Products.all(), Customers.all()]));
  if (r === undefined) return;
  [cats, prods, custs] = r;
  const opts = cats.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
  const keep = $("#pf_cat").val();
  $("#p_cat").html('<option value="">Select category</option>' + opts);
  $("#pf_cat").html('<option value="">All categories</option>' + opts).val(keep);
  $("#n_cats").text(cats.length); $("#n_prods").text(prods.length); $("#n_custs").text(custs.length);
  renderCats(); renderProds(); renderCusts();
}

/* ---------------- Categories ---------------- */
function renderCats() {
  $("#catStats").html(stat("Categories", cats.length) + stat("Products", prods.length) + stat("Empty categories", cats.filter(c => !prods.some(p => p.cat_id === c.id)).length, "s-warn"));
  $("#catBody").html(cats.map(c => `<tr><td><div class="tcell">${imgTag(c.image, c.name, "thumb", c.placeholder)}<b>${esc(c.name)}</b></div></td>
    <td>${esc(c.id)}</td><td><span class="pill">${prods.filter(p => p.cat_id === c.id).length} products</span></td>
    <td><div class="acts">${ibtn("ce", c.id, "edit", "Edit category")}${ibtn("danger cd", c.id, "trash", "Delete category")}</div></td></tr>`).join("")
    || '<tr><td colspan="4" class="empty-note">No categories yet. Click "Add category" to create the first one.</td></tr>');
}
function openCat(c) {
  $("#catForm")[0].reset(); UI.errors("#e_cat", []);
  $("#cat_id").prop("readonly", !!c).val(c ? c.id : ""); $("#cat_name").val(c ? c.name : ""); $("#cat_img").val(c ? c.image || "" : "");
  $("#catModalTitle").text(c ? "Edit category" : "Add category"); $("#catSave").text(c ? "Save changes" : "Add category");
  previewImg("#cat_img", "#cat_prev", c && c.placeholder);
  UI.open("#catModal"); setTimeout(() => $("#cat_name").trigger("focus"), 60);
}
function bindCats() {
  $("#catAdd").on("click", () => openCat(null));
  $("#catForm").on("submit", async e => {
    e.preventDefault();
    const editing = $("#cat_id").prop("readonly"), id = $("#cat_id").val().trim() || newId("c"), name = $("#cat_name").val().trim(), image = $("#cat_img").val().trim();
    const errs = validate([[name, V.required, "Category name is required."], [id, V.id, "ID can only contain letters, digits, - and _."], [image, V.url, "Image link must start with http:// or https://."]]);
    if (!editing && cats.some(c => c.id === id)) errs.push("Category ID already exists.");
    if (!UI.errors("#e_cat", errs)) return;
    const old = cats.find(c => c.id === id) || {};
    if (await UI.run(Categories.save({ ...old, id, name, image })) === undefined) return;
    UI.close("#catModal"); UI.msg(editing ? "Category updated." : "Category created."); refreshAll();
  });
  $("#catBody").on("click", ".ce", function () {
    openCat(cats.find(x => x.id === $(this).attr("data-id")));
  }).on("click", ".cd", async function () {
    const id = $(this).attr("data-id");
    if (prods.some(p => p.cat_id === id)) return UI.msg("Cannot delete: products still use this category.", "err");
    if (!await UI.confirm(`"${catName(id)}" will be removed permanently.`, "Delete this category?")) return;
    if (await UI.run(Categories.remove(id)) === undefined) return;
    UI.msg("Category deleted."); refreshAll();
  });
}

/* ---------------- Inventory ---------------- */
const stockPill = q => `<span class="pill ${q <= 0 ? "bad" : q < LOW ? "warn" : q > 100 ? "" : "ok"}">${q <= 0 ? "Out of stock" : q}</span>`;
function renderProds() {
  $("#prodStats").html(stat("Products", prods.length) + stat("Active", prods.filter(p => p.active).length, "s-ok") +
    stat("Low stock (under " + LOW + ")", prods.filter(p => p.qty > 0 && p.qty < LOW).length, "s-warn") + stat("Out of stock", prods.filter(p => p.qty <= 0).length, "s-bad"));
  const cat = $("#pf_cat").val(), q = $("#pf_q").val().trim().toLowerCase();
  const list = prods.filter(p => (!cat || p.cat_id === cat) && (!q || p.id.toLowerCase() === q || p.title.toLowerCase().includes(q)));
  pPage = Math.min(pPage, Math.max(1, Math.ceil(list.length / CONFIG.PAGE_SIZE)));
  $("#prodBody").html(UI.paginate(list, pPage, CONFIG.PAGE_SIZE).map(p => `<tr class="${p.active ? "" : "off"}">
    <td><div class="tcell">${imgTag(p.image, p.title, "thumb", p.placeholder)}<b>${esc(p.title)}</b></div></td><td>${esc(p.id)}</td><td>${esc(catName(p.cat_id))}</td>
    <td>${stockPill(p.qty)}</td><td>${money(p.price)}</td><td><span class="pill ${p.active ? "ok" : "mute"}">${p.active ? "Active" : "Inactive"}</span></td>
    <td><div class="acts">${ibtn("pe", p.id, "edit", "Edit product")}${ibtn("good pt", p.id, "power", p.active ? "Deactivate" : "Activate")}${ibtn("danger pd", p.id, "trash", "Delete product")}</div></td></tr>`).join("")
    || '<tr><td colspan="7" class="empty-note">No products found.</td></tr>');
  UI.pager("#prodPager", list.length, pPage, CONFIG.PAGE_SIZE, n => { pPage = n; renderProds(); });
}
function openProd(p) {
  $("#prodForm")[0].reset(); UI.errors("#e_prod", []);
  $("#p_id").prop("readonly", !!p).val(p ? p.id : ""); $("#p_cat").val(p ? p.cat_id : ""); $("#p_title").val(p ? p.title : "");
  $("#p_desc").val(p ? p.description : ""); $("#p_img").val(p ? p.image || "" : ""); $("#p_qty").val(p ? p.qty : 0); $("#p_price").val(p ? p.price : 0);
  $("#p_active").prop("checked", p ? !!p.active : true).closest("label").toggle(!p);
  $("#prodModalTitle").text(p ? "Edit product" : "Add product"); $("#prodSave").text(p ? "Save changes" : "Add product");
  previewImg("#p_img", "#p_prev", p && p.placeholder);
  UI.open("#prodModal"); setTimeout(() => $("#p_title").trigger("focus"), 60);
}
function bindProds() {
  $("#pf_cat").on("change", () => { pPage = 1; renderProds(); });
  $("#pf_q").on("input", () => { pPage = 1; renderProds(); });
  $("#prodAdd").on("click", () => openProd(null));
  $("#prodForm").on("submit", async e => {
    e.preventDefault();
    const editing = $("#p_id").prop("readonly"), id = $("#p_id").val().trim() || newId("p");
    const p = { cat_id: $("#p_cat").val(), title: $("#p_title").val().trim(), description: $("#p_desc").val().trim(), image: $("#p_img").val().trim(),
      qty: $("#p_qty").val().trim(), price: $("#p_price").val().trim() };
    const errs = validate([[p.cat_id, V.required, "Select a category."], [p.title, V.required, "Title is required."],
      [p.description, V.required, "Description is required."], [p.image, V.url, "Image link must start with http:// or https://."],
      [p.qty, V.intNonNeg, "Quantity must be a whole number, 0 or more."], [p.price, V.nonNegNum, "Price must be a number, 0 or more."],
      [id, V.id, "ID can only contain letters, digits, - and _."]]);
    if (!editing && prods.some(x => x.id === id)) errs.push("Product ID already exists.");
    if (!UI.errors("#e_prod", errs)) return;
    p.qty = +p.qty; p.price = +p.price;
    // Update never sends the ID (ID is immutable); active flag has its own action
    const r = await UI.run(editing ? Products.patch(id, p) : Products.save({ id, ...p, active: $("#p_active").prop("checked") }));
    if (r === undefined) return;
    UI.close("#prodModal"); UI.msg(editing ? "Product updated." : "Product created."); refreshAll();
  });
  $("#prodBody").on("click", ".pe", function () {
    openProd(prods.find(x => x.id === $(this).attr("data-id")));
  }).on("click", ".pt", async function () {
    const p = prods.find(x => x.id === $(this).attr("data-id"));
    if (await UI.run(Products.patch(p.id, { active: !p.active })) === undefined) return;
    UI.msg(p.active ? "Product deactivated." : "Product activated."); refreshAll();
  }).on("click", ".pd", async function () {
    const p = prods.find(x => x.id === $(this).attr("data-id"));
    if (!await UI.confirm(`"${p.title}" will be removed permanently.`, "Delete this product?")) return;
    if (await UI.run(Products.remove(p.id)) === undefined) return;
    UI.msg("Product deleted."); refreshAll();
  });
}

/* ---------------- Customers & credit limits ---------------- */
function renderCusts() {
  $("#custStats").html(stat("Customers", custs.length) + stat("With credit", custs.filter(c => +c.credit_limit > 0).length, "s-ok") + stat("Total credit limits", money(sum(custs, c => +c.credit_limit || 0))));
  $("#custBody").html(custs.map(c => `<tr><td><div class="tcell"><span class="avatar">${esc((c.name || c.email || "?").charAt(0).toUpperCase())}</span><div><b>${esc(c.name)}</b><br><small>${esc(c.email)}</small></div></div></td>
    <td>${esc(c.id)}</td><td>${esc(c.mobile)}</td><td><span class="pill ${+c.credit_limit > 0 ? "ok" : "mute"}">${money(c.credit_limit)}</span></td>
    <td><div class="acts">${ibtn("ue", c.id, "edit", "Edit customer")}${ibtn("danger ud", c.id, "trash", "Delete customer")}</div></td></tr>`).join("")
    || '<tr><td colspan="5" class="empty-note">No customers yet.</td></tr>');
}
function openCust(c) {
  $("#custForm")[0].reset(); UI.errors("#e_cust", []);
  $("#c_id").prop("readonly", !!c).val(c ? c.id : ""); $("#c_name").val(c ? c.name : ""); $("#c_email").val(c ? c.email : "");
  $("#c_mobile").val(c ? c.mobile : ""); $("#c_limit").val(c ? c.credit_limit : 0);
  $("#custModalTitle").text(c ? "Edit customer" : "Add customer"); $("#custSave").text(c ? "Save changes" : "Add customer");
  UI.open("#custModal"); setTimeout(() => $("#c_name").trigger("focus"), 60);
}
function bindCusts() {
  $("#custAdd").on("click", () => openCust(null));
  $("#custForm").on("submit", async e => {
    e.preventDefault();
    const editing = $("#c_id").prop("readonly"), id = $("#c_id").val().trim() || newId("u");
    const c = { name: $("#c_name").val().trim(), email: $("#c_email").val().trim(), mobile: $("#c_mobile").val().trim(), credit_limit: $("#c_limit").val().trim() };
    const errs = validate([[c.name, V.required, "Name is required."], [c.email, V.email, "Enter a valid email address."],
      [c.mobile, V.mobile, "Mobile must be 10 digits and start with 6-9."], [c.credit_limit, V.nonNegNum, "Credit limit must be a number, 0 or more."],
      [id, V.id, "ID can only contain letters, digits, - and _."]]);
    if (!editing && custs.some(x => x.id === id)) errs.push("Customer ID already exists.");
    if (!UI.errors("#e_cust", errs)) return;
    c.credit_limit = +c.credit_limit;
    const r = await UI.run(editing ? Customers.patch(id, c) : Customers.save({ id, ...c }));
    if (r === undefined) return;
    UI.close("#custModal"); UI.msg(editing ? "Customer updated." : "Customer created."); refreshAll();
  });
  $("#custBody").on("click", ".ue", function () {
    openCust(custs.find(x => x.id === $(this).attr("data-id")));
  }).on("click", ".ud", async function () {
    const c = custs.find(x => x.id === $(this).attr("data-id"));
    if (!await UI.confirm(`${c.name} will be removed from the customer list.`, "Delete this customer?")) return;
    if (await UI.run(Customers.remove(c.id)) === undefined) return;
    UI.msg("Customer deleted."); refreshAll();
  });
}

/* ---------------- Reports ---------------- */
const lines = os => os.flatMap(o => o.items.map(i => ({ ...i, date: o.date, payment_type: o.payment_type })));
const perCust = (os, cs) => {
  const g = {}; os.forEach(o => (g[o.customer_id] = g[o.customer_id] || []).push(o));
  return Object.entries(g).map(([id, list]) => {
    const c = cs.find(x => x.id === id) || {};
    return { customer: c.name || list[0].customer_name || id, email: c.email || list[0].customer_email, orders: list.length, total: r2(sum(list, o => o.total)) };
  }).sort((a, b) => b.total - a.total);
};
const STK = ["id", "title", "category", "qty", "price", "status"];
const stock = (x, list) => list.map(p => ({ id: p.id, title: p.title, category: (x.categories.find(c => c.id === p.cat_id) || {}).name || "-",
  qty: p.qty, price: p.price, status: p.active ? "Active" : "Inactive" }));
function sold(x) {
  const m = {};
  x.products.forEach(p => (m[p.id] = { product_id: p.id, title: p.title, units_sold: 0, revenue: 0 }));
  lines(x.orders).forEach(l => {
    const e = m[l.product_id] || (m[l.product_id] = { product_id: l.product_id, title: l.title, units_sold: 0, revenue: 0 });
    e.units_sold += l.qty; e.revenue = r2(e.revenue + l.qty * l.price);
  });
  return Object.values(m);
}
const PC = ["customer", "email", "orders", "total"], SC = ["product_id", "title", "units_sold", "revenue"];
const R = {
  c_all: { t: "Customers: all columns", f: x => ({ cols: ["id", "name", "email", "mobile", "credit_limit"], rows: x.customers }) },
  c_top: { t: "Top 10 customers by spend", r: 1, f: x => ({ cols: PC, rows: perCust(x.orders, x.customers).slice(0, 10) }) },
  c_cash: { t: "Cash purchases by customer", r: 1, f: x => ({ cols: PC, rows: perCust(x.orders.filter(o => o.payment_type === "cash"), x.customers) }) },
  c_credit: { t: "Credit purchases by customer", r: 1, f: x => ({ cols: PC, rows: perCust(x.orders.filter(o => o.payment_type === "credit"), x.customers) }) },
  i_all: { t: "Current stock: all products", f: x => ({ cols: STK, rows: stock(x, x.products) }) },
  i_cat: { t: "Current stock: category-wise", f: x => ({ cols: ["category", "products", "total_qty"],
    rows: x.categories.map(c => { const ps = x.products.filter(p => p.cat_id === c.id); return { category: c.name, products: ps.length, total_qty: sum(ps, p => p.qty) }; }) }) },
  i_high: { t: "High stock (quantity above 100)", f: x => ({ cols: STK, rows: stock(x, x.products.filter(p => p.qty > 100)) }) },
  i_low: { t: "Low stock (quantity below 15)", f: x => ({ cols: STK, rows: stock(x, x.products.filter(p => p.qty < 15)) }) },
  s_all: { t: "All sales", r: 1, f: x => ({ cols: ["order_id", "date", "customer", "payment_type", "items", "total"],
    rows: x.orders.sort((a, b) => a.date.localeCompare(b.date)).map(o => ({ order_id: o.order_id, date: o.date, customer: o.customer_name || o.customer_email,
      payment_type: o.payment_type, items: sum(o.items, i => i.qty), total: o.total })) }) },
  s_cat: { t: "Sales category-wise", r: 1, f: x => ({ cols: ["category", "units", "revenue"],
    rows: x.categories.map(c => { const ls = lines(x.orders).filter(l => l.cat_id === c.id); return { category: c.name, units: sum(ls, l => l.qty), revenue: r2(sum(ls, l => l.qty * l.price)) }; }) }) },
  s_pay: { t: "Sales cash-wise and credit-wise", r: 1, f: x => ({ cols: ["payment_type", "orders", "revenue"],
    rows: ["cash", "credit"].map(t => { const os = x.orders.filter(o => o.payment_type === t); return { payment_type: t, orders: os.length, revenue: r2(sum(os, o => o.total)) }; }) }) },
  s_top: { t: "Top 10 selling items", r: 1, f: x => ({ cols: SC, rows: sold(x).filter(e => e.units_sold > 0).sort((a, b) => b.units_sold - a.units_sold).slice(0, 10) }) },
  s_bottom: { t: "Bottom 10 selling items", r: 1, f: x => ({ cols: SC, rows: sold(x).sort((a, b) => a.units_sold - b.units_sold).slice(0, 10) }) }
};
function bindReports() {
  $("#rep").html(Object.entries(R).map(([k, v]) => `<option value="${k}">${v.t}</option>`).join("")).on("change", () => $("#dates").toggle(!!R[$("#rep").val()].r)).trigger("change");
  $("#repRun").on("click", async () => {
    const def = R[$("#rep").val()], from = $("#r_from").val(), to = $("#r_to").val();
    let errs = [];
    if (def.r) { errs = validate([[from, V.required, "Choose a From date."], [to, V.required, "Choose a To date."]]); if (!errs.length && from > to) errs.push("From date must not be after To date."); }
    if (!UI.errors("#e_rep", errs)) return;
    const r = await UI.run(Promise.all([Customers.all(), Products.all(), Categories.all(), Orders.all()]));
    if (r === undefined) return;
    let [customers, products, categories, orders] = r;
    if (def.r) orders = orders.filter(o => o.date >= from && o.date <= to);
    const out = def.f({ customers, products, categories, orders });
    $("#repTitle").text(def.t + (def.r ? ` (${from} to ${to})` : ""));
    $("#repOut").html(UI.tbl(out.cols, out.rows));
  });
}
