import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-white rounded-b-2xl">
      <p className="text-sm text-gray-500">
        {start}–{end} de {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-600"
        >
          <ChevronLeft size={16} />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
          .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
            if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
            acc.push(p);
            return acc;
          }, [])
          .map((p, i) =>
            p === 'ellipsis' ? (
              <span key={`e-${i}`} className="px-1 text-gray-400 text-sm">…</span>
            ) : (
              <button
                key={p}
                onClick={() => onChange(p as number)}
                className={`min-w-[32px] h-8 rounded-lg text-sm font-medium transition-colors ${
                  p === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                {p}
              </button>
            )
          )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-600"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
