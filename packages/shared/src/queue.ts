import {
  Queue,
  Worker,
  type Processor,
  QueueEvents,
  type WorkerOptions,
} from 'bullmq';
import { Redis } from 'ioredis';

export interface ScanJob {
  rootPath: string;
  recursive?: boolean;
  maxDepth?: number;
  includeHidden?: boolean;
  fileExtensions?: string[];
  requestId?: string;
}

export interface AICategorizationJob {
  trackId: string;
  filePath: string;
  artist?: string | null;
  title?: string | null;
}

export interface AIRecommendationJob {
  trackId: string;
  genre: string;
  decade: string;
}

const REDIS_URL = process.env.VALKEY_URL || 'redis://localhost:6379';

const connection = new Redis(REDIS_URL);

export const scanQueue = new Queue<ScanJob>('scans', { connection });

export const aiQueue = new Queue<AICategorizationJob>('ai-categorization', { connection });

export const recommendationQueue = new Queue<AIRecommendationJob>('recommendations', { connection });

export const scanQueueEvents = new QueueEvents('scans', { connection });
export const aiQueueEvents = new QueueEvents('ai-categorization', { connection });
export const recommendationQueueEvents = new QueueEvents('recommendations', { connection });

export function createScanWorker(
  workerId: string,
  processor: Processor<ScanJob>,
  workerOptions: Partial<WorkerOptions> = {}
) {
  return new Worker('scans', processor, {
    connection,
    concurrency: 1,
    name: `scanner-${workerId}`,
    ...workerOptions,
  });
}

export function createAIWorker(
  workerId: string,
  processor: Processor<AICategorizationJob>,
  workerOptions: Partial<WorkerOptions> = {}
) {
  return new Worker('ai-categorization', processor, {
    connection,
    concurrency: 1,
    name: `ai-categorizer-${workerId}`,
    ...workerOptions,
  });
}

export function createRecommendationWorker(workerId: string, processor: Processor<AIRecommendationJob>) {
  return new Worker('recommendations', processor, {
    connection,
    concurrency: 1,
    name: `recommendation-engine-${workerId}`,
  });
}
