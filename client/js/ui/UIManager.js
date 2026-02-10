/**
 * UI Manager
 * Handles DOM interactions and event bridging
 */

class UIManager {
    constructor() {
        this.eventHandlers = new Map();
        this.currentScreen = 'loading-screen';
        this.sounds = {
            click: new Audio('assets/sounds/click.mp3'),
            dice: new Audio('assets/sounds/dice-roll.mp3'),
            move: new Audio('assets/sounds/move.mp3'),
            capture: new Audio('assets/sounds/capture.mp3'),
            win: new Audio('assets/sounds/win.mp3')
        };
        this.isMuted = false;
        this.init();
    }

    init() {
        // Sound toggle
        const soundBtn = document.getElementById('btn-sound');
        if (soundBtn) {
            soundBtn.addEventListener('click', () => {
                this.isMuted = !this.isMuted;
                soundBtn.textContent = this.isMuted ? '🔇' : '🔊';
            });
        }
        document.querySelectorAll('.btn-back').forEach(btn => {
            btn.addEventListener('click', () => {
                this.trigger('navigate', 'menu');
            });
        });
    }

    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    trigger(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(h => h(data));
        }
    }

    playSound(name) {
        if (this.isMuted || !this.sounds[name]) return;
        this.sounds[name].currentTime = 0;
        this.sounds[name].play().catch(() => { });
    }

    showError(msg) {
        this.playSound('click');
        const toast = document.createElement('div');
        toast.className = 'premium-toast error';
        toast.innerHTML = `<span class="toast-icon">⚠️</span> ${msg}`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    showNotification(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `premium-toast ${type}`;
        toast.innerHTML = `<span class="toast-icon">✨</span> ${msg}`;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 500);
        }, 2000);
    }

    showModal(id) {
        const modal = document.getElementById(`${id}-modal`);
        if (modal) modal.style.display = 'flex';
    }

    hideModal(id) {
        const modal = document.getElementById(`${id}-modal`);
        if (modal) modal.style.display = 'none';
    }

    updateLobbyPlayers(players) {
        const list = document.getElementById('players-list');
        if (!list) return;
        list.innerHTML = players.map(p => `
            <div class="player-slot ${p.isHost ? 'host' : ''}">
                <div class="player-avatar color-${p.color}"></div>
                <div class="player-name">${p.username} ${p.id === window.gameApp?.player?.id ? '(You)' : ''}</div>
                <div class="player-status">${p.isHost ? 'HOST' : (p.isReady ? 'READY' : 'WAITING')}</div>
            </div>
        `).join('');

        // Update start button
        const startBtn = document.getElementById('btn-start-game');
        if (startBtn) {
            const isHost = players.find(p => p.isHost)?.id === window.gameApp?.player?.id;
            startBtn.disabled = !isHost || players.length < 2;
            startBtn.textContent = isHost ? (players.length < 2 ? 'Need more players' : 'START GAME') : 'Waiting for host...';
        }
    }

    setRoomCode(code) {
        const el = document.getElementById('room-code');
        if (el) el.textContent = code;
    }

    addChatMessage(data) {
        const chat = document.getElementById('chat-messages');
        if (!chat) return;
        const msg = document.createElement('div');
        msg.className = 'chat-msg';
        msg.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
        chat.appendChild(msg);
        chat.scrollTop = chat.scrollHeight;
    }

    setupGamePlayers(players) {
        const bar = document.getElementById('game-players');
        if (!bar) return;
        bar.innerHTML = players.map(p => `
            <div class="game-player-slot" id="p-slot-${p.id}">
                <div class="player-avatar color-${p.color}"></div>
                <div class="player-info">
                    <span class="name">${p.username}</span>
                    <span class="status"></span>
                </div>
            </div>
        `).join('');
    }

    showTurnIndicator(isMyTurn) {
        const indicator = document.getElementById('turn-indicator');
        if (indicator) {
            indicator.style.display = 'flex';
            indicator.className = `turn-indicator ${isMyTurn ? 'my-turn' : 'opp-turn'}`;
            indicator.querySelector('.turn-text').textContent = isMyTurn ? 'Your Turn!' : "Wait for opponent...";
            if (isMyTurn) this.playSound('win'); // Low volume notification sound ideally
        }
    }

    showCaptureEffect(attacker, victim) {
        this.playSound('capture');
        this.showNotification(`${attacker} captured ${victim}!`, 'capture');

        // Add screen shake
        document.getElementById('game-screen').classList.add('shake');
        setTimeout(() => document.getElementById('game-screen').classList.remove('shake'), 500);
    }

    showWinnerNotification(playerId) {
        this.showNotification(`Player won: ${playerId}`);
    }

    showGameOver(winners) {
        this.showModal('game-over');
        const podium = document.getElementById('podium');
        if (podium) {
            podium.innerHTML = winners.map((w, i) => `
                <div class="podium-place place-${i + 1}">
                    <div class="place-num">${i + 1}</div>
                    <div class="player-name">${w.username}</div>
                </div>
            `).join('');
        }
    }
}

window.UIManager = UIManager;
