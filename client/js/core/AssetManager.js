/**
 * Asset Manager
 * Preloads images and sounds
 */

class AssetManager {
    constructor() {
        this.assets = new Map();
        this.queue = [];
        this.loadedCount = 0;
        this.totalToLoad = 0;
    }

    enqueue(name, path, type = 'image') {
        this.queue.push({ name, path, type });
        this.totalToLoad++;
    }

    async loadAll(onProgress) {
        const promises = this.queue.map(asset => {
            return new Promise((resolve, reject) => {
                if (asset.type === 'image') {
                    const img = new Image();
                    img.onload = () => {
                        this.assets.set(asset.name, img);
                        this.loadedCount++;
                        if (onProgress) onProgress(this.loadedCount / this.totalToLoad);
                        resolve();
                    };
                    img.onerror = () => reject(`Failed to load ${asset.path}`);
                    img.src = asset.path;
                } else {
                    // Placeholder for sounds
                    this.loadedCount++;
                    resolve();
                }
            });
        });

        await Promise.all(promises);
        this.queue = [];
    }

    get(name) {
        return this.assets.get(name);
    }
}

window.AssetManager = AssetManager;
