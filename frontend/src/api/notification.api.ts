import apiClient from './client';

export interface Notification {
  readonly id: string;
  readonly org_id: string;
  readonly user_id: string | null;
  readonly type: string;
  readonly title: string;
  readonly message: string;
  readonly entity_type: string | null;
  readonly entity_id: string | null;
  readonly is_read: boolean;
  readonly read_at: string | null;
  readonly created_at: string;
}

export const notificationApi = {
  getNotifications: async (params?: { page?: number; limit?: number }) => {
    const { data } = await apiClient.get('/notifications', { params });
    return data;
  },

  getUnreadCount: async (): Promise<number> => {
    const { data } = await apiClient.get('/notifications/unread-count');
    return data.data?.unreadCount ?? data.data?.count ?? 0;
  },

  markAsRead: async (id: string): Promise<void> => {
    await apiClient.patch(`/notifications/${id}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await apiClient.post('/notifications/mark-all-read');
  },
} as const;
