// Simple test script to verify DETAILED validation + retry logic
const { SYSTEM_PROMPT } = require('../src/config/systemPrompt');

function meetsDetailed(ans) {
  const wordCount = (ans.match(/\S+/g) || []).length;
  const headingCount = (ans.match(/^#{1,6}\s+/gm) || []).length;
  return wordCount >= 180 && headingCount >= 3;
}

// Simulate a short model response JSON
const shortRaw = JSON.stringify({
  answer: 'Short answer.',
  widgetType: null,
  widgetData: {},
  suggestions: [],
});

// Simulated retry expanded answer for DETAILED format
const expandedAnswer = `## What is Phishing?\n\nPhishing is a type of social-engineering attack where an attacker impersonates a trusted entity to trick a user into revealing sensitive information or performing unsafe actions. It often uses deceptive emails, SMS, or websites that mimic legitimate services.\n\n## How Phishing Works\n\nAttackers typically craft messages with urgent language and links to fraudulent sites that capture credentials or install malware. These messages may spoof sender addresses and use psychological tactics to rush victims into acting without verifying.\n\n## How to Defend Against Phishing\n\nTo protect yourself, verify unexpected requests independently, inspect links before clicking, use unique passwords and a password manager, and enable multi-factor authentication. Keep software updated and report suspicious messages to your security team.`;

const retryRaw = JSON.stringify({
  answer: expandedAnswer,
  widgetType: null,
  widgetData: {},
  suggestions: ['Is this phishing?', 'How to check a link?'],
});

console.log('Short meets detailed:', meetsDetailed(JSON.parse(shortRaw).answer));
console.log('Expanded meets detailed:', meetsDetailed(JSON.parse(retryRaw).answer));

if (!meetsDetailed(JSON.parse(shortRaw).answer)) {
  console.log('Simulating retry and expansion...');
  const final = JSON.parse(retryRaw);
  console.log('Final answer word count:', (final.answer.match(/\S+/g) || []).length);
  console.log('Final answer heading count:', (final.answer.match(/^#{1,6}\s+/gm) || []).length);
  console.log('\n--- Final Answer Preview ---\n', final.answer.substring(0, 400));
} else {
  console.log('No retry needed.');
}
