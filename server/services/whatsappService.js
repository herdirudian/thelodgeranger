const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get WhatsApp Configuration from SystemSetting table
 * Supporting OpenWA API
 */
async function getWAConfig() {
  const settings = await prisma.systemSetting.findMany({
    where: { group: 'WHATSAPP' }
  });
  
  // Default values from ENV if not in DB
  const config = {
    baseUrl: process.env.WA_BASE_URL || process.env.WATZAP_BASE_URL,
    apiKey: process.env.WA_API_KEY || process.env.WATZAP_API_KEY,
    sessionId: process.env.WA_SESSION_ID || 'default',
    fake: (process.env.WA_FAKE_SEND || process.env.WATZAP_FAKE_SEND) === '1'
  };

  settings.forEach(s => {
    if (s.key === 'WA_BASE_URL' || s.key === 'WATZAP_BASE_URL') config.baseUrl = s.value;
    if (s.key === 'WA_API_KEY' || s.key === 'WATZAP_API_KEY') config.apiKey = s.value;
    if (s.key === 'WA_SESSION_ID') config.sessionId = s.value;
    if (s.key === 'WA_FAKE_SEND' || s.key === 'WATZAP_FAKE_SEND') config.fake = s.value === '1';
  });

  return config;
}

/**
 * Format phone number to 628xxx format (country code)
 */
function to62(phone) {
  if (!phone) return '';
  let p = String(phone).replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = '62' + p.slice(1);
  if (!p.startsWith('62')) p = '62' + p.replace(/^(\d+)/, '$1');
  return p;
}

/**
 * Helper for human-like delay
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Send message using OpenWA API
 * Format: /api/sessions/:sessionId/messages/send-text
 */
async function sendWhatsAppMessage({ to, message }) {
  const config = await getWAConfig();
  const { baseUrl, apiKey, sessionId, fake } = config;

  if (fake) {
    console.log(`[WA-FAKE] To: ${to}, Message: ${message}`);
    return { status: '200', message: 'FAKE_SEND', ack: 'successfully' };
  }
  
  const missing = [];
  if (!baseUrl) missing.push('WA_BASE_URL');
  if (!apiKey) missing.push('WA_API_KEY');
  if (!sessionId) missing.push('WA_SESSION_ID');
  
  if (missing.length) {
    throw new Error(`WhatsApp configuration missing: ${missing.join(', ')}. Please configure in Admin Dashboard.`);
  }

  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  
  // Format chatId: if it already has @c.us or @g.us, use it as is.
  // Otherwise, format to 628xxx@c.us
  let chatId = to;
  if (typeof chatId === 'string' && !chatId.includes('@')) {
    chatId = `${to62(to)}@c.us`;
  }

  // --- ANTI-BOT / HUMAN-LIKE BEHAVIOR ---
  // 1. Initial random delay (3 - 8s) - Mimicking looking at the phone
  await sleep(3000 + Math.random() * 5000);

  // 2. Set Presence to 'composing' (Typing)
  try {
    const typingUrl = `${cleanBaseUrl}/api/sessions/${sessionId}/chats/${chatId}/send-chatstate`;
    await axios.post(typingUrl, { state: 'composing' }, { 
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      timeout: 5000 
    }).catch(() => {});
  } catch (e) {}

  // 3. Simulate Typing Duration (8 - 15s) - Much longer and variable
  // Human average is ~200 chars per minute, plus thinking time
  const baseTypingTime = 5000;
  const thinkingTime = Math.random() * 5000;
  const perCharTime = message.length * 50;
  const totalTypingTime = Math.min(20000, baseTypingTime + thinkingTime + perCharTime);
  await sleep(totalTypingTime);

  // 4. Content Randomization (Anti-Signature detection)
  // We add random zero-width characters or whitespace and a human-like tag
  const invisibleChars = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
  const randomChar = invisibleChars[Math.floor(Math.random() * invisibleChars.length)];
  const humanTag = `\n\n- ${Math.random().toString(36).substring(7)}${randomChar}`;
  const finalMessage = message + humanTag;
  // ---------------------------------------

  const url = `${cleanBaseUrl}/api/sessions/${sessionId}/messages/send-text`;
  const payload = {
    chatId,
    text: finalMessage
  };

  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': apiKey
  };

  try {
    const res = await axios.post(url, payload, { headers, timeout: 15000 });
    return res.data;
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.message;
    console.error(`[WA-ERROR] ${errorMsg}`);
    throw new Error(`Gagal mengirim WhatsApp: ${errorMsg}`);
  }
}

module.exports = {
  sendWhatsAppMessage,
  sendOtpWhatsApp: ({ to, message }) => sendWhatsAppMessage({ to, message }),
  to62
};
