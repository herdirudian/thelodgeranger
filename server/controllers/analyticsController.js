const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { startOfMonth, subMonths, endOfMonth, format, isAfter, parseISO, isValid, startOfDay, endOfDay } = require('date-fns');

// Helper: Get Date Filter
const getDateFilter = (req) => {
    const now = new Date();
    const mStart = startOfMonth(now);
    const y1 = mStart.getFullYear();
    const mo1 = String(mStart.getMonth() + 1).padStart(2, '0');
    const d1 = String(mStart.getDate()).padStart(2, '0');
    let start = new Date(`${y1}-${mo1}-${d1}T00:00:00+07:00`);
    const mEnd = endOfMonth(now);
    const y2 = mEnd.getFullYear();
    const mo2 = String(mEnd.getMonth() + 1).padStart(2, '0');
    const d2 = String(mEnd.getDate()).padStart(2, '0');
    let end = new Date(`${y2}-${mo2}-${d2}T23:59:59+07:00`);

    if (req.query.startDate) {
        const parsedStart = parseISO(req.query.startDate);
        if (isValid(parsedStart)) {
            const ys = parsedStart.getFullYear();
            const ms = String(parsedStart.getMonth() + 1).padStart(2, '0');
            const ds = String(parsedStart.getDate()).padStart(2, '0');
            start = new Date(`${ys}-${ms}-${ds}T00:00:00+07:00`);
        }
    }
    
    if (req.query.endDate) {
        const parsedEnd = parseISO(req.query.endDate);
        if (isValid(parsedEnd)) {
            const ye = parsedEnd.getFullYear();
            const me = String(parsedEnd.getMonth() + 1).padStart(2, '0');
            const de = String(parsedEnd.getDate()).padStart(2, '0');
            end = new Date(`${ye}-${me}-${de}T23:59:59+07:00`);
        }
    }
    
    return { start, end };
};

// Helper: Get Department Filter
const getDeptFilter = (req) => {
    const dept = req.query.department;
    if (dept && dept !== 'ALL') {
        return { user: { department: dept } };
    }
    return {};
};

// Helper: Role-aware Department Filter
// HOD roles only see their own department. SUPERVISOR sees all (like HR).
// Default: restrict to user's own department if not admin-like.
const getRoleAwareDeptFilter = async (req) => {
    const role = req.role;
    const deptParam = req.query.department;
    const allowAllRoles = ['HR', 'GM', 'ADMIN', 'SUPERVISOR', 'MERCHANDISE_SPV'];
    const hodRoles = ['HOD', 'PHOTOGRAPHER_HOD', 'MERCHANDISE_HOD'];
    
    if (allowAllRoles.includes(role)) {
        if (deptParam && deptParam !== 'ALL') {
            return { user: { department: deptParam } };
        }
        return {};
    }
    
    if (hodRoles.includes(role)) {
        const me = await prisma.user.findUnique({
            where: { id: req.userId },
            select: { department: true }
        });
        if (me?.department) {
            return { user: { department: me.department } };
        }
        return {};
    }
    
    // Other roles: restrict to their own department
    const me = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { department: true }
    });
    if (me?.department) {
        return { user: { department: me.department } };
    }
    return {};
};
exports.getDepartments = async (req, res) => {
    try {
        const departments = await prisma.user.findMany({
            distinct: ['department'],
            select: { department: true },
            where: { 
                department: { not: null },
                NOT: { department: "" }
            },
            orderBy: { department: 'asc' }
        });
        res.json(departments.map(d => d.department));
    } catch (error) {
        console.error("Error fetching departments:", error);
        res.status(500).json({ message: 'Error fetching departments', error: error.message });
    }
};

exports.getDepartmentAttendance = async (req, res) => {
  try {
    // If specific dates are provided, calculate attendance for that period
    // If not, default to Today's snapshot (as per original logic) OR default to this month?
    // User asked for "filter per date". So we should respect the date filter.
    
    // However, the chart is "Department Attendance".
    // If range is 1 month, showing "Present" count might be huge (sum of all days).
    // Maybe we should show "Average Daily Attendance" or just "Total Check-ins"?
    // Let's show Total Check-ins for the period for now.
    
    const { start, end } = getDateFilter(req);
    // Override default for this specific function if no dates provided? 
    // The helper defaults to "This Month".
    // Original logic was "Today".
    // Let's use "Today" if no query params provided, else use params.
    
    let queryStart = start;
    let queryEnd = end;
    
    if (!req.query.startDate && !req.query.endDate) {
        // Default to Today for this specific widget if no filter active
        const now = new Date();
        const currentUtc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const currentWib = new Date(currentUtc + (7 * 3600000));
        currentWib.setHours(0, 0, 0, 0);
        queryStart = new Date(currentWib.getTime() - (7 * 3600000));
        currentWib.setHours(23, 59, 59, 999);
        queryEnd = new Date(currentWib.getTime() - (7 * 3600000));
    }

    // Filter by role-aware department
    const deptAware = await getRoleAwareDeptFilter(req);
    const deptFilter = deptAware.user ? { department: deptAware.user.department } : {};

    // 1. Get total users per department (snapshot)
    const usersByDept = await prisma.user.groupBy({
      by: ['department'],
      _count: {
        id: true
      },
      where: {
        NOT: {
            role: 'GM'
        },
        ...deptFilter
      }
    });

    // Get attendance in range
    const attendances = await prisma.attendance.findMany({
        where: {
            timestamp: {
                gte: queryStart,
                lte: queryEnd
            },
            type: { in: ['CHECK_IN', 'EXTERNAL', 'EXTERNAL_DUTY'] },
            ...(Object.keys(deptFilter).length > 0 ? { user: deptAware.user } : {})
        },
        include: { user: true }
    });

    // Process
    const attendanceCountByDept = {};
    attendances.forEach(att => {
        const dept = att.user.department || 'Unassigned';
        attendanceCountByDept[dept] = (attendanceCountByDept[dept] || 0) + 1;
    });

    const result = usersByDept.map(deptGroup => {
        const dept = deptGroup.department || 'Unassigned';
        const totalStaff = deptGroup._count.id;
        
        // If viewing a range > 1 day, "Present" > Total Staff is possible.
        // Percentage only makes sense for single day.
        // Let's hide percentage if range > 1 day (approx 24h)
        const isSingleDay = (queryEnd.getTime() - queryStart.getTime()) <= 86400000 + 1000;
        
        const present = attendanceCountByDept[dept] || 0;
        const percentage = (isSingleDay && totalStaff > 0) 
            ? Math.round((present / totalStaff) * 100) 
            : 0;

        return {
            department: dept,
            totalStaff,
            present,
            percentage,
            isMultiDay: !isSingleDay
        };
    });

    res.json(result);

  } catch (error) {
    console.error("Error getting dept attendance:", error);
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
};

exports.getLateEmployees = async (req, res) => {
    try {
        const { start, end } = getDateFilter(req);
        const deptFilter = await getRoleAwareDeptFilter(req);

        // Get all schedules in this range
        const schedules = await prisma.schedule.findMany({
            where: {
                date: {
                    gte: start,
                    lte: end
                },
                ...(deptFilter.user ? { user: deptFilter.user } : {})
            },
            select: {
                userId: true,
                date: true,
                shiftStart: true
            }
        });

        // Get all check-ins in this range
        const attendances = await prisma.attendance.findMany({
            where: {
                timestamp: {
                    gte: start,
                    lte: end
                },
                type: { in: ['CHECK_IN', 'EXTERNAL', 'EXTERNAL_DUTY'] },
                ...(deptFilter.user ? { user: deptFilter.user } : {})
            },
            select: {
                userId: true,
                timestamp: true
            }
        });

        // Map for fast lookup
        // Key: userId_dateString (YYYY-MM-DD)
        const checkInMap = {};
        const getWibDateStr = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(d));

        attendances.forEach(att => {
            const key = `${att.userId}_${getWibDateStr(att.timestamp)}`;
            // If multiple check-ins, take the first one usually. 
            // If key exists, keep the earliest one
            if (!checkInMap[key] || new Date(checkInMap[key]) > new Date(att.timestamp)) {
                checkInMap[key] = att.timestamp;
            }
        });

        const lateStats = {}; // userId -> count

        schedules.forEach(sch => {
            const key = `${sch.userId}_${getWibDateStr(sch.date)}`;
            const actualCheckIn = checkInMap[key];

            if (actualCheckIn) {
                // Buffer: 15 minutes
                const tolerance = 15 * 60 * 1000; 
                const scheduledTime = new Date(sch.shiftStart).getTime();
                const checkInTime = new Date(actualCheckIn).getTime();

                if (checkInTime > (scheduledTime + tolerance)) {
                    lateStats[sch.userId] = (lateStats[sch.userId] || 0) + 1;
                }
            }
        });

        // Fetch user details for the top latecomers
        const topLateUserIds = Object.keys(lateStats)
            .sort((a, b) => lateStats[b] - lateStats[a])
            .slice(0, 5); // Top 5

        const users = await prisma.user.findMany({
            where: {
                id: { in: topLateUserIds.map(id => parseInt(id)) }
            },
            select: {
                id: true,
                name: true,
                department: true,
                role: true // Include role to display
            }
        });

        const result = users.map(user => ({
            ...user,
            lateCount: lateStats[user.id]
        })).sort((a, b) => b.lateCount - a.lateCount);

        res.json(result);

    } catch (error) {
        console.error("Error getting late employees:", error);
        res.status(500).json({ message: 'Error fetching late stats', error: error.message });
    }
};

exports.getRequestTrends = async (req, res) => {
    try {
        const { start, end } = getDateFilter(req);
        const deptFilter = await getRoleAwareDeptFilter(req);

        let queryStart = start;
        let queryEnd = end;
        
        // If no specific date filter, default to last 6 months for trends
        if (!req.query.startDate && !req.query.endDate) {
            const now = new Date();
            queryEnd = now;
            queryStart = subMonths(now, 6);
        }

        const requests = await prisma.request.findMany({
            where: {
                createdAt: {
                    gte: queryStart,
                    lte: queryEnd
                },
                type: {
                    in: ['SICK', 'PERMISSION', 'LEAVE']
                },
                ...(deptFilter.user ? { user: deptFilter.user } : {})
            },
            select: {
                type: true,
                createdAt: true
            }
        });

        // Also get External Duty (Dinas Luar) trends
        const externalDuties = await prisma.attendance.findMany({
            where: {
                timestamp: {
                    gte: queryStart,
                    lte: queryEnd
                },
                type: { in: ['EXTERNAL', 'EXTERNAL_IN', 'EXTERNAL_OUT'] },
                ...(deptFilter.user ? { user: deptFilter.user } : {})
            },
            select: {
                type: true,
                timestamp: true
            }
        });

        // Group by Month and Type
        // Format: { month: 'Jan', SICK: 5, PERMISSION: 2, LEAVE: 1, EXTERNAL_DUTY: 3 }
        
        const trends = {};

        requests.forEach(req => {
            const monthKey = format(req.createdAt, 'MMM yyyy'); // e.g., "Dec 2025"
            if (!trends[monthKey]) {
                trends[monthKey] = { month: monthKey, SICK: 0, PERMISSION: 0, LEAVE: 0, EXTERNAL_DUTY: 0 };
            }
            if (trends[monthKey][req.type] !== undefined) {
                trends[monthKey][req.type]++;
            }
        });

        externalDuties.forEach(att => {
            const monthKey = format(att.timestamp, 'MMM yyyy');
            if (!trends[monthKey]) {
                trends[monthKey] = { month: monthKey, SICK: 0, PERMISSION: 0, LEAVE: 0, EXTERNAL_DUTY: 0 };
            }
            trends[monthKey]['EXTERNAL_DUTY']++;
        });

        // Convert object to array and sort by date
        const result = Object.values(trends).sort((a, b) => {
             // Simple hack to sort by date string, but better to rely on insertion order or parse
             return new Date(Date.parse(`01 ${a.month}`)) - new Date(Date.parse(`01 ${b.month}`));
        });

        res.json(result);

    } catch (error) {
        console.error("Error getting request trends:", error);
        res.status(500).json({ message: 'Error fetching request trends', error: error.message });
    }
};

exports.getRecapStats = async (req, res) => {
    try {
        const { start, end } = getDateFilter(req);
        const deptFilter = await getRoleAwareDeptFilter(req);

        const overtimeReqs = await prisma.request.findMany({
            where: {
                type: 'OVERTIME',
                status: 'APPROVED',
                startDate: { gte: start, lte: end },
                ...(deptFilter.user ? { user: deptFilter.user } : {})
            },
            select: {
                quantity: true,
                startTime: true,
                endTime: true
            }
        });
        const computeQty = (s, e) => {
            if (!s || !e) return 0;
            const [h1, m1] = String(s).split(':').map(Number);
            const [h2, m2] = String(e).split(':').map(Number);
            if ([h1, m1, h2, m2].some(v => Number.isNaN(v))) return 0;
            let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
            if (diff < 0) diff += 1440;
            return Math.round((diff / 60) * 100) / 100;
        };
        const overtimeHours = overtimeReqs.reduce((acc, r) => {
            const manual = r.quantity || 0;
            const auto = computeQty(r.startTime, r.endTime);
            return acc + (manual > 0 ? manual : auto);
        }, 0);

        // 2. Total Attendance (Check-ins)
        const attendanceCount = await prisma.attendance.count({
            where: {
                timestamp: { gte: start, lte: end },
                type: 'CHECK_IN',
                ...(deptFilter.user ? { user: deptFilter.user } : {})
            }
        });

        // 3. Request Counts by Type (Approved)
        const requestCounts = await prisma.request.groupBy({
            by: ['type'],
            _count: { id: true },
            where: {
                startDate: { gte: start, lte: end },
                status: 'APPROVED',
                ...(deptFilter.user ? { user: deptFilter.user } : {})
            }
        });

        // Format request counts into a map
        const reqMap = {};
        requestCounts.forEach(r => {
            reqMap[r.type] = r._count.id;
        });
        
        const periodStr = (req.query.startDate || req.query.endDate)
            ? `${format(start, 'd MMM')} - ${format(end, 'd MMM yyyy')}`
            : format(new Date(), 'MMMM yyyy');

        res.json({
            period: periodStr,
            overtimeHours: Math.round(overtimeHours * 100) / 100,
            attendanceCount,
            requests: {
                sick: reqMap['SICK'] || 0,
                leave: reqMap['LEAVE'] || 0,
                permission: reqMap['PERMISSION'] || 0,
                external: reqMap['EXTERNAL_DUTY'] || 0
            }
        });

    } catch (error) {
        console.error("Error getting recap stats:", error);
        res.status(500).json({ message: 'Error fetching recap stats', error: error.message });
    }
};

exports.getEmployeeRecap = async (req, res) => {
    try {
        const { start, end } = getDateFilter(req);
        const deptFilter = await getRoleAwareDeptFilter(req);

        // 1. Get all users (filtered by department)
        const users = await prisma.user.findMany({
            where: {
                ...(deptFilter.user ? deptFilter.user : {}),
                NOT: { role: 'GM' } // Exclude GM? Maybe keep for now if they are employees
            },
            select: {
                id: true,
                name: true,
                department: true,
                role: true
            },
            orderBy: { name: 'asc' }
        });

        const userIds = users.map(u => u.id);

        // 2. Aggregate Attendance (Check-ins)
        const attendanceCounts = await prisma.attendance.groupBy({
            by: ['userId'],
            _count: { id: true },
            where: {
                userId: { in: userIds },
                timestamp: { gte: start, lte: end },
                type: { in: ['CHECK_IN', 'EXTERNAL_IN'] }
            }
        });
        
        // Map: userId -> count
        const attMap = {};
        attendanceCounts.forEach(a => attMap[a.userId] = a._count.id);

        const overtimeReqs = await prisma.request.findMany({
            where: {
                userId: { in: userIds },
                startDate: { gte: start, lte: end },
                type: 'OVERTIME',
                status: 'APPROVED'
            },
            select: {
                userId: true,
                quantity: true,
                startTime: true,
                endTime: true
            }
        });
        const computeQty = (s, e) => {
            if (!s || !e) return 0;
            const [h1, m1] = String(s).split(':').map(Number);
            const [h2, m2] = String(e).split(':').map(Number);
            if ([h1, m1, h2, m2].some(v => Number.isNaN(v))) return 0;
            let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
            if (diff < 0) diff += 1440;
            return Math.round((diff / 60) * 100) / 100;
        };
        const otMap = {};
        overtimeReqs.forEach(r => {
            const manual = r.quantity || 0;
            const auto = computeQty(r.startTime, r.endTime);
            const qty = manual > 0 ? manual : auto;
            otMap[r.userId] = (otMap[r.userId] || 0) + qty;
        });

        // 4. Calculate Scheduled Days (Working Days)
        // Count schedules that are NOT OFF and NOT Absences (Cuti, Sakit, etc.)
        const scheduledCounts = await prisma.schedule.groupBy({
            by: ['userId'],
            _count: { id: true },
            where: {
                userId: { in: userIds },
                date: { gte: start, lte: end },
                shiftName: {
                    notIn: ['OFF', 'Off Day', 'LIBUR', 'C', 'S', 'I', 'D'], // Exclude OFF and common codes
                },
                AND: [
                    { shiftName: { not: { contains: 'Cuti' } } },
                    { shiftName: { not: { contains: 'Sakit' } } },
                    { shiftName: { not: { contains: 'Izin' } } },
                    { shiftName: { not: { contains: 'Leave' } } },
                    { shiftName: { not: { contains: 'Sick' } } },
                    { shiftName: { not: { contains: 'Permission' } } },
                    { shiftName: { not: { contains: 'Dinas Luar' } } },
                    { shiftName: { not: { contains: 'Exchange' } } }
                ]
            }
        });

        const schedMap = {};
        scheduledCounts.forEach(s => schedMap[s.userId] = s._count.id);

        // 5. Aggregate Requests by Type (SICK, PERMISSION, LEAVE, EXTERNAL_DUTY)
        const requestCounts = await prisma.request.groupBy({
            by: ['userId', 'type'],
            _count: { id: true },
            where: {
                userId: { in: userIds },
                startDate: { gte: start, lte: end },
                status: 'APPROVED',
                type: { in: ['SICK', 'PERMISSION', 'LEAVE', 'EXTERNAL_DUTY'] }
            }
        });

        // Map: userId -> { SICK: 0, PERMISSION: 0, ... }
        const reqMap = {};
        requestCounts.forEach(r => {
            if (!reqMap[r.userId]) reqMap[r.userId] = { SICK: 0, PERMISSION: 0, LEAVE: 0, EXTERNAL_DUTY: 0 };
            reqMap[r.userId][r.type] = r._count.id;
        });
        
        // 6. Merge Data
        const result = users.map(user => {
            const reqs = reqMap[user.id] || { SICK: 0, PERMISSION: 0, LEAVE: 0, EXTERNAL_DUTY: 0 };
            return {
                id: user.id,
                name: user.name,
                department: user.department || '-',
                role: user.role,
                scheduledDays: schedMap[user.id] || 0, // Added
                attendanceCount: attMap[user.id] || 0,
                overtimeHours: otMap[user.id] || 0,
                sick: reqs.SICK || 0,
                permission: reqs.PERMISSION || 0,
                leave: reqs.LEAVE || 0,
                external: reqs.EXTERNAL_DUTY || 0
            };
        });

        res.json(result);

    } catch (error) {
        console.error("Error getting employee recap:", error);
        res.status(500).json({ message: 'Error fetching employee recap', error: error.message });
    }
};

exports.getApprovedRequestHistory = async (req, res) => {
    try {
        const { start, end } = getDateFilter(req);
        const deptFilter = await getRoleAwareDeptFilter(req);

        // Fetch requests that are fully approved
        // Full approval logic:
        // 1. Status is 'APPROVED'
        // 2. All transactionApproval steps for this request are 'APPROVED' (if any)
        // 3. Legacy flags are all true (hodApproved, spvApproved, hrApproved, gmApproved)
        
        const requests = await prisma.request.findMany({
            where: {
                status: 'APPROVED',
                startDate: { gte: start, lte: end },
                ...(deptFilter.user ? { user: deptFilter.user } : {}),
                // Additional safety: ensure they are not types we might want to exclude
                type: { in: ['SICK', 'PERMISSION', 'LEAVE', 'EXTERNAL_DUTY', 'OVERTIME'] }
            },
            include: {
                user: {
                    select: {
                        name: true,
                        department: true,
                        role: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // For each request, verify if it was truly approved by all parties via transactionApproval
        const verifiedRequests = [];
        
        for (const request of requests) {
            const txApprovals = await prisma.transactionApproval.findMany({
                where: {
                    module: 'REQUEST',
                    moduleId: request.id
                },
                orderBy: { stepOrder: 'asc' }
            });

            const allTxApproved = txApprovals.length === 0 || txApprovals.every(tx => tx.status === 'APPROVED');
            const allLegacyApproved = request.hodApproved && request.spvApproved && request.hrApproved && request.gmApproved;

            // If it has txApprovals, we rely on them. If not, we check legacy flags.
            // But since the query already filtered by status: 'APPROVED', 
            // and the system sets status: 'APPROVED' only when all steps are done,
            // this is mostly a double-check.
            
            if (allTxApproved || allLegacyApproved) {
                verifiedRequests.push({
                    id: request.id,
                    employeeName: request.user.name,
                    department: request.user.department,
                    type: request.type,
                    startDate: request.startDate,
                    endDate: request.endDate,
                    quantity: request.quantity,
                    reason: request.reason,
                    createdAt: request.createdAt,
                    approvals: txApprovals.map(tx => ({
                        step: tx.stepName,
                        approver: tx.approverRole,
                        status: tx.status,
                        updatedAt: tx.updatedAt
                    }))
                });
            }
        }

        res.json(verifiedRequests);
    } catch (error) {
        console.error("Error getting approved request history:", error);
        res.status(500).json({ message: 'Error fetching request history', error: error.message });
    }
};

exports.exportRecap = async (req, res) => {
    try {
        const { start, end } = getDateFilter(req);
        const deptFilter = getDeptFilter(req);

        // 1. Get all users (filtered by department)
        const users = await prisma.user.findMany({
            where: {
                ...(deptFilter.user ? deptFilter.user : {}),
                NOT: { role: 'GM' }
            },
            select: {
                id: true,
                name: true,
                department: true,
                role: true
            },
            orderBy: { name: 'asc' }
        });

        const userIds = users.map(u => u.id);

        // 2. Aggregate Attendance (Check-ins)
        const attendanceCounts = await prisma.attendance.groupBy({
            by: ['userId'],
            _count: { id: true },
            where: {
                userId: { in: userIds },
                timestamp: { gte: start, lte: end },
                type: { in: ['CHECK_IN', 'EXTERNAL_IN'] }
            }
        });
        
        const attMap = {};
        attendanceCounts.forEach(a => attMap[a.userId] = a._count.id);

        const overtimeReqs = await prisma.request.findMany({
            where: {
                userId: { in: userIds },
                startDate: { gte: start, lte: end },
                type: 'OVERTIME',
                status: 'APPROVED'
            },
            select: {
                userId: true,
                quantity: true,
                startTime: true,
                endTime: true
            }
        });
        const computeQty = (s, e) => {
            if (!s || !e) return 0;
            const [h1, m1] = String(s).split(':').map(Number);
            const [h2, m2] = String(e).split(':').map(Number);
            if ([h1, m1, h2, m2].some(v => Number.isNaN(v))) return 0;
            let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
            if (diff < 0) diff += 1440;
            return Math.round((diff / 60) * 100) / 100;
        };
        const otMap = {};
        overtimeReqs.forEach(r => {
            const manual = r.quantity || 0;
            const auto = computeQty(r.startTime, r.endTime);
            const qty = manual > 0 ? manual : auto;
            otMap[r.userId] = (otMap[r.userId] || 0) + qty;
        });

        // 4. Calculate Scheduled Days
        const scheduledCounts = await prisma.schedule.groupBy({
            by: ['userId'],
            _count: { id: true },
            where: {
                userId: { in: userIds },
                date: { gte: start, lte: end },
                shiftName: {
                    notIn: ['OFF', 'Off Day', 'LIBUR', 'C', 'S', 'I', 'D'],
                },
                AND: [
                    { shiftName: { not: { contains: 'Cuti' } } },
                    { shiftName: { not: { contains: 'Sakit' } } },
                    { shiftName: { not: { contains: 'Izin' } } },
                    { shiftName: { not: { contains: 'Leave' } } },
                    { shiftName: { not: { contains: 'Sick' } } },
                    { shiftName: { not: { contains: 'Permission' } } },
                    { shiftName: { not: { contains: 'Dinas Luar' } } },
                    { shiftName: { not: { contains: 'Exchange' } } }
                ]
            }
        });

        const schedMap = {};
        scheduledCounts.forEach(s => schedMap[s.userId] = s._count.id);

        // 5. Aggregate Requests
        const requestCounts = await prisma.request.groupBy({
            by: ['userId', 'type'],
            _count: { id: true },
            where: {
                userId: { in: userIds },
                startDate: { gte: start, lte: end },
                status: 'APPROVED',
                type: { in: ['SICK', 'PERMISSION', 'LEAVE', 'EXTERNAL_DUTY'] }
            }
        });

        const reqMap = {};
        requestCounts.forEach(r => {
            if (!reqMap[r.userId]) reqMap[r.userId] = { SICK: 0, PERMISSION: 0, LEAVE: 0, EXTERNAL_DUTY: 0 };
            reqMap[r.userId][r.type] = r._count.id;
        });

        // 6. Build CSV
        const header = "Employee ID,Name,Department,Role,Scheduled Days,Attendance Count,Overtime (Hours),Sick,Permission,Leave,External Duty\n";
        const rows = users.map(user => {
            const reqs = reqMap[user.id] || { SICK: 0, PERMISSION: 0, LEAVE: 0, EXTERNAL_DUTY: 0 };
            return [
                user.id,
                `"${user.name}"`, // Quote name in case of commas
                user.department || '-',
                user.role,
                schedMap[user.id] || 0, // Added
                attMap[user.id] || 0,
                otMap[user.id] || 0,
                reqs.SICK || 0,
                reqs.PERMISSION || 0,
                reqs.LEAVE || 0,
                reqs.EXTERNAL_DUTY || 0
            ].join(",");
        }).join("\n");

        const csvContent = header + rows;
        const filename = `recap_${format(start, 'yyyy-MM-dd')}_to_${format(end, 'yyyy-MM-dd')}.csv`;

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(csvContent);

    } catch (error) {
        console.error("Error exporting recap:", error);
        res.status(500).json({ message: 'Error exporting recap', error: error.message });
    }
};
