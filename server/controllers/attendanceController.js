const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const pdfService = require('../services/pdfService');
const { sendEmail } = require('../services/emailService');
const { formatWibDate, formatWibTime } = require('../utils/wibDate');

exports.clockIn = async (req, res) => {
  try {
    const { latitude, longitude, location, type, notes } = req.body;
    const userId = req.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    // Handle Photo Upload
    let photoUrl = req.body.photoUrl; // Fallback if sent as string (e.g. external URL)
    if (req.file) {
        // Construct full URL or relative path
        // Assuming server serves static files from /uploads
        photoUrl = `/uploads/${req.file.filename}`;
    }

    // Determine status
    // Layered approval: EXTERNAL -> PENDING_HOD
    
    let status = 'APPROVED';
    let attendanceType = type || 'CHECK_IN';
    let hodApproved = false;
    let hrApproved = false;
    let gmApproved = false;

    if (attendanceType === 'EXTERNAL_DUTY' || type === 'EXTERNAL' || type === 'EXTERNAL_IN' || type === 'EXTERNAL_OUT') {
        // If GM, go straight to HR
        status = user.role === 'GM' ? 'PENDING_HR' : 'PENDING_HOD';
        attendanceType = type === 'EXTERNAL_IN' || type === 'EXTERNAL_OUT' ? type : 'EXTERNAL';
    }

    // Detect approved Extra Man Power request for this user on this date
    let finalLocation = location;
    try {
        const now = new Date();
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(now);
        dayEnd.setHours(23, 59, 59, 999);

        const extraRequest = await prisma.request.findFirst({
            where: {
                type: 'ADD_MANPOWER',
                status: 'APPROVED',
                newEmployeeName: user.name,
                startDate: { gte: dayStart, lte: dayEnd }
            }
        });

        if (extraRequest) {
            const targetDept = extraRequest.targetDepartment || user.department || '';
            const extraTag = targetDept ? `EXTRA (${targetDept})` : 'EXTRA';
            finalLocation = finalLocation && finalLocation.trim().length > 0
                ? `${finalLocation} - ${extraTag}`
                : extraTag;
        }
    } catch (e) {}

    const attendance = await prisma.attendance.create({
      data: {
        userId,
        type: attendanceType,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        location: finalLocation,
        photoUrl,
        notes,
        status: status,
        hodApproved,
        hrApproved,
        gmApproved
      },
    });

    // Notify Approver
    if (status === 'PENDING_HOD') {
        const hods = await prisma.user.findMany({
            where: {
                role: 'HOD',
                department: user.department
            }
        });

        for (const hod of hods) {
            if (hod.email) {
                const subject = `New External Duty: ${user.name}`;
                const html = `
                    <p>Dear ${hod.name},</p>
                    <p>Employee <strong>${user.name}</strong> has submitted an External Duty attendance.</p>
                    <p><strong>Location:</strong> ${location}</p>
                    <p><strong>Notes:</strong> ${notes || '-'}</p>
                    <p>Please review and approve in the dashboard.</p>
                `;
                await emailService.sendEmail(hod.email, subject, html);
            }
        }
    } else if (status === 'PENDING_HR') {
         // Notify HR (e.g. if GM submitted)
         const hrs = await prisma.user.findMany({ where: { role: 'HR' } });
         for (const hr of hrs) {
             if (hr.email) {
                const subject = `New External Duty: ${user.name}`;
                const html = `
                    <p>Dear HR Team,</p>
                    <p><strong>${user.name}</strong> (${user.role}) has submitted an External Duty attendance.</p>
                    <p><strong>Location:</strong> ${location}</p>
                    <p>Please review and approve in the dashboard.</p>
                `;
                await emailService.sendEmail(hr.email, subject, html);
             }
         }
    }

    res.status(201).json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Error clocking in', error: error.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const { startDate, endDate } = req.query;
    
    let whereClause = { userId };

    if (startDate || endDate) {
        const range = {};
        if (startDate) {
            const start = new Date(`${startDate}T00:00:00+07:00`);
            if (!isNaN(start.getTime())) {
                range.gte = start;
            }
        }
        if (endDate) {
            const end = new Date(`${endDate}T23:59:59+07:00`);
            if (!isNaN(end.getTime())) {
                range.lte = end;
            }
        }
        if (Object.keys(range).length > 0) {
            whereClause.timestamp = range;
        }
    }
    
    const history = await prisma.attendance.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: 100 // Increased limit for filtered views
    });

    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching history', error: error.message });
  }
};

exports.getTeamAttendance = async (req, res) => {
  try {
    // For HOD/HR/GM
    // Filter by department if HOD
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    
    let whereClause = {};
    if (user.role === 'HOD') {
        whereClause = {
            user: {
                department: user.department
            }
        };
    } else if (user.role === 'STAFF') {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const attendance = await prisma.attendance.findMany({
        where: whereClause,
        include: {
            user: {
                select: { name: true, department: true }
            }
        },
        orderBy: { timestamp: 'desc' },
        take: 100
    });

    res.status(200).json(attendance);
  } catch (error) {
      res.status(500).json({ message: 'Error fetching team attendance', error: error.message });
  }
};

exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body; // status param might be 'APPROVED' or 'REJECTED' action from frontend
        // OR frontend sends action: 'APPROVE' / 'REJECT'
        // Let's assume frontend sends status='APPROVED' or 'REJECTED' to signify intent.
        
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        const attendance = await prisma.attendance.findUnique({
            where: { id: parseInt(id) },
            include: { user: true }
        });

        if (!attendance) return res.status(404).json({ message: 'Attendance not found' });

        // Handle Rejection
        if (status === 'REJECTED') {
            await prisma.attendance.update({
                where: { id: parseInt(id) },
                data: { 
                    status: 'REJECTED',
                    rejectionReason: reason
                }
            });

             // Notify User
            if (attendance.user.email) {
                const subject = `External Duty Rejected`;
                const html = `
                    <p>Dear ${attendance.user.name},</p>
                    <p>Your external duty attendance at <strong>${attendance.location}</strong> has been <strong>REJECTED</strong> by ${user.role}.</p>
                    <p><strong>Reason:</strong> ${reason || '-'}</p>
                `;
                await emailService.sendEmail(attendance.user.email, subject, html);
            }
            return res.json({ message: 'Attendance rejected' });
        }

        // Handle Approval Logic
        let updateData = {};
        let nextStatus = '';

        if (user.role === 'HOD') {
            if (attendance.user.department !== user.department) {
                return res.status(403).json({ message: 'Unauthorized department' });
            }
            if (attendance.status === 'PENDING_HOD') {
                updateData = { status: 'PENDING_HR', hodApproved: true };
                nextStatus = 'PENDING_HR';
            }
        } else if (user.role === 'HR') {
            if (attendance.status === 'PENDING_HR') {
                // If requester is GM, skip PENDING_GM and go to APPROVED
                if (attendance.user.role === 'GM') {
                    updateData = { status: 'APPROVED', hrApproved: true, gmApproved: true };
                    nextStatus = 'APPROVED';
                } else {
                    updateData = { status: 'PENDING_GM', hrApproved: true };
                    nextStatus = 'PENDING_GM';
                }
            }
        } else if (user.role === 'GM' || user.role === 'ADMIN') {
            if (attendance.status === 'PENDING_GM') {
                updateData = { status: 'APPROVED', gmApproved: true };
                nextStatus = 'APPROVED';
            }
        } else {
             return res.status(403).json({ message: 'Unauthorized role' });
        }

        if (!nextStatus) {
             return res.status(400).json({ message: 'Invalid status transition' });
        }

        const updated = await prisma.attendance.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        // Notify Next Approver or User
        if (nextStatus === 'PENDING_HR') {
            const hrs = await prisma.user.findMany({ where: { role: 'HR' } });
            for (const hr of hrs) {
                 if (hr.email) {
                    await emailService.sendEmail(
                        hr.email, 
                        'External Duty Pending HR Approval',
                        `<p>External duty for <strong>${attendance.user.name}</strong> verified by HOD. Pending HR approval.</p>`
                    );
                 }
            }
        } else if (nextStatus === 'PENDING_GM') {
            const gms = await prisma.user.findMany({ where: { role: 'GM' } });
            for (const gm of gms) {
                 if (gm.email) {
                    await emailService.sendEmail(
                        gm.email, 
                        'External Duty Pending GM Approval',
                        `<p>External duty for <strong>${attendance.user.name}</strong> verified by HR. Pending GM approval.</p>`
                    );
                 }
            }
        } else if (nextStatus === 'APPROVED') {
             if (attendance.user.email) {
                const subject = `External Duty Approved`;
                const html = `
                    <p>Dear ${attendance.user.name},</p>
                    <p>Your external duty attendance at <strong>${attendance.location}</strong> has been <strong>APPROVED</strong>.</p>
                `;
                await emailService.sendEmail(attendance.user.email, subject, html);
            }
        }

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Error updating status', error: error.message });
    }
};

exports.getAttendancePDF = async (req, res) => {
    try {
        const attendanceId = parseInt(req.params.id);
        const attendance = await prisma.attendance.findUnique({
            where: { id: attendanceId },
            include: { user: true }
        });

        if (!attendance) {
            return res.status(404).json({ message: 'Attendance record not found' });
        }

        // Check permission (Owner or HOD/Admin)
        // Simple check: if not own record, check role
        if (attendance.userId !== req.userId) {
             const requester = await prisma.user.findUnique({ where: { id: req.userId } });
             if (requester.role === 'STAFF') {
                 return res.status(403).json({ message: 'Unauthorized' });
             }
        }

        const pdfBytes = await pdfService.generateAttendancePDF(attendance, attendance.user);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=attendance-${attendance.id}.pdf`);
        res.send(Buffer.from(pdfBytes));

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error generating PDF', error: error.message });
    }
};

exports.getPendingAttendance = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        
        let whereClause = {};
    
        if (user.role === 'HOD') {
            whereClause = {
                status: 'PENDING_HOD',
                user: { department: user.department }
            };
        } else if (user.role === 'HR') {
            whereClause = { status: 'PENDING_HR' };
        } else if (user.role === 'GM' || user.role === 'ADMIN') {
            // If GM is in loop
            whereClause = { status: 'PENDING_GM' }; // If we used PENDING_GM
            // Or if GM acts as super-approver
        } else {
            return res.status(403).json({ message: 'Unauthorized' });
        }
    
        const pending = await prisma.attendance.findMany({
            where: whereClause,
            include: {
                user: { select: { name: true, department: true } }
            },
            orderBy: { timestamp: 'desc' }
        });
    
        res.status(200).json(pending);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching pending attendance', error: error.message });
    }
};

exports.deleteAttendance = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (user.role !== 'ADMIN') {
            return res.status(403).json({ message: 'Require Admin Role' });
        }

        await prisma.attendance.delete({ where: { id: parseInt(id) } });

        res.status(200).json({ message: 'Attendance deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting attendance', error: error.message });
    }
};

exports.getApprovalHistory = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const { startDate, endDate, type } = req.query;
        
        let whereClause = {};
        
        // 1. Role-based filtering
        if (user.role === 'HOD') {
            whereClause.user = { department: user.department };
        } else if (
            user.role === 'SUPERVISOR' ||
            user.role === 'HR' ||
            user.role === 'GM' ||
            user.role === 'ADMIN'
        ) {
            // No user filter for higher roles
        } else {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // 2. Type filtering
        if (type && type !== 'undefined') {
            if (type === 'EXTERNAL_IN') {
                whereClause.type = { in: ['EXTERNAL', 'EXTERNAL_IN', 'CHECK_IN'] };
            } else if (type === 'EXTERNAL_OUT') {
                whereClause.type = { in: ['EXTERNAL_OUT', 'CHECK_OUT'] };
            } else {
                whereClause.type = type;
            }
        }
        // Default: If no type provided, show ALL attendance types in history

        // 3. Date filtering
        if (startDate || endDate) {
            const range = {};
            if (startDate && startDate !== "") {
                const start = new Date(`${startDate}T00:00:00+07:00`);
                if (!isNaN(start.getTime())) range.gte = start;
            }
            if (endDate && endDate !== "") {
                const end = new Date(`${endDate}T23:59:59+07:00`);
                if (!isNaN(end.getTime())) range.lte = end;
            }
            if (Object.keys(range).length > 0) {
                whereClause.timestamp = range;
            }
        }
    
        const history = await prisma.attendance.findMany({
            where: whereClause,
            include: {
                user: { select: { name: true, department: true } }
            },
            orderBy: { timestamp: 'desc' },
            take: 2000
        });
    
        res.status(200).json(history);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching attendance history', error: error.message });
    }
};

exports.exportAttendance = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const { startDate, endDate, type } = req.query;
        
        let whereClause = {};
        
        // 1. Role-based filtering
        if (user.role === 'HOD') {
            whereClause.user = { department: user.department };
        } else if (
            user.role === 'SUPERVISOR' ||
            user.role === 'HR' ||
            user.role === 'GM' ||
            user.role === 'ADMIN'
        ) {
            // No user filter for higher roles
        } else {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // 2. Type filtering
        if (type && type !== 'undefined') {
            if (type === 'EXTERNAL_IN') {
                whereClause.type = { in: ['EXTERNAL', 'EXTERNAL_IN', 'CHECK_IN'] };
            } else if (type === 'EXTERNAL_OUT') {
                whereClause.type = { in: ['EXTERNAL_OUT', 'CHECK_OUT'] };
            } else {
                whereClause.type = type;
            }
        }
        // Default: Show all types in export if not filtered

        // 3. Date filtering
        if (startDate || endDate) {
            const range = {};
            if (startDate && startDate !== "") {
                const start = new Date(`${startDate}T00:00:00+07:00`);
                if (!isNaN(start.getTime())) range.gte = start;
            }
            if (endDate && endDate !== "") {
                const end = new Date(`${endDate}T23:59:59+07:00`);
                if (!isNaN(end.getTime())) range.lte = end;
            }
            if (Object.keys(range).length > 0) {
                whereClause.timestamp = range;
            }
        }
    
        const records = await prisma.attendance.findMany({
            where: whereClause,
            include: {
                user: { select: { name: true, department: true } }
            },
            orderBy: { timestamp: 'desc' }
        });

        const headers = ['ID', 'Employee', 'Department', 'Type', 'Date', 'Time', 'Location', 'Status', 'Notes', 'Rejection Reason'];
        const csvRows = [headers.join(',')];

        for (const record of records) {
            const date = new Date(record.timestamp);
            const row = [
                record.id,
                `"${record.user.name}"`,
                `"${record.user.department || ''}"`,
                record.type,
                formatWibDate(date),
                formatWibTime(date),
                `"${record.location || ''}"`,
                record.status,
                `"${(record.notes || '').replace(/"/g, '""')}"`,
                `"${(record.rejectionReason || '').replace(/"/g, '""')}"`
            ];
            csvRows.push(row.join(','));
        }

        const csvString = csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=attendance_export.csv');
        res.send(csvString);

    } catch (error) {
        res.status(500).json({ message: 'Error exporting data', error: error.message });
    }
};
