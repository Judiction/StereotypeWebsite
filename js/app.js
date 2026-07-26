// js/app.js
import { handleRouting, navigate, parseRoute } from './router.js';
import { renderNav } from './renderer.js';
import { animateNavbarLogo, initProjectCardGlitch } from './effects.js';
import { mountGrass, unmountGrass } from './grass-background.js';

// js/app.js

async function updateApp() {
    const app = document.getElementById('app');
    const lang = localStorage.getItem('lang') || 'en';

    renderNav(lang);
    handleRouting();

    // The interactive grass background only runs on the landing page.
    // body.home-active drives the transparent-nav / light-overlay styling.
    if (parseRoute().type === 'home') {
        document.body.classList.add('home-active');
        mountGrass();
    } else {
        document.body.classList.remove('home-active');
        unmountGrass();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    updateApp();

    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link) {
            const href = link.getAttribute('href');
            // Intercepts any internal link starting with /, but leaves links meant
            // to open in a new tab (e.g. the CV download) alone.
            if (href && href.startsWith('/') && link.target !== '_blank') {
                if (window.location.pathname === href) {
                    console.log("Already on this page. Blocking re-render to prevent flicker.");
                    e.preventDefault(); // Stop the link from doing anything
                    return; // Exit the function entirely
                }
                e.preventDefault();

                // if (window.location.pathname !== href) {
                //     resetFilterState();
                // }
                
                navigate(href);
                updateApp(); 
            }
        }
    });
});

window.addEventListener('popstate', updateApp);

window.changeLang = (lang) => {

    const currentLang = localStorage.getItem('lang') || 'en';
    if (currentLang === lang) return; // Stop here! No flash.
    
    localStorage.setItem('lang', lang);
    updateApp();
};


// EFFECTS
animateNavbarLogo();
initProjectCardGlitch();