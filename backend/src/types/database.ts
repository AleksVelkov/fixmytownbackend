// Database types matching your Supabase schema
export interface DatabaseReport {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string | null;
  latitude: number;
  longitude: number;
  address: string;
  status: string;
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  upvotes: number;
  downvotes: number;
  user_vote: string | null;
  user_id: string;
  created_at: string;
  updated_at: string | null;
}

export interface DatabaseUser {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  avatar: string | null;
  location: string | null;
  provider: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface DatabaseVote {
  id: string;
  report_id: string;
  user_id: string;
  vote_type: 'up' | 'down';
  created_at: string;
}

// Transformed types for API responses
export interface Report {
  id: string;
  title: string;
  description: string;
  category: string;
  image: string | null;
  location: {
    latitude: number;
    longitude: number;
  };
  address: string;
  status: string;
  approvalStatus: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedBy: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  upvotes: number;
  downvotes: number;
  userVote: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  city: string | null;
  googleId: string | null;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface Vote {
  id: string;
  reportId: string;
  userId: string;
  voteType: 'up' | 'down';
  createdAt: Date;
}

// Stats types
export interface ReportStats {
  total: number;
  byStatus: {
    submitted: number;
    approved: number;
    'in-progress': number;
    resolved: number;
    rejected: number;
  };
  byCategory: {
    roads: number;
    lighting: number;
    waste: number;
    water: number;
    vandalism: number;
    other: number;
  };
  thisMonth: number;
}

export interface UserStats {
  submitted: number;
  approved: number;
  inProgress: number;
  resolved: number;
  votesReceived: number;
}