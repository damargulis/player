import {buildRecord} from './refillLog';
import DJPlaylist from '../playlist/DJPlaylist';

function filled(ids) {
  const queue = new DJPlaylist();
  queue.setUpcoming(ids);
  queue.nextTrack();
  return queue;
}

describe('buildRecord', () => {
  // The whole point: separating "told it was empty right after filling" from an ordinary
  // end-of-queue refill, so the next occurrence identifies itself.
  it('flags an empty queue that was filled moments ago', () => {
    const queue = filled(['a', 'b']);
    queue.nextTrack();
    expect(queue.getUpcoming()).toStrictEqual([]);
    const record = buildRecord(queue, 0, 'b');
    expect(record.suspicious).toBe(true);
    expect(record.lastWriteSize).toBeGreaterThan(0);
  });

  it('does not flag an ordinary refill with tracks still queued', () => {
    const queue = filled(['a', 'b', 'c', 'd']);
    expect(buildRecord(queue, 2, 'a').suspicious).toBe(false);
  });

  // An empty queue long after the last write is just a set that ran its course.
  it('does not flag a queue that emptied long after it was written', () => {
    const queue = filled(['a', 'b']);
    queue.nextTrack();
    const hourLater = Date.now() + 60 * 60 * 1000;
    expect(buildRecord(queue, 0, 'b', hourLater).suspicious).toBe(false);
  });

  it('captures the ids actually queued, to tell miscounting from genuine emptiness', () => {
    const queue = filled(['a', 'b', 'c']);
    const record = buildRecord(queue, 2, 'a');
    expect(record.upcoming).toStrictEqual(['b', 'c']);
    expect(record.upcomingLength).toEqual(2);
  });

  it('captures the internal indices, which are invisible from outside', () => {
    const queue = filled(['a', 'b']);
    const record = buildRecord(queue, 1, 'a');
    expect(record.current).toEqual(0);
    expect(record.historyLength).toEqual(1);
  });

  it('survives a queue that was never written', () => {
    const record = buildRecord(new DJPlaylist(), 0, undefined);
    expect(record.secondsSinceWrite).toBeNull();
    expect(record.suspicious).toBe(false);
  });
});
