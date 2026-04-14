import { createAIWorker, createScanWorker } from '@smoothradio/shared';

import { processAIJob, type AICategorizationJob } from './ai-categorizer.js';
import { processScanJob } from './scan-processor.js';
import { randomUUID } from 'node:crypto';
import type { Job } from 'bullmq';
import type { ScanJob } from '@smoothradio/shared';

const workerId = process.env.WORKER_ID || randomUUID();
const scanConcurrency = Math.max(
  1,
  Number.parseInt(process.env.SCAN_WORKER_CONCURRENCY || '1', 10)
);
const aiConcurrency = Math.max(
  1,
  Number.parseInt(process.env.AI_WORKER_CONCURRENCY || '1', 10)
);

function normalizeConcurrency(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

export async function startWorkers(): Promise<void> {
  const scanWorker = createScanWorker(
    `${workerId}-scan`,
    async (job: Job<ScanJob>) => {
      const summary = await processScanJob(job.data);
      return summary;
    },
    { concurrency: normalizeConcurrency(scanConcurrency) }
  );

  const aiWorker = createAIWorker(
    `${workerId}-ai`,
    async (job: Job<AICategorizationJob>) => {
      await processAIJob(job.data);
    },
    { concurrency: normalizeConcurrency(aiConcurrency) }
  );

  const onDone = async () => {
    await scanWorker.close();
    await aiWorker.close();
  };

  process.on('SIGTERM', onDone);
  process.on('SIGINT', onDone);

  console.info(
    `Worker started (scan concurrency: ${scanConcurrency}, ai concurrency: ${aiConcurrency})`
  );
}

export { processScanJob, processAIJob };

if (process.env.WORKER_BOOT !== 'false') {
  void startWorkers();
}
