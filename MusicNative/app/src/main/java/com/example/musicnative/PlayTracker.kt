package com.example.musicnative

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import java.net.URLEncoder
import org.json.JSONArray
import org.json.JSONObject

const val appId = "com.music.playerapp"

/** One event, with the moment it happened. */
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
        private const val SKIP_KEY = "$appId-skiplog"
        private const val LEGACY_PREFIX = "$appId-track-"
    }

    fun addPlay(track: TrackData) {
        append(LOG_KEY, track.track.id)
    }

    /**
     * Records a skip: leaving a track that has not finished, however briefly it was heard.
     *
     * No minimum listening time, matching the desktop (src/skips.tsx). A two-second floor used to
     * discard every quick rejection, and once the desktop dropped it the two no longer meant the
     * same thing — a phone skip at one second vanished while a desktop one counted.
     */
    fun addSkip(track: TrackData) {
        append(SKIP_KEY, track.track.id)
    }

    private fun append(key: String, id: String) {
        val records = stored(key).toMutableList()
        records.add(PlayRecord(id, System.currentTimeMillis()))
        write(key, records)
    }

    /** One log as stored, ignoring anything unparseable rather than losing the lot. */
    private fun stored(key: String): List<PlayRecord> {
        val raw = preferences.getString(key, null) ?: return emptyList()
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

    private fun write(key: String, records: List<PlayRecord>) {
        preferences.edit().putString(key, toJson(records)).apply()
    }

    private fun toJson(records: List<PlayRecord>): String {
        val array = JSONArray()
        records.forEach { record ->
            array.put(JSONObject().put("i", record.id).put("t", record.at))
        }
        return array.toString()
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
    data class Pending(
        val plays: List<PlayRecord>,
        val skips: List<PlayRecord>,
        val legacy: Map<String, Int>,
    )

    fun pending(): Pending = Pending(stored(LOG_KEY), stored(SKIP_KEY), legacyCounts())

    /**
     * Removes the plays that were just sent, leaving anything recorded since.
     *
     * The old code cleared everything after the request, so a play that landed while the sync
     * was in flight was thrown away. Dropping by count keeps the tail.
     */
    fun clearSent(sent: Pending) {
        val editor = preferences.edit()
        sent.legacy.keys.forEach { id -> editor.remove("$LEGACY_PREFIX$id") }
        // dropping by count keeps anything recorded while the sync was in flight
        editor.putString(LOG_KEY, toJson(stored(LOG_KEY).drop(sent.plays.size)))
        editor.putString(SKIP_KEY, toJson(stored(SKIP_KEY).drop(sent.skips.size)))
        editor.apply()
    }

    /**
     * The `plays=` query parameter, for a desktop from before `POST /start-sync`.
     *
     * No fallback to an empty payload on error: sending `{}` and then clearing what was
     * "sent" would throw the plays away. An exception fails the sync and keeps them.
     */
    fun getQueryString(sent: Pending): String =
        "plays=" + URLEncoder.encode(syncPayload(sent), "UTF-8")
}

/**
 * What a sync sends: `{"v":3,"plays":[{"i":id,"t":ms}],"skips":[...],"counts":{id:n}}`, as the
 * `POST /start-sync` body (or, to an older desktop, the `plays=` query parameter).
 *
 * The desktop reads any numeric `v` as this structured shape and takes each field if present,
 * and still accepts the original bare `{id: count}` map, so old and new builds interoperate.
 * It dedupes timed events against its own log, so resending anything unacknowledged is safe.
 */
fun syncPayload(sent: PlayTracker.Pending): String {
    val payload = mapOf(
        "v" to 3,
        "plays" to sent.plays.map { r -> mapOf("i" to r.id, "t" to r.at) },
        "skips" to sent.skips.map { r -> mapOf("i" to r.id, "t" to r.at) },
        "counts" to sent.legacy,
    )
    return Gson().toJson(payload)
}
