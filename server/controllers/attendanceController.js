const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const pdfService = require('../services/pdfService');
const emailService = require('../services/emailService');

exports.clockIn = async (req, res) => {
  try {
    const { latitude, longitude, location, type, notes } = req.body;
    const userId = req.userId;
    
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

    if (attendanceType === 'EXTERNAL_DUTY' || type === 'EXTERNAL') {
        status = 'PENDING_HOD';
        attendanceType = 'EXTERNAL';
    }

    const attendance = await prisma.attendance.create({
      data: {
        userId,
        type: attendanceType,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        location,
        photoUrl,
        notes,
        status: status,
        hodApproved,
        hrApproved,
        gmApproved
      },
    });

    // Notify HOD if PENDING_HOD
    if (status === 'PENDING_HOD') {
        const user = await prisma.user.findUnique({ where: { id: userId } });
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
    }

    res.status(201).json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Error clocking in', error: error.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const userId = req.userId;
    // If Admin/HR/HOD, might want to see others.
    // For now, let's implement personal history.
    
    const history = await prisma.attendance.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
      take: 30 // Last 30 records
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
                updateData = { status: 'PENDING_GM', hrApproved: true };
                nextStatus = 'PENDING_GM';
            }
        } else if (user.role === 'GM') {
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
        } else if (user.role === 'GM') {
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
                    { status: 'REJECTED', hodApproved: false } 
                ]
            };
        } else if (user.role === 'HR') {
            whereClause = {
                OR: [
                    { hrApproved: true },
                    { status: 'REJECTED', hodApproved: true, hrApproved: false }
                ]
            };
        } else if (user.role === 'GM') {
            whereClause = {
                OR: [
                    { gmApproved: true },
                    { status: 'REJECTED', hrApproved: true, gmApproved: false }
                ]
            };
        } else {
            return res.status(403).json({ message: 'Unauthorized' });
        }
    
        const history = await prisma.attendance.findMany({
            where: whereClause,
            include: {
                user: { select: { name: true, department: true } }
            },
            orderBy: { timestamp: 'desc' },
            take: 50
        });
    
        res.status(200).json(history);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching attendance history', error: error.message });
    }
};
