package com.example.musicnative

import android.content.Context
import org.json.JSONArray

/**
 * Persists the local player's queue so a killed app comes back where it was, paused.
 *
 * Two preference files, because SharedPreferences rewrites its whole file on every write: the
 * queue (possibly thousands of ids, for All Tracks) is written only when the queue itself
 * changes, while the small position file takes the frequent writes - track changes, pauses,
 * and every ~10s of playback.
 *
 * Only track ids are stored, never a stream URL: signed URLs expire after an hour, so a
 * restored cloud track is resolved again by id when it is played.
 */
object QueueStore {
    private const val QUEUE_PREFS = "player-queue"
    private const val POSITION_PREFS = "player-position"
    private const val KEY_IDS = "track_ids"
    private const val KEY_INDEX = "index"
    private const val KEY_TRACK_ID = "track_id"
    private const val KEY_POSITION = "position_ms"
    private const val KEY_REPEAT = "repeat"

    class Saved(val ids: List<String>, val position: SavedPosition, val repeat: Boolean)

    fun saveQueue(context: Context, ids: List<String>) {
        context.applicationContext.getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_IDS, JSONArray(ids).toString())
            .apply()
    }

    fun savePosition(context: Context, index: Int, trackId: String?, positionMs: Int, repeat: Boolean) {
        context.applicationContext.getSharedPreferences(POSITION_PREFS, Context.MODE_PRIVATE)
            .edit()
            .putInt(KEY_INDEX, index)
            .putString(KEY_TRACK_ID, trackId)
            .putInt(KEY_POSITION, positionMs)
            .putBoolean(KEY_REPEAT, repeat)
            .apply()
    }

    fun load(context: Context): Saved? {
        return try {
            val raw = context.applicationContext
                .getSharedPreferences(QUEUE_PREFS, Context.MODE_PRIVATE)
                .getString(KEY_IDS, null) ?: return null
            val array = JSONArray(raw)
            val ids = List(array.length()) { array.getString(it) }
            val prefs = context.applicationContext.getSharedPreferences(POSITION_PREFS, Context.MODE_PRIVATE)
            Saved(
                ids,
                SavedPosition(
                    prefs.getInt(KEY_INDEX, 0),
                    prefs.getString(KEY_TRACK_ID, null),
                    prefs.getInt(KEY_POSITION, 0),
                ),
                prefs.getBoolean(KEY_REPEAT, false),
            )
        } catch (err: Exception) {
            println("saved queue unreadable: $err")
            null
        }
    }
}
