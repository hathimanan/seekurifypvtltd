import Incident from '../models/Incident.js';

export async function findOrCreateIncident(context, payload, params) {
  const category = params.category || payload.category || 'general';
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const existing = await Incident.findOne({
    userId: context.userId,
    category,
    status: { $in: ['open', 'investigating'] },
    createdAt: { $gte: windowStart },
  }).sort({ createdAt: -1 });

  if (existing) {
    const update = {};
    if (context.findingId) {
      update.$addToSet = { findingIds: context.findingId };
      update.$push = {
        timeline: {
          action: 'finding_added',
          to: String(context.findingId),
          by: context.userId,
          at: new Date(),
        },
      };
    }
    if (Object.keys(update).length) {
      await Incident.findByIdAndUpdate(existing._id, update);
    }
    return { incidentId: existing._id, created: false };
  }

  const title = interpolate(params.titleTemplate || 'Incident: {{eventType}}', payload, context);
  const severity = params.severity || deriveSeverity(payload, context.eventType);

  const incident = await Incident.create({
    title,
    severity,
    description: params.description || '',
    userId: context.userId,
    workspaceId: context.workspaceId || null,
    category,
    triggerEventType: context.eventType,
    triggerPayload: payload,
    findingIds: context.findingId ? [context.findingId] : [],
    timeline: [{ action: 'created', to: 'open', by: context.userId, at: new Date() }],
  });

  return { incidentId: incident._id, created: true };
}

function deriveSeverity(payload, eventType) {
  if (eventType === 'risk_score_critical') {
    if ((payload.score ?? 0) >= 90) return 'critical';
    return 'high';
  }
  if (eventType === 'breach_detected') {
    if ((payload.breachCount ?? 0) >= 100) return 'high';
    return 'medium';
  }
  if (eventType === 'site_degraded') {
    const drop = Math.abs(payload.scoreDelta ?? 0);
    if (drop >= 20) return 'critical';
    if (drop >= 10) return 'high';
    return 'medium';
  }
  if (eventType === 'login_anomaly') {
    if (payload.type === 'bruteforce') return 'high';
    return 'medium';
  }
  if (eventType === 'finding_opened') {
    return payload.severity || 'medium';
  }
  return 'medium';
}

function interpolate(template, payload, context) {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
    const parts = path.trim().split('.');
    let val = parts[0] === 'payload' ? payload : (parts[0] === 'eventType' ? context?.eventType : undefined);
    if (parts[0] === 'payload') {
      val = parts.slice(1).reduce((o, k) => o?.[k], payload);
    }
    return val != null ? String(val) : `{{${path}}}`;
  });
}
