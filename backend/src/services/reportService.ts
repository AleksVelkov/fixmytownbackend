import { supabase } from '@/config/database';
import { DatabaseReport, Report, ReportStats } from '@/types/database';
import { CreateReportRequest, UpdateReportRequest, ReportFiltersQuery, PaginationQuery } from '@/types/api';
import { createError } from '@/middleware/errorHandler';

export class ReportService {
  // Get user's vote for a specific report
  private async getUserVoteForReport(reportId: string, userId?: string): Promise<'up' | 'down' | null> {
    if (!userId) return null;

    try {
      const { data, error } = await supabase
        .from('votes')
        .select('vote_type')
        .eq('report_id', reportId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user vote:', error);
        return null;
      }

      return data?.vote_type || null;
    } catch (error) {
      console.error('Error in getUserVoteForReport:', error);
      return null;
    }
  }

  // Enrich a report with user's vote
  private async enrichReportWithUserVote(report: Report, userId?: string): Promise<Report> {
    const userVote = await this.getUserVoteForReport(report.id, userId);
    return {
      ...report,
      userVote
    };
  }

  // Enrich multiple reports with user votes
  private async enrichReportsWithUserVotes(reports: Report[], userId?: string): Promise<Report[]> {
    if (!userId) return reports;

    // Get all votes for this user for all these reports at once (more efficient)
    const reportIds = reports.map(r => r.id);
    const { data: votes, error } = await supabase
      .from('votes')
      .select('report_id, vote_type')
      .eq('user_id', userId)
      .in('report_id', reportIds);

    if (error) {
      console.error('Error fetching user votes:', error);
      return reports;
    }

    // Create a map of report_id -> vote_type
    const voteMap = new Map(votes?.map(v => [v.report_id, v.vote_type]) || []);

    // Enrich each report with user's vote
    return reports.map(report => ({
      ...report,
      userVote: voteMap.get(report.id) || null
    }));
  }

  // Transform database report to API format
  private transformReport(dbReport: any): Report {
    const report: Report = {
      id: dbReport.id,
      title: dbReport.title,
      description: dbReport.description,
      category: dbReport.category,
      image: dbReport.image && 
             typeof dbReport.image === 'string' && 
             dbReport.image.trim() !== '' && 
             dbReport.image !== 'null' && 
             dbReport.image !== 'undefined' && 
             (dbReport.image.startsWith('http://') || dbReport.image.startsWith('https://') || dbReport.image.startsWith('data:image/')) 
             ? dbReport.image.trim() : null,
      location: {
        latitude: dbReport.latitude,
        longitude: dbReport.longitude,
      },
      address: dbReport.address,
      status: dbReport.status,
      approvalStatus: dbReport.approval_status,
      approvedBy: dbReport.approved_by,
      approvedAt: dbReport.approved_at ? new Date(dbReport.approved_at) : null,
      rejectedBy: dbReport.rejected_by,
      rejectedAt: dbReport.rejected_at ? new Date(dbReport.rejected_at) : null,
      rejectionReason: dbReport.rejection_reason,
      upvotes: dbReport.upvotes || 0,
      downvotes: dbReport.downvotes || 0,
      userVote: dbReport.user_vote,
      userId: dbReport.user_id,
      createdAt: new Date(dbReport.created_at),
      updatedAt: dbReport.updated_at ? new Date(dbReport.updated_at) : null,
    };

    // Include flattened user information if available
    if (dbReport.users) {
      report.userName = dbReport.users.name;
      report.userAvatar = dbReport.users.avatar;
      report.userCity = dbReport.users.location;
    }

    return report;
  }

  async getAllReports(filters: ReportFiltersQuery, pagination: PaginationQuery, userId?: string): Promise<{ reports: Report[], total: number }> {
    try {
      let query = supabase
        .from('reports')
        .select('*, users!fk_reports_user_id(id, name, avatar, location)', { count: 'exact' });

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      
      if (filters.category) {
        query = query.eq('category', filters.category);
      }
      
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%,address.ilike.%${filters.search}%`);
      }

      // Only show approved reports for non-admin users
      if (!userId) {
        query = query.eq('approval_status', 'approved');
      }

      // Apply pagination
      const offset = (pagination.page - 1) * pagination.limit;
      query = query
        .range(offset, offset + pagination.limit - 1)
        .order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching reports:', error);
        throw createError('Failed to fetch reports', 500);
      }

      const reports = data?.map(report => this.transformReport(report)) || [];
      
      // Enrich reports with user votes
      const enrichedReports = await this.enrichReportsWithUserVotes(reports, userId);
      
      return {
        reports: enrichedReports,
        total: count || 0
      };
    } catch (error) {
      console.error('Error in getAllReports:', error);
      throw error instanceof Error ? error : createError('Failed to fetch reports', 500);
    }
  }

  async getReportById(id: string, userId?: string): Promise<Report> {
    try {
      let query = supabase
        .from('reports')
        .select('*, users!fk_reports_user_id(id, name, avatar, location)')
        .eq('id', id);

      // If user is not authenticated, only show approved reports
      if (!userId) {
        query = query.eq('approval_status', 'approved');
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw createError('Report not found', 404);
        }
        console.error('Error fetching report:', error);
        throw createError('Failed to fetch report', 500);
      }

      const report = this.transformReport(data);
      
      // Enrich report with user's vote
      return await this.enrichReportWithUserVote(report, userId);
    } catch (error) {
      console.error('Error in getReportById:', error);
      throw error instanceof Error ? error : createError('Failed to fetch report', 500);
    }
  }

  async createReport(reportData: CreateReportRequest, userId: string): Promise<Report> {
    try {
      const { data, error } = await supabase
        .from('reports')
        .insert({
          title: reportData.title,
          description: reportData.description,
          category: reportData.category,
          image: reportData.image,
          latitude: reportData.location.latitude,
          longitude: reportData.location.longitude,
          address: reportData.address,
          status: 'submitted',
          approval_status: 'pending',
          upvotes: 0,
          downvotes: 0,
          user_id: userId,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating report:', error);
        
        if (error.message.includes('duplicate key')) {
          throw createError('A report with similar details already exists', 409);
        } else if (error.message.includes('violates foreign key')) {
          throw createError('Invalid user reference', 400);
        } else if (error.message.includes('violates not-null')) {
          throw createError('Required fields are missing', 400);
        } else if (error.message.includes('permission denied')) {
          throw createError('You do not have permission to create reports', 403);
        }
        
        throw createError('Failed to create report', 500);
      }

      return this.transformReport(data);
    } catch (error) {
      console.error('Error in createReport:', error);
      throw error instanceof Error ? error : createError('Failed to create report', 500);
    }
  }

  async updateReport(id: string, updates: UpdateReportRequest, userId: string, isAdmin: boolean = false): Promise<Report> {
    try {
      // First check if report exists and user has permission
      const existingReport = await this.getReportById(id, userId);
      
      if (!isAdmin && existingReport.userId !== userId) {
        throw createError('You can only update your own reports', 403);
      }

      const updateData: any = {};
      
      if (updates.title) updateData.title = updates.title;
      if (updates.description) updateData.description = updates.description;
      if (updates.category) updateData.category = updates.category;
      if (updates.image !== undefined) updateData.image = updates.image;
      if (updates.location) {
        updateData.latitude = updates.location.latitude;
        updateData.longitude = updates.location.longitude;
      }
      if (updates.address) updateData.address = updates.address;
      if (updates.status && isAdmin) updateData.status = updates.status;

      updateData.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('reports')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating report:', error);
        throw createError('Failed to update report', 500);
      }

      return this.transformReport(data);
    } catch (error) {
      console.error('Error in updateReport:', error);
      throw error instanceof Error ? error : createError('Failed to update report', 500);
    }
  }

  async deleteReport(id: string, userId: string, isAdmin: boolean = false): Promise<void> {
    try {
      // First check if report exists and user has permission
      const existingReport = await this.getReportById(id, userId);
      
      if (!isAdmin && existingReport.userId !== userId) {
        throw createError('You can only delete your own reports', 403);
      }

      const { error } = await supabase
        .from('reports')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting report:', error);
        throw createError('Failed to delete report', 500);
      }
    } catch (error) {
      console.error('Error in deleteReport:', error);
      throw error instanceof Error ? error : createError('Failed to delete report', 500);
    }
  }

  async voteOnReport(reportId: string, voteType: 'up' | 'down', userId: string): Promise<Report> {
    try {
      // Check if report exists
      await this.getReportById(reportId, userId);

      // Handle the vote in the votes table
      const { data: existingVote, error: voteCheckError } = await supabase
        .from('votes')
        .select('*')
        .eq('report_id', reportId)
        .eq('user_id', userId)
        .single();

      if (voteCheckError && voteCheckError.code !== 'PGRST116') {
        throw voteCheckError;
      }

      let voteOperation;
      if (existingVote) {
        if (existingVote.vote_type === voteType) {
          // Remove vote (toggle off)
          voteOperation = supabase
            .from('votes')
            .delete()
            .eq('report_id', reportId)
            .eq('user_id', userId);
        } else {
          // Update vote (change from up to down or vice versa)
          voteOperation = supabase
            .from('votes')
            .update({ vote_type: voteType })
            .eq('report_id', reportId)
            .eq('user_id', userId);
        }
      } else {
        // Insert new vote
        voteOperation = supabase
          .from('votes')
          .insert({
            report_id: reportId,
            user_id: userId,
            vote_type: voteType,
          });
      }

      const { error: voteError } = await voteOperation;
      if (voteError) {
        console.error('Error in vote operation:', voteError);
        throw voteError;
      }

      // Get updated vote counts from votes table
      const { data: voteCounts, error: countError } = await supabase
        .from('votes')
        .select('vote_type')
        .eq('report_id', reportId);

      if (countError) {
        console.error('Error fetching vote counts:', countError);
        throw countError;
      }

      const upvotes = voteCounts?.filter(v => v.vote_type === 'up').length || 0;
      const downvotes = voteCounts?.filter(v => v.vote_type === 'down').length || 0;

      // Update the report table with aggregated vote counts
      const { data: updatedReport, error: updateError } = await supabase
        .from('reports')
        .update({
          upvotes,
          downvotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId)
        .select('*, users!fk_reports_user_id(id, name, avatar, location)')
        .single();

      if (updateError) {
        console.error('Error updating report vote counts:', updateError);
        throw updateError;
      }

      return this.transformReport(updatedReport);
    } catch (error) {
      console.error('Error in voteOnReport:', error);
      throw error instanceof Error ? error : createError('Failed to vote on report', 500);
    }
  }

  async getUserReports(userId: string, pagination: PaginationQuery, viewerId?: string): Promise<{ reports: Report[], total: number }> {
    try {
      const offset = (pagination.page - 1) * pagination.limit;
      
      const { data, error, count } = await supabase
        .from('reports')
        .select('*, users!fk_reports_user_id(id, name, avatar, location)', { count: 'exact' })
        .eq('user_id', userId)
        .range(offset, offset + pagination.limit - 1)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user reports:', error);
        throw createError('Failed to fetch user reports', 500);
      }

      const reports = data?.map(report => this.transformReport(report)) || [];
      
      // Enrich reports with viewer's votes
      const enrichedReports = await this.enrichReportsWithUserVotes(reports, viewerId);
      
      return {
        reports: enrichedReports,
        total: count || 0
      };
    } catch (error) {
      console.error('Error in getUserReports:', error);
      throw error instanceof Error ? error : createError('Failed to fetch user reports', 500);
    }
  }

  async getReportStats(): Promise<ReportStats> {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('status, category, created_at, approval_status');

      if (error) {
        console.error('Error fetching report stats:', error);
        throw createError('Failed to fetch report stats', 500);
      }

      const stats: ReportStats = {
        total: data.length,
        byStatus: {
          submitted: data.filter(r => r.status === 'submitted' || (r.approval_status === 'pending')).length,
          approved: data.filter(r => r.approval_status === 'approved' && r.status !== 'in-progress' && r.status !== 'resolved').length,
          'in-progress': data.filter(r => r.status === 'in-progress').length,
          resolved: data.filter(r => r.status === 'resolved').length,
          rejected: data.filter(r => r.approval_status === 'rejected').length,
        },
        byCategory: {
          roads: data.filter(r => r.category === 'roads').length,
          lighting: data.filter(r => r.category === 'lighting').length,
          waste: data.filter(r => r.category === 'waste').length,
          water: data.filter(r => r.category === 'water').length,
          vandalism: data.filter(r => r.category === 'vandalism').length,
          other: data.filter(r => r.category === 'other').length,
        },
        thisMonth: data.filter(r => {
          const reportDate = new Date(r.created_at);
          const now = new Date();
          return reportDate.getMonth() === now.getMonth() && reportDate.getFullYear() === now.getFullYear();
        }).length,
      };

      return stats;
    } catch (error) {
      console.error('Error in getReportStats:', error);
      throw error instanceof Error ? error : createError('Failed to fetch report stats', 500);
    }
  }

  async getPendingReports(pagination: PaginationQuery, userId?: string): Promise<{ reports: Report[], total: number }> {
    try {
      const offset = (pagination.page - 1) * pagination.limit;
      
      const { data, error, count } = await supabase
        .from('reports')
        .select('*, users!fk_reports_user_id(id, name, avatar, location)', { count: 'exact' })
        .or('approval_status.is.null,approval_status.eq.pending')
        .range(offset, offset + pagination.limit - 1)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending reports:', error);
        throw createError('Failed to fetch pending reports', 500);
      }

      const reports = data?.map(report => this.transformReport(report)) || [];
      
      // Enrich reports with user's votes
      const enrichedReports = await this.enrichReportsWithUserVotes(reports, userId);
      
      return {
        reports: enrichedReports,
        total: count || 0
      };
    } catch (error) {
      console.error('Error in getPendingReports:', error);
      throw error instanceof Error ? error : createError('Failed to fetch pending reports', 500);
    }
  }

  async approveReport(reportId: string, adminId: string): Promise<Report> {
    try {
      return await this.updateReport(reportId, {
        status: 'approved'
      } as any, adminId, true);
    } catch (error) {
      console.error('Error in approveReport:', error);
      throw error instanceof Error ? error : createError('Failed to approve report', 500);
    }
  }

  async rejectReport(reportId: string, adminId: string, reason?: string): Promise<Report> {
    try {
      return await this.updateReport(reportId, {
        status: 'rejected'
      } as any, adminId, true);
    } catch (error) {
      console.error('Error in rejectReport:', error);
      throw error instanceof Error ? error : createError('Failed to reject report', 500);
    }
  }
}

export const reportService = new ReportService();