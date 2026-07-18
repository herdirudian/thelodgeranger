const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function getIDPModel(res) {
  const model = prisma.individualDevelopmentPlan;
  if (!model) {
    res.status(500).json({
      message: 'IDP is not available on server',
      error: 'Prisma client is out of date. Run: npx prisma generate (and migrate deploy), then restart the server.',
    });
    return null;
  }
  return model;
}

function isManagerRole(role) {
  const allowedRoles = [
    'GM',
    'HR',
    'HOD',
    'ADMIN',
    'SUPERVISOR',
    'PHOTOGRAPHER_HOD',
    'MERCHANDISE_HOD',
    'MERCHANDISE_SPV',
  ];
  return allowedRoles.includes(role);
}

function buildDefaultItems() {
  const actionTemplates = [
    { type: 'FORMAL_TRAINING', label: 'Formal Training (10%)' },
    { type: 'MENTORING_COACHING', label: 'Mentoring & Coaching (20%)' },
    { type: 'OJT', label: 'OJT (70%)' },
  ];

  return Array.from({ length: 4 }).map(() => ({
    developmentNeeds: '',
    competency: '',
    actions: actionTemplates.map((a) => ({
      type: a.type,
      label: a.label,
      description: '',
      responsibility: '',
      startDate: '',
      endDate: '',
    })),
  }));
}

function buildDefaultObjectiveSetting() {
  return {
    goals: Array.from({ length: 5 }).map((_, i) => ({
      no: i + 1,
      objectiveDetails: '',
      measure: '',
      startDate: '',
      endDate: '',
      milestone: '',
    })),
  };
}

function buildDefaultPerformanceReview() {
  return {
    what: {
      targets: Array.from({ length: 5 }).map((_, i) => ({
        no: i + 1,
        target: '',
        coworkerComment: '',
        managerComment: '',
        coworkerRating: '',
        managerRating: '',
      })),
      overallCoworkerRating: '',
      overallManagerRating: '',
    },
    how: {
      values: [
        'Nurturing',
        'Authenticity',
        'Tranquility',
        'Unity',
        'Resilence',
        'Exceptional',
      ].map((name) => ({
        value: name,
        coworkerComment: '',
        managerComment: '',
        coworkerRating: '',
        managerRating: '',
      })),
      overallCoworkerRating: '',
      overallManagerRating: '',
    },
    overallPerformanceRating: '',
    coworkerOverallComment: '',
    managerOverallComment: '',
    potentialRating: '',
    staircaseLevel: '',
  };
}

function buildDefaultCareerPreference() {
  return {
    strengthDevelopmentArea: '',
    employeeCareerAspiration: '',
    managerViewOnCareer: '',
    note: '',
    mobility: {
      preferredLocations: '',
      country: '',
      period: '',
      wouldRelocate: '',
    },
  };
}

exports.getMyIDPs = async (req, res) => {
  try {
    const IDP = getIDPModel(res);
    if (!IDP) return;
    const userId = parseInt(req.userId);
    const idps = await IDP.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        year: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json(idps);
  } catch (error) {
    if (error?.code === 'P2021' || `${error?.message || ''}`.toLowerCase().includes('does not exist')) {
      return res.status(500).json({
        message: 'Error fetching IDP',
        error: 'Table IDP belum ada di database. Jalankan migration / buat tabel IndividualDevelopmentPlan, lalu restart server.',
      });
    }
    res.status(500).json({ message: 'Error fetching IDP', error: error.message });
  }
};

exports.createMyIDP = async (req, res) => {
  try {
    const IDP = getIDPModel(res);
    if (!IDP) return;
    const userId = parseInt(req.userId);
    const year = parseInt(req.body?.year) || new Date().getFullYear();
    const items = req.body?.items && Array.isArray(req.body.items) ? req.body.items : buildDefaultItems();
    const generalNotes = typeof req.body?.generalNotes === 'string' ? req.body.generalNotes : null;
    const objectiveSetting = req.body?.objectiveSetting ?? buildDefaultObjectiveSetting();
    const performanceReview = req.body?.performanceReview ?? buildDefaultPerformanceReview();
    const careerPreference = req.body?.careerPreference ?? buildDefaultCareerPreference();

    const created = await IDP.create({
      data: {
        userId,
        createdById: userId,
        year,
        status: 'DRAFT',
        items,
        generalNotes,
        objectiveSetting,
        performanceReview,
        careerPreference,
      },
      select: {
        id: true,
        year: true,
        status: true,
        items: true,
        generalNotes: true,
        objectiveSetting: true,
        performanceReview: true,
        careerPreference: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: 'Error creating IDP', error: error.message });
  }
};

exports.getIDPById = async (req, res) => {
  try {
    const IDP = getIDPModel(res);
    if (!IDP) return;
    const id = parseInt(req.params.id);
    const userId = parseInt(req.userId);
    const role = req.role;

    const idp = await IDP.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, department: true, role: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    if (!idp) return res.status(404).json({ message: 'IDP not found' });

    const canView = idp.userId === userId || isManagerRole(role);
    if (!canView) return res.status(403).json({ message: 'Unauthorized' });

    res.json(idp);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching IDP', error: error.message });
  }
};

exports.updateIDPById = async (req, res) => {
  try {
    const IDP = getIDPModel(res);
    if (!IDP) return;
    const id = parseInt(req.params.id);
    const userId = parseInt(req.userId);
    const role = req.role;

    const existing = await IDP.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });

    if (!existing) return res.status(404).json({ message: 'IDP not found' });

    const canEdit = existing.userId === userId || isManagerRole(role);
    if (!canEdit) return res.status(403).json({ message: 'Unauthorized' });

    if (existing.userId === userId && existing.status === 'APPROVED') {
      return res.status(400).json({ message: 'Approved IDP cannot be edited' });
    }

    const data = {};
    if (req.body?.items && Array.isArray(req.body.items)) data.items = req.body.items;
    if (typeof req.body?.generalNotes === 'string') data.generalNotes = req.body.generalNotes;
    if (typeof req.body?.objectiveSetting !== 'undefined') data.objectiveSetting = req.body.objectiveSetting;
    if (typeof req.body?.performanceReview !== 'undefined') data.performanceReview = req.body.performanceReview;
    if (typeof req.body?.careerPreference !== 'undefined') data.careerPreference = req.body.careerPreference;
    if (typeof req.body?.status === 'string' && isManagerRole(role)) data.status = req.body.status;

    const updated = await IDP.update({
      where: { id },
      data,
      select: {
        id: true,
        year: true,
        status: true,
        items: true,
        generalNotes: true,
        objectiveSetting: true,
        performanceReview: true,
        careerPreference: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating IDP', error: error.message });
  }
};

exports.submitIDP = async (req, res) => {
  try {
    const IDP = getIDPModel(res);
    if (!IDP) return;
    const id = parseInt(req.params.id);
    const userId = parseInt(req.userId);

    const existing = await IDP.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });

    if (!existing) return res.status(404).json({ message: 'IDP not found' });
    if (existing.userId !== userId) return res.status(403).json({ message: 'Unauthorized' });
    if (existing.status === 'APPROVED') return res.status(400).json({ message: 'IDP already approved' });

    // Allow updating data during submission
    const data = { status: 'SUBMITTED' };
    if (req.body?.items && Array.isArray(req.body.items)) data.items = req.body.items;
    if (typeof req.body?.generalNotes === 'string') data.generalNotes = req.body.generalNotes;
    if (typeof req.body?.objectiveSetting !== 'undefined') data.objectiveSetting = req.body.objectiveSetting;
    if (typeof req.body?.performanceReview !== 'undefined') data.performanceReview = req.body.performanceReview;
    if (typeof req.body?.careerPreference !== 'undefined') data.careerPreference = req.body.careerPreference;

    const updated = await IDP.update({
      where: { id },
      data,
      select: {
        id: true,
        status: true,
        items: true,
        generalNotes: true,
        objectiveSetting: true,
        performanceReview: true,
        careerPreference: true,
        updatedAt: true
      },
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error submitting IDP', error: error.message });
  }
};

const { sendWhatsAppMessage } = require('../services/whatsappService');

async function notifyEmployee(idp, action) {
  try {
    if (!idp.user?.whatsappNumber) return;
    
    let statusText = action === 'APPROVED' ? 'DISETUJUI (APPROVED)' : 'DITOLAK (REJECTED)';
    let msg = `Halo ${idp.user.name},\n\nIDP Anda tahun ${idp.year} telah ${statusText} oleh ${idp.reviewerName || 'Atasan'}.\n\nSilakan cek detailnya di aplikasi Ranger. Terima kasih!`;
    
    await sendWhatsAppMessage({ to: idp.user.whatsappNumber, message: msg });
  } catch (e) {
    console.error('[IDP-NOTIFY-ERROR]', e.message);
  }
}

exports.approveIDP = async (req, res) => {
  try {
    const IDP = getIDPModel(res);
    if (!IDP) return;
    const id = parseInt(req.params.id);
    const role = req.role;
    const reviewerId = parseInt(req.userId);
    const reviewerName = req.userName; // Assume userName is available

    if (!isManagerRole(role)) return res.status(403).json({ message: 'Unauthorized' });

    const existing = await IDP.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, whatsappNumber: true } } }
    });

    if (!existing) return res.status(404).json({ message: 'IDP not found' });

    const updated = await IDP.update({
      where: { id },
      data: { status: 'APPROVED' },
      include: { user: { select: { id: true, name: true, whatsappNumber: true } } }
    });

    await notifyEmployee({ ...updated, reviewerName }, 'APPROVED');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error approving IDP', error: error.message });
  }
};

exports.rejectIDP = async (req, res) => {
  try {
    const IDP = getIDPModel(res);
    if (!IDP) return;
    const id = parseInt(req.params.id);
    const role = req.role;
    const reviewerId = parseInt(req.userId);
    const reviewerName = req.userName;

    if (!isManagerRole(role)) return res.status(403).json({ message: 'Unauthorized' });

    const existing = await IDP.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, whatsappNumber: true } } }
    });

    if (!existing) return res.status(404).json({ message: 'IDP not found' });

    const updated = await IDP.update({
      where: { id },
      data: { status: 'REJECTED' },
      include: { user: { select: { id: true, name: true, whatsappNumber: true } } }
    });

    await notifyEmployee({ ...updated, reviewerName }, 'REJECTED');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting IDP', error: error.message });
  }
};

exports.listIDPs = async (req, res) => {
  try {
    const IDP = getIDPModel(res);
    if (!IDP) return;
    const role = req.role;
    const userDept = req.department; // Assume department is available in req
    if (!isManagerRole(role)) return res.status(403).json({ message: 'Unauthorized' });

    const department = typeof req.query.department === 'string' && req.query.department.trim().length > 0
      ? req.query.department.trim()
      : null;
    const year = typeof req.query.year === 'string' ? parseInt(req.query.year) : null;
    const status = typeof req.query.status === 'string' && req.query.status.trim().length > 0
      ? req.query.status.trim()
      : null;
    const search = typeof req.query.search === 'string' && req.query.search.trim().length > 0
      ? req.query.search.trim()
      : null;

    const where = {};
    if (year) where.year = year;
    if (status) where.status = status;

    // Filter by department based on role
    // HOD can only see their department
    // SPV Operasional (assuming role name), HR, GM, ADMIN can see all
    const fullAccessRoles = ['GM', 'HR', 'ADMIN', 'SUPERVISOR', 'PHOTOGRAPHER_HOD', 'MERCHANDISE_HOD'];
    
    if (!fullAccessRoles.includes(role)) {
      // If not a full access role (like HOD), restrict to their department
      where.user = { department: userDept };
    } else if (department) {
      // Full access role can filter by a specific department if requested
      where.user = { department };
    }

    if (search) {
      where.OR = [
        { user: { name: { contains: search } } },
        { generalNotes: { contains: search } },
      ];
    }

    const idps = await IDP.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, department: true, role: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });

    res.json(idps);
  } catch (error) {
    res.status(500).json({ message: 'Error listing IDP', error: error.message });
  }
};
