import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePayments } from '@/hooks/usePayments';
import DataTable, { type Column } from '@/components/common/DataTable';
import StatusBadge from '@/components/common/StatusBadge';
import { formatCurrency, formatDateTime } from '@/utils/format';
import type { Payment } from '@/api/payment.api';

const STATUS_OPTIONS = [
  { value: '', label: 'Бүгд' },
  { value: 'PAYMENT_PENDING', label: 'Хүлээгдэж буй' },
  { value: 'PAYMENT_PROCESSING', label: 'Боловсруулж буй' },
  { value: 'PAID', label: 'Төлөгдсөн' },
  { value: 'PAYMENT_FAILED', label: 'Амжилтгүй' },
] as const;

export default function PaymentsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = usePayments({
    status: status || undefined,
    page,
    limit: 20,
  });

  const payments = (data?.data ?? []) as Payment[];
  const meta = data?.meta;

  const columns: readonly Column<Payment>[] = [
    {
      header: 'ID',
      accessor: 'payment_id',
      cell: (row) => <span className="font-mono text-xs text-primary-600">{row.payment_id.slice(0, 8)}...</span>,
    },
    { header: 'Нэхэмжлэх', accessor: 'invoice_no' },
    { header: 'Төлөгч данс', accessor: 'payer_account' },
    { header: 'Хүлээн авагч', accessor: 'beneficiary_account' },
    {
      header: 'Дүн',
      accessor: 'amount',
      cell: (row) => <span className="font-semibold">{formatCurrency(Number(row.amount), row.currency)}</span>,
    },
    {
      header: 'Төлөв',
      accessor: 'payment_status',
      cell: (row) => <StatusBadge status={row.payment_status} />,
    },
    {
      header: 'Finacle ref',
      accessor: 'finacle_txn_ref',
      cell: (row) => row.finacle_txn_ref
        ? <span className="font-mono text-xs text-gray-500">{row.finacle_txn_ref}</span>
        : <span className="text-xs text-gray-400">—</span>,
    },
    {
      header: 'Огноо',
      accessor: 'created_at',
      cell: (row) => <span className="text-xs">{formatDateTime(row.created_at)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Төлбөр</h1>

      <div className="flex gap-4">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="input-field w-48"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <DataTable<Payment>
        columns={columns}
        data={payments}
        loading={isLoading}
        emptyMessage="Төлбөр олдсонгүй"
        onRowClick={(row) => navigate(`/payments/${row.payment_id}`)}
      />

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            Нийт {meta.total} төлбөр, хуудас {meta.page}/{meta.totalPages}
          </span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary text-sm disabled:opacity-50">Өмнөх</button>
            <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary text-sm disabled:opacity-50">Дараах</button>
          </div>
        </div>
      )}
    </div>
  );
}
