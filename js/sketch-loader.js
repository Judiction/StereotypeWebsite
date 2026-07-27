// js/sketch-loader.js
//
// Generic lazy-load / mount / unmount controller for the vanilla three.js
// sketches used as landing-page backgrounds. Each sketch is a plain ES
// module exporting `mount(container)`, which returns an `unmount()` cleanup
// function — see landingpage/grass-prototype.js for the reference shape.
//
// This controller handles the two fiddly bits so individual sketches don't
// have to:
//   - load-once caching (the dynamic import() only ever runs once)
//   - the "navigated away before the module finished loading" race
//
// To add another sketch later: drop a new module next to grass-prototype.js
// with the same mount(container) -> unmount shape, then add it to the
// sketch list in landing-sketch.js — that's the only wiring needed for it
// to be picked up in rotation.

export function createSketchController(modulePath) {
    let loadPromise = null;  // cached dynamic import()
    let unmountFn = null;    // cleanup returned by the sketch's mount(), or null when unmounted
    let wantMounted = false; // desired state, so a fast navigate-away wins a race

    function ensureLoaded() {
        if (!loadPromise) loadPromise = import(modulePath);
        return loadPromise;
    }

    async function mount(container) {
        if (wantMounted) return; // already mounted (or mounting)
        wantMounted = true;

        try {
            const sketch = await ensureLoaded();
            // A navigate-away may have fired while we were loading.
            if (!wantMounted || unmountFn) return;
            unmountFn = sketch.mount(container);
        } catch (err) {
            console.error(`Could not start sketch "${modulePath}":`, err);
            wantMounted = false;
        }
    }

    function unmount() {
        wantMounted = false;
        if (unmountFn) {
            unmountFn();
            unmountFn = null;
        }
    }

    return { mount, unmount };
}