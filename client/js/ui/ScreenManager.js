/**
 * Screen Manager
 * Simple screen visibility toggling
 */

class ScreenManager {
    constructor() {
        this.screens = document.querySelectorAll('.screen');
    }

    showScreen(id) {
        this.screens.forEach(s => s.classList.remove('active'));
        const target = document.getElementById(id);
        if (target) target.classList.add('active');
    }
}

window.ScreenManager = ScreenManager;
