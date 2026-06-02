const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getTemplates = async (req, res) => {
    try {
        const { department } = req.query;
        const where = { isActive: true };
        if (department) where.department = department;

        const templates = await prisma.checklistTemplate.findMany({
            where,
            include: {
                categories: {
                    include: {
                        questions: {
                            orderBy: { order: 'asc' }
                        }
                    },
                    orderBy: { order: 'asc' }
                }
            }
        });
        res.json(templates);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching templates', error: error.message });
    }
};

exports.submitChecklist = async (req, res) => {
    try {
        const { templateId, answers, notes, date } = req.body;
        const userId = req.userId;

        // Check if already submitted for today
        const startOfDay = new Date(date || new Date());
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(startOfDay);
        endOfDay.setHours(23, 59, 59, 999);

        const existing = await prisma.checklistSubmission.findFirst({
            where: {
                templateId: parseInt(templateId),
                userId: parseInt(userId),
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        });

        if (existing) {
            return res.status(400).json({ message: 'Anda sudah mengisi checklist untuk hari ini.' });
        }

        const submission = await prisma.checklistSubmission.create({
            data: {
                templateId: parseInt(templateId),
                userId: parseInt(userId),
                date: new Date(date || new Date()),
                notes,
                answers: {
                    create: answers.map(a => ({
                        questionId: parseInt(a.questionId),
                        value: String(a.value),
                        remarks: a.remarks
                    }))
                }
            }
        });

        res.status(201).json({ message: 'Checklist berhasil dikirim', submission });
    } catch (error) {
        res.status(500).json({ message: 'Error submitting checklist', error: error.message });
    }
};

exports.getSubmissions = async (req, res) => {
    try {
        const { startDate, endDate, department } = req.query;
        const user = await prisma.user.findUnique({ where: { id: req.userId } });

        const where = {};
        if (user.role === 'HOD') {
            where.template = { department: user.department };
        } else if (department) {
            where.template = { department };
        }

        if (startDate || endDate) {
            where.date = {};
            if (startDate) where.date.gte = new Date(startDate);
            if (endDate) where.date.lte = new Date(endDate);
        }

        const submissions = await prisma.checklistSubmission.findMany({
            where,
            include: {
                template: true,
                user: { select: { name: true, department: true } },
                answers: {
                    include: {
                        question: true
                    }
                }
            },
            orderBy: { date: 'desc' }
        });

        res.json(submissions);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching submissions', error: error.message });
    }
};

exports.signChecklist = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body; // 'HOD' or 'GM'
        const user = await prisma.user.findUnique({ where: { id: req.userId } });

        const submission = await prisma.checklistSubmission.findUnique({
            where: { id: parseInt(id) },
            include: { template: true }
        });

        if (!submission) return res.status(404).json({ message: 'Submission not found' });

        const updateData = {};
        if (type === 'HOD' && user.role === 'HOD' && user.department === submission.template.department) {
            updateData.hodSigned = true;
        } else if (type === 'GM' && (user.role === 'GM' || user.role === 'ADMIN')) {
            updateData.gmSigned = true;
            updateData.status = 'APPROVED';
        } else {
            return res.status(403).json({ message: 'Unauthorized to sign this checklist' });
        }

        const updated = await prisma.checklistSubmission.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        res.json({ message: 'Checklist signed successfully', updated });
    } catch (error) {
        res.status(500).json({ message: 'Error signing checklist', error: error.message });
    }
};
