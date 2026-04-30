const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const pdfService = require('../services/pdfService');
const { sendEmail } = require('../services/emailService');

function wibDateKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

exports.createSchedule = async (req, res) => {
  try {
    const { userId, date, shiftStart, shiftEnd, description } = req.body;

    const dateOnly =
      typeof date === 'string' && date.includes('T')
        ? new Date(date)
        : new Date(`${date}T00:00:00+07:00`);
    if (isNaN(dateOnly.getTime())) {
      return res.status(400).json({ message: 'Invalid date' });
    }
    const dateEnd = new Date(dateOnly);
    dateEnd.setUTCDate(dateEnd.getUTCDate() + 1);

    await prisma.schedule.deleteMany({
      where: {
        userId,
        date: { gte: dateOnly, lt: dateEnd }
      }
    });

    const schedule = await prisma.schedule.create({
      data: {
        userId,
        date: dateOnly,
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
    const { startDate, endDate } = req.query;
    let start = new Date();
    start.setHours(0, 0, 0, 0);
    let end = new Date(start);
    end.setDate(end.getDate() + 60);
    end.setHours(23, 59, 59, 999);

    if (startDate) {
      const s = new Date(`${startDate}T00:00:00+07:00`);
      if (!isNaN(s.getTime())) start = s;
    }
    if (endDate) {
      const e = new Date(`${endDate}T23:59:59+07:00`);
      if (!isNaN(e.getTime())) end = e;
    }

    const schedules = await prisma.schedule.findMany({
      where: { 
        userId: req.userId,
        date: { gte: start, lte: end }
      },
      orderBy: [{ date: 'asc' }, { shiftStart: 'asc' }, { id: 'asc' }],
      take: 120
    });

    const byDay = new Map();
    for (const s of schedules) {
      const key = wibDateKey(s.date);
      const existing = byDay.get(key);
      if (!existing || (s.id || 0) > (existing.id || 0)) {
        byDay.set(key, s);
      }
    }
    const deduped = Array.from(byDay.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    res.status(200).json(deduped);
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
// Updated draft logic applied
exports.createMonthlySchedule = async (req, res) => {
    try {
        const { department, month, year, data, isDraft } = req.body;
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        const allowedCreators = ['HOD', 'HR', 'GM', 'SUPERVISOR', 'PHOTOGRAPHER_HOD', 'MERCHANDISE_HOD', 'MERCHANDISE_SPV'];
        if (!allowedCreators.includes(user.role)) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        let status = 'PENDING_HR';
        let hodApproved = false;
        let hrApproved = false;
        let gmApproved = false;

        if (isDraft) {
            status = 'DRAFT';
            hodApproved = false;
            hrApproved = false;
            gmApproved = false;
        } else {
            if (['HOD', 'SUPERVISOR', 'PHOTOGRAPHER_HOD', 'MERCHANDISE_HOD', 'MERCHANDISE_SPV'].includes(user.role)) {
                status = 'PENDING_HR';
                hodApproved = true;
            } else if (user.role === 'HR') {
                status = 'PENDING_GM';
                hodApproved = true;
                hrApproved = true;
            } else if (user.role === 'GM') {
                status = 'APPROVED';
                hodApproved = true;
                hrApproved = true;
                gmApproved = true;
            }
        }

        const existing = await prisma.monthlySchedule.findFirst({
            where: { department, month: parseInt(month), year: parseInt(year) }
        });

        let monthlySchedule;

        if (existing) {
            if (existing.status !== 'REJECTED' && existing.status !== 'DRAFT') {
                return res.status(400).json({ message: 'Schedule for this month already exists' });
            }

            monthlySchedule = await prisma.monthlySchedule.update({
                where: { id: existing.id },
                data: {
                    data,
                    status,
                    hodApproved,
                    hrApproved,
                    gmApproved,
                    rejectionReason: null
                }
            });
        } else {
            monthlySchedule = await prisma.monthlySchedule.create({
                data: {
                    department,
                    month: parseInt(month),
                    year: parseInt(year),
                    data,
                    status,
                    createdByUserId: userId,
                    hodApproved,
                    hrApproved,
                    gmApproved
                }
            });
        }

        // Notify Next Approver
        if (!isDraft) {
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

async function buildMonthlyDataFromIndividualSchedule(monthlySchedule) {
    const { month, year, department } = monthlySchedule;

    const rangeStart = new Date(year, month - 2, 21);
    rangeStart.setUTCHours(0, 0, 0, 0);
    const rangeEnd = new Date(year, month - 1, 20);
    rangeEnd.setUTCHours(23, 59, 59, 999);

    const rows = await prisma.schedule.findMany({
        where: {
            date: { gte: rangeStart, lte: rangeEnd },
            user: { department }
        },
        select: {
            userId: true,
            date: true,
            shiftName: true
        }
    });

    const scheduleData = {};
    const inchargePerDay = {};
    const locationPalette = {};

    const reverseMap = {
        'Cuti': 'C',
        'Sakit': 'S',
        'Izin': 'I',
        'Dinas Luar': 'D',
        'Cuti / Leave': 'C',
        'Sakit / Sick': 'S',
        'Izin / Permission': 'I',
        'Dinas Luar / External Duty': 'D',
        'OFF (Exchange)': 'OFF'
    };

    for (const row of rows) {
        const uId = row.userId;
        const dateObj = new Date(row.date);
        dateObj.setUTCHours(0, 0, 0, 0);
        const dateStr = dateObj.toISOString().split('T')[0];

        let code = row.shiftName;
        if (!code) continue;
        if (reverseMap[code]) code = reverseMap[code];

        if (!scheduleData[uId]) scheduleData[uId] = {};
        scheduleData[uId][dateStr] = code;
    }

    return {
        scheduleData,
        inchargePerDay,
        locationPalette
    };
}

exports.getMonthlyScheduleGrid = async (req, res) => {
    try {
        const id = parseInt(req.params.id);

        const schedule = await prisma.monthlySchedule.findUnique({
            where: { id }
        });

        if (!schedule) {
            return res.status(404).json({ message: 'Not found' });
        }

        const data = await buildMonthlyDataFromIndividualSchedule(schedule);

        res.status(200).json(data);
    } catch (error) {
        console.error('Error in getMonthlyScheduleGrid:', error);
        res.status(500).json({ message: 'Error building schedule grid from attendance', error: error.message });
    }
};

exports.getMonthlySchedules = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        console.log(`getMonthlySchedules: User ${user.email} (${user.role}) fetching schedules.`);

        let whereClause = {};

        if (['HOD', 'SUPERVISOR', 'PHOTOGRAPHER_HOD', 'MERCHANDISE_HOD', 'MERCHANDISE_SPV'].includes(user.role)) {
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

        for (const sched of schedules) {
            try {
                let raw = sched.data;
                if (typeof raw === 'string') {
                    try {
                        raw = JSON.parse(raw);
                    } catch (e) {
                        console.error('Failed to parse monthlySchedule.data string for id', sched.id, e);
                        raw = null;
                    }
                }

                let normalized = {
                    scheduleData: {},
                    inchargePerDay: {},
                    locationPalette: {}
                };

                if (Array.isArray(raw)) {
                    for (const entry of raw) {
                        const rawUserId = entry.userId;
                        const userId = typeof rawUserId === 'string' ? parseInt(rawUserId, 10) : rawUserId;
                        if (!userId) continue;

                        const shifts = entry.shifts || {};
                        const locations = entry.locations || {};

                        if (!normalized.scheduleData[userId]) normalized.scheduleData[userId] = {};
                        if (!normalized.inchargePerDay[userId]) normalized.inchargePerDay[userId] = {};

                        Object.keys(shifts).forEach(k => {
                            const val = shifts[k];
                            if (!val) return;
                            normalized.scheduleData[userId][k] = val;
                        });

                        Object.keys(locations).forEach(k => {
                            const val = locations[k];
                            if (!val) return;
                            normalized.inchargePerDay[userId][k] = val;
                        });
                    }
                } else if (raw && typeof raw === 'object') {
                    if (raw.scheduleData || raw.inchargePerDay || raw.locationPalette) {
                        normalized.scheduleData = raw.scheduleData || {};
                        normalized.inchargePerDay = raw.inchargePerDay || {};
                        normalized.locationPalette = raw.locationPalette || {};
                    } else {
                        normalized.scheduleData = raw || {};
                        normalized.inchargePerDay = {};
                        normalized.locationPalette = {};
                    }
                }

                const hasAnyData =
                    Object.keys(normalized.scheduleData).length > 0 ||
                    Object.keys(normalized.inchargePerDay).length > 0;

                if (!hasAnyData && sched.status === 'APPROVED') {
                    const built = await buildMonthlyDataFromIndividualSchedule(sched);
                    normalized = built;
                }

                await prisma.monthlySchedule.update({
                    where: { id: sched.id },
                    data: { data: normalized }
                });

                sched.data = normalized;
            } catch (e) {
                console.error('Error normalizing monthlySchedule.data for id', sched.id, e);
            }
        }

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

exports.refreshScheduleShifts = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        const schedule = await prisma.monthlySchedule.findUnique({ where: { id } });
        if (!schedule) return res.status(404).json({ message: 'Not found' });

        // Check permissions
        const allowedRoles = ['HOD', 'HR', 'GM', 'SUPERVISOR', 'PHOTOGRAPHER_HOD', 'MERCHANDISE_HOD', 'MERCHANDISE_SPV'];
        if (!allowedRoles.includes(user.role)) {
             return res.status(403).json({ message: 'Unauthorized' });
        }

        await generateShiftsFromMonthly(schedule);

        res.json({ message: 'Shifts refreshed successfully' });
    } catch (error) {
        console.error("Error refreshing shifts:", error);
        res.status(500).json({ message: 'Error refreshing shifts', error: error.message });
    }
};

exports.syncApprovedRequestsToMonthly = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const schedule = await prisma.monthlySchedule.findUnique({ where: { id } });
        if (!schedule) return res.status(404).json({ message: 'Not found' });

        const { month, year, department } = schedule;

        // Calculate Date Range (21st prev month - 20th current month)
        const rangeStart = new Date(year, month - 2, 21);
        rangeStart.setUTCHours(0, 0, 0, 0);
        const rangeEnd = new Date(year, month - 1, 20);
        rangeEnd.setUTCHours(23, 59, 59, 999);

        // Fetch all approved requests for this department in this range
        const approvedRequests = await prisma.request.findMany({
            where: {
                status: 'APPROVED',
                user: { department: department },
                OR: [
                    { startDate: { gte: rangeStart, lte: rangeEnd } },
                    { endDate: { gte: rangeStart, lte: rangeEnd } },
                    { AND: [{ startDate: { lte: rangeStart } }, { endDate: { gte: rangeEnd } }] }
                ]
            }
        });

        if (approvedRequests.length === 0) {
            return res.json({ message: 'No approved requests found for this period.', count: 0 });
        }

        let scheduleData = schedule.data;
        if (typeof scheduleData === 'string') {
            try {
                scheduleData = JSON.parse(scheduleData);
            } catch (e) {
                console.error("Failed to parse monthlySchedule.data, resetting to empty object", e);
                scheduleData = {};
            }
        }
        if (!scheduleData) {
            scheduleData = {};
        }
        let updateCount = 0;

        const shiftCodeMap = {
            'LEAVE': 'C',
            'SICK': 'S',
            'PERMISSION': 'I',
            'OFF': 'OFF',
            'UNPAID_LEAVE': 'C',
            'PDO': 'PDO',
            'EXTERNAL_DUTY': 'D'
        };

        for (const request of approvedRequests) {
            const userId = request.userId;
            
            if (request.type === 'SHIFT_EXCHANGE' && request.replacementDate) {
                // For Shift Exchange, we sync the current shifts from individual Schedule table
                // back to MonthlySchedule to ensure they are consistent
                const datesToSync = [];
                // Add requester dates
                datesToSync.push({ date: new Date(request.startDate), uId: userId });
                datesToSync.push({ date: new Date(request.replacementDate), uId: userId });

                // If there's a replacement user, sync their dates too
                if (request.replacementName && request.replacementName !== 'Tidak ada pengganti') {
                    const replUser = await prisma.user.findFirst({ where: { name: request.replacementName } });
                    if (replUser) {
                        datesToSync.push({ date: new Date(request.startDate), uId: replUser.id });
                        datesToSync.push({ date: new Date(request.replacementDate), uId: replUser.id });
                    }
                }

                // Filter unique combinations of uId and date (ISO string) to avoid double counting/updating
                const uniqueDatesToSync = [];
                const seen = new Set();
                for (const item of datesToSync) {
                    const d = new Date(item.date);
                    d.setUTCHours(0,0,0,0);
                    const key = `${item.uId}-${d.toISOString()}`;
                    if (!seen.has(key)) {
                        seen.add(key);
                        uniqueDatesToSync.push({ date: d, uId: item.uId });
                    }
                }

                for (const item of uniqueDatesToSync) {
                    const nextDay = new Date(item.date);
                    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
                    
                    const individualShift = await prisma.schedule.findFirst({
                        where: { userId: item.uId, date: { gte: item.date, lt: nextDay } }
                    });

                    if (individualShift) {
                        const dateStr = item.date.toISOString().split('T')[0];
                        let shiftCode = individualShift.shiftName; // e.g. "M1", "OFF", "Cuti"

                        // Map back special names to codes if necessary
                        const reverseSpecialMap = {
                            'Cuti': 'C',
                            'Sakit': 'S',
                            'Izin': 'I',
                            'Dinas Luar': 'D',
                            'Cuti / Leave': 'C',
                            'Sakit / Sick': 'S',
                            'Izin / Permission': 'I',
                            'Dinas Luar / External Duty': 'D',
                            'OFF (Exchange)': 'OFF'
                        };
                        if (reverseSpecialMap[shiftCode]) {
                            shiftCode = reverseSpecialMap[shiftCode];
                        }

                        if (Array.isArray(scheduleData)) {
                            let staffEntry = scheduleData.find(s => parseInt(s.userId) === parseInt(item.uId));
                            if (!staffEntry) {
                                staffEntry = { userId: parseInt(item.uId), shifts: {} };
                                scheduleData.push(staffEntry);
                            }
                            if (!staffEntry.shifts) staffEntry.shifts = {};
                            staffEntry.shifts[dateStr] = shiftCode;
                            updateCount++;
                        } else if (scheduleData && scheduleData.scheduleData) {
                            if (!scheduleData.scheduleData[item.uId]) {
                                scheduleData.scheduleData[item.uId] = {};
                            }
                            scheduleData.scheduleData[item.uId][dateStr] = shiftCode;
                            updateCount++;
                        }
                    }
                }
                continue;
            }

            // ADD_MANPOWER: tandai Extra Man Power (kode 'E') pada karyawan yang dipilih
            if (request.type === 'ADD_MANPOWER' && request.newEmployeeName) {
                const extraUser = await prisma.user.findFirst({
                    where: { name: request.newEmployeeName }
                });

                if (!extraUser) continue;

                const extraUserId = extraUser.id;
                const shiftCode = 'E';

                if (Array.isArray(scheduleData)) {
                    let staffEntry = scheduleData.find(s => parseInt(s.userId) === parseInt(extraUserId));
                    if (!staffEntry) {
                        staffEntry = { userId: parseInt(extraUserId), shifts: {} };
                        scheduleData.push(staffEntry);
                    }
                    if (!staffEntry.shifts) staffEntry.shifts = {};

                    let current = new Date(request.startDate);
                    const end = new Date(request.endDate || request.startDate);
                    while (current <= end) {
                        if (current >= rangeStart && current <= rangeEnd) {
                            const dateStr = current.toISOString().split('T')[0];
                            staffEntry.shifts[dateStr] = shiftCode;
                            updateCount++;
                        }
                        current.setUTCDate(current.getUTCDate() + 1);
                    }
                } else if (scheduleData && scheduleData.scheduleData) {
                    if (!scheduleData.scheduleData[extraUserId]) {
                        scheduleData.scheduleData[extraUserId] = {};
                    }
                    let current = new Date(request.startDate);
                    const end = new Date(request.endDate || request.startDate);
                    while (current <= end) {
                        if (current >= rangeStart && current <= rangeEnd) {
                            const dateStr = current.toISOString().split('T')[0];
                            scheduleData.scheduleData[extraUserId][dateStr] = shiftCode;
                            updateCount++;
                        }
                        current.setUTCDate(current.getUTCDate() + 1);
                    }
                }

                continue;
            }
            
            // Mark Replacement Staff as Extra Manpower ('E') on same dates for absence-type requests
            if (request.replacementName && ['LEAVE','SICK','PERMISSION','OFF','UNPAID_LEAVE','PDO','EXTERNAL_DUTY'].includes(request.type)) {
                let replacementUser = null;
                if (String(request.replacementName).includes('|')) {
                    const parts = String(request.replacementName).split('|');
                    const idStr = parts[1] && parts[1].trim();
                    const parsedId = idStr ? parseInt(idStr, 10) : null;
                    if (parsedId && !Number.isNaN(parsedId)) {
                        replacementUser = await prisma.user.findUnique({ where: { id: parsedId } });
                    }
                }
                if (!replacementUser) {
                    replacementUser = await prisma.user.findFirst({
                        where: {
                            OR: [
                                { name: request.replacementName },
                                { name: { contains: request.replacementName } }
                            ]
                        }
                    });
                }
                if (replacementUser) {
                    const replId = parseInt(replacementUser.id);
                    if (Array.isArray(scheduleData)) {
                        let staffEntry = scheduleData.find(s => parseInt(s.userId) === replId);
                        if (!staffEntry) {
                            staffEntry = { userId: replId, shifts: {} };
                            scheduleData.push(staffEntry);
                        }
                        if (!staffEntry.shifts) staffEntry.shifts = {};
                        let current = new Date(request.startDate);
                        const end = new Date(request.endDate || request.startDate);
                        while (current <= end) {
                            if (current >= rangeStart && current <= rangeEnd) {
                                const dateStr = current.toISOString().split('T')[0];
                                staffEntry.shifts[dateStr] = 'E';
                                updateCount++;
                            }
                            current.setUTCDate(current.getUTCDate() + 1);
                        }
                    } else if (scheduleData && scheduleData.scheduleData) {
                        if (!scheduleData.scheduleData[replId]) {
                            scheduleData.scheduleData[replId] = {};
                        }
                        let current = new Date(request.startDate);
                        const end = new Date(request.endDate || request.startDate);
                        while (current <= end) {
                            if (current >= rangeStart && current <= rangeEnd) {
                                const dateStr = current.toISOString().split('T')[0];
                                scheduleData.scheduleData[replId][dateStr] = 'E';
                                updateCount++;
                            }
                            current.setUTCDate(current.getUTCDate() + 1);
                        }
                    }
                }
            }
            
            const shiftCode = shiftCodeMap[request.type];
            if (!shiftCode) continue;
            
            // Format can be array of staff objects or object with scheduleData
            if (Array.isArray(scheduleData)) {
                let staffEntry = scheduleData.find(s => parseInt(s.userId) === parseInt(userId));
                if (!staffEntry) {
                    staffEntry = { userId: parseInt(userId), shifts: {} };
                    scheduleData.push(staffEntry);
                }
                if (!staffEntry.shifts) staffEntry.shifts = {};
                
                let current = new Date(request.startDate);
                const end = new Date(request.endDate || request.startDate);
                while (current <= end) {
                    if (current >= rangeStart && current <= rangeEnd) {
                        const dateStr = current.toISOString().split('T')[0];
                        staffEntry.shifts[dateStr] = shiftCode;
                        updateCount++;
                    }
                    current.setUTCDate(current.getUTCDate() + 1);
                }
            } else if (scheduleData && scheduleData.scheduleData) {
                if (!scheduleData.scheduleData[userId]) {
                    scheduleData.scheduleData[userId] = {};
                }
                let current = new Date(request.startDate);
                const end = new Date(request.endDate || request.startDate);
                while (current <= end) {
                    if (current >= rangeStart && current <= rangeEnd) {
                        const dateStr = current.toISOString().split('T')[0];
                        scheduleData.scheduleData[userId][dateStr] = shiftCode;
                        updateCount++;
                    }
                    current.setUTCDate(current.getUTCDate() + 1);
                }
            }
        }

        const updated = await prisma.monthlySchedule.update({
            where: { id },
            data: { data: scheduleData }
        });

        // Refresh individual shifts
        await generateShiftsFromMonthly(updated);

        res.json({ message: `Successfully synced ${updateCount} dates from ${approvedRequests.length} requests.`, count: updateCount });

    } catch (error) {
        console.error("Error syncing requests:", error);
        res.status(500).json({ message: 'Error syncing requests', error: error.message });
    }
};

exports.reviseMonthlySchedule = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        const schedule = await prisma.monthlySchedule.findUnique({ where: { id } });
        if (!schedule) return res.status(404).json({ message: 'Not found' });

        // Only HR can revise approved schedules
        if (user.role !== 'HR') {
             return res.status(403).json({ message: 'Unauthorized. Only HR can revise schedules.' });
        }

        const updated = await prisma.monthlySchedule.update({
            where: { id },
            data: {
                status: 'DRAFT',
                hodApproved: false,
                hrApproved: false,
                gmApproved: false
            }
        });

        // Notify Creator (HOD)
        const creator = await prisma.user.findUnique({ where: { id: schedule.createdByUserId } });
        if (creator) {
             sendEmail(
                 creator.email,
                 'Schedule Returned for Revision',
                 `<p>Your monthly schedule for <b>${schedule.department}</b> (${schedule.month}/${schedule.year}) has been returned to DRAFT status by HR for revision.</p>
                 <p>You can now edit and resubmit it without losing your data.</p>`
             ).catch(console.error);
        }

        res.json({ message: 'Schedule status reverted to DRAFT for revision', schedule: updated });

    } catch (error) {
        console.error("Error revising schedule:", error);
        res.status(500).json({ message: 'Error revising schedule', error: error.message });
    }
};

exports.hrAdjustMonthlySchedule = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const { data } = req.body;

        if (!user || (user.role !== 'HR' && user.role !== 'GM' && user.role !== 'ADMIN')) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const existing = await prisma.monthlySchedule.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ message: 'Not found' });
        }

        if (existing.status !== 'APPROVED') {
            return res.status(400).json({ message: 'Only APPROVED schedules can be adjusted by HR directly' });
        }

        const updated = await prisma.monthlySchedule.update({
            where: { id },
            data: {
                data,
                status: 'APPROVED',
                hodApproved: true,
                hrApproved: true,
                gmApproved: existing.gmApproved
            }
        });

        await generateShiftsFromMonthly(updated);

        res.json({ message: 'Schedule adjusted successfully by HR', schedule: updated });
    } catch (error) {
        console.error('Error in hrAdjustMonthlySchedule:', error);
        res.status(500).json({ message: 'Error adjusting schedule', error: error.message });
    }
};

exports.syncAllActiveMonthly = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !['HR', 'GM', 'ADMIN'].includes(user.role)) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        const { department: filterDept } = req.body || {};
        const now = new Date();
        const candidates = await prisma.monthlySchedule.findMany({
            where: {
                status: 'APPROVED',
                ...(filterDept ? { department: filterDept } : {})
            },
            orderBy: { createdAt: 'desc' }
        });

        let processed = 0;
        const errors = [];
        for (const schedule of candidates) {
            try {
                const { month, year, department } = schedule;
                const rangeStart = new Date(year, month - 2, 21);
                rangeStart.setUTCHours(0, 0, 0, 0);
                const rangeEnd = new Date(year, month - 1, 20);
                rangeEnd.setUTCHours(23, 59, 59, 999);
                if (now < rangeStart || now > rangeEnd) continue;

                let scheduleData = schedule.data;
                if (typeof scheduleData === 'string') {
                    try { scheduleData = JSON.parse(scheduleData); } catch { scheduleData = {}; }
                }
                if (!scheduleData) scheduleData = {};

                const approvedRequests = await prisma.request.findMany({
                    where: {
                        status: 'APPROVED',
                        user: { department },
                        OR: [
                            { startDate: { gte: rangeStart, lte: rangeEnd } },
                            { endDate: { gte: rangeStart, lte: rangeEnd } },
                            { AND: [{ startDate: { lte: rangeStart } }, { endDate: { gte: rangeEnd } }] }
                        ]
                    }
                });
                if (approvedRequests.length === 0) continue;

                const shiftCodeMap = { LEAVE: 'C', SICK: 'S', PERMISSION: 'I', OFF: 'OFF', UNPAID_LEAVE: 'C', PDO: 'PDO', EXTERNAL_DUTY: 'D' };
                let updateCount = 0;

                for (const request of approvedRequests) {
                    const userIdReq = request.userId;
                    const shiftCode = shiftCodeMap[request.type];
                    if (shiftCode) {
                        if (Array.isArray(scheduleData)) {
                            let entry = scheduleData.find(s => parseInt(s.userId) === parseInt(userIdReq));
                            if (!entry) { entry = { userId: parseInt(userIdReq), shifts: {} }; scheduleData.push(entry); }
                            if (!entry.shifts) entry.shifts = {};
                            let current = new Date(request.startDate);
                            const end = new Date(request.endDate || request.startDate);
                            while (current <= end) {
                                if (current >= rangeStart && current <= rangeEnd) {
                                    const dateStr = current.toISOString().split('T')[0];
                                    entry.shifts[dateStr] = shiftCode;
                                    updateCount++;
                                }
                                current.setUTCDate(current.getUTCDate() + 1);
                            }
                        } else if (scheduleData && scheduleData.scheduleData) {
                            if (!scheduleData.scheduleData[userIdReq]) scheduleData.scheduleData[userIdReq] = {};
                            let current = new Date(request.startDate);
                            const end = new Date(request.endDate || request.startDate);
                            while (current <= end) {
                                if (current >= rangeStart && current <= rangeEnd) {
                                    const dateStr = current.toISOString().split('T')[0];
                                    scheduleData.scheduleData[userIdReq][dateStr] = shiftCode;
                                    updateCount++;
                                }
                                current.setUTCDate(current.getUTCDate() + 1);
                            }
                        }
                    }

                    if (request.replacementName) {
                        let replUser = null;
                        if (String(request.replacementName).includes('|')) {
                            const parts = String(request.replacementName).split('|');
                            const idStr = parts[1] && parts[1].trim();
                            const parsedId = idStr ? parseInt(idStr, 10) : null;
                            if (parsedId && !Number.isNaN(parsedId)) {
                                replUser = await prisma.user.findUnique({ where: { id: parsedId } });
                            }
                        }
                    if (!replUser) {
                        replUser = await prisma.user.findFirst({
                            where: {
                                OR: [
                                    { name: request.replacementName },
                                    { name: { contains: request.replacementName } }
                                ]
                            }
                        });
                    }
                        if (replUser) {
                            const replId = replUser.id;
                            if (Array.isArray(scheduleData)) {
                                let entry = scheduleData.find(s => parseInt(s.userId) === parseInt(replId));
                                if (!entry) { entry = { userId: parseInt(replId), shifts: {} }; scheduleData.push(entry); }
                                if (!entry.shifts) entry.shifts = {};
                                let current = new Date(request.startDate);
                                const end = new Date(request.endDate || request.startDate);
                                while (current <= end) {
                                    if (current >= rangeStart && current <= rangeEnd) {
                                        const dateStr = current.toISOString().split('T')[0];
                                        entry.shifts[dateStr] = 'E';
                                        updateCount++;
                                    }
                                    current.setUTCDate(current.getUTCDate() + 1);
                                }
                            } else if (scheduleData && scheduleData.scheduleData) {
                                if (!scheduleData.scheduleData[replId]) scheduleData.scheduleData[replId] = {};
                                let current = new Date(request.startDate);
                                const end = new Date(request.endDate || request.startDate);
                                while (current <= end) {
                                    if (current >= rangeStart && current <= rangeEnd) {
                                        const dateStr = current.toISOString().split('T')[0];
                                        scheduleData.scheduleData[replId][dateStr] = 'E';
                                        updateCount++;
                                    }
                                    current.setUTCDate(current.getUTCDate() + 1);
                                }
                            }
                        }
                    }
                }

                await prisma.monthlySchedule.update({
                    where: { id: schedule.id },
                    data: { data: scheduleData }
                });
                const updated = await prisma.monthlySchedule.findUnique({ where: { id: schedule.id } });
                await generateShiftsFromMonthly(updated);
                processed++;
            } catch (e) {
                errors.push({ id: schedule.id, message: e.message });
            }
        }

        const msg = `Sync All completed. Processed ${processed} active schedules.${errors.length ? ` Errors: ${errors.length}` : ''}`;
        res.json({ message: msg, errors });
    } catch (error) {
        console.error('Error in syncAllActiveMonthly:', error);
        res.status(500).json({ message: 'Error syncing all monthly schedules', error: error.message });
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
        const allowedViewers = ['HOD', 'HR', 'GM', 'SUPERVISOR', 'PHOTOGRAPHER_HOD', 'MERCHANDISE_HOD', 'MERCHANDISE_SPV'];
        if (!allowedViewers.includes(user.role)) {
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
    const raw = typeof data === 'string' ? JSON.parse(data) : data;
    let entries = [];
    if (Array.isArray(raw)) {
        entries = raw.map(e => ({
            userId: typeof e.userId === 'string' ? parseInt(e.userId, 10) : e.userId,
            shifts: e.shifts || {},
            manualTimes: e.manualTimes || {}
        }));
    } else if (raw && raw.scheduleData) {
        for (const [uidKey, shifts] of Object.entries(raw.scheduleData)) {
            const uid = typeof uidKey === 'string' ? parseInt(uidKey, 10) : uidKey;
            const manualTimes = raw.manualTimes ? raw.manualTimes[uidKey] || {} : {};
            entries.push({ userId: uid, shifts: shifts || {}, manualTimes });
        }
    } else {
        entries = [];
    }

    const shiftDefinitions = {
        'M1': { start: '06:00', end: '15:00' },
        'M2': { start: '07:00', end: '16:00' },
        'M3': { start: '07:00', end: '19:00' },
        'M4': { start: '08:00', end: '17:00' },
        'M5': { start: '09:00', end: '18:00' },
        'M6': { start: '10:00', end: '19:00' },
        'A1': { start: '12:00', end: '21:00' },
        'A2': { start: '13:00', end: '22:00' },
        'A3': { start: '15:00', end: '00:00' },
        'N1': { start: '19:00', end: '07:00' },
        'N2': { start: '23:00', end: '08:00' },
    };

    // Calculate Date Range for Cleanup (21st prev month - 20th current month)
    const rangeStart = new Date(year, month - 2, 21);
    const rangeEnd = new Date(year, month - 1, 20);
    rangeEnd.setHours(23, 59, 59, 999);

    const userIds = entries.map(s => parseInt(s.userId));

    // Clear existing shifts to avoid duplicates
    await prisma.schedule.deleteMany({
        where: {
            userId: { in: userIds },
            date: {
                gte: rangeStart,
                lte: rangeEnd
            }
        }
    });

    const newShifts = [];

    for (const staff of entries) {
        const userId = parseInt(staff.userId);
        const manualTimes = staff.manualTimes || {};
        
        for (const [key, shiftCode] of Object.entries(staff.shifts || {})) {
            const specialCodes = {
                'OFF': 'OFF',
                'C': 'Cuti',
                'S': 'Sakit',
                'I': 'Izin',
                'E': 'Extra Manpower',
                'D': 'Dinas Luar',
                'PDO': 'Pending Day Off'
            };

            const isWorkingShift = shiftDefinitions[shiftCode];
            const isSpecialCode = specialCodes[shiftCode];

            if (!isWorkingShift && !isSpecialCode) continue;

            let dateStr;
            if (key.includes('-')) {
                dateStr = key;
            } else {
                 dateStr = `${year}-${String(month).padStart(2, '0')}-${String(key).padStart(2, '0')}`;
            }

            const shiftDate = new Date(dateStr);
            
            let startDateTime, endDateTime, description;

            if (isWorkingShift) {
                const def = shiftDefinitions[shiftCode];
                const manualTimeForDay = manualTimes ? manualTimes[key] : undefined;
                
                const startTimeStr = manualTimeForDay || def.start;
                startDateTime = new Date(`${dateStr}T${startTimeStr}:00+07:00`);
                endDateTime = new Date(`${dateStr}T${def.end}:00+07:00`);
                
                const startHour = parseInt(def.start.split(':')[0]);
                const endHour = parseInt(def.end.split(':')[0]);
                if (endHour < startHour) {
                    endDateTime.setDate(endDateTime.getDate() + 1);
                }
                description = `Shift ${shiftCode}`;
            } else {
                startDateTime = new Date(`${dateStr}T00:00:00+07:00`);
                endDateTime = new Date(`${dateStr}T00:00:00+07:00`);
                description = isSpecialCode; // 'OFF', 'Cuti', 'Sakit', 'Izin'
            }

            newShifts.push({
                userId,
                date: shiftDate,
                shiftStart: startDateTime,
                shiftEnd: endDateTime,
                description: description,
                shiftName: isWorkingShift ? shiftCode : isSpecialCode
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
