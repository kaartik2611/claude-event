import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgresql://kumbh:kumbh_secure_2027@localhost:5432/kumbh_mela',
  },
  
  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'kumbh_mela_2027_secret_key',
    expiresIn: '7d',
  },
  
  // Claude API
  claude: {
    apiKey: process.env.CLAUDE_API_KEY || '',
    model: 'claude-haiku-4-5-20251001',
  },
  
  // S3/MinIO
  s3: {
    endpoint: process.env.S3_ENDPOINT,
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    bucket: process.env.S3_BUCKET || 'kumbh-mela-photos',
  },
  
  // Photo Storage
  photoStoragePath: process.env.PHOTO_STORAGE_PATH || './uploads',
  
  // Broadcast
  broadcast: {
    defaultDurationMinutes: parseInt(process.env.DEFAULT_BROADCAST_DURATION_MINUTES || '60'),
    maxExtensions: parseInt(process.env.MAX_BROADCAST_EXTENSIONS || '3'),
  },
  
  // ML
  ml: {
    predictionIntervalMinutes: parseInt(process.env.ML_PREDICTION_INTERVAL_MINUTES || '15'),
    modelVersion: process.env.ML_MODEL_VERSION || 'v1.0',
  },
};
