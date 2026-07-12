import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function getGames(req, res) {
    console.log(`📂 [API] Scanning ROM directories...`);
    const romsDir = path.join(__dirname, '..', 'public', 'roms');
    const gamesList = [];
    
    try {
        const consoles = await fs.readdir(romsDir, { withFileTypes: true });
        for (const consoleDir of consoles) {
            if (consoleDir.isDirectory()) {
                const consolePath = path.join(romsDir, consoleDir.name);
                const files = await fs.readdir(consolePath);
                
                const roms = files.filter(f => !f.startsWith('.') && !f.endsWith('.json') && !f.match(/\.(png|jpg|jpeg|webp)$/i));
                
                for (const rom of roms) {
                    const baseName = rom.replace(/\.[^/.]+$/, "");
                    const jsonName = `${baseName}.json`;
                    let meta = {};

                    if (files.includes(jsonName)) {
                        try {
                            const jsonContent = await fs.readFile(path.join(consolePath, jsonName), 'utf-8');
                            meta = JSON.parse(jsonContent);
                        } catch (err) {
                            console.error(`Failed to parse metadata for ${rom}:`, err);
                        }
                    }

                    let imagePath = null;
                    if (meta.image) {
                        imagePath = `/roms/${consoleDir.name}/${meta.image}`;
                    } else {
                        const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
                        for (const ext of imageExtensions) {
                            const potentialImageFile = `${baseName}${ext}`;
                            if (files.includes(potentialImageFile)) {
                                imagePath = `/roms/${consoleDir.name}/${potentialImageFile}`;
                                break;
                            }
                        }
                    }

                    gamesList.push({ console: meta.console || consoleDir.name.toUpperCase(), layout: meta.layout || null, image: imagePath, filename: rom, path: `/roms/${consoleDir.name}/${rom}`, title: meta.title || baseName, description: meta.description || 'No description available.', release: meta.release || 'Unknown' });
                }
            }
        }
        res.json(gamesList);
    } catch (error) {
        if (error.code === 'ENOENT') res.json([]);
        else res.status(500).json({ error: 'Failed to scan ROMs directory' });
    }
}