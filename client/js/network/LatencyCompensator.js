/**
 * Latency Compensator
 * Predicts movement to hide lag
 */

class LatencyCompensator {
    constructor() {
        this.serverTimeOffset = 0;
    }

    compensate(data) {
        return data; // Simple passthrough
    }
}

window.LatencyCompensator = LatencyCompensator;
