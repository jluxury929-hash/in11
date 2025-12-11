// APIServer.ts
import * as express from 'express'; // FIX: TS2307 resolved by adding 'express' to package.json
import { Request, Response } from 'express'; // FIX: Resolves implicit any errors
import { logger } from './logger';

const app = express();
const PORT = process.env.API_PORT || 8080;

export class APIServer {
    public static start() {
        // FIX: Explicitly typed req and res to remove TS7006 implicit any error
        app.get('/status', (req: Request, res: Response) => { 
            res.json({ status: 'running', service: 'massive-trading-engine' });
        });

        app.listen(PORT, () => {
            logger.info(`API Server running on port ${PORT}`);
        });
    }
}
