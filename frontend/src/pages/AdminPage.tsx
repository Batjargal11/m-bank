import { useState, useEffect } from 'react';
import { Users, Building2, Plus, Shield } from 'lucide-react';
import apiClient from '@/api/client';
import { formatDate } from '@/utils/format';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface User {
  readonly user_id: string;
  readonly org_id: string;
  readonly username: string;
  readonly email: string;
  readonly full_name: string;
  readonly role: string;
  readonly is_active: boolean;
  readonly last_login: string | null;
  readonly created_at: string;
}

interface Organization {
  readonly org_id: string;
  readonly name: string;
  readonly registration_no: string;
  readonly is_active: boolean;
  readonly created_at: string;
}

interface Account {
  readonly account_id: string;
  readonly account_no: string;
  readonly currency: string;
  readonly is_active: boolean;
}

type Tab = 'users' | 'organizations';

const ROLE_LABELS: Record<string, string> = {
  SYSTEM_ADMIN: 'Систем Админ',
  BANK_OPERATOR: 'Банк Оператор',
  CORPORATE_MAKER: 'Мэйкер',
  CORPORATE_APPROVER: 'Батлагч',
  CORPORATE_USER: 'Хэрэглэгч',
};

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<readonly User[]>([]);
  const [orgs, setOrgs] = useState<readonly Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<readonly Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tab === 'users') {
      setLoading(true);
      apiClient.get('/users').then(({ data }) => setUsers(data.data)).catch(() => {}).finally(() => setLoading(false));
    } else {
      setLoading(true);
      apiClient.get('/organizations').then(({ data }) => setOrgs(data.data)).catch(() => {}).finally(() => setLoading(false));
    }
  }, [tab]);

  useEffect(() => {
    if (selectedOrg) {
      apiClient.get(`/organizations/${selectedOrg}/accounts`).then(({ data }) => setAccounts(data.data)).catch(() => {});
    }
  }, [selectedOrg]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Админ хяналт</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'users' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Users className="h-4 w-4" />
          Хэрэглэгчид
        </button>
        <button
          onClick={() => setTab('organizations')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'organizations' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Building2 className="h-4 w-4" />
          Байгууллагууд
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : tab === 'users' ? (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Нэр</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Хэрэглэгчийн нэр</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Имэйл</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Эрх</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Төлөв</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">Сүүлд нэвтэрсэн</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.user_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{user.full_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{user.username}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{user.email}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                        <Shield className="h-3 w-3" />
                        {ROLE_LABELS[user.role] || user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {user.is_active ? (
                        <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Идэвхтэй</span>
                      ) : (
                        <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Идэвхгүй</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {user.last_login ? formatDate(user.last_login) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Org List */}
          <div className="card">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Байгууллагууд</h2>
            <div className="space-y-2">
              {orgs.map((org) => (
                <button
                  key={org.org_id}
                  onClick={() => setSelectedOrg(org.org_id)}
                  className={`w-full rounded-lg border p-4 text-left transition-colors ${
                    selectedOrg === org.org_id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{org.name}</p>
                      <p className="text-sm text-gray-500">РД: {org.registration_no}</p>
                    </div>
                    {org.is_active ? (
                      <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Идэвхтэй</span>
                    ) : (
                      <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Идэвхгүй</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Бүртгэсэн: {formatDate(org.created_at)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Org Detail + Accounts */}
          <div className="card">
            {selectedOrg ? (
              <>
                <h2 className="mb-4 text-lg font-semibold text-gray-900">Дансны мэдээлэл</h2>
                {accounts.length === 0 ? (
                  <p className="text-sm text-gray-500">Данс байхгүй</p>
                ) : (
                  <div className="space-y-3">
                    {accounts.map((acc) => (
                      <div key={acc.account_id} className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                        <div>
                          <p className="font-mono text-lg font-bold text-gray-900">{acc.account_no}</p>
                          <p className="text-sm text-gray-500">{acc.currency}</p>
                        </div>
                        {acc.is_active ? (
                          <span className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Идэвхтэй</span>
                        ) : (
                          <span className="inline-flex rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Хаалттай</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full items-center justify-center py-12">
                <p className="text-sm text-gray-400">Байгууллага сонгоно уу</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
