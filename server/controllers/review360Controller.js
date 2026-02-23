const { PrismaClient } = require('@prisma/client');
const notificationController = require('./notificationController');

const prisma = new PrismaClient();

exports.getMyAssignments = async (req, res) => {
  try {
    const reviewerUserId = req.userId;

    const assignments = await prisma.review360Assignment.findMany({
      where: { reviewerUserId },
      include: {
        form: {
          select: {
            id: true,
            title: true,
            description: true,
            questions: true,
            isPublished: true,
            createdAt: true
          }
        },
        targetUser: {
          select: { id: true, name: true, role: true, department: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const visible = assignments.filter(a => a.form.isPublished);
    res.status(200).json(visible);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching assignments', error: error.message });
  }
};

exports.getAssignmentDetail = async (req, res) => {
  try {
    const reviewerUserId = req.userId;
    const assignmentId = parseInt(req.params.id);

    const assignment = await prisma.review360Assignment.findFirst({
      where: { id: assignmentId, reviewerUserId },
      include: {
        form: {
          select: {
            id: true,
            title: true,
            description: true,
            questions: true,
            isPublished: true
          }
        },
        targetUser: {
          select: { id: true, name: true, role: true, department: true }
        },
        reviewerUser: {
          select: { id: true, name: true, role: true, department: true }
        }
      }
    });

    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
    if (!assignment.form.isPublished) return res.status(403).json({ message: 'Form not published' });

    res.status(200).json(assignment);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching assignment', error: error.message });
  }
};

exports.submitAssignment = async (req, res) => {
  try {
    const reviewerUserId = req.userId;
    const assignmentId = parseInt(req.params.id);
    const { answers } = req.body;

    const assignment = await prisma.review360Assignment.findFirst({
      where: { id: assignmentId, reviewerUserId },
      include: {
        form: { select: { isPublished: true } }
      }
    });

    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });
    if (!assignment.form.isPublished) return res.status(403).json({ message: 'Form not published' });

    const updated = await prisma.review360Assignment.update({
      where: { id: assignmentId },
      data: {
        answers,
        submittedAt: new Date()
      },
      include: {
          form: true,
          targetUser: true
      }
    });

    // Notify HR and GM
    try {
        const user = await prisma.user.findUnique({ where: { id: reviewerUserId } });
        const message = `${user.name} telah menyelesaikan Penilaian 360 untuk ${updated.targetUser.name} (${updated.form.title}).`;

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

    res.status(200).json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error submitting assignment', error: error.message });
  }
};

exports.adminCreateForm = async (req, res) => {
  try {
    const createdById = req.userId;
    const { title, description, questions, assignments } = req.body;

    if (!title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'Title and questions are required' });
    }

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ message: 'Assignments are required' });
    }

    const form = await prisma.review360Form.create({
      data: {
        title,
        description: description || null,
        questions,
        createdById,
        isPublished: true
      }
    });

    const uniqueKey = new Set();
    const data = [];
    for (const a of assignments) {
      const targetUserId = parseInt(a.targetUserId);
      const reviewerUserId = parseInt(a.reviewerUserId);
      if (!targetUserId || !reviewerUserId) continue;
      const key = `${targetUserId}:${reviewerUserId}`;
      if (uniqueKey.has(key)) continue;
      uniqueKey.add(key);
      data.push({ formId: form.id, targetUserId, reviewerUserId });
    }

    if (data.length === 0) {
      await prisma.review360Form.delete({ where: { id: form.id } });
      return res.status(400).json({ message: 'No valid assignments' });
    }

    await prisma.review360Assignment.createMany({ data });

    const created = await prisma.review360Form.findUnique({
      where: { id: form.id },
      include: {
        assignments: true
      }
    });

    res.status(201).json(created);
  } catch (error) {
    res.status(500).json({ message: 'Error creating 360 form', error: error.message });
  }
};

exports.adminUpdateForm = async (req, res) => {
  try {
    const formId = parseInt(req.params.id);
    const { title, description, questions, assignments } = req.body;

    if (!title || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: 'Title and questions are required' });
    }

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ message: 'Assignments are required' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.review360Form.findUnique({
        where: { id: formId },
        include: {
          assignments: true
        }
      });

      if (!existing) {
        throw new Error('NOT_FOUND');
      }

      const hasSubmitted = existing.assignments.some(a => a.submittedAt);
      if (hasSubmitted) {
        throw new Error('HAS_SUBMISSIONS');
      }

      const uniqueKey = new Set();
      const data = [];
      for (const a of assignments) {
        const targetUserId = parseInt(a.targetUserId);
        const reviewerUserId = parseInt(a.reviewerUserId);
        if (!targetUserId || !reviewerUserId) continue;
        const key = `${targetUserId}:${reviewerUserId}`;
        if (uniqueKey.has(key)) continue;
        uniqueKey.add(key);
        data.push({ formId, targetUserId, reviewerUserId });
      }

      if (data.length === 0) {
        throw new Error('NO_ASSIGNMENTS');
      }

      await tx.review360Assignment.deleteMany({ where: { formId } });

      await tx.review360Form.update({
        where: { id: formId },
        data: {
          title,
          description: description || null,
          questions,
          isPublished: true
        }
      });

      await tx.review360Assignment.createMany({ data });

      const result = await tx.review360Form.findUnique({
        where: { id: formId },
        include: {
          assignments: true
        }
      });

      return result;
    });

    res.status(200).json(updated);
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ message: 'Form not found' });
    }
    if (error.message === 'HAS_SUBMISSIONS') {
      return res.status(400).json({ message: 'Form sudah memiliki jawaban, tidak dapat diubah.' });
    }
    if (error.message === 'NO_ASSIGNMENTS') {
      return res.status(400).json({ message: 'No valid assignments' });
    }
    res.status(500).json({ message: 'Error updating 360 form', error: error.message });
  }
};

exports.adminListForms = async (req, res) => {
  try {
    const forms = await prisma.review360Form.findMany({
      include: {
        assignments: {
          select: { id: true, submittedAt: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const response = forms.map(f => {
      const total = f.assignments.length;
      const completed = f.assignments.filter(a => a.submittedAt).length;
      return {
        id: f.id,
        title: f.title,
        description: f.description,
        isPublished: f.isPublished,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        totalAssignments: total,
        completedAssignments: completed
      };
    });

    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching forms', error: error.message });
  }
};

exports.adminGetFormDetail = async (req, res) => {
  try {
    const formId = parseInt(req.params.id);
    const form = await prisma.review360Form.findUnique({
      where: { id: formId },
      include: {
        createdBy: { select: { id: true, name: true, role: true } },
        assignments: {
          include: {
            targetUser: { select: { id: true, name: true, role: true, department: true } },
            reviewerUser: { select: { id: true, name: true, role: true, department: true } }
          },
          orderBy: [{ targetUserId: 'asc' }, { reviewerUserId: 'asc' }]
        }
      }
    });

    if (!form) return res.status(404).json({ message: 'Form not found' });
    res.status(200).json(form);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching form detail', error: error.message });
  }
};

exports.adminDeleteForm = async (req, res) => {
  try {
    const formId = parseInt(req.params.id);

    const existing = await prisma.review360Form.findUnique({
      where: { id: formId },
      include: {
        assignments: true
      }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Form not found' });
    }

    const hasSubmitted = existing.assignments.some(a => a.submittedAt);
    if (hasSubmitted) {
      return res.status(400).json({ message: 'Form sudah memiliki jawaban, tidak dapat dihapus.' });
    }

    await prisma.review360Assignment.deleteMany({ where: { formId } });
    await prisma.review360Form.delete({ where: { id: formId } });

    res.status(200).json({ message: 'Form deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting 360 form', error: error.message });
  }
};
