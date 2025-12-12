// WorkerPool.ts
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import * as os from 'os';

// Use a number of workers equal to the number of CPU cores
const NUM_WORKERS = os.cpus().length;
const workers: Worker[] = [];
const taskQueue: { data: any, resolve: (result: any) => void, reject: (error: Error) => void }[] = [];
let nextWorker = 0;

if (isMainThread) {
    // --- Main Thread Logic: Create and Manage Pool ---
    
    // Initialize the worker pool
    for (let i = 0; i < NUM_WORKERS; i++) {
        const worker = new Worker('./ExecutionWorker.ts', {
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
            // Simple self-healing: recreate the worker on exit
            // NOTE: A production pool uses a dedicated library like 'poolifier'
        });

        workers.push(worker);
    }
    
    // Function to submit a task to the next available worker
    export function executeStrategyTask(taskData: any): Promise<any> {
        return new Promise((resolve, reject) => {
            taskQueue.push({ data: taskData, resolve, reject });
            
            // Assign task to the next worker in a round-robin fashion
            const worker = workers[nextWorker];
            worker.postMessage({ type: 'task', data: taskData });
            nextWorker = (nextWorker + 1) % NUM_WORKERS;
        });
    }

} else {
    // --- Worker Thread Logic: Execute the Task ---
    // This part is defined in a separate file (ExecutionWorker.ts) for clean separation.
}
