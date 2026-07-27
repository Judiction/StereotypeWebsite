// js/landing-sketch.js
//
// Picks one of several landing-page background sketches at random each time
// the home route mounts, and wires it into the fixed #grass-bg layer behind
// the landing page, using the generic sketch loader (js/sketch-loader.js).
// Only needed on the home route: loaded on first use and fully torn down
// when the user navigates away (releasing the WebGL context).
//
// To add a sketch: drop a new module in landingpage/ exporting the same
// mount(container) -> unmount contract (see landingpage/grass-prototype.js
// or landingpage/cube-prototype.js for the reference shape), then add its
// path to SKETCH_MODULES below. That's the only line that needs to change.

import { createSketchController } from './sketch-loader.js';

const SKETCH_MODULES = [
    '../landingpage/grass-prototype.js',
    '../landingpage/cube-prototype.js',
    '../landingpage/type-prototype.js',
    '../landingpage/wave-grid-prototype.js',
];

// Some sketches (currently just the grass one) have asset filenames
// (skybox, font, .glb, PNGs) that are relative and live in /landingpage/,
// not the site root this page is served from. This tells them where to
// find them. Harmless for sketches that don't use it.
window.__GRASS_ASSET_BASE__ = './landingpage/';

// One controller per sketch, created up front — cheap, since
// createSketchController doesn't load anything until mount() is called.
const controllers = SKETCH_MODULES.map(createSketchController);

let activeController = null;

export function mountLandingSketch() {
    const container = document.getElementById('grass-bg');
    if (!container) return;

    // A fresh pick each time we mount, e.g. each visit to the home route.
    activeController = controllers[Math.floor(Math.random() * controllers.length)];
    return activeController.mount(container);
}

export function unmountLandingSketch() {
    if (activeController) {
        activeController.unmount();
        activeController = null;
    }
}
