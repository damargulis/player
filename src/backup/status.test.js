import {backupStatus} from "./status";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1000 * DAY;

/** Backup failures used to reach only the console, so they could go unnoticed for months. */
describe("backupStatus", () => {
  it("is quiet when both are recent and the last runs worked", () => {
    const lines = backupStatus({lastRunAt: NOW - DAY, lastSuccessAt: NOW - DAY},
      {lastRunAt: NOW - 3 * DAY, lastSuccessAt: NOW - 3 * DAY}, NOW);
    expect(lines.map((l) => l.warn)).toEqual([false, false]);
    expect(lines[0].text).toBe("last succeeded yesterday");
  });

  it("warns when the latest run failed, naming the error", () => {
    const [library] = backupStatus({lastError: "Upload failed (403)", lastRunAt: NOW - 1000, lastSuccessAt: NOW - DAY},
      {}, NOW);
    expect(library.warn).toBe(true);
    expect(library.text).toContain("Upload failed (403)");
  });

  it("ignores an error a later success has cleared", () => {
    const [library] = backupStatus({lastError: "old", lastRunAt: NOW - DAY, lastSuccessAt: NOW - DAY}, {}, NOW);
    expect(library.warn).toBe(false);
  });

  it("warns when a backup is overdue, and when one has never run", () => {
    const [library, music] = backupStatus({lastRunAt: NOW - 5 * DAY, lastSuccessAt: NOW - 5 * DAY}, {}, NOW);
    expect(library.warn).toBe(true);
    expect(music).toEqual({label: "Music", text: "never run", warn: true});
  });
});
