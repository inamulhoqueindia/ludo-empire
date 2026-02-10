/**
 * Camera Controller
 * Manages canvas zooming and panning
 */

class CameraController {
    constructor(canvas) {
        this.canvas = canvas;
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
    }

    apply(ctx) {
        ctx.translate(this.x, this.y);
        ctx.scale(this.zoom, this.zoom);
    }

    update(dt) {
        // Any smooth camera movements
    }

    reset() {
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
    }
}

window.CameraController = CameraController;
