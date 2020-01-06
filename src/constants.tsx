import {remote} from "electron";

const RESOURCES_DIR = "./resources/";

// images should come from:
// https://thenounproject.com/coquet_adrien/collection/
// music-media-player-control-play-multimedia-record/
// if possible
export const Resources = {
  DEFAULT_ALBUM: RESOURCES_DIR + "missing_album.png",
  DEFAULT_ARTIST: RESOURCES_DIR + "missing_artist.png",
  FAVORITE: RESOURCES_DIR + "favorite.png",
  NEXT_ALBUM: RESOURCES_DIR + "next_album.png",
  NEXT_TRACK: RESOURCES_DIR + "next_track.png",
  PAUSE: RESOURCES_DIR + "pause.png",
  PLAY: RESOURCES_DIR + "play.png",
  PREVIOUS_ALBUM: RESOURCES_DIR + "previous_album.png",
  PREVIOUS_TRACK: RESOURCES_DIR + "previous_track.png",
  VOLUME: RESOURCES_DIR + "volume.png",
};

export const DATA_DIR = remote.app.getPath("userData") + "/data";
