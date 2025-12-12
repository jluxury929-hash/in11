// src/WorkerPool.ts

import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import * as os from 'os';

const NUM_WORKERS = os.cpus().length;
const workers: Worker[] = [];
const taskQueue: { 
    data: any, 
    resolve: (result: any) => void, 
    reject: (error: Error) => void 
}[] = [];
let nextWorker = 0;

let _executeStrategyTask: (taskData: any) => Promise<any>;

if (isMainThread) {
    for (let i = 0; i < NUM_WORKERS; i++) {
        
        // --- CRITICAL FIX: The path must be relative to the running directory (/app).
        // Since the compiled file is in /app/dist/ExecutionWorker.js, this path works.
        const worker = new Worker('./dist/ExecutionWorker.js', { 
            
            // This is for running with 'npm run dev' using ts-node:
            execArgv: /\/ts-node$/.test(process.argv[0]) ? ['--require', 'ts-node/register'] : undefined, 
            
            workerData: { workerId: i }
        });

        worker.on('message', (message) => {
            const task = taskQueue.shift();
            if (task) {
                task.resolve(message.result);
            }
        });

        worker.on('error', (error) => {
            const task = taskQueue.shift();
            if (task) {
                task.reject(error);
            }
            console.error(`Worker ${worker.threadId} error:`, error);
        });

        worker.on('exit', (code) => {
            console.error(`Worker ${worker.threadId} exited with code ${code}.`);
        });

        workers.push(worker);
    }
    
    _executeStrategyTask = (taskData: any): Promise<any> => {
        return new Promise((resolve, reject) => {
            taskQueue.push({ data: taskData, resolve, reject });
            
            const worker = workers[nextWorker];
            worker.postMessage({ type: 'task', data: taskData });
            nextWorker = (nextWorker + 1) % NUM_WORKERS;
        });
    }

} else {
    // ExecutionWorker.ts handles the worker logic
}

export const executeStrategyTask = _executeStrategyTask!;
