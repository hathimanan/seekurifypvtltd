// backend/phishing.js
import express from 'express';
import { analyzeSpearPhishing } from '../AI/phishingDetection.ts';
import { checkLookalikeDomain, extractUrlsFromText } from '../utils/lookalikeDomainChecker.ts';
const phishingRouter = express.Router();

const analyzeEmail = (text) => {
    let score = 0;
    const detections = [];
    const lower = text.toLowerCase();

    const headerStats = {
        spf: 'NOT FOUND',
        dkim: 'NOT FOUND',
        dmarc: 'NOT FOUND'
    };

    // --- HEADER AUTH CHECKS ---
    const patterns = {
        spf: /spf=(pass|fail|softfail|neutral|none)/i,
        dkim: /dkim=(pass|fail|none)/i,
        dmarc: /dmarc=(pass|fail|none)/i,
    };

    for (const key in patterns) {
        const match = text.match(patterns[key]);
        if (match) headerStats[key] = match[1].toUpperCase();

        if (match && match[1].toLowerCase() === 'fail') {
            score += key === 'spf' ? 50 : key === 'dmarc' ? 40 : 30;
            detections.push(`AUTH FAILURE: ${key.toUpperCase()} failed verification.`);
        }
    }

    // --- SUSPICIOUS LINKS ---
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    const links = text.match(linkRegex) || [];

    links.forEach(link => {
        const risky =
            link.includes('bit.ly') ||
            link.includes('.xyz') ||
            link.includes('secure-login') ||
            link.includes('verify-now') ||
            /[0-9]{4,}\.[a-z]{2,}/.test(link); // weird numeric domains

        if (risky) {
            score += 20;
            detections.push(`Suspicious Link: ${link}`);
        }
    });

    // --- SENDER DOMAIN CHECK ---
    const fromMatch = text.match(/from:\s*(.*?)\n/i);
    if (fromMatch) {
        const email = fromMatch[1];
        const displayDomain = email.split("@")[1]?.trim();
        const dkimDomain = text.match(/dkim-signature:.*?d=([^;\s]+)/i)?.[1];

        if (dkimDomain && displayDomain && dkimDomain !== displayDomain) {
            score += 30;
            detections.push(`Domain Mismatch: FROM domain (${displayDomain}) ≠ DKIM domain (${dkimDomain})`);
        }
    }

    // --- REPLY-TO TAMPERING ---
    const replyToMatch = text.match(/reply-to:\s*(.*?)\n/i);
    if (replyToMatch && fromMatch && replyToMatch[1] !== fromMatch[1]) {
        score += 20;
        detections.push(`Reply-To Mismatch: Email replies redirect to different address.`);
    }

    // --- URGENCY / SOCIAL ENGINEERING ---
    const triggers = [
        "urgent", "immediately", "verify your account",
        "your account will be suspended", "unauthorized login"
    ];

    triggers.forEach(trigger => {
        if (lower.includes(trigger)) {
            score += 10;
            detections.push(`Social Engineering: "${trigger}" detected.`);
        }
    });

    // Final Score Limit
    score = Math.min(score, 100);

    return {
        isAttacker: score >= 50,
        score,
        detections,
        headerStats
    };
};


phishingRouter.post('/detect-attacker', (req, res) => {
    const { emailContent } = req.body;
    if (!emailContent) return res.status(400).json({ error: "emailContent is required" });
    return res.json(analyzeEmail(emailContent));
});

// ══════════════════════════════════════════════════════════
// AI-POWERED PHISHING ANALYSIS (Anthropic API)
// ══════════════════════════════════════════════════════════

phishingRouter.post('/analyze-ai-phishing', async (req, res) => {
    const { emailContent } = req.body;
    
    if (!emailContent) {
        return res.status(400).json({ error: "emailContent is required" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.error('❌ ANTHROPIC_API_KEY not set');
        return res.status(500).json({ error: "AI service not configured" });
    }

    const systemPrompt = `You are an expert cybersecurity analyst specializing in phishing email detection.
Analyze the provided email content and return ONLY a valid JSON object (no markdown, no explanation outside JSON).

Return this exact structure:
{
  "phishingProbability": <number 0-100>,
  "verdict": "<SAFE|SUSPICIOUS|PHISHING>",
  "confidenceLevel": "<LOW|MEDIUM|HIGH>",
  "indicators": [
    { "category": "<string>", "description": "<string>", "severity": "<low|medium|high>" }
  ],
  "urgencyLanguage": { "detected": <boolean>, "examples": ["<string>"] },
  "senderSpoofing": { "detected": <boolean>, "details": "<string>" },
  "maliciousUrls": { "found": <boolean>, "urls": ["<string>"] },
  "emotionalManipulation": { "detected": <boolean>, "type": "<string>" },
  "recommendation": "<one clear action for the user>",
  "plainEnglishSummary": "<2-3 sentence summary a non-technical user can understand>"
}

Detection criteria to evaluate:
1. Urgency/pressure language ("act now", "account suspended", "verify immediately")
2. Sender spoofing (display name vs actual email domain mismatch)
3. Typosquatting domains (paypa1.com, arnazon.com, g00gle.com)
4. Suspicious URLs (shortened URLs, mismatched domains, IP addresses)
5. Requests for credentials, personal info, or payments
6. Emotional manipulation (fear, reward, authority impersonation)
7. Grammar/spelling anomalies common in phishing
8. Mismatched reply-to and from fields
9. Newly registered domains in links
10. Generic greetings ("Dear Customer") instead of names`;

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                system: systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: `Analyze this email:\n\n${emailContent}`
                    }
                ]
            })
        });

        if (!response.ok) {
            console.error(`❌ Anthropic API error: ${response.status}`);
            const errorData = await response.json();
            return res.status(response.status).json({ 
                error: "AI analysis failed",
                details: errorData
            });
        }

        const data = await response.json();
        const analysisText = data.content?.[0]?.text || '';
        
        // Clean JSON response (remove markdown code blocks if present)
        const cleanJson = analysisText.replace(/```json\s*|\s*```/g, '').trim();
        
        try {
            const analysis = JSON.parse(cleanJson);
            return res.json(analysis);
        } catch (parseError) {
            console.error('❌ Failed to parse AI response:', parseError);
            return res.status(500).json({ 
                error: "Failed to parse AI response",
                raw: analysisText
            });
        }

    } catch (error) {
        console.error('❌ AI Phishing Analysis Error:', error.message);
        return res.status(500).json({ 
            error: "AI analysis failed",
            message: error.message 
        });
    }
});

// ══════════════════════════════════════════════════════════
// AI SPEAR PHISHING ANALYSIS
// POST /api/phishing/spear-analyze
// ══════════════════════════════════════════════════════════

phishingRouter.post('/phishing/spear-analyze', async (req, res) => {
    const { emailContent, recipientName, recipientCompany, recipientRole } = req.body;

    if (!emailContent || typeof emailContent !== 'string' || emailContent.trim().length < 20) {
        return res.status(400).json({ error: 'emailContent is required (minimum 20 characters)' });
    }

    try {
        const urls = extractUrlsFromText(emailContent);

        const aiResult = await analyzeSpearPhishing({
            emailBody: emailContent,
            urls,
            recipientName,
            recipientCompany,
            recipientRole,
        });

        // Run deterministic lookalike check and merge into spearPhishingAnalysis
        const lookalikeDomains = urls
            .map(url => checkLookalikeDomain(url))
            .filter(r => r.isSuspicious)
            .map(r => ({ domain: r.domain, closestMatch: r.closestMatch || '', technique: r.technique }));

        if (aiResult.spearPhishingAnalysis) {
            aiResult.spearPhishingAnalysis.lookalikeDomains = lookalikeDomains;
        } else {
            aiResult.spearPhishingAnalysis = {
                isTargeted: false,
                personalizationDepth: 'none',
                aiGeneratedProbability: 0,
                attackVector: 'unknown',
                suspiciousAbsences: [],
                lookalikeDomains,
            };
        }

        return res.json(aiResult);
    } catch (err) {
        console.error('❌ Spear phishing analysis error:', err.message);
        return res.status(500).json({ error: 'Spear phishing analysis failed', message: err.message });
    }
});

export default phishingRouter;
