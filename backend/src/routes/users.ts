import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { userService } from '@/services/userService';
import { validateBody, validateQuery, validateParams } from '@/middleware/validation';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';
import { UpdateUserSchema, PaginationSchema } from '@/types/api';
import { ApiResponse, PaginatedResponse } from '@/types/api';

const router = Router();

// Get user profile by ID (public endpoint)
router.get('/:id',
  validateParams(z.object({ id: z.string().uuid() })),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const user = await userService.getUserById(id);

    // Remove sensitive information for public endpoint
    const publicUser = {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      city: user.city,
      createdAt: user.createdAt
    };

    res.status(200).json({
      success: true,
      data: publicUser
    });
  })
);

// Update current user profile (requires authentication)
router.put('/me',
  authenticateToken,
  validateBody(UpdateUserSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const user = await userService.updateUser(req.user!.id, req.body);

    res.status(200).json({
      success: true,
      data: user,
      message: 'Profile updated successfully'
    });
  })
);

// Get user statistics
router.get('/:id/stats',
  validateParams(z.object({ id: z.string().uuid() })),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const stats = await userService.getUserStats(id);

    res.status(200).json({
      success: true,
      data: stats
    });
  })
);

// Admin routes
// Get all users (admin only)
router.get('/',
  authenticateToken,
  requireAdmin,
  validateQuery(PaginationSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const pagination = (req as any).validatedQuery || req.query;

    const result = await userService.getAllUsers(pagination);

    res.status(200).json({
      success: true,
      data: result.users,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit)
      }
    });
  })
);

// Update any user (admin only)
router.put('/:id',
  authenticateToken,
  requireAdmin,
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(UpdateUserSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const user = await userService.updateUser(id, req.body);

    res.status(200).json({
      success: true,
      data: user,
      message: 'User updated successfully'
    });
  })
);

// Delete user (admin only)
router.delete('/:id',
  authenticateToken,
  requireAdmin,
  validateParams(z.object({ id: z.string().uuid() })),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    await userService.deleteUser(id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  })
);

// Make user admin (admin only)
router.post('/:id/make-admin',
  authenticateToken,
  requireAdmin,
  validateParams(z.object({ id: z.string().uuid() })),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const user = await userService.makeAdmin(id);

    res.status(200).json({
      success: true,
      data: user,
      message: 'User promoted to admin successfully'
    });
  })
);

// Remove admin privileges (admin only)
router.post('/:id/remove-admin',
  authenticateToken,
  requireAdmin,
  validateParams(z.object({ id: z.string().uuid() })),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const user = await userService.removeAdmin(id);

    res.status(200).json({
      success: true,
      data: user,
      message: 'Admin privileges removed successfully'
    });
  })
);

export default router;