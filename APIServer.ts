// APIServer.ts
// FIX: Change import to correctly handle the default callable export for Express
import express, { Request, Response } from 'express'; 
import { logger } from './logger';

const app = express(); // This is now correctly calling the default export function
const PORT = process.env.API_PORT || 8080;

export class APIServer {
    public static start() {
        app.get('/status', (req: Request, res: Response) => { 
            res.json({ status: 'running', service: 'massive-trading-engine' });
        });

        app.listen(PORT, () => {
            logger.info(`API Server running on port ${PORT}`);
        });
    }
}
