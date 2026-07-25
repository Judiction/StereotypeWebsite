// js/grass-background.js
//
// Lazily loads the React + three.js interactive grass scene
// (landingpage/grass-prototype.jsx) and mounts it into the fixed #grass-bg
// layer that sits behind the landing page. The component is only needed on
// the home route, so it's loaded on first use and fully torn down when the
// user navigates away (unmount() runs the component's cleanup, releasing the
// WebGL context). The heavy transpile/import step only ever runs once.

let loadPromise = null; // cached { React, createRoot, GrassPrototype }
let currentRoot = null; // active React root, or null when unmounted
let wantMounted = false; // desired state, so a fast navigate-away wins a race

async function ensureLoaded() {
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
        if (typeof Babel === 'undefined') {
            throw new Error(
                'Babel Standalone is not loaded — the grass background needs the ' +
                '<script src=".../@babel/standalone"> tag in index.html.'
            );
        }

        // The grass component's asset filenames (skybox, font, .glb, PNGs)
        // are relative; they live in /landingpage/, not the site root this
        // page is served from. This tells the component where to find them.
        window.__GRASS_ASSET_BASE__ = './landingpage/';

        const [{ default: React }, { createRoot }] = await Promise.all([
            import('react'),
            import('react-dom/client'),
        ]);

        const source = await (await fetch('./landingpage/grass-prototype.jsx')).text();

        const { code } = Babel.transform(source, {
            presets: ['react'],
            filename: 'grass-prototype.jsx',
            sourceType: 'module',
        });

        const blob = new Blob([code], { type: 'text/javascript' });
        const moduleUrl = URL.createObjectURL(blob);
        const { default: GrassPrototype } = await import(moduleUrl);

        return { React, createRoot, GrassPrototype };
    })();

    return loadPromise;
}

export async function mountGrass() {
    if (wantMounted) return; // already mounted (or mounting)
    wantMounted = true;

    const container = document.getElementById('grass-bg');
    if (!container) return;

    try {
        const { React, createRoot, GrassPrototype } = await ensureLoaded();
        // A navigate-away may have fired while we were loading.
        if (!wantMounted || currentRoot) return;
        currentRoot = createRoot(container);
        currentRoot.render(React.createElement(GrassPrototype));
    } catch (err) {
        console.error('Could not start the grass background:', err);
        wantMounted = false;
    }
}

export function unmountGrass() {
    wantMounted = false;
    if (currentRoot) {
        currentRoot.unmount(); // triggers the component's useEffect cleanup
        currentRoot = null;
    }
}
