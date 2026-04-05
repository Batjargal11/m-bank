export interface Organization {
  org_id: string;
  name: string;
  registration_no: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Account {
  account_id: string;
  org_id: string;
  account_no: string;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateOrganizationDto {
  name: string;
  registration_no: string;
}

export interface CreateAccountDto {
  account_no: string;
  currency: string;
}
