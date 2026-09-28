import { useState, type FormEvent } from 'react';
import { Cpu, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';

export function Login() {
  const [accessKey, setAccessKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!accessKey.trim()) return;
    setLoading(true);
    setError('');
    const result = await api.auth.signIn(accessKey);
    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 sm:p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(37,99,235,0.24),_transparent_42%)]" />
      <div className="w-full max-w-md relative">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-3.5 rounded-2xl mb-4 shadow-lg shadow-blue-950">
            <Cpu size={30} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">IT Inventario</h1>
          <p className="text-slate-400 text-sm mt-2">Control técnico de activos FEVAL</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-7 sm:p-8">
          <div className="flex items-start gap-3 mb-6">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><ShieldCheck size={22} /></div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Acceso protegido</h2>
              <p className="text-sm leading-6 text-slate-500 mt-1">Identifícate con tu cuenta autorizada para administrar el inventario.</p>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Clave de acceso</span>
              <div className="relative mt-2">
                <KeyRound size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={accessKey}
                  onChange={(event) => setAccessKey(event.target.value)}
                  autoComplete="current-password"
                  className="input w-full pl-10"
                  placeholder="Introduce la clave del inventario"
                  autoFocus
                />
              </div>
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading || !accessKey.trim()}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <LockKeyhole size={18} />
              {loading ? 'Comprobando…' : 'Entrar de forma segura'}
            </button>
          </form>
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Datos alojados en la nueva plataforma de inventario
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Acceso restringido al personal autorizado
        </p>
      </div>
    </div>
  );
}
