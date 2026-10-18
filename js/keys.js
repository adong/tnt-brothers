/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: "TNT Brothers",
  cols: ["Player 1", "Player 2"],
  keys: [
    ["walk", "← → or A D", "J L"],
    ["jump (hold for higher)", "Space W or ↑", "U or I"],
    ["run", "Shift", "H or ;"],
    ["throw (🏀 power)", "F", "O"],
    ["go down a vent", "↓ or S", "K"],
    ["call your brother · high five", "T", "T"],
    ["pause · sound", "P or Esc · M", ""],
  ],
  note: "In 1 player both sets of keys work.",
  touch: "◀ ▶, JUMP, 🏀 and ▼ buttons. Tap your brother's face (top right) to call him. Turn a phone sideways.",
});
