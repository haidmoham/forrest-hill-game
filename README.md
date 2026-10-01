# Forrest Hill Game

A toy-brick battling game built live with a classroom, featuring Mega Greninja, Godzilla, Mega Charizard X, Mega Lucario, Raichu, and a Lucario × Raichu fusion.

## Play and build

- `npm ci`
- `npm run build`
- `npm run dev` (serves the built `public/` directory)
- Open `public/forrest-hill-game-offline.html` for a self-contained copy

Use the fighter picker, choose a challenger, and battle with four moves. Keys 1–4 select moves, F fuses, and arrow keys rotate the arena. Sound is opt-in. Fainting includes a dramatic topple, toy-brick burst, disappearance, and a champion celebration.

## Deployment

Vercel builds `main` with `npm run build` and serves `public/`. The classroom source was preserved from `haidmoham/chopper-little-rescue` commit `2a14b9069bb5de0c960f4b520363dd43fc905a55`. The original rescue project is retained separately.

## Credits

Original procedural toy-brick meshes and interface, rendered with Three.js. Pokémon characters and names belong to their respective owners, including Nintendo, Creatures, and GAME FREAK. Godzilla belongs to Toho. This is an unofficial educational fan project, unaffiliated with these rights holders or LEGO. No extracted game assets are included. Three.js and esbuild retain their upstream licenses.

## Verification

Production build passes. Cloud-browser character selection and battle actions were checked with the illustrated fallback; hardware WebGL motion verification is separate. The previous rescue-game test suite is not represented as battle-game coverage.
