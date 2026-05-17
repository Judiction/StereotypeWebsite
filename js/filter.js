// ./js/filter.js
import { renderGrid } from './renderer.js';
import { dictionary } from '../data/dictionary.js';

// --- STATE MANAGEMENT ---
export let currentFilter = 'all';

export function buildFilterMenu(container, categories, lang, list) {
    if (!container) return;

    const allLabel = lang === 'pt' ? 'Todos' : lang === 'fr' ? 'Tous' : 'All';
    
    container.innerHTML = `
        <button class="filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-cat="all">
            ${allLabel}
        </button>
        ${categories.map(cat => {
            const label = dictionary.categories[cat] ? dictionary.categories[cat][lang] : cat;
            const isActive = currentFilter === cat ? 'active' : '';
            return `<button class="filter-btn ${isActive}" data-cat="${cat}">${label}</button>`;
        }).join('')}
    `;

    container.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.getAttribute('data-cat');
            if (currentFilter === category) return;
            setActiveFilter(btn, category, lang, list); 
            console.log(`Button clicked: ${category}, currentFilter state: ${currentFilter}`);
        });
    });
}

function setActiveFilter(activeBtn, category, lang, list) {
    // 1. Update the persistent state
    currentFilter = category;
    
    // 2. Visual feedback
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    activeBtn.classList.add('active');

    // 3. Render the grid
    const gridTarget = document.getElementById('grid-results-target');
    const filter = category === 'all' ? null : category;

    console.log(`Filtering by: ${filter}`);
    
    renderGrid(gridTarget, list, filter, lang);
}

export function resetFilterState() {
    currentFilter = 'all';
}

export function getUniqueCategories(collection) {
    const categories = new Set();
    Object.values(collection).forEach(project => {
        project.categories.forEach(cat => categories.add(cat));
    });
    return Array.from(categories);
}