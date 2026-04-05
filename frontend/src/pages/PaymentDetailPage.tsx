import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { usePayment } from '@/hooks/usePayments';
import StatusBadge from '@/components/common/StatusBadge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { formatCurrency, formatDateTime } from '@/utils/format';

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: payment, isLoading } = usePayment(id!);

  if (isLoading) return <LoadingSpinner />;
  if (!payment) return <div className="py-12 text-center text-gray-500">Төлбөр олдсонгүй</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-gray-100">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Төлбөрийн дэлгэрэнгүй</h1>
          <div className="mt-1 flex items-center gap-3">
            <StatusBadge status={payment.payment_status} />
            <span className="font-mono text-sm text-gray-500">{payment.payment_id.slice(0, 12)}...</span>
          </div>
        </div>
      </div>

      <div className="card space-y-5">
        <h2 className="text-lg font-semibold text-gray-900">Төлбөрийн мэдээлэл</h2>
        <div className="grid grid-cols-2 gap-4">
          <InfoRow label="Төлбөрийн ID" value={payment.payment_id} mono />
          <InfoRow label="Нэхэмжлэхийн дугаар" value={payment.invoice_no} />
          <InfoRow label="Төлөгч данс" value={payment.payer_account} mono />
          <InfoRow label="Хүлээн авагч данс" value={payment.beneficiary_account} mono />
          <InfoRow label="Дүн" value={formatCurrency(Number(payment.amount), payment.currency)} highlight />
          <InfoRow label="Валют" value={payment.currency} />
          <InfoRow label="Төлөв" value={payment.payment_status} />
          <InfoRow label="Үүсгэсэн" value={formatDateTime(payment.created_at)} />
          {payment.finacle_txn_ref && (
            <InfoRow label="Finacle Txn Ref" value={payment.finacle_txn_ref} mono />
          )}
          {payment.approved_by && (
            <InfoRow label="Батлагч" value={payment.approved_by} />
          )}
          {payment.rejection_reason && (
            <div className="col-span-2">
              <p className="text-sm text-gray-500">Татгалзсан шалтгаан</p>
              <p className="mt-0.5 text-sm font-medium text-red-600">{payment.rejection_reason}</p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <button
          onClick={() => navigate(`/invoices/${payment.invoice_id}`)}
          className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          <FileText className="h-4 w-4" />
          Нэхэмжлэх #{payment.invoice_no} харах
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono = false, highlight = false }: {
  readonly label: string;
  readonly value: string;
  readonly mono?: boolean;
  readonly highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-0.5 text-sm ${highlight ? 'font-bold text-gray-900' : 'font-medium text-gray-700'} ${mono ? 'font-mono' : ''}`}>
        {value}
      </p>
    </div>
  );
}
