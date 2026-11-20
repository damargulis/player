// --- What the LAN socket may do, and who may open it.
//
// The socket's "action" events used to be forwarded to the renderer whatever their type, and the
// renderer listens for far more than the phone sends: "reset-library" deleted the whole data
// directory, "run-extension" starts hours of API calls, "dj-run-tool" writes the DJ's memory. Any
// device on the wifi could send them, and so could a web page, since socket.io 2.3 accepts every
// Origin by default. These are the only types the phone, the DJ web page and BareController send.
const REMOTE_ACTIONS = new Set([
  "playTrack",
  "nextTrack",
  "prevTrack",
  "nextAlbum",
  "prevAlbum",
  "setTime",
  "setVolume",
  "set-system-volume",
  "set-system-muted",
  "favoriteTrack",
  "dj-message",
  "dj-new-session",
  "dj-remove",
  "dj-react",
  "dj-sync",
]);

function isRemoteAction(action) {
  return !!action && typeof action.type === "string" && REMOTE_ACTIONS.has(action.type);
}

// Hostnames a page talking to this server legitimately has: the DJ page is served by this server
// and opened by IP, by the bonjour .local name, or as localhost in dev. A page on any other host
// is somebody else's site. Matching hostnames, never "same port", is what defeats DNS rebinding:
// a rebound attacker page keeps its own domain name in the Origin.
function isLocalHostname(hostname) {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "::1") {
    return true;
  }
  const octets = host.split(".");
  if (octets.length !== 4 || !octets.every((part) => /^\d{1,3}$/.test(part) && Number(part) < 256)) {
    return false;
  }
  const [a, b] = octets.map(Number);
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 169 && b === 254);
}

// engine.io's allowRequest hook, which replaces socket.io's own origin check. No Origin header is
// allowed: native clients (the Android app) send none, and a browser omits it on a same-origin
// GET poll. A cross-site page always sends one. "null" is refused rather than read as "none" —
// socket.io's default check treats the two alike, and a sandboxed iframe on any site sends "null".
//
// JSONP polling (`j=` in the query) is refused outright. engine.io only runs this check on the
// handshake, and a <script> tag on any site can make that handshake with no Origin at all and,
// JSONP being script, read the session id out of the reply; later requests carrying that id are
// never checked, so the site could then post actions freely. engine.io 3.4 has no option to turn
// JSONP off — passing `jsonp: false` was tried and verified to do nothing. No client uses it.
function allowSocketRequest(req, callback) {
  if (wantsJsonp(req)) {
    callback("jsonp not allowed", false);
    return;
  }
  const origin = req.headers.origin;
  if (origin === undefined) {
    callback(null, true);
    return;
  }
  let allowed = false;
  try {
    allowed = isLocalHostname(new URL(origin).hostname);
  } catch (err) {
    allowed = false;
  }
  callback(allowed ? null : "origin not allowed", allowed);
}

function wantsJsonp(req) {
  try {
    return new URL(req.url || "", "http://localhost").searchParams.has("j");
  } catch (err) {
    return true;
  }
}

module.exports = {
  REMOTE_ACTIONS,
  allowSocketRequest,
  isLocalHostname,
  isRemoteAction,
};
