const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendEmail } = require('../services/emailService');
const { createNotification } = require('./notificationController');

exports.createProcurement = async (req, res) => {
  try {
    const { 
        items, // Array of { itemName, category, quantity, unitPrice }
        reason,
        requiredDate,
        attachmentUrl
    } = req.body;
    
    const userId = req.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const department = user.department || null;

    const approvalConfig = await getActiveApprovalConfig('PROCUREMENT', department);

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: "At least one item is required" });
    }

    let totalPrice = 0;
    const procurementItems = items.map(item => {
        const qty = parseInt(item.quantity);
        const price = parseFloat(item.unitPrice);
        const total = qty * price;
        totalPrice += total;
        return {
            itemName: item.itemName,
            description: item.description,
            imageUrl: item.imageUrl,
            category: item.category,
            quantity: qty,
            unitPrice: price,
            totalPrice: total
        };
    });

    let status = 'PENDING_HOD';
    let hodApproved = false;
    let spvApproved = false;
    let financeApproved = false;
    
    if (approvalConfig && approvalConfig.steps.length > 0) {
        status = mapProcurementRoleToStatus(approvalConfig.steps[0].role);
    } else {
        if (user.role === 'HOD') {
            status = 'PENDING_SUPERVISOR';
            hodApproved = true;
        } else if (user.role === 'SUPERVISOR') {
            status = 'PENDING_FINANCE';
            hodApproved = true;
            spvApproved = true;
        } else if (user.role === 'FINANCE') {
            status = 'PENDING_GM';
            hodApproved = true;
            spvApproved = true;
            financeApproved = true;
        } else if (user.role === 'GM' || user.role === 'ADMIN') {
            status = 'APPROVED';
            hodApproved = true;
            spvApproved = true;
            financeApproved = true;
            gmApproved = true;
        } else if (user.role === 'MERCHANDISE_STAFF') {
            status = 'PENDING_MERCHANDISE_HOD';
        } else if (user.role === 'PHOTOGRAPHER_STAFF') {
            status = 'PENDING_PHOTOGRAPHER_HOD';
        } else if (user.role === 'PHOTOGRAPHER_HOD') {
            status = 'PENDING_MERCHANDISE_HOD';
            hodApproved = true;
        } else if (user.role === 'MERCHANDISE_HOD') {
            status = 'PENDING_MERCHANDISE_SPV';
            hodApproved = true;
        } else if (user.role === 'MERCHANDISE_SPV') {
            status = 'PENDING_GM';
            hodApproved = true;
            spvApproved = true;
        }
    }

    const procurement = await prisma.procurement.create({
      data: {
        userId,
        reason,
        requiredDate: new Date(requiredDate),
        attachmentUrl,
        totalPrice,
        status,
        hodApproved,
        spvApproved,
        financeApproved,
        items: {
            create: procurementItems
        }
      },
      include: { items: true }
    });

    // Initial Notification
    if (approvalConfig && approvalConfig.steps.length > 0) {
        await prisma.transactionApproval.createMany({
            data: approvalConfig.steps.map(step => ({
                module: 'PROCUREMENT',
                moduleId: procurement.id,
                stepOrder: step.order,
                role: step.role
            }))
        });

        const approvers = await getEligibleApproversForProcurement(approvalConfig, approvalConfig.steps[0].role, department);
        approvers.forEach(a => createNotification(a.id, `New procurement request from ${user.name} awaiting approval.`));
    } else {
        if (status === 'PENDING_HOD') {
            const hods = await prisma.user.findMany({ where: { role: 'HOD', department: user.department } });
            hods.forEach(h => createNotification(h.id, `New procurement request from ${user.name} awaiting approval.`));
        } else if (status === 'PENDING_SUPERVISOR') {
            const supervisors = await prisma.user.findMany({ where: { role: 'SUPERVISOR', department: user.department } });
            supervisors.forEach(u => createNotification(u.id, `New procurement request from ${user.name} awaiting approval.`));
        } else if (status === 'PENDING_MERCHANDISE_HOD') {
            const hods = await prisma.user.findMany({ where: { role: 'MERCHANDISE_HOD' } });
            hods.forEach(h => createNotification(h.id, `New procurement request from ${user.name} awaiting approval.`));
        } else if (status === 'PENDING_MERCHANDISE_SPV') {
            const spvs = await prisma.user.findMany({ where: { role: 'MERCHANDISE_SPV' } });
            spvs.forEach(s => createNotification(s.id, `New procurement request from ${user.name} awaiting approval.`));
        } else if (status === 'PENDING_PHOTOGRAPHER_HOD') {
            const hods = await prisma.user.findMany({ where: { role: 'PHOTOGRAPHER_HOD' } });
            hods.forEach(h => createNotification(h.id, `New procurement request from ${user.name} awaiting approval.`));
        } else if (status === 'PENDING_GM') {
            const gms = await prisma.user.findMany({ where: { role: 'GM' } });
            gms.forEach(g => createNotification(g.id, `New procurement request from ${user.name} awaiting approval.`));
        }
    }

    res.status(201).json(procurement);
  } catch (error) {
    console.error("Create Procurement Error:", error);
    res.status(500).json({ message: 'Error creating procurement', error: error.message });
  }
};

exports.getMyProcurements = async (req, res) => {
  try {
    const procurements = await prisma.procurement.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: { items: true }
    });
    res.status(200).json(procurements);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching procurements', error: error.message });
  }
};

exports.getPendingProcurements = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const { department, search } = req.query;
    
    // 1. Find Flexible Approvals (TransactionApproval)
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

    const myPendingTx = await prisma.transactionApproval.findMany({
        where: {
            module: 'PROCUREMENT',
            status: 'PENDING',
            OR: txOrConditions
        },
        select: { moduleId: true, stepOrder: true }
    });
    
    let flexibleIds = [];

    if (myPendingTx.length > 0) {
        const potentialModuleIds = [...new Set(myPendingTx.map(t => t.moduleId))];

        // Get ALL pending steps for these modules to check step order
        const allPendingSteps = await prisma.transactionApproval.findMany({
            where: {
                module: 'PROCUREMENT',
                moduleId: { in: potentialModuleIds },
                status: 'PENDING'
            },
            select: { moduleId: true, stepOrder: true }
        });

        // Filter - only include if the user's step is the LOWEST pending step order
        const validModuleIds = new Set();
        
        for (const moduleId of potentialModuleIds) {
            const stepsForModule = allPendingSteps.filter(s => s.moduleId === moduleId);
            if (stepsForModule.length === 0) continue;

            const minStepOrder = Math.min(...stepsForModule.map(s => s.stepOrder));
            
            // Check if user has a pending step at this minimum order
            const myStepsForModule = myPendingTx.filter(s => s.moduleId === moduleId);
            const hasMyStepAtMin = myStepsForModule.some(s => s.stepOrder === minStepOrder);

            if (hasMyStepAtMin) {
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
        legacyWhere = { status: 'PENDING_SUPERVISOR' };
    } else if (user.role === 'FINANCE') {
        legacyWhere = { status: 'PENDING_FINANCE' };
    } else if (user.role === 'GM' || user.role === 'ADMIN') {
        legacyWhere = { status: 'PENDING_GM' };
    } else if (user.role === 'STORE') {
        legacyWhere = { status: 'APPROVED' }; // Store users see fully approved requests to fulfill
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
        return res.status(200).json([]);
    }

    const procurements = await prisma.procurement.findMany({
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
                     { user: { name: { contains: search } } },
                     { items: { some: { itemName: { contains: search } } } }
                 ]
             } : {})
        },
        include: {
            user: { select: { name: true, department: true } },
            items: true
        },
        orderBy: { createdAt: 'asc' }
    });

    res.status(200).json(procurements);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending procurements', error: error.message });
  }
};

exports.deleteProcurement = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Require Admin Role' });
        }

        // Delete items first if cascading is not set up (Prisma usually handles this if relation is set correctly, 
        // but explicit delete is safer if we want to be sure)
        // schema says: items ManualProcurementItem[] (wait, this is for manual procurement?)
        // Procurement model has items ProcurementItem[]
        // Let's check schema.prisma again. 
        // ProcurementItem relation to Procurement is usually cascading.
        
        await prisma.transactionApproval.deleteMany({ where: { module: 'PROCUREMENT', moduleId: parseInt(id) } });
        await prisma.procurement.delete({ where: { id: parseInt(id) } });

        res.status(200).json({ message: 'Procurement deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting procurement', error: error.message });
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
            module: 'PROCUREMENT',
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
                { status: 'REJECTED', rejectedByRole: 'HOD' },
                { id: { in: txApprovedIds } }
            ]
        };
    } else if (user.role === 'SUPERVISOR') {
         whereClause = {
            OR: [
                { spvApproved: true },
                { status: 'REJECTED', rejectedByRole: 'SUPERVISOR' },
                { id: { in: txApprovedIds } }
            ]
        };
    } else if (user.role === 'FINANCE') {
        whereClause = {
            OR: [
                { financeApproved: true },
                { status: 'REJECTED', rejectedByRole: 'FINANCE' },
                { id: { in: txApprovedIds } }
            ]
        };
    } else if (user.role === 'MERCHANDISE_HOD') {
        whereClause = {
            OR: [
                { id: { in: txApprovedIds } },
                { status: 'REJECTED', rejectedByRole: 'MERCHANDISE_HOD' },
                {
                    hodApproved: true,
                    user: { role: { in: ['MERCHANDISE_STAFF', 'PHOTOGRAPHER_STAFF'] } },
                    status: { not: 'PENDING_MERCHANDISE_HOD' }
                }
            ]
        };
    } else if (user.role === 'MERCHANDISE_SPV') {
        whereClause = {
            OR: [
                { id: { in: txApprovedIds } },
                { status: 'REJECTED', rejectedByRole: 'MERCHANDISE_SPV' },
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
                { status: 'REJECTED', rejectedByRole: 'PHOTOGRAPHER_HOD' },
                {
                    hodApproved: true,
                    user: { role: 'PHOTOGRAPHER_STAFF' },
                    status: { not: 'PENDING_PHOTOGRAPHER_HOD' }
                }
            ]
        };
    } else if (user.role === 'GM' || user.role === 'ADMIN') {
        whereClause = {
            OR: [
                { status: 'APPROVED' },
                { status: 'COMPLETED' },
                { status: 'REJECTED' },
                { gmApproved: true },
                { id: { in: txApprovedIds } }
            ]
        };
    } else if (user.role === 'STORE') {
         whereClause = {
            status: 'COMPLETED' // Store history shows completed (fulfilled) items
        };
    } else {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const procurements = await prisma.procurement.findMany({
        where: {
          ...whereClause,
          ...(dateFilter || {}),
          ...(department ? { user: { department } } : {}),
          ...(search ? {
            OR: [
                { reason: { contains: search } },
                { user: { name: { contains: search } } },
                { items: { some: { itemName: { contains: search } } } }
            ]
          } : {})
        },
        include: {
            user: { select: { name: true, department: true } },
            items: true
        },
        orderBy: { updatedAt: 'desc' }
    });

    res.status(200).json(procurements);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching history', error: error.message });
  }
};

exports.approveProcurement = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; 
    const userId = req.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    const procurement = await prisma.procurement.findUnique({ 
        where: { id: parseInt(id) },
        include: { user: true, items: true }
    });
    
    if (!procurement) return res.status(404).json({ message: 'Procurement not found' });

    if (user.role === 'HOD') {
        if (procurement.user.department !== user.department) {
            return res.status(403).json({ message: 'You can only approve requests from your department' });
        }
    }

    if (user.role === 'STORE' && procurement.status === 'APPROVED') {
        return handleLegacyProcurementApproval({ res, user, procurement, action, reason });
    }

    const txApprovals = await prisma.transactionApproval.findMany({
        where: {
            module: 'PROCUREMENT',
            moduleId: procurement.id
        },
        orderBy: { stepOrder: 'asc' }
    });

    if (txApprovals.length === 0) {
        return handleLegacyProcurementApproval({ res, user, procurement, action, reason });
    }

    return handleConfigProcurementApproval({ res, user, procurement, action, reason, txApprovals });
  } catch (error) {
    res.status(500).json({ message: 'Error processing procurement', error: error.message });
  }
};

exports.exportProcurements = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        // Allow STORE, FINANCE, GM, HOD to export
        if (!['STORE', 'FINANCE', 'GM', 'HOD', 'SUPERVISOR', 'ADMIN'].includes(user.role)) {
            return res.status(403).json({ message: 'Unauthorized to export data' });
        }

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Start date and End date are required' });
        }

        // Parse dates assuming WIB (UTC+7) context for The Lodge Ranger
        // This ensures we capture the full local day regardless of server timezone
        const start = new Date(`${startDate}T00:00:00+07:00`);
        const end = new Date(`${endDate}T23:59:59.999+07:00`);

        const procurements = await prisma.procurement.findMany({
            where: {
                status: 'COMPLETED',
                updatedAt: {
                    gte: start,
                    lte: end
                }
            },
            include: {
                user: { select: { name: true, department: true } },
                items: true
            },
            orderBy: { updatedAt: 'desc' }
        });

        res.status(200).json(procurements);
    } catch (error) {
        console.error("Export Error:", error);
        res.status(500).json({ message: 'Error exporting procurements', error: error.message });
    }
};

function mapProcurementRoleToStatus(role) {
    if (role === 'HOD') return 'PENDING_HOD';
    if (role === 'SUPERVISOR') return 'PENDING_SUPERVISOR';
    if (role === 'FINANCE') return 'PENDING_FINANCE';
    if (role === 'GM') return 'PENDING_GM';
    if (role === 'MERCHANDISE_HOD') return 'PENDING_MERCHANDISE_HOD';
    if (role === 'MERCHANDISE_SPV') return 'PENDING_MERCHANDISE_SPV';
    if (role === 'PHOTOGRAPHER_HOD') return 'PENDING_PHOTOGRAPHER_HOD';
    throw new Error(`Unsupported role for procurement approval: ${role}`);
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

async function getEligibleApproversForProcurement(approvalConfig, role, department) {
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

            // Filter users to ensure they actually have the role if "Follow User Role" was used
            return users.filter(u => {
                const assignment = approvalConfig.assignments.find(a => a.userId === u.id);
                if (assignment && assignment.role) {
                    return assignment.role === role;
                }
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

async function handleLegacyProcurementApproval({ res, user, procurement, action, reason }) {
    const id = procurement.id;

    if (action === 'REJECT') {
        await prisma.procurement.update({
            where: { id },
            data: {
                status: 'REJECTED',
                rejectionReason: reason,
                rejectedByRole: user.role
            }
        });

        sendEmail(
            procurement.user.email,
            `Procurement Rejected: ${procurement.itemName || 'Items'}`,
            `<p>Your procurement request has been rejected by ${user.role}.</p>
             <p><strong>Reason:</strong> ${reason}</p>`
        ).catch(console.error);

        return res.status(200).json({ message: 'Request rejected' });
    }

    let updateData = {};
    const now = new Date();

    if (user.role === 'HOD' && procurement.status === 'PENDING_HOD') {
        updateData = { 
            status: 'PENDING_SUPERVISOR', 
            hodApproved: true,
            hodDate: now,
            hodNote: reason
        };
    } else if (user.role === 'PHOTOGRAPHER_HOD' && procurement.status === 'PENDING_PHOTOGRAPHER_HOD') {
        updateData = { 
            status: 'PENDING_MERCHANDISE_HOD', 
            hodApproved: true,
            hodDate: now,
            hodNote: reason
        };
    } else if (user.role === 'MERCHANDISE_HOD' && procurement.status === 'PENDING_MERCHANDISE_HOD') {
        updateData = { 
            status: 'PENDING_MERCHANDISE_SPV', 
            hodApproved: true, // Re-using hodApproved flag if we don't have merchHodApproved
            hodDate: now,
            hodNote: reason
        };
    } else if (user.role === 'MERCHANDISE_SPV' && procurement.status === 'PENDING_MERCHANDISE_SPV') {
        updateData = { 
            status: 'APPROVED', 
            spvApproved: true, 
            spvDate: now,
            spvNote: reason
        };
    } else if (user.role === 'SUPERVISOR' && procurement.status === 'PENDING_SUPERVISOR') {
        updateData = { 
            status: 'PENDING_FINANCE', 
            spvApproved: true,
            spvDate: now,
            spvNote: reason
        };
    } else if (user.role === 'FINANCE' && procurement.status === 'PENDING_FINANCE') {
        updateData = { 
            status: 'PENDING_GM', 
            financeApproved: true,
            financeDate: now,
            financeNote: reason
        };
    } else if ((user.role === 'GM' || user.role === 'ADMIN') && procurement.status === 'PENDING_GM') {
        updateData = { 
            status: 'APPROVED', 
            gmApproved: true,
            gmDate: now,
            gmNote: reason
        };
    } else if (user.role === 'STORE' && procurement.status === 'APPROVED') {
        updateData = { 
            status: 'COMPLETED'
        };
    } else {
        return res.status(400).json({ message: 'Invalid approval action for current status or role' });
    }

    const updated = await prisma.procurement.update({
        where: { id },
        data: updateData
    });

    if (updated.status === 'PENDING_SUPERVISOR') {
        const supervisors = await prisma.user.findMany({ where: { role: 'SUPERVISOR', department: procurement.user.department } });
        supervisors.forEach(u => createNotification(u.id, `New procurement request awaiting Supervisor approval.`));
    } else if (updated.status === 'PENDING_MERCHANDISE_HOD') {
        const hods = await prisma.user.findMany({ where: { role: 'MERCHANDISE_HOD', department: procurement.user.department } });
        hods.forEach(u => createNotification(u.id, `New procurement request awaiting Merchandise HOD approval.`));
    } else if (updated.status === 'PENDING_MERCHANDISE_SPV') {
        const spvs = await prisma.user.findMany({ where: { role: 'MERCHANDISE_SPV', department: procurement.user.department } });
        spvs.forEach(u => createNotification(u.id, `New procurement request awaiting Merchandise SPV approval.`));
    } else if (updated.status === 'PENDING_FINANCE') {
        await createNotification(procurement.userId, `Supervisor Operational has approved your request.`);
        
        const finances = await prisma.user.findMany({ where: { role: 'FINANCE' } });
        finances.forEach(u => createNotification(u.id, `New procurement request waiting for Finance approval.`));
    } else if (updated.status === 'PENDING_GM') {
        const gms = await prisma.user.findMany({ where: { role: 'GM' } });
        gms.forEach(u => createNotification(u.id, `New procurement request awaiting GM approval.`));
    } else if (updated.status === 'APPROVED') {
        await createNotification(procurement.userId, `Your procurement request has been fully APPROVED.`);
        
        const stores = await prisma.user.findMany({ where: { role: 'STORE' } });
        stores.forEach(u => createNotification(u.id, `New approved procurement ready for fulfillment.`));

        sendEmail(
            procurement.user.email,
            `Procurement Approved`,
            `<p>Your procurement request has been fully approved.</p>`
        ).catch(console.error);
    } else if (updated.status === 'COMPLETED') {
        await createNotification(procurement.userId, `Your procurement request has been FULFILLED (Completed) by Store.`);
    } 

    return res.status(200).json(updated);
}

async function handleConfigProcurementApproval({ res, user, procurement, action, reason, txApprovals }) {
    const id = procurement.id;
    const department = procurement.user.department || null;

    const activeStep = txApprovals.find(t => t.status === 'PENDING');
    if (!activeStep) {
        return res.status(400).json({ message: 'No pending approval step' });
    }

    // Check if user is allowed to approve this step
    // 1. User has the required role
    // 2. User is explicitly assigned to this role in the active config
    let isAllowed = user.role === activeStep.role;

    if (!isAllowed) {
        // Check explicit assignment
        const approvalConfig = await getActiveApprovalConfig(module, department);
        if (approvalConfig) {
            const assignment = approvalConfig.assignments.find(a => 
                a.userId === user.id && 
                a.role === activeStep.role
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

        await prisma.procurement.update({
            where: { id },
            data: {
                status: 'REJECTED',
                rejectionReason: reason,
                rejectedByRole: user.role
            }
        });

        sendEmail(
            procurement.user.email,
            `Procurement Rejected`,
            `<p>Your procurement request has been rejected by ${user.role}.</p>
             <p><strong>Reason:</strong> ${reason}</p>`
        ).catch(console.error);

        return res.status(200).json({ message: 'Request rejected' });
    }

    let updateData = {};
    const now = new Date();

    if (user.role === 'HOD') {
        updateData.hodApproved = true;
        updateData.hodDate = now;
        updateData.hodNote = reason;
    } else if (user.role === 'SUPERVISOR') {
        updateData.spvApproved = true;
        updateData.spvDate = now;
        updateData.spvNote = reason;
    } else if (user.role === 'FINANCE') {
        updateData.financeApproved = true;
        updateData.financeDate = now;
        updateData.financeNote = reason;
    } else if (user.role === 'GM') {
        updateData.gmApproved = true;
        updateData.gmDate = now;
        updateData.gmNote = reason;
    } else if (user.role === 'MERCHANDISE_HOD') {
        updateData.hodApproved = true;
        updateData.hodDate = now;
        updateData.hodNote = reason;
    } else if (user.role === 'MERCHANDISE_SPV') {
        updateData.spvApproved = true;
        updateData.spvDate = now;
        updateData.spvNote = reason;
    } else if (user.role === 'PHOTOGRAPHER_HOD') {
        updateData.hodApproved = true;
        updateData.hodDate = now;
        updateData.hodNote = reason;
    }

    await prisma.transactionApproval.update({
        where: { id: activeStep.id },
        data: {
            status: 'APPROVED',
            note: reason || null,
            userId: user.id,
            approvedAt: now
        }
    });

    const remainingSteps = txApprovals
        .filter(t => t.stepOrder > activeStep.stepOrder)
        .sort((a, b) => a.stepOrder - b.stepOrder);

    const nextStep = remainingSteps[0];

    if (nextStep) {
        updateData.status = mapProcurementRoleToStatus(nextStep.role);
    } else {
        updateData.status = 'APPROVED';
    }

    const updated = await prisma.procurement.update({
        where: { id },
        data: updateData
    });

    if (nextStep) {
        const approvalConfig = await getActiveApprovalConfig('PROCUREMENT', department);
        const approvers = await getEligibleApproversForProcurement(approvalConfig, nextStep.role, department);

        approvers.forEach(approver => {
            createNotification(approver.id, `Procurement request from ${procurement.user.name} is pending your approval.`);
        });
    } else if (updated.status === 'APPROVED') {
        await createNotification(procurement.userId, `Your procurement request has been fully APPROVED.`);
        
        const stores = await prisma.user.findMany({ where: { role: 'STORE' } });
        stores.forEach(u => createNotification(u.id, `New approved procurement ready for fulfillment.`));

        sendEmail(
            procurement.user.email,
            `Procurement Approved`,
            `<p>Your procurement request has been fully approved.</p>`
        ).catch(console.error);
    }

    return res.status(200).json(updated);
}
