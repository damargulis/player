// --- Turning the library's file URLs back into paths the server can send.
//
// Tracks are stored as file:// URLs ("file:///Users/.../07%20%239%20Dream.mp3"). decodeURI was
// used to read them, but it leaves reserved escapes encoded — %23 stays "%23" rather than "#" —
// so the 54 tracks with a "#" in their name 404'd on the phone. decodeURIComponent decodes them.
// Paths added by drag-and-drop were stored unencoded, so a literal "%" in one of those makes
// decoding throw; such a path is already literal and is returned as it is.
function fileUrlToPath(fileUrl) {
  const raw = fileUrl.replace(/^file:\/\//, "");
  try {
    return decodeURIComponent(raw);
  } catch (err) {
    return raw;
  }
}

module.exports = {fileUrlToPath};
