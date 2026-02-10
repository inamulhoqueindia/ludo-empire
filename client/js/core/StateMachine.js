/**
 * Simple State Machine
 */

class StateMachine {
    constructor(initialState) {
        this.currentState = initialState;
        this.states = new Map();
    }

    addState(name, config) {
        this.states.set(name, config);
    }

    changeState(newState, data) {
        if (this.currentState && this.states.has(this.currentState)) {
            const current = this.states.get(this.currentState);
            if (current.onExit) current.onExit();
        }

        this.currentState = newState;
        if (this.states.has(newState)) {
            const state = this.states.get(newState);
            if (state.onEnter) state.onEnter(data);
        }
    }

    update(dt) {
        if (this.currentState && this.states.has(this.currentState)) {
            const state = this.states.get(this.currentState);
            if (state.onUpdate) state.onUpdate(dt);
        }
    }
}

window.StateMachine = StateMachine;
