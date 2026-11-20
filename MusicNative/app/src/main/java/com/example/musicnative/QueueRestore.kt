package com.example.musicnative

/**
 * The pure halves of queue persistence and the Previous button, kept free of Android types so
 * they can run as plain JVM unit tests (see QueueRestoreTest).
 */

/** Previous within this much of a track's start goes back a track; past it, it restarts. */
const val PREVIOUS_RESTART_THRESHOLD_MS = 3000

/**
 * Whether Previous should restart the current track rather than go back one.
 *
 * Past three seconds in it restarts, as on the desktop and most players. The first track of
 * the queue has nothing before it, so it always restarts.
 */
fun shouldRestartOnPrevious(positionMs: Int, index: Int): Boolean =
    positionMs > PREVIOUS_RESTART_THRESHOLD_MS || index <= 0

/** Where the listener was: the saved index, the id that was at it, and how far in. */
data class SavedPosition(val index: Int, val trackId: String?, val positionMs: Int)

data class RestoredQueue<T>(val tracks: List<T>, val index: Int, val positionMs: Int)

/**
 * Rebuilds a saved queue against what can still be played.
 *
 * [resolve] answers null for a track that is gone (deleted by a resync, or no longer in the
 * cloud catalog); those are dropped. The current track is found by id - the saved index is only
 * trusted when the id at it still matches, and breaks ties when the id is queued more than once.
 * If the current track itself is gone, the next surviving one after it becomes current (or, at
 * the end, the last surviving one before it), from its start: the saved position belonged to a
 * different song. Null when nothing survives.
 */
fun <T> restoreQueue(ids: List<String>, saved: SavedPosition, resolve: (String) -> T?): RestoredQueue<T>? {
    if (ids.isEmpty()) {
        return null
    }
    val currentOriginal = when {
        saved.index in ids.indices && (saved.trackId == null || ids[saved.index] == saved.trackId) -> saved.index
        saved.trackId != null && ids.contains(saved.trackId) -> ids.indexOf(saved.trackId)
        else -> saved.index.coerceIn(0, ids.size - 1)
    }
    val kept = mutableListOf<T>()
    var currentKept = -1
    var nextKept = -1
    ids.forEachIndexed { original, id ->
        val resolved = resolve(id) ?: return@forEachIndexed
        if (original == currentOriginal) {
            currentKept = kept.size
        } else if (original > currentOriginal && nextKept < 0) {
            nextKept = kept.size
        }
        kept.add(resolved)
    }
    if (kept.isEmpty()) {
        return null
    }
    return when {
        currentKept >= 0 -> RestoredQueue(kept, currentKept, maxOf(0, saved.positionMs))
        nextKept >= 0 -> RestoredQueue(kept, nextKept, 0)
        else -> RestoredQueue(kept, kept.size - 1, 0)
    }
}
