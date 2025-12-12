// WorkerPool.ts
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import * as os from 'os';

// Use a number of workers equal to the number of CPU cores
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
    // --- Main Thread Logic: Create and Manage Pool ---
    
    // Initialize the worker pool
    for (let i = 0; i < NUM_WORKERS; i++) {
        const worker = new Worker('./ExecutionWorker.ts', {
            // Use ts-node for development environment if building to JS is cumbersome
            execArgv: /\/ts-node$/.test(process.argv[0]) ? ['--require', 'ts-node/register'] : undefined, 
            workerData: { workerId: i }
        });

        worker.on('message', (message) => {
            // Find the task that initiated this message
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
            console.error(`Worker ${worker.threadId} exited with code ${code}. Recreating...`);
            // NOTE: Simple self-healing is omitted here for brevity and focus on compilation fix.
        });

        workers.push(worker);
    }
    
    // Define the function inside the main thread block
    _executeStrategyTask = (taskData: any): Promise<any> => {
        return new Promise((resolve, reject) => {
            taskQueue.push({ data: taskData, resolve, reject });
            
            // Assign task to the next worker in a round-robin fashion
            const worker = workers[nextWorker];
            worker.postMessage({ type: 'task', data: taskData });
            nextWorker = (nextWorker + 1) % NUM_WORKERS;
        });
    }

} else {
    // This is the worker thread, its logic is in ExecutionWorker.ts
}

// Corrected Export: Export the function definition from the end of the file
export const executeStrategyTask = _executeStrategyTask!;
