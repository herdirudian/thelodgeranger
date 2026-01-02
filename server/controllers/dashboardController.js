const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { startOfMonth, endOfMonth } = require('date-fns');

exports.getDashboardStats = async (req, res) => {
    try {
        const { role, department, id: userId } = req.user;
        const now = new Date();
        const startOfCurrentMonth = startOfMonth(now);
        const endOfCurrentMonth = endOfMonth(now);

        const response = {};

        // 1. GM/Owner/Finance Stats
        if (role === 'GM' || role === 'FINANCE') {
            // Total Spending this Month
            const monthlyProcurements = await prisma.procurement.findMany({
                where: {
                    status: { in: ['APPROVED', 'COMPLETED'] },
                    updatedAt: {
                        gte: startOfCurrentMonth,
                        lte: endOfCurrentMonth
                    }
                },
                include: { user: true }
            });

            const totalSpending = monthlyProcurements.reduce((sum, p) => sum + p.totalPrice, 0);
            
            // Spending by Department
            const spendingByDept = {};
            monthlyProcurements.forEach(p => {
                const dept = p.user?.department || 'Unassigned';
                spendingByDept[dept] = (spendingByDept[dept] || 0) + p.totalPrice;
            });
            
            const spendingByDeptChart = Object.keys(spendingByDept).map(dept => ({
                name: dept,
                value: spendingByDept[dept]
            }));

            // Pending Approvals Count (Procurement)
            const pendingApprovals = await prisma.procurement.count({
                where: {
                    status: {
                        in: ['PENDING_HOD', 'PENDING_SUPERVISOR', 'PENDING_FINANCE', 'PENDING_GM']
                    }
                }
            });

            response.gmStats = {
                totalSpending,
                spendingByDept: spendingByDeptChart,
                pendingApprovals
            };
        }

        // 2. Store Stats
        if (role === 'STORE' || role === 'GM') {
            // Items to be Fulfilled (Approved but not Completed)
            const itemsToFulfill = await prisma.procurement.count({
                where: {
                    status: 'APPROVED'
                }
            });

            // Low Stock Items
            // Fetch all items and filter in application logic because Prisma doesn't support field comparison in where clause directly yet
            const allInventory = await prisma.inventoryItem.findMany();
            const lowStockItems = allInventory.filter(item => item.currentStock <= item.minStockLevel);

            response.storeStats = {
                itemsToFulfill,
                lowStockItems
            };
        }

        // 3. General User Stats (My Pending Requests)
        const myPendingRequests = await prisma.procurement.count({
            where: {
                userId: userId,
                status: {
                    notIn: ['APPROVED', 'REJECTED', 'COMPLETED']
                }
            }
        });
        
        response.myStats = {
            pendingRequests: myPendingRequests
        };

        res.json(response);

    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).json({ message: 'Error fetching dashboard stats', error: error.message });
    }
};
