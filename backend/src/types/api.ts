import { z } from 'zod';

// Base response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Report types
export const ReportStatus = z.enum(['submitted', 'approved', 'in-progress', 'resolved', 'rejected']);
export const ApprovalStatus = z.enum(['pending', 'approved', 'rejected']);
export const ReportCategory = z.enum(['roads', 'lighting', 'waste', 'water', 'vandalism', 'other']);

export const LocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const CreateReportSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  category: ReportCategory,
  location: LocationSchema,
  address: z.string().min(1).max(500),
  image: z.string().url().optional(),
});

export const UpdateReportSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  category: ReportCategory.optional(),
  location: LocationSchema.optional(),
  address: z.string().min(1).max(500).optional(),
  image: z.string().url().optional(),
  status: ReportStatus.optional(),
});

export const VoteSchema = z.object({
  type: z.enum(['up', 'down']),
});

// User types
export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  avatar: z.string().url().optional(),
  googleId: z.string().optional(),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatar: z.string().url().optional(),
  city: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
});

// Admin types
export const AdminActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
});

// Query parameters
export const PaginationSchema = z.object({
  page: z.string().default('1').transform(Number),
  limit: z.string().default('20').transform(Number),
});

export const ReportFiltersSchema = z.object({
  status: ReportStatus.optional(),
  category: ReportCategory.optional(),
  userId: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
});

// Auth types
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const GoogleAuthSchema = z.object({
  idToken: z.string(),
});

export type CreateReportRequest = z.infer<typeof CreateReportSchema>;
export type UpdateReportRequest = z.infer<typeof UpdateReportSchema>;
export type VoteRequest = z.infer<typeof VoteSchema>;
export type CreateUserRequest = z.infer<typeof CreateUserSchema>;
export type UpdateUserRequest = z.infer<typeof UpdateUserSchema>;
export type AdminActionRequest = z.infer<typeof AdminActionSchema>;
export type PaginationQuery = z.infer<typeof PaginationSchema>;
export type ReportFiltersQuery = z.infer<typeof ReportFiltersSchema>;
export type LoginRequest = z.infer<typeof LoginSchema>;
export type GoogleAuthRequest = z.infer<typeof GoogleAuthSchema>;