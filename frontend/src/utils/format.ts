import { format, parseISO } from 'date-fns';

export function formatCurrency(amount: number, currency = 'MNT'): string {
  return new Intl.NumberFormat('mn-MN', {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'MNT' ? 0 : 2,
    maximumFractionDigits: currency === 'MNT' ? 0 : 2,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'yyyy-MM-dd');
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'yyyy-MM-dd HH:mm');
  } catch {
    return dateStr;
  }
}

export function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = parseISO(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Дөнгөж сая';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} минутын өмнө`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} цагийн өмнө`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} өдрийн өмнө`;
  return formatDate(dateStr);
}
