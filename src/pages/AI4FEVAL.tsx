import { useEffect, useMemo, useState } from 'react';
import { BrainCircuit, CalendarDays, CheckCircle2, Database, Download, ExternalLink, FileCheck2, Gauge, GitBranch, Link2, Pencil, Plus, Rocket, ShieldCheck, Sparkles, Target, Trash2, Workflow } from 'lucide-react';
import { api } from '../lib/api';
import { logAction } from '../lib/audit';
import { downloadCompleteInventoryXlsx } from '../lib/inventoryWorkbook';
import { useToast } from '../contexts/ToastContext';
import { useApp } from '../contexts/AppContext';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import type { AIDeliverable, AIIntegration, AIKpi, AIPilot, AIProcess, AIUseCase, AIWorkItem } from '../types';

type Section = 'overview' | 'roadmap' | 'processes' | 'usecases' | 'pilots' | 'integrations' | 'results';
type EditKind = 'process' | 'usecase' | 'work' | 'pilot' | 'integration' | 'kpi' | 'deliverable';
type FormData = Record<string, string | number | boolean | null | undefined>;

const tabs: Array<{ id: Section; label: string; icon: React.ElementType }> = [
  { id: 'overview', label: 'Visión general', icon: Gauge }, { id: 'roadmap', label: 'Plan 2026', icon: CalendarDays },
  { id: 'processes', label: 'Procesos', icon: Workflow }, { id: 'usecases', label: 'Casos IA', icon: BrainCircuit },
  { id: 'pilots', label: 'Pilotos y KPI', icon: Rocket }, { id: 'integrations', label: 'Integraciones', icon: Link2 },
  { id: 'results', label: 'Resultados', icon: FileCheck2 },
];

const tableByKind: Record<EditKind, string> = {
  process: 'ai_processes', usecase: 'ai_use_cases', work: 'ai_work_items', pilot: 'ai_pilots',
  integration: 'ai_integrations', kpi: 'ai_kpis', deliverable: 'ai_deliverables',
};

const emptyByKind: Record<EditKind, FormData> = {
  process: { name: '', department: '', owner: '', description: '', current_pain: '', frequency: 'Diaria', monthly_volume: 0, minutes_per_case: 0, impact_score: 3, viability_score: 3, opportunity_status: 'discovered', notes: '' },
  usecase: { code: '', title: '', process_id: null, category: 'assistant', objective: '', impact_score: 3, viability_score: 3, priority_score: 9, status: 'idea', responsible: '', start_date: null, end_date: null, risk_level: 'medium', data_sensitivity: 'internal', ethics_review: false, notes: '' },
  work: { code: '', title: '', phase: 'Fase 1', subtasks: '', duration_days: 0, start_date: '2026-01-01', end_date: '2026-01-31', status: 'planned', progress: 0, owner: '', depends_on: '', use_case_id: null, notes: '' },
  pilot: { use_case_id: null, name: '', hypothesis: '', architecture: '', model_name: '', tools: '', status: 'design', version: '0.1', repository_url: '', demo_url: '', baseline_minutes: 0, current_minutes: 0, accuracy: 0, satisfaction: 0, monthly_runs: 0, monthly_cost: 0, incidents_count: 0, last_evaluation_at: null, notes: '' },
  integration: { pilot_id: null, system_name: '', integration_type: 'api', data_direction: 'bidirectional', environment: 'test', status: 'planned', owner: '', last_tested_at: null, notes: '' },
  kpi: { use_case_id: null, pilot_id: null, name: '', unit: '%', baseline_value: 0, target_value: 0, current_value: 0, measurement_date: null, evidence_url: '', notes: '' },
  deliverable: { code: '', title: '', phase: 'Fase 1', deliverable_type: 'document', status: 'planned', due_date: null, completed_at: null, owner: '', file_url: '', notes: '' },
};

const statusLabels: Record<string, string> = {
  planned: 'Planificado', in_progress: 'En curso', completed: 'Completado', blocked: 'Bloqueado',
  idea: 'Idea', assessed: 'Evaluado', approved: 'Aprobado', pilot: 'En piloto', validated: 'Validado', transferred: 'Transferido', rejected: 'Descartado',
  design: 'Diseño', development: 'Desarrollo', testing: 'Pruebas', production: 'Producción', paused: 'Pausado',
  discovered: 'Detectado', selected: 'Seleccionado', automated: 'Automatizado', active: 'Activo', failed: 'Con errores',
};

function statusBadge(status: string) {
  const variant = ['completed', 'validated', 'transferred', 'production', 'active', 'automated'].includes(status) ? 'success'
    : ['in_progress', 'pilot', 'development', 'testing', 'selected', 'approved'].includes(status) ? 'info'
      : ['blocked', 'failed', 'rejected'].includes(status) ? 'danger' : 'neutral';
  return <Badge variant={variant}>{statusLabels[status] ?? status}</Badge>;
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`block ${wide ? 'md:col-span-2' : ''}`}><span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>{children}</label>;
}

export function AI4FEVAL() {
  const { showToast } = useToast();
  const { currentUser } = useApp();
  const canEdit = currentUser.role !== 'viewer';
  const [tab, setTab] = useState<Section>('overview');
  const [loading, setLoading] = useState(true);
  const [processes, setProcesses] = useState<AIProcess[]>([]);
  const [useCases, setUseCases] = useState<AIUseCase[]>([]);
  const [workItems, setWorkItems] = useState<AIWorkItem[]>([]);
  const [pilots, setPilots] = useState<AIPilot[]>([]);
  const [integrations, setIntegrations] = useState<AIIntegration[]>([]);
  const [kpis, setKpis] = useState<AIKpi[]>([]);
  const [deliverables, setDeliverables] = useState<AIDeliverable[]>([]);
  const [editKind, setEditKind] = useState<EditKind | null>(null);
  const [form, setForm] = useState<FormData>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<{ kind: EditKind; id: string; name: string } | null>(null);
  const [exporting, setExporting] = useState(false);

  async function load() {
    setLoading(true);
    const results = await Promise.all([
      api.from('ai_processes').select('*').order('impact_score', { ascending: false }),
      api.from('ai_use_cases').select('*').order('priority_score', { ascending: false }),
      api.from('ai_work_items').select('*').order('start_date'),
      api.from('ai_pilots').select('*').order('name'), api.from('ai_integrations').select('*').order('system_name'),
      api.from('ai_kpis').select('*').order('measurement_date', { ascending: false }),
      api.from('ai_deliverables').select('*').order('due_date'),
    ]);
    setProcesses((results[0].data ?? []) as AIProcess[]); setUseCases((results[1].data ?? []) as AIUseCase[]);
    setWorkItems((results[2].data ?? []) as AIWorkItem[]); setPilots((results[3].data ?? []) as AIPilot[]);
    setIntegrations((results[4].data ?? []) as AIIntegration[]); setKpis((results[5].data ?? []) as AIKpi[]);
    setDeliverables((results[6].data ?? []) as AIDeliverable[]); setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const projectProgress = useMemo(() => workItems.length ? Math.round(workItems.reduce((sum, item) => sum + Number(item.progress || 0), 0) / workItems.length) : 0, [workItems]);
  const hoursSaved = useMemo(() => Math.max(0, pilots.reduce((sum, item) => sum + Math.max(0, Number(item.baseline_minutes) - Number(item.current_minutes)) * Number(item.monthly_runs) / 60, 0)), [pilots]);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = [...workItems.filter(item => item.end_date < today && item.status !== 'completed'), ...deliverables.filter(item => item.due_date && item.due_date < today && item.status !== 'completed')];
  const activePhase = workItems.find(item => item.status === 'in_progress') ?? workItems.find(item => item.status === 'planned');

  function openEditor(kind: EditKind, record?: FormData) { setEditKind(kind); setForm(record ? { ...record } : { ...emptyByKind[kind] }); }
  function setValue(key: string, value: string | number | boolean | null) { setForm(previous => ({ ...previous, [key]: value })); }

  async function save() {
    if (!editKind) return;
    const table = tableByKind[editKind];
    const payload = { ...form };
    if (editKind === 'usecase') payload.priority_score = Number(payload.impact_score || 0) * Number(payload.viability_score || 0);
    if (editKind === 'work') payload.progress = Math.min(100, Math.max(0, Number(payload.progress || 0)));
    const id = typeof payload.id === 'string' ? payload.id : '';
    setSaving(true);
    const result = id ? await api.from(table).update(payload).eq('id', id) : await api.from(table).insert(payload);
    setSaving(false);
    if (result.error) { showToast(result.error.message, 'error'); return; }
    await logAction(id ? 'updated' : 'created', editKind, id, String(payload.title || payload.name || payload.system_name || payload.code || 'AI4FEVAL'));
    setEditKind(null); showToast('Registro guardado'); await load();
  }

  async function remove() {
    if (!deleting) return;
    const result = await api.from(tableByKind[deleting.kind]).delete().eq('id', deleting.id);
    if (result.error) { showToast(result.error.message, 'error'); return; }
    await logAction('deleted', deleting.kind, deleting.id, deleting.name);
    setDeleting(null); showToast('Registro enviado a la papelera', 'warning'); await load();
  }

  async function quickProgress(item: AIWorkItem, progress: number) {
    const status = progress >= 100 ? 'completed' : progress > 0 ? 'in_progress' : 'planned';
    const { error } = await api.from('ai_work_items').update({ progress, status }).eq('id', item.id);
    if (error) showToast(error.message, 'error'); else await load();
  }

  async function exportAll() {
    setExporting(true);
    try { await downloadCompleteInventoryXlsx(); showToast('Excel de inventario y AI4FEVAL generado'); }
    catch (error) { showToast(error instanceof Error ? error.message : 'No se pudo exportar', 'error'); }
    finally { setExporting(false); }
  }

  function actionButtons(kind: EditKind, record: FormData, name: string) {
    if (!canEdit) return null;
    return <div className="flex gap-1"><button onClick={() => openEditor(kind, record)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="Editar"><Pencil size={14} /></button><button onClick={() => setDeleting({ kind, id: String(record.id), name })} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" title="Eliminar"><Trash2 size={14} /></button></div>;
  }

  function newButton(kind: EditKind, label: string) {
    return canEdit ? <button onClick={() => openEditor(kind)} className="btn-primary flex items-center gap-2"><Plus size={15} />{label}</button> : null;
  }

  return <div className="p-4 sm:p-6 space-y-5">
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-900 text-white p-6 sm:p-8">
      <div className="absolute -right-16 -top-20 h-72 w-72 rounded-full bg-cyan-400/10 blur-2xl" />
      <div className="relative flex flex-wrap items-start gap-5"><div className="rounded-2xl bg-white/10 p-3"><Sparkles size={28} className="text-cyan-300" /></div><div className="flex-1 min-w-[260px]"><p className="text-xs font-semibold tracking-[0.22em] text-cyan-300">PROGRAMA ATRAIGO TALENTO · 2026</p><h2 className="mt-2 text-2xl sm:text-3xl font-bold">AI4FEVAL</h2><p className="mt-2 max-w-3xl text-sm text-blue-100">Centro de control para analizar procesos, priorizar casos de uso, desarrollar agentes IA, integrar sistemas y demostrar el impacto con evidencias.</p></div><div className="text-right"><p className="text-4xl font-bold">{projectProgress}%</p><p className="text-xs text-blue-200">avance del plan</p><button onClick={exportAll} disabled={exporting} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium hover:bg-white/20"><Download size={14} />{exporting ? 'Generando…' : 'Excel completo'}</button></div></div>
      <div className="relative mt-6 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${projectProgress}%` }} /></div>
    </section>

    <div className="overflow-x-auto"><div className="inline-flex min-w-full sm:min-w-0 gap-1 rounded-2xl bg-white border border-gray-100 p-1.5 shadow-sm">{tabs.map(item => <button key={item.id} onClick={() => setTab(item.id)} className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium ${tab === item.id ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}><item.icon size={15} />{item.label}</button>)}</div></div>

    {loading ? <div className="py-24 text-center text-gray-400">Cargando espacio AI4FEVAL…</div> : <>
      {tab === 'overview' && <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          <Metric icon={Workflow} label="Procesos" value={processes.length} color="blue" /><Metric icon={BrainCircuit} label="Casos IA" value={useCases.length} color="violet" /><Metric icon={Rocket} label="Pilotos" value={pilots.length} color="cyan" /><Metric icon={Link2} label="Integraciones" value={integrations.length} color="orange" /><Metric icon={Target} label="KPI medidos" value={kpis.length} color="emerald" /><Metric icon={Sparkles} label="Horas/mes" value={Math.round(hoursSaved)} color="pink" />
        </div>
        {projectProgress === 0 && workItems.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900"><strong>Plan inicial importado desde la memoria.</strong> El avance parte de cero para que los porcentajes y estados reflejen únicamente el trabajo real que registres.</div>}
        {overdue.length > 0 && <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-800"><strong>{overdue.length} elemento{overdue.length > 1 ? 's' : ''} fuera de plazo.</strong> Revisa el plan y los entregables para actualizar su estado o fecha.</div>}
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-gray-900">Casos de uso priorizados</h3><p className="text-sm text-gray-500">Impacto × viabilidad, con trazabilidad ética y de datos.</p></div><button onClick={() => setTab('usecases')} className="text-sm text-blue-600 hover:underline">Ver todos</button></div><div className="mt-4 grid md:grid-cols-3 gap-3">{useCases.slice(0, 3).map(item => <div key={item.id} className="rounded-xl border border-gray-100 p-4"><div className="flex justify-between gap-2"><span className="font-mono text-xs text-blue-600">{item.code}</span>{statusBadge(item.status)}</div><p className="mt-3 font-semibold text-sm text-gray-900">{item.title}</p><div className="mt-3 flex items-center gap-2 text-xs text-gray-500"><span>Impacto {item.impact_score}/5</span><span>·</span><span>Viabilidad {item.viability_score}/5</span></div><div className="mt-2 h-1.5 bg-gray-100 rounded-full"><div className="h-full bg-violet-500 rounded-full" style={{ width: `${Math.min(100, item.priority_score * 4)}%` }} /></div></div>)}</div></div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5"><h3 className="font-semibold text-gray-900">Actividad actual</h3>{activePhase ? <div className="mt-4"><div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><GitBranch size={21} /></div><p className="mt-3 text-xs font-mono text-blue-600">{activePhase.code} · {activePhase.phase}</p><p className="mt-1 font-semibold text-gray-900">{activePhase.title}</p><p className="mt-2 text-sm text-gray-500">{activePhase.subtasks}</p><p className="mt-4 text-xs text-gray-400">{new Date(activePhase.start_date).toLocaleDateString('es-ES')} — {new Date(activePhase.end_date).toLocaleDateString('es-ES')}</p></div> : <p className="mt-5 text-sm text-gray-400">Plan completado</p>}</div>
        </div>
        <div className="grid md:grid-cols-3 gap-4"><Principle icon={ShieldCheck} title="Supervisión humana" text="Cada agente mantiene responsable, riesgos, sensibilidad de datos y revisión ética." /><Principle icon={Database} title="Evidencia medible" text="Línea base, objetivo, valor actual, coste, precisión y ahorro quedan registrados." /><Principle icon={CheckCircle2} title="Replicable" text="Arquitectura, herramientas, integraciones y entregables facilitan la transferencia a pymes." /></div>
      </div>}

      {tab === 'roadmap' && <SectionPanel title="Plan de trabajo oficial" subtitle="Calendario de la memoria técnica, con progreso y responsables." action={newButton('work', 'Nueva actividad')}>
        <div className="space-y-3">{workItems.map(item => { const yearStart = new Date('2026-01-01').getTime(); const yearEnd = new Date('2026-12-31').getTime(); const left = Math.max(0, (new Date(item.start_date).getTime() - yearStart) / (yearEnd - yearStart) * 100); const width = Math.max(2, (new Date(item.end_date).getTime() - new Date(item.start_date).getTime()) / (yearEnd - yearStart) * 100); return <div key={item.id} className="rounded-2xl border border-gray-100 p-4"><div className="flex flex-wrap items-start gap-3"><span className="font-mono text-sm font-bold text-blue-600">{item.code}</span><div className="flex-1 min-w-[220px]"><div className="flex flex-wrap gap-2 items-center"><p className="font-semibold text-gray-900">{item.title}</p>{statusBadge(item.status)}</div><p className="text-sm text-gray-500 mt-1">{item.subtasks}</p><p className="text-xs text-gray-400 mt-1">{item.phase} · {item.duration_days} días · {new Date(item.start_date).toLocaleDateString('es-ES')} — {new Date(item.end_date).toLocaleDateString('es-ES')}</p></div>{actionButtons('work', item as unknown as FormData, item.title)}</div><div className="mt-4 relative h-7 bg-slate-100 rounded-lg overflow-hidden"><div className="absolute top-0 bottom-0 rounded bg-blue-200" style={{ left: `${left}%`, width: `${Math.min(100 - left, width)}%` }} /><div className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 to-cyan-500" style={{ width: `${item.progress}%` }} /><span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-slate-700">{item.progress}%</span></div>{canEdit && <input type="range" min="0" max="100" step="5" value={item.progress} onChange={event => quickProgress(item, Number(event.target.value))} className="mt-2 w-full accent-blue-600" />}</div>; })}</div>
      </SectionPanel>}

      {tab === 'processes' && <SectionPanel title="Mapa de procesos" subtitle="Oportunidades cuantificadas por volumen, tiempo, impacto y viabilidad." action={newButton('process', 'Nuevo proceso')}><div className="grid lg:grid-cols-2 gap-4">{processes.map(item => <article key={item.id} className="rounded-2xl border border-gray-100 p-5"><div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Workflow size={19} /></div><div className="flex-1"><div className="flex justify-between gap-2"><div><h3 className="font-semibold text-gray-900">{item.name}</h3><p className="text-xs text-gray-400">{item.department} · {item.owner || 'Sin responsable'}</p></div>{actionButtons('process', item as unknown as FormData, item.name)}</div><p className="mt-3 text-sm text-gray-600">{item.description}</p>{item.current_pain && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"><strong>Problema:</strong> {item.current_pain}</p>}<div className="mt-4 grid grid-cols-4 gap-2 text-center"><MiniMetric label="Volumen/mes" value={item.monthly_volume} /><MiniMetric label="Min/caso" value={item.minutes_per_case} /><MiniMetric label="Impacto" value={`${item.impact_score}/5`} /><MiniMetric label="Viabilidad" value={`${item.viability_score}/5`} /></div></div></div></article>)}</div></SectionPanel>}

      {tab === 'usecases' && <SectionPanel title="Cartera de casos de uso IA" subtitle="Decisiones comparables, riesgos visibles y prioridades calculadas." action={newButton('usecase', 'Nuevo caso IA')}><div className="space-y-3">{useCases.map(item => <article key={item.id} className="rounded-2xl border border-gray-100 p-5"><div className="flex flex-wrap items-start gap-4"><div className="w-12 h-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center"><BrainCircuit size={22} /></div><div className="flex-1 min-w-[240px]"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-violet-600">{item.code}</span>{statusBadge(item.status)}<Badge variant={item.ethics_review ? 'success' : 'warning'}>{item.ethics_review ? 'Revisión ética' : 'Revisión pendiente'}</Badge></div><h3 className="mt-2 font-semibold text-gray-900">{item.title}</h3><p className="mt-1 text-sm text-gray-600">{item.objective}</p><p className="mt-2 text-xs text-gray-400">{item.category} · Riesgo {item.risk_level} · Datos {item.data_sensitivity} · {item.responsible || 'Sin responsable'}</p></div><div className="text-center"><p className="text-3xl font-bold text-violet-700">{item.priority_score}</p><p className="text-xs text-gray-400">prioridad / 25</p></div>{actionButtons('usecase', item as unknown as FormData, item.title)}</div></article>)}</div></SectionPanel>}

      {tab === 'pilots' && <div className="space-y-5"><SectionPanel title="Prototipos y agentes" subtitle="Arquitectura, versión, costes, calidad y adopción de cada piloto." action={newButton('pilot', 'Nuevo piloto')}><div className="grid lg:grid-cols-2 gap-4">{pilots.map(item => <article key={item.id} className="rounded-2xl border border-gray-100 p-5"><div className="flex justify-between gap-3"><div><div className="flex gap-2 items-center">{statusBadge(item.status)}<span className="text-xs font-mono text-gray-400">v{item.version}</span></div><h3 className="mt-2 font-semibold text-gray-900">{item.name}</h3></div>{actionButtons('pilot', item as unknown as FormData, item.name)}</div><p className="mt-2 text-sm text-gray-600">{item.hypothesis}</p><div className="mt-4 grid grid-cols-4 gap-2 text-center"><MiniMetric label="Precisión" value={`${item.accuracy}%`} /><MiniMetric label="Satisfacción" value={`${item.satisfaction}/5`} /><MiniMetric label="Ejec./mes" value={item.monthly_runs} /><MiniMetric label="Coste/mes" value={`${item.monthly_cost} €`} /></div><div className="mt-3 flex gap-3 text-xs">{item.repository_url && <a className="text-blue-600 inline-flex items-center gap-1" href={item.repository_url} target="_blank" rel="noreferrer">Repositorio <ExternalLink size={11} /></a>}{item.demo_url && <a className="text-blue-600 inline-flex items-center gap-1" href={item.demo_url} target="_blank" rel="noreferrer">Demo <ExternalLink size={11} /></a>}</div></article>)}</div></SectionPanel><SectionPanel title="Indicadores de impacto" subtitle="Línea base, objetivo, medición actual y evidencia." action={newButton('kpi', 'Nuevo KPI')}><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-gray-400"><th className="pb-3">Indicador</th><th className="pb-3">Base</th><th className="pb-3">Objetivo</th><th className="pb-3">Actual</th><th className="pb-3">Medición</th><th /></tr></thead><tbody>{kpis.map(item => <tr key={item.id} className="border-t border-gray-100"><td className="py-3 font-medium text-gray-900">{item.name}</td><td>{item.baseline_value} {item.unit}</td><td>{item.target_value} {item.unit}</td><td className="font-semibold text-blue-700">{item.current_value} {item.unit}</td><td className="text-gray-500">{item.measurement_date ? new Date(item.measurement_date).toLocaleDateString('es-ES') : 'Sin medir'}</td><td>{actionButtons('kpi', item as unknown as FormData, item.name)}</td></tr>)}</tbody></table>{kpis.length === 0 && <Empty text="Añade los KPI antes de validar los pilotos." />}</div></SectionPanel></div>}

      {tab === 'integrations' && <SectionPanel title="Integraciones con sistemas internos" subtitle="ERP, CRM, correo, gestión documental y otros conectores sin almacenar secretos." action={newButton('integration', 'Nueva integración')}><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{integrations.map(item => <article key={item.id} className="rounded-2xl border border-gray-100 p-5"><div className="flex justify-between"><div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center"><Link2 size={18} /></div>{actionButtons('integration', item as unknown as FormData, item.system_name)}</div><h3 className="mt-3 font-semibold text-gray-900">{item.system_name}</h3><div className="mt-2 flex gap-2">{statusBadge(item.status)}<Badge variant="neutral">{item.environment}</Badge></div><p className="mt-3 text-sm text-gray-500">{item.integration_type} · {item.data_direction}</p><p className="mt-1 text-xs text-gray-400">Última prueba: {item.last_tested_at ? new Date(item.last_tested_at).toLocaleString('es-ES') : 'pendiente'}</p></article>)}{integrations.length === 0 && <Empty text="Registra aquí las conexiones con ERP, CRM, correo y documentos." />}</div></SectionPanel>}

      {tab === 'results' && <SectionPanel title="Resultados, evidencias y transferencia" subtitle="Entregables exigidos por la memoria y archivos de soporte." action={newButton('deliverable', 'Nuevo entregable')}><div className="space-y-3">{deliverables.map(item => <article key={item.id} className="rounded-2xl border border-gray-100 p-4 flex flex-wrap items-center gap-4"><div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{item.status === 'completed' ? <CheckCircle2 size={19} /> : <FileCheck2 size={19} />}</div><div className="flex-1 min-w-[230px]"><div className="flex flex-wrap gap-2 items-center"><span className="font-mono text-xs text-blue-600">{item.code}</span>{statusBadge(item.status)}<Badge variant="neutral">{item.deliverable_type}</Badge></div><h3 className="mt-1 font-semibold text-gray-900">{item.title}</h3><p className="text-xs text-gray-400">{item.phase} · vence {item.due_date ? new Date(item.due_date).toLocaleDateString('es-ES') : 'sin fecha'} · {item.owner || 'sin responsable'}</p></div>{item.file_url && <a href={item.file_url} target="_blank" rel="noreferrer" className="btn-secondary text-xs flex gap-1 items-center">Abrir evidencia <ExternalLink size={12} /></a>}{actionButtons('deliverable', item as unknown as FormData, item.title)}</article>)}</div></SectionPanel>}
    </>}

    <Modal open={Boolean(editKind)} onClose={() => setEditKind(null)} title={editKind ? editorTitle(editKind, Boolean(form.id)) : ''} size="lg"><div className="grid md:grid-cols-2 gap-4">{editKind && renderEditor(editKind, form, setValue, processes, useCases, pilots)}<div className="md:col-span-2 flex justify-end gap-2 pt-2"><button onClick={() => setEditKind(null)} className="btn-secondary">Cancelar</button><button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Guardando…' : 'Guardar'}</button></div></div></Modal>
    <ConfirmDialog open={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} title="Mover a la papelera" message={`¿Mover “${deleting?.name}” a la papelera? Podrás restaurarlo desde Administración.`} confirmLabel="Mover a papelera" danger />
  </div>;
}

function SectionPanel({ title, subtitle, action, children }: { title: string; subtitle: string; action?: React.ReactNode; children: React.ReactNode }) { return <section className="bg-white rounded-2xl border border-gray-100 p-5"><div className="flex flex-wrap items-start gap-3 mb-5"><div className="flex-1"><h2 className="font-semibold text-gray-900">{title}</h2><p className="text-sm text-gray-500 mt-1">{subtitle}</p></div>{action}</div>{children}</section>; }
function Metric({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) { const colors: Record<string, string> = { blue: 'bg-blue-50 text-blue-600', violet: 'bg-violet-50 text-violet-600', cyan: 'bg-cyan-50 text-cyan-600', orange: 'bg-orange-50 text-orange-600', emerald: 'bg-emerald-50 text-emerald-600', pink: 'bg-pink-50 text-pink-600' }; return <div className="bg-white rounded-2xl border border-gray-100 p-4"><div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors[color]}`}><Icon size={16} /></div><p className="mt-3 text-2xl font-bold text-gray-900">{value}</p><p className="text-xs text-gray-400">{label}</p></div>; }
function MiniMetric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-lg bg-gray-50 p-2"><p className="font-semibold text-sm text-gray-800">{value}</p><p className="text-[10px] text-gray-400">{label}</p></div>; }
function Principle({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) { return <div className="bg-white rounded-2xl border border-gray-100 p-5"><Icon size={20} className="text-blue-600" /><h3 className="mt-3 font-semibold text-sm text-gray-900">{title}</h3><p className="mt-1 text-xs leading-relaxed text-gray-500">{text}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="col-span-full py-12 text-center text-sm text-gray-400">{text}</div>; }
function editorTitle(kind: EditKind, editing: boolean) { const labels: Record<EditKind, [string, string]> = { process: ['Nuevo proceso', 'Editar proceso'], usecase: ['Nuevo caso de uso', 'Editar caso de uso'], work: ['Nueva actividad', 'Editar actividad'], pilot: ['Nuevo piloto', 'Editar piloto'], integration: ['Nueva integración', 'Editar integración'], kpi: ['Nuevo KPI', 'Editar KPI'], deliverable: ['Nuevo entregable', 'Editar entregable'] }; return labels[kind][editing ? 1 : 0]; }

function renderEditor(kind: EditKind, form: FormData, set: (key: string, value: string | number | boolean | null) => void, processes: AIProcess[], useCases: AIUseCase[], pilots: AIPilot[]) {
  const input = (key: string, type = 'text') => <input type={type} value={String(form[key] ?? '')} onChange={event => set(key, type === 'number' ? Number(event.target.value) : event.target.value || (type === 'date' ? null : ''))} className="input" />;
  const area = (key: string) => <textarea value={String(form[key] ?? '')} onChange={event => set(key, event.target.value)} className="input min-h-20" />;
  const select = (key: string, options: Array<[string, string]>) => <select value={String(form[key] ?? '')} onChange={event => set(key, event.target.value || null)} className="input">{options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>;
  const score = (key: string) => select(key, [['1', '1 - Bajo'], ['2', '2'], ['3', '3 - Medio'], ['4', '4'], ['5', '5 - Alto']]);
  if (kind === 'process') return <><Field label="Nombre">{input('name')}</Field><Field label="Departamento">{input('department')}</Field><Field label="Responsable">{input('owner')}</Field><Field label="Frecuencia">{input('frequency')}</Field><Field label="Descripción" wide>{area('description')}</Field><Field label="Problema actual" wide>{area('current_pain')}</Field><Field label="Volumen mensual">{input('monthly_volume', 'number')}</Field><Field label="Minutos por caso">{input('minutes_per_case', 'number')}</Field><Field label="Impacto">{score('impact_score')}</Field><Field label="Viabilidad">{score('viability_score')}</Field><Field label="Estado">{select('opportunity_status', [['discovered', 'Detectado'], ['selected', 'Seleccionado'], ['automated', 'Automatizado']])}</Field><Field label="Notas">{input('notes')}</Field></>;
  if (kind === 'usecase') return <><Field label="Código">{input('code')}</Field><Field label="Título">{input('title')}</Field><Field label="Proceso">{select('process_id', [['', 'Sin proceso'], ...processes.map(item => [item.id, item.name] as [string, string])])}</Field><Field label="Categoría">{select('category', [['assistant', 'Asistente'], ['document_assistant', 'Asistente documental'], ['chatbot', 'Chatbot'], ['rpa', 'RPA'], ['workflow_agent', 'Agente de flujo'], ['analytics', 'Analítica']])}</Field><Field label="Objetivo" wide>{area('objective')}</Field><Field label="Impacto">{score('impact_score')}</Field><Field label="Viabilidad">{score('viability_score')}</Field><Field label="Estado">{select('status', [['idea', 'Idea'], ['assessed', 'Evaluado'], ['approved', 'Aprobado'], ['pilot', 'En piloto'], ['validated', 'Validado'], ['transferred', 'Transferido'], ['rejected', 'Descartado']])}</Field><Field label="Responsable">{input('responsible')}</Field><Field label="Inicio">{input('start_date', 'date')}</Field><Field label="Fin">{input('end_date', 'date')}</Field><Field label="Riesgo">{select('risk_level', [['low', 'Bajo'], ['medium', 'Medio'], ['high', 'Alto'], ['critical', 'Crítico']])}</Field><Field label="Sensibilidad de datos">{select('data_sensitivity', [['public', 'Públicos'], ['internal', 'Internos'], ['confidential', 'Confidenciales'], ['personal', 'Personales']])}</Field><Field label="Revisión ética"><input type="checkbox" checked={Boolean(form.ethics_review)} onChange={event => set('ethics_review', event.target.checked)} className="h-5 w-5" /></Field><Field label="Notas">{input('notes')}</Field></>;
  if (kind === 'work') return <><Field label="Código">{input('code')}</Field><Field label="Actividad">{input('title')}</Field><Field label="Fase">{select('phase', [['Fase 1', 'Fase 1'], ['Fase 2', 'Fase 2'], ['Fase 3', 'Fase 3'], ['Fase 4', 'Fase 4']])}</Field><Field label="Duración (días)">{input('duration_days', 'number')}</Field><Field label="Subtareas" wide>{area('subtasks')}</Field><Field label="Inicio">{input('start_date', 'date')}</Field><Field label="Fin">{input('end_date', 'date')}</Field><Field label="Estado">{select('status', [['planned', 'Planificado'], ['in_progress', 'En curso'], ['completed', 'Completado'], ['blocked', 'Bloqueado']])}</Field><Field label="Progreso %">{input('progress', 'number')}</Field><Field label="Responsable">{input('owner')}</Field><Field label="Depende de">{input('depends_on')}</Field></>;
  if (kind === 'pilot') return <><Field label="Nombre">{input('name')}</Field><Field label="Caso IA">{select('use_case_id', [['', 'Sin caso'], ...useCases.map(item => [item.id, `${item.code} · ${item.title}`] as [string, string])])}</Field><Field label="Hipótesis" wide>{area('hypothesis')}</Field><Field label="Arquitectura" wide>{area('architecture')}</Field><Field label="Modelo">{input('model_name')}</Field><Field label="Herramientas">{input('tools')}</Field><Field label="Estado">{select('status', [['design', 'Diseño'], ['development', 'Desarrollo'], ['testing', 'Pruebas'], ['production', 'Producción'], ['paused', 'Pausado']])}</Field><Field label="Versión">{input('version')}</Field><Field label="Repositorio">{input('repository_url', 'url')}</Field><Field label="Demo">{input('demo_url', 'url')}</Field><Field label="Minutos antes">{input('baseline_minutes', 'number')}</Field><Field label="Minutos actuales">{input('current_minutes', 'number')}</Field><Field label="Precisión %">{input('accuracy', 'number')}</Field><Field label="Satisfacción / 5">{input('satisfaction', 'number')}</Field><Field label="Ejecuciones/mes">{input('monthly_runs', 'number')}</Field><Field label="Coste mensual €">{input('monthly_cost', 'number')}</Field><Field label="Incidencias">{input('incidents_count', 'number')}</Field><Field label="Última evaluación">{input('last_evaluation_at', 'date')}</Field><Field label="Notas" wide>{area('notes')}</Field></>;
  if (kind === 'integration') return <><Field label="Sistema">{input('system_name')}</Field><Field label="Piloto">{select('pilot_id', [['', 'Sin piloto'], ...pilots.map(item => [item.id, item.name] as [string, string])])}</Field><Field label="Tipo">{select('integration_type', [['api', 'API REST'], ['webhook', 'Webhook'], ['rpa', 'RPA'], ['email', 'Correo'], ['database', 'Base de datos'], ['file', 'Fichero']])}</Field><Field label="Dirección">{select('data_direction', [['inbound', 'Entrada'], ['outbound', 'Salida'], ['bidirectional', 'Bidireccional']])}</Field><Field label="Entorno">{select('environment', [['test', 'Pruebas'], ['staging', 'Preproducción'], ['production', 'Producción']])}</Field><Field label="Estado">{select('status', [['planned', 'Planificada'], ['in_progress', 'En curso'], ['active', 'Activa'], ['failed', 'Con errores'], ['paused', 'Pausada']])}</Field><Field label="Responsable">{input('owner')}</Field><Field label="Última prueba">{input('last_tested_at', 'date')}</Field><Field label="Notas" wide>{area('notes')}</Field></>;
  if (kind === 'kpi') return <><Field label="Indicador">{input('name')}</Field><Field label="Unidad">{input('unit')}</Field><Field label="Caso IA">{select('use_case_id', [['', 'Sin caso'], ...useCases.map(item => [item.id, `${item.code} · ${item.title}`] as [string, string])])}</Field><Field label="Piloto">{select('pilot_id', [['', 'Sin piloto'], ...pilots.map(item => [item.id, item.name] as [string, string])])}</Field><Field label="Línea base">{input('baseline_value', 'number')}</Field><Field label="Objetivo">{input('target_value', 'number')}</Field><Field label="Valor actual">{input('current_value', 'number')}</Field><Field label="Fecha de medición">{input('measurement_date', 'date')}</Field><Field label="URL de evidencia" wide>{input('evidence_url', 'url')}</Field><Field label="Notas" wide>{area('notes')}</Field></>;
  return <><Field label="Código">{input('code')}</Field><Field label="Título">{input('title')}</Field><Field label="Fase">{select('phase', [['Fase 1', 'Fase 1'], ['Fase 2', 'Fase 2'], ['Fase 3', 'Fase 3'], ['Fase 4', 'Fase 4']])}</Field><Field label="Tipo">{select('deliverable_type', [['document', 'Documento'], ['report', 'Informe'], ['prototype', 'Prototipo'], ['evaluation', 'Evaluación'], ['guide', 'Guía'], ['event', 'Jornada']])}</Field><Field label="Estado">{select('status', [['planned', 'Planificado'], ['in_progress', 'En curso'], ['completed', 'Completado'], ['blocked', 'Bloqueado']])}</Field><Field label="Vencimiento">{input('due_date', 'date')}</Field><Field label="Completado">{input('completed_at', 'date')}</Field><Field label="Responsable">{input('owner')}</Field><Field label="URL de evidencia" wide>{input('file_url', 'url')}</Field><Field label="Notas" wide>{area('notes')}</Field></>;
}
