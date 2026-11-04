/*
 * Behaviour shared by every game window, as a `Game` global.
 *
 * Plain script rather than a module: the game pages load over file:// with nodeIntegration on,
 * and `<script src>` from the same directory is the one thing that works everywhere without a
 * build step. Everything here is library-agnostic — a game supplies the ids and the rules.
 *
 * The IPC contracts it wraps live in `public/electron.js`:
 *   game-get-tracks  -> game-tracks                  (the library, proxied via the renderer)
 *   game-get-scores  -> game-scores                  (per game id, persisted in DATA_DIR)
 *   game-save-scores                                 (fire and forget)
 *   game-get-lyrics  -> game-lyrics-<trackId>        (read straight off disk by main)
 *   game-dj-clue     -> game-dj-clue-<requestId>     (proxied to the renderer, which has the key)
 */
(function() {
  const electron = window.require("electron");
  const nodePath = window.require("path");
  const ipc = electron.ipcRenderer;

  /** Tracks shorter than this have no room for a clip or a crop. */
  const MIN_TRACK_MS = 30000;
  const HISTORY_LIMIT = 50;
  /** Difficulty slices of the play-count-sorted pool. */
  const EASY_FRACTION = 0.25;
  const HARD_FRACTION = 0.5;
  /** A perfect round with this much clock left is worth a speed bonus. */
  const SPEED_FAST_FRACTION = 0.75;
  const SPEED_MID_FRACTION = 0.5;
  const STREAK_BONUS_CAP = 2;
  const MIN_INSIGHT_ROUNDS = 6;
  const INSIGHT_SHOWN = 3;

  // ---- text ----

  /**
   * Punctuation- and case-insensitive compare; curly quotes count as straight and the word
   * "the" is optional, so "Beatles" matches "The Beatles".
   */
  function normalize(str) {
    // Accents are folded first, because the strip below drops every non-ASCII letter: without
    // this "Bj\u00f6rk" keys as "bjrk" and a player typing "Bjork" is told they are wrong.
    // Sigur R\u00f3s, Blue \u00d6yster Cult and Beyonc\u00e9 were all unguessable until this landed.
    const folded = (str || "").normalize("NFD").replace(/[\u0300-\u036F]/g, "");
    const base = folded.toLowerCase().replace(/[‘’ʼ]/g, "'");
    const stripped = base.replace(/\bthe\b/g, "").replace(/[^a-z0-9]/g, "");
    // titles made entirely of "the" (hi, The The) fall back to the full form
    return stripped || base.replace(/[^a-z0-9]/g, "");
  }

  /** "A, B" credits accept the full string or any single artist. */
  function artistMatches(guess, artist) {
    if (guess === normalize(artist)) {
      return true;
    }
    return (artist || "").split(", ").some((name) => guess === normalize(name));
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function parseList(value) {
    return (value || "").split(",").map((part) => normalize(part)).filter(Boolean);
  }

  /** Art paths are relative to the data dir; the window loads them over file://. */
  function artUrl(artFile) {
    return `file://${nodePath.resolve(artFile)}`;
  }

  // ---- screens ----

  /** Swaps the `active` class between the `.screen` elements named by id. */
  function screens(ids) {
    const els = ids.map((id) => document.getElementById(id));
    return {
      show(id) {
        els.forEach((el) => el.classList.remove("active"));
        document.getElementById(id).classList.add("active");
      },
    };
  }

  // ---- the library ----

  /**
   * Asks for the library and calls back with the playable tracks.
   *
   * `needs` names extra fields a game cannot work without — Album Art Zoom is pointless
   * without `artFile`, Finish the Lyric without `id` — so each game filters to the subset it
   * can actually use rather than discovering mid-round that a field is missing.
   */
  function loadTracks(options, onLoad) {
    const opts = options || {};
    const needs = opts.needs || [];
    const minDuration = opts.minDurationMs === undefined ? MIN_TRACK_MS : opts.minDurationMs;
    ipc.on("game-tracks", (evt, tracks) => {
      onLoad((tracks || []).filter((track) => {
        if (!track.name || !track.filePath || track.duration <= minDuration) {
          return false;
        }
        return needs.every((field) => track[field]);
      }));
    });
    ipc.send("game-get-tracks");
  }

  // ---- filters ----

  /**
   * The setup screen's decade / genre / artist / difficulty controls.
   *
   * `init` takes the element ids it should drive; every one is optional, so a game can offer
   * only the filters that make sense for it and the rest simply do nothing.
   */
  function Filters(ids) {
    const el = (id) => (id ? document.getElementById(id) : null);
    const decadeSelect = el(ids.decade);
    const genreFilter = el(ids.genre);
    const artistFilter = el(ids.artist);
    const genreOptions = el(ids.genreOptions);
    const artistOptions = el(ids.artistOptions);
    const difficulty = el(ids.difficulty);

    function selectedDifficulty() {
      if (!difficulty) {
        return "normal";
      }
      const checked = difficulty.querySelector("input:checked");
      return checked ? checked.value : "normal";
    }

    function addOptions(target, values, label) {
      values.forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        if (label) {
          option.textContent = label(value);
        }
        target.appendChild(option);
      });
    }

    return {
      /** Fills the decade dropdown and the genre/artist datalists from the library. */
      populate(tracks) {
        const decades = new Set();
        const genres = new Set();
        const artistNames = new Set();
        tracks.forEach((track) => {
          if (track.year > 1000) {
            decades.add(Math.floor(track.year / 10) * 10);
          }
          (track.genres || []).forEach((genre) => genres.add(genre));
          (track.artist || "").split(", ").forEach((name) => {
            if (name) {
              artistNames.add(name);
            }
          });
        });
        if (decadeSelect) {
          addOptions(decadeSelect, [...decades].sort(), (decade) => `${decade}s`);
        }
        if (genreOptions) {
          addOptions(genreOptions, [...genres].sort());
        }
        if (artistOptions) {
          addOptions(artistOptions, [...artistNames].sort());
        }
      },

      difficulty: selectedDifficulty,

      /** Applies the filters and the difficulty slice. `rounds` sets the floor on pool size. */
      candidates(tracks, rounds) {
        const decade = decadeSelect && decadeSelect.value ?
          parseInt(decadeSelect.value, 10) : null;
        const genres = genreFilter ? parseList(genreFilter.value) : [];
        const artists = artistFilter ? parseList(artistFilter.value) : [];
        let candidates = tracks.filter((track) => {
          if (decade !== null && !(track.year >= decade && track.year < decade + 10)) {
            return false;
          }
          if (genres.length && !(track.genres || []).some((genre) => {
            return genres.some((wanted) => normalize(genre).includes(wanted));
          })) {
            return false;
          }
          if (artists.length && !(track.artist || "").split(", ").some((name) => {
            return artists.some((wanted) => normalize(name).includes(wanted));
          })) {
            return false;
          }
          return true;
        });
        const mode = selectedDifficulty();
        // only slice by play count when there's enough pool to slice meaningfully
        if (mode !== "normal" && candidates.length > rounds * 2) {
          candidates = candidates.slice()
            .sort((track1, track2) => track2.playCount - track1.playCount);
          if (mode === "easy") {
            const keep = Math.max(rounds * 2, Math.floor(candidates.length * EASY_FRACTION));
            candidates = candidates.slice(0, keep);
          } else {
            const skip = Math.min(candidates.length - rounds * 2,
              Math.floor(candidates.length * HARD_FRACTION));
            candidates = candidates.slice(skip);
          }
        }
        return candidates;
      },

      /** The filter state, for keying high scores so bests compare like with like. */
      key() {
        const genres = genreFilter ? parseList(genreFilter.value).sort().join(",") : "";
        const artists = artistFilter ? parseList(artistFilter.value).sort().join(",") : "";
        const decade = decadeSelect ? decadeSelect.value : "";
        return `${selectedDifficulty()}|${decade}|${genres}|${artists}`;
      },

      /** Re-runs `onChange` whenever any control moves. */
      onChange(handler) {
        [decadeSelect, genreFilter, artistFilter].forEach((element) => {
          if (element) {
            element.addEventListener("input", handler);
          }
        });
        if (difficulty) {
          difficulty.addEventListener("change", handler);
        }
      },
    };
  }

  /** Reports how many tracks the current filters leave, and enables/disables Start. */
  function matchCounter(countId, startId) {
    const count = document.getElementById(countId);
    const start = document.getElementById(startId);
    return {
      /** `noun` because a round is not always a song — Album Art Zoom deals in covers. */
      update(matching, minimum, noun) {
        const enough = matching >= (minimum || 1);
        const one = noun || "song";
        count.textContent = matching ?
          `${matching.toLocaleString()} ${one}${matching === 1 ? "" : "s"} in play` :
          `No ${one}s match these filters`;
        if (matching && !enough) {
          count.textContent += ` — need at least ${minimum}`;
        }
        count.classList.toggle("none", !enough);
        if (start) {
          start.disabled = !enough;
        }
      },
      message(text, bad) {
        count.textContent = text;
        count.classList.toggle("none", !!bad);
        if (start) {
          start.disabled = !!bad;
        }
      },
    };
  }

  // ---- scores ----

  /**
   * Per-game high scores, persisted by the main process in DATA_DIR.
   *
   * The shape is `{[settingsKey]: {best, games: [{date, score}]}}` plus a `__insights` key, as
   * Name That Tune already wrote it — a new game starts with an empty object and inherits the
   * same history line and personal-best handling for free.
   */
  function Scores(gameId) {
    let all = {};
    let loaded = null;
    ipc.on("game-scores", (evt, scores) => {
      all = scores || {};
      if (loaded) {
        loaded();
      }
    });

    return {
      load(onLoad) {
        loaded = onLoad;
        ipc.send("game-get-scores", gameId);
      },
      all() {
        return all;
      },
      /** Records a finished game and reports whether it beat the stored best. */
      save(key, score) {
        const entry = all[key] || {best: 0, games: []};
        const newBest = score > entry.best;
        entry.best = Math.max(entry.best, score);
        entry.games.push({date: new Date().toISOString(), score});
        entry.games = entry.games.slice(-HISTORY_LIMIT);
        all[key] = entry;
        ipc.send("game-save-scores", {gameId, scores: all});
        return {entry, newBest};
      },
      entry(key) {
        return all[key];
      },
      /** "Best with these settings: 24 · 7 games · avg 18", or a nudge when there are none. */
      historyText(key) {
        const entry = all[key];
        if (!entry || !entry.games.length) {
          return "No games yet with these settings";
        }
        const total = entry.games.reduce((sum, game) => sum + game.score, 0);
        const average = Math.round(total / entry.games.length);
        return `Best with these settings: ${entry.best} · ${entry.games.length} ` +
          `game${entry.games.length === 1 ? "" : "s"} · avg ${average}`;
      },
      /**
       * Folds a game's rounds into all-time per-genre and per-decade accuracy.
       *
       * `maxPoints` is what one round is worth before bonuses, so the percentage means
       * "how much of the answerable did you answer" rather than depending on streak luck.
       */
      foldInsights(results, maxPoints) {
        const insights = all.__insights || {};
        results.forEach((result) => {
          const categories = [];
          if (result.year > 1000) {
            categories.push(`${Math.floor(result.year / 10) * 10}s`);
          }
          (result.genres || []).forEach((genre) => categories.push(genre));
          categories.forEach((category) => {
            const entry = insights[category] || {base: 0, max: 0, rounds: 0};
            entry.rounds++;
            entry.base += result.basePoints;
            // older entries predate `max`; fall back to the caller's current round value
            entry.max = (entry.max || 0) + maxPoints;
            insights[category] = entry;
          });
        });
        all.__insights = insights;
      },
      insights() {
        return all.__insights || {};
      },
    };
  }

  /** Renders the all-time accuracy card, or hides it until there is enough to say. */
  function renderInsights(scores, cardId, rowsId, maxPoints) {
    const card = document.getElementById(cardId);
    const rows = document.getElementById(rowsId);
    const insights = scores.insights();
    const qualified = Object.keys(insights)
      .map((category) => {
        const entry = insights[category];
        const max = entry.max || entry.rounds * maxPoints;
        return {
          category,
          percent: max ? Math.round((entry.base / max) * 100) : 0,
          rounds: entry.rounds,
        };
      })
      .filter((entry) => entry.rounds >= MIN_INSIGHT_ROUNDS)
      .sort((entry1, entry2) => entry2.percent - entry1.percent);
    if (qualified.length < 2) {
      card.style.display = "none";
      return;
    }
    const shown = qualified.length <= INSIGHT_SHOWN * 2 ?
      qualified :
      qualified.slice(0, INSIGHT_SHOWN).concat(qualified.slice(-INSIGHT_SHOWN));
    rows.innerHTML = "";
    shown.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "insight-row";
      const label = document.createElement("span");
      label.className = entry.percent >= 50 ? "good" : "bad";
      label.textContent = entry.category;
      const value = document.createElement("span");
      value.className = "insight-rounds";
      value.textContent = `${entry.percent}% · ${entry.rounds} rounds`;
      row.appendChild(label);
      row.appendChild(value);
      rows.appendChild(row);
    });
    card.style.display = "block";
  }

  // ---- the round timer ----

  /**
   * The countdown bar. `start` is what resets it, so a round that has to load something
   * (art, lyrics, a clue) can wait to start the clock until the player can actually answer.
   */
  function Timer(barId, totalMs) {
    const bar = document.getElementById(barId);
    let id = null;
    let deadline = 0;
    return {
      start(onExpire) {
        deadline = Date.now() + totalMs;
        clearInterval(id);
        bar.style.width = "100%";
        bar.classList.remove("low");
        id = setInterval(() => {
          const left = deadline - Date.now();
          bar.style.width = `${Math.max(0, left / totalMs) * 100}%`;
          bar.classList.toggle("low", left < 5000);
          if (left <= 0) {
            clearInterval(id);
            onExpire();
          }
        }, 100);
      },
      stop() {
        clearInterval(id);
      },
      /** How much of the clock is left, 0–1; the speed bonus is a function of this. */
      fractionLeft() {
        return Math.max(0, (deadline - Date.now()) / totalMs);
      },
      reset() {
        clearInterval(id);
        deadline = 0;
        bar.style.width = "100%";
        bar.classList.remove("low");
      },
    };
  }

  /** Speed and streak bonuses, identical across games so scores feel comparable. */
  function bonuses(fractionLeft, streak) {
    return {
      speedBonus: fractionLeft >= SPEED_FAST_FRACTION ? 2 :
        fractionLeft >= SPEED_MID_FRACTION ? 1 : 0,
      streakBonus: Math.min(Math.max(streak - 1, 0), STREAK_BONUS_CAP),
    };
  }

  /** Picks distinct decoy values for a multiple-choice group, correct answer included. */
  function buildChoices(container, correctValue, pool, getValue, onPick, count) {
    container.innerHTML = "";
    const seen = new Set([normalize(correctValue)]);
    const options = [correctValue];
    const source = shuffle(pool.slice());
    for (const track of source) {
      if (options.length >= (count || 4)) {
        break;
      }
      const value = getValue(track);
      if (value && !seen.has(normalize(value))) {
        seen.add(normalize(value));
        options.push(value);
      }
    }
    shuffle(options).forEach((value) => {
      const button = document.createElement("button");
      button.className = "choice-button";
      button.type = "button";
      button.textContent = value;
      button.title = value;
      button.addEventListener("click", () => onPick(button, value));
      container.appendChild(button);
    });
  }

  /** Disables a choice group, marking the right answer and the wrong pick. */
  function revealChoices(container, pickedButton, correctValue) {
    [...container.children].forEach((child) => {
      child.disabled = true;
      if (normalize(child.textContent) === normalize(correctValue)) {
        child.classList.add("correct");
      }
    });
    if (pickedButton && normalize(pickedButton.textContent) !== normalize(correctValue)) {
      pickedButton.classList.add("wrong");
    }
  }

  // ---- data the main process fetches on a game's behalf ----

  /** The stored LRC for a track, or undefined when nothing has been fetched for it. */
  function lyrics(trackId) {
    return new Promise((resolve) => {
      ipc.once(`game-lyrics-${trackId}`, (evt, text) => resolve(text || undefined));
      ipc.send("game-get-lyrics", trackId);
    });
  }

  const LRC_LINE = /^\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]\s?(.*)$/;

  /**
   * Parses a stored .lrc into `{at, text}` lines, falling back to plain text.
   *
   * A port of `parseLyrics` in src/extensions/lyrics/store.tsx — the renderer's copy is TS and
   * pulls in Electron, so it cannot be required from a game page. Keep the two in step. Handles
   * `[mm:ss.xx]` and `[mm:ss:xx]` with two- or three-digit fractions, because LRC in the wild
   * uses all of them; metadata tags like `[ar:...]` fail the digit groups and are dropped.
   */
  function parseLrc(text) {
    const lines = [];
    (text || "").split(/\r?\n/).forEach((raw) => {
      const match = LRC_LINE.exec(raw);
      if (!match) {
        if (!/^\[[a-z]+:/i.test(raw)) {
          lines.push({text: raw});
        }
        return;
      }
      const frac = match[3] ? Number(match[3].padEnd(3, "0")) : 0;
      lines.push({
        at: Number(match[1]) * 60000 + Number(match[2]) * 1000 + frac,
        text: match[4],
      });
    });
    while (lines.length && !lines[lines.length - 1].text.trim() &&
        lines[lines.length - 1].at === undefined) {
      lines.pop();
    }
    return lines;
  }

  let clueSeq = 0;

  /**
   * Asks the DJ to describe a track without naming it.
   *
   * The API key lives in the renderer, not here, so this round-trips through the main process
   * exactly as the library does. Resolves `{clue}` or rejects with the DJ's error message.
   */
  function djClue(track) {
    const requestId = `${Date.now()}-${clueSeq++}`;
    return new Promise((resolve, reject) => {
      ipc.once(`game-dj-clue-${requestId}`, (evt, result) => {
        if (!result || result.error) {
          reject(new Error((result && result.error) || "No answer from the DJ"));
          return;
        }
        resolve(result);
      });
      ipc.send("game-dj-clue", {requestId, track});
    });
  }

  window.Game = {
    Filters,
    Scores,
    Timer,
    artUrl,
    artistMatches,
    bonuses,
    buildChoices,
    djClue,
    loadTracks,
    lyrics,
    matchCounter,
    normalize,
    parseList,
    parseLrc,
    renderInsights,
    revealChoices,
    screens,
    shuffle,
  };
}());
