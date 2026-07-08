export interface PlaybookStep {
  order: number;
  action:
    | 'send_email'
    | 'send_slack'
    | 'send_webhook'
    | 'update_finding'
    | 'create_incident'
    | 'add_note'
    | 'assign_finding'
    | 'trigger_scan'
    | 'push_alert';
  label?: string;
  params: Record<string, unknown>;
  continueOnError: boolean;
}

export interface PlaybookTrigger {
  eventType:
    | 'breach_detected'
    | 'risk_score_critical'
    | 'login_anomaly'
    | 'site_degraded'
    | 'finding_opened'
    | 'firewall_threat';
  conditions: Record<string, unknown>;
}

export interface Playbook {
  _id: string;
  name: string;
  description?: string;
  enabled: boolean;
  userId: string;
  workspaceId?: string | null;
  trigger: PlaybookTrigger;
  steps: PlaybookStep[];
  stepCount?: number;
  runCount: number;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'partial' | 'failed' | null;
  createdAt: string;
  updatedAt: string;
}

export interface StepResult {
  order: number;
  action: string;
  label?: string;
  status: 'success' | 'skipped' | 'failed';
  output?: string;
  error?: string;
  durationMs?: number;
  executedAt: string;
}

export interface PlaybookRun {
  _id: string;
  playbookId: string | { _id: string; name: string; trigger?: PlaybookTrigger };
  userId: string;
  triggerEventType: string;
  triggerPayload?: Record<string, unknown>;
  status: 'running' | 'success' | 'partial' | 'failed';
  stepResults: StepResult[];
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  relatedFindingId?: string | null;
  relatedIncidentId?: string | null;
  createdAt: string;
}

export interface IncidentTimelineEntry {
  action: string;
  from?: string;
  to?: string;
  note?: string;
  by: string | { _id: string; name: string; email: string };
  at: string;
}

export interface Incident {
  _id: string;
  title: string;
  description?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';
  userId: string;
  workspaceId?: string | null;
  assignedTo?: { _id: string; name: string; email: string } | null;
  findingIds: string[] | Array<{ _id: string; title: string; severity: string; status: string }>;
  findingCount?: number;
  triggerEventType?: string;
  category?: string;
  dueDate?: string;
  resolvedAt?: string;
  timeline: IncidentTimelineEntry[];
  playbookRunIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Integration {
  _id: string;
  userId: string;
  name: string;
  type: 'slack' | 'jira' | 'webhook';
  enabled: boolean;
  config: Record<string, unknown>;
  lastTestedAt?: string;
  lastTestStatus?: 'ok' | 'failed' | null;
  lastTestMessage?: string;
  createdAt: string;
}

export interface CreatePlaybookPayload {
  name: string;
  description?: string;
  enabled?: boolean;
  workspaceId?: string | null;
  trigger: PlaybookTrigger;
  steps: Array<Omit<PlaybookStep, 'continueOnError'> & { continueOnError?: boolean }>;
}

export interface CreateIncidentPayload {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description?: string;
  category?: string;
  workspaceId?: string | null;
  dueDate?: string;
}

export interface UpdateIncidentPayload {
  status?: string;
  severity?: string;
  assignedToEmail?: string;
  note?: string;
  dueDate?: string;
  title?: string;
  description?: string;
}

export interface CreateIntegrationPayload {
  name: string;
  type: 'slack' | 'jira' | 'webhook';
  config: Record<string, unknown>;
  workspaceId?: string | null;
}

export interface IncidentStats {
  open: number;
  investigating: number;
  contained: number;
  resolved: number;
  closed: number;
}
