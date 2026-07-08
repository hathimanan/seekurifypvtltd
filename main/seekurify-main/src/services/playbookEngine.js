import crypto from 'crypto';
import Playbook from '../models/Playbook.js';
import PlaybookRun from '../models/PlaybookRun.js';
import Integration from '../models/Integration.js';
import Finding from '../models/Finding.js';
import User from '../models/User.ts';
import Password, { decrypt as decryptPassword } from '../models/Password.js';
import { findOrCreateIncident } from './incidentCorrelator.js';
import { pushEvent } from '../realtime/socketHub.js';
import { sendPlaybookAlertEmail } from '../emailService.js';

const INTEGRATION_SECRET = process.env.INTEGRATION_SECRET || 'seekurify-integration-secret-key!';

function decryptConfig(encrypted) {
  try {
    const decipher = crypto.createDecipher('aes-256-cbc', INTEGRATION_SECRET);
    let dec = decipher.update(encrypted, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
  } catch {
    return encrypted;
  }
}

function interpolate(template, payload, context) {
  if (!template || typeof template !== 'string') return template;
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const parts = path.trim().split('.');
    let val;
    if (parts[0] === 'payload') {
      val = parts.slice(1).reduce((o, k) => o?.[k], payload);
    } else if (parts[0] === 'eventType') {
      val = context?.eventType;
    } else {
      val = parts.reduce((o, k) => o?.[k], payload);
    }
    return val != null ? String(val) : `{{${path}}}`;
  });
}

async function action_push_alert(params, payload, context) {
  const message = interpolate(params.message || 'Playbook alert fired', payload, context);
  pushEvent(String(context.userId), 'playbookAlert', { message, type: 'playbookAlert', ...payload });
  return { pushed: true };
}

async function action_add_note(params, payload, context) {
  if (!context.findingId) return { skipped: true, reason: 'no findingId in context' };
  const note = interpolate(params.noteTemplate || 'Automated note from playbook.', payload, context);
  await Finding.findByIdAndUpdate(context.findingId, {
    $push: {
      timeline: {
        action: 'note_added',
        note,
        by: context.userId,
        at: new Date(),
      },
    },
  });
  return { noted: true, findingId: context.findingId };
}

async function action_create_incident(params, payload, context) {
  const result = await findOrCreateIncident(context, payload, params);
  context.incidentId = String(result.incidentId);
  return { incidentId: context.incidentId, created: result.created };
}

async function action_update_finding(params, payload, context) {
  if (!context.findingId) return { skipped: true, reason: 'no findingId in context' };
  const update = {};
  const timelineEntry = { action: 'playbook_action', by: context.userId, at: new Date() };

  if (params.status) {
    update.status = params.status;
    timelineEntry.action = 'status_changed';
    timelineEntry.to = params.status;
  }
  if (params.severity) {
    update.severity = params.severity;
  }
  if (params.note) {
    timelineEntry.note = interpolate(params.note, payload, context);
  }

  await Finding.findByIdAndUpdate(context.findingId, {
    ...update,
    $push: { timeline: timelineEntry },
  });
  return { updated: true, findingId: context.findingId };
}

async function action_assign_finding(params, payload, context) {
  if (!context.findingId) return { skipped: true, reason: 'no findingId in context' };

  let targetUserId = null;
  const assignTo = params.assignTo;

  if (!assignTo || assignTo === 'owner') {
    targetUserId = context.userId;
  } else if (assignTo.includes('@')) {
    const user = await User.findOne({ email: assignTo.toLowerCase() }).select('_id').lean();
    if (user) targetUserId = user._id;
  } else {
    targetUserId = context.userId;
  }

  if (!targetUserId) return { skipped: true, reason: 'could not resolve assignee' };

  await Finding.findByIdAndUpdate(context.findingId, {
    assignedTo: targetUserId,
    $push: { timeline: { action: 'assigned', to: String(targetUserId), by: context.userId, at: new Date() } },
  });
  return { assigned: true, assignedTo: String(targetUserId) };
}

async function action_send_email(params, payload, context) {
  let toEmail;
  if (!params.to || params.to === 'owner') {
    const user = await User.findById(context.userId).select('email').lean();
    toEmail = user?.email;
  } else if (params.to === 'assignee' && context.findingId) {
    const finding = await Finding.findById(context.findingId).populate('assignedTo', 'email').lean();
    toEmail = finding?.assignedTo?.email;
  } else if (params.to === 'specific' || params.to?.startsWith('specific:')) {
    toEmail = params.specificEmail || params.to.replace('specific:', '') || null;
  } else {
    toEmail = params.to;
  }

  toEmail = toEmail?.trim();
  if (!toEmail) return { skipped: true, reason: 'could not resolve recipient email' };

  const subject = interpolate(params.subject || 'Seekurify Security Alert', payload, context);
  const body = interpolate(params.body || params.bodyTemplate || 'A security event was detected.', payload, context);

  await sendPlaybookAlertEmail(toEmail, { subject, body });
  return { sent: true, to: toEmail };
}

async function action_send_slack(params, payload, context) {
  if (!params.integrationId) return { skipped: true, reason: 'no integrationId provided' };

  const integration = await Integration.findOne({ _id: params.integrationId, userId: context.userId, type: 'slack' }).lean();
  if (!integration) return { skipped: true, reason: 'Slack integration not found' };

  const rawUrl = integration.config?.webhookUrl;
  const webhookUrl = rawUrl?.startsWith('enc:') ? decryptConfig(rawUrl.slice(4)) : rawUrl;
  if (!webhookUrl) return { skipped: true, reason: 'no webhookUrl in integration config' };

  const messageTemplate = params.messageTemplate || '*Seekurify Alert* — `{{eventType}}` event detected.';
  const text = interpolate(messageTemplate, payload, context);

  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!resp.ok) throw new Error(`Slack webhook returned ${resp.status}`);
  return { sent: true, status: resp.status };
}

async function action_send_webhook(params, payload, context) {
  let url = params.url;
  let headers = params.headers || {};
  let bodyTemplate = params.bodyTemplate || null;

  if (params.integrationId) {
    const integration = await Integration.findOne({ _id: params.integrationId, userId: context.userId, type: 'webhook' }).lean();
    if (!integration) return { skipped: true, reason: 'webhook integration not found' };
    url = integration.config?.url || url;
    headers = { ...(integration.config?.headers || {}), ...headers };
    bodyTemplate = bodyTemplate || integration.config?.bodyTemplate;
  }

  if (!url) return { skipped: true, reason: 'no URL configured' };

  const body = bodyTemplate ? interpolate(bodyTemplate, payload, context) : JSON.stringify({ event: context.eventType, payload, context: { userId: context.userId } });

  const resp = await fetch(url, {
    method: params.method || 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

  if (!resp.ok) throw new Error(`Webhook returned ${resp.status}`);
  return { sent: true, status: resp.status };
}

async function action_quarantine_credential(params, payload, context) {
  const passwordId = params.passwordId || payload.passwordId;
  if (!passwordId) return { skipped: true, reason: 'no passwordId in params or payload' };

  const reason = interpolate(
    params.reason || 'Quarantined automatically by breach_detected playbook',
    payload, context
  );

  const entry = await Password.findById(passwordId).lean();
  if (!entry) return { skipped: true, reason: 'credential not found' };

  await Password.findByIdAndUpdate(passwordId, {
    $set: { quarantined: true, quarantineReason: reason, quarantinedAt: new Date() },
  });

  // Quarantine reuse matches (same decrypted password, same user)
  const plain = decryptPassword(entry.password);
  let reuseCount = 0;
  if (plain) {
    const others = await Password.find({ userId: entry.userId, _id: { $ne: entry._id }, quarantined: { $ne: true } }).lean();
    const reuseIds = others.filter(p => decryptPassword(p.password) === plain).map(p => p._id);
    if (reuseIds.length > 0) {
      await Password.updateMany({ _id: { $in: reuseIds } }, {
        $set: {
          quarantined: true,
          quarantineReason: `Reused password — linked credential for "${entry.website}" was quarantined by playbook`,
          quarantinedAt: new Date(),
        },
      });
      reuseCount = reuseIds.length;
    }
  }

  return { quarantined: true, passwordId, reuseCount };
}

async function action_trigger_scan(params, payload, context) {
  const scanType = params.scanType;
  if (!scanType) return { skipped: true, reason: 'no scanType provided' };

  if (scanType === 'siteaudit') {
    const { runMiniAudit } = await import('../agent/watchAgent.js');
    const targetUrl = params.targetUrl || payload.url;
    if (!targetUrl) return { skipped: true, reason: 'no targetUrl for siteaudit' };
    const result = await runMiniAudit(targetUrl);
    return { triggered: true, scanType, score: result?.score };
  }

  return { triggered: false, reason: `scan type '${scanType}' not available as automated action` };
}

const ACTION_MAP = {
  push_alert:            action_push_alert,
  add_note:              action_add_note,
  create_incident:       action_create_incident,
  update_finding:        action_update_finding,
  assign_finding:        action_assign_finding,
  send_email:            action_send_email,
  send_slack:            action_send_slack,
  send_webhook:          action_send_webhook,
  trigger_scan:          action_trigger_scan,
  quarantine_credential: action_quarantine_credential,
};

export async function executePlaybook(playbook, eventPayload, context) {
  const run = await PlaybookRun.create({
    playbookId:       playbook._id,
    userId:           context.userId,
    workspaceId:      context.workspaceId || null,
    triggerEventType: context.eventType || 'manual',
    triggerPayload:   eventPayload,
    status:           'running',
    relatedFindingId: context.findingId || null,
    startedAt:        new Date(),
  });

  // Return the runId immediately so callers can surface it, then execute steps async
  const runId = run._id;

  // Run steps async (non-blocking for the caller)
  _runSteps(run, playbook, eventPayload, context).catch(err =>
    console.error('[PlaybookEngine] step execution error for run', runId, err.message)
  );

  return runId;
}

async function _runSteps(run, playbook, eventPayload, context) {
  const sortedSteps = [...(playbook.steps || [])].sort((a, b) => a.order - b.order);
  let allSucceeded = true;
  let anyFailed = false;
  let stoppedEarly = false;

  for (const step of sortedSteps) {
    const stepStart = Date.now();
    const stepResult = {
      order:      step.order,
      action:     step.action,
      label:      step.label || step.action,
      executedAt: new Date(),
    };

    try {
      const handler = ACTION_MAP[step.action];
      if (!handler) throw new Error(`Unknown action: ${step.action}`);

      const output = await handler(step.params || {}, eventPayload, context);
      stepResult.status = 'success';
      stepResult.output = JSON.stringify(output).slice(0, 2000);
    } catch (err) {
      stepResult.status = 'failed';
      stepResult.error = err.message?.slice(0, 2000) || 'Unknown error';
      anyFailed = true;
      allSucceeded = false;

      if (!step.continueOnError) {
        stoppedEarly = true;
        stepResult.durationMs = Date.now() - stepStart;
        await PlaybookRun.findByIdAndUpdate(run._id, { $push: { stepResults: stepResult } });
        break;
      }
    }

    stepResult.durationMs = Date.now() - stepStart;
    await PlaybookRun.findByIdAndUpdate(run._id, { $push: { stepResults: stepResult } });
  }

  const finalStatus = allSucceeded ? 'success' : stoppedEarly ? 'failed' : 'partial';
  const completedAt = new Date();

  await PlaybookRun.findByIdAndUpdate(run._id, {
    status:      finalStatus,
    completedAt,
    durationMs:  completedAt - run.startedAt,
    ...(context.incidentId ? { relatedIncidentId: context.incidentId } : {}),
  });

  await Playbook.findByIdAndUpdate(playbook._id, {
    $inc:  { runCount: 1 },
    lastRunAt:     completedAt,
    lastRunStatus: finalStatus,
  });

  return run._id;
}
