//./js/renderer.js

import { dictionary } from '../data/dictionary.js'; // You'll need the data too!
import { getUniqueCategories } from './utils.js';
import { buildFilterMenu, currentFilter } from './filter.js';

/**
 * Creates the individual content blocks based on its type
 */
function createMediaBlock(item, lang) {
    switch (item.type) {
        case 'video':  return createVideoBlock(item, lang);
        case 'image':  return createImageBlock(item, lang);
        case 'text':   return createTextBlock(item, lang);
        default:
            console.warn(`Renderer: type "${item.type}" does not exist.`);
            return ''; // Return empty string to avoid "undefined" in HTML
    }
}

function createTextBlock(item, lang) {
    return `
        <div class="project-block text-block">
            <p>${item.text[lang]}</p>
        </div>
    `;
}

function createVideoBlock(item, lang){
    const caption = item.caption[lang] ? `<p class="caption">${item.caption[lang]}</p>` : '';
    return `
        <div class="project-block video-block">
            <iframe src="${item.url}" frameborder="0" allow="autoplay; fullscreen" allowfullscreen></iframe>
            ${caption}
        </div>
    `;
}

function createImageBlock(item, lang){
    const caption = item.caption[lang] ? `<p class="caption">${item.caption[lang]}</p>` : '';
    return `
        <div class="project-block image-block">
            <img src="${item.url}" alt="" loading="lazy">
            ${caption}
        </div>
    `;
}

/**
 * Creates the HTML for a project card (the "Molecule")
 */
export function createProjectCard(data, slug, lang, basePath) {
    // Ensure we are using the correct property for the video source
    const videoSrc = data.preview; 

    return `
        <div class="project-card" data-slug="${slug}">
            <a href="/${basePath}/${slug}">
                <div class="media-container ${basePath}">
                    <img src="${data.thumbnail}" alt="${data.title[lang]}" loading="lazy">
                    ${videoSrc ? `
                        <video 
                            src="${videoSrc}" 
                            loop 
                            muted 
                            playsinline 
                            autoplay 
                            preload="auto">
                        </video>` : ''}
                </div>
                <div class="project-info">
                    <span class="year">${data.year}</span>
                    <h3>${data.title[lang]}</h3>
                    <div class="categories">
                        ${data.categories.map(cat => `
                            <span>${dictionary.categories[cat] ? dictionary.categories[cat][lang] : cat}</span>
                        `).join('')}
                    </div>
                </div>
            </a>
        </div>
    `;
}

/**
 * Renders a grid of projects (the "Organism")
 */
export function renderGrid(container, list, filter, lang) {
    const target = typeof container === 'string' 
        ? document.getElementById(container) 
        : container;

    if (!target) return;

    const basePath = window.location.pathname.includes('digital-art') ? 'digital-art' : 'work';

    // 1. Ensure the target element ITSELF has the grid class
    target.className = 'projects-grid'; 
    target.innerHTML = ''; 

    // 2. Filter logic [cite: 147]
    const entries = Object.entries(list);
    const filteredEntries = filter 
        ? entries.filter(([slug, data]) => data.categories.includes(filter))
        : entries;

    // 3. Inject cards directly into the target [cite: 135]
    if (filteredEntries.length === 0) {
        target.innerHTML = `<p class="no-results">No projects found.</p>`;
    } else {
        target.innerHTML = filteredEntries
            .map(([slug, data]) => createProjectCard(data, slug, lang, basePath))
            .join('');
    }
}

export function renderFilterableGrid(container, list, lang) {
    const target = typeof container === 'string' ? document.getElementById(container) : container;
    if (!target) return;

    // Create the structure [cite: 32]
    target.innerHTML = `
        <section class="filterable-page">
            <header class="filter-container" id="filter-menu-target"></header>
            <div id="grid-results-target"></div>
        </section>
    `;

    const categories = getUniqueCategories(list);
    buildFilterMenu(document.getElementById('filter-menu-target'), categories, lang, list);

    console.log("Current filter state on render:", currentFilter);

    const activeFilter = currentFilter === 'all' ? null : currentFilter;
    // Initial render targets the div we just created

    console.log(`Initial render with filter: ${activeFilter}`);

    renderGrid(document.getElementById('grid-results-target'), list, activeFilter, lang);
}

export function renderHome(container, lang) {
    if (!container) return;

    // We use the exact same structure as index.html 
    // so the CSS transitions stay smooth.
    container.innerHTML = `
        <section class="home-hero">
            <div class="hero-content">
                <h1>Judd Buchannan</h1>
                <p class="tagline">${dictionary.ui.tagline[lang]}</p>
                <p class="intro-phrase">${dictionary.ui.intro[lang]}</p>
                <a href="/work" class="home-cta">
                    ${dictionary.ui.work[lang]} →
                </a>
            </div>
        </section>
    `;
}

// js/renderer.js
export function renderAbout(container, lang) {
    
    container.innerHTML = `
        <section class="about-page">
            <div class="about-grid">
                <article class="bio">
                    <img src=https://assets.objkt.media/file/assets-004/h/tz1bEybUvLkmSbHcCAqwQPZtf7sqj1JQwSHS/thumb400?cb=e02119e3" alt="Judd Buchannan, 3D Artist, Filmmaker, Creative Technologist">
                    <h2>${dictionary.ui.about[lang]}</h2>
                    <p class="bio">
                        ${dictionary.ui.bio[lang]}
                    </p>
                </article>

                <div class="about-contact">
                    <h3>${dictionary.ui.contact[lang]}</h3>
                    
                    <form action="https://formsubmit.co/miguelmddesign@gmail.com" method="POST" class="contact-form">
                        <input type="hidden" name="_next" value="${window.location.href}">
                        <input type="hidden" name="_subject" value="New Portfolio Message!">
                        
                        <div class="form-group">
                            <input type="text" name="name" placeholder="${dictionary.ui.placeholder_name[lang]}" required>
                        </div>
                        <div class="form-group">
                            <input type="email" name="email" placeholder="${dictionary.ui.placeholder_email[lang]}" required>
                        </div>
                        <div class="form-group">
                            <textarea name="message" placeholder="${dictionary.ui.placeholder_message[lang]}" rows="5" required></textarea>
                        </div>
                        
                        <button type="submit" class="btn-primary">
                            ${dictionary.ui.send[lang]}
                            <span class="arrow">→</span>
                        </button>
                    </form>
                </div>
            </div>
        </section>
    `;
}

/**
 * Builds the entire Project Page HTML
 */
export function renderProjectPage(container, project, lang) {
    if (!project) return;

    container.innerHTML = `
        <article class="project-detail">
            <header class="project-header">
                <h1>${project.title[lang]}</h1>
                <div class="project-meta">
                    <span>${project.year}</span>
                    <span>${project.credits.agency}</span>
                </div>
            </header>

            <section class="project-content">
                ${project.content.map(item => createMediaBlock(item, lang)).join('')}
            </section>

            <footer class="project-footer">
                <a href="/work" class="back-link">← ${dictionary.ui["back"][lang]}</a>
            </footer>
        </article>
    `;
}

export function renderNav(lang) {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    // 1. If the nav is totally empty (first load), build the structure
    if (nav.innerHTML.trim() === "") {
        nav.innerHTML = `
            <svg class="glitch-svg-defs">
                <defs>
                    <filter id="glitch-filter" x="-20%" y="-20%" width="140%" height="140%">
                        <feTurbulence type="fractalNoise" baseFrequency="0" numOctaves="1" result="noise" id="turbulence"/>
                        <feDisplacementMap in="SourceGraphic" in2="noise" scale="0" id="displacement" />
                    </filter>
                </defs>
            </svg>
            <div class="nav-container">
                <a href="/" class="logo">beastereotype</a>
                <div class="nav-links">
                    <a href="/work" data-key="work"></a>
                    <a href="/digital-art" data-key="digital-art"></a>
                    <a href="/about" data-key="about"></a>
                </div>
                <div class="lang-toggle">
                    <button onclick="changeLang('en')" data-lang="en">EN</button>
                    <button onclick="changeLang('pt')" data-lang="pt">PT</button>
                    <button onclick="changeLang('fr')" data-lang="fr">FR</button>
                </div>
                <button class="hamburger" id="hamburger-btn" aria-label="Menu" aria-expanded="false">
                    <span></span>
                    <span></span>
                    <span></span>
                </button>
            </div>
            <div class="mobile-menu" id="mobile-menu">
                <div class="mobile-nav-links">
                    <a href="/work" data-key="work"></a>
                    <a href="/digital-art" data-key="digital-art"></a>
                    <a href="/about" data-key="about"></a>
                </div>
                <div class="mobile-lang-toggle">
                    <button onclick="changeLang('en')" data-lang="en">EN</button>
                    <button onclick="changeLang('pt')" data-lang="pt">PT</button>
                    <button onclick="changeLang('fr')" data-lang="fr">FR</button>
                </div>
            </div>
        `;

        // Hamburger listeners — só roda uma vez junto com a construção do HTML
        const btn = document.getElementById('hamburger-btn');
        const menu = document.getElementById('mobile-menu');

        btn.addEventListener('click', () => {
            const isOpen = menu.classList.toggle('is-open');
            btn.classList.toggle('is-open', isOpen);
            btn.setAttribute('aria-expanded', isOpen);
        });

        // close the hamburguer menu when click links
        menu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                menu.classList.remove('is-open');
                btn.classList.remove('is-open');
                btn.setAttribute('aria-expanded', false);
            });
        });

        // close the hamburguer menu when click on lang
        menu.querySelectorAll('button').forEach(link => {
            link.addEventListener('click', () => {
                menu.classList.remove('is-open');
                btn.classList.remove('is-open');
                btn.setAttribute('aria-expanded', false);
            });
        });
    }

    // 2. Update TEXT and active state — roda sempre (troca de lang/página)
    const allNavLinks = nav.querySelectorAll('.nav-links a, .mobile-nav-links a');
    allNavLinks.forEach(a => {
        const key = a.getAttribute('data-key');
        const href = a.getAttribute('href');
        const path = window.location.pathname;

        const newText = dictionary.ui[key][lang];
        if (a.textContent !== newText) a.textContent = newText;

        if (path === href) {
            a.classList.add('active');
        } else {
            a.classList.remove('active');
        }
    });

    // 3. Update active lang buttons — roda sempre
    nav.querySelectorAll('.lang-toggle button, .mobile-lang-toggle button').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-lang') === lang);
    });
}