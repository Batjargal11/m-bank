import {
  Organization,
  Account,
  CreateOrganizationDto,
  CreateAccountDto,
  PaginationQuery,
} from '@m-bank/shared-types';
import {
  NotFoundError,
  ConflictError,
  parsePagination,
  buildPaginationMeta,
} from '@m-bank/shared-utils';
import * as orgRepo from '../repositories/org.repository';

export async function getOrganizations(paginationQuery: PaginationQuery): Promise<{
  organizations: Organization[];
  meta: ReturnType<typeof buildPaginationMeta>;
}> {
  const pagination = parsePagination(paginationQuery);
  const { organizations, total } = await orgRepo.findAll(pagination);
  const page = Math.max(1, paginationQuery.page || 1);
  const limit = Math.min(100, Math.max(1, paginationQuery.limit || 20));
  const meta = buildPaginationMeta(total, page, limit);

  return { organizations, meta };
}

export async function getOrganizationById(
  orgId: string,
): Promise<Organization & { accounts: Account[] }> {
  const org = await orgRepo.findById(orgId);
  if (!org) {
    throw new NotFoundError('Organization', orgId);
  }

  const accounts = await orgRepo.findAccountsByOrgId(orgId);
  return { ...org, accounts };
}

export async function createOrganization(
  dto: CreateOrganizationDto,
): Promise<Organization> {
  const existing = await orgRepo.findByRegistrationNo(dto.registration_no);
  if (existing) {
    throw new ConflictError(
      `Organization with registration number '${dto.registration_no}' already exists`,
    );
  }

  return orgRepo.create(dto);
}

export async function updateOrganization(
  orgId: string,
  fields: Partial<Pick<Organization, 'name' | 'is_active'>>,
): Promise<Organization> {
  const updated = await orgRepo.update(orgId, fields);
  if (!updated) {
    throw new NotFoundError('Organization', orgId);
  }
  return updated;
}

export async function getAccounts(orgId: string): Promise<Account[]> {
  const org = await orgRepo.findById(orgId);
  if (!org) {
    throw new NotFoundError('Organization', orgId);
  }

  return orgRepo.findAccountsByOrgId(orgId);
}

export async function addAccount(
  orgId: string,
  dto: CreateAccountDto,
): Promise<Account> {
  const org = await orgRepo.findById(orgId);
  if (!org) {
    throw new NotFoundError('Organization', orgId);
  }

  return orgRepo.createAccount(orgId, dto);
}
