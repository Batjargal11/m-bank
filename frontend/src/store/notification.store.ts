import { create } from 'zustand';

interface NotificationState {
  readonly unreadCount: number;
  readonly setUnreadCount: (count: number) => void;
  readonly decrement: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (count: number) => set({ unreadCount: count }),
  decrement: () => set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),
}));
