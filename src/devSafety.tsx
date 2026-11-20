import {IS_DEV, IS_TEST} from './constants';

/**
 * Things the app does to the world outside this machine on its own, unasked.
 *
 * A development copy did all of them with the same keys as the installed app: it uploaded its
 * own library to the real backup bucket (and took November's monthly snapshot slot with it),
 * started a music backup, spent JamBase calls refreshing concerts, and advertised itself to the
 * phone as "MyMusic" — which could have synced the phone's plays into the dev library and
 * cleared them from the phone. The main process gates its own two (`bonjour`, `shortcuts`) in
 * `public/devSafety.js`; keep the variable's rules the same in both.
 */
export type ExternalEffect = 'backup' | 'concerts';

/**
 * Whether an automatic external effect may run. Always in the installed app; in development and
 * under test only when `MYMUSIC_DEV_EFFECTS` names it (comma-separated, or `all`), e.g.
 * `MYMUSIC_DEV_EFFECTS=concerts yarn electron-dev`. Something a person clicks — Refresh, an
 * extension, publishing lyrics — is intentional and is never gated.
 */
export function externalEffectsAllowed(effect: ExternalEffect,
                                       env: Record<string, string | undefined> = process.env,
                                       dev: boolean = IS_DEV || IS_TEST): boolean {
  if (!dev) {
    return true;
  }
  const allowed = (env.MYMUSIC_DEV_EFFECTS || '').split(',').map((part) => part.trim());
  return allowed.includes('all') || allowed.includes(effect);
}
