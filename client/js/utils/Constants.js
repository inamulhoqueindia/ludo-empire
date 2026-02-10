/**
 * LUDO EMPIRE - Constants
 * Centralized configuration and game constants
 */

const CONSTANTS = {
    // Board Configuration
    BOARD: {
        SIZE: 15,
        CELL_SIZE: 40,
        COLORS: {
            RED: '#ff4757',
            GREEN: '#2ed573',
            YELLOW: '#ffa502',
            BLUE: '#1e90ff',
            WHITE: '#ffffff',
            BLACK: '#2d3436',
            SAFE_ZONE: '#fdcb6e'
        },
        PATH_LENGTH: 56,
        HOME_COUNT: 4
    },

    // Game States
    STATES: {
        LOADING: 'loading',
        MENU: 'menu',
        LOBBY: 'lobby',
        PLAYING: 'playing',
        PAUSED: 'paused',
        GAME_OVER: 'game_over'
    },

    // Network Events
    EVENTS: {
        // Client -> Server
        AUTHENTICATE: 'authenticate',
        CREATE_ROOM: 'create_room',
        JOIN_ROOM: 'join_room',
        LEAVE_ROOM: 'leave_room',
        START_GAME: 'start_game',
        PLAYER_READY: 'player_ready',
        DICE_ROLL: 'dice_roll',
        MOVE_TOKEN: 'move_token',
        CHAT_MESSAGE: 'chat_message',
        
        // Server -> Client
        AUTHENTICATED: 'authenticated',
        ROOM_CREATED: 'room_created',
        ROOM_JOINED: 'room_joined',
        PLAYER_JOINED: 'player_joined',
        PLAYER_LEFT: 'player_left',
        GAME_STARTED: 'game_started',
        TURN_STARTED: 'turn_started',
        DICE_ROLLED: 'dice_rolled',
        TOKEN_MOVED: 'token_moved',
        TOKEN_CAPTURED: 'token_captured',
        PLAYER_WON: 'player_won',
        GAME_ENDED: 'game_ended',
        CHAT_RECEIVED: 'chat_message',
        ERROR: 'error'
    },

    // Animation Timings
    TIMING: {
        DICE_ROLL: 1000,
        TOKEN_MOVE_STEP: 200,
        TOKEN_MOVE_TOTAL: 600,
        TURN_TRANSITION: 500,
        CELEBRATION: 2000
    },

    // Audio
    AUDIO: {
        VOLUME: {
            MASTER: 1.0,
            SFX: 0.7,
            MUSIC: 0.5
        },
        SOUNDS: {
            DICE_ROLL: 'dice_roll',
            TOKEN_MOVE: 'token_move',
            TOKEN_CAPTURE: 'token_capture',
            TOKEN_HOME: 'token_home',
            WIN: 'win',
            TURN_START: 'turn_start',
            CLICK: 'click'
        }
    },

    // Mobile
    MOBILE: {
        TAP_DELAY: 300,
        SWIPE_THRESHOLD: 50,
        DOUBLE_TAP_DELAY: 300
    },

    // Physics
    PHYSICS: {
        BOUNCE: 0.4,
        FRICTION: 0.8,
        ACCELERATION: 0.5
    }
};

// Freeze to prevent accidental modification
Object.freeze(CONSTANTS);
Object.freeze(CONSTANTS.BOARD);
Object.freeze(CONSTANTS.STATES);
Object.freeze(CONSTANTS.EVENTS);
Object.freeze(CONSTANTS.TIMING);