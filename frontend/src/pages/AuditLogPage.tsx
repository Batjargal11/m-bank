import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Globe } from 'lucide-react';
import { auditApi, type AuditLog, type IntegrationLog } from '@/api/audit.api';
import DataTable, { type Column } from '@/components/common/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import { formatDateTime } from '@/utils/format';

type Tab = 'audit' | 'integration';

const auditColumns: readonly Column<AuditLog>[] = [
  { header: 'Үйлдэл', accessor: 'action' },
  { header: 'Обьект', accessor: 'entity_type' },
  { header: 'Entity ID', accessor: 'entity_id', cell: (row) => row.entity_id ? <span className="font-mono text-xs">{row.entity_id.slice(0, 8)}...</span> : '—' },
  { header: 'Огноо', accessor: 'created_at', cell: (row) => formatDateTime(row.created_at) },
  { header: 'Correlation', accessor: 'correlation_id', cell: (row) => <span className="font-mono text-xs text-gray-500">{row.correlation_id.slice(0, 12)}...</span> },
];

const integrationColumns: readonly Column<IntegrationLog>[] = [
  { header: 'Систем', accessor: 'target_system' },
  { header: 'Төрөл', accessor: 'request_type' },
  { header: 'Төлөв', accessor: 'status', cell: (row) => <StatusBadge status={row.status} /> },
  { header: 'Код', accessor: 'response_code', cell: (row) => row.response_code ? <span className={`font-mono text-sm ${row.response_code < 400 ? 'text-green-600' : 'text-red-600'}`}>{row.response_code}</span> : '—' },
  { header: 'Хугацаа', accessor: 'duration_ms', cell: (row) => row.duration_ms ? `${row.duration_ms}ms` : '—' },
  { header: 'Огноо', accessor: 'created_at', cell: (row) => formatDateTime(row.created_at) },
];

export default function AuditLogPage() {
  const [activeTab, setActiveTab] = useState<Tab>('audit');

  const auditQuery = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => auditApi.getAuditLogs(),
    enabled: activeTab === 'audit',
  });

  const integrationQuery = useQuery({
    queryKey: ['integration-logs'],
    queryFn: () => auditApi.getIntegrationLogs(),
    enabled: activeTab === 'integration',
  });

  const isLoading = activeTab === 'audit' ? auditQuery.isLoading : integrationQuery.isLoading;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Аудит лог</h1>

      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'audit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <ClipboardList className="h-4 w-4" /> Аудит лог
        </button>
        <button
          onClick={() => setActiveTab('integration')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'integration' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Globe className="h-4 w-4" /> Интеграцийн лог
        </button>
      </div>

      {activeTab === 'audit' ? (
        <DataTable<AuditLog>
          columns={auditColumns}
          data={(auditQuery.data?.data ?? []) as AuditLog[]}
          loading={isLoading}
          emptyMessage="Аудит лог олдсонгүй"
        />
      ) : (
        <DataTable<IntegrationLog>
          columns={integrationColumns}
          data={(integrationQuery.data?.data ?? []) as IntegrationLog[]}
          loading={isLoading}
          emptyMessage="Интеграцийн лог олдсонгүй"
        />
      )}
    </div>
  );
}
