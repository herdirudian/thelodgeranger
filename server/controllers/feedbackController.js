const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createFeedback = async (req, res) => {
  try {
    const { 
        staffId, 
        ratingFriendliness,
        ratingExplanation,
        ratingHelpfulness,
        ratingRecommend,
        likedAspects,
        improvementAreas,
        customerName,
        customerPhone,
        customerEmail,
        wantFollowUp,
        privacyConsent,
        marketingConsent
    } = req.body;

    // Optional: Validate staffId exists
    
    const feedback = await prisma.customerFeedback.create({
      data: {
        staffId: parseInt(staffId),
        ratingFriendliness: parseInt(ratingFriendliness),
        ratingExplanation: parseInt(ratingExplanation),
        ratingHelpfulness: parseInt(ratingHelpfulness),
        ratingRecommend: parseInt(ratingRecommend),
        likedAspects,
        improvementAreas,
        customerName,
        customerPhone,
        customerEmail,
        wantFollowUp,
        privacyConsent,
        marketingConsent
      },
    });

    res.status(201).json({ message: 'Feedback submitted successfully' });
  } catch (error) {
    console.error("Feedback Error:", error);
    res.status(500).json({ message: 'Error submitting feedback', error: error.message });
  }
};

exports.getFeedback = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    let whereClause = {};
    if (user.role === 'STAFF') {
        whereClause = { staffId: userId };
    } else if (user.role === 'HOD') {
        whereClause = {
            staff: {
                department: user.department
            }
        };
    }
    // HR and GM see all, so no specific whereClause needed (remains empty)
    
    const feedbacks = await prisma.customerFeedback.findMany({
        where: whereClause,
        include: {
            staff: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(feedbacks);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching feedback', error: error.message });
  }
};

exports.exportFeedback = async (req, res) => {
    try {
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });
    
        let whereClause = {};
        if (user.role === 'STAFF') {
            whereClause = { staffId: userId };
        } else if (user.role === 'HOD') {
            whereClause = {
                staff: {
                    department: user.department
                }
            };
        }
        
        const feedbacks = await prisma.customerFeedback.findMany({
            where: whereClause,
            include: {
                staff: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    
        // Generate CSV
        const headers = [
            'Date', 
            'Staff Name', 
            'Customer Name', 
            'Customer Phone', 
            'Customer Email',
            'Friendliness (1-5)',
            'Explanation (1-5)',
            'Helpfulness (1-5)',
            'Recommend (1-5)',
            'Liked Aspects',
            'Improvement Areas',
            'Want Follow Up',
            'Privacy Consent',
            'Marketing Consent'
        ];
    
        const csvRows = [headers.join(',')];
    
        feedbacks.forEach(f => {
            const row = [
                f.createdAt ? f.createdAt.toISOString().split('T')[0] : '',
                f.staff?.name || '',
                f.customerName || '',
                f.customerPhone || '',
                f.customerEmail || '',
                f.ratingFriendliness,
                f.ratingExplanation,
                f.ratingHelpfulness,
                f.ratingRecommend,
                `"${(f.likedAspects || '').replace(/"/g, '""')}"`, // Escape quotes
                `"${(f.improvementAreas || '').replace(/"/g, '""')}"`,
                f.wantFollowUp ? 'Yes' : 'No',
                f.privacyConsent ? 'Yes' : 'No',
                f.marketingConsent ? 'Yes' : 'No'
            ];
            csvRows.push(row.join(','));
        });
    
        const csvString = csvRows.join('\n');
    
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="feedback_data.csv"');
        res.status(200).send(csvString);
    
    } catch (error) {
        console.error("Export Error:", error);
        res.status(500).json({ message: 'Error exporting feedback', error: error.message });
    }
};
