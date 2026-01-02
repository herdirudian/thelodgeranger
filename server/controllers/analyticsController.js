const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { startOfMonth, subMonths, endOfMonth, format, isAfter } = require('date-fns');

exports.getDepartmentAttendance = async (req, res) => {
  try {
    // Calculate attendance rate for the current month per department
    // Rate = (Total Check-ins / Total Active Users * Working Days so far) -- Simplified: Just raw counts for now or percentage of active staff present TODAY

    // Let's do: Today's Attendance % by Department
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // 1. Get total users per department
    const usersByDept = await prisma.user.groupBy({
      by: ['department'],
      _count: {
        id: true
      },
      where: {
        NOT: {
            role: 'GM' // Exclude GM from stats maybe? Or keep all.
        }
      }
    });

    // Get today's attendance to compare
    const attendances = await prisma.attendance.findMany({
        where: {
            timestamp: {
                gte: startOfDay,
                lte: endOfDay
            },
            type: { in: ['CHECK_IN', 'EXTERNAL', 'EXTERNAL_DUTY'] }
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
        const present = attendanceCountByDept[dept] || 0;
        const percentage = totalStaff > 0 ? Math.round((present / totalStaff) * 100) : 0;

        return {
            department: dept,
            totalStaff,
            present,
            percentage
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
        // Look back 30 days
        const endDate = new Date();
        const startDate = subMonths(endDate, 1);

        // Get all schedules in this range
        const schedules = await prisma.schedule.findMany({
            where: {
                date: {
                    gte: startDate,
                    lte: endDate
                }
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
                    gte: startDate,
                    lte: endDate
                },
                type: { in: ['CHECK_IN', 'EXTERNAL', 'EXTERNAL_DUTY'] }
            },
            select: {
                userId: true,
                timestamp: true
            }
        });

        // Map for fast lookup
        // Key: userId_dateString (YYYY-MM-DD)
        const checkInMap = {};
        attendances.forEach(att => {
            const key = `${att.userId}_${format(att.timestamp, 'yyyy-MM-dd')}`;
            // If multiple check-ins, take the first one usually. 
            // If key exists, keep the earliest one
            if (!checkInMap[key] || new Date(checkInMap[key]) > new Date(att.timestamp)) {
                checkInMap[key] = att.timestamp;
            }
        });

        const lateStats = {}; // userId -> count

        schedules.forEach(sch => {
            const key = `${sch.userId}_${format(sch.date, 'yyyy-MM-dd')}`;
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
        // Last 6 months
        const endDate = new Date();
        const startDate = subMonths(endDate, 6);

        const requests = await prisma.request.findMany({
            where: {
                createdAt: {
                    gte: startDate
                },
                type: {
                    in: ['SICK', 'PERMISSION', 'LEAVE']
                }
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
                    gte: startDate
                },
                type: 'EXTERNAL'
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
