const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const attendanceRoutes = require('./routes/attendance');
const requestRoutes = require('./routes/request');
const scheduleRoutes = require('./routes/schedule');
const feedbackRoutes = require('./routes/feedback');
const bugReportRoutes = require('./routes/bugReport');
const analyticsRoutes = require('./routes/analytics');
const announcementRoutes = require('./routes/announcement');
const procurementRoutes = require('./routes/procurement');
const uploadRoutes = require('./routes/upload');
const approvalConfigRoutes = require('./routes/approvalConfig');
const publicSurveyRoutes = require('./routes/publicSurvey');
const dashboardRoutes = require('./routes/dashboard');
const notificationRoutes = require('./routes/notification');
const onboardingRoutes = require('./routes/onboarding');
const learningRoutes = require('./routes/learning');
const review360Routes = require('./routes/review360');
const manualProcurementRoutes = require('./routes/manualProcurement');
const idpRoutes = require('./routes/idp');
const votingRoutes = require('./routes/voting');
const checklistRoutes = require('./routes/checklist');
const settingsRoutes = require('./routes/settings');
const { PrismaClient } = require('@prisma/client');
const { sendWhatsAppMessage } = require('./services/watzapService');
const { formatWibTime } = require('./utils/wibDate');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function generateShiftReminderMessage(user, shift, type) {
  const hour = new Date().getHours();
  let greeting = 'Halo';
  if (hour >= 5 && hour < 11) greeting = 'Selamat pagi';
  else if (hour >= 11 && hour < 15) greeting = 'Selamat siang';
  else if (hour >= 15 && hour < 18) greeting = 'Selamat sore';
  else greeting = 'Selamat malam';

  const timeRange = `${formatWibTime(shift.shiftStart)}–${formatWibTime(shift.shiftEnd)}`;
  
  if (type === 'IN') {
    const templates = [
      `${greeting} ${user.name}, pengingat 10 menit lagi waktu check-in Anda (Shift ${shift.shiftName || ''} ${timeRange}). Semangat bekerja!`,
      `${greeting} ${user.name}, jangan lupa 10 menit lagi masuk Shift ${shift.shiftName || ''} ya (${timeRange}). Have a great day!`,
      `${greeting} ${user.name}, yuk bersiap! 10 menit lagi waktu mulai Shift ${shift.shiftName || ''} (${timeRange}).`
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  } else {
    const templates = [
      `${greeting} ${user.name}, pengingat 10 menit lagi waktu check-out Anda (Shift ${shift.shiftName || ''} berakhir ${formatWibTime(shift.shiftEnd)}). Terima kasih atas kerja kerasnya hari ini!`,
      `${greeting} ${user.name}, 10 menit lagi waktu selesai Shift ${shift.shiftName || ''} (${formatWibTime(shift.shiftEnd)}). Jangan lupa melakukan check-out ya.`,
      `${greeting} ${user.name}, bersiap pulang! 10 menit lagi Shift ${shift.shiftName || ''} Anda berakhir.`
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }
}

async function checkAndMarkSent(key, ttlMinutes = 60) {
  const fullKey = `reminder_sent_${key}`;
  try {
    const now = new Date();
    // Use an atomic operation if possible, but prisma.systemSetting.create with unique key is a good lock
    await prisma.systemSetting.create({
      data: { 
        key: fullKey, 
        value: String(now.getTime()), 
        group: 'REMINDER_LOG' 
      }
    });
    return true;
  } catch (e) {
    // If it already exists, check if it's expired
    try {
      const existing = await prisma.systemSetting.findUnique({ where: { key: fullKey } });
      if (existing) {
        const lastSent = parseInt(existing.value, 10);
        const now = Date.now();
        if (now - lastSent > ttlMinutes * 60 * 1000) {
          // Expired, update it
          await prisma.systemSetting.update({
            where: { key: fullKey },
            data: { value: String(now) }
          });
          return true;
        }
      }
    } catch (err) {}
    return false;
  }
}

const app = express();

// Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Handled by Next.js if needed, or configure strictly here
}));

// Strict CORS (allowlist via env ALLOWED_ORIGINS, comma-separated)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow non-browser or same-origin
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'], // Removed OPTIONS unless needed for preflight
  allowedHeaders: ['Authorization', 'Content-Type'],
  maxAge: 86400, // Cache preflight for 24h
}));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Basic IP rate limiter (no external deps)
const rateStore = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 300; // 300 req/min per IP
app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateStore.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_WINDOW_MS;
  }
  entry.count += 1;
  rateStore.set(ip, entry);
  if (entry.count > RATE_MAX) {
    return res.status(429).json({ message: 'Too many requests' });
  }
  next();
});
app.use(morgan('dev'));
// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/bug-reports', bugReportRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/approval-configs', approvalConfigRoutes);
app.use('/api/public-survey', publicSurveyRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/review360', review360Routes);
app.use('/api/manual-procurement', manualProcurementRoutes);
app.use('/api/idp', idpRoutes);
app.use('/api/voting', votingRoutes);
app.use('/api/checklist', checklistRoutes);
app.use('/api/settings', settingsRoutes);

const prisma = new PrismaClient();
const reminderState = { 
  sentAttendance: new Map(), 
  sentApproval: new Map(),
  sentShift: new Map() // key: TYPE(IN|OUT):userId:YYYY-MM-DDTHH:MM
};
function wibNow() { return new Date(Date.now() + 7 * 60 * 60 * 1000); }
async function runAttendanceReminders() {
  const now = wibNow();
  const hour = now.getUTCHours();
  if (hour < 7 || hour > 11) return;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);
  const schedules = await prisma.schedule.findMany({
    where: {
      date: { gte: dayStart, lte: dayEnd },
      shiftName: { notIn: ['OFF', 'Off Day', 'LIBUR', 'C', 'S', 'I', 'D'] }
    },
    select: { userId: true }
  });
  const userIds = [...new Set(schedules.map(s => s.userId))];
  if (userIds.length === 0) return;
  const att = await prisma.attendance.groupBy({
    by: ['userId'],
    _count: { id: true },
    where: {
      userId: { in: userIds },
      timestamp: { gte: dayStart, lte: dayEnd },
      type: { in: ['CHECK_IN', 'EXTERNAL', 'EXTERNAL_IN'] }
    }
  });
  const checkedIn = new Set(att.map(a => a.userId));
  const missing = userIds.filter(id => !checkedIn.has(id));
  if (missing.length === 0) return;
  const targets = await prisma.user.findMany({
    where: { id: { in: missing }, whatsappVerifiedAt: { not: null } },
    select: { id: true, name: true, whatsappNumber: true }
  });
  for (const t of targets) {
    if (!t.whatsappNumber) continue;
    const key = `ATT:${t.id}:${dayStart.toISOString().slice(0, 10)}`;
    if (!(await checkAndMarkSent(key, 1440))) continue;
    
    const msg = `Reminder absensi hari ini untuk ${t.name}. Silakan melakukan check-in.`;
    try {
      await sendWhatsAppMessage({ to: t.whatsappNumber, message: msg });
      await sleep(1000 + Math.random() * 2000);
    } catch (e) {}
  }
}
async function runShiftReminders() {
  const now = new Date();
  const windowStart = new Date(now.getTime() + 9 * 60 * 1000 + 30 * 1000); // 9.5 mins
  const windowEnd = new Date(now.getTime() + 10 * 60 * 1000 + 30 * 1000); // 10.5 mins

  const schedules = await prisma.schedule.findMany({
    where: {
      OR: [
        { shiftStart: { gte: windowStart, lt: windowEnd } },
        { shiftEnd: { gte: windowStart, lt: windowEnd } }
      ]
    },
    select: {
      id: true,
      userId: true,
      shiftStart: true,
      shiftEnd: true,
      shiftName: true,
      user: { select: { name: true, whatsappNumber: true, whatsappVerifiedAt: true } }
    }
  });

  if (schedules.length === 0) return;

  const isWorking = (s) => {
    const special = ['OFF', 'Off Day', 'LIBUR', 'C', 'S', 'I', 'D', 'Cuti', 'Sakit', 'Izin', 'Dinas Luar', 'Extra Manpower', 'Pending Day Off'];
    return s.shiftStart && s.shiftEnd && s.shiftStart.getTime() !== s.shiftEnd.getTime() && !special.includes(s.shiftName || '');
  };

  for (const s of schedules) {
    if (!isWorking(s)) continue;
    const user = s.user;
    if (!user || !user.whatsappVerifiedAt || !user.whatsappNumber) continue;

    const makeKey = (type, t) => {
      const pad = (n) => String(n).padStart(2, '0');
      const k = `${t.getUTCFullYear()}-${pad(t.getUTCMonth()+1)}-${pad(t.getUTCDate())}T${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
      return `${type}:${s.userId}:${k}`;
    };

    // Check-in reminder
    if (s.shiftStart >= windowStart && s.shiftStart < windowEnd) {
      const key = makeKey('IN', s.shiftStart);
      if (await checkAndMarkSent(key, 60)) {
        const msg = generateShiftReminderMessage(user, s, 'IN');
        try {
          await sendWhatsAppMessage({ to: user.whatsappNumber, message: msg });
          await sleep(2000 + Math.random() * 3000);
        } catch (e) {}
      }
    }

    // Check-out reminder
    if (s.shiftEnd >= windowStart && s.shiftEnd < windowEnd) {
      const key = makeKey('OUT', s.shiftEnd);
      if (await checkAndMarkSent(key, 60)) {
        const msg = generateShiftReminderMessage(user, s, 'OUT');
        try {
          await sendWhatsAppMessage({ to: user.whatsappNumber, message: msg });
          await sleep(2000 + Math.random() * 3000);
        } catch (e) {}
      }
    }
  }
}
async function runApprovalReminders() {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const nowMs = Date.now();

  // Roles to check
  const roles = ['HOD', 'SUPERVISOR', 'HR', 'GM'];
  for (const role of roles) {
    const users = await prisma.user.findMany({
      where: { role, whatsappVerifiedAt: { not: null } },
      select: { id: true, name: true, department: true, whatsappNumber: true }
    });

    for (const u of users) {
      if (!u.whatsappNumber) continue;

      let rc = 0, ac = 0;
      if (role === 'HOD') {
        rc = await prisma.request.count({ where: { status: 'PENDING_HOD', user: { department: u.department } } });
        ac = await prisma.attendance.count({ where: { status: 'PENDING_HOD', user: { department: u.department } } });
      } else if (role === 'SUPERVISOR') {
        rc = await prisma.request.count({ where: { status: 'PENDING_SUPERVISOR' } });
      } else if (role === 'HR') {
        rc = await prisma.request.count({ where: { status: 'PENDING_HR' } });
        ac = await prisma.attendance.count({ where: { status: 'PENDING_HR' } });
      } else if (role === 'GM') {
        rc = await prisma.request.count({ where: { status: 'PENDING_GM' } });
        ac = await prisma.attendance.count({ where: { status: 'PENDING_GM' } });
      }

      const total = rc + ac;
      if (total > 0) {
        const key = `APPROVAL:${role}:${u.id}:${dayStart.toISOString().slice(0, 10)}`;
        // For GM, maybe every 4 hours? For others, once a day (1440 mins).
        const ttl = (role === 'GM') ? 240 : 1440;
        
        if (await checkAndMarkSent(key, ttl)) {
          const msg = `Reminder approval ${u.name}: ${total} pending (${rc} request, ${ac} absensi).`;
          try {
            await sendWhatsAppMessage({ to: u.whatsappNumber, message: msg });
            await sleep(1000 + Math.random() * 2000);
          } catch (e) {}
        }
      }
    }
  }
}
async function startReminders() {
  if ((process.env.REMINDERS_ENABLED || '1') !== '1') return;
  const intervalMs = parseInt(process.env.REMINDER_INTERVAL_MS || '60000', 10);
  
  // Cleanup old reminder logs every hour
  setInterval(async () => {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await prisma.systemSetting.deleteMany({
        where: {
          group: 'REMINDER_LOG',
          createdAt: { lt: oneDayAgo }
        }
      });
    } catch (e) {}
  }, 60 * 60 * 1000);

  setInterval(async () => {
    try {
      await runAttendanceReminders();
      await runShiftReminders();
      await runApprovalReminders();
    } catch (e) {}
  }, intervalMs);
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startReminders();
});
