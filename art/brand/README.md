# Box47 Games: the logo (D-188)

`prototype.png` is the owner's prototype: 256×256 pixel art, shown at 4×. The scripts touch it up:

- `clean.py`: samples one pixel per art pixel, merges near-duplicate colours (41 to 21), and makes the wordmark one ink.
- `drawicon.py`: the box drawn as clean shapes from the prototype's corners, for small sizes (`mark_16` to `mark_64`;
  16 has no tape or shadow). `_clear` versions have no background.
- `word.py`, `word2.py`: the wordmark redrawn on the same 3-pixel stroke (the B's bowls even, the x symmetric) and
  GAMES under it.
- `compose.py`: `box47_logo_256.png` / `_1024.png` (the prototype's layout with the new wordmark),
  `box47_lockup.png` (box and wordmark side by side, for the site's header) and `before_after.png`.

Run them in that order from this folder with Python, numpy and Pillow: `python3 clean.py && python3 drawicon.py && python3 compose.py`.
The studio site's images (`studio/public/img/`) are copies of these outputs, plus `nestfall.webp`, a screenshot of the main menu.
