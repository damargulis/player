import {DATA_DIR} from "./constants";
import os from "os";

// The library reducer writes DATA_DIR/library.json on every UPDATE_LIBRARY, so a test
// that seeds the store would destroy the real library if DATA_DIR pointed at it.
test("tests never resolve DATA_DIR to a real library directory", () => {
  expect(DATA_DIR.startsWith(os.tmpdir())).toBe(true);
  expect(DATA_DIR).not.toBe("./data");
});
