// src/utils/knowledgeBase.ts
interface Knowledge {
  topic: string;
  content: string;
}

const knowledge: Knowledge[] = [
  { topic: "Encryption", content: "Encryption is the process of converting information into a secure format to prevent unauthorized access. Common types include symmetric and asymmetric encryption." },
  { topic: "Firewall", content: "A firewall monitors and controls incoming and outgoing network traffic based on predetermined security rules, acting as a barrier between trusted and untrusted networks." },
  { topic: "Phishing", content: "Phishing is a cyberattack where attackers trick users into revealing sensitive information like passwords or credit card numbers, usually via fake emails or websites." },
];

export const getCybersecurityContent = (question: string) => {
  const lowerQ = question.toLowerCase();
  const found = knowledge.find(k => lowerQ.includes(k.topic.toLowerCase()));
  return found ? found.content : "Use general cybersecurity knowledge to answer this question.";
};
