package com.example.musicnative

import android.content.Context
import android.content.SharedPreferences
import java.net.URLEncoder
import com.google.gson.Gson

const val appId = "com.music.playerapp"

class PlayTracker(context: Context) {
    private val preferences: SharedPreferences = context.getSharedPreferences(appId, Context.MODE_PRIVATE)

    fun addPlay(track: TrackData) {
        val trackKey = "$appId-track-${track.track.id}"
        val current = preferences.getInt(trackKey, 0)
        val plays = current + 1
        preferences.edit().putInt(trackKey, plays).apply()
    }

    private fun getPlays(): Map<String, Int> {
        return preferences.all.filterKeys { key -> key.startsWith("$appId-track-") }
            .mapKeys { entry ->  entry.key.replace("$appId-track-", "")} as Map<String, Int>
    }

    fun clearPlays() {
        preferences.edit().clear().apply()
    }

    fun getQueryString(): String {
        return try {
            val plays = getPlays()
            val json = Gson().toJson(plays).toString()
            val encoded = URLEncoder.encode(json, "UTF-8")
            "plays=$encoded"
        } catch (err: Error) {
            val encoded = URLEncoder.encode("{}", "UTF-8")
            "plays=$encoded"
        }
    }
}