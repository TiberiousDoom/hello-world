# Art canvas

The scripts behind the boards on the art canvas, a Design artifact on claude.ai
(https://claude.ai/artifact/Hhr8YoisBKsdzxi641m4Ht, private to the owner). The canvas itself lives on
claude.ai, not here; these scripts rebuild its boards. Each board is a page of HTML (`*.dc.html`) with its
art drawn inline as SVG, written into a folder laid out like the canvas (`project/…`).

`canvas.json` is a copy of the canvas's layout (its pages, boards and where they sit) as of 0.87.9.
Always read the live one from the canvas before publishing: the owner can move and add things there.

Run the scripts from the repository's root with Node 22. Paths in brackets are arguments.

| Board (canvas page) | Script | Notes |
|---|---|---|
| Current art: every sprite as the game draws it (Current art) | `current/gen-current.mjs [repo] [out]` | Writes eight `Current*.dc.html` boards, straight from `src/art`, with the working and firing strips played |
| The ship from the side (Ship and shipyard) | `ship/shipboard.mjs [repo] [out]` | The side-view art module is `ship/shipside.mjs` (as drawn on the canvas; the game's copy is `src/ui/shipview.ts`). Set `H=1900` for the board's height |
| Front fin options (Ship and shipyard) | `ship/finboard.mjs [out]` | Four fin shapes rooted on the line the owner drew; B went into the game |
| Bare trees (Trees) | `trees/treeboard.mjs [repo] [out]` | `trees/baretree.mjs` is the prototype of `art/trees.mjs`; the "Now" column reads the trees from before 0.87.9 out of git |
| Ore patches (Ore) | `ore/board6.mjs [file]` | The last round (above-ground formations; P, terraces, went into the game). `board.mjs` to `board5.mjs` are the earlier rounds, each a file of its own. The looks are in `ore/veins*.mjs` and named in `ore/prev3.mjs` (`node ore/prev3.mjs [look] [file]` previews one look on its own) |
| Nests growing and merging (Nests) | `nests/board.mjs [repo] [file] [screenshots]` | The owner kept the nests as they are; the board holds rounds of proposals. The "Now" row needs JPEG screenshots from `shots/nests.cjs` |

In-game screenshots (`shots/*.cjs`) drive a running build with Playwright: build the game, serve it with
`npx vite preview --port 4174`, then run `node shots/<script>.cjs [folder]`. Stop the preview by its process
id afterwards (see CLAUDE.md's gotchas).

- `seasons.cjs`: a forest turning from the end of fall into winter.
- `ore.cjs` and `ore2.cjs`: the richest ore field of each kind near the hub at two zooms, and an extractor on a field beside a worked-out tile.
- `nests.cjs`: one nest at each stage, then merged over two and four cells.
- `shipgame.cjs`: the ship at several stages on the map, and the shipyard's Side view.

To publish a board, give the Artifact tool the canvas's link, the folder written to as its `root`, `project/canvas.json`
as the file and the boards as `files`, sending only the boards that changed. This replaces those boards on the
canvas, so check first that the owner hasn't drawn on them since.
