const express = require('express');
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
const dashboardRoutes = require('./routes/dashboard');
const notificationRoutes = require('./routes/notification');
const onboardingRoutes = require('./routes/onboarding');
const learningRoutes = require('./routes/learning');
const review360Routes = require('./routes/review360');
const manualProcurementRoutes = require('./routes/manualProcurement');
const { PrismaClient } = require('@prisma/client');
const { sendWhatsAppMessage } = require('./services/watzapService');

const app = express();

// Strict CORS (allowlist via env ALLOWED_ORIGINS, comma-separated)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // allow non-browser or same-origin
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));

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
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/review360', review360Routes);
app.use('/api/manual-procurement', manualProcurementRoutes);

const prisma = new PrismaClient();
const reminderState = { sentAttendance: new Map(), sentApproval: new Map() };
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
    const key = `${t.id}:${dayStart.toISOString().slice(0, 10)}`;
    const last = reminderState.sentAttendance.get(key);
    const nowMs = Date.now();
    if (last && nowMs - last < 60 * 60 * 1000) continue;
    const msg = `Reminder absensi hari ini untuk ${t.name}. Silakan melakukan check-in.`;
    try {
      await sendWhatsAppMessage({ to: t.whatsappNumber, message: msg });
      reminderState.sentAttendance.set(key, nowMs);
    } catch (e) {}
  }
}
async function runApprovalReminders() {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const hods = await prisma.user.findMany({
    where: { role: 'HOD', whatsappVerifiedAt: { not: null } },
    select: { id: true, name: true, department: true, whatsappNumber: true }
  });
  for (const u of hods) {
    if (!u.whatsappNumber) continue;
    const rc = await prisma.request.count({ where: { status: 'PENDING_HOD', user: { department: u.department } } });
    const ac = await prisma.attendance.count({ where: { status: 'PENDING_HOD', user: { department: u.department } } });
    const total = rc + ac;
    if (total > 0) {
      const key = `HOD:${u.id}:${dayStart.toISOString().slice(0, 10)}`;
      const last = reminderState.sentApproval.get(key);
      const nowMs = Date.now();
      if (last && nowMs - last < 60 * 60 * 1000) continue;
      const msg = `Reminder approval ${u.name}: ${total} pending (${rc} request, ${ac} absensi).`;
      try {
        await sendWhatsAppMessage({ to: u.whatsappNumber, message: msg });
        reminderState.sentApproval.set(key, nowMs);
      } catch (e) {}
    }
  }
  const spvs = await prisma.user.findMany({
    where: { role: 'SUPERVISOR', whatsappVerifiedAt: { not: null } },
    select: { id: true, name: true, whatsappNumber: true }
  });
  for (const u of spvs) {
    if (!u.whatsappNumber) continue;
    const rc = await prisma.request.count({ where: { status: 'PENDING_SUPERVISOR' } });
    if (rc > 0) {
      const key = `SPV:${u.id}:${dayStart.toISOString().slice(0, 10)}`;
      const last = reminderState.sentApproval.get(key);
      const nowMs = Date.now();
      if (last && nowMs - last < 60 * 60 * 1000) continue;
      const msg = `Reminder approval ${u.name}: ${rc} request pending.`;
      try {
        await sendWhatsAppMessage({ to: u.whatsappNumber, message: msg });
        reminderState.sentApproval.set(key, nowMs);
      } catch (e) {}
    }
  }
  const hrs = await prisma.user.findMany({
    where: { role: 'HR', whatsappVerifiedAt: { not: null } },
    select: { id: true, name: true, whatsappNumber: true }
  });
  for (const u of hrs) {
    if (!u.whatsappNumber) continue;
    const rc = await prisma.request.count({ where: { status: 'PENDING_HR' } });
    const ac = await prisma.attendance.count({ where: { status: 'PENDING_HR' } });
    const total = rc + ac;
    if (total > 0) {
      const key = `HR:${u.id}:${dayStart.toISOString().slice(0, 10)}`;
      const last = reminderState.sentApproval.get(key);
      const nowMs = Date.now();
      if (last && nowMs - last < 60 * 60 * 1000) continue;
      const msg = `Reminder approval ${u.name}: ${total} pending (${rc} request, ${ac} absensi).`;
      try {
        await sendWhatsAppMessage({ to: u.whatsappNumber, message: msg });
        reminderState.sentApproval.set(key, nowMs);
      } catch (e) {}
    }
  }
  const gms = await prisma.user.findMany({
    where: { role: 'GM', whatsappVerifiedAt: { not: null } },
    select: { id: true, name: true, whatsappNumber: true }
  });
  for (const u of gms) {
    if (!u.whatsappNumber) continue;
    const rc = await prisma.request.count({ where: { status: 'PENDING_GM' } });
    const ac = await prisma.attendance.count({ where: { status: 'PENDING_GM' } });
    const total = rc + ac;
    if (total > 0) {
      const key = `GM:${u.id}:${dayStart.toISOString().slice(0, 10)}`;
      const last = reminderState.sentApproval.get(key);
      const nowMs = Date.now();
      if (last && nowMs - last < 60 * 60 * 1000) continue;
      const msg = `Reminder approval ${u.name}: ${total} pending (${rc} request, ${ac} absensi).`;
      try {
        await sendWhatsAppMessage({ to: u.whatsappNumber, message: msg });
        reminderState.sentApproval.set(key, nowMs);
      } catch (e) {}
    }
  }
}
function startReminders() {
  if ((process.env.REMINDERS_ENABLED || '1') !== '1') return;
  const intervalMs = parseInt(process.env.REMINDER_INTERVAL_MS || '900000', 10);
  setInterval(async () => {
    try {
      await runAttendanceReminders();
      await runApprovalReminders();
    } catch (e) {}
  }, intervalMs);
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startReminders();
});
