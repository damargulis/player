const {allowSocketRequest, isLocalHostname, isRemoteAction} = require("../public/lanGuard");

function decide(origin, url = "/socket.io/?EIO=3&transport=polling") {
  let result;
  allowSocketRequest({headers: origin === undefined ? {} : {origin}, url}, (err, ok) => {
    result = ok;
  });
  return result;
}

/**
 * The LAN socket forwarded every action type to the renderer, so any device on the wifi — or any
 * web page, through socket.io's accept-every-origin default — could send "reset-library" and
 * delete the data directory. These pin both halves of the fix.
 */
describe("socket actions", () => {
  it("passes what the phone, the DJ web page and BareController send", () => {
    ["playTrack", "nextTrack", "prevTrack", "nextAlbum", "prevAlbum", "setTime", "setVolume",
      "set-system-volume", "set-system-muted", "favoriteTrack", "dj-message", "dj-new-session",
      "dj-remove", "dj-react", "dj-sync"].forEach((type) => {
      expect(isRemoteAction({type})).toBe(true);
    });
  });

  it("refuses the renderer channels a LAN device has no business reaching", () => {
    ["reset-library", "run-extension", "dj-run-tool", "get-synced-playlists", "get-dj-clue",
      "get-track", "toAlbum", "watchdog-ping", "cancel", "__proto__", "constructor"].forEach((type) => {
      expect(isRemoteAction({type})).toBe(false);
    });
  });

  it("refuses malformed actions instead of throwing", () => {
    [undefined, null, {}, {type: 5}, {type: ["playTrack"]}, "playTrack"].forEach((action) => {
      expect(isRemoteAction(action)).toBe(false);
    });
  });
});

describe("socket origins", () => {
  it("allows native clients, which send no Origin", () => {
    expect(decide(undefined)).toBe(true);
  });

  it("allows the DJ page however the server was reached", () => {
    ["http://192.168.1.20:4443", "http://10.0.0.5:4443", "http://172.20.3.4:4443",
      "http://localhost:4444", "http://127.0.0.1:4443", "http://Daniels-MacBook.local:4443",
      "http://[::1]:4443"].forEach((origin) => {
      expect(decide(origin)).toBe(true);
    });
  });

  it("refuses other sites, including a DNS-rebound one on the same port", () => {
    ["https://evil.example", "http://evil.example:4443", "http://192.168.1.20.evil.example",
      "http://8.8.8.8:4443", "http://172.32.0.1", "null", "not a url"].forEach((origin) => {
      expect(decide(origin)).toBe(false);
    });
  });

  it("only treats real IPv4 literals as private addresses", () => {
    expect(isLocalHostname("192.168.1.300")).toBe(false);
    expect(isLocalHostname("192.168.1")).toBe(false);
    expect(isLocalHostname("192.168.001.5")).toBe(true);
  });
});

describe("JSONP polling", () => {
  it("is refused even with no Origin, since a script tag on any site sends none", () => {
    expect(decide(undefined, "/socket.io/?EIO=3&transport=polling&j=0")).toBe(false);
    expect(decide("http://localhost:4444", "/socket.io/?EIO=3&transport=polling&j=0")).toBe(false);
  });
});
