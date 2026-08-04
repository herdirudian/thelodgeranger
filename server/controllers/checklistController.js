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
                        questions: true
                    }
                }
            }
        });

        // Manual sorting fallback to prevent "Unknown field order" errors on VPS
        const sortedTemplates = templates.sort((a, b) => (a.order || 0) - (b.order || 0))
            .map(t => ({
                ...t,
                categories: (t.categories || []).sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map(c => ({
                        ...c,
                        questions: (c.questions || []).sort((a, b) => (a.order || 0) - (b.order || 0))
                    }))
            }));

        res.json(sortedTemplates);
    } catch (error) {
        console.error("Get Templates Error:", error);
        res.status(500).json({ message: 'Error fetching templates', error: error.message });
    }
};

exports.submitChecklist = async (req, res) => {
    try {
        const { templateId, answers, notes, date, photoUrl } = req.body;
        const userId = req.userId;

        // 1. Basic Validation
        const tid = parseInt(templateId);
        if (!tid || isNaN(tid)) {
            return res.status(400).json({ message: 'ID Template tidak valid.' });
        }

        if (!Array.isArray(answers)) {
            return res.status(400).json({ message: 'Data jawaban (answers) harus berupa array.' });
        }

        const user = await prisma.user.findUnique({ 
            where: { id: parseInt(userId) },
            include: { assignedChecklists: { select: { id: true } } }
        });

        if (!user) {
            return res.status(404).json({ message: 'User tidak ditemukan.' });
        }

        // 2. Fetch Template & Security Check
        const template = await prisma.checklistTemplate.findUnique({
            where: { id: tid },
            include: {
                categories: {
                    include: {
                        questions: true
                    }
                }
            }
        });
        
        if (!template) {
            return res.status(404).json({ message: 'Template checklist tidak ditemukan.' });
        }

        const isAssignedManually = (user.assignedChecklists || []).some(c => c.id === template.id);
        const isAssignedByDept = (user.role.includes('HOD') || user.role.includes('SPV') || user.role === 'SUPERVISOR') && user.department === template.department;

        if (!isAssignedManually && !isAssignedByDept && user.role !== 'ADMIN' && user.role !== 'GM' && user.role !== 'HR') {
            return res.status(403).json({ message: 'Anda tidak memiliki akses untuk mengisi checklist ini.' });
        }

        // 3. Double Submission Check
        const submissionDate = date ? new Date(date) : new Date();
        if (isNaN(submissionDate.getTime())) {
            return res.status(400).json({ message: 'Format tanggal tidak valid.' });
        }

        const startOfDay = new Date(submissionDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(submissionDate);
        endOfDay.setHours(23, 59, 59, 999);

        const existing = await prisma.checklistSubmission.findFirst({
            where: {
                templateId: tid,
                userId: user.id,
                date: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            }
        });

        if (existing) {
            return res.status(400).json({ message: 'Anda sudah mengisi checklist ini untuk hari ini.' });
        }

        // 4. Answer Filtering & Photo Validation
        const validQuestionIds = new Set(
            template.categories.flatMap(cat => (cat.questions || []).map(q => q.id))
        );

        const answerMap = new Map();
        answers.forEach(a => {
            const qid = parseInt(a.questionId);
            if (!isNaN(qid) && validQuestionIds.has(qid)) {
                answerMap.set(qid, a);
            }
        });

        const questionsWithoutPhoto = template.categories
            .flatMap(category => category.questions || [])
            .filter(question => {
                // Check if it's a regular question (not signature) and is required
                const isSig = isSignatureQuestion(question.question);
                const isReq = question.isRequired !== false;
                return !isSig && isReq;
            })
            .filter(question => {
                const answer = answerMap.get(question.id);
                const hasPhoto = answer && String(answer.photoUrl || '').trim().length > 0;
                return !hasPhoto;
            });

        if (questionsWithoutPhoto.length > 0) {
            return res.status(400).json({
                message: `Wajib melampirkan foto bukti. Masih ada ${questionsWithoutPhoto.length} pertanyaan yang belum difoto.`,
                missingQuestion: questionsWithoutPhoto[0].question
            });
        }

        // 5. Create Submission
        const submission = await prisma.checklistSubmission.create({
            data: {
                templateId: tid,
                userId: user.id,
                date: submissionDate,
                notes: notes || null,
                photoUrl: photoUrl || null,
                status: 'PENDING_SUPERVISOR',
                answers: {
                    create: Array.from(answerMap.values()).map(a => ({
                        questionId: parseInt(a.questionId),
                        value: String(a.value || ''),
                        remarks: a.remarks || null,
                        photoUrl: a.photoUrl || null
                    }))
                }
            }
        });

        res.status(201).json({ message: 'Checklist berhasil dikirim', submission });
    } catch (error) {
        console.error("[SUBMIT-CHECKLIST-FATAL-ERROR]", {
            message: error.message,
            stack: error.stack,
            body: req.body,
            userId: req.userId
        });
        res.status(500).json({ 
            message: 'Gagal mengirim checklist (Server Error)', 
            error: error.message 
        });
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
            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                where.date.gte = start;
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                where.date.lte = end;
            }
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
                                questions: true
                            }
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
                        answer.value === 'true' ? 'Yes' : (answer.value === 'false' ? 'No' : answer.value),
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
                                questions: true
                            }
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
                        questions: true
                    }
                },
                assignedUsers: {
                    select: { id: true, name: true, department: true }
                }
            }
        });

        // Sortir manual di memori untuk menghindari error 'Unknown field order' jika Client belum terupdate
        const sortedTemplates = templates.sort((a, b) => (a.order || 0) - (b.order || 0))
            .map(t => ({
                ...t,
                categories: (t.categories || []).sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map(c => ({
                        ...c,
                        questions: (c.questions || []).sort((a, b) => (a.order || 0) - (b.order || 0))
                    }))
            }));

        res.json(sortedTemplates);
    } catch (error) {
        console.error("Admin Get Templates Error:", error);
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
        const templateId = parseInt(id);

        // Delete associated submissions (which will cascade to answers)
        await prisma.checklistSubmission.deleteMany({
            where: { templateId }
        });

        await prisma.checklistTemplate.delete({ 
            where: { id: templateId } 
        });

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
        const categoryId = parseInt(id);

        // Find all questions in this category to delete their answers first
        const questions = await prisma.checklistQuestionTemplate.findMany({
            where: { categoryId },
            select: { id: true }
        });
        
        const questionIds = questions.map(q => q.id);

        if (questionIds.length > 0) {
            await prisma.checklistAnswer.deleteMany({
                where: { questionId: { in: questionIds } }
            });
        }

        await prisma.checklistCategoryTemplate.delete({ 
            where: { id: categoryId } 
        });

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

exports.reorderTemplates = async (req, res) => {
    try {
        const { templates } = req.body; // Array of { id: number, order: number }
        
        await Promise.all(templates.map(t => 
            prisma.checklistTemplate.update({
                where: { id: parseInt(t.id) },
                data: { order: parseInt(t.order) }
            })
        ));
        
        res.json({ message: 'Templates reordered successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error reordering templates', error: error.message });
    }
};

exports.reorderQuestions = async (req, res) => {
    try {
        const { questions } = req.body; // Array of { id: number, order: number }
        
        await Promise.all(questions.map(q => 
            prisma.checklistQuestionTemplate.update({
                where: { id: parseInt(q.id) },
                data: { order: parseInt(q.order) }
            })
        ));
        
        res.json({ message: 'Questions reordered successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error reordering questions', error: error.message });
    }
};

exports.reorderCategories = async (req, res) => {
    try {
        const { categories } = req.body; // Array of { id: number, order: number }
        
        await Promise.all(categories.map(cat => 
            prisma.checklistCategoryTemplate.update({
                where: { id: parseInt(cat.id) },
                data: { order: parseInt(cat.order) }
            })
        ));
        
        res.json({ message: 'Categories reordered successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error reordering categories', error: error.message });
    }
};

exports.deleteQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const questionId = parseInt(id);

        // Delete associated answers first to avoid Foreign Key constraint errors
        await prisma.checklistAnswer.deleteMany({
            where: { questionId }
        });

        await prisma.checklistQuestionTemplate.delete({ 
            where: { id: questionId } 
        });

        res.json({ message: 'Question deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting question', error: error.message });
    }
};
