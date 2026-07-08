const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getWatzapConfig() {
  const settings = await prisma.systemSetting.findMany({
    where: { group: 'WHATSAPP' }
  });
  
  const config = {
    baseUrl: process.env.WATZAP_BASE_URL,
    apiKey: process.env.WATZAP_API_KEY,
    numberKey: process.env.WATZAP_NUMBER_KEY,
    fake: process.env.WATZAP_FAKE_SEND === '1'
  };

  settings.forEach(s => {
    if (s.key === 'WATZAP_BASE_URL') config.baseUrl = s.value;
    if (s.key === 'WATZAP_API_KEY') config.apiKey = s.value;
    if (s.key === 'WATZAP_NUMBER_KEY') config.numberKey = s.value;
    if (s.key === 'WATZAP_FAKE_SEND') config.fake = s.value === '1';
  });

  return config;
}

function to62(phone) {
  if (!phone) return '';
  let p = String(phone).replace(/\s+/g, '').replace(/[^0-9+]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.startsWith('0')) p = '62' + p.slice(1);
  if (!p.startsWith('62')) p = '62' + p.replace(/^(\d+)/, '$1');
  return p;
}

async function sendOtpWhatsApp({ to, message }) {
  const config = await getWatzapConfig();
  const { baseUrl, apiKey, numberKey, fake } = config;

  if (fake) {
    return { status: '200', message: 'FAKE_SEND', ack: 'successfully' };
  }
  
  const missing = [];
  if (!baseUrl) missing.push('WATZAP_BASE_URL');
  if (!apiKey) missing.push('WATZAP_API_KEY');
  if (!numberKey) missing.push('WATZAP_NUMBER_KEY');
  
  if (missing.length) {
    throw new Error(`Watzap configuration missing: ${missing.join(', ')}. Please configure in Admin Dashboard.`);
  }

  const url = `${baseUrl}/send_message`;
  const payload = {
    api_key: apiKey,
    number_key: numberKey,
    phone_no: to62(to),
    message
  };

  const headers = {
    'Content-Type': 'application/json'
  };

  const res = await axios.post(url, payload, { headers, timeout: 15000 });
  const data = res.data;
  if (data && data.status && String(data.status) !== '200') {
    throw new Error(data.message || 'Watzap send failed');
  }
  return data;
}

module.exports = {
  sendOtpWhatsApp,
  sendWhatsAppMessage: ({ to, message }) => sendOtpWhatsApp({ to, message }),
  to62
};
