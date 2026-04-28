import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  color: 'blue' | 'emerald' | 'amber' | 'red' | 'sky' | 'violet';
  subtitle?: string;
}

const colorMap = {
  blue: { bg: 'bg-blue-50', icon: 'bg-blue-600 text-white', text: 'text-blue-600' },
  emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-600 text-white', text: 'text-emerald-600' },
  amber: { bg: 'bg-amber-50', icon: 'bg-amber-500 text-white', text: 'text-amber-600' },
  red: { bg: 'bg-red-50', icon: 'bg-red-600 text-white', text: 'text-red-600' },
  sky: { bg: 'bg-sky-50', icon: 'bg-sky-600 text-white', text: 'text-sky-600' },
  violet: { bg: 'bg-violet-50', icon: 'bg-violet-600 text-white', text: 'text-violet-600' },
};

export function StatCard({ label, value, icon: Icon, color, subtitle }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className={`${c.bg} rounded-2xl p-5 flex items-start gap-4`}>
      <div className={`${c.icon} p-3 rounded-xl flex-shrink-0`}>
        <Icon size={22} />
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className={`text-3xl font-bold ${c.text} leading-tight`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
