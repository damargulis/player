#!/usr/bin/env node
// Zero-dependency MCP server (stdio transport) that exposes the running MyMusic
// app's DJ tools to Claude Code. Every tool call is forwarded to the app's HTTP
// server (public/electron.js → renderer src/dj/tools.tsx). Registered in .mcp.json.
//
// Runs on the system Node (18+ for fetch), not inside Electron.
//
// Which app? The packaged app listens on 4443 and the dev app (`yarn electron-dev`) on 4444.
// Set MYMUSIC_DJ_PORT to pin one (e.g. `MYMUSIC_DJ_PORT=4444 claude` to DJ the dev build);
// otherwise the packaged app wins if both are running. Every get_queue result names the target.

const APPS = {4443: "packaged app", 4444: "dev app"};
const PINNED_PORT = process.env.MYMUSIC_DJ_PORT ? Number(process.env.MYMUSIC_DJ_PORT) : null;
const PORTS = PINNED_PORT ? [PINNED_PORT] : [4443, 4444];
const LOW_WATER_DEFAULT = 2;
const SKIP_THRESHOLD_DEFAULT = 2;
const POLL_MS = 5000;

let baseUrl = null;
let connectedTo = null;

function describeTarget() {
  return connectedTo || "MyMusic";
}

async function findApp() {
  if (baseUrl) {
    return baseUrl;
  }
  for (const port of PORTS) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/dj/tools`);
      if (res.ok) {
        baseUrl = `http://127.0.0.1:${port}`;
        connectedTo = `MyMusic ${APPS[port] || "app"} on port ${port}`;
        process.stderr.write(`mymusic-dj: connected to ${connectedTo}\n`);
        return baseUrl;
      }
    } catch (err) {
      // try the next port
    }
  }
  const where = PINNED_PORT ? `on port ${PINNED_PORT} (MYMUSIC_DJ_PORT)` : "on port 4443 (packaged) or 4444 (dev)";
  throw new Error(`MyMusic isn't running ${where}, or its DJ bridge isn't up. Start the app and try again.`);
}

async function appGet(path) {
  const res = await fetch(`${await findApp()}${path}`);
  if (!res.ok) {
    baseUrl = null;
    throw new Error(`${describeTarget()} returned ${res.status} for ${path}`);
  }
  return res.json();
}

async function runAppTool(name, input) {
  const url = `${await findApp()}/dj/tool`;
  const res = await fetch(url, {
    body: JSON.stringify({name, input}),
    headers: {"content-type": "application/json"},
    method: "POST",
  });
  if (!res.ok) {
    baseUrl = null;
    throw new Error(`${describeTarget()} returned ${res.status} running ${name}`);
  }
  const outcome = await res.json();
  if (name === "get_queue") {
    outcome.content = `[Connected to ${describeTarget()}]\n${outcome.content}`;
  }
  return outcome;
}

const WAIT_TOOL = {
  description: "Block until the set needs you, then return the queue (with play/skip feedback). Wakes when the " +
    "upcoming queue runs low OR when the listener skips several tracks in a row, which means the vibe is wrong " +
    "and you should change direction rather than just top up. Call this after you've set the queue so you can " +
    "keep the set going; the listener can interrupt you at any time with a new message. Returns early with a " +
    "note if the DJ queue stops being active.",
  inputSchema: {
    properties: {
      low_water_mark: {
        description: `Wake when this many or fewer tracks remain (default ${LOW_WATER_DEFAULT})`,
        type: "integer",
      },
      skip_threshold: {
        description: `Wake after this many consecutive skips; 0 disables (default ${SKIP_THRESHOLD_DEFAULT})`,
        type: "integer",
      },
      timeout_seconds: {type: "integer", description: "Give up after this long (default 600, max 1500)"},
    },
    type: "object",
  },
  name: "wait_for_queue_low",
};

async function waitForQueueLow(input) {
  const lowWater = Number.isInteger(input.low_water_mark) ? input.low_water_mark : LOW_WATER_DEFAULT;
  const skipThreshold = Number.isInteger(input.skip_threshold) ? input.skip_threshold : SKIP_THRESHOLD_DEFAULT;
  const timeout = Math.min(1500, Math.max(5, Number(input.timeout_seconds) || 600)) * 1000;
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const status = JSON.parse((await runAppTool("_status", {})).content);
    if (!status.active) {
      return {content: "The DJ queue is no longer active (something else took over playback).", isError: false};
    }
    // get_queue carries the play/skip feedback and clears the skip streak, so each streak wakes you once.
    if (skipThreshold > 0 && status.recentSkips >= skipThreshold) {
      const queue = await runAppTool("get_queue", {});
      queue.content = `Woke you early: ${status.recentSkips} tracks skipped in a row, so the current ` +
        `direction is not landing. Change what is queued rather than topping it up in the same vein — ` +
        `use the skipped tracks below as the clue.\n\n${queue.content}`;
      return queue;
    }
    if (status.upcoming <= lowWater) {
      return runAppTool("get_queue", {});
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  const queue = await runAppTool("get_queue", {});
  queue.content = `Timed out after ${timeout / 1000}s; the queue is still healthy.\n\n${queue.content}`;
  return queue;
}

async function listTools() {
  const tools = await appGet("/dj/tools");
  return tools.map((tool) => ({
    description: tool.description,
    inputSchema: tool.input_schema,
    name: tool.name,
  })).concat([WAIT_TOOL]);
}

async function callTool(params) {
  const name = params.name;
  const input = params.arguments || {};
  const outcome = name === WAIT_TOOL.name ? await waitForQueueLow(input) : await runAppTool(name, input);
  return {
    content: [{type: "text", text: outcome.content}],
    isError: Boolean(outcome.isError),
  };
}

async function handle(request) {
  switch (request.method) {
  case "initialize":
    return {
      capabilities: {tools: {}},
      protocolVersion: request.params && request.params.protocolVersion || "2025-06-18",
      serverInfo: {name: "mymusic-dj", version: "0.1.0"},
    };
  case "ping":
    return {};
  case "tools/list":
    return {tools: await listTools()};
  case "tools/call":
    return callTool(request.params || {});
  default:
    throw Object.assign(new Error(`Method not found: ${request.method}`), {code: -32601});
  }
}

function send(message) {
  process.stdout.write(JSON.stringify(message) + "\n");
}

async function onMessage(line) {
  let request;
  try {
    request = JSON.parse(line);
  } catch (err) {
    return send({error: {code: -32700, message: "Parse error"}, id: null, jsonrpc: "2.0"});
  }
  if (request.id === undefined) {
    return; // notification (e.g. notifications/initialized) — nothing to answer
  }
  try {
    send({id: request.id, jsonrpc: "2.0", result: await handle(request)});
  } catch (err) {
    if (request.method === "tools/call") {
      // Tool failures go back as tool results so the model can react (e.g. "app isn't running").
      send({id: request.id, jsonrpc: "2.0", result: {content: [{type: "text", text: err.message}], isError: true}});
    } else {
      send({error: {code: err.code || -32603, message: err.message}, id: request.id, jsonrpc: "2.0"});
    }
  }
}

let buffer = "";
let pending = 0;
let stdinEnded = false;

function exitWhenDrained() {
  if (stdinEnded && pending === 0) {
    process.exit(0);
  }
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (line) {
      pending++;
      onMessage(line).finally(() => {
        pending--;
        exitWhenDrained();
      });
    }
  }
});
process.stdin.on("end", () => {
  stdinEnded = true;
  exitWhenDrained();
});
