import { Router, Request, Response } from 'express';
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';
import { validateBody } from '@/middleware/validation';
import { authenticateToken, AuthenticatedRequest } from '@/middleware/auth';
import { authLimiter } from '@/middleware/rateLimiting';
import { asyncHandler } from '@/middleware/errorHandler';
import { GoogleAuthSchema, LoginSchema, RegisterSchema } from '@/types/api';
import { ApiResponse } from '@/types/api';

const router = Router();

// Apply auth rate limiting to all auth routes
router.use(authLimiter);

// Email/Password Registration
router.post('/register',
  validateBody(RegisterSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.registerUser(req.body);

    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        token: result.token
      },
      message: 'Account created successfully'
    });
  })
);

// Email/Password Login
router.post('/login',
  validateBody(LoginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.loginUser(req.body);

    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        token: result.token
      },
      message: 'Login successful'
    });
  })
);

// Google OAuth login
router.post('/google', 
  validateBody(GoogleAuthSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { idToken } = req.body;

    const result = await authService.authenticateWithGoogle(idToken);

    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        token: result.token,
        isNewUser: result.isNewUser
      },
      message: result.isNewUser ? 'Account created successfully' : 'Login successful'
    });
  })
);

// Refresh token
router.post('/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token required'
      });
    }

    const newToken = await authService.refreshToken(token);

    return res.status(200).json({
      success: true,
      data: { token: newToken },
      message: 'Token refreshed successfully'
    });
  })
);

// Get current user profile
router.get('/me',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = await userService.getUserById(req.user!.id);

    res.status(200).json({
      success: true,
      data: user
    });
  })
);

// Logout (client-side token removal, but we can blacklist tokens in future)
router.post('/logout',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // In a more sophisticated setup, you might want to blacklist the token
    // For now, we just return success and let the client remove the token
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  })
);

// Verify token endpoint (useful for client-side token validation)
router.post('/verify',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({
      success: true,
      data: {
        valid: true,
        user: {
          id: req.user!.id,
          email: req.user!.email,
          isAdmin: req.user!.isAdmin
        }
      }
    });
  })
);

// Create admin user (temporary endpoint for initial setup)
router.post('/create-admin',
  validateBody(RegisterSchema),
  asyncHandler(async (req: Request, res: Response) => {
    // Create admin user with elevated privileges
    const result = await authService.registerUser({
      ...req.body,
      isAdmin: true
    });

    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        token: result.token
      },
      message: 'Admin account created successfully'
    });
  })
);

export default router;