// --- The main process's half of src/devSafety.tsx: what a development copy may do on its own.
//
// Off in development unless MYMUSIC_DEV_EFFECTS names it (comma-separated, or "all"); always on
// in the installed app. Keep the rules the same as the renderer's.
//
// bonjour   - advertising "MyMusic" on the network. A dev copy doing it could be found by the
//             phone, which would then sync its plays into the dev library and clear them.
// shortcuts - the global Cmd+8/9/0. A dev copy took them from the installed app while it ran.
function externalEffectsAllowed(effect, isDev, env = process.env) {
  if (!isDev) {
    return true;
  }
  const allowed = (env.MYMUSIC_DEV_EFFECTS || "").split(",").map((part) => part.trim());
  return allowed.includes("all") || allowed.includes(effect);
}

module.exports = {externalEffectsAllowed};
