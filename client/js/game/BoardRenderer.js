/**
 * Board Renderer
 * Handles all visual aspects of the Ludo board
 */

class BoardRenderer {
    constructor(ctx) {
        this.ctx = ctx;
        this.cellSize = 40;
        this.boardSize = 15;
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1;
        
        // Pre-rendered assets
        this.boardPattern = null;
        this.starImage = null;
        
        // Paths for each color
        this.paths = this.generatePaths();
        this.homeZones = this.generateHomeZones();
    }

    calculateLayout(width, height) {
        const boardPixelSize = Math.min(width, height) * 0.9;
        this.cellSize = boardPixelSize / this.boardSize;
        this.scale = this.cellSize / 40; // Base scale
        
        this.offsetX = (width - boardPixelSize) / 2;
        this.offsetY = (height - boardPixelSize) / 2;
        
        this.generateBoardPattern();
    }

    generatePaths() {
        // Generate the path coordinates for each color
        const paths = {
            red: [],
            green: [],
            yellow: [],
            blue: []
        };

        // Standard Ludo path generation
        const basePath = [
            [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
            [5, 6], [4, 6], [3, 6], [2, 6], [1, 6],
            [0, 6], [0, 7], [0, 8], [1, 8], [2, 8],
            [3, 8], [4, 8], [5, 8], [6, 9], [6, 10],
            [6, 11], [6, 12], [6, 13], [6, 14], [7, 14],
            [8, 14], [8, 13], [8, 12], [8, 11], [8, 10],
            [8, 9], [9, 8], [10, 8], [11, 8], [12, 8],
            [13, 8], [14, 8], [14, 7], [14, 6], [13, 6],
            [12, 6], [11, 6], [10, 6], [9, 6], [8, 5],
            [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
            [7, 0], [7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]
        ];

        // Rotate for each color
        const rotations = {
            red: 0,
            green: 13,
            yellow: 26,
            blue: 39
        };

        Object.keys(paths).forEach(color => {
            const rot = rotations[color];
            const rotated = [...basePath.slice(rot), ...basePath.slice(0, rot)];
            paths[color] = rotated;
        });

        return paths;
    }

    generateHomeZones() {
        return {
            red: { x: 0, y: 0, size: 6 },
            green: { x: 9, y: 0, size: 6 },
            yellow: { x: 9, y: 9, size: 6 },
            blue: { x: 0, y: 9, size: 6 }
        };
    }

    generateBoardPattern() {
        // Create offscreen canvas for static board elements
        const canvas = document.createElement('canvas');
        canvas.width = this.cellSize * this.boardSize;
        canvas.height = this.cellSize * this.boardSize;
        const ctx = canvas.getContext('2d');

        // Draw grid
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 1;
        
        for (let i = 0; i <= this.boardSize; i++) {
            ctx.beginPath();
            ctx.moveTo(i * this.cellSize, 0);
            ctx.lineTo(i * this.cellSize, canvas.height);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(0, i * this.cellSize);
            ctx.lineTo(canvas.width, i * this.cellSize);
            ctx.stroke();
        }

        // Draw home zones
        this.drawHomeZones(ctx);
        
        // Draw paths
        this.drawPaths(ctx);
        
        // Draw center
        this.drawCenter(ctx);

        this.boardPattern = canvas;
    }

    drawHomeZones(ctx) {
        const colors = {
            red: '#ff4757',
            green: '#2ed573',
            yellow: '#ffa502',
            blue: '#1e90ff'
        };

        Object.entries(this.homeZones).forEach(([color, zone]) => {
            ctx.fillStyle = colors[color];
            ctx.globalAlpha = 0.3;
            ctx.fillRect(
                zone.x * this.cellSize,
                zone.y * this.cellSize,
                zone.size * this.cellSize,
                zone.size * this.cellSize
            );
            ctx.globalAlpha = 1;

            // Border
            ctx.strokeStyle = colors[color];
            ctx.lineWidth = 3;
            ctx.strokeRect(
                zone.x * this.cellSize + 5,
                zone.y * this.cellSize + 5,
                zone.size * this.cellSize - 10,
                zone.size * this.cellSize - 10
            );

            // Draw home positions
            ctx.fillStyle = colors[color];
            const positions = this.getHomePositions(color);
            positions.forEach(pos => {
                ctx.beginPath();
                ctx.arc(
                    (pos.x + 0.5) * this.cellSize,
                    (pos.y + 0.5) * this.cellSize,
                    this.cellSize * 0.3,
                    0, Math.PI * 2
                );
                ctx.fill();
            });
        });
    }

    drawPaths(ctx) {
        const colors = {
            red: '#ff4757',
            green: '#2ed573',
            yellow: '#ffa502',
            blue: '#1e90ff'
        };

        Object.entries(this.paths).forEach(([color, path]) => {
            ctx.fillStyle = colors[color];
            ctx.globalAlpha = 0.1;
            
            path.forEach((pos, index) => {
                if (index < 51) { // Don't color the final stretch
                    ctx.fillRect(
                        pos[0] * this.cellSize,
                        pos[1] * this.cellSize,
                        this.cellSize,
                        this.cellSize
                    );
                }
            });
            
            ctx.globalAlpha = 1;
        });

        // Draw safe zones (stars)
        const safeZones = [[6, 1], [2, 6], [1, 8], [6, 12], [8, 13], [12, 8], [13, 6], [8, 2]];
        safeZones.forEach(pos => {
            this.drawStar(ctx, pos[0] * this.cellSize + this.cellSize/2, pos[1] * this.cellSize + this.cellSize/2, 5, this.cellSize * 0.3, this.cellSize * 0.15);
        });
    }

    drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        let step = Math.PI / spikes;

        ctx.beginPath();
        ctx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            ctx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            ctx.lineTo(x, y);
            rot += step;
        }
        ctx.lineTo(cx, cy - outerRadius);
        ctx.closePath();
        ctx.fillStyle = '#fdcb6e';
        ctx.fill();
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    drawCenter(ctx) {
        const centerX = 7.5 * this.cellSize;
        const centerY = 7.5 * this.cellSize;
        const size = 3 * this.cellSize;

        // Draw triangle for each color
        const colors = ['#ff4757', '#2ed573', '#ffa502', '#1e90ff'];
        const rotations = [0, Math.PI/2, Math.PI, -Math.PI/2];

        ctx.save();
        ctx.translate(centerX, centerY);
        
        colors.forEach((color, i) => {
            ctx.save();
            ctx.rotate(rotations[i]);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-size/2, -size/2);
            ctx.lineTo(size/2, -size/2);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.stroke();
            ctx.restore();
        });

        ctx.restore();
    }

    render() {
        if (!this.boardPattern) return;

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        
        // Draw pre-rendered board
        this.ctx.drawImage(this.boardPattern, 0, 0);
        
        // Draw dynamic elements
        this.drawGridOverlay();
        
        this.ctx.restore();
    }

    drawGridOverlay() {
        // Highlight current valid moves
        // This is drawn every frame for interactivity
    }

    gridToScreen(gridX, gridY) {
        return {
            x: this.offsetX + gridX * this.cellSize + this.cellSize / 2,
            y: this.offsetY + gridY * this.cellSize + this.cellSize / 2
        };
    }

    screenToGrid(screenX, screenY) {
        return {
            x: Math.floor((screenX - this.offsetX) / this.cellSize),
            y: Math.floor((screenY - this.offsetY) / this.cellSize)
        };
    }

    getPath(color) {
        return this.paths[color];
    }

    getStartPosition(color) {
        const path = this.paths[color];
        return { x: path[0][0], y: path[0][1] };
    }

    getHomePosition(color, index) {
        const zones = {
            red: [[1, 1], [1, 4], [4, 1], [4, 4]],
            green: [[10, 1], [10, 4], [13, 1], [13, 4]],
            yellow: [[10, 10], [10, 13], [13, 10], [13, 13]],
            blue: [[1, 10], [1, 13], [4, 10], [4, 13]]
        };
        const pos = zones[color][index];
        return { x: pos[0], y: pos[1] };
    }

    getHomePositions(color) {
        const positions = [];
        for (let i = 0; i < 4; i++) {
            positions.push(this.getHomePosition(color, i));
        }
        return positions;
    }

    isSafeZone(x, y) {
        const safeZones = [[6, 1], [2, 6], [1, 8], [6, 12], [8, 13], [12, 8], [13, 6], [8, 2]];
        return safeZones.some(pos => pos[0] === x && pos[1] === y);
    }
}