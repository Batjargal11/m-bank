import { create } from 'zustand';

export interface AuthUser {
  readonly userId: string;
  readonly username: string;
  readonly role: string;
  readonly orgId: string;
  readonly orgName?: string;
  readonly permissions?: readonly string[];
}

interface AuthState {
  readonly user: AuthUser | null;
  readonly accessToken: string | null;
  readonly refreshToken: string | null;
  readonly isAuthenticated: boolean;
  readonly setAuth: (payload: {
    readonly user: AuthUser;
    readonly accessToken: string;
    readonly refreshToken: string;
  }) => void;
  readonly logout: () => void;
  readonly getToken: () => string | null;
}

const storedToken = localStorage.getItem('accessToken');
const storedRefresh = localStorage.getItem('refreshToken');
const storedUser = localStorage.getItem('user');

export const useAuthStore = create<AuthState>((set, get) => ({
  user: storedUser ? JSON.parse(storedUser) : null,
  accessToken: storedToken,
  refreshToken: storedRefresh,
  isAuthenticated: !!storedToken,

  setAuth: ({ user, accessToken, refreshToken }) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  getToken: () => get().accessToken,
}));
