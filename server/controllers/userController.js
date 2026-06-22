const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
const { sendOtpWhatsApp, to62 } = require('../services/watzapService');

exports.getAllUsers = async (req, res) => {
  try {
    const requesterId = req.userId;
    const requester = await prisma.user.findUnique({ where: { id: requesterId } });
    
    let whereClause = {};

    if (requester.role === 'HOD') {
        whereClause.department = requester.department;
    }
    
    // Optional: Filter by department query param if provided (and allowed)
    if (req.query.department) {
        if (requester.role === 'HOD') {
             // HOD restricted to own department
             whereClause.department = requester.department;
        } else {
             // GM/HR/Admin can filter
             whereClause.department = req.query.department;
        }
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        employmentType: true,
        checklistTemplateId: true,
        leaveQuota: true,
        pdo: true,
        contractStartDate: true,
        contractEndDate: true,
        createdAt: true
      },
      orderBy: { name: 'asc' }
    });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users', error: error.message });
  }
};

exports.getColleagues = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                department: true
            },
            orderBy: { name: 'asc' }
        });
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching colleagues', error: error.message });
    }
};

exports.createUser = async (req, res) => {
  try {
    const { email, password, name, role, department, leaveQuota, pdo, contractStartDate, contractEndDate, employmentType, checklistTemplateId } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        department,
        employmentType: employmentType || 'CONTRACT',
        checklistTemplateId: checklistTemplateId ? parseInt(checklistTemplateId) : null,
        leaveQuota: typeof leaveQuota !== 'undefined' ? parseInt(leaveQuota) : 12,
        pdo: typeof pdo !== 'undefined' ? parseInt(pdo) : 0,
        contractStartDate: contractStartDate ? new Date(contractStartDate) : null,
        contractEndDate: contractEndDate ? new Date(contractEndDate) : null
      }
    });

    res.status(201).json({ message: 'User created successfully', user });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: `Error creating user: ${error.message}` });
  }
};

exports.getWhatsAppStatus = async (req, res) => {
  try {
    const requesterId = req.userId;
    const requester = await prisma.user.findUnique({ where: { id: requesterId } });
    if (!requester || !['HR', 'GM', 'ADMIN'].includes(requester.role)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { department } = req.query;
    const whereClause = {};
    if (department && department.trim() !== '') {
      whereClause.department = department.trim();
    }

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        whatsappNumber: true,
        whatsappVerifiedAt: true
      },
      orderBy: { name: 'asc' }
    });

    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching WhatsApp status', error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, department, password, leaveQuota, pdo, contractStartDate, contractEndDate, employmentType, checklistTemplateId } = req.body;
    
    let dataToUpdate = { name, email, role, department, employmentType };

    if (checklistTemplateId !== undefined) {
        dataToUpdate.checklistTemplateId = checklistTemplateId ? parseInt(checklistTemplateId) : null;
    }

    if (leaveQuota !== undefined) {
        dataToUpdate.leaveQuota = parseInt(leaveQuota);
    }

    if (pdo !== undefined) {
        dataToUpdate.pdo = parseInt(pdo);
    }

    if (contractStartDate !== undefined) {
        dataToUpdate.contractStartDate = contractStartDate ? new Date(contractStartDate) : null;
    }

    if (contractEndDate !== undefined) {
        dataToUpdate.contractEndDate = contractEndDate ? new Date(contractEndDate) : null;
    }
    
    if (password && password.trim() !== "") {
        dataToUpdate.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: dataToUpdate
    });

    res.status(200).json({ message: 'User updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user', error: error.message });
  }
};

exports.sendWhatsAppCode = async (req, res) => {
  try {
    const userId = req.userId;
    const { phone } = req.body;
    const otpTtlMin = parseInt(process.env.OTP_TTL_MINUTES || '10', 10);
    const resendCooldown = parseInt(process.env.OTP_RESEND_COOLDOWN || '60', 10);
    const now = new Date();

    const normalized = to62(phone);
    if (!/^62\d{8,13}$/.test(normalized)) {
      return res.status(400).json({ message: 'Nomor WhatsApp tidak valid' });
    }

    const last = await prisma.verificationCode.findFirst({
      where: { userId, channel: 'WHATSAPP' },
      orderBy: { createdAt: 'desc' }
    });
    if (last && (now.getTime() - new Date(last.createdAt).getTime()) < (resendCooldown * 1000)) {
      const retryIn = Math.ceil(((resendCooldown * 1000) - (now.getTime() - new Date(last.createdAt).getTime())) / 1000);
      return res.status(429).json({ message: `Tunggu ${retryIn} detik sebelum kirim ulang` });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(now.getTime() + otpTtlMin * 60 * 1000);

    await prisma.verificationCode.create({
      data: {
        userId,
        channel: 'WHATSAPP',
        phone: normalized,
        code,
        expiresAt
      }
    });

    const text = `Kode verifikasi Lodge Ranger Anda: ${code}. Berlaku ${otpTtlMin} menit.`;
    const result = await sendOtpWhatsApp({ to: normalized, message: text });

    const payload = { ok: true, expiresAt };
    if (process.env.WATZAP_FAKE_SEND === '1') payload.devEchoCode = code;
    res.json(payload);
  } catch (error) {
    console.error('WA OTP send error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

exports.verifyWhatsAppCode = async (req, res) => {
  try {
    const userId = req.userId;
    const { phone, code } = req.body;
    const normalized = to62(phone);

    const record = await prisma.verificationCode.findFirst({
      where: {
        userId,
        channel: 'WHATSAPP',
        phone: normalized,
        consumedAt: null
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!record) {
      return res.status(400).json({ message: 'Kode tidak ditemukan. Kirim ulang kode.' });
    }
    if (new Date() > new Date(record.expiresAt)) {
      return res.status(400).json({ message: 'Kode kadaluarsa. Kirim ulang kode.' });
    }
    if (record.code !== String(code).trim()) {
      await prisma.verificationCode.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } }
      });
      return res.status(400).json({ message: 'Kode verifikasi salah.' });
    }

    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { consumedAt: new Date() }
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        whatsappNumber: normalized,
        whatsappVerifiedAt: new Date()
      }
    });

    res.json({ ok: true, verifiedAt: new Date() });
  } catch (error) {
    console.error('WA OTP verify error:', error.message);
    res.status(500).json({ message: error.message });
  }
};
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    const requesterId = req.userId;
    const requester = await prisma.user.findUnique({ where: { id: requesterId } });

    if (requester.role !== 'GM' && requester.role !== 'HR' && requester.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Forbidden: Require Admin privileges' });
    }

    // Handle foreign key constraints by deleting related data first
    await prisma.$transaction([
      prisma.attendance.deleteMany({ where: { userId } }),
      prisma.schedule.deleteMany({ where: { userId } }),
      prisma.request.deleteMany({ where: { userId } }),
      prisma.request.updateMany({ 
        where: { securityReturnById: userId }, 
        data: { securityReturnById: null } 
      }),
      prisma.procurement.deleteMany({ where: { userId } }),
      prisma.customerFeedback.deleteMany({ where: { staffId: userId } }),
      prisma.announcement.deleteMany({ where: { userId } }),
      prisma.notification.deleteMany({ where: { userId } }),
      prisma.bugReport.deleteMany({ where: { userId } }),
      prisma.individualDevelopmentPlan.deleteMany({ where: { userId } }),
      prisma.individualDevelopmentPlan.deleteMany({ where: { createdById: userId } }),
      prisma.onboardingTask.deleteMany({ where: { userId } }),
      prisma.userLearningProgress.deleteMany({ where: { userId } }),
      prisma.approvalAssignment.deleteMany({ where: { userId } }),
      prisma.transactionApproval.deleteMany({ where: { userId } }),
      prisma.review360Assignment.deleteMany({ where: { reviewerUserId: userId } }),
      prisma.review360Assignment.deleteMany({ where: { targetUserId: userId } }),
      prisma.review360Form.deleteMany({ where: { createdById: userId } }),
      prisma.checklistSubmission.deleteMany({ where: { userId } }),
      prisma.publicSurveyAccess.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } })
    ]);

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: 'Error deleting user', error: error.message });
  }
};

exports.getPublicUserProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: parseInt(id) },
            select: {
                id: true,
                name: true,
                department: true
            }
        });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching public user profile', error: error.message });
    }
};

exports.getExpiringContracts = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const users = await prisma.user.findMany({
            where: {
                contractEndDate: {
                    gte: today
                }
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                department: true,
                contractStartDate: true,
                contractEndDate: true
            },
            orderBy: {
                contractEndDate: 'asc'
            }
        });
        
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching expiring contracts', error: error.message });
    }
};
