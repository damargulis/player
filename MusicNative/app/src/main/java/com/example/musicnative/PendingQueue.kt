package com.example.musicnative

/**
 * Hands a queue from the UI to the playback service without going through the Intent.
 *
 * Intent extras cross a Binder transaction, whose buffer is about 1MB for the whole process.
 * Serialising an Array<TrackData> was fine for a playlist or an album, and silently fatal for
 * "All Tracks": tapping near the top of the list queues thousands of tracks, the transaction
 * is rejected with TransactionTooLargeException, and nothing plays. The failure was swallowed
 * by a bare catch, so it looked like the row simply did not respond.
 *
 * The service runs in the same process as the activity - no android:process in the manifest -
 * so passing the queue in memory is sound and has no size limit at all. The Intent still
 * carries the action; only the payload moves here.
 */
object PendingQueue {
    @Volatile
    private var pending: Array<TrackData> = arrayOf()

    fun offer(tracks: Array<TrackData>) {
        pending = tracks
    }

    /**
     * Takes the queue, leaving nothing behind.
     *
     * Cleared on read so a restarted service cannot silently replay an old queue, and so the
     * tracks become collectable rather than pinning the whole library in memory.
     */
    fun take(): Array<TrackData> {
        val taken = pending
        pending = arrayOf()
        return taken
    }
}
