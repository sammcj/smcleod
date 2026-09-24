// Bundled as an IIFE (see layouts/shortcodes/vram-calculator.html). The deskbar shell re-runs content scripts
// each time the page enters a window, so this must be safe to run repeatedly: mount() skips live roots.
import { mount } from './ui.js';

for (const root of document.querySelectorAll('.vram-est')) mount(root);
