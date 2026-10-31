// Meta (Facebook) Pixel, only with the visitor's permission.
// - Off until META_PIXEL_ID is set in firebase-config.js, and only on the real site.
// - Asks first ("Allow / No thanks"); the choice is remembered on this device and can be changed from the footer.
// - Sends no names, emails or phone numbers (no advanced matching, no automatic events).
// - Only reports public pages: never chats, messages, profile, admin, ID checks or email links.
import { META_PIXEL_ID } from "./firebase-config.js?v=1793275000";

const KEY = "jsph-ads-consent";
const PUBLIC = /^#?\/?($|job\/|jobs|post|join\/|signin|safety|terms|privacy|support)/;
let loaded = false;

const choice = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const remember = (v) => { try { localStorage.setItem(KEY, v); } catch {} };
// Pages whose address could hold something private (email codes, chat or account ids) are never reported.
const safePage = () => !/[?&](oobCode|mode)=/.test(location.search) && PUBLIC.test(location.hash || "#/");

function load() {
  if (loaded || !META_PIXEL_ID) return;
  loaded = true;
  /* Meta's standard loader */
  !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0;
    t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  window.fbq("set", "autoConfig", false, META_PIXEL_ID); // no automatic button tracking or advanced matching
  window.fbq("init", META_PIXEL_ID);
  pageView();
  window.addEventListener("hashchange", pageView);
}
let last = "", lastAt = 0;
function pageView() {
  if (!loaded || !safePage()) return;
  const page = location.hash || "#/";
  if (page === last && Date.now() - lastAt < 3000) return; // redirects can fire twice for the same page
  last = page; lastAt = Date.now();
  window.fbq("track", "PageView");
}

// Called by the app when something worth measuring happens: "CompleteRegistration", "SubmitApplication", "Lead".
export function track(event, data = {}) {
  if (!loaded || !window.fbq) return;
  const clean = Object.fromEntries(Object.entries(data).filter(([k]) => ["content_name", "content_category"].includes(k)));
  window.fbq("track", event, clean);
}

function banner() {
  if (document.getElementById("ads-consent")) return;
  const el = document.createElement("div");
  el.id = "ads-consent"; el.className = "consent"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Cookies");
  el.innerHTML = `<p>We use cookies to improve Job Search PH. <a href="#/privacy">Learn more</a></p>
    <div class="consent-actions"><button type="button" class="btn btn-ghost btn-sm" data-c="no">No thanks</button><button type="button" class="btn btn-primary btn-sm" data-c="yes">Allow</button></div>`;
  el.addEventListener("click", (e) => {
    const b = e.target.closest("[data-c]"); if (!b) return;
    remember(b.dataset.c); el.remove();
    if (b.dataset.c === "yes") load();
  });
  document.body.appendChild(el);
}

// Footer link "Cookies" lets people change their mind.
export function openConsent() { if (!META_PIXEL_ID) return; try { localStorage.removeItem(KEY); } catch {} if (loaded) location.reload(); else banner(); }

export function initPixel() {
  if (!META_PIXEL_ID) return;
  const c = choice();
  if (c === "yes") load();
  else if (c !== "no") {
    // Ask after the page has settled, and not on admin pages.
    setTimeout(() => { if (!/^#\/admin/.test(location.hash)) banner(); }, 1500);
  }
  const link = document.getElementById("consent-link"); if (link) { link.hidden = false; link.addEventListener("click", (e) => { e.preventDefault(); openConsent(); }); }
}
