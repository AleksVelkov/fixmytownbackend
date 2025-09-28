import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { env } from '@/config/env';
import { userService } from './userService';
import { User } from '@/types/database';
import { createError } from '@/middleware/errorHandler';

export class AuthService {
  private googleClient: OAuth2Client;

  constructor() {
    this.googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  }

  generateToken(user: User): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        isAdmin: user.isAdmin
      },
      env.JWT_SECRET,
      {
        expiresIn: env.JWT_EXPIRES_IN,
        issuer: 'reports-api',
        audience: 'reports-app'
      }
    );
  }

  async verifyGoogleToken(idToken: string): Promise<{
    email: string;
    name: string;
    picture?: string;
    googleId: string;
  }> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      
      if (!payload) {
        throw createError('Invalid Google token', 401);
      }

      if (!payload.email || !payload.name || !payload.sub) {
        throw createError('Incomplete Google profile data', 401);
      }

      return {
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        googleId: payload.sub
      };
    } catch (error) {
      console.error('Error verifying Google token:', error);
      throw createError('Invalid Google token', 401);
    }
  }

  async authenticateWithGoogle(idToken: string): Promise<{
    user: User;
    token: string;
    isNewUser: boolean;
  }> {
    try {
      // Verify Google token and get user info
      const googleUser = await this.verifyGoogleToken(idToken);

      // Check if user exists by Google ID first
      let user = await userService.getUserByGoogleId(googleUser.googleId);
      let isNewUser = false;

      if (!user) {
        // Check if user exists by email
        user = await userService.getUserByEmail(googleUser.email);
        
        if (user) {
          // User exists but doesn't have Google ID linked, update it
          user = await userService.updateUser(user.id, {
            avatar: googleUser.picture || user.avatar
          });
        } else {
          // Create new user
          user = await userService.createUser({
            email: googleUser.email,
            name: googleUser.name,
            avatar: googleUser.picture,
            googleId: googleUser.googleId
          });
          isNewUser = true;
        }
      } else {
        // Update user's avatar if it's different
        if (googleUser.picture && user.avatar !== googleUser.picture) {
          user = await userService.updateUser(user.id, {
            avatar: googleUser.picture
          });
        }
      }

      // Generate JWT token
      const token = this.generateToken(user);

      return {
        user,
        token,
        isNewUser
      };
    } catch (error) {
      console.error('Error in authenticateWithGoogle:', error);
      throw error instanceof Error ? error : createError('Authentication failed', 500);
    }
  }

  async refreshToken(oldToken: string): Promise<string> {
    try {
      // Verify the old token (even if expired)
      const decoded = jwt.verify(oldToken, env.JWT_SECRET, { ignoreExpiration: true }) as any;
      
      // Get fresh user data
      const user = await userService.getUserById(decoded.userId);
      
      // Generate new token
      return this.generateToken(user);
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw createError('Invalid refresh token', 401);
    }
  }

  verifyToken(token: string): { userId: string; email: string; isAdmin: boolean } {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      return {
        userId: decoded.userId,
        email: decoded.email,
        isAdmin: decoded.isAdmin
      };
    } catch (error) {
      console.error('Error verifying token:', error);
      throw createError('Invalid or expired token', 401);
    }
  }
}

export const authService = new AuthService();