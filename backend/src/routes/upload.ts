import { Router, Request, Response } from 'express';
import multer from 'multer';
import { uploadService } from '@/services/uploadService';
import { authenticateToken, AuthenticatedRequest } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { env } from '@/config/env';
import { ApiResponse } from '@/types/api';

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_FILE_SIZE,
    files: 5 // Max 5 files per request
  },
  fileFilter: (req, file, cb) => {
    if (env.ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  }
});

// Upload single file
router.post('/single',
  authenticateToken,
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    const fileUrl = await uploadService.uploadFile(req.file, 'reports');

    return res.status(200).json({
      success: true,
      data: {
        url: fileUrl,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      },
      message: 'File uploaded successfully'
    });
  })
);

// Upload multiple files
router.post('/multiple',
  authenticateToken,
  upload.array('files', 5),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files provided'
      });
    }

    const fileUrls = await uploadService.uploadFiles(files, 'reports');

    return res.status(200).json({
      success: true,
      data: {
        urls: fileUrls,
        files: files.map((file, index) => ({
          url: fileUrls[index],
          originalName: file.originalname,
          size: file.size,
          mimetype: file.mimetype
        }))
      },
      message: `${files.length} files uploaded successfully`
    });
  })
);

// Upload report image (specific endpoint for report images)
router.post('/report-image',
  authenticateToken,
  upload.single('file'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    const fileUrl = await uploadService.uploadFile(req.file, 'reports');

    return res.status(200).json({
      success: true,
      data: {
        url: fileUrl,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });
  })
);

// Upload avatar image
router.post('/avatar',
  authenticateToken,
  upload.single('avatar'),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No avatar file provided'
      });
    }

    const fileUrl = await uploadService.uploadFile(req.file, 'avatars');

    return res.status(200).json({
      success: true,
      data: {
        url: fileUrl,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      },
      message: 'Avatar uploaded successfully'
    });
  })
);

export default router;
