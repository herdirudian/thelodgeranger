
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const requestController = require('../controllers/requestController');

// Mock Request/Response
const mockRes = () => {
    const res = {};
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.body = data;
        return res;
    };
    res.setHeader = () => {};
    res.send = () => {};
    return res;
};

async function testIntegration() {
    console.log("Starting Schedule Integration Test...");
    
    try {
        // 1. Setup User (HOD role to approve their own request or Staff + HOD)
        // Let's create a Staff and an HOD.
        const email = `test.staff.${Date.now()}@example.com`;
        const staff = await prisma.user.create({
            data: {
                email,
                password: 'password',
                name: 'Test Staff',
                role: 'STAFF',
                department: 'TEST_DEPT'
            }
        });
        console.log("Created Staff:", staff.id);

        const hodEmail = `test.hod.${Date.now()}@example.com`;
        const hod = await prisma.user.create({
            data: {
                email: hodEmail,
                password: 'password',
                name: 'Test HOD',
                role: 'HOD',
                department: 'TEST_DEPT'
            }
        });
        console.log("Created HOD:", hod.id);

        // 2. Create Schedule for Staff (Tomorrow)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0,0,0,0); // Midnight local (or UTC depending on env)
        
        // Ensure we create a schedule that matches how controller does it
        // generateShiftsFromMonthly uses: date = new Date(dateStr) (UTC midnight)
        // shiftStart = dateStr + T07:00:00+07:00
        
        // Let's simulate "M1" shift (06:00 - 15:00)
        // Date: Tomorrow UTC Midnight
        const scheduleDate = new Date(tomorrow);
        const shiftStart = new Date(tomorrow);
        shiftStart.setHours(6, 0, 0, 0); // 06:00
        const shiftEnd = new Date(tomorrow);
        shiftEnd.setHours(15, 0, 0, 0); // 15:00

        await prisma.schedule.create({
            data: {
                userId: staff.id,
                date: scheduleDate,
                shiftStart: shiftStart,
                shiftEnd: shiftEnd,
                shiftName: 'M1',
                description: 'Shift M1'
            }
        });
        console.log("Created Schedule for date:", scheduleDate);

        // 3. Create Request (Leave) for Tomorrow
        const request = await prisma.request.create({
            data: {
                userId: staff.id,
                type: 'LEAVE',
                startDate: scheduleDate,
                endDate: scheduleDate,
                reason: 'Test Leave',
                status: 'PENDING_HOD'
            }
        });
        console.log("Created Request:", request.id);

        // 4. Approve Request (as HOD)
        // Logic: HOD approves PENDING_HOD -> PENDING_SUPERVISOR (Legacy)
        // Wait, for STAFF it usually goes PENDING_HOD -> PENDING_SPV -> PENDING_HR...
        // We need to reach APPROVED status to trigger schedule update.
        // Let's simulate the final approval step.
        // Or use ADMIN/GM to force approve?
        // handleLegacyRequestApproval: if user is GM and status PENDING_GM -> APPROVED.
        
        // Let's update request to PENDING_GM and use GM to approve.
        await prisma.request.update({
            where: { id: request.id },
            data: { status: 'PENDING_GM', hodApproved: true, hrApproved: true }
        });

        const gmEmail = `test.gm.${Date.now()}@example.com`;
        const gm = await prisma.user.create({
            data: {
                email: gmEmail,
                password: 'password',
                name: 'Test GM',
                role: 'GM'
            }
        });

        const req = {
            params: { id: request.id },
            body: { action: 'APPROVE', reason: 'Ok' },
            userId: gm.id
        };
        const res = mockRes();

        console.log("Approving Request as GM...");
        await requestController.approveRequest(req, res);

        console.log("Response:", res.statusCode, res.body);

        // 5. Verify Schedule
        // Should be deleted/replaced with Leave
        const updatedSchedules = await prisma.schedule.findMany({
            where: {
                userId: staff.id,
                date: scheduleDate
            }
        });

        console.log("Updated Schedules:", updatedSchedules);

        if (updatedSchedules.length === 1 && updatedSchedules[0].shiftName === 'Cuti') {
            console.log("SUCCESS: Schedule updated to Cuti");
        } else {
            console.log("FAILURE: Schedule not updated correctly");
        }

        // Cleanup
        // await prisma.schedule.deleteMany({ where: { userId: staff.id } });
        // await prisma.request.deleteMany({ where: { userId: staff.id } });
        // await prisma.user.delete({ where: { id: staff.id } });
        // await prisma.user.delete({ where: { id: hod.id } });
        // await prisma.user.delete({ where: { id: gm.id } });

    } catch (error) {
        console.error("Test Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

testIntegration();
