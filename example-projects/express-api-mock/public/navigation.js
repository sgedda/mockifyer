/**
 * Navigation Component for Mockifyer Dashboard
 * Renders the top navigation bar with mobile menu support
 */

function renderNavigation(activePage) {
    const pages = [
        { href: 'getting-started.html', label: 'Getting Started' },
        { href: 'playground.html', label: 'Playground' },
        { href: 'date-config.html', label: 'Configurations' }
    ];

    const navLinks = pages.map(page => {
        const activeClass = page.href === activePage ? 'class="active"' : '';
        return `<a href="${page.href}" ${activeClass}>${page.label}</a>`;
    }).join('');

    return `
        <div class="top-nav">
            <a href="index.html" class="nav-brand">🎭 Mockifyer</a>
            <button class="menu-toggle" onclick="toggleMobileMenu()" aria-label="Toggle menu">☰</button>
            <nav class="nav-links" id="navLinks">
                ${navLinks}
            </nav>
        </div>
    `;
}

