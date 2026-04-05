const STATUS_CONFIG: Record<string, { readonly bg: string; readonly text: string; readonly label: string }> = {
  DRAFT: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Ноорог' },
  VERIFIED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Баталгаажсан' },
  SENT: { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Илгээсэн' },
  RECEIVED: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Хүлээн авсан' },
  VIEWED: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Үзсэн' },
  PAYMENT_PENDING: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Төлбөр хүлээгдэж буй' },
  PAYMENT_PROCESSING: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Төлбөр боловсруулж буй' },
  PARTIALLY_PAID: { bg: 'bg-lime-100', text: 'text-lime-700', label: 'Хэсэгчлэн төлсөн' },
  PAID: { bg: 'bg-green-100', text: 'text-green-700', label: 'Төлөгдсөн' },
  CANCEL_REQUESTED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Цуцлах хүсэлттэй' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Цуцлагдсан' },
  EXPIRED: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Хугацаа дууссан' },
  FAILED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Амжилтгүй' },
  INITIATED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Эхлүүлсэн' },
  PENDING_APPROVAL: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Зөвшөөрөл хүлээж буй' },
  APPROVED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Зөвшөөрөгдсөн' },
  REJECTED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Татгалзсан' },
  COMPLETED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Дууссан' },
};

interface StatusBadgeProps {
  readonly status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: status };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}
