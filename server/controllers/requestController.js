const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const pdfService = require('../services/pdfService');
const { sendEmail } = require('../services/emailService');

exports.createRequest = async (req, res) => {
  try {
    const { 
        type, 
        startDate, 
        endDate, 
        reason,
        returnDate,
        replacementName,
        quantity,
        startTime,
        endTime,
        newEmployeeName,
        targetDepartment
    } = req.body;
    
    const userId = req.userId;

    const requester = await prisma.user.findUnique({ where: { id: userId } });

    const request = await prisma.request.create({
      data: {
        userId,
        type,
        startDate: startDate ? new Date(startDate) : new Date(), 
        endDate: endDate ? new Date(endDate) : new Date(startDate || Date.now()), 
        reason,
        status: 'PENDING_HOD',
        returnDate: returnDate ? new Date(returnDate) : null,
        replacementName,
        quantity: quantity ? parseInt(quantity) : null,
        startTime,
        endTime,
        newEmployeeName,
        targetDepartment
      },
    });

    // Notify HODs of the department
    if (requester.department) {
        const hods = await prisma.user.findMany({
            where: { role: 'HOD', department: requester.department }
        });

        const emailSubject = `New Request: ${type} from ${requester.name}`;
        const emailBody = `
            <h3>New Request Submitted</h3>
            <p><strong>Staff:</strong> ${requester.name}</p>
            <p><strong>Type:</strong> ${type}</p>
            <p><strong>Department:</strong> ${requester.department}</p>
            <p>Please login to the dashboard to review this request.</p>
        `;

        for (const hod of hods) {
            // Don't send email to self if HOD is the requester (unlikely but possible)
            if (hod.id !== requester.id) {
                sendEmail(hod.email, emailSubject, emailBody).catch(console.error);
            }
        }
    }

    res.status(201).json(request);
  } catch (error) {
    console.error("Create Request Error:", error);
    res.status(500).json({ message: 'Error creating request', error: error.message });
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
    
    let whereClause = {};

    if (user.role === 'HOD') {
        whereClause = {
            status: 'PENDING_HOD',
            user: { department: user.department }
        };
    } else if (user.role === 'HR') {
        whereClause = { status: 'PENDING_HR' };
    } else if (user.role === 'GM') {
        whereClause = { status: 'PENDING_GM' };
    } else {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const requests = await prisma.request.findMany({
        where: whereClause,
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

    const requests = await prisma.request.findMany({
        where: whereClause,
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

    if (action === 'REJECT') {
        await prisma.request.update({
            where: { id: parseInt(id) },
            data: {
                status: 'REJECTED',
                rejectionReason: reason
            }
        });

        // Notify Requester of Rejection
        sendEmail(
            request.user.email,
            `Request Rejected: ${request.type}`,
            `<p>Your request for <b>${request.type}</b> has been rejected by ${user.role}.</p>
             <p><strong>Reason:</strong> ${reason}</p>`
        ).catch(console.error);

        return res.status(200).json({ message: 'Request rejected' });
    }

    let updateData = {};

    // Add Approval Note
    if (reason) {
        if (user.role === 'HOD') updateData.hodNote = reason;
        else if (user.role === 'HR') updateData.hrNote = reason;
        else if (user.role === 'GM') updateData.gmNote = reason;
    }
    
    if (user.role === 'HOD' && request.status === 'PENDING_HOD') {
        updateData = { ...updateData, status: 'PENDING_HR', hodApproved: true };
    } else if (user.role === 'HR' && request.status === 'PENDING_HR') {
        updateData = { ...updateData, status: 'PENDING_GM', hrApproved: true };
    } else if (user.role === 'GM' && request.status === 'PENDING_GM') {
        updateData = { ...updateData, status: 'APPROVED', gmApproved: true };
    } else {
        return res.status(400).json({ message: 'Invalid approval action for current status or role' });
    }

    const updated = await prisma.request.update({
        where: { id: parseInt(id) },
        data: updateData
    });

    // Notify Next Approver or Requester
    if (updated.status === 'PENDING_HR') {
        const hrs = await prisma.user.findMany({ where: { role: 'HR' } });
        for (const hr of hrs) {
            sendEmail(
                hr.email,
                'Request Pending HR Approval',
                `<p>A request from <b>${request.user.name}</b> (${request.type}) has been approved by HOD and is pending your approval.</p>`
            ).catch(console.error);
        }
    } else if (updated.status === 'PENDING_GM') {
        const gms = await prisma.user.findMany({ where: { role: 'GM' } });
        for (const gm of gms) {
            sendEmail(
                gm.email,
                'Request Pending GM Approval',
                `<p>A request from <b>${request.user.name}</b> (${request.type}) has been approved by HR and is pending your approval.</p>`
            ).catch(console.error);
        }
    } else if (updated.status === 'APPROVED') {
        sendEmail(
            request.user.email,
            `Request Approved: ${request.type}`,
            `<p>Congratulations! Your request for <b>${request.type}</b> has been fully approved.</p>`
        ).catch(console.error);

        await updateScheduleFromRequest(updated);

        // Deduct Leave Quota
        if (request.type === 'LEAVE' && request.quantity) {
            try {
                await prisma.user.update({
                    where: { id: request.userId },
                    data: {
                        leaveQuota: {
                            decrement: request.quantity
                        }
                    }
                });
            } catch (err) {
                console.error("Error deducting leave quota:", err);
            }
        }
    }

    res.status(200).json(updated);

  } catch (error) {
    res.status(500).json({ message: 'Error processing request', error: error.message });
  }
};

async function updateScheduleFromRequest(request) {
    try {
        const { userId, type, startDate, endDate } = request;
        
        // Loop through dates
        let currentDate = new Date(startDate);
        const end = new Date(endDate);
        
        // Map request types to schedule descriptions
        const typeMap = {
            'LEAVE': 'Cuti / Leave',
            'SICK': 'Sakit / Sick',
            'PERMISSION': 'Izin / Permission',
            'OFF': 'OFF',
            'EXTERNAL_DUTY': 'Dinas Luar / External Duty',
            'ADD_MANPOWER': 'Extra Manpower',
            'OVERTIME': 'Lembur / Overtime',
            'UNPAID_LEAVE': 'Cuti Tanpa Gaji / Unpaid Leave'
        };

        const description = typeMap[type] || type;

        // Types that replace the shift (Absence)
        const absenceTypes = ['LEAVE', 'SICK', 'PERMISSION', 'OFF', 'EXTERNAL_DUTY', 'UNPAID_LEAVE'];

        if (absenceTypes.includes(type)) {
            while (currentDate <= end) {
                // Set time to 00:00 for accurate day comparison
                const dateOnly = new Date(currentDate);
                dateOnly.setHours(0, 0, 0, 0);
                
                // 1. Delete existing schedule for this day
                // We need to match the date. Prisma date filtering can be tricky with times.
                // Best is to filter gte start of day, lt end of day.
                const nextDay = new Date(dateOnly);
                nextDay.setDate(nextDay.getDate() + 1);

                await prisma.schedule.deleteMany({
                    where: {
                        userId: userId,
                        date: {
                            gte: dateOnly,
                            lt: nextDay
                        }
                    }
                });

                // 2. Create new "Absence" schedule
                // We set shiftStart and shiftEnd to the date itself (00:00) to indicate no shift time, 
                // or maybe 09:00-17:00 but with description?
                // Better to set them same as date to indicate "Full Day" if UI handles it.
                // Or set to 00:00 - 00:00.
                await prisma.schedule.create({
                    data: {
                        userId,
                        date: dateOnly,
                        shiftStart: dateOnly,
                        shiftEnd: dateOnly,
                        description: description
                    }
                });

                currentDate.setDate(currentDate.getDate() + 1);
            }
        }
        
        // Handle SHIFT_EXCHANGE (Tukar Jadwal) if needed later
        // This is complex as it involves another user.

    } catch (error) {
        console.error("Error updating schedule from request:", error);
        // Don't throw, just log. We don't want to fail the approval if schedule update fails (or maybe we do?)
        // Better to log for now.
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

        const pdfBytes = await pdfService.generateRequestPDF(request);

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
