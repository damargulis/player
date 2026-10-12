package com.example.musicnative

import androidx.lifecycle.MutableLiveData
import org.json.JSONObject

data class ChatEntry(val id: Int, val role: String, val text: String, val speaker: String? = null)

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
    }
}
