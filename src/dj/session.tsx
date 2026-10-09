import {
  ContentBlock,
  createMessage,
  DJApiError,
  getApiKey,
  MessageParam,
  ToolDefinition,
  ToolResultBlock,
  ToolUseBlock,
} from './api';
import DJPlaylist from '../playlist/DJPlaylist';
import {getMemoryStore, MCP_MEMORY_TOOL} from './memory';
import {getTrackById} from '../redux/selectors';
import store from '../redux/store';
import {describeQueue, DJ_TOOLS, ensureDJPlaylist, executeTool, formatTrack, startIfIdle, ToolOutcome} from './tools';
import {toTime} from '../utils';

export type EntryRole = 'user' | 'dj' | 'status' | 'error' | 'tool' | 'thinking';

/** Roles hidden unless the DJ page's verbose toggle is on. */
export const VERBOSE_ROLES: EntryRole[] = ['tool', 'thinking'];

export interface TranscriptEntry {
  id: number;
  role: EntryRole;
  text: string;
  /** Secondary text shown under `text` in the verbose view (e.g. a tool's result). */
  detail?: string;
}

export interface DJSessionState {
  entries: TranscriptEntry[];
  busy: boolean;
}

const MAX_TOOL_ROUNDS = 30;
/** Ask the DJ for more when this few tracks remain queued. */
const LOW_WATER_MARK = 2;
/** Turns older than this get their tool results blanked to keep the context small. */
const KEEP_TOOL_RESULT_TURNS = 2;
const ELIDED = '[earlier tool output elided]';
const MEMORY_TOOL_NAME = 'memory';
/** The API path gets Anthropic's native memory tool; the MCP path gets the same backend as a plain tool. */
const NATIVE_MEMORY_TOOL: ToolDefinition = {type: 'memory_20250818', name: MEMORY_TOOL_NAME};
/** Server-side web search: runs on Anthropic's side, so there is nothing for us to execute. */
const WEB_SEARCH_TOOL: ToolDefinition = {max_uses: 5, name: 'web_search', type: 'web_search_20260209'};
const API_TOOLS: ToolDefinition[] = ([NATIVE_MEMORY_TOOL, WEB_SEARCH_TOOL] as ToolDefinition[]).concat(DJ_TOOLS);
export const MCP_TOOLS = DJ_TOOLS.concat([MCP_MEMORY_TOOL]);

function runTool(name: string, input: Record<string, unknown>): ToolOutcome {
  return name === MEMORY_TOOL_NAME ? getMemoryStore().execute(input) : executeTool(name, input);
}

const SYSTEM_PROMPT = `You are the DJ for a personal music library inside a desktop music player. The listener chats with you in a small side panel; you control what plays by editing a queue with tools.

How it works
- The library is the listener's own mp3 collection. You can only play tracks that exist in it, and you can only reference them by the ids the tools return. Never invent ids.
- You know a lot about music: use artist, album, title, year and genre to judge energy, mood, tempo and era. Play counts, skip counts and ♥ favorites tell you what the listener loves. "unplayed" tracks are fair game for discovery but don't lean on them too hard.
- The queue is live. The current track keeps playing while you rewrite what comes next. set_queue replaces everything after the current track; add_to_queue/remove_from_queue make smaller edits. Prefer editing over replacing when the listener makes a small refinement.
- When the queue runs low you'll get an automatic "[Queue update]" notice. Top it up (another 6-10 tracks) in the same spirit as the current vibe, then reply in a few words.
- Each listener message may start with a "[Playback update]" block saying what played fully or was skipped since your last turn. Treat skips as feedback.

Working style
- Start by exploring: sample_tracks with a genre/era filter, list_artists for a genre, search_library for specific names. For long stretches (working, studying, a lazy afternoon) or when the listener asks for full albums, think in albums instead: search_albums to browse, then queue_albums — it queues every track in album order so nothing is missed. Two to four albums is a good work session. The library is a few thousand albums, so don't try to list everything. A few well-chosen calls are enough; then set the queue.
- For a fresh request, queue about 8-12 tracks. Build flow: think about transitions, pacing and variety (don't stack one artist unless asked).
- Don't repeat tracks already played this session unless the listener asks.
- If the library doesn't have what they're asking for, say so briefly and offer the closest thing it does have.
- Keep replies short and conversational (one to three sentences). The panel already shows the queue, so don't list every track — mention the direction you took and maybe a highlight.

Memory
- Your memory directory persists across sessions and is shared with the listener (they can read and edit it on the DJ page). ALWAYS view it before your first picks of a session, so you start from everything you already know.
- Be thorough. Anything that would make a future set better belongs in memory, and the listener would rather you over-record than lose something. As you learn them, write down:
  - People: the listener and anyone they listen with (partner, friends, family) — what each one loves, tolerates and refuses, and what works when they listen together.
  - Taste: favourite artists, albums and songs; genres and eras they lean on; artists they skip; textures they react to (harsh vocals, long instrumentals, live recordings, lo-fi, loudness).
  - Contexts: what works for recurring situations — working, cooking, cleaning, winding down, parties, driving, hosting — including any tempo/vocal/volume constraints they've named.
  - Reactions: specific tracks or albums that landed especially well or badly, with your read on why. A skip streak you diagnosed is worth a line.
  - Vocabulary: what their words mean for this library ("mellow", "upbeat", "something new", "the usual"), so you interpret them the same way next time.
  - Sets: a short log in sets.md — date, what they asked for, what you played, how it went. Keep roughly the last ten.
- Suggested layout: /memories/people/<name>.md, /memories/taste.md, /memories/contexts.md, /memories/reactions.md, /memories/sets.md. Keep it tidy and each file to a few KB: use str_replace to update or correct an existing line rather than appending something contradictory, and delete notes that turned out to be wrong.
- Don't record one-off requests ("play X right now"), the current queue, or anything sensitive.

Looking things up
- You also have web_search. Use it sparingly, when your own knowledge is thin and it would change your picks: checking what a specific album actually sounds like, what else came out of a scene, what a band's quieter record is. Never search for something the library tools can answer, and don't let a search delay the first tracks — queue something good, then refine.

- Save in the same turn you learn something — the listener may close the app at any moment.`;

function textOf(blocks: ContentBlock[]): string {
  return blocks.filter((b) => b.type === 'text').map((b) => (b.type === 'text' ? b.text : '')).join('\n').trim();
}

/** One-line rendering of a tool's input for the verbose transcript. */
function compact(input: Record<string, unknown>): string {
  const json = JSON.stringify(input);
  if (json === '{}') {
    return '';
  }
  return json.length > 160 ? `${json.slice(0, 160)}…` : json;
}

function formatClock(): string {
  return new Date().toLocaleString(undefined, {hour: 'numeric', minute: '2-digit', weekday: 'short'});
}

class DJSession {
  private messages: MessageParam[] = [];
  private entries: TranscriptEntry[] = [];
  private busy = false;
  private nextId = 1;
  private listeners: Set<() => void> = new Set();
  private pending: Array<{text: string; automatic: boolean}> = [];
  private playbackEvents: string[] = [];
  /** Consecutive skips with no full play in between — the "wrong vibe" signal. */
  private recentSkips = 0;
  private lastTrackId: string | undefined;
  private lastTime = 0;
  private refillRequestedAt: string | undefined;

  constructor() {
    store.subscribe(() => this.onStoreChange());
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getState(): DJSessionState {
    return {busy: this.busy, entries: this.entries};
  }

  public isActive(): boolean {
    return store.getState().currentlyPlaying.playlist instanceof DJPlaylist;
  }

  /** Forget the conversation and detach from the queue (whatever is playing keeps playing). */
  public reset(): void {
    this.messages = [];
    this.entries = [];
    this.pending = [];
    this.playbackEvents = [];
    this.refillRequestedAt = undefined;
    this.emit();
  }

  /**
   * Runs a tool on behalf of an external DJ (Claude Code over MCP, see dj-mcp/server.js).
   * Queue edits take over playback the same way an in-app chat message does, and get_queue
   * carries the played/skipped feedback that the in-app chat would otherwise prepend.
   */
  public runExternalTool(name: string, input: Record<string, unknown>): ToolOutcome {
    if (name === '_status') {
      return {content: JSON.stringify(this.getStatus())};
    }
    const outcome = runTool(name, input);
    if (name === 'get_queue' && this.playbackEvents.length) {
      outcome.content = `Since your last check (${formatClock()}):\n${this.playbackEvents.join('\n')}\n\n${outcome.content}`;
      this.consumeFeedback();
    }
    if (name === MEMORY_TOOL_NAME) {
      this.emit(); // memory view in the DJ page re-reads the files
    }
    return outcome;
  }

  /**
   * Compact transcript for the mobile DJ screen: the conversation only (no tool noise),
   * newest last, plus whether a turn is in flight and whether a key is configured.
   */
  public getChatState(limit: number = 40): Record<string, unknown> {
    const entries = this.entries.filter((entry) => !VERBOSE_ROLES.includes(entry.role));
    return {
      busy: this.busy,
      configured: Boolean(getApiKey()),
      entries: entries.slice(-limit).map((entry) => ({id: entry.id, role: entry.role, text: entry.text})),
      hasSession: this.messages.length > 0,
    };
  }

  /** Machine-readable queue state, used by the MCP bridge's wait tool and electron.js's auto-refill watcher. */
  public getStatus(): Record<string, unknown> {
    const state = store.getState();
    const playlist = state.currentlyPlaying.playlist;
    if (!(playlist instanceof DJPlaylist)) {
      return {active: false, hasInAppConversation: this.messages.length > 0};
    }
    const upcoming = playlist.getUpcoming();
    const currentId = state.currentlyPlaying.currentlyPlayingId || undefined;
    const current = currentId ? getTrackById(state, currentId) : undefined;
    let remainingMs = current ? Math.max(0, current.duration - state.currentlyPlaying.time * 1000) : 0;
    upcoming.forEach((id) => {
      const track = getTrackById(state, id);
      remainingMs += track ? track.duration : 0;
    });
    return {
      active: true,
      currentTrackId: currentId || null,
      hasInAppConversation: this.messages.length > 0,
      isPlaying: state.currentlyPlaying.isPlaying,
      pendingEvents: this.playbackEvents.length,
      recentSkips: this.recentSkips,
      remainingSeconds: Math.round(remainingMs / 1000),
      upcoming: upcoming.length,
    };
  }

  public send(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    this.enqueue(trimmed, false);
  }

  /** Adds the thinking and web-search entries that the verbose view shows. */
  private recordVerbose(content: ContentBlock[]): void {
    content.forEach((block) => {
      if (block.type === 'thinking' && block.thinking) {
        this.addEntry('thinking', block.thinking);
      } else if (block.type === 'server_tool_use') {
        this.addEntry('tool', `${block.name} ${compact(block.input || {})}`, '(ran on Anthropic\'s servers)');
      }
    });
  }

  /** Puts an API failure in the transcript, and in front of the listener when they need to act. */
  private reportFailure(err: unknown): void {
    if (err instanceof DJApiError) {
      this.addEntry('error', `${err.headline()} (HTTP ${err.status}${err.errorType ? ` ${err.errorType}` : ''})`,
        err.message);
      if (err.needsAttention()) {
        alert(`${err.headline()}\n\n${err.message}`);
      }
      return;
    }
    this.addEntry('error', `The DJ hit an unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  }

  /**
   * Marks the pending play/skip feedback as delivered. Clearing the skip streak here (rather than on
   * the next full play) is what stops a single bad patch from waking the DJ over and over.
   */
  private consumeFeedback(): void {
    this.playbackEvents = [];
    this.recentSkips = 0;
  }

  private enqueue(text: string, automatic: boolean): void {
    this.pending.push({automatic, text});
    if (!this.busy) {
      this.drain();
    }
  }

  private async drain(): Promise<void> {
    this.busy = true;
    this.emit();
    while (this.pending.length) {
      const next = this.pending.shift() as {text: string; automatic: boolean};
      await this.runTurn(next.text, next.automatic);
    }
    this.busy = false;
    this.emit();
  }

  private buildUserText(text: string, automatic: boolean): string {
    const parts: string[] = [];
    if (this.playbackEvents.length) {
      parts.push(`[Playback update — ${formatClock()}]\n${this.playbackEvents.join('\n')}`);
      this.consumeFeedback();
    }
    if (automatic) {
      parts.push(`[Queue update — ${formatClock()}]\n${text}\n\n${describeQueue(store.getState())}`);
    } else {
      if (!this.messages.length) {
        parts.push(`[It is ${formatClock()}]`);
      }
      parts.push(text);
    }
    return parts.join('\n\n');
  }

  private async runTurn(text: string, automatic: boolean): Promise<void> {
    ensureDJPlaylist();
    this.addEntry(automatic ? 'status' : 'user', automatic ? 'Queue running low — asking the DJ for more…' : text);
    this.elideOldToolResults();
    this.messages.push({content: [{type: 'text', text: this.buildUserText(text, automatic)}], role: 'user'});
    try {
      let finished = false;
      for (let round = 0; round < MAX_TOOL_ROUNDS && !finished; round++) {
        const response = await createMessage({messages: this.messages, system: SYSTEM_PROMPT, tools: API_TOOLS});
        this.messages.push({content: response.content, role: 'assistant'});
        this.recordVerbose(response.content);
        const reply = textOf(response.content);
        if (response.stop_reason === 'refusal') {
          const explanation = (response.stop_details && response.stop_details.explanation) || 'no reason given';
          this.addEntry('error', `The DJ declined: ${explanation}`);
          break;
        }
        if (response.stop_reason === 'pause_turn') {
          // A server-side tool (web search) ran long; send the turn back to continue it.
          continue;
        }
        if (response.stop_reason === 'tool_use') {
          if (reply) {
            this.addEntry('dj', reply);
          }
          const toolUses = response.content.filter((b) => b.type === 'tool_use') as ToolUseBlock[];
          const results: ToolResultBlock[] = toolUses.map((use) => {
            const input = use.input || {};
            const outcome = runTool(use.name, input);
            this.addEntry(outcome.isError ? 'error' : 'tool', `${use.name} ${compact(input)}`, outcome.content);
            return {
              content: outcome.content,
              is_error: outcome.isError || undefined,
              tool_use_id: use.id,
              type: 'tool_result',
            };
          });
          this.messages.push({content: results, role: 'user'});
          continue;
        }
        this.addEntry('dj', reply || (response.stop_reason === 'max_tokens' ? '(reply cut off)' : '(no reply)'));
        finished = true;
      }
      if (!finished) {
        this.addEntry('status', `The DJ stopped after ${MAX_TOOL_ROUNDS} tool rounds.`);
      }
    } catch (err) {
      // Drop the dangling user turn so the next message starts clean.
      const last = this.messages[this.messages.length - 1];
      if (last && last.role === 'user') {
        this.messages.pop();
      }
      this.reportFailure(err);
    }
    startIfIdle();
  }

  /** Blank out tool results from older turns; the queue state they described is stale anyway. */
  private elideOldToolResults(): void {
    let userTurnsSeen = 0;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const msg = this.messages[i];
      if (msg.role !== 'user') {
        continue;
      }
      const isToolResult = msg.content.some((b) => b.type === 'tool_result');
      if (!isToolResult) {
        userTurnsSeen++;
        continue;
      }
      if (userTurnsSeen >= KEEP_TOOL_RESULT_TURNS) {
        msg.content = msg.content.map((b) => (b.type === 'tool_result' && b.content !== ELIDED ?
          Object.assign({}, b, {content: ELIDED}) : b));
      }
    }
  }

  private onStoreChange(): void {
    const state = store.getState();
    const playlist = state.currentlyPlaying.playlist;
    if (!(playlist instanceof DJPlaylist)) {
      this.lastTrackId = undefined;
      return;
    }
    const currentId = state.currentlyPlaying.currentlyPlayingId || undefined;
    if (currentId !== this.lastTrackId) {
      this.recordTrackChange(this.lastTrackId, currentId, playlist);
      this.lastTrackId = currentId;
      this.lastTime = 0;
      this.maybeRefill(playlist, currentId);
    } else {
      this.lastTime = state.currentlyPlaying.time;
    }
  }

  private recordTrackChange(prevId: string | undefined, nextId: string | undefined, playlist: DJPlaylist): void {
    const state = store.getState();
    const prev = prevId ? getTrackById(state, prevId) : undefined;
    if (prev) {
      const finished = this.lastTime * 1000 >= prev.duration - 5000;
      const elapsed = toTime(this.lastTime * 1000);
      const wentBack = nextId !== undefined && playlist.getHistory().slice(0, -1).includes(nextId);
      if (wentBack) {
        this.playbackEvents.push(`Went back (after ${elapsed}): ${formatTrack(state, prev)}`);
      } else if (finished) {
        this.recentSkips = 0;
        this.playbackEvents.push(`Played fully: ${formatTrack(state, prev)}`);
      } else {
        this.recentSkips++;
        this.playbackEvents.push(`Skipped after ${elapsed}: ${formatTrack(state, prev)}`);
      }
    }
  }

  private maybeRefill(playlist: DJPlaylist, currentId: string | undefined): void {
    if (!this.messages.length || !currentId || this.refillRequestedAt === currentId) {
      return;
    }
    const remaining = playlist.getUpcoming().length;
    if (remaining <= LOW_WATER_MARK && !this.pending.some((p) => p.automatic)) {
      this.refillRequestedAt = currentId;
      this.enqueue(`Only ${remaining} track(s) left in the queue. Add more in the same spirit.`, true);
    }
  }

  private addEntry(role: EntryRole, text: string, detail?: string): void {
    this.entries = this.entries.concat([{detail, id: this.nextId++, role, text}]);
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}

const session = new DJSession();
export default session;
