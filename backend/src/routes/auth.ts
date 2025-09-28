import { Router } from 'express';
import { authService } from '@/services/authService';
import { userService } from '@/services/userService';
import { validateBody } from '@/middleware/validation';
import { authenticateToken, AuthenticatedRequest } from '@/middleware/auth';
import { authLimiter } from '@/middleware/rateLimiting';
import { asyncHandler } from '@/middleware/errorHandler';
import { GoogleAuthSchema } from '@/types/api';
import { ApiResponse } from '@/types/api';

const router = Router();

// Apply auth rate limiting to all auth routes
router.use(authLimiter);

// Google OAuth login
router.post('/google', 
  validateBody(GoogleAuthSchema),
  asyncHandler(async (req, res: Response<ApiResponse>) => {
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
  asyncHandler(async (req, res: Response<ApiResponse>) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token required'
      });
    }

    const newToken = await authService.refreshToken(token);

    res.status(200).json({
      success: true,
      data: { token: newToken },
      message: 'Token refreshed successfully'
    });
  })
);

// Get current user profile
router.get('/me',
  authenticateToken,
  asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
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
  asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
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
  asyncHandler(async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
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

export default router;