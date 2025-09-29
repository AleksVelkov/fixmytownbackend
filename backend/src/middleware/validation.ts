import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ApiResponse } from '@/types/api';

export const validateBody = <T extends z.ZodType>(schema: T) => {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction): void => {
    try {
      const result = schema.parse(req.body);
      req.body = result;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Invalid request body'
        });
      }
    }
  };
};

export const validateQuery = <T extends z.ZodType>(schema: T) => {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction): void => {
    try {
      const result = schema.parse(req.query);
      req.query = result as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          message: error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Invalid query parameters'
        });
      }
    }
  };
};

export const validateParams = <T extends z.ZodType>(schema: T) => {
  return (req: Request, res: Response<ApiResponse>, next: NextFunction): void => {
    try {
      const result = schema.parse(req.params);
      req.params = result as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid URL parameters',
          message: error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Invalid URL parameters'
        });
      }
    }
  };
};