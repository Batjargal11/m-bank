import apiClient from './client';

export interface Organization {
  readonly org_id: string;
  readonly name: string;
  readonly registration_no: string;
  readonly is_active: boolean;
}

export const orgApi = {
  getOrganizations: async (): Promise<readonly Organization[]> => {
    const { data } = await apiClient.get('/organizations');
    return data.data;
  },
} as const;
