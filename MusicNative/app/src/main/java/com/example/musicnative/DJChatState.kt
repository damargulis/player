package com.example.musicnative

import androidx.lifecycle.MutableLiveData
import org.json.JSONObject

data class ChatEntry(val id: Int, val role: String, val text: String, val speaker: String? = null)

data class QueueTrack(
    val id: String,
    val name: String,
    val artist: String,
    /** Set when the track was queued as part of a whole album, so it can be grouped and bulk-removed. */
    val group: String? = null,
    val groupName: String? = null,
)

data class QueueInfo(
    val active: Boolean,
    val isPlaying: Boolean,
    val current: QueueTrack?,
    val upcoming: List<QueueTrack>,
)

/**
 * Mirror of the desktop DJ conversation, pushed over socket.io as "dj-state".
 * Same shape as PlaybackState: a singleton of LiveData the composables observe directly.
 */
object DJChatState {
    val entries = MutableLiveData<List<ChatEntry>>(emptyList())

    /** True while the DJ is working on a turn. */
    val busy = MutableLiveData(false)

    /** What the DJ is doing right now, when it is busy. */
    val note = MutableLiveData<String?>(null)

    /** False when the desktop has no Anthropic API key configured. */
    val configured = MutableLiveData(true)

    /** False before the first message of a conversation. */
    val hasSession = MutableLiveData(false)

    /** Whose name counts as the owner's, so a guest can be told apart from the desktop. */
    val owner = MutableLiveData<String?>(null)

    /** What the desktop is playing and what it has queued. */
    val queue = MutableLiveData<QueueInfo?>(null)

    private fun parseTrack(obj: JSONObject?): QueueTrack? {
        obj ?: return null
        return QueueTrack(
            id = obj.optString("id", ""),
            name = obj.optString("name", ""),
            artist = obj.optString("artist", ""),
            group = if (obj.isNull("group")) null else obj.optString("group", "").ifEmpty { null },
            groupName = if (obj.isNull("groupName")) null else obj.optString("groupName", "").ifEmpty { null },
        )
    }

    private fun parseQueue(obj: JSONObject?): QueueInfo? {
        obj ?: return null
        val upcoming = mutableListOf<QueueTrack>()
        val array = obj.optJSONArray("upcoming")
        if (array != null) {
            for (i in 0 until array.length()) {
                parseTrack(array.optJSONObject(i))?.let { upcoming.add(it) }
            }
        }
        return QueueInfo(
            active = obj.optBoolean("active", false),
            isPlaying = obj.optBoolean("isPlaying", false),
            current = parseTrack(obj.optJSONObject("current")),
            upcoming = upcoming,
        )
    }

    fun update(state: JSONObject) {
        val parsed = mutableListOf<ChatEntry>()
        val array = state.optJSONArray("entries")
        if (array != null) {
            for (i in 0 until array.length()) {
                val entry = array.optJSONObject(i) ?: continue
                parsed.add(
                    ChatEntry(
                        id = entry.optInt("id", i),
                        role = entry.optString("role", "dj"),
                        text = entry.optString("text", ""),
                        speaker = if (entry.isNull("speaker")) null else entry.optString("speaker", "").ifEmpty { null },
                    )
                )
            }
        }
        entries.postValue(parsed)
        busy.postValue(state.optBoolean("busy", false))
        note.postValue(if (state.isNull("note")) null else state.optString("note", "").ifEmpty { null })
        configured.postValue(state.optBoolean("configured", true))
        hasSession.postValue(state.optBoolean("hasSession", false))
        owner.postValue(state.optString("owner", "").ifEmpty { null })
        queue.postValue(parseQueue(state.optJSONObject("queue")))
    }
}
