import DJPlaylist from './DJPlaylist';

describe('DJPlaylist', () => {
  it('starts empty and plays through the queue in order', () => {
    const playlist = new DJPlaylist();
    expect(playlist.getCurrentTrack()).toBeUndefined();
    expect(playlist.nextTrack()).toBeUndefined();
    playlist.setUpcoming(['a', 'b', 'c']);
    expect(playlist.nextTrack()).toBe('a');
    expect(playlist.nextTrack()).toBe('b');
    expect(playlist.getUpcoming()).toStrictEqual(['c']);
    expect(playlist.getHistory()).toStrictEqual(['a', 'b']);
  });

  it('seeds with the currently playing track so takeover is seamless', () => {
    const playlist = new DJPlaylist('now');
    expect(playlist.nextTrack()).toBe('now');
    expect(playlist.getUpcoming()).toStrictEqual([]);
  });

  it('rewrites what comes next without touching the current track', () => {
    const playlist = new DJPlaylist();
    playlist.setUpcoming(['a', 'b', 'c']);
    playlist.nextTrack();
    playlist.setUpcoming(['x', 'y']);
    expect(playlist.getCurrentTrack()).toBe('a');
    expect(playlist.getUpcoming()).toStrictEqual(['x', 'y']);
    playlist.addUpcoming(['z'], 'end');
    playlist.addUpcoming(['w'], 'next');
    expect(playlist.getUpcoming()).toStrictEqual(['w', 'x', 'y', 'z']);
    playlist.removeUpcoming(['x', 'z']);
    expect(playlist.getUpcoming()).toStrictEqual(['w', 'y']);
  });

  it('supports going back and forward through history', () => {
    const playlist = new DJPlaylist();
    playlist.setUpcoming(['a', 'b', 'c']);
    playlist.nextTrack();
    playlist.nextTrack();
    expect(playlist.hasPrevTrack()).toBe(true);
    expect(playlist.prevTrack()).toBe('a');
    expect(playlist.hasPrevTrack()).toBe(false);
    expect(playlist.prevTrack()).toBe('a');
    expect(playlist.getUpcoming()).toStrictEqual(['b', 'c']);
    expect(playlist.nextTrack()).toBe('b');
    expect(playlist.nextTrack()).toBe('c');
  });

  it('truncates forward history when the queue is rewritten after going back', () => {
    const playlist = new DJPlaylist();
    playlist.setUpcoming(['a', 'b']);
    playlist.nextTrack();
    playlist.nextTrack();
    playlist.prevTrack();
    playlist.setUpcoming(['z']);
    expect(playlist.getHistory()).toStrictEqual(['a']);
    expect(playlist.nextTrack()).toBe('z');
  });

  it('skips and rewinds whole queued albums with the album buttons', () => {
    const playlist = new DJPlaylist();
    playlist.setUpcoming(['single']);
    playlist.addAlbum(['a1', 'a2', 'a3'], 'albumA', 'end');
    playlist.addAlbum(['b1', 'b2'], 'albumB', 'end');
    playlist.nextTrack(); // single
    expect(playlist.hasNextAlbum()).toBe(false); // untagged track: album buttons off
    playlist.nextTrack(); // a1
    expect(playlist.hasNextAlbum()).toBe(true);
    expect(playlist.hasPrevAlbum()).toBe(false); // already at the album's first track
    playlist.nextTrack(); // a2
    expect(playlist.hasPrevAlbum()).toBe(true);
    expect(playlist.nextAlbum()).toBe('b1'); // skips a3
    expect(playlist.getUpcoming()).toStrictEqual(['b2']);
    playlist.nextTrack(); // b2
    expect(playlist.prevAlbum()).toBe('b1'); // rewind to start of album B
    expect(playlist.getUpcoming()).toStrictEqual(['b2']);
  });

  it('nextAlbum on an untagged track just advances one', () => {
    const playlist = new DJPlaylist();
    playlist.setUpcoming(['x', 'y']);
    playlist.nextTrack();
    expect(playlist.nextAlbum()).toBe('y');
  });

  it('stops when the queue runs dry and resumes once refilled', () => {
    const playlist = new DJPlaylist();
    playlist.setUpcoming(['a']);
    playlist.nextTrack();
    expect(playlist.hasNextTrack()).toBe(false);
    expect(playlist.nextTrack()).toBeUndefined();
    expect(playlist.getCurrentTrack()).toBe('a');
    playlist.setUpcoming(['b']);
    expect(playlist.hasNextTrack()).toBe(true);
    expect(playlist.nextTrack()).toBe('b');
    expect(playlist.hasNextAlbum()).toBe(false);
  });
});
