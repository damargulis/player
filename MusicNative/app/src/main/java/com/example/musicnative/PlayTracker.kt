package com.example.musicnative

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import java.net.URLEncoder
import org.json.JSONArray
import org.json.JSONObject

const val appId = "com.music.playerapp"

/** One play, with the moment it happened. */
data class PlayRecord(val id: String, val at: Long)

/**
 * Plays heard on the phone, held until the next LAN sync.
 *
 * This used to keep a **count per track** and nothing else, so a day of listening arrived at
 * the desktop as "three plays of this song" with no idea when any of them happened. The
 * desktop's own play log can only be as good as what it is told, so the timestamp is recorded
 * here, where it is actually known, rather than guessed at the other end.
 *
 * Stored as one JSON array under a single key. A few hundred plays between syncs is a few KB,
 * and one key means a sync can remove exactly what it sent rather than clearing the file.
 */
class PlayTracker(context: Context) {
    private val preferences: SharedPreferences =
        context.getSharedPreferences(appId, Context.MODE_PRIVATE)

    companion object {
        private const val LOG_KEY = "$appId-playlog"
        private const val LEGACY_PREFIX = "$appId-track-"
    }

    fun addPlay(track: TrackData) {
        val records = stored().toMutableList()
        records.add(PlayRecord(track.track.id, System.currentTimeMillis()))
        write(records)
    }

    /** The log as stored, ignoring anything unparseable rather than losing the lot. */
    private fun stored(): List<PlayRecord> {
        val raw = preferences.getString(LOG_KEY, null) ?: return emptyList()
        val out = mutableListOf<PlayRecord>()
        try {
            val array = JSONArray(raw)
            for (i in 0 until array.length()) {
                val entry = array.optJSONObject(i) ?: continue
                val id = entry.optString("i")
                val at = entry.optLong("t")
                if (id.isNotEmpty() && at > 0) {
                    out.add(PlayRecord(id, at))
                }
            }
        } catch (err: Exception) {
            return emptyList()
        }
        return out
    }

    private fun write(records: List<PlayRecord>) {
        val array = JSONArray()
        records.forEach { record ->
            array.put(JSONObject().put("i", record.id).put("t", record.at))
        }
        preferences.edit().putString(LOG_KEY, array.toString()).apply()
    }

    /**
     * Plays recorded by a build that only kept counts.
     *
     * Read once on the first sync after an update so an upgrade does not drop whatever was
     * waiting. They have no timestamps, which is the whole reason for the change, so they are
     * sent as counts and the desktop stamps them with the sync time.
     */
    private fun legacyCounts(): Map<String, Int> {
        return preferences.all
            .filterKeys { key -> key.startsWith(LEGACY_PREFIX) }
            .mapNotNull { entry ->
                val value = entry.value as? Int ?: return@mapNotNull null
                entry.key.removePrefix(LEGACY_PREFIX) to value
            }
            .toMap()
    }

    /** What is waiting to be sent, so a sync can clear exactly this and nothing newer. */
    fun pending(): Pair<List<PlayRecord>, Map<String, Int>> = Pair(stored(), legacyCounts())

    /**
     * Removes the plays that were just sent, leaving anything recorded since.
     *
     * The old code cleared everything after the request, so a play that landed while the sync
     * was in flight was thrown away. Dropping by count keeps the tail.
     */
    fun clearSent(sent: List<PlayRecord>, legacy: Map<String, Int>) {
        val remaining = stored().drop(sent.size)
        val editor = preferences.edit()
        legacy.keys.forEach { id -> editor.remove("$LEGACY_PREFIX$id") }
        editor.putString(LOG_KEY, JSONArray().also { array ->
            remaining.forEach { record ->
                array.put(JSONObject().put("i", record.id).put("t", record.at))
            }
        }.toString())
        editor.apply()
    }

    @Deprecated("Use pending() and clearSent() so a play during a sync is not lost")
    fun clearPlays() {
        clearSent(stored(), legacyCounts())
    }

    /**
     * The `plays=` query parameter.
     *
     * Sends `{"v":2,"plays":[{"i":id,"t":epochMs}],"counts":{id:n}}`. The desktop accepts the
     * old bare `{id: count}` map too, so an older phone against a newer desktop still syncs —
     * and a newer phone against an older desktop degrades to no plays rather than an error,
     * which is why this is a new shape rather than a changed one.
     */
    fun getQueryString(records: List<PlayRecord>, legacy: Map<String, Int>): String {
        return try {
            val payload = mapOf(
                "v" to 2,
                "plays" to records.map { record -> mapOf("i" to record.id, "t" to record.at) },
                "counts" to legacy,
            )
            "plays=" + URLEncoder.encode(Gson().toJson(payload).toString(), "UTF-8")
        } catch (err: Exception) {
            "plays=" + URLEncoder.encode("{}", "UTF-8")
        }
    }
}
