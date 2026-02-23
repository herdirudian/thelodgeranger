const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createBugReport = async (req, res) => {
  try {
    const { title, description, type, priority, imageUrl } = req.body;

    if (!title || !description || !type) {
      return res.status(400).json({ message: 'Title, description, and type are required' });
    }

    const report = await prisma.bugReport.create({
      data: {
        title,
        description,
        type,
        priority: priority || 'MEDIUM',
        imageUrl: imageUrl || null,
        createdById: req.userId
      }
    });

    res.status(201).json(report);
  } catch (error) {
    console.error('Error creating bug report:', error);
    // Return detailed error for debugging
    res.status(500).json({ message: `Error: ${error.message}` });
  }
};

exports.getBugReports = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const whereClause = {};

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
        whereClause.createdAt = range;
      }
    }

    const reports = await prisma.bugReport.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: { id: true, name: true, department: true, role: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(reports);
  } catch (error) {
    console.error('Error fetching bug reports:', error);
    res.status(500).json({ message: 'Error fetching bug reports', error: error.message });
  }
};

exports.getMyBugReports = async (req, res) => {
  try {
    const reports = await prisma.bugReport.findMany({
      where: { createdById: req.userId },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(reports);
  } catch (error) {
    console.error('Error fetching my bug reports:', error);
    res.status(500).json({ message: 'Error fetching my bug reports', error: error.message });
  }
};

exports.updateBugReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const report = await prisma.bugReport.update({
      where: { id: parseInt(id) },
      data: { status }
    });

    res.status(200).json(report);
  } catch (error) {
    console.error('Error updating bug report status:', error);
    res.status(500).json({ message: 'Error updating bug report status', error: error.message });
  }
};

exports.createDeviceErrorLog = async (req, res) => {
  try {
    const { type, message, detail } = req.body;

    const errorType = type || 'DEVICE_ERROR';
    const errorMessage = message || 'Unknown device error';
    const userAgent = req.headers['user-agent'] || '';

    let serializedDetail = '';
    if (detail) {
      try {
        serializedDetail = JSON.stringify(detail);
      } catch {
        serializedDetail = String(detail);
      }
      if (serializedDetail.length > 1000) {
        serializedDetail = serializedDetail.slice(0, 1000);
      }
    }

    const descriptionLines = [
      errorMessage,
      '',
      `Type: ${errorType}`,
      `UserAgent: ${userAgent}`,
      serializedDetail ? `Detail: ${serializedDetail}` : ''
    ].filter(Boolean);

    console.warn('Device error log:', {
      userId: req.userId,
      type: errorType,
      message: errorMessage,
      detail,
      userAgent
    });

    const report = await prisma.bugReport.create({
      data: {
        title: `Device Error: ${errorType}`,
        description: descriptionLines.join('\n'),
        type: errorType,
        priority: 'LOW',
        createdById: req.userId
      }
    });

    res.status(201).json(report);
  } catch (error) {
    console.error('Error logging device error:', error);
    res.status(500).json({ message: 'Error logging device error', error: error.message });
  }
};
