// APIServer.ts
import express, { Request, Response } from 'express'; 
import { logger } from './logger';

const app = express();
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
