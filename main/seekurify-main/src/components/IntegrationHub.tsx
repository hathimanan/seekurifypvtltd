import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit2, CheckCircle, XCircle, Loader2, Plug, Globe, Settings } from 'lucide-react';
import { apiService } from '../services/api';
import type { Integration, CreateIntegrationPayload } from '../types/soar';

const TYPE_LABELS: Record<string, string> = { slack: 'Slack', jira: 'Jira', webhook: 'Webhook' };
const TYPE_COLORS: Record<string, string> = {
  slack: 'bg-green-500/20 text-green-300 border-green-500/30',
  jira: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  webhook: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
};

const EMPTY_FORM: CreateIntegrationPayload = { name: '', type: 'slack', config: {} };

export default function IntegrationHub() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateIntegrationPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiService.getIntegrations();
      setIntegrations(data.integrations || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); };
  const openEdit = (i: Integration) => {
    setForm({ name: i.name, type: i.type, config: { ...i.config } });
    setEditingId(i._id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        await apiService.updateIntegration(editingId, form);
      } else {
        await apiService.createIntegration(form);
      }
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await apiService.deleteIntegration(id);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const result = await apiService.testIntegration(id);
      setTestResults(prev => ({ ...prev, [id]: result }));
      await load();
    } catch (e: any) {
      setTestResults(prev => ({ ...prev, [id]: { ok: false, message: e.message } }));
    } finally {
      setTestingId(null);
    }
  };

  const setConfig = (key: string, value: string) => setForm(f => ({ ...f, config: { ...f.config, [key]: value } }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Integrations</h2>
          <p className="text-sm text-gray-400 mt-1">Connect Slack, Jira, or custom webhooks for playbook actions</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Add Integration
        </button>
      </div>

      {error && <div className="bg-red-900/30 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 text-indigo-400 animate-spin" /></div>
      ) : integrations.length === 0 ? (
        <div className="text-center py-16 border border-gray-700 rounded-xl">
          <Plug className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No integrations yet</p>
          <p className="text-gray-500 text-sm mt-1">Add Slack, Jira, or webhook connectors to use in playbooks</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {integrations.map(i => {
            const testResult = testResults[i._id];
            const statusDisplay = testResult ?? (i.lastTestStatus ? { ok: i.lastTestStatus === 'ok', message: i.lastTestMessage || '' } : null);
            return (
              <motion.div key={i._id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800 border border-gray-700 rounded-xl p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${TYPE_COLORS[i.type]}`}>{TYPE_LABELS[i.type]}</span>
                      {!i.enabled && <span className="text-xs text-gray-500">Disabled</span>}
                    </div>
                    <p className="text-white font-semibold mt-1 text-sm">{i.name}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(i)} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(i._id)} disabled={deletingId === i._id} className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-gray-700 rounded transition-colors">
                      {deletingId === i._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {statusDisplay && (
                  <div className={`flex items-center gap-1.5 text-xs ${statusDisplay.ok ? 'text-green-400' : 'text-red-400'}`}>
                    {statusDisplay.ok ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    <span className="truncate">{statusDisplay.message || (statusDisplay.ok ? 'Connected' : 'Failed')}</span>
                  </div>
                )}
                {i.lastTestedAt && !testResult && (
                  <p className="text-xs text-gray-500">Last tested: {new Date(i.lastTestedAt).toLocaleDateString()}</p>
                )}

                <button onClick={() => handleTest(i._id)} disabled={testingId === i._id}
                  className="mt-auto w-full text-xs py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-1.5">
                  {testingId === i._id ? <><Loader2 className="w-3 h-3 animate-spin" /> Testing...</> : 'Test Connection'}
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
              <h3 className="text-white font-bold text-lg mb-5">{editingId ? 'Edit Integration' : 'Add Integration'}</h3>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Name</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="My Slack Channel" className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any, config: {} }))}
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                    <option value="slack">Slack Incoming Webhook</option>
                    <option value="jira">Jira Cloud</option>
                    <option value="webhook">Custom Webhook</option>
                  </select>
                </div>

                {form.type === 'slack' && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Slack Webhook URL</label>
                    <input value={(form.config.webhookUrl as string) || ''} onChange={e => setConfig('webhookUrl', e.target.value)}
                      placeholder="https://hooks.slack.com/services/..." type="url"
                      className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                  </div>
                )}

                {form.type === 'jira' && (
                  <>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Jira Host</label>
                      <input value={(form.config.host as string) || ''} onChange={e => setConfig('host', e.target.value)}
                        placeholder="https://yourorg.atlassian.net"
                        className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Email</label>
                      <input value={(form.config.email as string) || ''} onChange={e => setConfig('email', e.target.value)}
                        placeholder="security@company.com" type="email"
                        className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">API Token</label>
                      <input value={(form.config.apiToken as string) || ''} onChange={e => setConfig('apiToken', e.target.value)}
                        placeholder="ATATT3..." type="password"
                        className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Project Key</label>
                        <input value={(form.config.projectKey as string) || ''} onChange={e => setConfig('projectKey', e.target.value)}
                          placeholder="SEC"
                          className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Issue Type</label>
                        <input value={(form.config.issueType as string) || 'Bug'} onChange={e => setConfig('issueType', e.target.value)}
                          placeholder="Bug"
                          className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                      </div>
                    </div>
                  </>
                )}

                {form.type === 'webhook' && (
                  <>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Webhook URL</label>
                      <input value={(form.config.url as string) || ''} onChange={e => setConfig('url', e.target.value)}
                        placeholder="https://your-webhook.example.com/hook" type="url"
                        className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">HTTP Method</label>
                      <select value={(form.config.method as string) || 'POST'} onChange={e => setConfig('method', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Body Template (optional, JSON)</label>
                      <textarea value={(form.config.bodyTemplate as string) || ''} onChange={e => setConfig('bodyTemplate', e.target.value)}
                        rows={3} placeholder={'{"event":"{{eventType}}","message":"{{payload.website}}"}'}
                        className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-indigo-500 resize-none" />
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={handleSave} disabled={saving || !form.name.trim()}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingId ? 'Save Changes' : 'Add Integration'}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm transition-colors">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
