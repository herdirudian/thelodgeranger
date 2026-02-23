const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_TASKS = [
    { task: 'Mengisi Biodata Lengkap', category: 'Administrasi' },
    { task: 'Menyerahkan Copy KTP & NPWP', category: 'Administrasi' },
    { task: 'Menyerahkan Copy KK', category: 'Administrasi' },
    { task: 'Menyerahkan Pas Foto', category: 'Administrasi' },
    { task: 'Tanda Tangan Kontrak', category: 'Administrasi' },
    { task: 'Pembuatan Email Kantor', category: 'Fasilitas' },
    { task: 'Pengambilan Seragam', category: 'Fasilitas' },
    { task: 'Foto ID Card', category: 'Fasilitas' },
    { task: 'Fingerprint Absensi', category: 'Fasilitas' },
    { task: 'Join Grup WhatsApp', category: 'Fasilitas' },
    { task: 'Safety Induction (K3)', category: 'Training' },
    { task: 'Company Profile & Culture', category: 'Training' },
    { task: 'Pengenalan Tim / Departemen', category: 'Departemen' },
    { task: 'Penjelasan Job Description', category: 'Departemen' },
    { task: 'Setup Device/Laptop (jika ada)', category: 'Fasilitas' },
];

exports.getMyOnboarding = async (req, res) => {
    try {
        const userId = req.userId;
        const tasks = await prisma.onboardingTask.findMany({
            where: { userId },
            orderBy: [
                { category: 'asc' },
                { id: 'asc' }
            ]
        });
        
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, name: true, department: true }
        });

        res.json({ user, tasks });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching tasks' });
    }
};

exports.getOnboardingStats = async (req, res) => {
    try {
        // Fetch all staff and their onboarding tasks count
        // Only fetch Role = STAFF or SUPERVISOR
        const users = await prisma.user.findMany({
            where: {
                role: { in: ['STAFF', 'SUPERVISOR', 'STORE', 'FINANCE'] }
            },
            select: {
                id: true,
                name: true,
                department: true,
                contractStartDate: true,
                onboardingTasks: {
                    select: {
                        isCompleted: true
                    }
                }
            },
            orderBy: {
                contractStartDate: 'desc'
            }
        });

        const stats = users.map(user => {
            const total = user.onboardingTasks.length;
            const completed = user.onboardingTasks.filter(t => t.isCompleted).length;
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
            // Status: New (0 tasks), In Progress, Completed
            let status = 'Not Started';
            if (total > 0) {
                status = completed === total ? 'Completed' : 'In Progress';
            }

            return {
                ...user,
                onboarding: {
                    total,
                    completed,
                    progress,
                    status
                }
            };
        });

        res.json(stats);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching stats' });
    }
};

exports.getStaffOnboarding = async (req, res) => {
    try {
        const { userId } = req.params;
        const tasks = await prisma.onboardingTask.findMany({
            where: { userId: parseInt(userId) },
            orderBy: [
                { category: 'asc' },
                { id: 'asc' }
            ]
        });
        
        const user = await prisma.user.findUnique({
            where: { id: parseInt(userId) },
            select: { id: true, name: true, department: true }
        });

        res.json({ user, tasks });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching tasks' });
    }
};

exports.initOnboarding = async (req, res) => {
    try {
        const { userId } = req.params;
        const id = parseInt(userId);

        // Check if already has tasks
        const count = await prisma.onboardingTask.count({ where: { userId: id } });
        if (count > 0) {
            return res.status(400).json({ message: 'Onboarding already initialized' });
        }

        // Bulk create
        const tasksData = DEFAULT_TASKS.map(t => ({
            userId: id,
            task: t.task,
            category: t.category,
            isCompleted: false
        }));

        await prisma.onboardingTask.createMany({
            data: tasksData
        });

        res.json({ message: 'Onboarding initialized' });
    } catch (error) {
        res.status(500).json({ message: 'Error initializing' });
    }
};

exports.updateTask = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { isCompleted, notes } = req.body;

        const task = await prisma.onboardingTask.update({
            where: { id: parseInt(taskId) },
            data: {
                isCompleted,
                notes,
                completedAt: isCompleted ? new Date() : null
            }
        });

        res.json(task);
    } catch (error) {
        res.status(500).json({ message: 'Error updating task' });
    }
};
