const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugHistory() {
    try {
        console.log('--- Debugging Assessment Submissions ---');
        
        const submissions = await prisma.assessmentSubmission.findMany({
            include: {
                assessor: { select: { id: true, name: true } },
                targetUser: { select: { id: true, name: true } },
                module: { select: { id: true, title: true, type: true } }
            }
        });

        console.log(`Total AssessmentSubmission records: ${submissions.length}`);
        
        if (submissions.length === 0) {
            console.log('No submissions found in AssessmentSubmission table.');
        } else {
            submissions.forEach(s => {
                console.log(`ID: ${s.id}, Module: ${s.module.title} (${s.module.type}), Assessor: ${s.assessor.name} (ID: ${s.assessor.id}), Target: ${s.targetUser.name} (ID: ${s.targetUser.id}), Score: ${s.score}`);
            });
        }

        console.log('\n--- Debugging UserLearningProgress for 360 ---');
        const progress360 = await prisma.userLearningProgress.findMany({
            where: {
                module: { type: 'ASSESSMENT_360' }
            },
            include: {
                user: { select: { id: true, name: true } },
                module: { select: { id: true, title: true } }
            }
        });

        console.log(`Total UserLearningProgress records for 360: ${progress360.length}`);
        progress360.forEach(p => {
            console.log(`User: ${p.user.name} (ID: ${p.user.id}), Module: ${p.module.title}, Status: ${p.status}, Score: ${p.quizScore}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugHistory();
