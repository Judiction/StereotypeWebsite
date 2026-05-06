// js/router.js
import * as Renderer from './renderer.js'; 
import { works, digitalArt } from '../data/projects.js'; // You'll need the data too!

export function parseRoute() {
    const path = window.location.pathname;
    
    // Clean segments: remove empty strings and index.html
    const segments = path.split('/')
        .filter(seg => seg !== "" && seg !== "index.html");

    console.log("Segments found:", segments); // Debugging

    // IF NO SEGMENTS, IT IS THE HOME PAGE
    if (segments.length === 0) {
        return { type: 'home' };
    }

    if (segments[0] === 'work') {
        return segments[1] 
            ? { type: 'project', slug: segments[1], collection: 'works' }
            : { type: 'work-list' };
    }

    if (segments[0] === 'about') return { type: 'about' };
    if (segments[0] === 'digital-art') return { type: 'art-list' };

    // ONLY return 404 if it didn't match anything above
    return { type: '404' };
}

function updateMeta(description) {
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = "description";
        document.head.appendChild(meta);
    }
    meta.setAttribute('content', description);
}

export function handleRouting() {
    const route = parseRoute();
    const lang = localStorage.getItem('lang') || 'en'; // Default to English
    
    console.log("Routing to:", route);

    const appContainer = document.getElementById('app');

    switch (route.type) {
        case 'home':
            Renderer.renderHome(appContainer, lang);
            updateMeta("Portfolio of Judd Buchannan, Motion Designer and Art Director.");
            break;
        case 'about':
            Renderer.renderAbout(appContainer, lang);
            break;
        case 'work-list':
            Renderer.renderFilterableGrid(appContainer, works, lang);
            break;
        case 'art-list':
            Renderer.renderFilterableGrid(appContainer, digitalArt, lang);
            break;
        case 'project':
            // 1. Identify which list to look in
            const source = route.collection === 'works' ? works : digitalArt;
            const projectData = source[route.slug];

            if (projectData) {
                Renderer.renderProjectPage(appContainer, projectData, lang);
                // Bonus: Update the Browser Tab Title
                document.title = `${projectData.title[lang]} | Judd Buchannan`;
            } else {
                // If the slug doesn't exist in our JS, show 404
                appContainer.innerHTML = `<h1>Project Not Found</h1>`;
            }
            break;
        default:
            // renderError(lang);
    }
}

/**
 * Navigate to a new path without a page refresh
 */
export function navigate(path) {
    window.history.pushState({}, "", path);
}

// Listen for browser back/forward buttons
window.addEventListener('popstate', handleRouting);