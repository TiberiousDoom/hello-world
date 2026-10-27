// `window.game` is the debug handle exposed by src/main.ts.
declare interface Window {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests reach into anything
  game: any;
}
