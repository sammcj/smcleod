// The Appearance choices the Control panel offers (lazy/control-panel.js draws them, settings.js stores them) and
// the presets that set them together. Data only: a new choice is a line here plus the styles that draw it.
// - A palette is css/deskbar/palettes/<value>.css.
// - A window style, wallpaper or dock named <family> or <family>-<variant> is drawn by css/deskbar/looks/<family>.css
//   when there is one (head.html links it before first paint whichever of the three names it), else by
//   css/deskbar/lazy/control-panel.css. So a look's dock or wallpaper goes with any window style, and its variants
//   share its stylesheet.
// - A CRT effect is css/deskbar/effects/crt.css.

// [value, label, swatch: 'tab frame desktop']
export const PALETTES = [
  ['haiku', 'Haiku', '#ffcb00 #d8d8d8 #2b4b72'], ['crisp', 'Crisp', '#ffcf0f #f1f2f4 #2d67b5'], ['beos', 'BeOS', '#ffcb00 #d8d8d8 #336698'],
  ['xfce', 'Xfce', '#a3bddf #d9dde3 #3f6189'], ['sage', 'Sage', '#b5cf9c #d9dbd3 #4d6a43'],
  ['snow', 'Snow', '#bcd7fb #f2f5f9 #7eaee8'], ['mint', 'Mint', '#aee8d3 #f1f7f4 #5cc3a1'], ['peach', 'Peach', '#ffcfba #fbf6f3 #f59e7e'],
  ['lilac', 'Lilac', '#ccb8f6 #f5f3fb #a891e2'], ['blossom', 'Blossom', '#ffc4d9 #fdf4f7 #f0a2c0'], ['lemon', 'Lemon', '#ffe98a #fafbf6 #7ec4de'],
  ['synthwave', 'Synthwave', '#ff8fcb #e6def5 #4a2590'],
  ['rose', 'Rosé', '#e9a8a6 #f2e9e1 #b98aa0'], ['ember', 'Ember', '#f5a04a #ebdbb2 #423c38'], ['solar', 'Solar', '#d5a41c #eee8d5 #0b3d4a'],
  ['lagoon', 'Lagoon', '#ff8a70 #f0e6d2 #3fb1b8'], ['cobalt', 'Cobalt', '#ff9b3d #e3e9fb #2049c6'], ['racing', 'Racing Green', '#e9a560 #f3f5f0 #1d5039'],
];
export const MODES = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];
export const DECOS = [['haiku', 'Haiku'], ['beos', 'BeOS'], ['flat', 'Flat'], ['clear', 'Clear'], ['liquid', 'Liquid Ass'],
  ['platinum', 'Platinum'], ['clearlooks', 'Clearlooks'], ['phosphor', 'Phosphor'], ['broadsheet', 'Broadsheet'], ['synthwave', 'Synthwave'],
  ['vector', 'Vector'], ['memphis', 'Memphis'], ['nightdrive', 'Night Drive'], ['pixel', 'Pixel']];
export const DOCKS = [['glass', 'Glass'], ['deskbar', 'Deskbar'], ['panel', 'Panel'], ['liquid', 'Liquid Ass'],
  ['platinum', 'Platinum'], ['clearlooks', 'Clearlooks'], ['phosphor', 'Function keys'], ['broadsheet', 'Broadsheet'], ['synthwave', 'Synthwave'],
  ['vector', 'Vector'], ['memphis', 'Memphis'], ['nightdrive', 'Night Drive'],
  ['pixel', 'Hotbar'], ['pixel-cartridge', 'Cartridges']];
export const WALLS = [['rings', 'Rings'], ['plain', 'Plain'], ['grid', 'Grid'], ['dots', 'Dots'], ['hills', 'Hills'], ['liquid', 'Liquid'], ['clear', 'Clear'],
  ['platinum', 'Platinum'], ['clearlooks', 'Clearlooks'], ['phosphor', 'Phosphor'], ['broadsheet', 'Broadsheet'], ['synthwave', 'Synthwave'],
  ['vector', 'Vector'], ['memphis', 'Memphis'], ['nightdrive', 'Night Drive'],
  ['pixel', 'Pixel hills'], ['pixel-pico', 'Pico']];
export const CRTS = [['off', 'Off'], ['scanlines', 'Scanlines'], ['tube', 'Tube'], ['grille', 'Aperture grille'], ['amber', 'Amber'], ['green', 'Green']];

// Window styles drawn in colours of their own, so the palettes don't reach them. colours: what the Colours group
// offers instead while one is on, the first being the style's own (palette values that only apply under it); with
// none, Colours is off. dark: the style has no light mode, so Mode is off too.
export const LOOKS = {
  platinum: {}, clearlooks: {}, broadsheet: {},
  phosphor: { dark: true }, synthwave: { dark: true }, vector: { dark: true }, memphis: { dark: true }, nightdrive: { dark: true },
  pixel: { colours: [['pixel', 'Pixel', '#ffcd4d #f5ead0 #3a8adf'], ['pixel-pico', 'Pico', '#ff77a8 #c2c3c7 #1d2b53']] },
};

// Every Appearance setting but the mode, which stays the visitor's. A preset names each one, so picking it gives the
// same desktop whatever was on before.
export const KEYS = ['deco', 'palette', 'wall', 'dock', 'crt'];
const whole = name => ({ deco: name, palette: 'haiku', wall: name, dock: name, crt: 'off' });
export const PRESETS = [
  { id: 'classic', label: 'Deskbar Classic', deco: 'haiku', palette: 'haiku', wall: 'rings', dock: 'glass', crt: 'off' },
  { id: 'crisp', label: 'Crisp', deco: 'haiku', palette: 'crisp', wall: 'plain', dock: 'glass', crt: 'off' },
  { id: 'lilac', label: 'Lilac', deco: 'flat', palette: 'lilac', wall: 'dots', dock: 'glass', crt: 'off' },
  { id: 'racing', label: 'Racing Green', deco: 'beos', palette: 'racing', wall: 'grid', dock: 'deskbar', crt: 'off' },
  { id: 'beos', label: 'BeOS', deco: 'beos', palette: 'beos', wall: 'plain', dock: 'deskbar', crt: 'off' },
  { id: 'xfce', label: 'Xfce', deco: 'flat', palette: 'xfce', wall: 'hills', dock: 'panel', crt: 'off' },
  { id: 'clear', label: 'Clear', deco: 'clear', palette: 'haiku', wall: 'clear', dock: 'glass', crt: 'off' },
  { id: 'liquid', label: 'Liquid Ass', ...whole('liquid') },
  { id: 'platinum', label: 'Platinum', ...whole('platinum') },
  { id: 'clearlooks', label: 'Clearlooks', ...whole('clearlooks') },
  { id: 'phosphor', label: 'Phosphor', ...whole('phosphor'), crt: 'tube' },
  { id: 'broadsheet', label: 'Broadsheet', ...whole('broadsheet') },
  { id: 'synthwave', label: 'Synthwave', ...whole('synthwave') },
  { id: 'vector', label: 'Vector', ...whole('vector') },
  { id: 'memphis', label: 'Memphis', ...whole('memphis') },
  { id: 'nightdrive', label: 'Night Drive', ...whole('nightdrive') },
  { id: 'pixel', label: 'Pixel', ...whole('pixel'), palette: 'pixel' },
  { id: 'pixel-pico', label: 'Pico', deco: 'pixel', palette: 'pixel-pico', wall: 'pixel-pico', dock: 'pixel-cartridge', crt: 'off' },
];

// The stylesheet key (loader.js, lazy.html) that draws a window style, wallpaper or dock value, if it has one. Every
// looks/<family>.css has a LOOKS entry (tests/control-panel.test.mjs checks), so no other family asks for one.
export const lookSheet = v => { const f = v.split('-')[0]; return LOOKS[f] ? 'look-' + f : null; };
// What Colours offers under a window style, and whether it is on
export const coloursFor = deco => LOOKS[deco]?.colours || PALETTES;
export const ownsColours = deco => !!LOOKS[deco] && !LOOKS[deco].colours;
