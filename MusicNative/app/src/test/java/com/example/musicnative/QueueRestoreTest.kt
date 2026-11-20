package com.example.musicnative

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class QueueRestoreTest {
    private fun keepAllBut(vararg gone: String): (String) -> String? =
        { id -> if (gone.contains(id)) null else id }

    @Test
    fun restoresQueueIndexAndPosition() {
        val restored = restoreQueue(listOf("a", "b", "c"), SavedPosition(1, "b", 42_000), keepAllBut())!!
        assertEquals(listOf("a", "b", "c"), restored.tracks)
        assertEquals(1, restored.index)
        assertEquals(42_000, restored.positionMs)
    }

    @Test
    fun dropsMissingTracksAndKeepsCurrentById() {
        val restored = restoreQueue(listOf("a", "b", "c", "d"), SavedPosition(2, "c", 5_000), keepAllBut("a", "b"))!!
        assertEquals(listOf("c", "d"), restored.tracks)
        assertEquals(0, restored.index)
        assertEquals(5_000, restored.positionMs)
    }

    @Test
    fun missingCurrentFallsToNextFromItsStart() {
        val restored = restoreQueue(listOf("a", "b", "c", "d"), SavedPosition(1, "b", 90_000), keepAllBut("b", "c"))!!
        assertEquals(listOf("a", "d"), restored.tracks)
        assertEquals(1, restored.index)
        assertEquals(0, restored.positionMs)
    }

    @Test
    fun missingLastTrackFallsBackToTheOneBefore() {
        val restored = restoreQueue(listOf("a", "b", "c"), SavedPosition(2, "c", 90_000), keepAllBut("c"))!!
        assertEquals(1, restored.index)
        assertEquals(0, restored.positionMs)
    }

    @Test
    fun staleIndexIsCorrectedByTrackId() {
        val restored = restoreQueue(listOf("a", "b", "c"), SavedPosition(0, "c", 1_000), keepAllBut())!!
        assertEquals(2, restored.index)
        assertEquals(1_000, restored.positionMs)
    }

    @Test
    fun duplicateIdUsesTheSavedIndex() {
        val restored = restoreQueue(listOf("a", "b", "a"), SavedPosition(2, "a", 0), keepAllBut())!!
        assertEquals(2, restored.index)
    }

    @Test
    fun nothingLeftRestoresNothing() {
        assertNull(restoreQueue(listOf("a", "b"), SavedPosition(0, "a", 0), keepAllBut("a", "b")))
        assertNull(restoreQueue(emptyList(), SavedPosition(0, null, 0), keepAllBut()))
    }

    @Test
    fun previousRestartsPastThreeSeconds() {
        assertTrue(shouldRestartOnPrevious(3001, 4))
        assertFalse(shouldRestartOnPrevious(3000, 4))
        assertFalse(shouldRestartOnPrevious(0, 4))
    }

    @Test
    fun previousOnFirstTrackAlwaysRestarts() {
        assertTrue(shouldRestartOnPrevious(0, 0))
    }
}
