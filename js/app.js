// js/app.js
import { handleRouting, navigate } from './router.js';
import { renderNav } from './renderer.js';

// js/app.js

async function updateApp() {
    const app = document.getElementById('app');
    const lang = localStorage.getItem('lang') || 'en';



    // 2. Wait a tiny bit for the CSS transition to start (optional but smoother)

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