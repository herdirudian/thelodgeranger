const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const whatsappService = require('../services/whatsappService');

exports.createRch = async (req, res) => {
  try {
    const { nomor, area, guestName, type, date, description, followUp, status, targetDepartment } = req.body;

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
    const { department, status, startDate, endDate } = req.query;
    
    let whereClause = {};
    if (department) {
      whereClause.targetDepartment = department;
    }
    if (status) {
      whereClause.status = status;
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
    const { area, guestName, type, date, description, followUp, status, targetDepartment } = req.body;

    const rch = await prisma.rangerCustomerHandling.update({
      where: { id: parseInt(id) },
      data: {
        area,
        guestName,
        type,
        date: date ? new Date(date) : undefined,
        description,
        followUp,
        status,
        targetDepartment,
      },
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
