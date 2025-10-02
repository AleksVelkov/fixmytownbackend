import { supabase } from '@/config/database';
import { env } from '@/config/env';
import { createError } from '@/middleware/errorHandler';
import sharp from 'sharp';
import { randomUUID } from 'crypto';

export class UploadService {
  private readonly allowedTypes = env.ALLOWED_FILE_TYPES;
  private readonly maxFileSize = env.MAX_FILE_SIZE;
  private readonly reportsBucket = env.SUPABASE_STORAGE_BUCKET;
  private readonly imagesBucket = env.SUPABASE_IMAGES_BUCKET;
  private readonly profilesBucket = env.SUPABASE_PROFILES_BUCKET;

  // Validate file type and size
  private validateFile(file: Express.Multer.File): void {
    if (!this.allowedTypes.includes(file.mimetype)) {
      throw createError(`File type ${file.mimetype} not allowed. Allowed types: ${this.allowedTypes.join(', ')}`, 400);
    }

    if (file.size > this.maxFileSize) {
      throw createError(`File size ${file.size} exceeds maximum allowed size of ${this.maxFileSize} bytes`, 400);
    }
  }

  // Process and optimize image
  private async processImage(buffer: Buffer, mimetype: string): Promise<Buffer> {
    try {
      let processedBuffer: Buffer;

      // Convert to WebP for better compression and modern format
      if (mimetype === 'image/jpeg' || mimetype === 'image/png') {
        processedBuffer = await sharp(buffer)
          .resize(1920, 1080, { 
            fit: 'inside', 
            withoutEnlargement: true 
          })
          .webp({ quality: 85 })
          .toBuffer();
      } else if (mimetype === 'image/webp') {
        processedBuffer = await sharp(buffer)
          .resize(1920, 1080, { 
            fit: 'inside', 
            withoutEnlargement: true 
          })
          .webp({ quality: 85 })
          .toBuffer();
      } else {
        processedBuffer = buffer;
      }

      return processedBuffer;
    } catch (error) {
      console.error('Error processing image:', error);
      throw createError('Failed to process image', 500);
    }
  }

  // Upload file to Supabase Storage
  async uploadFile(file: Express.Multer.File, folder: string = 'reports', bucketName?: string): Promise<string> {
    try {
      // Validate file
      this.validateFile(file);

      // Process image
      const processedBuffer = await this.processImage(file.buffer, file.mimetype);

      // Determine bucket to use
      const bucket = bucketName || this.reportsBucket;

      // Generate unique filename
      const fileExtension = 'webp'; // Always use WebP after processing
      const fileName = `${folder}/${randomUUID()}.${fileExtension}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, processedBuffer, {
          contentType: 'image/webp',
          cacheControl: '3600'
        });

      if (error) {
        console.error('Error uploading to Supabase Storage:', error);
        throw createError('Failed to upload file', 500);
      }

      // Get public URL
      const { data: publicData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      return publicData.publicUrl;
    } catch (error) {
      console.error('Error in uploadFile:', error);
      throw error instanceof Error ? error : createError('Failed to upload file', 500);
    }
  }

  // Upload multiple files
  async uploadFiles(files: Express.Multer.File[], folder: string = 'reports', bucketName?: string): Promise<string[]> {
    try {
      const uploadPromises = files.map(file => this.uploadFile(file, folder, bucketName));
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error in uploadFiles:', error);
      throw error instanceof Error ? error : createError('Failed to upload files', 500);
    }
  }

  // Delete file from Supabase Storage
  async deleteFile(fileUrl: string, bucketName?: string): Promise<void> {
    try {
      // Extract file path from URL
      const url = new URL(fileUrl);
      const pathParts = url.pathname.split('/');
      
      // Determine bucket from URL or use default
      let bucket = bucketName || this.reportsBucket;
      
      // Try to extract bucket from URL path (Supabase URLs include bucket name)
      const bucketIndex = pathParts.indexOf('object');
      if (bucketIndex !== -1 && pathParts[bucketIndex + 1] === 'public') {
        bucket = pathParts[bucketIndex + 2];
      }
      
      const fileName = pathParts[pathParts.length - 1];
      const folder = pathParts[pathParts.length - 2];
      const filePath = `${folder}/${fileName}`;

      const { error } = await supabase.storage
        .from(bucket)
        .remove([filePath]);

      if (error) {
        console.error('Error deleting file from Supabase Storage:', error);
        // Don't throw error for file deletion failures, just log them
      }
    } catch (error) {
      console.error('Error in deleteFile:', error);
      // Don't throw error for file deletion failures, just log them
    }
  }

  // Get file info
  async getFileInfo(fileName: string, bucketName?: string): Promise<any> {
    try {
      const bucket = bucketName || this.reportsBucket;
      
      const { data, error } = await supabase.storage
        .from(bucket)
        .list('', {
          search: fileName
        });

      if (error) {
        console.error('Error getting file info:', error);
        throw createError('Failed to get file info', 500);
      }

      return data;
    } catch (error) {
      console.error('Error in getFileInfo:', error);
      throw error instanceof Error ? error : createError('Failed to get file info', 500);
    }
  }
}

export const uploadService = new UploadService();
