import type { ReactNode } from 'react';
import LoadingSpinner from './LoadingSpinner';

export interface Column<T> {
  readonly header: string;
  readonly accessor: keyof T | string;
  readonly cell?: (row: T) => ReactNode;
  readonly className?: string;
}

interface DataTableProps<T> {
  readonly columns: readonly Column<T>[];
  readonly data: readonly T[];
  readonly loading?: boolean;
  readonly emptyMessage?: string;
  readonly onRowClick?: (row: T) => void;
}

export default function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage = 'Мэдээлэл олдсонгүй',
  onRowClick,
}: DataTableProps<T>) {
  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.accessor)}
                className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-sm text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={idx}
                onClick={() => onRowClick?.(row)}
                className={`transition-colors ${
                  onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
                }`}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.accessor)}
                    className={`whitespace-nowrap px-4 py-3 text-sm text-gray-700 ${col.className || ''}`}
                  >
                    {col.cell
                      ? col.cell(row)
                      : String(row[col.accessor as keyof T] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
