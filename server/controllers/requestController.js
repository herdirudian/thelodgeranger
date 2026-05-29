const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendEmail } = require('../services/emailService');
const { sendWhatsAppMessage } = require('../services/watzapService');
const pdfService = require('../services/pdfService');
const { formatWibDate } = require('../utils/wibDate');
const { createNotification } = require('./notificationController');

exports.createRequest = async (req, res) => {
  try {
    const { 
        type, 
        startDate, 
        endDate, 
        reason,
        returnDate,
        replacementDate,
        replacementName,
        quantity,
        startTime,
        endTime,
        newEmployeeName,
        targetDepartment
    } = req.body;
    
    const userId = req.userId;

    const requester = await prisma.user.findUnique({ where: { id: userId } });
    const department = requester.department || null;

    // Validation: H-2 for specific request types
    const restrictedTypes = ['LEAVE', 'PDO', 'PERMISSION', 'OFF'];
    if (restrictedTypes.includes(type)) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        
        const requestDate = new Date(startDate);
        requestDate.setHours(0, 0, 0, 0);
        
        const minDate = new Date(now);
        minDate.setDate(now.getDate() + 2); // H-2 rule
        
        if (requestDate < minDate) {
            return res.status(400).json({ 
                message: `Pengajuan ${type.replace('_', ' ')} harus dilakukan maksimal H-2. Silakan pilih tanggal mulai minimal ${minDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}.` 
            });
        }
    }

    const approvalConfig = await getActiveApprovalConfig('REQUEST', department);

    let initialStatus = 'PENDING_HOD';

    if (approvalConfig && approvalConfig.steps.length > 0) {
        initialStatus = mapRequestRoleToStatus(approvalConfig.steps[0].role);
    } else {
        if (requester.role === 'GM') {
            initialStatus = 'PENDING_HR';
        } else if (requester.role === 'HOD') {
            initialStatus = 'PENDING_SUPERVISOR';
        } else if (requester.role === 'MERCHANDISE_STAFF') {
            initialStatus = 'PENDING_MERCHANDISE_HOD';
        } else if (requester.role === 'PHOTOGRAPHER_STAFF') {
            initialStatus = 'PENDING_PHOTOGRAPHER_HOD';
        }
    }

    const request = await prisma.request.create({
      data: {
        userId,
        type,
        startDate: startDate ? new Date(startDate) : new Date(), 
        endDate: endDate ? new Date(endDate) : new Date(startDate || Date.now()), 
        reason,
        status: initialStatus,
        returnDate: returnDate ? new Date(returnDate) : null,
        replacementDate: replacementDate ? new Date(replacementDate) : null,
        replacementName,
        quantity: quantity ? parseFloat(quantity) : null,
        startTime,
        endTime,
        newEmployeeName,
        targetDepartment
      },
    });

    const emailSubject = `New Request: ${type} from ${requester.name}`;
    const emailBody = `
        <h3>New Request Submitted</h3>
        <p><strong>Staff:</strong> ${requester.name}</p>
        <p><strong>Type:</strong> ${type}</p>
        <p><strong>Department:</strong> ${requester.department || '-'}</p>
        <p>Please login to the dashboard to review this request.</p>
    `;

    if (approvalConfig && approvalConfig.steps.length > 0) {
        await prisma.transactionApproval.createMany({
            data: approvalConfig.steps.map(step => ({
                module: 'REQUEST',
                moduleId: request.id,
                stepOrder: step.order,
                role: step.role
            }))
        });

        const nextApprovers = await getEligibleApproversForRequest(approvalConfig, approvalConfig.steps[0].role, department);
        for (const approver of nextApprovers) {
            sendEmail(approver.email, emailSubject, emailBody).catch(console.error);
            createNotification(approver.id, `New Request: ${type} from ${requester.name} (${requester.department || '-'})`);
            if (approver.whatsappNumber && approver.whatsappVerifiedAt) {
                const text = `Pengajuan ${type} dari ${requester.name} menunggu persetujuan Anda.`;
                sendWhatsAppMessage({ to: approver.whatsappNumber, message: text }).catch(() => {});
            }
        }
    } else {
        if (initialStatus === 'PENDING_HR') {
            const hrs = await prisma.user.findMany({ where: { role: 'HR' } });
            for (const hr of hrs) {
                sendEmail(hr.email, emailSubject, emailBody).catch(console.error);
                createNotification(hr.id, `New Request: ${type} from ${requester.name} (GM)`);
            }
        } else if (initialStatus === 'PENDING_SUPERVISOR') {
            const supervisors = await prisma.user.findMany({ where: { role: 'SUPERVISOR' } });
            for (const spv of supervisors) {
                sendEmail(spv.email, emailSubject, emailBody).catch(console.error);
                createNotification(spv.id, `New Request: ${type} from ${requester.name} (${requester.department || '-'})`);
                if (spv.whatsappNumber && spv.whatsappVerifiedAt) {
                    const text = `Pengajuan ${type} dari ${requester.name} menunggu persetujuan Anda.`;
                    sendWhatsAppMessage({ to: spv.whatsappNumber, message: text }).catch(() => {});
                }
            }
        } else if (initialStatus === 'PENDING_MERCHANDISE_HOD') {
            const hods = await prisma.user.findMany({ where: { role: 'MERCHANDISE_HOD' } });
            for (const hod of hods) {
                sendEmail(hod.email, emailSubject, emailBody).catch(console.error);
                createNotification(hod.id, `New Request: ${type} from ${requester.name} (Merchandise Staff)`);
                if (hod.whatsappNumber && hod.whatsappVerifiedAt) {
                    const text = `Pengajuan ${type} dari ${requester.name} menunggu persetujuan Anda.`;
                    sendWhatsAppMessage({ to: hod.whatsappNumber, message: text }).catch(() => {});
                }
            }
        } else if (initialStatus === 'PENDING_PHOTOGRAPHER_HOD') {
            const hods = await prisma.user.findMany({ where: { role: 'PHOTOGRAPHER_HOD' } });
            for (const hod of hods) {
                sendEmail(hod.email, emailSubject, emailBody).catch(console.error);
                createNotification(hod.id, `New Request: ${type} from ${requester.name} (Photographer Staff)`);
                if (hod.whatsappNumber && hod.whatsappVerifiedAt) {
                    const text = `Pengajuan ${type} dari ${requester.name} menunggu persetujuan Anda.`;
                    sendWhatsAppMessage({ to: hod.whatsappNumber, message: text }).catch(() => {});
                }
            }
        } else if (requester.department) {
            const hods = await prisma.user.findMany({
                where: { role: 'HOD', department: requester.department }
            });

            for (const hod of hods) {
                if (hod.id !== requester.id) {
                    sendEmail(hod.email, emailSubject, emailBody).catch(console.error);
                    createNotification(hod.id, `New Request: ${type} from ${requester.name} (${requester.department})`);
                    if (hod.whatsappNumber && hod.whatsappVerifiedAt) {
                        const text = `Pengajuan ${type} dari ${requester.name} menunggu persetujuan Anda.`;
                        sendWhatsAppMessage({ to: hod.whatsappNumber, message: text }).catch(() => {});
                    }
                }
            }
        }
    }

    // Auto-mark schedule as PDO for visibility while pending
    try {
        if (type === 'PDO') {
            await updateScheduleFromRequest(request);
        }
    } catch (e) {
        console.error('Failed to update schedule for pending PDO:', e.message);
    }

    res.status(201).json(request);
  } catch (error) {
    console.error("Create Request Error:", error);
    res.status(500).json({ message: `Error creating request: ${error.message}`, error: error.message });
  }
};

exports.getMyRequests = async (req, res) => {
  try {
    const requests = await prisma.request.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching requests', error: error.message });
  }
};

exports.getPendingRequests = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const { department, search, category } = req.query;
    
    // 1. Find Flexible Approvals (TransactionApproval)
    let myPendingTx = [];
    if (user.role === 'ADMIN') {
        // Admin: collect ALL pending steps across modules
        const allPending = await prisma.transactionApproval.findMany({
            where: { module: 'REQUEST', status: 'PENDING' },
            select: { moduleId: true, stepOrder: true, role: true }
        });
        if (allPending.length > 0) {
            // Determine lowest pending step per module
            const byModule = new Map();
            for (const s of allPending) {
                const prev = byModule.get(s.moduleId);
                if (!prev || s.stepOrder < prev.stepOrder) {
                    byModule.set(s.moduleId, s);
                }
            }
            // Optional category filter for flexible approvals
            const normalizeRole = (r) => (r === 'FINANCE' ? 'HR' : (r === 'MERCHANDISE_SPV' ? 'SUPERVISOR' : (r === 'MERCHANDISE_HOD' || r === 'PHOTOGRAPHER_HOD' ? 'HOD' : r)));
            const filtered = [];
            for (const value of byModule.values()) {
                if (!category || normalizeRole(value.role) === category) {
                    filtered.push({ moduleId: value.moduleId, stepOrder: value.stepOrder });
                }
            }
            myPendingTx = filtered;
        }
    } else {
        const txOrConditions = [
            { userId: user.id },
            { role: user.role }
        ];

        if (user.department) {
            // Allow specific HOD/SPV roles to approve generic HOD/SPV steps for their department
            if (user.role.includes('_HOD')) {
                txOrConditions.push({ role: 'HOD', approverDepartment: user.department });
            }
            if (user.role.includes('_SPV')) {
                txOrConditions.push({ role: 'SUPERVISOR', approverDepartment: user.department });
            }
        }

        myPendingTx = await prisma.transactionApproval.findMany({
            where: {
                module: 'REQUEST',
                status: 'PENDING',
                OR: txOrConditions
            },
            select: { moduleId: true, stepOrder: true }
        });
    }
    
    let flexibleIds = [];

    if (myPendingTx.length > 0) {
        const potentialModuleIds = [...new Set(myPendingTx.map(t => t.moduleId))];

        // Get ALL pending steps for these modules to check step order
        const allPendingSteps = await prisma.transactionApproval.findMany({
            where: {
                module: 'REQUEST',
                moduleId: { in: potentialModuleIds },
                status: 'PENDING'
            },
            select: { moduleId: true, stepOrder: true, role: true }
        });

        // Filter - only include if the user's step is the LOWEST pending step order
        const validModuleIds = new Set();
        
        for (const moduleId of potentialModuleIds) {
            const stepsForModule = allPendingSteps.filter(s => s.moduleId === moduleId);
            if (stepsForModule.length === 0) continue;

            const minStepOrder = Math.min(...stepsForModule.map(s => s.stepOrder));
            
            // For ADMIN, include all modules; otherwise ensure user has step at min order
            let include = false;
            if (user.role === 'ADMIN') {
                include = true;
            } else {
                const myStepsForModule = myPendingTx.filter(s => s.moduleId === moduleId);
                include = myStepsForModule.some(s => s.stepOrder === minStepOrder);
            }

            if (include) {
                // Optional category filter: match min step role mapped to category
                if (category) {
                    const minStep = stepsForModule.find(s => s.stepOrder === minStepOrder);
                    const normalizeRole = (r) => (r === 'FINANCE' ? 'HR' : (r === 'MERCHANDISE_SPV' ? 'SUPERVISOR' : (r === 'MERCHANDISE_HOD' || r === 'PHOTOGRAPHER_HOD' ? 'HOD' : r)));
                    if (minStep && normalizeRole(minStep.role) !== category) {
                        continue;
                    }
                }
                validModuleIds.add(moduleId);
            }
        }
        
        flexibleIds = Array.from(validModuleIds);
    }

    // 2. Find Legacy Approvals
    let legacyWhere = null;

    if (user.role === 'HOD') {
        legacyWhere = {
            status: 'PENDING_HOD',
            user: { department: user.department }
        };
    } else if (user.role === 'SUPERVISOR') {
        legacyWhere = {
            status: 'PENDING_SUPERVISOR'
            // Removed strict department check to allow cross-department supervision (e.g. Operational supervising Parking)
            // user: { department: user.department }
        };
    } else if (user.role === 'HR') {
        legacyWhere = { status: 'PENDING_HR' };
    } else if (user.role === 'GM') {
        legacyWhere = { status: 'PENDING_GM' };
    } else if (user.role === 'ADMIN') {
        const mapCategoryToStatuses = (c) => {
            if (!c) return ['PENDING_HOD','PENDING_SUPERVISOR','PENDING_HR','PENDING_GM','PENDING_MERCHANDISE_HOD','PENDING_MERCHANDISE_SPV','PENDING_PHOTOGRAPHER_HOD'];
            switch (c) {
                case 'HOD': return ['PENDING_HOD','PENDING_MERCHANDISE_HOD','PENDING_PHOTOGRAPHER_HOD'];
                case 'SUPERVISOR': return ['PENDING_SUPERVISOR','PENDING_MERCHANDISE_SPV'];
                case 'HR': return ['PENDING_HR'];
                case 'GM': return ['PENDING_GM'];
                default: return ['PENDING_HOD','PENDING_SUPERVISOR','PENDING_HR','PENDING_GM','PENDING_MERCHANDISE_HOD','PENDING_MERCHANDISE_SPV','PENDING_PHOTOGRAPHER_HOD'];
            }
        };
        legacyWhere = { status: { in: mapCategoryToStatuses(category) } };
    } else if (user.role === 'MERCHANDISE_HOD') {
        legacyWhere = { status: 'PENDING_MERCHANDISE_HOD' };
    } else if (user.role === 'MERCHANDISE_SPV') {
        legacyWhere = { status: 'PENDING_MERCHANDISE_SPV' };
    } else if (user.role === 'PHOTOGRAPHER_HOD') {
        legacyWhere = { status: 'PENDING_PHOTOGRAPHER_HOD' };
    }

    // 3. Construct Final Where
    const whereConditions = [];
    if (flexibleIds.length > 0) {
        whereConditions.push({ id: { in: flexibleIds } });
    }
    if (legacyWhere) {
        whereConditions.push(legacyWhere);
    }

    if (whereConditions.length === 0) {
        // No approvals found for this user
        return res.status(200).json([]);
    }

    const requests = await prisma.request.findMany({
        where: {
            OR: whereConditions,
            status: { not: 'REJECTED' },
            // Enforce department filter for HOD to prevent seeing other departments' requests
            ...(user.role === 'HOD' && user.department ? { user: { department: user.department } } : {}),
            // Apply optional filters from query
            ...(department ? { user: { department } } : {}),
            ...(search ? {
                OR: [
                    { reason: { contains: search } },
                    { user: { name: { contains: search } } }
                ]
            } : {})
        },
        include: {
            user: { select: { name: true, department: true } }
        },
        orderBy: { createdAt: 'asc' }
    });

    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending requests', error: error.message });
  }
};

exports.getApprovalHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const { startDate, endDate, department, search } = req.query;
    
    let whereClause = {};
    let dateFilter = null;

    if (startDate || endDate) {
      const range = {};
      if (startDate) {
        const start = new Date(startDate);
        if (!isNaN(start.getTime())) {
          range.gte = start;
        }
      }
      if (endDate) {
        const end = new Date(endDate);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          range.lte = end;
        }
      }
      if (Object.keys(range).length > 0) {
        dateFilter = { updatedAt: range };
      }
    }

    // Find approvals made by this user via TransactionApproval (Config-based)
    const txApprovals = await prisma.transactionApproval.findMany({
        where: {
            module: 'REQUEST',
            userId: user.id,
            status: { in: ['APPROVED', 'REJECTED'] }
        },
        select: { moduleId: true }
    });
    const txApprovedIds = txApprovals.map(t => t.moduleId);

    if (user.role === 'HOD') {
        whereClause = {
            user: { department: user.department },
            OR: [
                { hodApproved: true },
                { status: 'REJECTED', hodApproved: false },
                { id: { in: txApprovedIds } }
            ]
        };
    } else if (user.role === 'SUPERVISOR') {
        whereClause = {
            OR: [
                { spvApproved: true },
                { status: 'REJECTED', hodApproved: true, spvApproved: false },
                { id: { in: txApprovedIds } }
            ]
        };
    } else if (user.role === 'HR') {
        whereClause = {
            OR: [
                { hrApproved: true },
                { status: 'REJECTED', hodApproved: true, hrApproved: false },
                { id: { in: txApprovedIds } }
            ]
        };
    } else if (user.role === 'MERCHANDISE_HOD') {
        whereClause = {
            OR: [
                { id: { in: txApprovedIds } },
                {
                    // Logic for Legacy History:
                    // Show requests where HOD approved, AND the requester is relevant to Merchandise HOD.
                    // Relevant requesters: MERCHANDISE_STAFF, PHOTOGRAPHER_STAFF (since flow goes through Merch HOD)
                    hodApproved: true,
                    user: { role: { in: ['MERCHANDISE_STAFF', 'PHOTOGRAPHER_STAFF'] } },
                    // Ensure it has moved past the PENDING_MERCHANDISE_HOD stage
                    status: { not: 'PENDING_MERCHANDISE_HOD' }
                }
            ]
        };
    } else if (user.role === 'MERCHANDISE_SPV') {
        whereClause = {
            OR: [
                { id: { in: txApprovedIds } },
                {
                    spvApproved: true,
                    user: { role: { in: ['MERCHANDISE_STAFF', 'PHOTOGRAPHER_STAFF'] } },
                    status: { not: 'PENDING_MERCHANDISE_SPV' }
                }
            ]
        };
    } else if (user.role === 'PHOTOGRAPHER_HOD') {
        whereClause = {
            OR: [
                { id: { in: txApprovedIds } },
                {
                    hodApproved: true,
                    user: { role: 'PHOTOGRAPHER_STAFF' },
                    status: { not: 'PENDING_PHOTOGRAPHER_HOD' }
                }
            ]
        };
    } else if (user.role === 'GM' || user.role === 'HR' || user.role === 'ADMIN' || user.role === 'FINANCE') {
        whereClause = {
            OR: [
                { status: 'APPROVED' },
                { status: 'REJECTED' },
                { gmApproved: true },
                { hrApproved: true }
            ]
        };
    } else {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const requests = await prisma.request.findMany({
        where: {
          ...whereClause,
          ...(dateFilter || {}),
          ...(department ? { user: { department } } : {}),
          ...(search ? {
            OR: [
                { reason: { contains: search } },
                { user: { name: { contains: search } } }
            ]
          } : {})
        },
        include: {
            user: { select: { name: true, department: true } }
        },
        orderBy: { updatedAt: 'desc' }
    });

    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching approval history', error: error.message });
  }
};

exports.approveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; 
    const userId = req.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    const request = await prisma.request.findUnique({ 
        where: { id: parseInt(id) },
        include: { user: true }
    });
    
    if (!request) return res.status(404).json({ message: 'Request not found' });

    if (user.role === 'HOD') {
        if (request.user.department !== user.department) {
            return res.status(403).json({ message: 'You can only approve requests from your department' });
        }
    }

    const txApprovals = await prisma.transactionApproval.findMany({
        where: {
            module: 'REQUEST',
            moduleId: request.id
        },
        orderBy: { stepOrder: 'asc' }
    });

    // Only use legacy flow if there is no flexible approval configured
    if (txApprovals.length === 0) {
        return handleLegacyRequestApproval({ res, user, request, action, reason });
    }

    return handleConfigRequestApproval({ res, user, request, action, reason, txApprovals });
  } catch (error) {
    res.status(500).json({ message: 'Error processing request', error: error.message });
  }
};

exports.exportRequests = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        
        let whereClause = {};
    
        if (user.role === 'HOD') {
            whereClause = {
                user: { department: user.department }
            };
        } else if (user.role === 'HR' || user.role === 'GM' || user.role === 'ADMIN') {
            whereClause = {}; 
        } else {
             whereClause = { userId: userId };
        }
    
        const requests = await prisma.request.findMany({
            where: whereClause,
            include: {
                user: { select: { name: true, department: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const headers = ['ID', 'Employee', 'Department', 'Type', 'Start Date', 'End Date', 'Status', 'Reason', 'HOD Note', 'SPV Note', 'HR Note', 'GM Note', 'Rejection Reason'];
        const csvRows = [headers.join(',')];

        for (const req of requests) {
            const row = [
                req.id,
                `"${req.user.name}"`,
                `"${req.user.department || ''}"`,
                req.type,
                formatWibDate(req.startDate),
                formatWibDate(req.endDate),
                req.status,
                `"${(req.reason || '').replace(/"/g, '""')}"`,
                `"${(req.hodNote || '').replace(/"/g, '""')}"`,
                `"${(req.spvNote || '').replace(/"/g, '""')}"`,
                `"${(req.hrNote || '').replace(/"/g, '""')}"`,
                `"${(req.gmNote || '').replace(/"/g, '""')}"`,
                `"${(req.rejectionReason || '').replace(/"/g, '""')}"`
            ];
            csvRows.push(row.join(','));
        }

        const csvString = csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=requests_export.csv');
        res.send(csvString);

    } catch (error) {
        res.status(500).json({ message: 'Error exporting requests', error: error.message });
    }
};

exports.deleteRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Require Admin Role' });
        }

        await prisma.transactionApproval.deleteMany({ where: { module: 'REQUEST', moduleId: parseInt(id) } });
        await prisma.request.delete({ where: { id: parseInt(id) } });

        res.status(200).json({ message: 'Request deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting request', error: error.message });
    }
};

// Admin/GM utility: Fix requests stuck at PENDING_GM for departments without GM in approval flow
exports.fixPendingGMRequests = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !['ADMIN', 'GM'].includes(user.role)) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const { department } = req.query;

        const whereClause = {
            status: 'PENDING_GM',
            ...(department ? { user: { department } } : {})
        };

        const pending = await prisma.request.findMany({
            where: whereClause,
            include: { user: true }
        });

        const fixedIds = [];

        for (const reqItem of pending) {
            const dept = reqItem.user?.department || null;
            const approvalConfig = await getActiveApprovalConfig('REQUEST', dept);
            if (!approvalConfig) {
                // No config found; skip to avoid changing departments intentionally using legacy that includes GM
                continue;
            }
            const hasGM = approvalConfig.steps.some(s => s.role === 'GM');
            if (hasGM) {
                // Config requires GM; skip
                continue;
            }

            // Skip any pending GM TransactionApproval steps
            await prisma.transactionApproval.updateMany({
                where: {
                    module: 'REQUEST',
                    moduleId: reqItem.id,
                    role: 'GM',
                    status: 'PENDING'
                },
                data: {
                    status: 'SKIPPED',
                    note: 'Auto-skipped by admin fix: GM not required by current config',
                    approvedAt: new Date()
                }
            });

            // Mark request as APPROVED
            const updated = await prisma.request.update({
                where: { id: reqItem.id },
                data: { status: 'APPROVED', gmApproved: true }
            });

            {
                const otMode = (process.env.OVERTIME_QUANTITY_MODE || 'manual').toLowerCase();
                if (otMode === 'auto' && reqItem.type === 'OVERTIME' && (!reqItem.quantity || reqItem.quantity <= 0)) {
                    try {
                        const qty = computeOvertimeQuantity(reqItem.startTime, reqItem.endTime);
                        if (qty > 0) {
                            await prisma.request.update({
                                where: { id: reqItem.id },
                                data: { quantity: qty }
                            });
                            reqItem.quantity = qty;
                        }
                    } catch (e) {
                        console.error("Failed to compute OT quantity (fixPendingGM):", e.message);
                    }
                }
            }

            try {
                await sendEmail(
                    reqItem.user.email,
                    `Request Approved: ${reqItem.type}`,
                    `<p>Congratulations! Your request for <b>${reqItem.type}</b> has been fully approved.</p>`
                );
            } catch (e) {}
            try {
                await createNotification(reqItem.userId, `Your ${reqItem.type} request has been FULLY APPROVED.`);
            } catch (e) {}

            try {
                await updateScheduleFromRequest(updated);
            } catch (e) {}

            if ((reqItem.type === 'LEAVE' || reqItem.type === 'PDO') && reqItem.quantity) {
                try {
                    let dataToUpdate = {};
                    if (reqItem.type === 'LEAVE') {
                        dataToUpdate = { leaveQuota: { decrement: reqItem.quantity } };
                    } else if (reqItem.type === 'PDO') {
                        dataToUpdate = { pdo: { decrement: reqItem.quantity } };
                    }
                    await prisma.user.update({
                        where: { id: reqItem.userId },
                        data: dataToUpdate
                    });
                } catch (e) {}
            }

            fixedIds.push(reqItem.id);
        }

        return res.status(200).json({
            processed: fixedIds.length,
            ids: fixedIds
        });
    } catch (error) {
        return res.status(500).json({ message: 'Error fixing pending GM requests', error: error.message });
    }
};

function computeOvertimeQuantity(startTime, endTime) {
    if (!startTime || !endTime) return 0;
    const [h1, m1] = String(startTime).split(':').map(Number);
    const [h2, m2] = String(endTime).split(':').map(Number);
    if ([h1, m1, h2, m2].some(v => Number.isNaN(v))) return 0;
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 1440;
    const hours = diff / 60;
    return Math.round(hours * 100) / 100;
}
async function updateScheduleFromRequest(request) {
    try {
        const { userId, type, startDate, endDate } = request;
        
        if (!startDate) return;

        // Fetch user to get department
        const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
        if (!user || !user.department) return;

        // Ensure dates are valid
        let currentDate = new Date(startDate);
        if (isNaN(currentDate.getTime())) {
             console.error(`Invalid startDate for request ${request.id}`);
             return;
        }
        currentDate.setUTCHours(0, 0, 0, 0);

        const end = endDate ? new Date(endDate) : new Date(currentDate);
        if (isNaN(end.getTime())) {
             end.setTime(currentDate.getTime());
        }
        end.setUTCHours(0, 0, 0, 0);
        
        // Map request types to schedule descriptions
        const typeMap = {
            'LEAVE': 'Cuti / Leave',
            'SICK': 'Sakit / Sick',
            'PERMISSION': 'Izin / Permission',
            'OFF': 'OFF',
            'EXTERNAL_DUTY': 'Dinas Luar / External Duty',
            'ADD_MANPOWER': 'Extra Manpower',
            'OVERTIME': 'Lembur / Overtime',
            'UNPAID_LEAVE': 'Cuti Tanpa Gaji / Unpaid Leave',
            'PDO': 'Pending Day Off'
        };

        const description = typeMap[type] || type;

        // Types that replace the shift (Absence)
        const absenceTypes = ['LEAVE', 'SICK', 'PERMISSION', 'OFF', 'EXTERNAL_DUTY', 'UNPAID_LEAVE', 'PDO'];

        if (absenceTypes.includes(type)) {
            // Mapping for MonthlySchedule.data codes
            const shiftCodeMap = {
                'LEAVE': 'C',
                'SICK': 'S',
                'PERMISSION': 'I',
                'OFF': 'OFF',
                'UNPAID_LEAVE': 'C',
                'PDO': 'PDO',
                'EXTERNAL_DUTY': 'D' // D is not in summary but will show in grid
            };
            const shiftCode = shiftCodeMap[type] || null;

            // Group dates by MonthlySchedule (month/year)
            const monthlyGroups = {};

            let tempDate = new Date(currentDate);
            while (tempDate <= end) {
                const dateOnly = new Date(tempDate);
                dateOnly.setUTCHours(0, 0, 0, 0);
                
                // Calculate MonthlySchedule target month/year (21st-20th logic)
                let targetMonth, targetYear;
                if (dateOnly.getUTCDate() <= 20) {
                    targetMonth = dateOnly.getUTCMonth() + 1;
                    targetYear = dateOnly.getUTCFullYear();
                } else {
                    targetMonth = dateOnly.getUTCMonth() + 2;
                    if (targetMonth > 12) {
                        targetMonth = 1;
                        targetYear = dateOnly.getUTCFullYear() + 1;
                    } else {
                        targetYear = dateOnly.getUTCFullYear();
                    }
                }

                const key = `${targetYear}-${targetMonth}`;
                if (!monthlyGroups[key]) {
                    monthlyGroups[key] = { month: targetMonth, year: targetYear, dates: [] };
                }
                monthlyGroups[key].dates.push(new Date(dateOnly));

                // Standard shift update logic (Individual Schedule table)
                const nextDay = new Date(dateOnly);
                nextDay.setUTCDate(nextDay.getUTCDate() + 1);

                console.log(`Updating Schedule for User ${userId} on ${dateOnly.toISOString()}`);

                await prisma.schedule.deleteMany({
                    where: {
                        userId: parseInt(userId),
                        date: { gte: dateOnly, lt: nextDay }
                    }
                });

                const shiftNameMap = {
                    'LEAVE': 'Cuti',
                    'SICK': 'Sakit',
                    'PERMISSION': 'Izin',
                    'OFF': 'OFF',
                    'UNPAID_LEAVE': 'Cuti',
                    'PDO': 'PDO',
                    'EXTERNAL_DUTY': 'Dinas Luar'
                };
                
                const shiftName = shiftNameMap[type] || null;

                await prisma.schedule.create({
                    data: {
                        userId: parseInt(userId),
                        date: dateOnly,
                        shiftStart: dateOnly,
                        shiftEnd: dateOnly,
                        description: description,
                        shiftName: shiftName
                    }
                });

                tempDate.setUTCDate(tempDate.getUTCDate() + 1);
            }

            // Sync with MonthlySchedule.data (for PDF and Grid)
            if (shiftCode) {
                for (const group of Object.values(monthlyGroups)) {
                    const monthlySchedule = await prisma.monthlySchedule.findFirst({
                        where: {
                            department: user.department,
                            month: group.month,
                            year: group.year
                        }
                    });

                    if (monthlySchedule) {
                        let scheduleData = typeof monthlySchedule.data === 'string' 
                            ? JSON.parse(monthlySchedule.data) 
                            : monthlySchedule.data;

                        if (Array.isArray(scheduleData)) {
                            // Format: [{ userId, shifts: { "YYYY-MM-DD": "M1" } }]
                            let staffEntry = scheduleData.find(s => parseInt(s.userId) === parseInt(userId));
                            if (!staffEntry) {
                                staffEntry = { userId: parseInt(userId), shifts: {} };
                                scheduleData.push(staffEntry);
                            }
                            if (!staffEntry.shifts) staffEntry.shifts = {};

                            group.dates.forEach(d => {
                                const dateStr = d.toISOString().split('T')[0];
                                staffEntry.shifts[dateStr] = shiftCode;
                            });
                        } else if (scheduleData && scheduleData.scheduleData) {
                            // Format: { scheduleData: { "userId": { "YYYY-MM-DD": "M1" } } }
                            if (!scheduleData.scheduleData[userId]) {
                                scheduleData.scheduleData[userId] = {};
                            }
                            group.dates.forEach(d => {
                                const dateStr = d.toISOString().split('T')[0];
                                scheduleData.scheduleData[userId][dateStr] = shiftCode;
                            });
                        }

                        await prisma.monthlySchedule.update({
                            where: { id: monthlySchedule.id },
                            data: { data: scheduleData }
                        });
                        console.log(`Updated MonthlySchedule ${monthlySchedule.id} for User ${userId}`);
                    }
                }
            }
        }
        
        // If this request has a Replacement Staff, mark their schedule as Extra Manpower on the same dates
        if (request.replacementName && ['LEAVE','SICK','PERMISSION','OFF','UNPAID_LEAVE','PDO','EXTERNAL_DUTY'].includes(type)) {
            let replacementUser = null;
            // Try parse "Name|ID" format first
            if (String(request.replacementName).includes('|')) {
                const parts = String(request.replacementName).split('|');
                const idStr = parts[1] && parts[1].trim();
                const parsedId = idStr ? parseInt(idStr, 10) : null;
                if (parsedId && !Number.isNaN(parsedId)) {
                    replacementUser = await prisma.user.findUnique({ where: { id: parsedId } });
                }
            }
            if (!replacementUser) {
                replacementUser = await prisma.user.findFirst({
                    where: {
                        OR: [
                            { name: request.replacementName },
                            { name: { contains: request.replacementName } }
                        ]
                    }
                });
            }
            if (replacementUser) {
                let tempDate = new Date(currentDate);
                while (tempDate <= end) {
                    const dateOnly = new Date(tempDate);
                    dateOnly.setUTCHours(0, 0, 0, 0);
                    const nextDay = new Date(dateOnly);
                    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

                    const existingRepl = await prisma.schedule.findFirst({
                        where: { userId: replacementUser.id, date: { gte: dateOnly, lt: nextDay } }
                    });

                    const replDesc = `Extra Manpower (Replacement for ${user.name})`;

                    if (existingRepl) {
                        await prisma.schedule.update({
                            where: { id: existingRepl.id },
                            data: {
                                description: replDesc,
                                shiftName: 'Extra Manpower'
                            }
                        });
                    } else {
                        await prisma.schedule.create({
                            data: {
                                userId: replacementUser.id,
                                date: dateOnly,
                                shiftStart: dateOnly,
                                shiftEnd: dateOnly,
                                description: replDesc,
                                shiftName: 'Extra Manpower'
                            }
                        });
                    }

                    // Update MonthlySchedule data (set code 'E')
                    const ms = await prisma.monthlySchedule.findFirst({
                        where: {
                            department: replacementUser.department || user.department,
                            month: dateOnly.getUTCMonth() + 1,
                            year: dateOnly.getUTCFullYear()
                        }
                    });
                    if (ms) {
                        let sData = typeof ms.data === 'string' ? JSON.parse(ms.data) : ms.data;
                        const dateStr = dateOnly.toISOString().split('T')[0];
                        const replId = parseInt(replacementUser.id);
                        if (Array.isArray(sData)) {
                            let entry = sData.find(s => parseInt(s.userId) === replId);
                            if (!entry) {
                                entry = { userId: replId, shifts: {} };
                                sData.push(entry);
                            }
                            if (!entry.shifts) entry.shifts = {};
                            entry.shifts[dateStr] = 'E';
                        } else if (sData && sData.scheduleData) {
                            if (!sData.scheduleData[replId]) sData.scheduleData[replId] = {};
                            sData.scheduleData[replId][dateStr] = 'E';
                        }
                        await prisma.monthlySchedule.update({
                            where: { id: ms.id },
                            data: { data: sData }
                        });
                    }

                    tempDate.setUTCDate(tempDate.getUTCDate() + 1);
                }
            }
        }

        // Handle SHIFT_EXCHANGE (Tukar Jadwal)
        if (type === 'SHIFT_EXCHANGE' && request.replacementDate) {
            const dateA = new Date(startDate);
            dateA.setUTCHours(0,0,0,0);
            
            const dateB = new Date(request.replacementDate);
            dateB.setUTCHours(0,0,0,0);
            
            const replacementUser = await prisma.user.findFirst({
                where: { name: request.replacementName }
            });

            if (replacementUser) {
                // Get original schedules for both users on both dates
                const getSched = async (uId, d) => {
                    const nextD = new Date(d);
                    nextD.setUTCDate(nextD.getUTCDate() + 1);
                    return await prisma.schedule.findFirst({
                        where: { userId: uId, date: { gte: d, lt: nextD } }
                    });
                };

                const schedReqA = await getSched(userId, dateA);
                const schedReqB = await getSched(userId, dateB);
                const schedReplA = await getSched(replacementUser.id, dateA);
                const schedReplB = await getSched(replacementUser.id, dateB);

                // Helper to apply a schedule to a user/date
                const applySched = async (uId, date, sourceSched) => {
                    const nextD = new Date(date);
                    nextD.setUTCDate(nextD.getUTCDate() + 1);
                    
                    // Delete existing
                    await prisma.schedule.deleteMany({
                        where: { userId: uId, date: { gte: date, lt: nextD } }
                    });

                    let finalShiftName = 'OFF';
                    let finalDescription = 'OFF (Exchange)';
                    let finalStart = date;
                    let finalEnd = date;

                    if (sourceSched && sourceSched.shiftName !== 'OFF') {
                        finalShiftName = sourceSched.shiftName;
                        finalDescription = sourceSched.description || 'Shift Exchange';
                        
                        const oldStart = new Date(sourceSched.shiftStart);
                        const oldEnd = new Date(sourceSched.shiftEnd);
                        const duration = oldEnd.getTime() - oldStart.getTime();
                        
                        const newStart = new Date(date);
                        newStart.setUTCHours(oldStart.getUTCHours(), oldStart.getUTCMinutes(), oldStart.getUTCSeconds());
                        finalStart = newStart;
                        finalEnd = new Date(newStart.getTime() + duration);
                    }

                    await prisma.schedule.create({
                        data: {
                            userId: uId,
                            date: date,
                            shiftStart: finalStart,
                            shiftEnd: finalEnd,
                            shiftName: finalShiftName,
                            description: finalDescription
                        }
                    });

                    return finalShiftName;
                };

                // Helper to sync to MonthlySchedule
                const updateMonthly = async (uId, date, newShiftCode, dept) => {
                    let m = date.getUTCMonth() + 1;
                    let y = date.getUTCFullYear();
                    if (date.getUTCDate() > 20) {
                        m += 1;
                        if (m > 12) { m = 1; y += 1; }
                    }

                    const ms = await prisma.monthlySchedule.findFirst({
                        where: { department: dept, month: m, year: y }
                    });

                    if (ms) {
                        let sData = typeof ms.data === 'string' ? JSON.parse(ms.data) : ms.data;
                        const dateStr = date.toISOString().split('T')[0];

                        // Map back special names to codes if necessary
                        let codeToSave = newShiftCode;
                        const reverseMap = { 'Cuti': 'C', 'Sakit': 'S', 'Izin': 'I', 'Dinas Luar': 'D' };
                        if (reverseMap[codeToSave]) codeToSave = reverseMap[codeToSave];

                        if (Array.isArray(sData)) {
                            let entry = sData.find(s => parseInt(s.userId) === parseInt(uId));
                            if (!entry) {
                                entry = { userId: parseInt(uId), shifts: {} };
                                sData.push(entry);
                            }
                            if (!entry.shifts) entry.shifts = {};
                            entry.shifts[dateStr] = codeToSave;
                        } else if (sData && sData.scheduleData) {
                            if (!sData.scheduleData[uId]) sData.scheduleData[uId] = {};
                            sData.scheduleData[uId][dateStr] = codeToSave;
                        }

                        await prisma.monthlySchedule.update({
                            where: { id: ms.id },
                            data: { data: sData }
                        });
                    }
                };

                // Execute Swap for Requester
                const newReqA = await applySched(userId, dateA, schedReplA);
                await updateMonthly(userId, dateA, newReqA, user.department);
                
                if (dateA.getTime() !== dateB.getTime()) {
                    const newReqB = await applySched(userId, dateB, schedReplB);
                    await updateMonthly(userId, dateB, newReqB, user.department);
                }

                // Execute Swap for Replacement
                const newReplA = await applySched(replacementUser.id, dateA, schedReqA);
                await updateMonthly(replacementUser.id, dateA, newReplA, replacementUser.department);

                if (dateA.getTime() !== dateB.getTime()) {
                    const newReplB = await applySched(replacementUser.id, dateB, schedReqB);
                    await updateMonthly(replacementUser.id, dateB, newReplB, replacementUser.department);
                }

                console.log(`Successfully performed shift exchange between ${user.name} and ${replacementUser.name}`);
            }
        }

        // Handle ADD_MANPOWER (Extra Man Power for existing staff)
        if (type === 'ADD_MANPOWER' && request.newEmployeeName) {
            const extraUser = await prisma.user.findFirst({
                where: { name: request.newEmployeeName }
            });

            if (extraUser) {
                let tempDate = new Date(currentDate);
                while (tempDate <= end) {
                    const dateOnly = new Date(tempDate);
                    dateOnly.setUTCHours(0, 0, 0, 0);
                    const nextDay = new Date(dateOnly);
                    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

                    const baseDesc = description || 'Extra Manpower';
                    const targetDept = request.targetDepartment || '';
                    const extraDesc = targetDept
                        ? `${baseDesc} ke ${targetDept}`
                        : baseDesc;

                    const existingExtra = await prisma.schedule.findFirst({
                        where: {
                            userId: extraUser.id,
                            date: { gte: dateOnly, lt: nextDay },
                            description: { contains: 'Extra Manpower' }
                        }
                    });

                    if (existingExtra) {
                        await prisma.schedule.update({
                            where: { id: existingExtra.id },
                            data: {
                                description: extraDesc,
                                shiftName: 'Extra Manpower'
                            }
                        });
                    } else {
                        await prisma.schedule.create({
                            data: {
                                userId: extraUser.id,
                                date: dateOnly,
                                shiftStart: dateOnly,
                                shiftEnd: dateOnly,
                                description: extraDesc,
                                shiftName: 'Extra Manpower'
                            }
                        });
                    }

                    // Sync extra manpower to MonthlySchedule grid (home department of extraUser)
                    if (extraUser.department) {
                        let targetMonth, targetYear;
                        if (dateOnly.getUTCDate() <= 20) {
                            targetMonth = dateOnly.getUTCMonth() + 1;
                            targetYear = dateOnly.getUTCFullYear();
                        } else {
                            targetMonth = dateOnly.getUTCMonth() + 2;
                            if (targetMonth > 12) {
                                targetMonth = 1;
                                targetYear = dateOnly.getUTCFullYear() + 1;
                            } else {
                                targetYear = dateOnly.getUTCFullYear();
                            }
                        }

                        const ms = await prisma.monthlySchedule.findFirst({
                            where: {
                                department: extraUser.department,
                                month: targetMonth,
                                year: targetYear
                            }
                        });

                        if (ms) {
                            let sData = typeof ms.data === 'string'
                                ? JSON.parse(ms.data)
                                : ms.data;

                            const dateStr = dateOnly.toISOString().split('T')[0];
                            const shiftCode = 'E'; // E = Extra Man Power
                            const extraUserId = parseInt(extraUser.id);

                            if (Array.isArray(sData)) {
                                let entry = sData.find(s => parseInt(s.userId) === extraUserId);
                                if (!entry) {
                                    entry = { userId: extraUserId, shifts: {} };
                                    sData.push(entry);
                                }
                                if (!entry.shifts) entry.shifts = {};
                                entry.shifts[dateStr] = shiftCode;
                            } else if (sData && sData.scheduleData) {
                                if (!sData.scheduleData[extraUserId]) {
                                    sData.scheduleData[extraUserId] = {};
                                }
                                sData.scheduleData[extraUserId][dateStr] = shiftCode;
                            }

                            await prisma.monthlySchedule.update({
                                where: { id: ms.id },
                                data: { data: sData }
                            });
                        }
                    }

                    tempDate.setUTCDate(tempDate.getUTCDate() + 1);
                }
            }
        }

    } catch (error) {
        console.error("Error updating schedule from request:", error);
        // Don't throw, just log.
    }
}

exports.downloadRequestPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const request = await prisma.request.findUnique({
            where: { id: parseInt(id) },
            include: { user: true }
        });

        if (!request) return res.status(404).json({ message: 'Request not found' });

        let attendanceInfo = null;
        if (request.type === 'OVERTIME') {
             // Widen search to cover WIB timezone (UTC-7 to UTC+7+24)
             const dateStart = new Date(request.startDate);
             dateStart.setHours(0, 0, 0, 0);
             dateStart.setTime(dateStart.getTime() - (12 * 60 * 60 * 1000)); // -12 hours

             const dateEnd = new Date(request.startDate);
             dateEnd.setHours(23, 59, 59, 999);
             dateEnd.setTime(dateEnd.getTime() + (12 * 60 * 60 * 1000)); // +12 hours

             const attendances = await prisma.attendance.findMany({
                 where: {
                     userId: request.userId,
                     timestamp: {
                         gte: dateStart,
                         lte: dateEnd
                     }
                 },
                 orderBy: { timestamp: 'asc' }
             });
             
             // Try to find attendance closest to the request start/end times if available
             // Or simply the first IN and last OUT in the range
             // Types can be 'CHECK_IN', 'EXTERNAL', 'IN' (legacy) for check-in
             // Types can be 'CHECK_OUT', 'OUT' (legacy) for check-out
             const checkIn = attendances.find(a => ['CHECK_IN', 'EXTERNAL', 'IN'].includes(a.type));
             
             // Find the last OUT that is after the checkIn
             const checkOut = attendances.filter(a => 
                ['CHECK_OUT', 'OUT'].includes(a.type) && 
                (checkIn ? a.timestamp > checkIn.timestamp : true)
             ).pop();
             
             attendanceInfo = {
                 checkIn: checkIn ? checkIn.timestamp : null,
                 checkOut: checkOut ? checkOut.timestamp : null
             };
        }

        const pdfBytes = await pdfService.generateRequestPDF(request, attendanceInfo);

        res.setHeader('Content-Type', 'application/pdf');
        // Remove attachment; to allow browser to choose between preview (inline) and download based on client request
        // But since we use Blob in client, this header mostly hints the type.
        // Ideally 'inline' for preview, 'attachment' for download. 
        // However, the client uses Blob URL so it handles the display.
        // We will keep 'attachment' as default but it doesn't strictly matter for Blob URL usage unless we used direct navigation.
        res.setHeader('Content-Disposition', `inline; filename=request-${id}.pdf`);
        res.send(Buffer.from(pdfBytes));

    } catch (error) {
        console.error("PDF Error:", error);
        res.status(500).json({ message: 'Error generating PDF', error: error.message });
    }
};

function mapRequestRoleToStatus(role) {
    if (role === 'HOD') return 'PENDING_HOD';
    if (role === 'SUPERVISOR') return 'PENDING_SUPERVISOR';
    if (role === 'HR') return 'PENDING_HR';
    if (role === 'FINANCE') return 'PENDING_HR';
    if (role === 'GM') return 'PENDING_GM';
    if (role === 'MERCHANDISE_HOD') return 'PENDING_MERCHANDISE_HOD';
    if (role === 'MERCHANDISE_SPV') return 'PENDING_MERCHANDISE_SPV';
    if (role === 'PHOTOGRAPHER_HOD') return 'PENDING_PHOTOGRAPHER_HOD';
    return 'PENDING_GM';
}

async function getActiveApprovalConfig(module, department) {
    return prisma.approvalConfig.findFirst({
        where: {
            module,
            enabled: true,
            OR: [
                { department },
                { department: null }
            ]
        },
        include: {
            steps: {
                orderBy: { order: 'asc' }
            },
            assignments: true
        },
        orderBy: [
            { department: 'desc' },
            { createdAt: 'desc' }
        ]
    });
}

async function getEligibleApproversForRequest(approvalConfig, role, department) {
    if (approvalConfig) {
        // Check if there is a specific step definition that includes approverDepartment
        const step = approvalConfig.steps.find(s => s.role === role);
        const approverDepartment = step ? step.approverDepartment : null;

        const assignedUserIds = approvalConfig.assignments
            .filter(a => (!a.department || a.department === (approverDepartment || department)) && (!a.role || a.role === role))
            .map(a => a.userId);

        if (assignedUserIds.length > 0) {
            const users = await prisma.user.findMany({
                where: { id: { in: assignedUserIds } }
            });

            // Filter users: 
            // 1. If assignment had a specific role, they are already filtered by the query above (a.role === role).
            // 2. If assignment was "Ikuti Role User" (role: null), we must check if their ACTUAL role matches the step role.
            //    Unless we want to allow "Delegation" where a non-role user approves. 
            //    But currently handleConfigRequestApproval enforces strict role check.
            //    So we should filter to avoid sending notifications to users who can't approve.
            
            return users.filter(u => {
                const assignment = approvalConfig.assignments.find(a => a.userId === u.id);
                if (assignment && assignment.role) {
                    return assignment.role === role;
                }
                // If assignment role is null (Follow User Role), check actual user role
                return u.role === role;
            });
        }

        // If we have an explicit approverDepartment in the step config, use it
        if (approverDepartment) {
            return prisma.user.findMany({
                where: { 
                    role, 
                    department: approverDepartment 
                }
            });
        }
    }

    const where = { role };
    if (role === 'HOD' && department) {
        where.department = department;
    }

    return prisma.user.findMany({ where });
}

async function handleLegacyRequestApproval({ res, user, request, action, reason }) {
    const id = request.id;

    if (action === 'REJECT') {
        await prisma.request.update({
            where: { id },
            data: {
                status: 'REJECTED',
                rejectionReason: reason
            }
        });

        sendEmail(
            request.user.email,
            `Request Rejected: ${request.type}`,
            `<p>Your request for <b>${request.type}</b> has been rejected by ${user.role}.</p>
             <p><strong>Reason:</strong> ${reason}</p>`
        ).catch(console.error);
        createNotification(request.userId, `Your ${request.type} request was REJECTED by ${user.role}. Reason: ${reason}`);

        return res.status(200).json({ message: 'Request rejected' });
    }

    let updateData = {};

    if (reason) {
        if (user.role === 'HOD') updateData.hodNote = reason;
        else if (user.role === 'SUPERVISOR') updateData.spvNote = reason;
        else if (user.role === 'HR' || user.role === 'FINANCE') updateData.hrNote = reason;
        else if (user.role === 'GM') updateData.gmNote = reason;
    }
    
    if (user.role === 'HOD' && request.status === 'PENDING_HOD') {
        updateData = { ...updateData, status: 'PENDING_SUPERVISOR', hodApproved: true };
    } else if (user.role === 'PHOTOGRAPHER_HOD' && request.status === 'PENDING_PHOTOGRAPHER_HOD') {
        updateData = { ...updateData, status: 'PENDING_MERCHANDISE_HOD', hodApproved: true };
    } else if (user.role === 'MERCHANDISE_HOD' && request.status === 'PENDING_MERCHANDISE_HOD') {
        updateData = { ...updateData, status: 'PENDING_MERCHANDISE_SPV', hodApproved: true };
    } else if (user.role === 'MERCHANDISE_SPV' && request.status === 'PENDING_MERCHANDISE_SPV') {
        // Assuming SPV is the last step before standard flow or just APPROVED if they are highest level for this flow.
        // User said "accounting merchandise (level tertinggi)". 
        // But usually Requests need HR/GM.
        // Let's route to HR for consistency with other flows, or maybe APPROVED if that's what "level tertinggi" means.
        // But requests usually need HR processing (leave quota, etc).
        // Let's route to PENDING_HR.
        updateData = { ...updateData, status: 'PENDING_HR', spvApproved: true };
    } else if (user.role === 'SUPERVISOR' && request.status === 'PENDING_SUPERVISOR') {
        updateData = { ...updateData, status: 'PENDING_HR', spvApproved: true };
    } else if ((user.role === 'HR' || user.role === 'FINANCE') && request.status === 'PENDING_HR') {
        if (request.user.role === 'GM') {
            updateData = { ...updateData, status: 'APPROVED', hrApproved: true, gmApproved: true };
        } else {
            updateData = { ...updateData, status: 'PENDING_GM', hrApproved: true };
        }
    } else if (user.role === 'GM' && request.status === 'PENDING_GM') {
        updateData = { ...updateData, status: 'APPROVED', gmApproved: true };
    } else {
        return res.status(400).json({ message: 'Invalid approval action for current status or role' });
    }

    const updated = await prisma.request.update({
        where: { id },
        data: updateData
    });

    if (updated.status === 'PENDING_SUPERVISOR') {
        const supervisors = await prisma.user.findMany({ where: { role: 'SUPERVISOR', department: request.user.department } });
        for (const spv of supervisors) {
            sendEmail(
                spv.email,
                'Request Pending Supervisor Approval',
                `<p>A request from <b>${request.user.name}</b> (${request.type}) has been approved by HOD and is pending your approval.</p>`
            ).catch(console.error);
            createNotification(spv.id, `Request from ${request.user.name} (${request.type}) approved by HOD, pending Supervisor approval.`);
            if (spv.whatsappNumber && spv.whatsappVerifiedAt) {
                const text = `Pengajuan ${request.type} dari ${request.user.name} menunggu persetujuan Supervisor.`;
                sendWhatsAppMessage({ to: spv.whatsappNumber, message: text }).catch(() => {});
            }
        }
    } else if (updated.status === 'PENDING_MERCHANDISE_HOD') {
        const hods = await prisma.user.findMany({ where: { role: 'MERCHANDISE_HOD', department: request.user.department } });
        for (const hod of hods) {
            sendEmail(
                hod.email,
                'Request Pending Merchandise HOD Approval',
                `<p>A request from <b>${request.user.name}</b> (${request.type}) is pending your approval.</p>`
            ).catch(console.error);
            createNotification(hod.id, `Request from ${request.user.name} (${request.type}) pending your approval.`);
            if (hod.whatsappNumber && hod.whatsappVerifiedAt) {
                const text = `Pengajuan ${request.type} dari ${request.user.name} menunggu persetujuan Merchandise HOD.`;
                sendWhatsAppMessage({ to: hod.whatsappNumber, message: text }).catch(() => {});
            }
        }
    } else if (updated.status === 'PENDING_MERCHANDISE_SPV') {
        const spvs = await prisma.user.findMany({ where: { role: 'MERCHANDISE_SPV', department: request.user.department } });
        for (const spv of spvs) {
            sendEmail(
                spv.email,
                'Request Pending Merchandise SPV Approval',
                `<p>A request from <b>${request.user.name}</b> (${request.type}) has been approved by Merchandise HOD and is pending your approval.</p>`
            ).catch(console.error);
            createNotification(spv.id, `Request from ${request.user.name} (${request.type}) approved by Merchandise HOD, pending your approval.`);
            if (spv.whatsappNumber && spv.whatsappVerifiedAt) {
                const text = `Pengajuan ${request.type} dari ${request.user.name} menunggu persetujuan Merchandise SPV.`;
                sendWhatsAppMessage({ to: spv.whatsappNumber, message: text }).catch(() => {});
            }
        }
    } else if (updated.status === 'PENDING_HR') {
        const hrs = await prisma.user.findMany({ where: { role: 'HR' } });
        for (const hr of hrs) {
            sendEmail(
                hr.email,
                'Request Pending HR Approval',
                `<p>A request from <b>${request.user.name}</b> (${request.type}) has been approved by Supervisor Operational and is pending your approval.</p>`
            ).catch(console.error);
            createNotification(hr.id, `Request from ${request.user.name} (${request.type}) approved by Supervisor Operational, pending HR approval.`);
            if (hr.whatsappNumber && hr.whatsappVerifiedAt) {
                const text = `Pengajuan ${request.type} dari ${request.user.name} menunggu persetujuan HR.`;
                sendWhatsAppMessage({ to: hr.whatsappNumber, message: text }).catch(() => {});
            }
        }
    } else if (updated.status === 'PENDING_GM') {
        const gms = await prisma.user.findMany({ where: { role: 'GM' } });
        for (const gm of gms) {
            sendEmail(
                gm.email,
                'Request Pending GM Approval',
                `<p>A request from <b>${request.user.name}</b> (${request.type}) has been approved by HR and is pending your approval.</p>`
            ).catch(console.error);
            createNotification(gm.id, `Request from ${request.user.name} (${request.type}) approved by HR, pending GM approval.`);
            if (gm.whatsappNumber && gm.whatsappVerifiedAt) {
                const text = `Pengajuan ${request.type} dari ${request.user.name} menunggu persetujuan GM.`;
                sendWhatsAppMessage({ to: gm.whatsappNumber, message: text }).catch(() => {});
            }
        }
    } else if (updated.status === 'APPROVED') {
        const otMode = (process.env.OVERTIME_QUANTITY_MODE || 'manual').toLowerCase();
        if (otMode === 'auto' && request.type === 'OVERTIME' && (!request.quantity || request.quantity <= 0)) {
            try {
                const qty = computeOvertimeQuantity(request.startTime, request.endTime);
                if (qty > 0) {
                    await prisma.request.update({
                        where: { id },
                        data: { quantity: qty }
                    });
                    request.quantity = qty;
                }
            } catch (e) {
                console.error("Failed to compute OT quantity (legacy):", e.message);
            }
        }
        sendEmail(
            request.user.email,
            `Request Approved: ${request.type}`,
            `<p>Congratulations! Your request for <b>${request.type}</b> has been fully approved.</p>`
        ).catch(console.error);
        createNotification(request.userId, `Your ${request.type} request has been FULLY APPROVED.`);

        await updateScheduleFromRequest(updated);

        if ((request.type === 'LEAVE' || request.type === 'PDO') && request.quantity) {
            try {
                let dataToUpdate = {};
                if (request.type === 'LEAVE') {
                    dataToUpdate = { leaveQuota: { decrement: request.quantity } };
                } else if (request.type === 'PDO') {
                    dataToUpdate = { pdo: { decrement: request.quantity } };
                }

                await prisma.user.update({
                    where: { id: request.userId },
                    data: dataToUpdate
                });
            } catch (err) {
                console.error("Error deducting quota:", err);
            }
        }
    }

    return res.status(200).json(updated);
}

function buildWibCreatedAtFilter(startDate, endDate) {
    const hasStart = typeof startDate === 'string' && startDate.trim().length > 0;
    const hasEnd = typeof endDate === 'string' && endDate.trim().length > 0;
    if (!hasStart && !hasEnd) return null;

    let start = null;
    let end = null;

    if (hasStart) {
        const s = new Date(`${startDate}T00:00:00+07:00`);
        if (!isNaN(s.getTime())) start = s;
    }
    if (hasEnd) {
        const e = new Date(`${endDate}T23:59:59.999+07:00`);
        if (!isNaN(e.getTime())) end = e;
    }

    if (!start && !end) return null;
    if (start && end) return { gte: start, lte: end };
    if (start) return { gte: start };
    return { lte: end };
}

exports.getSecurityLeaveWorkplaceApproved = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, department: true } });
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const privileged = user.role === 'ADMIN' || user.role === 'HR' || user.role === 'GM';
        const isSecurity = String(user.department || '').toLowerCase() === 'security';
        if (!privileged && !isSecurity) return res.status(403).json({ message: 'Forbidden' });

        const { startDate, endDate, includeConfirmed } = req.query;
        const createdAt = buildWibCreatedAtFilter(startDate, endDate);
        const where = {
            type: 'LEAVE_WORKPLACE',
            status: 'APPROVED',
        };
        if (createdAt) where.startDate = createdAt;
        if (String(includeConfirmed || '').toLowerCase() !== 'true') {
            where.securityReturnStatus = null;
        }

        const rows = await prisma.request.findMany({
            where,
            orderBy: [{ startDate: 'desc' }, { startTime: 'asc' }],
            include: {
                user: { select: { id: true, name: true, department: true, role: true } },
                securityReturnBy: { select: { id: true, name: true } },
            },
        });

        return res.json(rows);
    } catch (error) {
        console.error('getSecurityLeaveWorkplaceApproved error:', error);
        const msg = String(error?.message || '');
        if (msg.includes('Unknown column') || msg.includes('does not exist') || msg.includes('Invalid `prisma.request.findMany()` invocation')) {
            return res.status(500).json({
                message: 'Server error (DB belum update untuk Security Dashboard)',
                error: msg
            });
        }
        return res.status(500).json({ message: 'Server error', error: msg });
    }
};

exports.confirmSecurityReturn = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, department: true } });
        if (!user) return res.status(401).json({ message: 'Unauthorized' });

        const privileged = user.role === 'ADMIN' || user.role === 'HR' || user.role === 'GM';
        const isSecurity = String(user.department || '').toLowerCase() === 'security';
        if (!privileged && !isSecurity) return res.status(403).json({ message: 'Forbidden' });

        const id = parseInt(req.params.id);
        if (!id) return res.status(400).json({ message: 'Invalid request id' });

        const { status, note } = req.body;
        if (status !== 'RETURNED' && status !== 'NOT_RETURNED') {
            return res.status(400).json({ message: 'Invalid status' });
        }

        const request = await prisma.request.findUnique({
            where: { id },
            include: { user: { select: { id: true, name: true } } },
        });
        if (!request) return res.status(404).json({ message: 'Request not found' });
        if (request.type !== 'LEAVE_WORKPLACE') return res.status(400).json({ message: 'Request type not supported' });
        if (request.status !== 'APPROVED') return res.status(400).json({ message: 'Request is not fully approved yet' });

        const updated = await prisma.request.update({
            where: { id },
            data: {
                securityReturnStatus: status,
                securityReturnNote: typeof note === 'string' ? note : null,
                securityReturnAt: new Date(),
                securityReturnById: user.id,
            },
            include: {
                user: { select: { id: true, name: true, department: true, role: true } },
                securityReturnBy: { select: { id: true, name: true } },
            },
        });

        try {
            createNotification(updated.userId, `Konfirmasi Security untuk izin meninggalkan tempat kerja: ${status === 'RETURNED' ? 'Sudah kembali' : 'Tidak kembali'}.`);
        } catch {}

        return res.json(updated);
    } catch (error) {
        console.error('confirmSecurityReturn error:', error);
        const msg = String(error?.message || '');
        if (msg.includes('Unknown column') || msg.includes('does not exist') || msg.includes('Invalid `prisma.request.update()` invocation')) {
            return res.status(500).json({
                message: 'Server error (DB belum update untuk Security Dashboard)',
                error: msg
            });
        }
        return res.status(500).json({ message: 'Server error', error: msg });
    }
};

async function handleConfigRequestApproval({ res, user, request, action, reason, txApprovals }) {
    const id = request.id;
    const department = request.user.department || null;

    const activeStep = txApprovals.find(t => t.status === 'PENDING');
    if (!activeStep) {
        return res.status(400).json({ message: 'No pending approval step' });
    }

    // Check if user is allowed to approve this step
    // 1. User has the required role (with HR/FINANCE treated as same stage)
    // 2. User is explicitly assigned to this role in the active config
    // 3. User has a specialized role that maps to the active step's role (e.g., MERCHANDISE_SPV -> SUPERVISOR)
    let isAllowed = false;

    const spvGroup = ['SUPERVISOR', 'MERCHANDISE_SPV'];
    const hodGroup = ['HOD', 'MERCHANDISE_HOD', 'PHOTOGRAPHER_HOD'];
    const normalizeRole = (r) => {
        if (r === 'MERCHANDISE_SPV') return 'SUPERVISOR';
        if (r === 'MERCHANDISE_HOD' || r === 'PHOTOGRAPHER_HOD') return 'HOD';
        return r;
    };

    if (['HR', 'FINANCE'].includes(activeStep.role)) {
        if (['HR', 'FINANCE'].includes(user.role)) {
            isAllowed = true;
        }
    } else if (normalizeRole(activeStep.role) === 'SUPERVISOR') {
        if (spvGroup.includes(user.role) || normalizeRole(user.role) === 'SUPERVISOR') {
            // Allow if same department as requester or explicit approverDepartment matches, 
            // or approverDepartment not set (legacy steps)
            if (!activeStep.approverDepartment || activeStep.approverDepartment === user.department || request.user.department === user.department) {
                isAllowed = true;
            }
        }
    } else if (normalizeRole(activeStep.role) === 'HOD') {
        if (hodGroup.includes(user.role) || normalizeRole(user.role) === 'HOD') {
            if (!activeStep.approverDepartment || activeStep.approverDepartment === user.department || request.user.department === user.department) {
                isAllowed = true;
            }
        }
    } else {
        isAllowed = normalizeRole(user.role) === normalizeRole(activeStep.role);
    }

    if (!isAllowed) {
        // Handle specialized role mapping for department-specific supervisors/HODs
        if (user.department && activeStep.approverDepartment === user.department) {
            if (activeStep.role === 'SUPERVISOR' && user.role.includes('_SPV')) {
                isAllowed = true;
            } else if (activeStep.role === 'HOD' && user.role.includes('_HOD')) {
                isAllowed = true;
            }
        }
    }

    if (!isAllowed) {
        // Check explicit assignment
        const approvalConfig = await getActiveApprovalConfig('REQUEST', department);
        if (approvalConfig) {
            const assignment = approvalConfig.assignments.find(a => 
                a.userId === user.id && 
                (
                    a.role === activeStep.role || 
                    (a.role === null && normalizeRole(user.role) === normalizeRole(activeStep.role))
                )
            );
            if (assignment) {
                isAllowed = true;
            }
        }
    }

    if (!isAllowed) {
        return res.status(403).json({ message: 'You are not allowed to approve this step' });
    }

    if (action === 'REJECT') {
        await prisma.transactionApproval.update({
            where: { id: activeStep.id },
            data: {
                status: 'REJECTED',
                note: reason || null,
                userId: user.id,
                approvedAt: new Date()
            }
        });

        await prisma.request.update({
            where: { id },
            data: {
                status: 'REJECTED',
                rejectionReason: reason
            }
        });

        sendEmail(
            request.user.email,
            `Request Rejected: ${request.type}`,
            `<p>Your request for <b>${request.type}</b> has been rejected by ${user.role}.</p>
             <p><strong>Reason:</strong> ${reason}</p>`
        ).catch(console.error);
        createNotification(request.userId, `Your ${request.type} request was REJECTED by ${user.role}. Reason: ${reason}`);

        return res.status(200).json({ message: 'Request rejected' });
    }

    let updateData = {};

    if (reason) {
        if (user.role === 'HOD') updateData.hodNote = reason;
        else if (user.role === 'SUPERVISOR') updateData.spvNote = reason;
        else if (user.role === 'HR' || user.role === 'FINANCE') updateData.hrNote = reason;
        else if (user.role === 'GM') updateData.gmNote = reason;
    }
    
    if (user.role === 'HOD') updateData.hodApproved = true;
    else if (user.role === 'SUPERVISOR') updateData.spvApproved = true;
    else if (user.role === 'HR' || user.role === 'FINANCE') updateData.hrApproved = true;
    else if (user.role === 'GM') updateData.gmApproved = true;
    else if (user.role === 'MERCHANDISE_HOD') updateData.hodApproved = true;
    else if (user.role === 'MERCHANDISE_SPV') updateData.spvApproved = true;
    else if (user.role === 'PHOTOGRAPHER_HOD') updateData.hodApproved = true;

    await prisma.transactionApproval.update({
        where: { id: activeStep.id },
        data: {
            status: 'APPROVED',
            note: reason || null,
            userId: user.id,
            approvedAt: new Date()
        }
    });

    const remainingSteps = txApprovals
        .filter(t => t.stepOrder > activeStep.stepOrder && t.status === 'PENDING')
        .sort((a, b) => a.stepOrder - b.stepOrder);

    // Align remaining steps with current active ApprovalConfig (skip roles removed from config)
    let nextStep = null;
    try {
        const approvalConfig = await getActiveApprovalConfig('REQUEST', department);
        const allowedRoles = approvalConfig ? approvalConfig.steps.map(s => s.role) : [];
        for (const step of remainingSteps) {
            if (allowedRoles.length === 0 || allowedRoles.includes(step.role)) {
                nextStep = step;
                break;
            } else {
                // Skip this step since role no longer exists in active config
                await prisma.transactionApproval.update({
                    where: { id: step.id },
                    data: {
                        status: 'SKIPPED',
                        note: 'Auto-skipped: role removed from current approval config',
                        approvedAt: new Date()
                    }
                });
            }
        }
    } catch (e) {
        // If config cannot be fetched, fall back to previous behavior (use first pending)
        nextStep = remainingSteps[0] || null;
    }

    if (nextStep) {
        updateData.status = mapRequestRoleToStatus(nextStep.role);
    } else {
        updateData.status = 'APPROVED';
    }

    const updated = await prisma.request.update({
        where: { id },
        data: updateData
    });

    if (nextStep) {
        const approvalConfig = await getActiveApprovalConfig('REQUEST', department);
        const approvers = await getEligibleApproversForRequest(approvalConfig, nextStep.role, department);

        for (const approver of approvers) {
            sendEmail(
                approver.email,
                'Request Pending Approval',
                `<p>A request from <b>${request.user.name}</b> (${request.type}) is pending your approval.</p>`
            ).catch(console.error);
            createNotification(approver.id, `Request from ${request.user.name} (${request.type}) is pending your approval.`);
            if (approver.whatsappNumber && approver.whatsappVerifiedAt) {
                const text = `Pengajuan ${request.type} dari ${request.user.name} menunggu persetujuan Anda.`;
                sendWhatsAppMessage({ to: approver.whatsappNumber, message: text }).catch(() => {});
            }
        }
    } else if (updated.status === 'APPROVED') {
        const otMode = (process.env.OVERTIME_QUANTITY_MODE || 'manual').toLowerCase();
        if (otMode === 'auto' && request.type === 'OVERTIME' && (!request.quantity || request.quantity <= 0)) {
            try {
                const qty = computeOvertimeQuantity(request.startTime, request.endTime);
                if (qty > 0) {
                    await prisma.request.update({
                        where: { id },
                        data: { quantity: qty }
                    });
                    request.quantity = qty;
                }
            } catch (e) {
                console.error("Failed to compute OT quantity (config):", e.message);
            }
        }
        sendEmail(
            request.user.email,
            `Request Approved: ${request.type}`,
            `<p>Congratulations! Your request for <b>${request.type}</b> has been fully approved.</p>`
        ).catch(console.error);
        createNotification(request.userId, `Your ${request.type} request has been FULLY APPROVED.`);

        await updateScheduleFromRequest(updated);

        if ((request.type === 'LEAVE' || request.type === 'PDO') && request.quantity) {
            try {
                let dataToUpdate = {};
                if (request.type === 'LEAVE') {
                    dataToUpdate = { leaveQuota: { decrement: request.quantity } };
                } else if (request.type === 'PDO') {
                    dataToUpdate = { pdo: { decrement: request.quantity } };
                }

                await prisma.user.update({
                    where: { id: request.userId },
                    data: dataToUpdate
                });
            } catch (err) {
                console.error("Error deducting quota:", err);
            }
        }
    }

    return res.status(200).json(updated);
}
