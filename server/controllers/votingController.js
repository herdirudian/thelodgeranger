const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BEST_ROOKIE_KEY = 'BEST_ROOKIE_OF_THE_YEAR';

const DEFAULT_CATEGORIES = [
  {
    key: 'BEST_EMPLOYEE_OF_THE_YEAR',
    group: 'Achievement Awards',
    title: 'Best Employee of The Year',
    description: 'Diberikan kepada karyawan yang menunjukkan performa kerja yang baik secara konsisten, memberikan dampak signifikan bagi tim maupun perusahaan, serta menjadi teladan dalam profesionalisme dan nilai-nilai kerja.',
    targetType: 'USER'
  },
  {
    key: 'BEST_ROOKIE_OF_THE_YEAR',
    group: 'Achievement Awards',
    title: 'Best Rookie of The Year',
    description: 'Diberikan kepada karyawan baru yang mampu beradaptasi dengan cepat, menunjukkan performa yang menonjol, serta memberikan kontribusi positif dalam waktu yang relatif singkat.',
    targetType: 'USER'
  },
  {
    key: 'BEST_DEPARTMENT_OF_THE_YEAR',
    group: 'Achievement Awards',
    title: 'Best Department of The Year',
    description: 'Diberikan kepada departemen yang menunjukkan kinerja terbaik melalui kolaborasi yang solid, pencapaian target, serta kontribusi signifikan terhadap keberhasilan perusahaan.',
    targetType: 'DEPARTMENT'
  },
  {
    key: 'SI_PALING_GALAK',
    group: 'The Fun Awards',
    title: 'Si Paling Galak',
    description: 'Si paling vokal yang selalu ngingetin dan memastikan semuanya tetap berjalan dengan baik 🔔',
    targetType: 'USER'
  },
  {
    key: 'SI_PALING_GOSIP',
    group: 'The Fun Awards',
    title: 'Si Paling Gosip (Info A1)',
    description: 'Update tercepat, info terlengkap! Belum rame aja dia udah tahu duluan 📢',
    targetType: 'USER'
  },
  {
    key: 'SI_PALING_HEUREUY',
    group: 'The Fun Awards',
    title: 'Si Paling Heureuy',
    description: 'Si pembawa vibes seru yang bikin hari kerja jadi lebih menyenangkan! 🥳',
    targetType: 'USER'
  },
  {
    key: 'SI_PALING_SOMEAH',
    group: 'The Fun Awards',
    title: 'Si Paling Someah',
    description: 'Senyum ramahnya bikin hari lebih baik. Paling hangat, paling welcoming, dan enak diajak ngobrol! 🧚🏻‍♀️',
    targetType: 'USER'
  },
  {
    key: 'SI_PALING_EKSIS',
    group: 'The Fun Awards',
    title: 'Si Paling Eksis',
    description: 'Selalu hadir di segala momen. Energinya nggak pernah habis!⚡',
    targetType: 'USER'
  }
];

let hasSeeded = false;

async function ensureCategories() {
  // Always run upsert to ensure data integrity, especially after key changes
  for (const c of DEFAULT_CATEGORIES) {
    await prisma.votingCategory.upsert({
      where: { key: c.key },
      update: {
        group: c.group,
        title: c.title,
        description: c.description,
        targetType: c.targetType,
        isActive: true
      },
      create: {
        key: c.key,
        group: c.group,
        title: c.title,
        description: c.description,
        targetType: c.targetType,
        isActive: true
      }
    });
  }

  const keyMapping = {
    'best_rookie': 'BEST_ROOKIE_OF_THE_YEAR',
    'best_dept': 'BEST_DEPARTMENT_OF_THE_YEAR',
    'fun_galak': 'SI_PALING_GALAK',
    'fun_gosip': 'SI_PALING_GOSIP',
    'SI_PALING_GOSIP_INFO_A1': 'SI_PALING_GOSIP',
    'fun_heureuy': 'SI_PALING_HEUREUY',
    'fun_someah': 'SI_PALING_SOMEAH',
    'fun_eksis': 'SI_PALING_EKSIS'
  };

  const allCategories = await prisma.votingCategory.findMany();
  const currentKeys = DEFAULT_CATEGORIES.map(c => c.key);

  for (const oldKey in keyMapping) {
    const newKey = keyMapping[oldKey];
    if (oldKey === newKey) continue;

    const oldCat = allCategories.find(c => c.key === oldKey);
    const newCat = allCategories.find(c => c.key === newKey);

    if (oldCat && newCat && oldCat.id !== newCat.id) {
      console.log(`Migrating voting data from ${oldKey} (id:${oldCat.id}) to ${newKey} (id:${newCat.id})`);
      
      // Migrate VoteCandidateMedia
      await prisma.voteCandidateMedia.updateMany({
        where: { categoryId: oldCat.id },
        data: { categoryId: newCat.id }
      });

      // Migrate Votes
      const oldVotes = await prisma.vote.findMany({ where: { categoryId: oldCat.id } });
      for (const v of oldVotes) {
        try {
          await prisma.vote.upsert({
            where: { categoryId_voterId: { categoryId: newCat.id, voterId: v.voterId } },
            update: {
              candidateUserId: v.candidateUserId,
              candidateDepartment: v.candidateDepartment,
              createdAt: v.createdAt
            },
            create: {
              categoryId: newCat.id,
              voterId: v.voterId,
              candidateUserId: v.candidateUserId,
              candidateDepartment: v.candidateDepartment,
              createdAt: v.createdAt
            }
          });
        } catch (e) {
          console.error(`Failed to migrate vote for voter ${v.voterId}:`, e.message);
        }
      }

      // Delete old category and its votes
      await prisma.vote.deleteMany({ where: { categoryId: oldCat.id } });
      await prisma.votingCategory.delete({ where: { id: oldCat.id } });
    }
  }

  // Ensure all other categories are inactive
  await prisma.votingCategory.updateMany({
    where: { key: { notIn: currentKeys } },
    data: { isActive: false }
  });
}

function coerceInt(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && v.trim().length > 0) {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

exports.getBallot = async (req, res) => {
  try {
    await ensureCategories();
    const categories = await prisma.votingCategory.findMany({
      where: { isActive: true },
      orderBy: [{ group: 'asc' }, { id: 'asc' }]
    });

    if (categories.length === 0) {
      console.error('No active voting categories found even after ensureCategories()');
    }

    const users = await prisma.user.findMany({
      select: { id: true, name: true, department: true, role: true },
      orderBy: { name: 'asc' }
    });

    const departments = [...new Set(users.map(u => u.department).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));

    const myVotesRaw = await prisma.vote.findMany({
      where: { voterId: req.userId },
      select: { categoryId: true, candidateUserId: true, candidateDepartment: true }
    });

    const userDb = await prisma.user.findUnique({ where: { id: req.userId }, select: { votingFinalized: true } });
    const isFinalized = userDb?.votingFinalized || false;

    const catIdToKey = new Map(categories.map(c => [c.id, c.key]));
    const myVotes = {};
    for (const v of myVotesRaw) {
      const k = catIdToKey.get(v.categoryId);
      if (!k) continue;
      myVotes[k] = {
        candidateUserId: v.candidateUserId,
        candidateDepartment: v.candidateDepartment
      };
    }

    // Special logic for nominees
    const rookieCategory = categories.find(c => c.key === BEST_ROOKIE_KEY);
    let rookieNominees = [];
    if (rookieCategory) {
      const media = await prisma.voteCandidateMedia.findMany({
        where: { categoryId: rookieCategory.id },
        include: { candidateUser: { select: { id: true, name: true, department: true, role: true } } }
      });
      rookieNominees = media.map(m => ({
        ...m.candidateUser,
        photoUrl: m.photoUrl
      }));
    }

    return res.json({
      categories,
      options: { 
        users, 
        departments,
        rookieNominees, // specifically for BEST_ROOKIE_OF_THE_YEAR
        rookiePhotos: rookieNominees.map(n => ({
          candidateUserId: n.id,
          photoUrl: n.photoUrl
        }))
      },
      myVotes,
      isFinalized
    });
  } catch (error) {
    console.error('Voting getBallot error:', error);
    return res.status(500).json({ message: 'Error fetching voting ballot', error: error.message });
  }
};

exports.submitVote = async (req, res) => {
  try {
    await ensureCategories();
    const { categoryKey, candidateUserId, candidateDepartment } = req.body || {};

    // Check if finalized
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (user?.votingFinalized) {
      return res.status(403).json({ message: "Anda sudah melakukan submit voting dan tidak dapat mengubahnya lagi." });
    }

    if (!categoryKey) return res.status(400).json({ message: 'categoryKey is required' });

    const category = await prisma.votingCategory.findUnique({ where: { key: String(categoryKey) } });
    if (!category || !category.isActive) return res.status(404).json({ message: 'Category not found' });

    let candidateUserIdVal = null;
    let candidateDepartmentVal = null;

    if (category.targetType === 'USER') {
      candidateUserIdVal = coerceInt(candidateUserId);
      if (!candidateUserIdVal) return res.status(400).json({ message: 'candidateUserId is required' });
      const exists = await prisma.user.findUnique({ where: { id: candidateUserIdVal }, select: { id: true } });
      if (!exists) return res.status(400).json({ message: 'Invalid candidate user' });
    } else if (category.targetType === 'DEPARTMENT') {
      candidateDepartmentVal = typeof candidateDepartment === 'string' ? candidateDepartment.trim() : '';
      if (!candidateDepartmentVal) return res.status(400).json({ message: 'candidateDepartment is required' });
      const exists = await prisma.user.findFirst({ where: { department: candidateDepartmentVal }, select: { id: true } });
      if (!exists) return res.status(400).json({ message: 'Invalid department' });
    } else {
      return res.status(400).json({ message: 'Unsupported targetType' });
    }

    await prisma.vote.upsert({
      where: { categoryId_voterId: { categoryId: category.id, voterId: req.userId } },
      update: {
        candidateUserId: candidateUserIdVal,
        candidateDepartment: candidateDepartmentVal
      },
      create: {
        categoryId: category.id,
        voterId: req.userId,
        candidateUserId: candidateUserIdVal,
        candidateDepartment: candidateDepartmentVal
      }
    });

    return res.json({ message: 'Vote saved' });
  } catch (error) {
    console.error('Voting submitVote error:', error);
    return res.status(500).json({ message: 'Error saving vote', error: error.message });
  }
};

exports.finalizeVoting = async (req, res) => {
  try {
    const userId = req.userId;
    await prisma.user.update({
      where: { id: userId },
      data: { votingFinalized: true }
    });
    return res.json({ message: "Voting finalized" });
  } catch (error) {
    console.error('Voting finalize error:', error);
    return res.status(500).json({ message: 'Error finalizing voting', error: error.message });
  }
};

exports.getResults = async (req, res) => {
  try {
    await ensureCategories();
    const categories = await prisma.votingCategory.findMany({
      orderBy: [{ group: 'asc' }, { id: 'asc' }]
    });

    if (categories.length === 0) {
      console.error('No voting categories found in getResults');
    }

    const userMap = new Map();
    const results = [];

    for (const c of categories) {
      // Find all votes for this category
      const grouped = c.targetType === 'USER' 
        ? await prisma.vote.groupBy({
            by: ['candidateUserId'],
            where: { categoryId: c.id, candidateUserId: { not: null } },
            _count: { candidateUserId: true }
          })
        : await prisma.vote.groupBy({
            by: ['candidateDepartment'],
            where: { categoryId: c.id, candidateDepartment: { not: null } },
            _count: { candidateDepartment: true }
          });

      // Sort in JS to avoid Prisma groupBy orderBy issues
      grouped.sort((a, b) => {
        const countA = c.targetType === 'USER' ? (a._count?.candidateUserId || 0) : (a._count?.candidateDepartment || 0);
        const countB = c.targetType === 'USER' ? (b._count?.candidateUserId || 0) : (b._count?.candidateDepartment || 0);
        return countB - countA;
      });

      const totalVotes = grouped.reduce((sum, g) => {
        const count = c.targetType === 'USER' ? (g._count?.candidateUserId || 0) : (g._count?.candidateDepartment || 0);
        return sum + count;
      }, 0);
      
      // If no votes and category is not active, skip it from overview
      if (totalVotes === 0 && !c.isActive) continue;

      if (c.targetType === 'USER') {
        const userIds = grouped.map(g => g.candidateUserId).filter(Boolean);
        if (userIds.length > 0) {
          const users = await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, department: true }
          });
          for (const u of users) userMap.set(u.id, u);
        }

        let mediaMap = new Map();
        if (c.key === BEST_ROOKIE_KEY && userIds.length > 0) {
          const media = await prisma.voteCandidateMedia.findMany({
            where: { categoryId: c.id, candidateUserId: { in: userIds } },
            select: { candidateUserId: true, photoUrl: true }
          });
          mediaMap = new Map(media.map(m => [m.candidateUserId, m.photoUrl]));
        }

        results.push({
          key: c.key,
          group: c.group,
          title: c.title,
          targetType: c.targetType,
          totalVotes,
          items: grouped.map(g => {
            const u = userMap.get(g.candidateUserId);
            return {
              candidateUserId: g.candidateUserId,
              name: u ? u.name : `User ${g.candidateUserId}`,
              department: u ? u.department : null,
              count: g._count?.candidateUserId || 0,
              photoUrl: c.key === BEST_ROOKIE_KEY ? (mediaMap.get(g.candidateUserId) || null) : null
            };
          })
        });
      } else if (c.targetType === 'DEPARTMENT') {
        results.push({
          key: c.key,
          group: c.group,
          title: c.title,
          targetType: c.targetType,
          totalVotes,
          items: grouped.map(g => ({
            candidateDepartment: g.candidateDepartment,
            count: g._count?.candidateDepartment || 0
          }))
        });
      }
    }

    return res.json({ results });
  } catch (error) {
    console.error('Voting getResults error:', error);
    return res.status(500).json({ message: 'Error fetching results', error: error.message });
  }
};

exports.resetAllVotes = async (req, res) => {
  try {
    // 1. Delete all records from Vote table
    await prisma.vote.deleteMany({});
    
    // 2. Reset votingFinalized status for all users
    await prisma.user.updateMany({
      data: { votingFinalized: false }
    });

    return res.json({ message: 'Semua data voting telah dihapus dan status user telah di-reset.' });
  } catch (error) {
    console.error('Voting resetAllVotes error:', error);
    return res.status(500).json({ message: 'Gagal menghapus data voting', error: error.message });
  }
};

exports.getRookiePhotos = async (req, res) => {
  try {
    await ensureCategories();
    const category = await prisma.votingCategory.findUnique({ where: { key: BEST_ROOKIE_KEY } });
    if (!category) return res.status(404).json({ message: 'Category not found' });

    const rows = await prisma.voteCandidateMedia.findMany({
      where: { categoryId: category.id },
      select: {
        candidateUserId: true,
        photoUrl: true,
        candidateUser: { select: { id: true, name: true, department: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });
    return res.json(rows);
  } catch (error) {
    console.error('Voting getRookiePhotos error:', error);
    return res.status(500).json({ message: 'Error fetching rookie photos', error: error.message });
  }
};

exports.setRookiePhoto = async (req, res) => {
  try {
    await ensureCategories();
    const { candidateUserId, photoUrl } = req.body || {};
    const uid = coerceInt(candidateUserId);
    const url = typeof photoUrl === 'string' ? photoUrl.trim() : '';
    if (!uid) return res.status(400).json({ message: 'candidateUserId is required' });
    if (!url) return res.status(400).json({ message: 'photoUrl is required' });

    const category = await prisma.votingCategory.findUnique({ where: { key: BEST_ROOKIE_KEY } });
    if (!category) return res.status(404).json({ message: 'Category not found' });
    const user = await prisma.user.findUnique({ where: { id: uid }, select: { id: true } });
    if (!user) return res.status(400).json({ message: 'Invalid user' });

    await prisma.voteCandidateMedia.upsert({
      where: { categoryId_candidateUserId: { categoryId: category.id, candidateUserId: uid } },
      update: { photoUrl: url },
      create: { categoryId: category.id, candidateUserId: uid, photoUrl: url }
    });

    return res.json({ message: 'Photo saved' });
  } catch (error) {
    console.error('Voting setRookiePhoto error:', error);
    return res.status(500).json({ message: 'Error saving rookie photo', error: error.message });
  }
};

exports.deleteRookiePhoto = async (req, res) => {
  try {
    await ensureCategories();
    const uid = coerceInt(req.params.candidateUserId);
    if (!uid) return res.status(400).json({ message: 'candidateUserId is required' });

    const category = await prisma.votingCategory.findUnique({ where: { key: BEST_ROOKIE_KEY } });
    if (!category) return res.status(404).json({ message: 'Category not found' });

    await prisma.voteCandidateMedia.delete({
      where: { categoryId_candidateUserId: { categoryId: category.id, candidateUserId: uid } }
    });
    return res.json({ message: 'Photo deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Error deleting rookie photo', error: error.message });
  }
};
