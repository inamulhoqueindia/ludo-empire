/**
 * Easing Functions
 * Linear, Quadratic, etc.
 */

const Easing = {
    linear: t => t,
    easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    easeOutQuad: t => t * (2 - t),
    easeInQuad: t => t * t,
    easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1
};

window.Easing = Easing;
