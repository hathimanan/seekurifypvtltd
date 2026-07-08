import crypto from 'crypto';
import axios from 'axios';
import DeviceFingerprint from '../models/DeviceFingerprint.js';
import UserLoginBaseline from '../models/UserLoginBaseline.js';

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function resolveGeo(ip) {
  if (
    !ip ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.') ||
    ip.startsWith('::ffff:127.')
  ) {
    return null;
  }
  try {
    const { data } = await axios.get(`https://ipinfo.io/${ip}/json`, { timeout: 3000 });
    const [lat, lon] = (data.loc || '').split(',').map(Number);
    return {
      city:    data.city    || '',
      region:  data.region  || '',
      country: data.country || '',
      lat:     isNaN(lat)   ? null : lat,
      lon:     isNaN(lon)   ? null : lon,
    };
  } catch {
    return null;
  }
}

function parseDeviceLabel(ua) {
  if (!ua) return 'Unknown Device';
  let browser = 'Browser';
  let os = 'Unknown OS';
  if (ua.includes('Edg'))                                  browser = 'Edge';
  else if (ua.includes('Chrome'))                          browser = 'Chrome';
  else if (ua.includes('Firefox'))                         browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  if (ua.includes('iPhone') || ua.includes('iPad'))        os = 'iOS';
  else if (ua.includes('Android'))                         os = 'Android';
  else if (ua.includes('Windows'))                         os = 'Windows';
  else if (ua.includes('Mac'))                             os = 'macOS';
  else if (ua.includes('Linux'))                           os = 'Linux';
  return `${browser} on ${os}`;
}

/**
 * Analyze a login for anomalies.
 * @param {string|ObjectId} userId
 * @param {string} ip  - client IP
 * @param {string} ua  - User-Agent string
 * @returns {Promise<Array<{type, severity, score, details}>>}
 */
export async function analyzeLoginAnomaly(userId, ip, ua) {
  const anomalies = [];

  // ── 1. Device fingerprinting ──────────────────────────────────────────────
  const fpHash = crypto.createHash('sha256').update(ua || '').digest('hex');
  const existingDevice = await DeviceFingerprint.findOne({ userId, fingerprintHash: fpHash });

  if (!existingDevice) {
    const label = parseDeviceLabel(ua);
    await DeviceFingerprint.create({ userId, fingerprintHash: fpHash, userAgent: ua, label, firstSeen: new Date(), lastSeen: new Date() });
    anomalies.push({ type: 'new_device', severity: 'medium', score: 40, details: { label } });
  } else {
    DeviceFingerprint.updateOne({ userId, fingerprintHash: fpHash }, { lastSeen: new Date() }).catch(() => {});
  }

  // ── 2. Geolocation + impossible travel ───────────────────────────────────
  const geo      = await resolveGeo(ip);
  const baseline = await UserLoginBaseline.findOne({ userId }).lean();

  if (geo && geo.lat != null && baseline?.lastLoginLat != null && baseline?.lastLoginLon != null) {
    const distKm      = haversineKm(baseline.lastLoginLat, baseline.lastLoginLon, geo.lat, geo.lon);
    const timeDiffH   = baseline.lastLoginAt
      ? (Date.now() - new Date(baseline.lastLoginAt).getTime()) / 3_600_000
      : 999;

    if (distKm > 500 && timeDiffH < 2) {
      anomalies.push({
        type: 'impossible_travel', severity: 'critical', score: 90,
        details: {
          distanceKm:      Math.round(distKm),
          fromCountry:     baseline.lastLoginCountry || '',
          toCity:          geo.city,
          toCountry:       geo.country,
          timeDiffMinutes: Math.round(timeDiffH * 60),
        },
      });
    }
  }

  // ── 3. Unusual login time ─────────────────────────────────────────────────
  const currentHour = new Date().getUTCHours();
  const typicalHours = baseline?.typicalHours || [];
  if (typicalHours.length >= 5 && !typicalHours.includes(currentHour)) {
    anomalies.push({
      type: 'unusual_time', severity: 'low', score: 15,
      details: { hour: currentHour, typicalHours },
    });
  }

  // ── 4. Update baseline (non-blocking) ────────────────────────────────────
  const updatedHours = [...new Set([...typicalHours, currentHour])].slice(-24);
  UserLoginBaseline.findOneAndUpdate(
    { userId },
    {
      $set: {
        lastLoginAt:      new Date(),
        lastLoginCountry: geo?.country || baseline?.lastLoginCountry || '',
        lastLoginLat:     geo?.lat     ?? baseline?.lastLoginLat ?? null,
        lastLoginLon:     geo?.lon     ?? baseline?.lastLoginLon ?? null,
        typicalHours:     updatedHours,
      },
      $addToSet: {
        knownCountries: geo?.country || 'Unknown',
        knownIPs:       ip || 'Unknown',
      },
    },
    { upsert: true }
  ).catch(() => {});

  return anomalies;
}
