const { PrismaClient } = require('@prisma/client');
const { addMonths, differenceInCalendarDays, format } = require('date-fns');
const prisma = new PrismaClient();

exports.getNotifications = async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            where: { userId: req.userId },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        
        let reminders = [];
        if (req.role === 'HR' || req.role === 'GM') {
            const now = new Date();
            const twoMonthsAhead = addMonths(now, 2);
            const expiringUsers = await prisma.user.findMany({
                where: {
                    contractEndDate: {
                        gte: now,
                        lte: twoMonthsAhead
                    }
                },
                select: { id: true, name: true, department: true, contractEndDate: true }
            });
            
            reminders = expiringUsers.map(u => {
                const daysLeft = differenceInCalendarDays(new Date(u.contractEndDate), now);
                const dateStr = format(new Date(u.contractEndDate), 'dd MMM yyyy');
                return {
                    id: -u.id, // ephemeral id
                    userId: req.userId,
                    message: `Reminder: Kontrak ${u.name} (${u.department || '-'}) berakhir ${dateStr} (H-${daysLeft} hari)`,
                    read: false,
                    createdAt: new Date(),
                    isEphemeral: true,
                    link: '/admin?tab=contracts'
                };
            });
        }
        
        res.json([...reminders, ...notifications]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        await prisma.notification.update({
            where: { id: parseInt(req.params.id) },
            data: { read: true }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.markAllAsRead = async (req, res) => {
    try {
        await prisma.notification.updateMany({
            where: { userId: req.userId, read: false },
            data: { read: true }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Helper to create notification (can be imported by other controllers)
exports.createNotification = async (userId, message) => {
    try {
        await prisma.notification.create({
            data: {
                userId,
                message
            }
        });
    } catch (error) {
        console.error("Error creating notification:", error);
    }
};
