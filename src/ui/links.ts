// Links the main menu's footer offers (D-169): the privacy page, and a way to tip the developer.

/** The privacy page, at the game's address (D-181): absolute, so the single-file build (which has no public/ folder) links to it too. */
export const PRIVACY_URL = 'https://playnestfall.com/privacy.html';

/**
 * The developer's Ko-fi page for tips (D-017, D-169), such as "https://ko-fi.com/name". Empty: no Support
 * link shows. Only an https link to ko-fi.com is used.
 */
export const SUPPORT_URL = 'https://ko-fi.com/box47games';

/** The Support link to show, or null for none. */
export function supportUrl(url = SUPPORT_URL): string | null {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && (u.hostname === 'ko-fi.com' || u.hostname.endsWith('.ko-fi.com')) ? u.href : null;
  } catch {
    return null;
  }
}
