import { Queue, Worker } from 'bullmq';
import { config } from '../config';
import caseService from '../services/case.service';
import matchService from '../services/match.service';
import mlService from '../services/ml.service';
import { io } from '../socket';

const connection = {
  host: config.redis.url.split('://')[1].split(':')[0],
  port: parseInt(config.redis.url.split(':')[2] || '6379')
};

// Queue definitions

export const intakeQueue = new Queue('intake-queue', { connection });
export const matchQueue = new Queue('match-queue', { connection });
export const broadcastQueue = new Queue('broadcast-queue', { connection });
export const mlPredictionQueue = new Queue('ml-prediction-queue', { connection });

// Intake Queue Worker
new Worker('intake-queue', async (job) => {
  console.log(`📥 Processing case intake: ${job.data.case_id}`);
  
  const { case_id } = job.data;
  
  // Trigger match finding
  await matchQueue.add('find-matches', { case_id });
  
  // Trigger ML prediction
  await mlPredictionQueue.add('predict-zones', { case_id, run_type: 'immediate' });
  
  // Get case and emit to relevant zones
  const caseData = await caseService.getCaseById(case_id);
  if (caseData && io) {
    io.to(`zone:${caseData.report_zone_id}`).emit('case:new', caseData);
    
    if (caseData.urgency === 'P1') {
      io.to('police').emit('alert:p1', {
        case: caseData,
        message: `P1 Alert: ${caseData.case_type === 'found' ? 'Unknown person found' : 'High priority case'}`
      });
    }
  }
  
  return { processed: true };
}, { connection });

// Match Queue Worker
new Worker('match-queue', async (job) => {
  console.log(`🔍 Finding matches for: ${job.data.case_id}`);
  
  const { case_id } = job.data;
  
  const matches = await matchService.findMatches(case_id);
  
  // Emit matches to relevant parties
  if (matches.length > 0 && io) {
    for (const match of matches) {
      io.to(`case:${match.case1_id}`).emit('match:found', match);
      io.to(`case:${match.case2_id}`).emit('match:found', match);
    }
  }
  
  return { matches: matches.length };
}, { connection });

// ML Prediction Queue Worker
new Worker('ml-prediction-queue', async (job) => {
  console.log(`🤖 Running ML prediction: ${job.data.case_id || 'batch'}`);
  
  const { case_id, run_type, time_elapsed_minutes } = job.data;
  
  if (case_id) {
    // Single case prediction
    const predictions = await mlService.predictZones(case_id, time_elapsed_minutes);
    
    // Emit predictions to police portal
    if (io && predictions.length > 0) {
      const caseData = await caseService.getCaseById(case_id);
      if (caseData) {
        io.to(`zone:${caseData.report_zone_id}`).emit('ml:prediction', {
          case_id,
          predictions
        });
      }
    }
    
    return { predictions: predictions.length };
  } else {
    // Batch prediction for all active cases
    const count = await mlService.runBatchPredictions();
    return { processed: count };
  }
}, { connection });

// Broadcast Queue Worker
new Worker('broadcast-queue', async (job) => {
  console.log(`📡 Processing broadcast: ${job.data.case_id}`);
  
  const { case_id, action } = job.data;
  
  if (action === 'expire') {
    const caseData = await caseService.getCaseById(case_id);
    if (caseData && caseData.broadcast_active) {
      await caseService.updateCase(case_id, { broadcast_active: false });
      
      if (io) {
        io.to(`case:${case_id}`).emit('broadcast:expired', { case_id });
      }
    }
  }
  
  return { processed: true };
}, { connection });

// Periodic jobs

// ML predictions every 15 minutes
mlPredictionQueue.add(
  'periodic-predictions',
  { run_type: 'periodic_update' },
  {
    repeat: {
      every: config.ml.predictionIntervalMinutes * 60 * 1000
    }
  }
);

// Expire broadcasts every minute
setInterval(async () => {
  const expiredCount = await caseService.expireBroadcasts();
  if (expiredCount > 0) {
    console.log(`⏰ Expired ${expiredCount} broadcasts`);
  }
}, 60 * 1000);

console.log('✅ Queue workers initialized');
