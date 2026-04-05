import { useNavigate } from 'react-router-dom';
import { FileText, Clock, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';
import { useInvoices, useDashboardStats } from '@/hooks/useInvoices';
import { useAuthStore } from '@/store/auth.store';
import DataTable, { type Column } from '@/components/common/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import { formatCurrency, formatDate } from '@/utils/format';
import type { Invoice } from '@/api/invoice.api';

interface StatItem {
  readonly status: string;
  readonly count: number;
  readonly total_amount: string;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: sentData } = useInvoices({ direction: 'sent', limit: 5 });
  const { data: receivedData } = useInvoices({ direction: 'received', limit: 5 });
  const { data: rawStats } = useDashboardStats();

  const sentInvoices = (sentData?.data ?? []) as Invoice[];
  const receivedInvoices = (receivedData?.data ?? []) as Invoice[];
  const totalSent = sentData?.meta?.total ?? 0;
  const totalReceived = receivedData?.meta?.total ?? 0;

  // Parse stats from API response (array of {status, count, total_amount})
  const statsArray = (Array.isArray(rawStats) ? rawStats : []) as StatItem[];
  const getStatCount = (statuses: string[]) =>
    statsArray.filter((s) => statuses.includes(s.status)).reduce((sum, s) => sum + Number(s.count), 0);
  const paidCount = getStatCount(['PAID']);
  const pendingCount = getStatCount(['SENT', 'RECEIVED', 'VIEWED', 'PAYMENT_PENDING', 'PAYMENT_PROCESSING']);
  const cancelledCount = getStatCount(['CANCELLED', 'CANCEL_REQUESTED']);
  const draftCount = getStatCount(['DRAFT']);

  const stats = [
    { label: 'Илгээсэн', value: totalSent, icon: FileText, color: 'bg-blue-50 text-blue-700' },
    { label: 'Ирсэн', value: totalReceived, icon: Clock, color: 'bg-yellow-50 text-yellow-700' },
    { label: 'Төлөгдсөн', value: paidCount, icon: CheckCircle, color: 'bg-green-50 text-green-700' },
    { label: 'Хүлээгдэж буй', value: pendingCount, icon: AlertTriangle, color: 'bg-orange-50 text-orange-700' },
  ];

  const sentColumns: readonly Column<Invoice>[] = [
    { header: 'Дугаар', accessor: 'invoice_no' },
    { header: 'Хүлээн авагч', accessor: 'receiver_org_name' },
    { header: 'Дүн', accessor: 'total_amount', cell: (row) => formatCurrency(Number(row.total_amount), row.currency) },
    { header: 'Төлөв', accessor: 'status', cell: (row) => <StatusBadge status={row.status} /> },
  ];

  const receivedColumns: readonly Column<Invoice>[] = [
    { header: 'Дугаар', accessor: 'invoice_no' },
    { header: 'Илгээгч', accessor: 'sender_org_name' },
    { header: 'Дүн', accessor: 'total_amount', cell: (row) => formatCurrency(Number(row.total_amount), row.currency) },
    { header: 'Төлөв', accessor: 'status', cell: (row) => <StatusBadge status={row.status} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Сайн байна уу, {user?.username}
        </h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <TrendingUp className="h-4 w-4" />
          Ноорог: {draftCount} | Цуцлагдсан: {cancelledCount}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card flex items-center gap-4">
            <div className={`rounded-lg p-3 ${stat.color}`}>
              <stat.icon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Сүүлд илгээсэн</h2>
          <DataTable<Invoice>
            columns={sentColumns}
            data={sentInvoices}
            emptyMessage="Илгээсэн нэхэмжлэх байхгүй"
            onRowClick={(row) => navigate(`/invoices/${row.invoice_id}`)}
          />
        </div>

        <div className="card">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Сүүлд ирсэн</h2>
          <DataTable<Invoice>
            columns={receivedColumns}
            data={receivedInvoices}
            emptyMessage="Ирсэн нэхэмжлэх байхгүй"
            onRowClick={(row) => navigate(`/invoices/${row.invoice_id}`)}
          />
        </div>
      </div>
    </div>
  );
}
