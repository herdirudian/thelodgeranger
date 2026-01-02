const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const pdfService = require('../services/pdfService');
const { sendEmail } = require('../services/emailService');

exports.createSchedule = async (req, res) => {
  try {
    const { userId, date, shiftStart, shiftEnd, description } = req.body;

    const schedule = await prisma.schedule.create({
      data: {
        userId,
        date: new Date(date),
        shiftStart: new Date(shiftStart),
        shiftEnd: new Date(shiftEnd),
        description
      },
    });

    res.status(201).json(schedule);
  } catch (error) {
    res.status(500).json({ message: 'Error creating schedule', error: error.message });
  }
};

exports.getMySchedule = async (req, res) => {
  try {
    const schedules = await prisma.schedule.findMany({
      where: { userId: req.userId },
      orderBy: { date: 'asc' },
      take: 30
    });
    res.status(200).json(schedules);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching schedule', error: error.message });
  }
};

exports.getAllSchedules = async (req, res) => {
    try {
        const schedules = await prisma.schedule.findMany({
            include: { user: { select: { name: true, department: true } } },
            orderBy: { date: 'asc' }
        });
        res.status(200).json(schedules);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching schedules', error: error.message });
    }
}

// --- Monthly Schedule Management ---

exports.createMonthlySchedule = async (req, res) => {
    try {
        const { department, month, year, data } = req.body;
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!['HOD', 'HR', 'GM'].includes(user.role)) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        // Determine initial status based on creator role
        let status = 'PENDING_HR';
        let hodApproved = false;
        let hrApproved = false;
        let gmApproved = false;

        if (user.role === 'HOD') {
            status = 'PENDING_HR';
            hodApproved = true;
        } else if (user.role === 'HR') {
            status = 'PENDING_GM';
            hodApproved = true; // HR acts as HOD for HR dept usually, or overrides
            hrApproved = true;
        } else if (user.role === 'GM') {
            status = 'APPROVED';
            hodApproved = true;
            hrApproved = true;
            gmApproved = true;
        }

        // Check if schedule already exists for this month/dept
        const existing = await prisma.monthlySchedule.findFirst({
            where: { department, month: parseInt(month), year: parseInt(year) }
        });

        if (existing) {
             // Optional: Allow update if not approved yet?
             // For now, return error
             return res.status(400).json({ message: 'Schedule for this month already exists' });
        }

        const monthlySchedule = await prisma.monthlySchedule.create({
            data: {
                department,
                month: parseInt(month),
                year: parseInt(year),
                data, // JSON
                status,
                createdByUserId: userId,
                hodApproved,
                hrApproved,
                gmApproved
            }
        });

        // Notify Next Approver
        if (status === 'PENDING_HR') {
            const hrs = await prisma.user.findMany({ where: { role: 'HR' } });
            for (const hr of hrs) {
                sendEmail(
                    hr.email,
                    `Monthly Schedule Pending Approval: ${department}`,
                    `<p>HOD <b>${user.name}</b> has submitted the monthly schedule for <b>${department}</b> (${month}/${year}).</p>
                     <p>Please login to review and approve.</p>`
                ).catch(console.error);
            }
        } else if (status === 'PENDING_GM') {
            const gms = await prisma.user.findMany({ where: { role: 'GM' } });
            for (const gm of gms) {
                sendEmail(
                    gm.email,
                    `Monthly Schedule Pending GM Approval: ${department}`,
                    `<p>HR <b>${user.name}</b> has submitted the monthly schedule for <b>${department}</b> (${month}/${year}).</p>
                     <p>Please login to review and approve.</p>`
                ).catch(console.error);
            }
        }

        // If auto-approved (GM), generate shifts immediately
        if (status === 'APPROVED') {
            await generateShiftsFromMonthly(monthlySchedule);
        }

        res.status(201).json(monthlySchedule);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating monthly schedule', error: error.message });
    }
};

exports.getMonthlySchedules = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        console.log(`getMonthlySchedules: User ${user.email} (${user.role}) fetching schedules.`);

        let whereClause = {};

        if (user.role === 'HOD') {
            whereClause = { department: user.department };
        } else if (user.role === 'HR') {
            // HR sees all
        } else if (user.role === 'GM') {
            // GM sees all
        } else {
             return res.status(403).json({ message: 'Unauthorized' });
        }

        console.log('getMonthlySchedules: whereClause:', JSON.stringify(whereClause));

        const schedules = await prisma.monthlySchedule.findMany({
            where: whereClause,
            include: { createdByUser: { select: { name: true } } },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`getMonthlySchedules: Found ${schedules.length} schedules.`);

        res.status(200).json(schedules);

    } catch (error) {
        console.error("Error in getMonthlySchedules:", error);
        res.status(500).json({ message: 'Error fetching monthly schedules', error: error.message });
    }
};

exports.getMonthlyScheduleById = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const schedule = await prisma.monthlySchedule.findUnique({
            where: { id },
            include: { createdByUser: { select: { name: true } } }
        });
        
        if (!schedule) return res.status(404).json({ message: 'Not found' });
        
        res.status(200).json(schedule);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching schedule details', error: error.message });
    }
};

exports.approveMonthlySchedule = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const { action, reason } = req.body; // action: 'APPROVE' or 'REJECT'

        const schedule = await prisma.monthlySchedule.findUnique({ where: { id } });
        if (!schedule) return res.status(404).json({ message: 'Not found' });

        if (action === 'REJECT') {
            await prisma.monthlySchedule.update({
                where: { id },
                data: {
                    status: 'REJECTED',
                    rejectionReason: reason
                }
            });

            // Notify Creator
            const creator = await prisma.user.findUnique({ where: { id: schedule.createdByUserId } });
            if (creator) {
                 sendEmail(
                     creator.email,
                     'Monthly Schedule Rejected',
                     `<p>Your monthly schedule for <b>${schedule.department}</b> (${schedule.month}/${schedule.year}) has been rejected by ${user.role}.</p><p>Reason: ${reason}</p>`
                 ).catch(console.error);
            }

            return res.json({ message: 'Schedule rejected' });
        }

        // Approve Logic
        let updateData = {};
        
        if (user.role === 'HR') {
            if (schedule.status !== 'PENDING_HR') {
                return res.status(400).json({ message: 'Invalid status for HR approval' });
            }
            updateData = {
                hrApproved: true,
                status: 'PENDING_GM'
            };
        } else if (user.role === 'GM') {
            if (schedule.status !== 'PENDING_GM' && schedule.status !== 'PENDING_HR') {
                 // GM might override HR? Let's assume strict flow: PENDING_GM
                 // Or allow GM to approve anything pending.
                 // For now strict: must be PENDING_GM (HR already approved)
                 // UNLESS it's HR department request which goes to GM?
                 // If HR created it, status was PENDING_GM.
            }
            
            // Allow GM to approve if PENDING_GM
            if (schedule.status === 'PENDING_GM') {
                updateData = {
                    gmApproved: true,
                    status: 'APPROVED'
                };
            } else {
                 return res.status(400).json({ message: 'Waiting for HR approval first' });
            }
        } else {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const updated = await prisma.monthlySchedule.update({
            where: { id },
            data: updateData
        });

        // Notify Next Approver or Creator
        if (updated.status === 'PENDING_GM') {
             const gms = await prisma.user.findMany({ where: { role: 'GM' } });
             for (const gm of gms) {
                 sendEmail(
                     gm.email,
                     `Monthly Schedule Pending GM Approval: ${schedule.department}`,
                     `<p>HR has approved the schedule for <b>${schedule.department}</b>. It is now pending your approval.</p>`
                 ).catch(console.error);
             }
        } else if (updated.status === 'APPROVED') {
             const creator = await prisma.user.findUnique({ where: { id: schedule.createdByUserId } });
             if (creator) {
                 sendEmail(
                     creator.email,
                     'Monthly Schedule Approved',
                     `<p>Your monthly schedule for <b>${schedule.department}</b> (${schedule.month}/${schedule.year}) has been fully approved.</p>`
                 ).catch(console.error);
             }
            await generateShiftsFromMonthly(updated);
        }

        res.json(updated);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error approving schedule', error: error.message });
    }
};

exports.getMonthlySchedulePDF = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        const schedule = await prisma.monthlySchedule.findUnique({
            where: { id },
            include: { createdByUser: true }
        });

        if (!schedule) return res.status(404).json({ message: 'Not found' });

        // Check permissions
        if (!['HOD', 'HR', 'GM'].includes(user.role)) {
             return res.status(403).json({ message: 'Unauthorized' });
        }
        
        // Fetch staff list for names
        const staffList = await prisma.user.findMany({
            where: { department: schedule.department },
            select: { id: true, name: true }
        });

        const pdfBytes = await pdfService.generateMonthlySchedulePDF(schedule, staffList);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=schedule-${schedule.department}-${schedule.month}-${schedule.year}.pdf`);
        res.send(Buffer.from(pdfBytes));

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error generating PDF', error: error.message });
    }
};

// Helper to generate actual Schedule records
async function generateShiftsFromMonthly(monthlySchedule) {
    const { month, year, data } = monthlySchedule;
    // data is array: [{ userId, shifts: { "1": "M", "2": "OFF" } }]
    
    // Parse JSON if it's string (Prisma handles Json type automatically usually, but be safe)
    const staffSchedules = typeof data === 'string' ? JSON.parse(data) : data;

    const shiftDefinitions = {
        'M': { start: '07:00', end: '15:00' },
        'A': { start: '15:00', end: '23:00' },
        'N': { start: '23:00', end: '07:00' },
        // Add more as needed
    };

    const newShifts = [];

    for (const staff of staffSchedules) {
        const userId = parseInt(staff.userId);
        
        for (const [day, shiftCode] of Object.entries(staff.shifts)) {
            if (shiftCode === 'OFF' || !shiftDefinitions[shiftCode]) continue;

            const def = shiftDefinitions[shiftCode];
            
            // Construct Dates
            // Note: Months are 0-indexed in JS Date, but input is 1-12
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const shiftDate = new Date(dateStr);
            
            const startDateTime = new Date(`${dateStr}T${def.start}:00`);
            let endDateTime = new Date(`${dateStr}T${def.end}:00`);
            
            // Handle Night shift spanning next day
            if (def.start === '23:00') {
                endDateTime.setDate(endDateTime.getDate() + 1);
            }

            newShifts.push({
                userId,
                date: shiftDate,
                shiftStart: startDateTime,
                shiftEnd: endDateTime,
                description: `Shift ${shiftCode}`
            });
        }
    }

    // Bulk create
    if (newShifts.length > 0) {
        await prisma.schedule.createMany({
            data: newShifts
        });
    }
}
