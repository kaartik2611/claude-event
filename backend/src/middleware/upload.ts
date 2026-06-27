import multer from 'multer';
import path from 'path';
import { config } from '../config';
import fs from 'fs';

// Ensure upload directory exists
if (!fs.existsSync(config.photoStoragePath)) {
  fs.mkdirSync(config.photoStoragePath, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.photoStoragePath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, WebP) are allowed'));
  }
};

// Upload middleware
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  },
  fileFilter: fileFilter
});

// Multiple photos for case creation
export const uploadCasePhotos = upload.fields([
  { name: 'reporter_photo', maxCount: 1 },
  { name: 'person_photo', maxCount: 1 },
  { name: 'found_person_photo', maxCount: 1 }
]);
