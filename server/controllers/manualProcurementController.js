const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createManualProcurement = async (req, res) => {
  try {
    const {
      department,
      date,
      requestNumber,
      description,
      items, // array of { itemName, quantity, unit, price, total }
      totalAmount
    } = req.body;

    if (!department || !date || !requestNumber || !items || items.length === 0) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const manualProcurement = await prisma.manualProcurement.create({
      data: {
        department,
        date: new Date(date),
        requestNumber,
        description,
        totalAmount: parseFloat(totalAmount),
        createdById: req.userId,
        items: {
          create: items.map(item => ({
            itemName: item.itemName,
            quantity: parseInt(item.quantity),
            unit: item.unit,
            price: parseFloat(item.price),
            total: parseFloat(item.total)
          }))
        },
        status: 'PENDING_FINANCE' // Explicitly set initial status
      },
      include: {
        items: true
      }
    });

    res.status(201).json(manualProcurement);
  } catch (error) {
    console.error('Error creating manual procurement:', error);
    res.status(500).json({ message: 'Error creating manual procurement', error: error.message });
  }
};

exports.getManualProcurements = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const where = {};
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const procurements = await prisma.manualProcurement.findMany({
      where,
      include: {
        items: true,
        createdBy: {
            select: { name: true }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    res.status(200).json(procurements);
  } catch (error) {
    console.error('Error fetching manual procurements:', error);
    res.status(500).json({ message: 'Error fetching manual procurements', error: error.message });
  }
};

exports.getManualProcurementById = async (req, res) => {
  try {
    const { id } = req.params;
    const procurement = await prisma.manualProcurement.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: true,
        createdBy: {
          select: { name: true }
        }
      }
    });

    if (!procurement) {
      return res.status(404).json({ message: 'Manual procurement not found' });
    }

    res.status(200).json(procurement);
  } catch (error) {
    console.error('Error fetching manual procurement:', error);
    res.status(500).json({ message: 'Error fetching manual procurement', error: error.message });
  }
};

exports.updateManualProcurement = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      department,
      date,
      requestNumber,
      description,
      items,
      totalAmount
    } = req.body;

    if (!department || !date || !requestNumber || !items || items.length === 0) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Use transaction to ensure data integrity
    const updatedProcurement = await prisma.$transaction(async (prisma) => {
      // 1. Delete existing items
      await prisma.manualProcurementItem.deleteMany({
        where: { manualProcurementId: parseInt(id) }
      });

      // 2. Update procurement details and create new items
      return await prisma.manualProcurement.update({
        where: { id: parseInt(id) },
        data: {
          department,
          date: new Date(date),
          requestNumber,
          description,
          totalAmount: parseFloat(totalAmount),
          items: {
            create: items.map(item => ({
              itemName: item.itemName,
              quantity: parseInt(item.quantity),
              unit: item.unit,
              price: parseFloat(item.price),
              total: parseFloat(item.total)
            }))
          }
        },
        include: {
          items: true
        }
      });
    });

    res.status(200).json(updatedProcurement);
  } catch (error) {
    console.error('Error updating manual procurement:', error);
    res.status(500).json({ message: 'Error updating manual procurement', error: error.message });
  }
};

exports.approveManualProcurement = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // action: 'APPROVE' | 'REJECT'
    const userId = req.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) return res.status(404).json({ message: 'User not found' });

    const procurement = await prisma.manualProcurement.findUnique({
      where: { id: parseInt(id) }
    });

    if (!procurement) return res.status(404).json({ message: 'Procurement not found' });

    let updateData = {};

    if (action === 'REJECT') {
      updateData = {
        status: 'REJECTED',
        rejectedByRole: user.role,
        rejectionReason: reason
      };
    } else if (action === 'APPROVE') {
      if (user.role === 'FINANCE') {
        // Finance approves -> Pending GM
        updateData = {
          status: 'PENDING_GM',
          financeApproved: true,
          financeApproverId: userId,
          financeApprovedAt: new Date()
        };
      } else if (user.role === 'GM' || user.role === 'ADMIN') {
        // GM approves -> APPROVED (visible to Store)
        updateData = {
          status: 'APPROVED',
          gmApproved: true,
          gmApproverId: userId,
          gmApprovedAt: new Date()
        };
      } else {
        return res.status(403).json({ message: 'Unauthorized role for approval' });
      }
    } else {
        return res.status(400).json({ message: 'Invalid action' });
    }

    const updated = await prisma.manualProcurement.update({
      where: { id: parseInt(id) },
      data: updateData
    });

    res.status(200).json(updated);
  } catch (error) {
    console.error('Error approving manual procurement:', error);
    res.status(500).json({ message: 'Error processing approval', error: error.message });
  }
};

exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; 
        const userId = req.userId;

        const procurement = await prisma.manualProcurement.findUnique({
            where: { id: parseInt(id) }
        });

        if (!procurement) return res.status(404).json({ message: 'Procurement not found' });

        // Allow PURCHASED or COMPLETED
        if (status !== 'PURCHASED' && status !== 'COMPLETED') {
             return res.status(400).json({ message: 'Invalid status update. Allowed: PURCHASED, COMPLETED' });
        }

        const updated = await prisma.manualProcurement.update({
            where: { id: parseInt(id) },
            data: {
                status: status,
                purchased: true,
                purchasedAt: new Date(),
                purchasedById: userId
            }
        });

        res.status(200).json(updated);
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ message: 'Error updating status', error: error.message });
    }
};

exports.exportManualProcurements = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and End date are required' });
    }

    // Parse dates assuming WIB (UTC+7) or just use standard dates if stored as UTC
    // Using start of day and end of day
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const procurements = await prisma.manualProcurement.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      },
      include: {
        items: true,
        createdBy: {
          select: { name: true }
        }
      },
      orderBy: {
        date: 'asc'
      }
    });

    res.status(200).json(procurements);
  } catch (error) {
    console.error('Error exporting manual procurements:', error);
    res.status(500).json({ message: 'Error exporting manual procurements', error: error.message });
  }
};
