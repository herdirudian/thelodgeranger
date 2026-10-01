const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Calculates retention / expiry date based on category according to SOP:
 * 1. Valuable Items: 10 Bulan
 * 2. High-Personal Items: 4 Bulan
 * 3. General / Non-Valuable: 3 Bulan
 * 4. Low-Value / Accessories: 1 Bulan
 * 5. Perishable - Sealed: 3 Hari (72 jam)
 * 6. Perishable - Unsealed: 24 Jam (1 hari)
 */
function calculateExpiryDate(category, foundDate = new Date()) {
  const d = new Date(foundDate);
  switch (category) {
    case 'VALUABLE':
      d.setMonth(d.getMonth() + 10);
      break;
    case 'HIGH_PERSONAL':
      d.setMonth(d.getMonth() + 4);
      break;
    case 'GENERAL':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'LOW_VALUE':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'PERISHABLE_SEALED':
      d.setDate(d.getDate() + 3);
      break;
    case 'PERISHABLE_UNSEALED':
      d.setDate(d.getDate() + 1);
      break;
    default:
      d.setMonth(d.getMonth() + 1);
  }
  return d;
}

/**
 * Auto-generates unique registration number: LNF-YYYYMMDD-XXX
 */
async function generateRegistrationNo(date = new Date()) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const prefix = `LNF-${year}${month}${day}`;

  const latestItem = await prisma.lostAndFoundItem.findFirst({
    where: {
      registrationNo: {
        startsWith: prefix
      }
    },
    orderBy: {
      registrationNo: 'desc'
    }
  });

  let sequence = 1;
  if (latestItem && latestItem.registrationNo) {
    const parts = latestItem.registrationNo.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }

  return `${prefix}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Automatically updates STORED items whose expiryDate has passed to UNCLAIMED
 */
async function checkAndExpireLostAndFound() {
  try {
    const now = new Date();
    const expiredCount = await prisma.lostAndFoundItem.count({
      where: {
        status: 'STORED',
        expiryDate: { lte: now }
      }
    });

    if (expiredCount > 0) {
      await prisma.lostAndFoundItem.updateMany({
        where: {
          status: 'STORED',
          expiryDate: { lte: now }
        },
        data: {
          status: 'UNCLAIMED'
        }
      });
      console.log(`[LostAndFound] Automatically marked ${expiredCount} expired items as UNCLAIMED`);
    }
    return expiredCount;
  } catch (err) {
    console.error('[LostAndFound] Error in checkAndExpireLostAndFound:', err.message);
    return 0;
  }
}

exports.checkAndExpireLostAndFound = checkAndExpireLostAndFound;

/**
 * Get all Lost & Found items with filtering, search, and pagination
 */
exports.getAllItems = async (req, res) => {
  try {
    await checkAndExpireLostAndFound();

    const {
      search,
      category,
      status,
      storageLocation,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 100
    } = req.query;

    const where = {};

    if (search && search.trim() !== '') {
      const q = search.trim();
      where.OR = [
        { registrationNo: { contains: q } },
        { itemType: { contains: q } },
        { description: { contains: q } },
        { foundLocation: { contains: q } },
        { finderName: { contains: q } },
        { finderDept: { contains: q } },
        { ownerName: { contains: q } },
        { storageLocation: { contains: q } }
      ];
    }

    if (category && category !== 'ALL') {
      where.category = category;
    }

    if (status && status !== 'ALL') {
      if (status === 'EXPIRING_SOON') {
        const now = new Date();
        const next7Days = new Date();
        next7Days.setDate(next7Days.getDate() + 7);
        where.status = 'STORED';
        where.expiryDate = {
          gte: now,
          lte: next7Days
        };
      } else {
        where.status = status;
      }
    }

    if (storageLocation && storageLocation.trim() !== '') {
      where.storageLocation = { contains: storageLocation.trim() };
    }

    if (startDate || endDate) {
      where.foundDate = {};
      if (startDate) {
        where.foundDate.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.foundDate.lte = end;
      }
    }

    const take = Math.min(parseInt(limit) || 100, 500);
    const skip = ((parseInt(page) || 1) - 1) * take;

    const [total, items] = await Promise.all([
      prisma.lostAndFoundItem.count({ where }),
      prisma.lostAndFoundItem.findMany({
        where,
        include: {
          finderUser: {
            select: { id: true, name: true, department: true }
          },
          createdBy: {
            select: { id: true, name: true, role: true }
          }
        },
        orderBy: {
          [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc'
        },
        skip,
        take
      })
    ]);

    res.status(200).json({
      total,
      page: parseInt(page) || 1,
      totalPages: Math.ceil(total / take),
      items
    });
  } catch (error) {
    console.error('Error fetching Lost & Found items:', error);
    res.status(500).json({ message: 'Gagal mengambil data Lost & Found', error: error.message });
  }
};

/**
 * Get summary statistics for dashboard cards
 */
exports.getStats = async (req, res) => {
  try {
    await checkAndExpireLostAndFound();

    const now = new Date();
    const next7Days = new Date();
    next7Days.setDate(next7Days.getDate() + 7);

    const [total, stored, expiringSoon, claimed, unclaimed] = await Promise.all([
      prisma.lostAndFoundItem.count(),
      prisma.lostAndFoundItem.count({ where: { status: 'STORED' } }),
      prisma.lostAndFoundItem.count({
        where: {
          status: 'STORED',
          expiryDate: { gte: now, lte: next7Days }
        }
      }),
      prisma.lostAndFoundItem.count({ where: { status: 'CLAIMED' } }),
      prisma.lostAndFoundItem.count({ where: { status: 'UNCLAIMED' } })
    ]);

    res.status(200).json({
      total,
      stored,
      expiringSoon,
      claimed,
      unclaimed
    });
  } catch (error) {
    console.error('Error fetching Lost & Found stats:', error);
    res.status(500).json({ message: 'Gagal mengambil statistik Lost & Found', error: error.message });
  }
};

/**
 * Get single item by ID
 */
exports.getItemById = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await prisma.lostAndFoundItem.findUnique({
      where: { id: parseInt(id) },
      include: {
        finderUser: {
          select: { id: true, name: true, email: true, department: true }
        },
        createdBy: {
          select: { id: true, name: true, email: true, role: true }
        }
      }
    });

    if (!item) {
      return res.status(404).json({ message: 'Barang tidak ditemukan' });
    }

    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Error mengambil detail barang', error: error.message });
  }
};

/**
 * Register a new found item (Initial Intake)
 */
exports.createItem = async (req, res) => {
  try {
    const {
      foundDate,
      foundLocation,
      finderName,
      finderDept,
      finderUserId,
      category,
      itemType,
      description,
      photoUrl,
      storageLocation,
      customRegistrationNo,
      customExpiryDate
    } = req.body;

    if (!foundLocation || !finderName || !category || !description || !storageLocation) {
      return res.status(400).json({
        message: 'Mohon lengkapi area penemuan, nama penemu, kategori, deskripsi, dan tempat penyimpanan'
      });
    }

    const dateFound = foundDate ? new Date(foundDate) : new Date();
    const regNo = customRegistrationNo && customRegistrationNo.trim() !== ''
      ? customRegistrationNo.trim().toUpperCase()
      : await generateRegistrationNo(dateFound);

    // Calculate expiry date if not explicitly customized
    const expiry = customExpiryDate ? new Date(customExpiryDate) : calculateExpiryDate(category, dateFound);

    const newItem = await prisma.lostAndFoundItem.create({
      data: {
        registrationNo: regNo,
        foundDate: dateFound,
        foundLocation: foundLocation.trim(),
        finderName: finderName.trim(),
        finderDept: finderDept ? finderDept.trim() : 'General',
        finderUserId: finderUserId ? parseInt(finderUserId) : null,
        category,
        itemType: itemType ? itemType.trim() : null,
        description: description.trim(),
        photoUrl: photoUrl || null,
        storageLocation: storageLocation.trim(),
        expiryDate: expiry,
        status: 'STORED',
        createdById: req.userId
      },
      include: {
        createdBy: { select: { id: true, name: true } }
      }
    });

    res.status(201).json({
      message: `Barang temuan berhasil didaftarkan dengan ID ${newItem.registrationNo}`,
      item: newItem
    });
  } catch (error) {
    console.error('Error creating Lost & Found item:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Nomor registrasi sudah ada. Silakan gunakan nomor lain atau biarkan otomatis.' });
    }
    res.status(500).json({ message: 'Gagal mendaftarkan barang temuan: ' + error.message });
  }
};

/**
 * Update item details
 */
exports.updateItem = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      foundDate,
      foundLocation,
      finderName,
      finderDept,
      category,
      itemType,
      description,
      photoUrl,
      storageLocation,
      expiryDate
    } = req.body;

    const existing = await prisma.lostAndFoundItem.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Barang tidak ditemukan' });
    }

    const dataToUpdate = {};
    if (foundLocation !== undefined) dataToUpdate.foundLocation = foundLocation.trim();
    if (finderName !== undefined) dataToUpdate.finderName = finderName.trim();
    if (finderDept !== undefined) dataToUpdate.finderDept = finderDept.trim();
    if (itemType !== undefined) dataToUpdate.itemType = itemType ? itemType.trim() : null;
    if (description !== undefined) dataToUpdate.description = description.trim();
    if (photoUrl !== undefined) dataToUpdate.photoUrl = photoUrl;
    if (storageLocation !== undefined) dataToUpdate.storageLocation = storageLocation.trim();

    if (foundDate) {
      dataToUpdate.foundDate = new Date(foundDate);
    }

    if (category) {
      dataToUpdate.category = category;
      if (!expiryDate && foundDate) {
        dataToUpdate.expiryDate = calculateExpiryDate(category, new Date(foundDate));
      }
    }

    if (expiryDate) {
      dataToUpdate.expiryDate = new Date(expiryDate);
    }

    const updated = await prisma.lostAndFoundItem.update({
      where: { id: parseInt(id) },
      data: dataToUpdate
    });

    res.status(200).json({
      message: 'Data barang temuan berhasil diperbarui',
      item: updated
    });
  } catch (error) {
    console.error('Error updating Lost & Found item:', error);
    res.status(500).json({ message: 'Gagal memperbarui data barang: ' + error.message });
  }
};

/**
 * Handover & Claim by guest
 */
exports.claimItem = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      ownerName,
      ownerPhone,
      claimedDate,
      handoverProofUrl,
      handoverStaff,
      handoverNotes
    } = req.body;

    if (!ownerName || !ownerPhone || !handoverStaff) {
      return res.status(400).json({
        message: 'Mohon lengkapi nama pemilik, nomor HP, dan nama petugas penyerah'
      });
    }

    const existing = await prisma.lostAndFoundItem.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Barang tidak ditemukan' });
    }

    if (existing.status === 'CLAIMED') {
      return res.status(400).json({ message: 'Barang ini sudah diklaim sebelumnya' });
    }

    const updated = await prisma.lostAndFoundItem.update({
      where: { id: parseInt(id) },
      data: {
        status: 'CLAIMED',
        ownerName: ownerName.trim(),
        ownerPhone: ownerPhone.trim(),
        claimedDate: claimedDate ? new Date(claimedDate) : new Date(),
        handoverProofUrl: handoverProofUrl || null,
        handoverStaff: handoverStaff.trim(),
        handoverNotes: handoverNotes ? handoverNotes.trim() : null
      }
    });

    res.status(200).json({
      message: `Barang ${existing.registrationNo} berhasil diserahkan kepada tamu (${ownerName})`,
      item: updated
    });
  } catch (error) {
    console.error('Error claiming Lost & Found item:', error);
    res.status(500).json({ message: 'Gagal memproses klaim barang: ' + error.message });
  }
};

/**
 * Process final action for unclaimed item (Diambil Penemu / Dihibahkan / Pemusnahan)
 */
exports.finalActionItem = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      finalAction,
      finalActionDate,
      finalActionNotes,
      finalActionStaff
    } = req.body;

    const allowedActions = ['RETURNED_TO_FINDER', 'DONATED', 'DISPOSED'];
    if (!finalAction || !allowedActions.includes(finalAction)) {
      return res.status(400).json({
        message: 'Pilih tindakan akhir yang valid: RETURNED_TO_FINDER, DONATED, atau DISPOSED'
      });
    }

    const existing = await prisma.lostAndFoundItem.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Barang tidak ditemukan' });
    }

    const updated = await prisma.lostAndFoundItem.update({
      where: { id: parseInt(id) },
      data: {
        status: 'UNCLAIMED',
        finalAction,
        finalActionDate: finalActionDate ? new Date(finalActionDate) : new Date(),
        finalActionNotes: finalActionNotes ? finalActionNotes.trim() : null,
        finalActionStaff: finalActionStaff ? finalActionStaff.trim() : (req.user ? req.user.name : null)
      }
    });

    res.status(200).json({
      message: `Tindakan akhir untuk barang ${existing.registrationNo} berhasil disimpan`,
      item: updated
    });
  } catch (error) {
    console.error('Error processing final action for Lost & Found item:', error);
    res.status(500).json({ message: 'Gagal memproses tindakan akhir: ' + error.message });
  }
};

/**
 * Delete item record (Admin / HR / Security Head only)
 */
exports.deleteItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await prisma.lostAndFoundItem.findUnique({
      where: { id: parseInt(id) }
    });

    if (!item) {
      return res.status(404).json({ message: 'Barang tidak ditemukan' });
    }

    // Role check: Only HR, GM, ADMIN, or Security can delete
    const allowedRoles = ['GM', 'HR', 'ADMIN'];
    const isSecurity = String(req.department || '').toLowerCase() === 'security';
    if (!allowedRoles.includes(req.role) && !isSecurity) {
      return res.status(403).json({ message: 'Hanya Admin, HR, GM, atau Security yang dapat menghapus data' });
    }

    await prisma.lostAndFoundItem.delete({
      where: { id: parseInt(id) }
    });

    res.status(200).json({ message: `Data barang ${item.registrationNo} berhasil dihapus` });
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus data barang: ' + error.message });
  }
};
