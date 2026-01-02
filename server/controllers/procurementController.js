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
    
    // Determine initial status based on role
    if (user.role === 'HOD') {
        status = 'PENDING_SUPERVISOR';
        hodApproved = true;
    } else if (user.role === 'SUPERVISOR') {
        status = 'PENDING_FINANCE';
        hodApproved = true; // Skipped
        spvApproved = true;
    } else if (user.role === 'FINANCE') {
        status = 'PENDING_GM';
        hodApproved = true;
        spvApproved = true;
        financeApproved = true;
    } else if (user.role === 'GM') {
        status = 'APPROVED';
        hodApproved = true;
        spvApproved = true;
        financeApproved = true;
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
    if (status === 'PENDING_HOD') {
        const hods = await prisma.user.findMany({ where: { role: 'HOD', department: user.department } });
        hods.forEach(h => createNotification(h.id, `New procurement request from ${user.name} awaiting approval.`));
    } else if (status === 'PENDING_SUPERVISOR') {
        const supervisors = await prisma.user.findMany({ where: { role: 'SUPERVISOR' } });
        supervisors.forEach(u => createNotification(u.id, `New procurement request from ${user.name} awaiting approval.`));
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
    
    let whereClause = {};

    if (user.role === 'HOD') {
        whereClause = {
            status: 'PENDING_HOD',
            user: { department: user.department }
        };
    } else if (user.role === 'SUPERVISOR') {
        whereClause = { status: 'PENDING_SUPERVISOR' };
    } else if (user.role === 'FINANCE') {
        whereClause = { status: 'PENDING_FINANCE' };
    } else if (user.role === 'GM') {
        whereClause = { status: 'PENDING_GM' };
    } else if (user.role === 'STORE') {
        whereClause = { status: 'APPROVED' }; // Store users see fully approved requests to fulfill
    } else {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const procurements = await prisma.procurement.findMany({
        where: whereClause,
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

exports.getApprovalHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    let whereClause = {};

    if (user.role === 'HOD') {
        whereClause = {
            user: { department: user.department },
            OR: [
                { hodApproved: true },
                { status: 'REJECTED', rejectedByRole: 'HOD' } 
            ]
        };
    } else if (user.role === 'SUPERVISOR') {
         whereClause = {
            OR: [
                { spvApproved: true },
                { status: 'REJECTED', rejectedByRole: 'SUPERVISOR' }
            ]
        };
    } else if (user.role === 'FINANCE') {
        whereClause = {
            OR: [
                { financeApproved: true },
                { status: 'REJECTED', rejectedByRole: 'FINANCE' }
            ]
        };
    } else if (user.role === 'GM') {
        whereClause = {
            OR: [
                { gmApproved: true },
                { status: 'REJECTED', rejectedByRole: 'GM' }
            ]
        };
    } else if (user.role === 'STORE') {
         whereClause = {
            status: 'APPROVED' // Store history basically same as pending for now, or maybe add fulfilled status later
        };
    } else {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const procurements = await prisma.procurement.findMany({
        where: whereClause,
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

    if (action === 'REJECT') {
        await prisma.procurement.update({
            where: { id: parseInt(id) },
            data: {
                status: 'REJECTED',
                rejectionReason: reason,
                rejectedByRole: user.role
            }
        });

        // Notify Requester
        sendEmail(
            procurement.user.email,
            `Procurement Rejected: ${procurement.itemName}`,
            `<p>Your procurement request for <b>${procurement.itemName}</b> has been rejected by ${user.role}.</p>
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
    } else if (user.role === 'GM' && procurement.status === 'PENDING_GM') {
        updateData = { 
            status: 'APPROVED', 
            gmApproved: true,
            gmDate: now,
            gmNote: reason
        };
    } else if (user.role === 'STORE' && procurement.status === 'APPROVED') {
        updateData = { 
            status: 'COMPLETED',
            // No specific storeApproved field in schema, but status implies it
        };
    } else {
        return res.status(400).json({ message: 'Invalid approval action for current status or role' });
    }

    const updated = await prisma.procurement.update({
        where: { id: parseInt(id) },
        data: updateData
    });

    // Notifications
    if (updated.status === 'PENDING_SUPERVISOR') {
        const supervisors = await prisma.user.findMany({ where: { role: 'SUPERVISOR' } });
        supervisors.forEach(u => createNotification(u.id, `New procurement request awaiting Supervisor approval.`));
    } else if (updated.status === 'PENDING_FINANCE') {
        // Notify Requester about progress
        await createNotification(procurement.userId, `Supervisor Operational has approved your request.`);
        
        const finances = await prisma.user.findMany({ where: { role: 'FINANCE' } });
        finances.forEach(u => createNotification(u.id, `New procurement request waiting for Finance approval.`));
    } else if (updated.status === 'PENDING_GM') {
        const gms = await prisma.user.findMany({ where: { role: 'GM' } });
        gms.forEach(u => createNotification(u.id, `New procurement request awaiting GM approval.`));
    } else if (updated.status === 'APPROVED') {
        await createNotification(procurement.userId, `Your procurement request has been fully APPROVED.`);
        
        // Notify Store
        const stores = await prisma.user.findMany({ where: { role: 'STORE' } });
        stores.forEach(u => createNotification(u.id, `New approved procurement ready for fulfillment.`));

        sendEmail(
            procurement.user.email,
            `Procurement Approved: ${procurement.itemName}`, // Note: itemName might not be on procurement root if strict schema, but keeping as is per existing code structure
            `<p>Your procurement request has been fully approved.</p>`
        ).catch(console.error);
    } 

    res.status(200).json(updated);

  } catch (error) {
    res.status(500).json({ message: 'Error processing procurement', error: error.message });
  }
};
