import Playbook from '../models/Playbook.js';
import { executePlaybook } from './playbookEngine.js';

export async function routeEvent(eventType, payload, context) {
  try {
    const query = {
      enabled: true,
      userId: context.userId,
      'trigger.eventType': eventType,
    };
    if (context.workspaceId) query.workspaceId = context.workspaceId;

    const playbooks = await Playbook.find(query).lean();
    if (!playbooks.length) return;

    for (const playbook of playbooks) {
      if (matchesConditions(playbook.trigger.conditions, eventType, payload)) {
        executePlaybook(playbook, payload, { ...context, eventType }).catch(err =>
          console.error(`[TriggerRouter] Playbook ${playbook._id} error:`, err.message)
        );
      }
    }
  } catch (err) {
    console.error('[TriggerRouter] routeEvent error:', err.message);
  }
}

function matchesConditions(conditions, eventType, payload) {
  if (!conditions || Object.keys(conditions).length === 0) {
    // Safety default for finding_opened: only critical/high
    if (eventType === 'finding_opened') {
      return ['critical', 'high'].includes(payload.severity);
    }
    return true;
  }

  switch (eventType) {
    case 'breach_detected': {
      if (conditions.minBreachCount != null && (payload.breachCount ?? 0) < conditions.minBreachCount) return false;
      return true;
    }
    case 'risk_score_critical': {
      const threshold = conditions.scoreThreshold ?? 80;
      if ((payload.score ?? 0) < threshold) return false;
      return true;
    }
    case 'login_anomaly': {
      if (conditions.types?.length && !conditions.types.includes(payload.type)) return false;
      return true;
    }
    case 'site_degraded': {
      if (conditions.minScoreDrop != null && Math.abs(payload.scoreDelta ?? 0) < conditions.minScoreDrop) return false;
      if (conditions.severities?.length && !conditions.severities.includes(payload.severity)) return false;
      return true;
    }
    case 'finding_opened': {
      const allowedSeverities = conditions.severities?.length ? conditions.severities : ['critical', 'high'];
      if (!allowedSeverities.includes(payload.severity)) return false;
      if (conditions.scanTypes?.length && !conditions.scanTypes.includes(payload.scanType)) return false;
      return true;
    }
    case 'firewall_threat': {
      const allowedSeverities = conditions.severities?.length ? conditions.severities : ['critical', 'high'];
      if (!allowedSeverities.includes(payload.severity)) return false;
      if (conditions.threatTypes?.length && !conditions.threatTypes.includes(payload.threatType)) return false;
      return true;
    }
    case 'malware_detected': {
      // conditions.minScore: minimum overall risk score (0-100)
      if (conditions.minScore != null && (payload.score ?? 0) < conditions.minScore) return false;
      // conditions.riskLevels: ['critical','high','medium']
      if (conditions.riskLevels?.length && !conditions.riskLevels.includes(payload.risk)) return false;
      // conditions.requireVtDetection: only trigger if VT also flagged it
      if (conditions.requireVtDetection && !(payload.vtDetections > 0)) return false;
      // conditions.behaviorCategories: trigger only if specific behavioral categories present
      if (conditions.behaviorCategories?.length) {
        const has = conditions.behaviorCategories.some(c => (payload.behaviorCategories ?? []).includes(c));
        if (!has) return false;
      }
      return true;
    }
    default:
      return true;
  }
}
