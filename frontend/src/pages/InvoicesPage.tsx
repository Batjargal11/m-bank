import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Send, Inbox } from 'lucide-react';
import { useInvoices } from '@/hooks/useInvoices';
import { useAuthStore } from '@/store/auth.store';
import { hasPermission } from '@/utils/rbac';
import DataTable, { type Column } from '@/components/common/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import { formatCurrency, formatDate } from '@/utils/format';
import type { Invoice } from '@/api/invoice.api';

type Tab = 'sent' | 'received';

const SENT_STATUS_OPTIONS = [
  { value: '', label: 'Бүгд' },
  { value: 'DRAFT', label: 'Ноорог' },
  { value: 'SENT', label: 'Илгээсэн' },
  { value: 'RECEIVED', label: 'Хүлээн авсан' },
  { value: 'VIEWED', label: 'Үзсэн' },
  { value: 'PAID', label: 'Төлөгдсөн' },
  { value: 'CANCEL_REQUESTED', label: 'Цуцлалт хүсэлт' },
  { value: 'CANCELLED', label: 'Цуцлагдсан' },
] as const;

const RECEIVED_STATUS_OPTIONS = [
  { value: '', label: 'Бүгд' },
  { value: 'SENT', label: 'Илгээсэн' },
  { value: 'RECEIVED', label: 'Хүлээн авсан' },
  { value: 'VIEWED', label: 'Үзсэн' },
  { value: 'PAYMENT_PENDING', label: 'Төлбөр хүлээгдэж буй' },
  { value: 'PAID', label: 'Төлөгдсөн' },
  { value: 'CANCEL_REQUESTED', label: 'Цуцлалт хүсэлт' },
] as const;

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('sent');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useInvoices({
    direction: activeTab,
    status: status || undefined,
    page,
    limit: 20,
  });

  const sentColumns: readonly Column<Invoice>[] = [
    { header: 'Дугаар', accessor: 'invoice_no' },
    { header: 'Хүлээн авагч', accessor: 'receiver_org_name' },
    { header: 'Огноо', accessor: 'issue_date', cell: (row) => formatDate(row.issue_date) },
    { header: 'Дуусах', accessor: 'due_date', cell: (row) => formatDate(row.due_date) },
    { header: 'Дүн', accessor: 'total_amount', cell: (row) => formatCurrency(Number(row.total_amount), row.currency) },
    { header: 'Төлөв', accessor: 'status', cell: (row) => <StatusBadge status={row.status} /> },
  ];

  const receivedColumns: readonly Column<Invoice>[] = [
    { header: 'Дугаар', accessor: 'invoice_no' },
    { header: 'Илгээгч', accessor: 'sender_org_name' },
    { header: 'Огноо', accessor: 'issue_date', cell: (row) => formatDate(row.issue_date) },
    { header: 'Дүн', accessor: 'total_amount', cell: (row) => formatCurrency(Number(row.total_amount), row.currency) },
    { header: 'Төлөв', accessor: 'status', cell: (row) => <StatusBadge status={row.status} /> },
    {
      header: 'Үйлдэл', accessor: 'invoice_id',
      cell: (row) => {
        const canPay = ['SENT', 'RECEIVED', 'VIEWED'].includes(row.status) && user && hasPermission(user.role, 'invoice:pay');
        if (!canPay) return null;
        return (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/payments/new?invoiceId=${row.invoice_id}&amount=${row.outstanding_amount}`); }}
            className="rounded-md bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700"
          >
            Төлөх
          </button>
        );
      },
    },
  ];

  const columns = activeTab === 'sent' ? sentColumns : receivedColumns;
  const invoices = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Нэхэмжлэх</h1>
        {user && hasPermission(user.role, 'invoice:create') && (
          <button onClick={() => navigate('/invoices/create')} className="btn-primary">
            <Plus className="h-4 w-4" />
            Нэхэмжлэх үүсгэх
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => { setActiveTab('sent'); setPage(1); }}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'sent' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Send className="h-4 w-4" />
          Илгээсэн
        </button>
        <button
          onClick={() => { setActiveTab('received'); setPage(1); }}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'received' ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Inbox className="h-4 w-4" />
          Ирсэн
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="input-field w-48"
        >
          {(activeTab === 'sent' ? SENT_STATUS_OPTIONS : RECEIVED_STATUS_OPTIONS).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <DataTable<Invoice>
        columns={columns}
        data={invoices as Invoice[]}
        loading={isLoading}
        emptyMessage={activeTab === 'sent' ? 'Илгээсэн нэхэмжлэх байхгүй' : 'Ирсэн нэхэмжлэх байхгүй'}
        onRowClick={(row) => navigate(`/invoices/${row.invoice_id}`)}
      />

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Нийт {meta.total} нэхэмжлэх, хуудас {meta.page}/{meta.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Өмнөх
            </button>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              Дараах
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
