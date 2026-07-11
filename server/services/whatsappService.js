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
  // 1. Initial random delay (2 - 5s) - Increased for safety
  await sleep(2000 + Math.random() * 3000);

  // 2. Simulate Typing State
  try {
    const typingUrl = `${cleanBaseUrl}/api/sessions/${sessionId}/chats/${chatId}/send-chatstate`;
    await axios.post(typingUrl, { state: 'typing' }, { 
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      timeout: 5000 
    }).catch(() => {});
  } catch (e) {}

  // 3. Simulate Typing Duration (5 - 10s) - Increased to be more realistic
  const typingDuration = Math.min(10000, Math.max(5000, message.length * 70));
  await sleep(typingDuration);

  // 4. Add Entropy: Invisible characters and a unique tag at the end
  // This ensures no two messages are byte-for-byte identical.
  const randomSuffix = `\n\n[Ref: ${Math.random().toString(36).substring(7)}]`;
  const finalMessage = message + randomSuffix;
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
