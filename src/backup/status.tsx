import {CloudBackupState} from './cloudBackup';
import {MUSIC_BACKUP_INTERVAL_MS, MusicBackupState} from './musicBackup';

const DAY_MS = 24 * 60 * 60 * 1000;
/** The library goes up daily; three missed days is no longer a blip. */
const LIBRARY_STALE_MS = 3 * DAY_MS;
/** Music is fortnightly, so allow one missed cycle. */
const MUSIC_STALE_MS = MUSIC_BACKUP_INTERVAL_MS * 2;

export interface BackupLine {
  label: string;
  text: string;
  /** Needs looking at: never succeeded, overdue, or the last run failed. */
  warn: boolean;
}

function age(at: number, now: number): string {
  const days = Math.floor((now - at) / DAY_MS);
  if (days < 1) {
    const hours = Math.max(1, Math.round((now - at) / (60 * 60 * 1000)));
    return `${hours}h ago`;
  }
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

function line(label: string, success: number | undefined, error: string | undefined, lastRun: number | undefined,
              staleMs: number, now: number): BackupLine {
  // an error only counts if it came after the last success; a later good run clears it
  const failing = !!error && (!success || (lastRun !== undefined && lastRun > success));
  if (!success) {
    return {label, text: failing ? `never succeeded — ${error}` : 'never run', warn: true};
  }
  const overdue = now - success > staleMs;
  const text = `last succeeded ${age(success, now)}` + (failing ? ` — last run failed: ${error}` : '');
  return {label, text, warn: overdue || failing};
}

/**
 * What the offsite backups last did, for the Stats page. Failures used to go only to the console,
 * so a broken key or a disabled billing account could stop every backup for months unnoticed —
 * long enough for the bucket's 180-day expiry to remove every snapshot there was.
 */
export function backupStatus(cloud: CloudBackupState, music: MusicBackupState, now: number = Date.now()):
    BackupLine[] {
  return [
    line('Library', cloud.lastSuccessAt, cloud.lastError, cloud.lastRunAt, LIBRARY_STALE_MS, now),
    line('Music', music.lastSuccessAt, music.lastError, music.lastRunAt, MUSIC_STALE_MS, now),
  ];
}
