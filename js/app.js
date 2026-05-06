// js/app.js
import { handleRouting, navigate } from './router.js';
import { renderNav } from './renderer.js';

// js/app.js

async function updateApp() {
    const app = document.getElementById('app');
    const lang = localStorage.getItem('lang') || 'en';

    // 1. Start the fade out
    app.classList.add('loading');

    // 2. Wait a tiny bit for the CSS transition to start (optional but smoother)
    setTimeout(() => {
        renderNav(lang);
        handleRouting();
        
        // 3. Fade back in
        app.classList.remove('loading');
    }, 50); 
}

document.addEventListener('DOMContentLoaded', () => {
    updateApp();

    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (link) {
            const href = link.getAttribute('href');
            // Intercepts any internal link starting with /
            if (href && href.startsWith('/')) {
                e.preventDefault();
                navigate(href);
                updateApp(); 
            }
        }
    });
});

window.addEventListener('popstate', updateApp);

window.changeLang = (lang) => {
    localStorage.setItem('lang', lang);
    updateApp();
};