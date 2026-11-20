package com.example.musicnative

import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.IOException

class SyncTest {
    private fun attempt(send: () -> String, parse: (String) -> Int): Int {
        var cleared = 0
        try {
            sendThenClear(send, parse) { cleared++ }
        } catch (err: Exception) {
            return cleared
        }
        return cleared
    }

    @Test
    fun clearsAfterAParsedAnswer() {
        assertEquals(1, attempt({ "{}" }, { 7 }))
    }

    @Test
    fun keepsPlaysWhenTheRequestFails() {
        assertEquals(0, attempt({ throw HttpStatusException(500, "x") }, { 7 }))
    }

    @Test
    fun keepsPlaysWhenTheAnswerDoesNotParse() {
        assertEquals(0, attempt({ "" }, { throw IOException("empty body") }))
    }

    @Test
    fun failureStillPropagates() {
        try {
            sendThenClear({ "" }, { throw IOException("bad") }, {})
            fail("expected the parse failure to propagate")
        } catch (_: IOException) {
        }
    }

    @Test
    fun downloadCompleteness() {
        assertTrue(isCompleteDownload(100, 100))
        assertFalse(isCompleteDownload(60, 100))
        assertTrue(isCompleteDownload(60, -1))
    }

    @Test
    fun lengthCheckOutcomes() {
        assertEquals(LengthCheck.MISMATCH, lengthCheck(60, 100))
        assertEquals(LengthCheck.MATCH, lengthCheck(100, 100))
        // no length, or a failed HEAD: keep the file but leave it unverified
        assertEquals(LengthCheck.UNKNOWN, lengthCheck(60, -1))
        assertEquals(LengthCheck.UNKNOWN, lengthCheck(60, null))
    }

    @Test
    fun payloadShape() {
        val pending = PlayTracker.Pending(
            listOf(PlayRecord("a", 1000L)),
            listOf(PlayRecord("b", 2000L)),
            mapOf("c" to 3),
        )
        val json = JsonParser.parseString(syncPayload(pending)).asJsonObject
        assertEquals(3, json.get("v").asInt)
        val play = json.getAsJsonArray("plays")[0].asJsonObject
        assertEquals("a", play.get("i").asString)
        assertEquals(1000L, play.get("t").asLong)
        assertEquals("b", json.getAsJsonArray("skips")[0].asJsonObject.get("i").asString)
        assertEquals(3, json.getAsJsonObject("counts").get("c").asInt)
    }
}
