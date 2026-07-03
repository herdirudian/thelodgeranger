const { PrismaClient } = require('@prisma/client');
const { format } = require('date-fns');
const pdfService = require('../services/pdfService');
const prisma = new PrismaClient();

const isSignatureQuestion = (questionText) => {
    const lowerQuestion = String(questionText || '').toLowerCase();
    return lowerQuestion.includes('signature') || lowerQuestion.includes('tanda tangan');
};

const csvEscape = (value) => {
    if (value == null) return '""';
    return `"${String(value).replace(/"/g, '""')}"`;
};

const getChecklistAccessWhere = (user) => {
    const assignedIds = (user.assignedChecklists || []).map(c => c.id);

    if (assignedIds.length > 0) {
        return { templateId: { in: assignedIds } };
    }

    if (user.role === 'ADMIN' || user.role === 'GM' || user.role === 'HR') {
        return {};
    }

    if (user.role.includes('HOD') || user.role.includes('SPV') || user.role === 'SUPERVISOR') {
        return {
            template: {
                department: user.department
            }
        };
    }

    return {
        userId: user.id
    };
};

const buildPublicFileUrl = (req, photoUrl) => {
    if (!photoUrl) return '';
    if (String(photoUrl).startsWith('http')) return photoUrl;
    const normalizedPath = String(photoUrl).startsWith('/') ? String(photoUrl) : `/${photoUrl}`;
    return `${req.protocol}://${req.get('host')}${normalizedPath}`;
};

const getOrderedCategoryExports = (submission) => {
    const answerMap = new Map((submission.answers || []).map(answer => [answer.questionId, answer]));
    const categories = (submission.template?.categories || [])
        .sort((a, b) => a.order - b.order)
        .map(category => {
            const items = (category.questions || [])
                .sort((a, b) => a.order - b.order)
                .filter(question => !isSignatureQuestion(question.question))
                .map(question => {
                    const answer = answerMap.get(question.id);
                    return {
                        question,
                        answer
                    };
                })
                .filter(item => item.answer);

            return {
                category,
                items
            };
        })
        .filter(categoryGroup => categoryGroup.items.length > 0);

    return categories;
};

exports.getTemplates = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({ 
            where: { id: req.userId },
            include: { assignedChecklists: { select: { id: true } } }
        });
        
        const assignedIds = user.assignedChecklists.map(c => c.id);
        const where = { isActive: true };
        
        // If user has specific assigned checklists, use those.
        // Otherwise fallback to department logic for HOD/SPV
        if (assignedIds.length > 0) {
            where.id = { in: assignedIds };
        } else if (user.role.includes('HOD') || user.role.includes('SPV')) {
            where.department = user.department;
        } else if (req.query.department) {
            where.department = req.query.department;
        }

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
        const { templateId, answers, notes, date, photoUrl } = req.body;
        const userId = req.userId;
        const user = await prisma.user.findUnique({ 
            where: { id: userId },
            include: { assignedChecklists: { select: { id: true } } }
        });

        // Security check: Ensure user only submits for their assigned template or department
        const template = await prisma.checklistTemplate.findUnique({
            where: { id: parseInt(templateId) },
            include: {
                categories: {
                    include: {
                        questions: true
                    }
                }
            }
        });
        if (!template) return res.status(404).json({ message: 'Template not found' });

        const isAssignedManually = user.assignedChecklists.some(c => c.id === template.id);
        const isAssignedByDept = (user.role.includes('HOD') || user.role.includes('SPV')) && user.department === template.department;

        if (!isAssignedManually && !isAssignedByDept && user.role !== 'ADMIN' && user.role !== 'GM') {
            return res.status(403).json({ message: 'Anda tidak memiliki akses untuk mengisi checklist ini.' });
        }

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

        const answerMap = new Map((answers || []).map(answer => [parseInt(answer.questionId), answer]));
        const questionsWithoutPhoto = template.categories
            .flatMap(category => category.questions)
            .filter(question => !isSignatureQuestion(question.question))
            .filter(question => {
                const answer = answerMap.get(question.id);
                return !answer || !String(answer.photoUrl || '').trim();
            });

        if (questionsWithoutPhoto.length > 0) {
            return res.status(400).json({
                message: `Semua pertanyaan wajib difoto. Masih ada ${questionsWithoutPhoto.length} foto bukti yang kosong.`,
                missingQuestion: questionsWithoutPhoto[0].question
            });
        }

        const submission = await prisma.checklistSubmission.create({
            data: {
                templateId: parseInt(templateId),
                userId: parseInt(userId),
                date: new Date(date || new Date()),
                notes,
                photoUrl,
                status: 'PENDING_SUPERVISOR', // Start workflow
                answers: {
                    create: answers.map(a => ({
                        questionId: parseInt(a.questionId),
                        value: String(a.value),
                        remarks: a.remarks,
                        photoUrl: a.photoUrl
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
        const user = await prisma.user.findUnique({ 
            where: { id: req.userId },
            include: { assignedChecklists: { select: { id: true } } }
        });

        const assignedIds = user.assignedChecklists.map(c => c.id);
        const where = {};
        if (assignedIds.length > 0) {
            where.templateId = { in: assignedIds };
        } else if (user.role.includes('HOD') || user.role.includes('SPV')) {
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
        const { type } = req.body; // 'SPV' or 'GM'
        const user = await prisma.user.findUnique({ where: { id: req.userId } });

        const submission = await prisma.checklistSubmission.findUnique({
            where: { id: parseInt(id) },
            include: { template: true }
        });

        if (!submission) return res.status(404).json({ message: 'Submission not found' });

        const updateData = {};
        
        // Supervisor Approval
        if (type === 'SPV') {
            const canSign = user.role === 'ADMIN' || user.role === 'GM' || user.role === 'SUPERVISOR' || user.role.includes('SPV');
            if (!canSign) return res.status(403).json({ message: 'Hanya Supervisor atau Admin yang bisa menyetujui tahap ini.' });
            
            updateData.spvSigned = true;
            updateData.status = 'PENDING_GM';
        } 
        // GM Approval
        else if (type === 'GM') {
            const canSign = user.role === 'ADMIN' || user.role === 'GM';
            if (!canSign) return res.status(403).json({ message: 'Hanya GM atau Admin yang bisa menyetujui tahap akhir.' });
            
            if (!submission.spvSigned && user.role !== 'ADMIN') {
                return res.status(400).json({ message: 'Harus disetujui Supervisor terlebih dahulu.' });
            }

            updateData.gmSigned = true;
            updateData.status = 'APPROVED';
        } else {
            return res.status(400).json({ message: 'Tipe tanda tangan tidak valid.' });
        }

        const updated = await prisma.checklistSubmission.update({
            where: { id: parseInt(id) },
            data: updateData
        });

        res.json({ message: 'Checklist berhasil disetujui', updated });
    } catch (error) {
        res.status(500).json({ message: 'Error signing checklist', error: error.message });
    }
};

exports.exportChecklistCsv = async (req, res) => {
    try {
        const { submissionIds = [], scope = 'filtered', exportDate } = req.body || {};
        const normalizedIds = Array.isArray(submissionIds)
            ? submissionIds.map(id => parseInt(id)).filter(id => !Number.isNaN(id))
            : [];

        if (normalizedIds.length === 0) {
            return res.status(400).json({ message: 'Tidak ada data checklist yang dipilih untuk diexport.' });
        }

        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            include: { assignedChecklists: { select: { id: true } } }
        });

        const submissions = await prisma.checklistSubmission.findMany({
            where: {
                id: { in: normalizedIds },
                ...getChecklistAccessWhere(user)
            },
            include: {
                template: {
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
                },
                user: { select: { name: true, department: true } },
                answers: {
                    include: {
                        question: {
                            include: {
                                category: true
                            }
                        }
                    }
                }
            },
            orderBy: [
                { date: 'desc' },
                { id: 'desc' }
            ]
        });

        if (submissions.length === 0) {
            return res.status(404).json({ message: 'Data checklist tidak ditemukan atau tidak dapat diakses.' });
        }

        const headers = [
            'Submission ID',
            'Tanggal',
            'Template',
            'Departemen',
            'Staff',
            'Status',
            'SPV Signed',
            'GM Signed',
            'Kategori',
            'Pertanyaan',
            'Jawaban',
            'Catatan Jawaban',
            'Foto Bukti URL',
            'Foto Bukti Preview Excel',
            'Foto Bukti Link Excel',
            'Notes Submission'
        ];

        const rows = [];
        submissions.forEach(submission => {
            const orderedCategories = getOrderedCategoryExports(submission);
            orderedCategories.forEach(({ category, items }) => {
                items.forEach(({ question, answer }) => {
                    const photoUrl = buildPublicFileUrl(req, answer.photoUrl);
                    const photoImageFormula = photoUrl ? `=IMAGE("${photoUrl}")` : '';
                    const photoLinkFormula = photoUrl ? `=HYPERLINK("${photoUrl}","Lihat Foto")` : '';

                    rows.push([
                        submission.id,
                        format(new Date(submission.date), 'yyyy-MM-dd'),
                        submission.template.name,
                        submission.template.department,
                        submission.user.name,
                        submission.status,
                        submission.spvSigned ? 'YA' : 'BELUM',
                        submission.gmSigned ? 'YA' : 'BELUM',
                        category.name,
                        question.question,
                        answer.value,
                        answer.remarks || '',
                        photoUrl,
                        photoImageFormula,
                        photoLinkFormula,
                        submission.notes || ''
                    ]);
                });
            });
        });

        const csvContent = [headers.map(csvEscape).join(','), ...rows.map(row => row.map(csvEscape).join(','))].join('\n');
        const fileLabel = scope === 'daily' ? `daily_${exportDate || format(new Date(), 'yyyy-MM-dd')}` : 'history';

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="checklist_export_${fileLabel}.csv"`);
        res.status(200).send(csvContent);
    } catch (error) {
        console.error('Checklist CSV Export Error:', error);
        res.status(500).json({ message: 'Error exporting checklist CSV', error: error.message });
    }
};

exports.exportChecklistPdf = async (req, res) => {
    try {
        const { submissionIds = [], scope = 'filtered', exportDate } = req.body || {};
        const normalizedIds = Array.isArray(submissionIds)
            ? submissionIds.map(id => parseInt(id)).filter(id => !Number.isNaN(id))
            : [];

        if (normalizedIds.length === 0) {
            return res.status(400).json({ message: 'Tidak ada data checklist yang dipilih untuk diexport.' });
        }

        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            include: { assignedChecklists: { select: { id: true } } }
        });

        const submissions = await prisma.checklistSubmission.findMany({
            where: {
                id: { in: normalizedIds },
                ...getChecklistAccessWhere(user)
            },
            include: {
                template: {
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
                },
                user: { select: { name: true, department: true } },
                answers: {
                    include: {
                        question: {
                            include: {
                                category: true
                            }
                        }
                    }
                }
            },
            orderBy: [
                { date: 'desc' },
                { id: 'desc' }
            ]
        });

        if (submissions.length === 0) {
            return res.status(404).json({ message: 'Data checklist tidak ditemukan atau tidak dapat diakses.' });
        }

        const pdfBytes = await pdfService.generateChecklistExportPDF(submissions, {
            scope,
            exportDate
        });

        const fileLabel = scope === 'daily' ? `daily_${exportDate || format(new Date(), 'yyyy-MM-dd')}` : 'history';

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="checklist_export_${fileLabel}.pdf"`);
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error('Checklist PDF Export Error:', error);
        res.status(500).json({ message: 'Error exporting checklist PDF', error: error.message });
    }
};

// --- ADMIN / TEMPLATE MANAGEMENT ---

exports.adminGetTemplates = async (req, res) => {
    try {
        const { department } = req.query;
        const where = {};
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
                },
                assignedUsers: {
                    select: { id: true, name: true, department: true }
                }
            },
            orderBy: { name: 'asc' }
        });
        res.json(templates);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching templates', error: error.message });
    }
};

exports.assignUsers = async (req, res) => {
    try {
        const { id } = req.params;
        const { userIds } = req.body; // Array of user IDs

        const template = await prisma.checklistTemplate.update({
            where: { id: parseInt(id) },
            data: {
                assignedUsers: {
                    set: userIds.map(uid => ({ id: parseInt(uid) }))
                }
            },
            include: {
                assignedUsers: {
                    select: { id: true, name: true, department: true }
                }
            }
        });
        res.json(template);
    } catch (error) {
        res.status(500).json({ message: 'Error assigning users', error: error.message });
    }
};

exports.createTemplate = async (req, res) => {
    try {
        const { name, department, dayOfWeek } = req.body;
        const template = await prisma.checklistTemplate.create({
            data: { name, department, dayOfWeek }
        });
        res.status(201).json(template);
    } catch (error) {
        res.status(500).json({ message: 'Error creating template', error: error.message });
    }
};

exports.updateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, department, dayOfWeek, isActive } = req.body;
        const template = await prisma.checklistTemplate.update({
            where: { id: parseInt(id) },
            data: { name, department, dayOfWeek, isActive }
        });
        res.json(template);
    } catch (error) {
        res.status(500).json({ message: 'Error updating template', error: error.message });
    }
};

exports.deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.checklistTemplate.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Template deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting template', error: error.message });
    }
};

exports.duplicateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const original = await prisma.checklistTemplate.findUnique({
            where: { id: parseInt(id) },
            include: {
                categories: {
                    include: {
                        questions: true
                    }
                }
            }
        });

        if (!original) return res.status(404).json({ message: 'Original template not found' });

        // Create new template with " (Copy)" suffix
        const duplicated = await prisma.checklistTemplate.create({
            data: {
                name: `${original.name} (Copy)`,
                department: original.department,
                dayOfWeek: original.dayOfWeek,
                isActive: original.isActive,
                categories: {
                    create: original.categories.map(cat => ({
                        name: cat.name,
                        order: cat.order,
                        questions: {
                            create: cat.questions.map(q => ({
                                question: q.question,
                                type: q.type,
                                order: q.order,
                                isRequired: q.isRequired
                            }))
                        }
                    }))
                }
            }
        });

        res.status(201).json(duplicated);
    } catch (error) {
        res.status(500).json({ message: 'Error duplicating template', error: error.message });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const { templateId, name, order } = req.body;
        const category = await prisma.checklistCategoryTemplate.create({
            data: { templateId: parseInt(templateId), name, order: order || 0 }
        });
        res.status(201).json(category);
    } catch (error) {
        res.status(500).json({ message: 'Error creating category', error: error.message });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, order } = req.body;
        const category = await prisma.checklistCategoryTemplate.update({
            where: { id: parseInt(id) },
            data: { name, order }
        });
        res.json(category);
    } catch (error) {
        res.status(500).json({ message: 'Error updating category', error: error.message });
    }
};

exports.deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.checklistCategoryTemplate.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Category deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting category', error: error.message });
    }
};

exports.createQuestion = async (req, res) => {
    try {
        const { categoryId, question, type, order, isRequired } = req.body;
        const q = await prisma.checklistQuestionTemplate.create({
            data: { 
                categoryId: parseInt(categoryId), 
                question, 
                type: type || 'BOOLEAN', 
                order: order || 0,
                isRequired: isRequired !== undefined ? isRequired : true
            }
        });
        res.status(201).json(q);
    } catch (error) {
        res.status(500).json({ message: 'Error creating question', error: error.message });
    }
};

exports.updateQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const { question, type, order, isRequired } = req.body;
        const q = await prisma.checklistQuestionTemplate.update({
            where: { id: parseInt(id) },
            data: { question, type, order, isRequired }
        });
        res.json(q);
    } catch (error) {
        res.status(500).json({ message: 'Error updating question', error: error.message });
    }
};

exports.deleteQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.checklistQuestionTemplate.delete({ where: { id: parseInt(id) } });
        res.json({ message: 'Question deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting question', error: error.message });
    }
};
