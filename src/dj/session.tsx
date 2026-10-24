import {DJ_QUEUE_UPDATED} from '../redux/actionTypes';
import activity from './activity';
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
import DJPlaylist, {DJ_ACTOR} from '../playlist/DJPlaylist';
import {getMemoryStore, MCP_MEMORY_TOOL} from './memory';
import {OWNER} from './owner';
import {Reaction} from '../reactions';
import {getAlbumById, getTrackById} from '../redux/selectors';
import store, {RootState} from '../redux/store';
import {
  describeQueue,
  DJ_TOOLS,
  ensureDJPlaylist,
  executeTool,
  formatTrack,
  queueSnapshot,
  recentlyPlayedBrief,
  startIfIdle,
  ToolOutcome,
} from './tools';
import {toTime} from '../utils';

export type EntryRole = 'user' | 'dj' | 'status' | 'error' | 'tool' | 'thinking';

/** Roles hidden unless the DJ page's verbose toggle is on. */
export const VERBOSE_ROLES: EntryRole[] = ['tool', 'thinking'];

export {OWNER};

export interface TranscriptEntry {
  id: number;
  role: EntryRole;
  text: string;
  /** Who sent a 'user' entry. Absent on the DJ's own entries. */
  speaker?: string;
  /** Secondary text shown under `text` in the verbose view (e.g. a tool's result). */
  detail?: string;
}

export interface DJSessionState {
  entries: TranscriptEntry[];
  busy: boolean;
  /** What the DJ is doing right now — its latest reasoning summary or the tool it is running. */
  note?: string;
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
- now_playing is read-only and safe before you have queued anything — call it first. It gives the current track, the listening context (local time and day, volume, how much this set has played, how long the room has been idle or paused) and what the app already had queued (your first edit inherits that rather than discarding it, and never interrupts the current track).
- recent_plays shows what they have been playing lately across the whole library, not just this set — useful for "more of what I've been into" and for not repeating yesterday. library_stats profiles the library (size, top genres and artists by plays, favorites per year, how much is unplayed, what was added recently); call it once early if you have no memory of this listener yet.
- sample_tracks takes added_within_days, which is the honest way to answer "play me something new".
- When the queue runs low you'll get an automatic "[Queue update]" notice. Top it up (another 6-10 tracks) in the same spirit as the current vibe, then reply in a few words.
- More than one person uses this. Each message is labelled "[From <name>]" — ${OWNER} is at the desktop, others chat from their phones. Pay attention to who is asking: their tastes differ, and what works for one of them alone is not what works when they are listening together. Address whoever just spoke, and keep per-person notes in memory.
- Each listener message may start with a "[Playback update]" block saying what played fully, what was skipped, and what was removed from the queue by hand since your last turn. Skips and removals name whoever did them, so you can tell a track ${OWNER} skipped from one someone else did — that is a per-person signal worth keeping in memory, not a blanket rejection. It distinguishes skipping one track from skipping the rest of an album ("skipped the rest of X — N queued tracks dropped"), which in album mode is a rejection of the record rather than the song — react to it by changing the album, not the track. Skips and especially removals are the strongest feedback you get — react to them rather than re-queueing more of the same.
- You can see upcoming shows near the listener, but only in a few places: an artist's own entry (get_artist, list_artists) and the views of what is already playing or queued (now_playing, get_queue). It is deliberately absent from search_library, sample_tracks and search_albums, because those are how you choose what to play.
- A tour date is colour, never criteria. Never pick a track because the artist is touring, never build a set around who happens to be playing, and never let it break a tie. If you would not have queued it otherwise, don't.
- Mention a show when it comes up naturally — something you already queued turns out to be playing nearby — and at most once or twice in a set. One well-placed "he's at Webster Hall in three weeks, by the way" is worth more than a running listings column.
- The concerts tool is for when they ask: what's coming up, or warming them up for a gig they're going to. Don't call it to plan an ordinary set.
- If they say they're going to something, that belongs in memory.
- The like button is the clearest "yes" you will get; it shows up in the playback update. ${OWNER}'s is the library's own favourite (a bare ♥ on a track line). Anyone listening from a phone has their own like and dislike, shown as ♥name and ✗name — those are that person's verdict alone, so a ✗ means don't queue it for them again and read it as a hint about similar tracks, not a verdict for the household. Note what landed and why you think it did.
- Watch the context and room lines in get_queue/now_playing. A long pause with no input means nobody is listening: don't keep burning through good tracks into an empty room. Rapid skips mean you are wrong right now.

Working style
- Start by exploring: sample_tracks with a genre/era filter, list_artists for a genre, search_library for specific names. For long stretches (working, studying, a lazy afternoon) or when the listener asks for full albums, think in albums instead: search_albums to browse, then queue_albums — it queues every track in album order so nothing is missed. Two to four albums is a good work session. The library is a few thousand albums, so don't try to list everything. A few well-chosen calls are enough; then set the queue.
- For a fresh request, queue about 8-12 tracks. Build flow: think about transitions, pacing and variety (don't stack one artist unless asked).
- Don't repeat tracks already played this session unless the listener asks.
- The first message of a session already lists what was played in the last few days — steer around it. Anything they have heard that recently is the most likely to feel stale, even when it is something they love, so leave it out unless they ask for that artist, album or song by name. A favourite they haven't played in months is still a great pick; the point is not to serve back the same handful of records every time. recent_plays goes further back if you want more.
- If the library doesn't have what they're asking for, say so briefly and offer the closest thing it does have.
- Keep replies short and conversational (one to three sentences). The panel already shows the queue, so don't list every track — mention the direction you took and maybe a highlight.

Memory
- Your memory directory persists across sessions and is shared with the listener (they can read and edit it on the DJ page). ALWAYS view it before your first picks of a session, so you start from everything you already know.
- Sessions are short and start often — any of them can begin a new one from the app or from a phone, and when they do this whole conversation is gone. There is no end-of-session moment to write things up, and no warning before it happens. Memory is the only thing that survives, so write as you go: the moment you learn something, save it in that same turn, before you queue the next thing. Err heavily towards recording. If you are weighing whether something is worth keeping, keep it — a slightly cluttered note costs nothing next to losing what you learned. As you learn them, write down:
  - People: the listener and anyone they listen with (partner, friends, family) — what each one loves, tolerates and refuses, and what works when they listen together.
  - Taste: favourite artists, albums and songs; genres and eras they lean on; artists they skip; textures they react to (harsh vocals, long instrumentals, live recordings, lo-fi, loudness).
  - Contexts: what works for recurring situations — working, cooking, cleaning, winding down, parties, driving, hosting — including any tempo/vocal/volume constraints they've named.
  - Reactions: specific tracks or albums that landed especially well or badly, with your read on why. A skip streak you diagnosed is worth a line.
  - Vocabulary: what their words mean for this library ("mellow", "upbeat", "something new", "the usual"), so you interpret them the same way next time.
  - Sets: a short log in sets.md — date, what they asked for, what you played, how it went. Keep roughly the last ten.
- Suggested layout: /memories/people/<name>.md, /memories/taste.md, /memories/contexts.md, /memories/reactions.md, /memories/sets.md. Keep it tidy and each file to a few KB: use str_replace to update or correct an existing line rather than appending something contradictory, and delete notes that turned out to be wrong.
- Don't record one-off requests ("play X right now"), the current queue, or anything sensitive.
- Also worth a line whenever it happens: a correction they make, a word they use for a sound, a reaction you did not expect, who was in the room, and how a set you built actually went.

Looking things up
- You also have web_search. Use it sparingly, when your own knowledge is thin and it would change your picks: checking what a specific album actually sounds like, what else came out of a scene, what a band's quieter record is. Never search for something the library tools can answer, and don't let a search delay the first tracks — queue something good, then refine.`;

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

const TOOL_PHRASES: Record<string, string> = {
  add_to_queue: 'Adding to the queue',
  get_artist: 'Reading up on an artist',
  get_queue: 'Checking the queue',
  library_stats: 'Sizing up the library',
  list_artists: 'Looking through artists',
  list_genres: 'Checking the genres',
  memory: 'Checking its notes',
  now_playing: 'Checking what is playing',
  queue_albums: 'Queueing albums',
  recent_plays: 'Reviewing recent plays',
  remove_from_queue: 'Trimming the queue',
  sample_tracks: 'Digging through the crates',
  search_albums: 'Browsing albums',
  search_library: 'Searching the library',
  set_queue: 'Rebuilding the queue',
  skip_current: 'Skipping ahead',
  web_search: 'Looking it up online',
};

function describeToolRun(names: string[]): string {
  const phrases = names.map((name) => TOOL_PHRASES[name] || `Running ${name}`);
  const unique = phrases.filter((phrase, i) => phrases.indexOf(phrase) === i);
  return unique.slice(0, 2).join(', ');
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
  private pending: Array<{text: string; automatic: boolean; speaker?: string}> = [];
  private playbackEvents: string[] = [];
  private busyNote?: string;
  /** Entry the current reply is streaming into, and the thinking text seen so far this round. */
  private streamEntryId?: number;
  private thinkingBuffer = '';
  /** favorites count per track id, to notice the listener hitting the like button mid-set */
  private favoriteCounts: Record<string, number> = {};
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
    return {busy: this.busy, entries: this.entries, note: this.busyNote};
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
      note: this.busyNote || null,
      entries: entries.slice(-limit).map((entry) => ({
        id: entry.id,
        role: entry.role,
        speaker: entry.speaker || null,
        text: entry.text,
      })),
      hasSession: this.messages.length > 0,
      queue: queueSnapshot(store.getState()),
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
      room: activity.getStatus(),
      remainingSeconds: Math.round(remainingMs / 1000),
      upcoming: upcoming.length,
    };
  }

  /**
   * Records someone's like or dislike of the playing track. This is their own verdict, kept
   * apart from the owner's favourites, and it is the clearest signal a listener can give.
   */
  public noteReaction(trackId: string, person: string, reaction: Reaction): void {
    const state = store.getState();
    const track = getTrackById(state, trackId);
    if (!track) {
      return;
    }
    activity.noteListenerInput();
    if (reaction === 'like') {
      this.recentSkips = 0;
      this.playbackEvents.push(`${person} liked this: ${formatTrack(state, track)}`);
    } else if (reaction === 'dislike') {
      this.playbackEvents.push(`${person} disliked this: ${formatTrack(state, track)} — ` +
        `don't queue it for them again, and take the hint for similar tracks.`);
    } else {
      this.playbackEvents.push(`${person} took back their reaction to: ${formatTrack(state, track)}`);
    }
    this.emit();
  }

  /**
   * Drops tracks from the upcoming queue on the listener's behalf. Pass an albumId to remove
   * whatever is left of that album; every client (DJ page, phone, web) goes through here so the
   * DJ hears about it the same way regardless of where it was done.
   */
  public removeFromQueue(trackIds: string[], albumId?: string, actor: string = OWNER): void {
    const playlist = store.getState().currentlyPlaying.playlist;
    if (!(playlist instanceof DJPlaylist)) {
      return;
    }
    const ids = albumId
      ? playlist.getUpcomingEntries().filter((entry) => entry.albumId === albumId).map((entry) => entry.id)
      : trackIds;
    if (!ids.length) {
      return;
    }
    playlist.removeUpcoming(ids);
    store.dispatch({type: DJ_QUEUE_UPDATED});
    this.noteListenerRemoval(ids, albumId, actor);
  }

  /**
   * Records that the listener pruned the queue by hand. Removing something is strong, explicit
   * feedback, so the DJ hears about it the same way it hears about skips — and a whole album
   * dropped is reported as one rejection rather than a wall of individual tracks.
   */
  public noteListenerRemoval(trackIds: string[], albumId?: string, actor: string = OWNER): void {
    const state = store.getState();
    activity.noteListenerInput();
    const album = albumId ? getAlbumById(state, albumId) : undefined;
    if (album) {
      this.playbackEvents.push(`${actor} dropped the rest of "${album.name}" from the queue ` +
        `(${trackIds.length} track(s)) — they don't want that record right now.`);
    } else {
      trackIds.forEach((id) => {
        const track = getTrackById(state, id);
        if (track) {
          this.playbackEvents.push(`${actor} removed from the queue: ${formatTrack(state, track)}`);
        }
      });
    }
    this.emit();
  }

  public send(text: string, speaker: string = OWNER): void {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    activity.noteListenerInput();
    this.enqueue(trimmed, false, speaker.trim() || OWNER);
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

  private enqueue(text: string, automatic: boolean, speaker?: string): void {
    this.pending.push({automatic, speaker, text});
    if (!this.busy) {
      this.drain();
    }
  }

  private async drain(): Promise<void> {
    this.busy = true;
    this.emit();
    while (this.pending.length) {
      const next = this.pending.shift() as {text: string; automatic: boolean; speaker?: string};
      await this.runTurn(next.text, next.automatic);
    }
    this.busy = false;
    this.emit();
  }

  private buildUserText(text: string, automatic: boolean, speaker?: string): string {
    const parts: string[] = [];
    if (this.playbackEvents.length) {
      parts.push(`[Playback update — ${formatClock()}]\n${this.playbackEvents.join('\n')}`);
      this.consumeFeedback();
    }
    if (automatic) {
      parts.push(`[Queue update — ${formatClock()}]\n${text}\n\n${describeQueue(store.getState())}`);
    } else {
      if (!this.messages.length) {
        // Hand over the opening context rather than making the DJ spend a turn asking for it.
        parts.push(`[It is ${formatClock()}]`);
        parts.push(recentlyPlayedBrief(store.getState()));
      }
      parts.push(speaker ? `[From ${speaker}]\n${text}` : text);
    }
    return parts.join('\n\n');
  }

  private async runTurn(text: string, automatic: boolean, speaker?: string): Promise<void> {
    ensureDJPlaylist();
    if (automatic) {
      this.addEntry('status', 'Queue running low — asking the DJ for more…');
    } else {
      this.addEntry('user', text, undefined, speaker);
    }
    this.elideOldToolResults();
    this.messages.push({
      content: [{type: 'text', text: this.buildUserText(text, automatic, speaker)}],
      role: 'user',
    });
    try {
      let finished = false;
      for (let round = 0; round < MAX_TOOL_ROUNDS && !finished; round++) {
        this.streamEntryId = undefined;
        this.thinkingBuffer = '';
        const response = await createMessage(
          {messages: this.messages, system: SYSTEM_PROMPT, tools: API_TOOLS},
          {
            onText: (delta) => this.appendReply(delta),
            onThinking: (delta) => this.appendThinking(delta),
          },
        );
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
          const toolUses = response.content.filter((b) => b.type === 'tool_use') as ToolUseBlock[];
          this.setNote(describeToolRun(toolUses.map((use) => use.name)));
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
        if (this.streamEntryId === undefined) {
          this.addEntry('dj', reply || (response.stop_reason === 'max_tokens' ? '(reply cut off)' : '(no reply)'));
        } else if (response.stop_reason === 'max_tokens') {
          this.appendReply(' …(cut off)');
        }
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
    this.checkFavorites(state);
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

  /** Favoriting the playing track is the clearest "yes" the listener can give without typing. */
  private checkFavorites(state: RootState): void {
    const currentId = state.currentlyPlaying.currentlyPlayingId;
    if (!currentId) {
      return;
    }
    const track = getTrackById(state, currentId);
    if (!track) {
      return;
    }
    const count = (track.favorites || []).length;
    const previous = this.favoriteCounts[currentId];
    if (previous !== undefined && count !== previous) {
      activity.noteListenerInput();
      if (count > previous) {
        this.recentSkips = 0;
        this.playbackEvents.push(`Just favorited: ${formatTrack(state, track)}`);
      } else {
        this.playbackEvents.push(`Just un-favorited: ${formatTrack(state, track)}`);
      }
    }
    this.favoriteCounts[currentId] = count;
  }

  private recordTrackChange(prevId: string | undefined, nextId: string | undefined, playlist: DJPlaylist): void {
    const state = store.getState();
    const prev = prevId ? getTrackById(state, prevId) : undefined;
    if (prev) {
      const transition = playlist.consumeTransition();
      const actor = (transition && transition.actor) || OWNER;
      const byDJ = actor === DJ_ACTOR;
      const finished = this.lastTime * 1000 >= prev.duration - 5000;
      const elapsed = toTime(this.lastTime * 1000);
      const wentBack = nextId !== undefined && playlist.getHistory().slice(0, -1).includes(nextId);
      const albumSkip = transition !== undefined && transition.kind === 'next-album' &&
        transition.dropped.length > 0;
      if (wentBack) {
        this.playbackEvents.push(`${actor} went back (after ${elapsed}): ${formatTrack(state, prev)}`);
      } else if (albumSkip) {
        const album = transition && transition.albumId ? getAlbumById(state, transition.albumId) : undefined;
        const name = album ? `"${album.name}"` : 'the album';
        const dropped = transition ? transition.dropped.length : 0;
        const who = byDJ ? 'You (the DJ) skipped' : `${actor} skipped`;
        this.playbackEvents.push(`${who} the rest of ${name} after ${elapsed} — ${dropped} queued ` +
          `track(s) dropped, during: ${formatTrack(state, prev)}`);
        if (!byDJ) {
          this.recentSkips++;
          activity.noteListenerInput();
        }
      } else if (finished) {
        this.recentSkips = 0;
        this.playbackEvents.push(`Played fully: ${formatTrack(state, prev)}`);
      } else if (byDJ) {
        this.playbackEvents.push(`You (the DJ) skipped after ${elapsed}: ${formatTrack(state, prev)}`);
      } else {
        this.recentSkips++;
        activity.noteListenerInput();
        this.playbackEvents.push(`${actor} skipped after ${elapsed}: ${formatTrack(state, prev)}`);
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

  /** Types the reply into the transcript as it arrives, creating its entry on the first delta. */
  private appendReply(delta: string): void {
    if (this.streamEntryId === undefined) {
      this.streamEntryId = this.nextId;
      this.addEntry('dj', delta);
      return;
    }
    const id = this.streamEntryId;
    this.entries = this.entries.map((entry) =>
      (entry.id === id ? Object.assign({}, entry, {text: `${entry.text}${delta}`}) : entry));
    this.emit();
  }

  /** Shows the tail of the DJ's reasoning as a live progress line. */
  private appendThinking(delta: string): void {
    this.thinkingBuffer = `${this.thinkingBuffer}${delta}`;
    const flat = this.thinkingBuffer.replace(/\s+/g, ' ').trim();
    const sentences = flat.split(/(?<=[.!?])\s/);
    const tail = sentences[sentences.length - 1] || flat;
    this.setNote(tail.length > 150 ? `…${tail.slice(tail.length - 149)}` : tail);
  }

  private setNote(note?: string): void {
    this.busyNote = note;
    this.emit();
  }

  private addEntry(role: EntryRole, text: string, detail?: string, speaker?: string): void {
    this.entries = this.entries.concat([{detail, id: this.nextId++, role, speaker, text}]);
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}

const session = new DJSession();
export default session;
