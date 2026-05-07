// js/utils.js
/**
 * Scans a collection and returns a deduplicated array of categories.
 */
export function getUniqueCategories(collection) {
    const categories = new Set();
    Object.values(collection).forEach(project => {
        project.categories.forEach(cat => categories.add(cat));
    });
    return Array.from(categories);
}