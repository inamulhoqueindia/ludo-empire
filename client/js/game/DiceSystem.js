/**
 * Dice System
 * Handles dice roll physics/animations (simple version)
 */

class DiceSystem {
    constructor() {
        this.currentValue = 1;
        this.isRolling = false;
    }

    roll() {
        this.isRolling = true;
        return new Promise(resolve => {
            setTimeout(() => {
                this.currentValue = Math.floor(Math.random() * 6) + 1;
                this.isRolling = false;
                resolve(this.currentValue);
            }, 1000);
        });
    }
}

window.DiceSystem = DiceSystem;
