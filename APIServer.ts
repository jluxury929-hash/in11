// src/APIServer.ts

import express from 'express';
import { logger } from './logger.js'; // FIX: .js extension

const app = express();
const port = 3000;

export function startAPIServer() {
    app.get('/health', (req, res) => {
        // Simple health check endpoint
        res.status(200).json({ status: 'OK', engine: 'Running' });
    });

    app.listen(port, () => {
        logger.info(`[API] Health server running on http://localhost:${port}`);
    });
}

// NOTE: You would call startAPIServer() from your index.ts main function.
