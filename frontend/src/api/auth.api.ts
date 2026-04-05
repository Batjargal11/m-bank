import apiClient from './client';

export interface LoginRequest {
  readonly username: string;
  readonly password: string;
}

export interface AuthUser {
  readonly userId: string;
  readonly username: string;
  readonly role: string;
  readonly orgId: string;
}

export interface AuthResponse {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly user: AuthUser;
}

export const authApi = {
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    const { data } = await apiClient.post('/auth/login', credentials);
    const result = data.data;
    return {
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      user: result.user,
    };
  },

  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    const { data } = await apiClient.post('/auth/refresh', { refreshToken });
    const result = data.data;
    return {
      accessToken: result.tokens?.accessToken ?? result.accessToken,
      refreshToken: result.tokens?.refreshToken ?? result.refreshToken,
      user: result.user,
    };
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },
} as const;
