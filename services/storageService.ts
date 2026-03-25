
import { User, DailyWorkUpdate, ProjectTask, TaskFolder } from '../types';
import { supabase } from './supabaseClient';

export const storageService = {
  init: async () => {
    // No-op for Supabase, or verify connection
  },

  // Auth & User Management
  getUsers: async (): Promise<User[]> => {
    const { data, error } = await supabase.from('app_users').select('*');
    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }
    return data || [];
  },

  saveUser: async (user: User): Promise<void> => {
    const { error } = await supabase.from('app_users').upsert(user);
    if (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  },

  deleteUser: async (userId: string): Promise<void> => {
    // 1. Delete associated data first to handle foreign key constraints
    await supabase.from('daily_updates').delete().eq('userId', userId);
    await supabase.from('project_tasks').delete().eq('primaryOwnerId', userId);
    await supabase.from('task_folders').delete().eq('ownerId', userId);

    // 2. Delete the user
    const { error } = await supabase.from('app_users').delete().eq('id', userId);
    if (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },

  // Work Updates
  getUpdates: async (): Promise<DailyWorkUpdate[]> => {
    const { data, error } = await supabase.from('daily_updates').select('*');
    if (error) {
      console.error('Error fetching updates:', error);
      return [];
    }
    return data || [];
  },

  saveUpdate: async (update: DailyWorkUpdate): Promise<boolean> => {
    const { error } = await supabase.from('daily_updates').upsert(update);
    if (error) {
      console.error('Error saving update:', error);
      throw error;
    }
    return true;
  },

  getUpdatesByUser: async (userId: string): Promise<DailyWorkUpdate[]> => {
    const { data } = await supabase.from('daily_updates').select('*').eq('userId', userId);
    return data || [];
  },

  getUpdatesByMonth: async (month: string): Promise<DailyWorkUpdate[]> => {
    const { data } = await supabase.from('daily_updates').select('*').eq('month', month);
    return data || [];
  },

  getUpdateByDate: async (userId: string, date: string): Promise<DailyWorkUpdate | null> => {
    const { data, error } = await supabase
      .from('daily_updates')
      .select('*')
      .eq('userId', userId)
      .eq('date', date)
      .maybeSingle(); // Use maybeSingle to avoid errors if no match
    if (error) {
      console.error('Error fetching update by date:', error);
      return null;
    }
    return data;
  },

  // Project Task Management
  getTasks: async (): Promise<ProjectTask[]> => {
    const { data, error } = await supabase.from('project_tasks').select('*');
    if (error) {
      console.error('Error fetching project tasks:', error);
      return [];
    }
    return data || [];
  },

  getTasksByUser: async (userId: string): Promise<ProjectTask[]> => {
    // Separate queries to avoid complex .or() hangs
    const [{ data: assigned }, { data: collaborative }] = await Promise.all([
      supabase.from('project_tasks').select('*').contains('assignedUserIds', [userId]),
      supabase.from('project_tasks').select('*').contains('collaboratorIds', [userId])
    ]);

    const allTasks = [...(assigned || []), ...(collaborative || [])];
    // De-duplicate by ID
    const uniqueTasks = Array.from(new Map(allTasks.map(t => [t.id, t])).values());
    return uniqueTasks;
  },

  saveTask: async (task: ProjectTask): Promise<void> => {
    const { error } = await supabase.from('project_tasks').upsert(task);
    if (error) {
      console.error('Error saving task:', error);
      throw error;
    }
  },

  deleteTask: async (taskId: string): Promise<void> => {
    const { error } = await supabase.from('project_tasks').delete().eq('id', taskId);
    if (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  },

  // Folder Management
  getFolders: async (userId: string, isAdmin: boolean): Promise<TaskFolder[]> => {
    if (isAdmin) {
      const { data } = await supabase.from('task_folders').select('*');
      return data || [];
    }

    // Non-admins see: PRIVATE folders they own, or folders where they are in accessibleUserIds
    const [{ data: owned }, { data: shared }] = await Promise.all([
      supabase.from('task_folders').select('*').eq('ownerId', userId),
      supabase.from('task_folders').select('*').contains('accessibleUserIds', [userId])
    ]);

    const allFolders = [...(owned || []), ...(shared || [])];
    // De-duplicate by ID
    return Array.from(new Map(allFolders.map(f => [f.id, f])).values());
  },

  saveFolder: async (folder: TaskFolder): Promise<void> => {
    const { error } = await supabase.from('task_folders').upsert(folder);
    if (error) {
      console.error('Error saving folder:', error);
      throw error;
    }
  },

  deleteFolder: async (folderId: string): Promise<void> => {
    // Note: In real app, might want to handle task cleanup or move
    const { error } = await supabase.from('task_folders').delete().eq('id', folderId);
    if (error) {
      console.error('Error deleting folder:', error);
      throw error;
    }
  }
};
