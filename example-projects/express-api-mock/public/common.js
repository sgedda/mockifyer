/**
 * Common JavaScript functions for Mockifyer Dashboard
 */

// Toggle mobile menu
function toggleMobileMenu() {
    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
        navLinks.classList.toggle('mobile-open');
    }
}

// Initialize mobile menu event listeners
function initMobileMenu() {
    // Close mobile menu when clicking outside
    document.addEventListener('click', function (event) {
        const nav = document.querySelector('.top-nav');
        const navLinks = document.getElementById('navLinks');

        if (nav && navLinks && !nav.contains(event.target) && navLinks.classList.contains('mobile-open')) {
            navLinks.classList.remove('mobile-open');
        }
    });

    // Close mobile menu when clicking a link
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', function () {
            const navLinks = document.getElementById('navLinks');
            if (navLinks) {
                navLinks.classList.remove('mobile-open');
            }
        });
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileMenu);
} else {
    initMobileMenu();
}

