import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { createServer, Server as HTTPServer } from 'http';
import { Server as WebSocketServer } from 'ws';
import { config } from '../config';
import logger from '../utils/logger';

class APIServer {
  private app: express.Application;
  private httpServer: HTTPServer | null = null;
  private wsServer: WebSocketServer | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(helmet({ contentSecurityPolicy: false }));
    this.app.use(cors({ origin: '*' }));
    this.app.use(compression());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private setupRoutes(): void {
    this.app.get('/', (req: Request, res: Response) => {
      res.json({ name: 'Massive Trading Engine API', version: '1.0.0', status: 'operational', timestamp: Date.now() });
    });

    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
    });

    this.app.get('/api/status', (req: Request, res: Response) => {
      res.json({ status: 'operational', uptime: process.uptime(), memory: process.memoryUsage(), timestamp: Date.now() });
    });

    this.app.post('/api/start', (req: Request, res: Response) => {
      res.json({ success: true, message: 'Engine started', timestamp: Date.now() });
    });

    this.app.post('/api/stop', (req: Request, res: Response) => {
      res.json({ success: true, message: 'Engine stopped', timestamp: Date.now() });
    });

    this.app.get('/api/metrics', (req: Request, res: Response) => {
      res.json({ totalTrades: 0, successfulTrades: 0, totalProfit: '0', timestamp: Date.now() });
    });

    this.app.get('/api/strategies', (req: Request, res: Response) => {
      res.json({ total: 0, strategies: [], timestamp: Date.now() });
    });

    this.app.get('/api/prices', (req: Request, res: Response) => {
      res.json({ total: 0, prices: [], timestamp: Date.now() });
    });

    this.app.get('/api/flashloans', (req: Request, res: Response) => {
      res.json({ total: 0, opportunities: [], timestamp: Date.now() });
    });

    this.app.get('/api/wallet/balance', (req: Request, res: Response) => {
      res.json({ address: config.wallet.privateKey ? 'Connected' : 'Not configured', balances: {}, timestamp: Date.now() });
    });

    this.app.use((req: Request, res: Response) => {
      res.status(404).json({ error: 'Not Found', path: req.path, timestamp: Date.now() });
    });

    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Server error:', err);
      res.status(500).json({ error: 'Internal Server Error', message: err.message, timestamp: Date.now() });
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        logger.warn('Server already running');
        return resolve();
      }

      const port = config.server.port;
      this.httpServer = createServer(this.app);

      this.httpServer.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${port} already in use`);
          reject(new Error(`Port ${port} already in use`));
        } else {
          reject(error);
        }
      });

      this.httpServer.listen(port, '0.0.0.0', () => {
        this.isRunning = true;
        logger.info('='.repeat(70));
        logger.info(`  API Server RUNNING on port ${port}`);
        logger.info(`  URL: http://localhost:${port}`);
        logger.info('='.repeat(70));
        this.setupWebSocket();
        resolve();
      });
    });
  }

  private setupWebSocket(): void {
    if (!this.httpServer) return;
    try {
      this.wsServer = new WebSocketServer({ server: this.httpServer });
      this.wsServer.on('connection', (ws) => {
        logger.info('WebSocket client connected');
        ws.send(JSON.stringify({ type: 'connection', message: 'Connected', timestamp: Date.now() }));
        ws.on('close', () => logger.info('WebSocket client disconnected'));
      });
      logger.info('WebSocket server ready');
    } catch (error) {
      logger.error('WebSocket setup failed:', error);
    }
  }

  public stop(): void {
    if (!this.isRunning) return;
    if (this.wsServer) this.wsServer.close();
    if (this.httpServer) this.httpServer.close(() => logger.info('Server stopped'));
    this.isRunning = false;
  }
}

export const apiServer = new APIServer();


