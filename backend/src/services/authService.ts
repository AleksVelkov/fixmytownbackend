import jwt, { SignOptions } from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import bcrypt from 'bcryptjs';
import { env } from '@/config/env';
import { userService } from './userService';
import { User } from '@/types/database';
import { createError } from '@/middleware/errorHandler';
import { LoginRequest, RegisterRequest } from '@/types/api';

export class AuthService {
  private googleClient: OAuth2Client;

  constructor() {
    this.googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  }

  generateToken(user: User): string {
    const payload = {
      userId: user.id,  // Changed from 'id' to 'userId' to match middleware expectation
      email: user.email,
      isAdmin: user.isAdmin
    };
    
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
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
            avatar: googleUser.picture || user.avatar || undefined
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

  async hashPassword(password: string): Promise<string> {
    try {
      const saltRounds = 12;
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      console.error('Error hashing password:', error);
      throw createError('Failed to process password', 500);
    }
  }

  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      console.error('Error comparing password:', error);
      throw createError('Failed to verify password', 500);
    }
  }

  async registerUser(userData: RegisterRequest & { isAdmin?: boolean }): Promise<{ user: User; token: string }> {
    try {
      // Check if user already exists
      const existingUser = await userService.getUserByEmail(userData.email);
      if (existingUser) {
        throw createError('User with this email already exists', 409);
      }

      // Hash password
      const passwordHash = await this.hashPassword(userData.password);

      // Create user
      const user = await userService.createUser({
        email: userData.email,
        name: userData.name,
        passwordHash,
        isAdmin: userData.isAdmin || false
      });

      // Generate token
      const token = this.generateToken(user);

      return { user, token };
    } catch (error) {
      console.error('Error in registerUser:', error);
      throw error instanceof Error ? error : createError('Failed to register user', 500);
    }
  }

  async loginUser(credentials: LoginRequest): Promise<{ user: User; token: string }> {
    try {
      // Get user by email
      const user = await userService.getUserByEmail(credentials.email);
      if (!user) {
        throw createError('Invalid email or password', 401);
      }

      // Check if user has a password (not just Google OAuth)
      const dbUser = await userService.getDatabaseUserByEmail(credentials.email);
      if (!dbUser || !dbUser.password_hash) {
        throw createError('This account uses Google sign-in. Please use Google to log in.', 401);
      }

      // Verify password
      const isValidPassword = await this.comparePassword(credentials.password, dbUser.password_hash);
      if (!isValidPassword) {
        throw createError('Invalid email or password', 401);
      }

      // Generate token
      const token = this.generateToken(user);

      return { user, token };
    } catch (error) {
      console.error('Error in loginUser:', error);
      throw error instanceof Error ? error : createError('Failed to login', 500);
    }
  }
}

export const authService = new AuthService();