// js/app.js
import { handleRouting, navigate } from './router.js';
import { renderNav } from './renderer.js';

// js/app.js

async function updateApp() {
    const app = document.getElementById('app');
    const lang = localStorage.getItem('lang') || 'en';

    renderNav(lang);
    handleRouting();
    

}

document.addEventListener('DOMContentLoaded', () => {
    updateApp();

    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link) {
            const href = link.getAttribute('href');
            // Intercepts any internal link starting with /
            if (href && href.startsWith('/')) {
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