import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { reportService } from '@/services/reportService';
import { validateBody, validateQuery, validateParams } from '@/middleware/validation';
import { authenticateToken, requireAdmin, optionalAuth, AuthenticatedRequest } from '@/middleware/auth';
import { createReportLimiter, voteLimiter } from '@/middleware/rateLimiting';
import { asyncHandler } from '@/middleware/errorHandler';
import { 
  CreateReportSchema, 
  UpdateReportSchema, 
  VoteSchema, 
  PaginationSchema, 
  ReportFiltersSchema,
  AdminActionSchema
} from '@/types/api';
import { ApiResponse, PaginatedResponse } from '@/types/api';

const router = Router();

// Get all reports (public endpoint with optional auth for personalization)
router.get('/',
  optionalAuth,
  validateQuery(PaginationSchema.merge(ReportFiltersSchema)),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { page, limit, ...filters } = (req as any).validatedQuery || req.query;
    const pagination = { page, limit };

    const result = await reportService.getAllReports(filters, pagination, req.user?.id);

    res.status(200).json({
      success: true,
      data: result.reports,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit)
      }
    });
  })
);

// Get report by ID (public endpoint with optional auth)
router.get('/:id',
  optionalAuth,
  validateParams(z.object({ id: z.string().uuid() })),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const report = await reportService.getReportById(id, req.user?.id);

    res.status(200).json({
      success: true,
      data: report
    });
  })
);

// Create new report (requires authentication)
router.post('/',
  authenticateToken,
  createReportLimiter,
  validateBody(CreateReportSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const report = await reportService.createReport(req.body, req.user!.id);

    res.status(201).json({
      success: true,
      data: report,
      message: 'Report created successfully'
    });
  })
);

// Update report (requires authentication and ownership or admin)
router.put('/:id',
  authenticateToken,
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(UpdateReportSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const report = await reportService.updateReport(id, req.body, req.user!.id, req.user!.isAdmin);

    res.status(200).json({
      success: true,
      data: report,
      message: 'Report updated successfully'
    });
  })
);

// Delete report (requires authentication and ownership or admin)
router.delete('/:id',
  authenticateToken,
  validateParams(z.object({ id: z.string().uuid() })),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    await reportService.deleteReport(id, req.user!.id, req.user!.isAdmin);

    res.status(200).json({
      success: true,
      message: 'Report deleted successfully'
    });
  })
);

// Vote on report (requires authentication)
router.post('/:id/vote',
  authenticateToken,
  voteLimiter,
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(VoteSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { type } = req.body;

    const report = await reportService.voteOnReport(id, type, req.user!.id);

    res.status(200).json({
      success: true,
      data: report,
      message: 'Vote recorded successfully'
    });
  })
);

// Get user's reports (requires authentication)
router.get('/user/my-reports',
  authenticateToken,
  validateQuery(PaginationSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const pagination = (req as any).validatedQuery || req.query;

    const result = await reportService.getUserReports(req.user!.id, pagination, req.user!.id);

    res.status(200).json({
      success: true,
      data: result.reports,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit)
      }
    });
  })
);

// Get reports by user ID (public endpoint)
router.get('/user/:userId',
  validateParams(z.object({ userId: z.string().uuid() })),
  validateQuery(PaginationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const pagination = (req as any).validatedQuery || req.query;

    const result = await reportService.getUserReports(userId, pagination);

    res.status(200).json({
      success: true,
      data: result.reports,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit)
      }
    });
  })
);

// Get report statistics (public endpoint)
router.get('/stats/overview',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await reportService.getReportStats();

    res.status(200).json({
      success: true,
      data: stats
    });
  })
);

// Admin routes
// Get pending reports (admin only)
router.get('/admin/pending',
  authenticateToken,
  requireAdmin,
  validateQuery(PaginationSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const pagination = (req as any).validatedQuery || req.query;

    const result = await reportService.getPendingReports(pagination, req.user?.id);

    res.status(200).json({
      success: true,
      data: result.reports,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / pagination.limit)
      }
    });
  })
);

// Approve/reject report (admin only)
router.post('/:id/admin-action',
  authenticateToken,
  requireAdmin,
  validateParams(z.object({ id: z.string().uuid() })),
  validateBody(AdminActionSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { action, reason } = req.body;

    let report;
    if (action === 'approve') {
      report = await reportService.approveReport(id, req.user!.id);
    } else {
      report = await reportService.rejectReport(id, req.user!.id, reason);
    }

    res.status(200).json({
      success: true,
      data: report,
      message: `Report ${action}d successfully`
    });
  })
);

export default router;