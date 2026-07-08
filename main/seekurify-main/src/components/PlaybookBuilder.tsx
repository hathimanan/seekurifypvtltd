import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, ChevronUp, ChevronDown, Loader2, X } from 'lucide-react';
import { apiService } from '../services/api';
import type { Playbook, PlaybookStep, Integration } from '../types/soar';

const EVENT_TYPE_LABELS: Record<string, string> = {
  breach_detected:    'Credential Breach Detected',
  risk_score_critical:'Risk Score Critical (>=80)',
  login_anomaly:      'Login Anomaly',
  site_degraded:      'Site Security Degraded',
  finding_opened:     'Finding Opened (critical/high)',
};

const ACTION_LABELS: Record<string, string> = {
  send_email:      'Send Email',
  send_slack:      'Send Slack Message',
  send_webhook:    'Send Webhook',
  update_finding:  'Update Finding Status',
  create_incident: 'Create / Link Incident',
  add_note:        'Add Note to Finding',
  assign_finding:  'Assign Finding',
  trigger_scan:    'Trigger Scan',
  push_alert:      'Push Real-Time Alert',
};

const FINDING_STATUSES = ['open', 'acknowledged', 'in_progress', 'to_be_retested', 'resolved', 'ignored'];
const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const SCAN_TYPES = ['siteaudit'];

function makeStep(order: number): PlaybookStep {
  return { order, action: 'push_alert', params: { message: 'Alert: {{eventType}} detected.' }, label: 'New Step', continueOnError: true };
}

interface Props {
  playbook?: Playbook;
  onSave: (p: Playbook) => void;
  onClose: () => void;
}

export default function PlaybookBuilder({ playbook, onSave, onClose }: Props) {
  const [name, setName] = useState(playbook?.name || '');
  const [description, setDescription] = useState(playbook?.description || '');
  const [eventType, setEventType] = useState(playbook?.trigger?.eventType || 'breach_detected');
  const [conditions, setConditions] = useState<Record<string, unknown>>(playbook?.trigger?.conditions || {});
  const [steps, setSteps] = useState<PlaybookStep[]>(playbook?.steps?.length ? [...playbook.steps].sort((a, b) => a.order - b.order) : [makeStep(0)]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [slackIntegrations, setSlackIntegrations] = useState<Integration[]>([]);
  const [webhookIntegrations, setWebhookIntegrations] = useState<Integration[]>([]);

  useEffect(() => {
    apiService.getIntegrations('slack').then(d => setSlackIntegrations(d.integrations || [])).catch(() => {});
    apiService.getIntegrations('webhook').then(d => setWebhookIntegrations(d.integrations || [])).catch(() => {});
  }, []);

  const addStep = () => setSteps(s => [...s, makeStep(s.length)]);
  const removeStep = (idx: number) => setSteps(s => s.filter((_, i) => i !== idx).map((step, i) => ({ ...step, order: i })));
  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setSteps(s => {
      const a = [...s];
      [a[idx - 1], a[idx]] = [a[idx], a[idx - 1]];
      return a.map((step, i) => ({ ...step, order: i }));
    });
  };
  const moveDown = (idx: number) => {
    setSteps(s => {
      if (idx >= s.length - 1) return s;
      const a = [...s];
      [a[idx], a[idx + 1]] = [a[idx + 1], a[idx]];
      return a.map((step, i) => ({ ...step, order: i }));
    });
  };
  const updateStep = (idx: number, patch: Partial<PlaybookStep>) =>
    setSteps(s => s.map((step, i) => i === idx ? { ...step, ...patch } : step));
  const updateStepParam = (idx: number, key: string, value: unknown) =>
    setSteps(s => s.map((step, i) => i === idx ? { ...step, params: { ...step.params, [key]: value } } : step));
  const setCondition = (key: string, value: unknown) => setConditions(c => ({ ...c, [key]: value }));

  const handleSave = async () => {
    if (!name.trim()) { setError('Playbook name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: name.trim(),
        description,
        enabled: playbook?.enabled !== false,
        trigger: { eventType, conditions },
        steps,
      };
      const result = playbook?._id
        ? await apiService.updatePlaybook(playbook._id, payload)
        : await apiService.createPlaybook(payload);
      onSave(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="bg-gray-900 border-l border-gray-700 w-full max-w-2xl flex flex-col h-full overflow-hidden"
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25 }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-white font-bold text-lg">{playbook ? 'Edit Playbook' : 'New Playbook'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && <div className="bg-red-900/30 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}

          {/* Name + Description */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Playbook Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Breach Auto-Response"
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Description (optional)</label>
              <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this playbook do?"
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
            </div>
          </div>

          {/* Trigger */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-4">
            <h3 className="text-white font-semibold text-sm">Trigger</h3>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Event Type</label>
              <select value={eventType} onChange={e => { setEventType(e.target.value as typeof eventType); setConditions({}); }}
                className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                {Object.entries(EVENT_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            {/* Dynamic condition fields */}
            {eventType === 'breach_detected' && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Min breach count (leave empty for any)</label>
                <input type="number" min={1} value={(conditions.minBreachCount as number) ?? ''}
                  onChange={e => setCondition('minBreachCount', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="e.g. 1" className="w-32 bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
              </div>
            )}
            {eventType === 'risk_score_critical' && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Score threshold (default 80)</label>
                <input type="number" min={1} max={100} value={(conditions.scoreThreshold as number) ?? 80}
                  onChange={e => setCondition('scoreThreshold', Number(e.target.value))}
                  className="w-32 bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
              </div>
            )}
            {eventType === 'login_anomaly' && (
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Anomaly types (leave unchecked for all)</label>
                <div className="flex gap-4">
                  {['bruteforce', 'anomalous_session'].map(t => (
                    <label key={t} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                      <input type="checkbox" checked={((conditions.types as string[]) || []).includes(t)}
                        onChange={e => {
                          const cur = (conditions.types as string[]) || [];
                          setCondition('types', e.target.checked ? [...cur, t] : cur.filter(x => x !== t));
                        }} className="rounded" />
                      {t === 'bruteforce' ? 'Brute Force' : 'New IP/Device'}
                    </label>
                  ))}
                </div>
              </div>
            )}
            {eventType === 'site_degraded' && (
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Min score drop (leave empty for any)</label>
                <input type="number" min={1} value={(conditions.minScoreDrop as number) ?? ''}
                  onChange={e => setCondition('minScoreDrop', e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="e.g. 10" className="w-32 bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
              </div>
            )}
            {eventType === 'finding_opened' && (
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Severities (default: critical + high)</label>
                <div className="flex gap-3">
                  {SEVERITIES.map(s => (
                    <label key={s} className="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer">
                      <input type="checkbox" checked={((conditions.severities as string[]) || ['critical', 'high']).includes(s)}
                        onChange={e => {
                          const cur = (conditions.severities as string[]) || ['critical', 'high'];
                          setCondition('severities', e.target.checked ? [...cur, s] : cur.filter(x => x !== s));
                        }} className="rounded" />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm">Response Steps</h3>
              <button onClick={addStep} className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Step
              </button>
            </div>

            {steps.map((step, idx) => (
              <div key={idx} className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                  <input value={step.label || ''} onChange={e => updateStep(idx, { label: e.target.value })}
                    placeholder="Step label" className="flex-1 bg-gray-700 border border-gray-600 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-indigo-500" />
                  <div className="flex gap-1">
                    <button onClick={() => moveUp(idx)} disabled={idx === 0} className="p-1 text-gray-500 hover:text-white disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => moveDown(idx)} disabled={idx === steps.length - 1} className="p-1 text-gray-500 hover:text-white disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                    <button onClick={() => removeStep(idx)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Action</label>
                  <select value={step.action} onChange={e => updateStep(idx, { action: e.target.value as any, params: {} })}
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                    {Object.entries(ACTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>

                {/* Action-specific param fields */}
                <StepParamFields step={step} idx={idx} updateParam={updateStepParam} slackIntegrations={slackIntegrations} webhookIntegrations={webhookIntegrations} />

                <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={step.continueOnError} onChange={e => updateStep(idx, { continueOnError: e.target.checked })} className="rounded" />
                  Continue on error (don't abort playbook if this step fails)
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 flex gap-3">
          <button onClick={handleSave} disabled={saving || !name.trim()}
            className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:cursor-not-allowed text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {playbook ? 'Save Changes' : 'Create Playbook'}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm transition-colors">Cancel</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function StepParamFields({ step, idx, updateParam, slackIntegrations, webhookIntegrations }: {
  step: PlaybookStep; idx: number;
  updateParam: (idx: number, key: string, value: unknown) => void;
  slackIntegrations: Integration[];
  webhookIntegrations: Integration[];
}) {
  const p = step.params as Record<string, string>;
  const up = (k: string, v: string) => updateParam(idx, k, v);

  const TextArea = ({ label, k, placeholder }: { label: string; k: string; placeholder?: string }) => (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <textarea value={p[k] || ''} onChange={e => up(k, e.target.value)} rows={2} placeholder={placeholder}
        className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-500 resize-none" />
    </div>
  );
  const Field = ({ label, k, placeholder, type = 'text' }: { label: string; k: string; placeholder?: string; type?: string }) => (
    <div>
      <label className="text-xs text-gray-400 mb-1 block">{label}</label>
      <input type={type} value={p[k] || ''} onChange={e => up(k, e.target.value)} placeholder={placeholder}
        className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500" />
    </div>
  );

  switch (step.action) {
    case 'push_alert':
      return <TextArea label="Message" k="message" placeholder="Alert: {{eventType}} on {{payload.website}}" />;

    case 'add_note':
      return <TextArea label="Note template" k="noteTemplate" placeholder="Automated note: {{eventType}} triggered playbook." />;

    case 'send_email':
      return (
        <>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Send to</label>
            <select value={p.to || 'owner'} onChange={e => up('to', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500">
              <option value="owner">Owner (account creator)</option>
              <option value="assignee">Assigned analyst</option>
              <option value="specific">Specific email…</option>
            </select>
          </div>
          {p.to === 'specific' && <Field label="Email address" k="specificEmail" placeholder="analyst@company.com" type="email" />}
          <Field label="Subject" k="subject" placeholder="BREACH: {{payload.website}} credentials compromised" />
          <TextArea label="Body" k="body" placeholder="Your password for {{payload.website}} was found in {{payload.breachCount}} breaches. Change it immediately." />
        </>
      );

    case 'send_slack': {
      return (
        <>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Slack Integration</label>
            <select value={p.integrationId || ''} onChange={e => up('integrationId', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500">
              <option value="">Select a Slack integration…</option>
              {slackIntegrations.map(i => <option key={i._id} value={i._id}>{i.name}</option>)}
            </select>
            {slackIntegrations.length === 0 && <p className="text-xs text-yellow-500 mt-1">No Slack integrations configured. Add one in the Integrations tab.</p>}
          </div>
          <TextArea label="Message template" k="messageTemplate" placeholder="*Seekurify Alert* — breach detected on `{{payload.website}}`" />
        </>
      );
    }

    case 'send_webhook': {
      return (
        <>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Webhook Integration (optional)</label>
            <select value={p.integrationId || ''} onChange={e => up('integrationId', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500">
              <option value="">Use manual URL below</option>
              {webhookIntegrations.map(i => <option key={i._id} value={i._id}>{i.name}</option>)}
            </select>
          </div>
          {!p.integrationId && <Field label="URL" k="url" placeholder="https://your-endpoint.example.com/hook" type="url" />}
          <TextArea label="Body template (JSON, optional)" k="bodyTemplate" placeholder={'{"event":"{{eventType}}","site":"{{payload.website}}"}'} />
        </>
      );
    }

    case 'update_finding':
      return (
        <>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Set status (optional)</label>
            <select value={p.status || ''} onChange={e => up('status', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500">
              <option value="">Don't change</option>
              {['open','acknowledged','in_progress','to_be_retested','resolved','ignored'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <TextArea label="Add note (optional)" k="note" placeholder="Auto-triaged by SOAR playbook." />
        </>
      );

    case 'create_incident':
      return (
        <>
          <Field label="Title template" k="titleTemplate" placeholder="Breach: {{payload.website}}" />
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Severity (optional, auto-derived if blank)</label>
            <select value={p.severity || ''} onChange={e => up('severity', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500">
              <option value="">Auto-derive from event</option>
              {['critical','high','medium','low'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Field label="Category" k="category" placeholder="credential_breach" />
        </>
      );

    case 'assign_finding':
      return <Field label="Assign to (email or 'owner')" k="assignTo" placeholder="analyst@company.com" />;

    case 'trigger_scan':
      return (
        <>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Scan type</label>
            <select value={p.scanType || 'siteaudit'} onChange={e => up('scanType', e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500">
              {SCAN_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Field label="Target URL (optional, uses event URL if blank)" k="targetUrl" placeholder="https://example.com" type="url" />
        </>
      );

    default:
      return null;
  }
}
