const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappService = require('../services/whatsappService');

exports.createRch = async (req, res) => {
  try {
    const { nomor, area, guestName, type, date, description, followUp, status, progress, targetDepartment } = req.body;

    // Access control: Check if user has RCH access or is Admin/HR/GM
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user.rchAccess && !['HR', 'GM', 'ADMIN'].includes(user.role)) {
      return res.status(403).json({ message: 'Anda tidak memiliki akses untuk menginput RCH.' });
    }

    const newRch = await prisma.rangerCustomerHandling.create({
      data: {
        nomor,
        area,
        guestName,
        type,
        date: new Date(date),
        description,
        followUp,
        status: status || 'NORMAL',
        progress: progress || 'OPEN',
        targetDepartment,
        createdById: req.userId,
      },
    });

    // Notify the target department via WhatsApp if any user in that department has a verified WhatsApp number
    try {
      const usersInDept = await prisma.user.findMany({
        where: { department: targetDepartment, whatsappNumber: { not: null } },
      });

      const message = `*Notifikasi Ranger Customer Handling (RCH)* 🛎️\n\n` +
                      `Terdapat input RCH baru untuk departemen *${targetDepartment}*:\n` +
                      `Nomor: ${nomor}\n` +
                      `Status: ${status}\n` +
                      `Area: ${area}\n` +
                      `Guest Name: ${guestName}\n` +
                      `Type: ${type}\n` +
                      `Description: ${description}\n\n` +
                      `Harap segera ditindaklanjuti. Terima kasih.`;

      for (const user of usersInDept) {
        if (user.whatsappNumber) {
          await whatsappService.sendWhatsAppMessage({ to: user.whatsappNumber, message });
        }
      }
    } catch (waError) {
      console.error('Failed to send WhatsApp notification for RCH:', waError);
    }

    res.status(201).json({ message: 'RCH created successfully', data: newRch });
  } catch (error) {
    console.error('Create RCH error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

exports.getAllRch = async (req, res) => {
  try {
    const { department, status, progress, startDate, endDate } = req.query;
    const userId = req.userId;
    const userRole = req.role;
    const userDept = req.department;

    // Fetch user from DB to check rchAccess (since it's not in the JWT)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Access check: Everyone authenticated can view, but only specific roles/access can see their specific view
    const isAdmin = ['HR', 'GM', 'ADMIN'].includes(userRole);
    const isHod = ['HOD', 'SUPERVISOR', 'PHOTOGRAPHER_HOD', 'MERCHANDISE_HOD', 'MERCHANDISE_SPV'].includes(userRole);
    
    let whereClause = {};

    // Filtering logic: 
    // HODs still see their dept OR their own inputs by default? 
    // User requested "di semua akun munculkan", which means global visibility.
    // So we remove the HOD restriction for viewing.
    if (isAdmin && department) {
      whereClause.targetDepartment = department;
    }

    if (status) {
      whereClause.status = status;
    }
    if (progress) {
      whereClause.progress = progress;
    }
    if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const rchs = await prisma.rangerCustomerHandling.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: { id: true, name: true, department: true }
        }
      },
      orderBy: { date: 'desc' }
    });

    res.json(rchs);
  } catch (error) {
    console.error('Get all RCH error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

exports.getRchById = async (req, res) => {
  try {
    const { id } = req.params;
    const rch = await prisma.rangerCustomerHandling.findUnique({
      where: { id: parseInt(id) },
      include: {
        createdBy: {
          select: { id: true, name: true, department: true }
        }
      }
    });

    if (!rch) {
      return res.status(404).json({ message: 'RCH not found' });
    }

    res.json(rch);
  } catch (error) {
    console.error('Get RCH by ID error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

exports.updateRch = async (req, res) => {
  try {
    const { id } = req.params;
    const { area, guestName, type, date, description, followUp, status, progress, targetDepartment, investigationNote } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const isAdmin = ['HR', 'GM', 'ADMIN'].includes(req.role);
    const isHod = ['HOD', 'SUPERVISOR', 'PHOTOGRAPHER_HOD', 'MERCHANDISE_HOD', 'MERCHANDISE_SPV'].includes(req.role);

    // General access check for update
    const existingRch = await prisma.rangerCustomerHandling.findUnique({ where: { id: parseInt(id) } });
    if (!existingRch) return res.status(404).json({ message: 'RCH not found' });

    const canUpdate = isAdmin || user.rchAccess || (isHod && existingRch.targetDepartment === user.department);
    if (!canUpdate) {
      return res.status(403).json({ message: 'Anda tidak memiliki izin untuk mengubah data RCH ini.' });
    }

    const dataToUpdate = {
      area,
      guestName,
      type,
      date: date ? new Date(date) : undefined,
      description,
      followUp,
      status,
      progress,
      targetDepartment,
      investigationNote
    };

    if (investigationNote !== undefined) {
      dataToUpdate.investigatedAt = new Date();
    }

    const rch = await prisma.rangerCustomerHandling.update({
      where: { id: parseInt(id) },
      data: dataToUpdate,
    });

    res.json({ message: 'RCH updated successfully', data: rch });
  } catch (error) {
    console.error('Update RCH error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

exports.deleteRch = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.rangerCustomerHandling.delete({
      where: { id: parseInt(id) },
    });
    res.json({ message: 'RCH deleted successfully' });
  } catch (error) {
    console.error('Delete RCH error:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

exports.downloadRchPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const rch = await prisma.rangerCustomerHandling.findUnique({
      where: { id: parseInt(id) },
      include: {
        createdBy: {
          select: { id: true, name: true, department: true }
        }
      }
    });

    if (!rch) {
      return res.status(404).json({ message: 'RCH not found' });
    }

    const pdfService = require('../services/pdfService');
    const pdfBytes = await pdfService.generateRchPDF(rch);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=RCH-${rch.nomor || rch.id}.pdf`);
    res.send(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Download RCH PDF error:', error);
    res.status(500).json({ message: 'Gagal generate PDF', error: error.message });
  }
};
