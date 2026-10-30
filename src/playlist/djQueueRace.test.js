import DJPlaylist from './DJPlaylist';

/**
 * The reported bug: the DJ rewrites the queue just as a song ends, the new track shows up
 * twice, and playback stops. Two faults met — this file covers the queue half.
 */
describe('rewriting the queue as a track ends', () => {
  function playing(ids) {
    const queue = new DJPlaylist();
    queue.setUpcoming(ids);
    queue.nextTrack();
    return queue;
  }

  // The DJ reads the queue (X current, A next), composes a new one, and X ends before the
  // tool call lands. Its list still leads with A — which is now playing.
  it('does not queue the track that is already playing behind itself', () => {
    const queue = playing(['X', 'A', 'B']);
    expect(queue.nextTrack()).toEqual('A');

    queue.setUpcoming(['A', 'B', 'D']);

    expect(queue.getCurrentTrack()).toEqual('A');
    expect(queue.getUpcoming()).toStrictEqual(['B', 'D']);
  });

  it('does not replay the current track on the next advance', () => {
    const queue = playing(['X', 'A']);
    queue.nextTrack();
    queue.setUpcoming(['A', 'B']);
    expect(queue.nextTrack()).toEqual('B');
  });

  // Only a leading duplicate is dropped: queueing something again later is deliberate.
  it('keeps the current track when it is queued again further down', () => {
    const queue = playing(['A', 'B']);
    queue.setUpcoming(['B', 'A', 'C']);
    expect(queue.getUpcoming()).toStrictEqual(['B', 'A', 'C']);
  });

  it('leaves an unrelated queue alone', () => {
    const queue = playing(['A', 'B']);
    queue.setUpcoming(['C', 'D']);
    expect(queue.getUpcoming()).toStrictEqual(['C', 'D']);
  });

  it('handles a queue set before anything is playing', () => {
    const queue = new DJPlaylist();
    queue.setUpcoming(['A', 'B']);
    expect(queue.getUpcoming()).toStrictEqual(['A', 'B']);
  });

  it('handles an empty queue', () => {
    const queue = playing(['A', 'B']);
    queue.setUpcoming([]);
    expect(queue.getUpcoming()).toStrictEqual([]);
  });

  // add_to_queue 'next' goes through the same sink, so the same race applies to it.
  it('does not insert the playing track directly after itself', () => {
    const queue = playing(['A', 'B']);
    queue.addUpcoming(['A'], 'next');
    expect(queue.getUpcoming()).toStrictEqual(['B']);
  });
});
