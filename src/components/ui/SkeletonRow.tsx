export function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr className="border-b border-gray-50">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + (i % 3) * 15}%` }} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-32 bg-gray-100 rounded" />
        <div className="h-8 w-8 bg-gray-100 rounded-xl" />
      </div>
      <div className="h-8 w-16 bg-gray-100 rounded mb-2" />
      <div className="h-3 w-24 bg-gray-100 rounded" />
    </div>
  );
}
