export class BoardLogic {
    constructor() {
        this.BOARD_SIZE = 15;
        this.PATH_LENGTH = 56;
        this.HOME_COUNT = 4;
        
        // Define paths for each color (0-55 indices)
        this.paths = {
            red: this.generatePath('red'),
            green: this.generatePath('green'),
            yellow: this.generatePath('yellow'),
            blue: this.generatePath('blue')
        };

        // Safe zones (star positions)
        this.safeZones = [
            {x: 6, y: 1}, {x: 2, y: 6}, {x: 1, y: 8}, {x: 6, y: 12},
            {x: 8, y: 13}, {x: 12, y: 8}, {x: 13, y: 6}, {x: 8, y: 2},
            {x: 6, y: 6}, {x: 8, y: 8}
        ];
    }

    generatePath(color) {
        const paths = {
            red: [],
            green: [],
            yellow: [],
            blue: []
        };

        // Common path coordinates (clockwise from red start)
        const commonPath = [
            {x: 1, y: 6}, {x: 2, y: 6}, {x: 3, y: 6}, {x: 4, y: 6}, {x: 5, y: 6},
            {x: 6, y: 5}, {x: 6, y: 4}, {x: 6, y: 3}, {x: 6, y: 2}, {x: 6, y: 1},
            {x: 7, y: 1}, {x: 8, y: 1}, {x: 8, y: 2}, {x: 8, y: 3}, {x: 8, y: 4},
            {x: 8, y: 5}, {x: 9, y: 6}, {x: 10, y: 6}, {x: 11, y: 6}, {x: 12, y: 6},
            {x: 13, y: 6}, {x: 13, y: 7}, {x: 13, y: 8}, {x: 12, y: 8}, {x: 11, y: 8},
            {x: 10, y: 8}, {x: 9, y: 8}, {x: 8, y: 9}, {x: 8, y: 10}, {x: 8, y: 11},
            {x: 8, y: 12}, {x: 8, y: 13}, {x: 7, y: 13}, {x: 6, y: 13}, {x: 6, y: 12},
            {x: 6, y: 11}, {x: 6, y: 10}, {x: 6, y: 9}, {x: 5, y: 8}, {x: 4, y: 8},
            {x: 3, y: 8}, {x: 2, y: 8}, {x: 1, y: 8}, {x: 1, y: 7}, {x: 1, y: 6}
        ];

        // Home stretches (last 6 steps to center)
        const homeStretches = {
            red: [{x: 2, y: 7}, {x: 3, y: 7}, {x: 4, y: 7}, {x: 5, y: 7}, {x: 6, y: 7}, {x: 7, y: 7}],
            green: [{x: 7, y: 2}, {x: 7, y: 3}, {x: 7, y: 4}, {x: 7, y: 5}, {x: 7, y: 6}, {x: 7, y: 7}],
            yellow: [{x: 12, y: 7}, {x: 11, y: 7}, {x: 10, y: 7}, {x: 9, y: 7}, {x: 8, y: 7}, {x: 7, y: 7}],
            blue: [{x: 7, y: 12}, {x: 7, y: 11}, {x: 7, y: 10}, {x: 7, y: 9}, {x: 7, y: 8}, {x: 7, y: 7}]
        };

        // Rotate common path for each color
        const rotations = {
            red: 0,
            green: 13,
            yellow: 26,
            blue: 39
        };

        Object.keys(paths).forEach(color => {
            const rotation = rotations[color];
            const rotatedPath = [...commonPath.slice(rotation), ...commonPath.slice(0, rotation)];
            paths[color] = [...rotatedPath, ...homeStretches[color]];
        });

        return paths[color];
    }

    getHomePositions(color) {
        const positions = {
            red: [{x: 2, y: 2}, {x: 2, y: 3}, {x: 3, y: 2}, {x: 3, y: 3}],
            green: [{x: 2, y: 11}, {x: 2, y: 12}, {x: 3, y: 11}, {x: 3, y: 12}],
            yellow: [{x: 11, y: 11}, {x: 11, y: 12}, {x: 12, y: 11}, {x: 12, y: 12}],
            blue: [{x: 11, y: 2}, {x: 11, y: 3}, {x: 12, y: 2}, {x: 12, y: 3}]
        };
        return positions[color];
    }

    getStartPosition(color) {
        const starts = {
            red: {x: 1, y: 6},
            green: {x: 6, y: 12},
            yellow: {x: 12, y: 8},
            blue: {x: 8, y: 1}
        };
        return starts[color];
    }

    getFinalPosition(color) {
        return {x: 7, y: 7}; // Center for all
    }

    getPath(color) {
        return this.paths[color];
    }

    isSafeZone(position) {
        return this.safeZones.some(zone => 
            zone.x === position.x && zone.y === position.y
        );
    }

    getDistance(pos1, pos2) {
        return Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2));
    }
}