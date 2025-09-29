import { supabase } from '@/config/database';
import { env } from '@/config/env';
import { createError } from '@/middleware/errorHandler';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

export class UploadService {
  private readonly allowedTypes = env.ALLOWED_FILE_TYPES;
  private readonly maxFileSize = env.MAX_FILE_SIZE;
  private readonly storageBucket = env.SUPABASE_STORAGE_BUCKET;

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
  async uploadFile(file: Express.Multer.File, folder: string = 'reports'): Promise<string> {
    try {
      // Validate file
      this.validateFile(file);

      // Process image
      const processedBuffer = await this.processImage(file.buffer, file.mimetype);

      // Generate unique filename
      const fileExtension = 'webp'; // Always use WebP after processing
      const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.storageBucket)
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
        .from(this.storageBucket)
        .getPublicUrl(fileName);

      return publicData.publicUrl;
    } catch (error) {
      console.error('Error in uploadFile:', error);
      throw error instanceof Error ? error : createError('Failed to upload file', 500);
    }
  }

  // Upload multiple files
  async uploadFiles(files: Express.Multer.File[], folder: string = 'reports'): Promise<string[]> {
    try {
      const uploadPromises = files.map(file => this.uploadFile(file, folder));
      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error in uploadFiles:', error);
      throw error instanceof Error ? error : createError('Failed to upload files', 500);
    }
  }

  // Delete file from Supabase Storage
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract file path from URL
      const url = new URL(fileUrl);
      const pathParts = url.pathname.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const folder = pathParts[pathParts.length - 2];
      const filePath = `${folder}/${fileName}`;

      const { error } = await supabase.storage
        .from(this.storageBucket)
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
  async getFileInfo(fileName: string): Promise<any> {
    try {
      const { data, error } = await supabase.storage
        .from(this.storageBucket)
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
