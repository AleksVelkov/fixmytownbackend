import { supabase } from '@/config/database';
import { DatabaseUser, User, UserStats } from '@/types/database';
import { CreateUserRequest, CreatePasswordUserRequest, UpdateUserRequest, PaginationQuery } from '@/types/api';
import { createError } from '@/middleware/errorHandler';

export class UserService {
  // Transform database user to API format
  private transformUser(dbUser: DatabaseUser): User {
    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      avatar: dbUser.avatar,
      city: (dbUser as any).location || dbUser.city, // Handle both location and city columns
      country: dbUser.country,
      googleId: dbUser.google_id,
      isAdmin: dbUser.is_admin || false, // Default to false if column doesn't exist
      createdAt: new Date(dbUser.created_at),
      updatedAt: dbUser.updated_at ? new Date(dbUser.updated_at) : null,
    };
  }

  async getUserById(id: string): Promise<User> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw createError('User not found', 404);
        }
        console.error('Error fetching user:', error);
        throw createError('Failed to fetch user', 500);
      }

      return this.transformUser(data);
    } catch (error) {
      console.error('Error in getUserById:', error);
      throw error instanceof Error ? error : createError('Failed to fetch user', 500);
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // User not found
        }
        console.error('Error fetching user by email:', error);
        throw createError('Failed to fetch user', 500);
      }

      return this.transformUser(data);
    } catch (error) {
      console.error('Error in getUserByEmail:', error);
      throw error instanceof Error ? error : createError('Failed to fetch user', 500);
    }
  }

  async getUserByGoogleId(googleId: string): Promise<User | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('google_id', googleId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // User not found
        }
        console.error('Error fetching user by Google ID:', error);
        throw createError('Failed to fetch user', 500);
      }

      return this.transformUser(data);
    } catch (error) {
      console.error('Error in getUserByGoogleId:', error);
      throw error instanceof Error ? error : createError('Failed to fetch user', 500);
    }
  }

  async getDatabaseUserByEmail(email: string): Promise<DatabaseUser | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // User not found
        }
        console.error('Error fetching database user by email:', error);
        throw createError('Failed to fetch user', 500);
      }

      return data;
    } catch (error) {
      console.error('Error in getDatabaseUserByEmail:', error);
      throw error instanceof Error ? error : createError('Failed to fetch user', 500);
    }
  }

  async createUser(userData: CreateUserRequest): Promise<User>;
  async createUser(userData: CreatePasswordUserRequest): Promise<User>;
  async createUser(userData: CreateUserRequest | CreatePasswordUserRequest): Promise<User> {
    try {
      const insertData: any = {
        email: userData.email,
        name: userData.name,
      };

      // Check if it's a Google OAuth user or password user
      if ('googleId' in userData) {
        // Google OAuth user
        const googleUser = userData as CreateUserRequest;
        insertData.avatar = googleUser.avatar;
        insertData.google_id = googleUser.googleId;
        insertData.is_admin = false;
      } else {
        // Password user
        const passwordUser = userData as CreatePasswordUserRequest;
        insertData.password_hash = passwordUser.passwordHash;
        insertData.is_admin = passwordUser.isAdmin || false;
      }

      const { data, error } = await supabase
        .from('users')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Error creating user:', error);
        
        if (error.message.includes('duplicate key')) {
          throw createError('User with this email already exists', 409);
        }
        
        throw createError('Failed to create user', 500);
      }

      return this.transformUser(data);
    } catch (error) {
      console.error('Error in createUser:', error);
      throw error instanceof Error ? error : createError('Failed to create user', 500);
    }
  }

  async updateUser(id: string, updates: UpdateUserRequest): Promise<User> {
    try {
      // First check if user exists
      await this.getUserById(id);

      console.log('Updating user with ID:', id);
      console.log('Update data received:', updates);

      const updateData: any = {};
      
      if (updates.name) updateData.name = updates.name;
      if (updates.avatar !== undefined) updateData.avatar = updates.avatar;
      // Note: Based on your database schema, city and country might not exist
      // Let's check what columns are available in your users table
      if (updates.city !== undefined) updateData.location = updates.city; // Using 'location' column from your schema
      if (updates.country !== undefined) updateData.country = updates.country;

      console.log('Prepared update data:', updateData);

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      console.log('Database update result:', { data, error });

      if (error) {
        console.error('Error updating user:', error);
        throw createError('Failed to update user', 500);
      }

      return this.transformUser(data);
    } catch (error) {
      console.error('Error in updateUser:', error);
      throw error instanceof Error ? error : createError('Failed to update user', 500);
    }
  }

  async getAllUsers(pagination: PaginationQuery): Promise<{ users: User[], total: number }> {
    try {
      const offset = (pagination.page - 1) * pagination.limit;
      
      const { data, error, count } = await supabase
        .from('users')
        .select('*', { count: 'exact' })
        .range(offset, offset + pagination.limit - 1)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching users:', error);
        throw createError('Failed to fetch users', 500);
      }

      const users = data?.map(user => this.transformUser(user)) || [];
      
      return {
        users,
        total: count || 0
      };
    } catch (error) {
      console.error('Error in getAllUsers:', error);
      throw error instanceof Error ? error : createError('Failed to fetch users', 500);
    }
  }

  async getUserStats(userId: string): Promise<UserStats> {
    try {
      // Get user's submitted reports
      const { data: userReports, error: reportsError } = await supabase
        .from('reports')
        .select('id, status, approval_status, created_at')
        .eq('user_id', userId);

      if (reportsError) {
        console.error('Error fetching user reports for stats:', reportsError);
        throw createError('Failed to fetch user stats', 500);
      }

      // Get user's votes received (votes on their reports)
      const { data: votesReceived, error: votesError } = await supabase
        .from('votes')
        .select('vote_type')
        .in('report_id', userReports?.map(r => r.id) || []);

      if (votesError) {
        console.error('Error fetching votes for user stats:', votesError);
        throw createError('Failed to fetch user stats', 500);
      }

      const submittedCount = userReports?.length || 0;
      const approvedCount = userReports?.filter(r => r.approval_status === 'approved').length || 0;
      const inProgressCount = userReports?.filter(r => r.status === 'in-progress').length || 0;
      const resolvedCount = userReports?.filter(r => r.status === 'resolved').length || 0;
      const votesReceivedCount = votesReceived?.length || 0;

      return {
        submitted: submittedCount,
        approved: approvedCount,
        inProgress: inProgressCount,
        resolved: resolvedCount,
        votesReceived: votesReceivedCount,
      };
    } catch (error) {
      console.error('Error in getUserStats:', error);
      throw error instanceof Error ? error : createError('Failed to fetch user stats', 500);
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      // First check if user exists
      await this.getUserById(id);

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error deleting user:', error);
        throw createError('Failed to delete user', 500);
      }
    } catch (error) {
      console.error('Error in deleteUser:', error);
      throw error instanceof Error ? error : createError('Failed to delete user', 500);
    }
  }

  async makeAdmin(id: string): Promise<User> {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ 
          is_admin: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error making user admin:', error);
        throw createError('Failed to make user admin', 500);
      }

      return this.transformUser(data);
    } catch (error) {
      console.error('Error in makeAdmin:', error);
      throw error instanceof Error ? error : createError('Failed to make user admin', 500);
    }
  }

  async removeAdmin(id: string): Promise<User> {
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ 
          is_admin: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error removing admin privileges:', error);
        throw createError('Failed to remove admin privileges', 500);
      }

      return this.transformUser(data);
    } catch (error) {
      console.error('Error in removeAdmin:', error);
      throw error instanceof Error ? error : createError('Failed to remove admin privileges', 500);
    }
  }
}

export const userService = new UserService();