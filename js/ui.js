//./js/ui.js
import { renderGrid } from './renderer.js';
import { dictionary } from '../data/dictionary.js';

export function buildFilterMenu(container, categories, lang, list) { // Added 'list' parameter
    if (!container) return;

    const allLabel = lang === 'pt' ? 'Todos' : lang === 'fr' ? 'Tous' : 'All';
    
    container.innerHTML = `
        <button class="filter-btn active" data-cat="all">${allLabel}</button>
        ${categories.map(cat => {
            const label = dictionary.categories[cat] ? dictionary.categories[cat][lang] : cat;
            return `<button class="filter-btn" data-cat="${cat}">${label}</button>`;
        }).join('')}
    `;

    container.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.getAttribute('data-cat');
            // Pass the list to setActiveFilter
            setActiveFilter(btn, category, lang, list); 
        });
    });
}

function setActiveFilter(activeBtn, category, lang, list) { // Added 'list' parameter
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');

    // CRITICAL: Target the grid container, NOT the whole app [cite: 146]
    // If you use 'app', the filter menu itself will be deleted when you click!
    const gridTarget = document.getElementById('grid-results-target');
    const filter = category === 'all' ? null : category;
    
    // Now 'list' is correctly passed from the original page load
    renderGrid(gridTarget, list, filter, lang);
}