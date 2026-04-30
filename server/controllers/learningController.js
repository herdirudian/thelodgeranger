const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const notificationController = require('./notificationController');

// Get modules visible to the user (based on role)
exports.getModules = async (req, res) => {
    try {
        const userId = req.userId;
        const { type } = req.query; // 'PRODUCT_KNOWLEDGE' or 'SOP'
        
        const user = await prisma.user.findUnique({ where: { id: userId } });
        
        // Find modules where targetRoles is null (all) or contains user's role
        // Prisma JSON filtering can be tricky, so we might fetch all of type and filter in JS if needed,
        // but let's try to be efficient.
        // For now, fetch all of type and filter manually for simplicity with JSON arrays.
        
        const whereClause = {};
        if (type) whereClause.type = type;

        const allModules = await prisma.learningModule.findMany({
            where: whereClause,
            include: {
                progress: {
                    where: { userId }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Filter by Role
        const visibleModules = allModules.filter(m => {
            if (!m.targetRoles) return true; // Available to all
            const roles = m.targetRoles; // Array of strings
            return Array.isArray(roles) && (roles.includes(user.role) || roles.length === 0);
        });

        // Format response
        const response = visibleModules.map(m => {
            const progress = m.progress[0]; // Should be only one or none
            return {
                ...m,
                userProgress: progress ? {
                    status: progress.status,
                    acknowledged: progress.acknowledged,
                    quizScore: progress.quizScore,
                    isPassed: progress.isPassed
                } : {
                    status: 'NOT_STARTED',
                    acknowledged: false,
                    quizScore: null,
                    isPassed: false
                }
            };
        });

        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching modules' });
    }
};

exports.getModuleDetail = async (req, res) => {
    try {
        const userId = req.userId;
        const moduleId = parseInt(req.params.id);

        const module = await prisma.learningModule.findUnique({
            where: { id: moduleId },
            include: {
                quizzes: true
            }
        });

        if (!module) return res.status(404).json({ message: 'Module not found' });

        // Get user progress (Upsert to handle race conditions)
        const progress = await prisma.userLearningProgress.upsert({
            where: {
                userId_moduleId: { userId, moduleId }
            },
            update: {}, // Do nothing if exists
            create: {
                userId,
                moduleId,
                status: 'IN_PROGRESS'
            }
        });

        res.json({ module, progress });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching detail' });
    }
};

exports.acknowledgeModule = async (req, res) => {
    try {
        const userId = req.userId;
        const moduleId = parseInt(req.params.id);

        const progress = await prisma.userLearningProgress.upsert({
            where: { userId_moduleId: { userId, moduleId } },
            update: {
                acknowledged: true,
                acknowledgedAt: new Date(),
                // If no quiz, mark completed? Let's decide based on logic.
                // If module has quizzes, wait for quiz pass.
                // For now, let's say if acknowledge is done, check if quiz exists.
            },
            create: {
                userId,
                moduleId,
                status: 'IN_PROGRESS',
                acknowledged: true,
                acknowledgedAt: new Date()
            }
        });
        
        // Check if module has quiz
        const quizCount = await prisma.quiz.count({ where: { moduleId } });
        if (quizCount === 0) {
            await prisma.userLearningProgress.update({
                where: { userId_moduleId: { userId, moduleId } },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date()
                }
            });
        }

        res.json({ message: 'Acknowledged successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error acknowledging' });
    }
};

exports.submitQuiz = async (req, res) => {
    try {
        const userId = req.userId;
        const moduleId = parseInt(req.params.id);
        const { answers, targetUserId } = req.body; // { questionIndex: answer }

        if (!answers || typeof answers !== 'object') {
            return res.status(400).json({ message: 'Answers is required' });
        }

        const quiz = await prisma.quiz.findFirst({ 
            where: { moduleId },
            include: { module: { select: { type: true } } }
        });
        if (!quiz) return res.status(404).json({ message: 'No quiz found' });

        if (quiz.module.type === 'ASSESSMENT_360' && !targetUserId) {
            return res.status(400).json({ message: 'Target User ID is required for 360 Assessment' });
        }

        const questions = quiz.questions; // Array of objects
        let correctCount = 0;
        let totalQuestions = questions.length;
        
        // Check if we have SCALE questions (360 Assessment)
        const hasScaleQuestions = questions.some(q => q.type === 'SCALE');

        let score = 0;

        if (hasScaleQuestions) {
            let totalEarned = 0;
            let totalMax = 0;

            questions.forEach((q, index) => {
                const userAnswer = answers[index];

                if (q.type === 'SCALE') {
                    const val = parseInt(userAnswer) || 0;
                    const max = q.maxScale || 5;
                    totalEarned += val;
                    totalMax += max;
                }
                // Essays in 360 don't contribute to score usually, or we can add logic later.
                // For now, only SCALE contributes to the 0-100 score.
            });

            score = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
        } else {
            // Standard Quiz (Multiple Choice / Essay)
            questions.forEach((q, index) => {
                const userAnswer = answers[index];
                
                if (q.type === 'ESSAY') {
                    // For Essay, we count it as correct if it's filled.
                    // In the future, this might require manual grading.
                    if (userAnswer && typeof userAnswer === 'string' && userAnswer.trim().length > 0) {
                        correctCount++;
                    }
                } else {
                    // Multiple Choice
                    // Strict check: userAnswer must match q.answer (index)
                    // Note: userAnswer might be string if passed from frontend, q.answer is number
                    if (parseInt(userAnswer) === q.answer) {
                        correctCount++;
                    }
                }
            });

            score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 100;
        }

        const isPassed = score >= quiz.minScore;

        if (targetUserId) {
            // 360 Assessment Submission
            // Check if already submitted for this target
            const existing = await prisma.assessmentSubmission.findUnique({
                where: {
                    moduleId_assessorId_targetUserId: {
                        moduleId,
                        assessorId: userId,
                        targetUserId: parseInt(targetUserId)
                    }
                }
            });

            if (existing) {
                // Update existing submission
                await prisma.assessmentSubmission.update({
                    where: { id: existing.id },
                    data: {
                        answers,
                        score
                    }
                });
            } else {
                // Create new submission
                await prisma.assessmentSubmission.create({
                    data: {
                        moduleId,
                        assessorId: userId,
                        targetUserId: parseInt(targetUserId),
                        answers,
                        score
                    }
                });
            }

            // Update general progress to indicate participation
            // We don't mark as COMPLETED because they might need to assess multiple people.
            // Just ensure IN_PROGRESS exists.
             await prisma.userLearningProgress.upsert({
                where: { userId_moduleId: { userId, moduleId } },
                update: { status: 'IN_PROGRESS' }, // Keep as IN_PROGRESS
                create: {
                    userId,
                    moduleId,
                    status: 'IN_PROGRESS'
                }
            });

        } else {
            // Standard Self Assessment / Quiz
            await prisma.userLearningProgress.upsert({
                where: { userId_moduleId: { userId, moduleId } },
                update: {
                    quizScore: score,
                    isPassed,
                    answers: answers, // Save user answers to DB
                    status: isPassed ? 'COMPLETED' : 'IN_PROGRESS',
                    completedAt: isPassed ? new Date() : null
                },
                create: {
                    userId,
                    moduleId,
                    quizScore: score,
                    isPassed,
                    answers: answers,
                    status: isPassed ? 'COMPLETED' : 'IN_PROGRESS',
                    completedAt: isPassed ? new Date() : null
                }
            });
        }

        // Notify HR and GM
        try {
            const user = await prisma.user.findUnique({ where: { id: userId } });
            const module = await prisma.learningModule.findUnique({ where: { id: moduleId } });
            
            let message = '';
            if (targetUserId) {
                const target = await prisma.user.findUnique({ where: { id: parseInt(targetUserId) } });
                message = `${user.name} telah menyelesaikan Penilaian 360 untuk ${target ? target.name : 'rekan kerja'}.`;
            } else {
                message = `${user.name} telah menyelesaikan Self Assessment: ${module.title}.`;
            }

            const recipients = await prisma.user.findMany({
                where: { role: { in: ['HR', 'GM'] } },
                select: { id: true }
            });

            for (const r of recipients) {
                await notificationController.createNotification(r.id, message);
            }
        } catch (notifError) {
            console.error('Error sending notification:', notifError);
        }

        res.json({ score, isPassed, minScore: quiz.minScore });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error submitting quiz' });
    }
};

exports.getMySubmissions = async (req, res) => {
    try {
        const userId = req.userId;
        const moduleId = parseInt(req.params.id);
        
        const submissions = await prisma.assessmentSubmission.findMany({
            where: {
                moduleId,
                assessorId: userId
            },
            include: {
                targetUser: {
                    select: { id: true, name: true, department: true }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });
        
        res.json(submissions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching submissions' });
    }
};

exports.getMyHistory = async (req, res) => {
    try {
        const userId = req.userId;

        // 1. Get Regular Progress (SOP, PK, Self Assessment)
        // Include COMPLETED or IN_PROGRESS if quiz was taken (has score)
        const progress = await prisma.userLearningProgress.findMany({
            where: {
                userId,
                OR: [
                    { status: 'COMPLETED' },
                    { quizScore: { not: null } }
                ]
            },
            include: {
                module: {
                    select: { 
                        id: true, title: true, type: true, category: true,
                        quizzes: { select: { questions: true } }
                    }
                }
            }
        });

        // 2. Get 360 Submissions (Given by me)
        const submissionsGiven = await prisma.assessmentSubmission.findMany({
            where: { assessorId: userId },
            include: {
                module: {
                    select: { 
                        id: true, title: true, type: true, category: true,
                        quizzes: { select: { questions: true } }
                    }
                },
                targetUser: {
                    select: { name: true }
                }
            }
        });

        // 3. Get 360 Submissions (Received by me)
        const submissionsReceived = await prisma.assessmentSubmission.findMany({
            where: { targetUserId: userId },
            include: {
                module: {
                    select: { 
                        id: true, title: true, type: true, category: true,
                        quizzes: { select: { questions: true } }
                    }
                },
                assessor: {
                    select: { name: true }
                }
            }
        });

        // 4. Normalize Data
        const history = [];

        progress.forEach(p => {
            // Check if this module is already in submissions list (to avoid duplicates if both exist)
            const existsInSubmissions = submissionsGiven.some(s => s.moduleId === p.moduleId && s.updatedAt.getTime() === (p.completedAt || p.updatedAt).getTime());
            
            if (!existsInSubmissions) {
                
                const quizQuestions = p.module.quizzes?.[0]?.questions || [];
                const qaList = quizQuestions.map((q, idx) => ({
                    question: q.question,
                    answer: p.answers?.[idx] || '-'
                }));

                history.push({
                    id: `prog-${p.id}`,
                    moduleId: p.moduleId,
                    title: p.module.title || 'Untitled Module',
                    type: p.module.type,
                    category: p.module.category || 'General',
                    targetName: 'Diri Sendiri',
                    score: p.quizScore || 0,
                    date: p.completedAt || p.updatedAt || new Date(),
                    is360: false, // Treated as self/regular because it came from progress table
                    answers: p.answers, // Pass answers for PDF generation
                    qaList: qaList
                });
            }
        });

        submissionsGiven.forEach(s => {
            
            const quizQuestions = s.module.quizzes?.[0]?.questions || [];
            const qaList = quizQuestions.map((q, idx) => ({
                question: q.question,
                answer: s.answers?.[idx] || '-'
            }));

            history.push({
                id: `sub-given-${s.id}`,
                moduleId: s.moduleId,
                title: s.module.title || 'Untitled Assessment',
                type: 'ASSESSMENT_360',
                category: s.module.category || 'General',
                targetName: s.targetUser?.name || 'Unknown',
                score: s.score || 0,
                date: s.updatedAt || new Date(),
                is360: true,
                answers: s.answers,
                qaList: qaList
            });
        });

        submissionsReceived.forEach(s => {
            
            const quizQuestions = s.module.quizzes?.[0]?.questions || [];
            const qaList = quizQuestions.map((q, idx) => ({
                question: q.question,
                answer: s.answers?.[idx] || '-'
            }));

            history.push({
                id: `sub-recv-${s.id}`,
                moduleId: s.moduleId,
                title: `Hasil 360: ${s.module.title}`, // Distinguish title
                type: 'ASSESSMENT_360_RECEIVED', // Distinguish type
                category: s.module.category || 'General',
                targetName: 'Diri Sendiri', // Target is me
                reviewerName: s.assessor?.name || 'Unknown', // Who reviewed me
                score: s.score || 0,
                date: s.updatedAt || new Date(),
                is360: true,
                answers: s.answers,
                qaList: qaList
            });
        });

        // Sort by date desc
        history.sort((a, b) => new Date(b.date) - new Date(a.date));

        console.log(`History for user ${userId}: ${history.length} items`);
        res.json(history);
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ message: 'Error fetching history' });
    }
};

exports.getAllSubmissions = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user || !['ADMIN', 'HR', 'GM'].includes(user.role)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        // 1. Get Self Assessment Submissions (from UserLearningProgress)
        // Include SELF_ASSESSMENT modules where user has submitted answers / score / completed
        const selfAssessments = await prisma.userLearningProgress.findMany({
            where: {
                module: { type: 'SELF_ASSESSMENT' },
                OR: [
                    { quizScore: { not: null } },
                    { answers: { not: null } },
                    { status: 'COMPLETED' }
                ]
            },
            include: {
                user: { select: { id: true, name: true, department: true } },
                module: { 
                    select: { 
                        id: true, title: true, type: true, category: true,
                        quizzes: { select: { questions: true } }
                    } 
                }
            }
        });

        // 2. Get E-Learning Module Completions (PRODUCT_KNOWLEDGE & SOP)
        const learningCompletions = await prisma.userLearningProgress.findMany({
            where: {
                module: { type: { in: ['PRODUCT_KNOWLEDGE', 'SOP'] } },
                OR: [
                    { status: 'COMPLETED' },
                    { quizScore: { not: null } },
                    { acknowledged: true }
                ]
            },
            include: {
                user: { select: { id: true, name: true, department: true } },
                module: { 
                    select: { 
                        id: true, title: true, type: true, category: true,
                        quizzes: { select: { questions: true } }
                    } 
                }
            }
        });

        // 3. Get 360 Submissions (from AssessmentSubmission)
        const assessment360s = await prisma.assessmentSubmission.findMany({
            include: {
                assessor: { select: { id: true, name: true, department: true } }, // The one who did the assessment
                targetUser: { select: { id: true, name: true, department: true } }, // The one being assessed
                module: { 
                    select: { 
                        id: true, title: true, type: true, category: true,
                        quizzes: { select: { questions: true } }
                    } 
                }
            }
        });

        // 4. Get 360 Review (new Review360 assignments)
        const review360Assignments = await prisma.review360Assignment.findMany({
            where: {
                submittedAt: { not: null }
            },
            include: {
                form: {
                    select: {
                        id: true,
                        title: true,
                        description: true,
                        questions: true
                    }
                },
                targetUser: {
                    select: { id: true, name: true, department: true }
                },
                reviewerUser: {
                    select: { id: true, name: true, department: true }
                }
            }
        });

        // 5. Normalize
        const allSubmissions = [];

        selfAssessments.forEach(sa => {
            
            const quizQuestions = sa.module.quizzes?.[0]?.questions || [];
            const qaList = quizQuestions.map((q, idx) => ({
                question: q.question,
                answer: sa.answers?.[idx] || '-'
            }));

            allSubmissions.push({
                id: `sa-${sa.id}`,
                type: 'SELF_ASSESSMENT',
                date: sa.completedAt || sa.updatedAt,
                submitterName: sa.user?.name || 'Unknown',
                submitterDept: sa.user?.department || '-',
                targetName: sa.user?.name || 'Diri Sendiri',
                module: sa.module,
                score: sa.quizScore,
                answers: sa.answers,
                qaList: qaList
            });
        });

        learningCompletions.forEach(lp => {
            
            const quizQuestions = lp.module.quizzes?.[0]?.questions || [];
            const qaList = quizQuestions.map((q, idx) => ({
                question: q.question,
                answer: lp.answers?.[idx] || '-'
            }));

            allSubmissions.push({
                id: `learn-${lp.id}`,
                type: lp.module.type,
                date: lp.completedAt || lp.updatedAt,
                submitterName: lp.user?.name || 'Unknown',
                submitterDept: lp.user?.department || '-',
                targetName: lp.user?.name || 'Diri Sendiri',
                module: lp.module,
                score: lp.quizScore,
                answers: lp.answers,
                qaList: qaList
            });
        });

        assessment360s.forEach(a360 => {
            
            const quizQuestions = a360.module.quizzes?.[0]?.questions || [];
            const qaList = quizQuestions.map((q, idx) => ({
                question: q.question,
                answer: a360.answers?.[idx] || '-'
            }));

            allSubmissions.push({
                id: `360-${a360.id}`,
                type: 'ASSESSMENT_360',
                date: a360.updatedAt,
                submitterName: a360.assessor?.name || 'Unknown',
                submitterDept: a360.assessor?.department || '-',
                targetName: a360.targetUser?.name || 'Unknown',
                module: a360.module,
                score: a360.score,
                answers: a360.answers,
                qaList: qaList
            });
        });

        review360Assignments.forEach(a => {
            
            const questions = Array.isArray(a.form.questions) ? a.form.questions : [];
            const qaList = questions.map((q, idx) => ({
                question: q.question,
                answer: a.answers?.[idx] || '-'
            }));

            allSubmissions.push({
                id: `r360-${a.id}`,
                type: 'REVIEW_360',
                date: a.submittedAt || a.updatedAt,
                submitterName: a.reviewerUser?.name || 'Unknown',
                submitterDept: a.reviewerUser?.department || '-',
                targetName: a.targetUser?.name || 'Unknown',
                module: {
                    id: a.form.id,
                    title: a.form.title,
                    type: 'REVIEW_360',
                    category: 'Penilaian 360'
                },
                score: null,
                answers: a.answers,
                qaList: qaList
            });
        });

        // Sort by date desc
        allSubmissions.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json(allSubmissions);

    } catch (error) {
        console.error('Error fetching all submissions:', error);
        res.status(500).json({ message: 'Error fetching submissions' });
    }
};

// Admin Management
exports.createModule = async (req, res) => {
    try {
        const { 
            title, description, type, category, content, 
            metadata, videoUrl, images, fileUrl, 
            version, isMandatory, targetRoles 
        } = req.body;

        const module = await prisma.learningModule.create({
            data: {
                title, description, type, category, content,
                metadata, videoUrl, images, fileUrl,
                version, isMandatory, targetRoles
            }
        });

        res.status(201).json(module);
    } catch (error) {
        res.status(500).json({ message: 'Error creating module' });
    }
};

exports.updateModule = async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;
        const module = await prisma.learningModule.update({
            where: { id: parseInt(id) },
            data
        });
        res.json(module);
    } catch (error) {
        res.status(500).json({ message: 'Error updating module' });
    }
};

exports.deleteSubmission = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user || !['ADMIN', 'HR', 'GM'].includes(user.role)) {
            return res.status(403).json({ message: 'Forbidden' });
        }

        const { id } = req.params;
        const parts = id.split('-');
        const prefix = parts[0];
        const recordId = parseInt(parts[1]);

        if (isNaN(recordId)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }

        if (prefix === 'sa' || prefix === 'learn') {
            await prisma.userLearningProgress.delete({
                where: { id: recordId }
            });
        } else if (prefix === '360') {
            await prisma.assessmentSubmission.delete({
                where: { id: recordId }
            });
        } else if (prefix === 'r360') {
            // For Review360, we might want to just reset it if we want to allow re-submission,
            // but "delete history" usually means removing the record.
            // However, Review360Assignment is an assignment. Deleting it removes the assignment entirely.
            // If the user just wants to clear the submission data:
            // await prisma.review360Assignment.update({
            //     where: { id: recordId },
            //     data: { submittedAt: null, answers: null }
            // });
            // But let's stick to delete as per request "hapus".
            await prisma.review360Assignment.delete({
                where: { id: recordId }
            });
        } else {
            return res.status(400).json({ message: 'Unknown submission type' });
        }

        res.json({ message: 'Submission deleted' });
    } catch (error) {
        console.error('Error deleting submission:', error);
        res.status(500).json({ message: 'Error deleting submission' });
    }
};

exports.deleteModule = async (req, res) => {
    try {
        const moduleId = parseInt(req.params.id);

        await prisma.assessmentSubmission.deleteMany({
            where: { moduleId }
        });

        await prisma.userLearningProgress.deleteMany({
            where: { moduleId }
        });

        await prisma.quiz.deleteMany({
            where: { moduleId }
        });

        await prisma.learningModule.delete({
            where: { id: moduleId }
        });

        res.json({ message: 'Deleted' });
    } catch (error) {
        console.error('Error deleting module:', error);
        res.status(500).json({ message: 'Error deleting module', error: error.message });
    }
};

exports.createQuiz = async (req, res) => {
    try {
        const { moduleId } = req.params;
        const { questions, minScore } = req.body;
        
        const quiz = await prisma.quiz.create({
            data: {
                moduleId: parseInt(moduleId),
                questions,
                minScore
            }
        });
        res.status(201).json(quiz);
    } catch (error) {
        res.status(500).json({ message: 'Error creating quiz' });
    }
};

exports.updateQuiz = async (req, res) => {
    try {
        const { moduleId } = req.params;
        const { questions, minScore } = req.body;
        
        // Check if quiz exists
        const existingQuiz = await prisma.quiz.findFirst({
            where: { moduleId: parseInt(moduleId) }
        });

        let quiz;
        if (existingQuiz) {
            quiz = await prisma.quiz.update({
                where: { id: existingQuiz.id },
                data: {
                    questions,
                    minScore
                }
            });
        } else {
            quiz = await prisma.quiz.create({
                data: {
                    moduleId: parseInt(moduleId),
                    questions,
                    minScore
                }
            });
        }

        res.json(quiz);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating quiz' });
    }
};
