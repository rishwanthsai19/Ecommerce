function start(d) {
  Session.set({ idToken: d.idToken, uid: d.localId, email: d.email, refreshToken: d.refreshToken });
  location.href = isAdmin(d.email) ? "admin.html" : "customer.html";
}
$(function () {
  const s = Session.get();
  if (s) { location.href = isAdmin(s.email) ? "admin.html" : "customer.html"; return; }

  $(".tab").on("click", function () {
    $(".tab").removeClass("active"); $(this).addClass("active");
    $(".pane").hide(); $("#" + $(this).attr("data-t")).show();
  });

  $("#in").on("submit", async e => {
    e.preventDefault();
    const em = $("#in_email").val().trim(), pw = $("#in_pw").val();
    if (!UI.errors("#e_in", validate([[em, V.email, "Enter a valid email address."], [pw, V.required, "Password is required."]]))) return;
    const d = await UI.run(Auth.signIn(em, pw));
    if (d !== undefined) start(d);
  });

  $("#up").on("submit", async e => {
    e.preventDefault();
    const name = $("#up_name").val().trim(), em = $("#up_email").val().trim(),
      mob = $("#up_mobile").val().trim(), pw = $("#up_pw").val(), pw2 = $("#up_pw2").val();
    const errs = validate([
      [name, V.required, "Name is required."],
      [em, V.email, "Enter a valid email address."],
      [mob, V.mobile, "Mobile must be 10 digits and start with 6-9."],
      [pw, V.password, "Password must be at least 6 characters."]
    ]);
    if (pw !== pw2) errs.push("Passwords do not match.");
    if (!UI.errors("#e_up", errs)) return;
    const d = await UI.run(Auth.signUp(em, pw));
    if (d === undefined) return;
    Session.set({ idToken: d.idToken, uid: d.localId, email: d.email, refreshToken: d.refreshToken });
    if (!isAdmin(em)) {
      const ok = await UI.run(Customers.save({ id: d.localId, name, email: em, mobile: mob, credit_limit: 0 }));
      if (ok === undefined) { Session.clear(); return; }
      Mail.send(em, name, "Welcome to " + CONFIG.APP_NAME, `Hi ${name}, your account is ready. Happy shopping!`);
    }
    start(d);
  });

  $("#rp").on("submit", async e => {
    e.preventDefault();
    const em = $("#rp_email").val().trim();
    if (!UI.errors("#e_rp", validate([[em, V.email, "Enter a valid email address."]]))) return;
    const d = await UI.run(Auth.resetPassword(em));
    if (d !== undefined) UI.msg("If this email is registered, a reset link has been sent.");
  });
});
