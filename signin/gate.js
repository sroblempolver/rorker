// Sign-in screen for the build site while it is still on GitHub Pages: a page stays hidden and goes to
// /signin/ unless this browser is signed in with an allowed Rorker account. It stops anyone browsing in,
// but the files themselves can still be fetched directly; the full lock is the Vercel check (middleware.ts).
(function () {
  var ALLOWED = ["3a5d6dd290dab6c025e948d75a3ad3534628a7b3c44425e25a193800ba526053"]; // SHA-256 of each allowed email
  var root = document.documentElement;
  root.style.visibility = "hidden";
  function away(denied) {
    location.replace("/signin/?next=" + encodeURIComponent(location.pathname + location.search) + (denied ? "&denied=1" : "") + location.hash);
  }
  var s = null;
  try { s = JSON.parse(localStorage.getItem("rorker-build-auth") || "null"); } catch (e) {}
  var email = s && s.refresh_token && s.user && s.user.email;
  if (!email || !window.crypto || !crypto.subtle) return away(false);
  crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(email).toLowerCase())).then(function (buf) {
    var hex = Array.prototype.map.call(new Uint8Array(buf), function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    if (ALLOWED.indexOf(hex) >= 0) root.style.visibility = "";
    else away(true);
  }, function () { away(false); });
})();
