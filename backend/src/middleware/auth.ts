import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { supabase } from '@/config/database';
import { ApiResponse } from '@/types/api';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    isAdmin: boolean;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  try {
    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Access token required'
      });
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    console.log('Token decoded successfully:', { userId: decoded.userId, email: decoded.email });
    
    // Get user from database to ensure they still exist and get latest info
    console.log('Looking for user with ID:', decoded.userId);
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', decoded.userId)
      .single();

    console.log('Database query result:', { user, error });

    if (error || !user) {
      console.log('User not found in database or error occurred');
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
      return;
    }

    // Add user info to request
    req.user = {
      id: user.id,
      email: user.email,
      isAdmin: decoded.isAdmin || false // Use the isAdmin from JWT token
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    console.error('JWT Secret length:', env.JWT_SECRET?.length);
    console.error('Token that failed:', token ? token.substring(0, 20) + '...' : 'no token');
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token'
    });
  }
};

export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response<ApiResponse>,
  next: NextFunction
): void => {
  if (!req.user?.isAdmin) {
    res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
    return;
  }
  next();
};

export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as any;
        
        const { data: user, error } = await supabase
          .from('users')
          .select('id, email')
          .eq('id', decoded.userId)
          .single();

        if (!error && user) {
          req.user = {
            id: user.id,
            email: user.email,
            isAdmin: decoded.isAdmin || false
          };
        }
      } catch (error) {
        // Token is invalid, but we continue without user
        console.log('Optional auth failed, continuing without user');
      }
    }

    next();
  } catch (error) {
    console.error('Optional auth error:', error);
    next();
  }
};