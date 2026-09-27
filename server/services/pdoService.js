const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { createNotification } = require('../controllers/notificationController');

function calculateThreeMonths(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  const targetMonth = d.getMonth() + 3;
  d.setMonth(targetMonth);
  if (d.getMonth() > (targetMonth % 12)) {
    d.setDate(0);
  }
  return d;
}

/**
 * Recalculates and synchronizes User.pdo and User.pdoExpiresAt based on active PdoRecord batches.
 */
async function syncUserPdoBalance(userId) {
  try {
    const activeRecords = await prisma.pdoRecord.findMany({
      where: {
        userId,
        isExpired: false,
        remainingDays: { gt: 0 }
      },
      orderBy: { expiresAt: 'asc' }
    });

    const totalPdo = activeRecords.reduce((sum, r) => sum + r.remainingDays, 0);

    // Find the earliest active expiration date
    let earliestExpiry = null;
    for (const r of activeRecords) {
      if (r.expiresAt) {
        if (!earliestExpiry || r.expiresAt < earliestExpiry) {
          earliestExpiry = r.expiresAt;
        }
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        pdo: totalPdo,
        pdoExpiresAt: earliestExpiry
      },
      select: {
        id: true,
        name: true,
        pdo: true,
        pdoExpiresAt: true,
        pdoInputDate: true,
        pdoAutoExpire: true
      }
    });

    return updatedUser;
  } catch (error) {
    console.error(`Error syncing PDO balance for user ${userId}:`, error.message);
    return null;
  }
}

/**
 * Top up PDO quota for a user.
 */
async function topUpUserPdo(userId, { days, inputDate, expiresAt, autoExpire, notes }) {
  const parsedDays = parseInt(days) || 1;
  const parsedInputDate = inputDate ? new Date(inputDate) : new Date();
  const isAutoExpire = autoExpire !== false && autoExpire !== 'false';
  let finalExpiresAt = expiresAt ? new Date(expiresAt) : null;

  if (isAutoExpire && !expiresAt) {
    finalExpiresAt = calculateThreeMonths(parsedInputDate);
  }

  const record = await prisma.pdoRecord.create({
    data: {
      userId,
      days: parsedDays,
      remainingDays: parsedDays,
      inputDate: parsedInputDate,
      expiresAt: finalExpiresAt,
      autoExpire: isAutoExpire,
      notes: notes ? String(notes).trim() : null
    }
  });

  const updatedUser = await syncUserPdoBalance(userId);
  return { record, user: updatedUser };
}

/**
 * Deduct PDO using FIFO (First In First Out: oldest expiring batch first).
 */
async function deductUserPdo(userId, quantity) {
  let qtyToDeduct = parseInt(quantity) || 1;

  const activeRecords = await prisma.pdoRecord.findMany({
    where: {
      userId,
      isExpired: false,
      remainingDays: { gt: 0 }
    },
    orderBy: { expiresAt: 'asc' }
  });

  for (const record of activeRecords) {
    if (qtyToDeduct <= 0) break;

    if (record.remainingDays <= qtyToDeduct) {
      qtyToDeduct -= record.remainingDays;
      await prisma.pdoRecord.update({
        where: { id: record.id },
        data: { remainingDays: 0 }
      });
    } else {
      await prisma.pdoRecord.update({
        where: { id: record.id },
        data: { remainingDays: record.remainingDays - qtyToDeduct }
      });
      qtyToDeduct = 0;
    }
  }

  // If there are still quantities left (e.g. user had legacy quota before PdoRecord system), decrement user directly
  if (qtyToDeduct > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { pdo: { decrement: qtyToDeduct } }
    });
  }

  return await syncUserPdoBalance(userId);
}

/**
 * Delete a specific PDO record and re-sync user's active PDO balance.
 */
async function deletePdoRecord(recordId) {
  const record = await prisma.pdoRecord.findUnique({
    where: { id: parseInt(recordId) }
  });

  if (!record) throw new Error('Record PDO tidak ditemukan');

  await prisma.pdoRecord.delete({
    where: { id: parseInt(recordId) }
  });

  return await syncUserPdoBalance(record.userId);
}

/**
 * Checks for expired PDO batches and automatically decrements them to 0.
 * Automatically notifies affected employees.
 */
async function checkAndExpirePdoQuotas() {
  try {
    const now = new Date();

    // 1. Check expired PdoRecord batches
    const expiredRecords = await prisma.pdoRecord.findMany({
      where: {
        isExpired: false,
        remainingDays: { gt: 0 },
        expiresAt: { lte: now }
      },
      include: {
        user: { select: { id: true, name: true } }
      }
    });

    const affectedUserIds = new Set();

    for (const record of expiredRecords) {
      const expiredCount = record.remainingDays;
      const expiryFormatted = record.expiresAt 
        ? new Date(record.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'tanggal jatuh tempo';
      const inputFormatted = record.inputDate
        ? new Date(record.inputDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';

      await prisma.pdoRecord.update({
        where: { id: record.id },
        data: {
          isExpired: true,
          remainingDays: 0
        }
      });

      affectedUserIds.add(record.userId);

      // Notification to user
      try {
        await createNotification(
          record.userId,
          `Top-up kuota PDO Anda sebanyak ${expiredCount} hari (input ${inputFormatted}) telah hangus otomatis pada ${expiryFormatted}.`
        );
      } catch (notifErr) {
        console.error('Error creating expiration notification:', notifErr.message);
      }

      console.log(`[PDO Batch Expire] Expired ${expiredCount} days from batch #${record.id} for user ${record.user?.name}`);
    }

    // Re-sync all affected users
    for (const uid of affectedUserIds) {
      await syncUserPdoBalance(uid);
    }

    // 2. Legacy fallback: check User where pdo > 0 and pdoExpiresAt <= now (without unexpired records)
    const legacyExpiredUsers = await prisma.user.findMany({
      where: {
        pdo: { gt: 0 },
        pdoExpiresAt: { lte: now }
      },
      select: {
        id: true,
        name: true,
        pdo: true,
        pdoExpiresAt: true
      }
    });

    for (const user of legacyExpiredUsers) {
      // Check if user has active PdoRecords
      const activeCount = await prisma.pdoRecord.count({
        where: { userId: user.id, isExpired: false, remainingDays: { gt: 0 } }
      });
      if (activeCount === 0) {
        const expiredCount = user.pdo;
        const expiryFormatted = user.pdoExpiresAt 
          ? new Date(user.pdoExpiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
          : 'tanggal jatuh tempo';

        await prisma.user.update({
          where: { id: user.id },
          data: { pdo: 0 }
        });

        try {
          await createNotification(
            user.id,
            `Kuota PDO Anda sebanyak ${expiredCount} hari telah hangus otomatis pada ${expiryFormatted}.`
          );
        } catch (e) {}

        console.log(`[PDO Legacy Expire] Expired ${expiredCount} days for user ${user.name}`);
      }
    }

    return expiredRecords.length;
  } catch (error) {
    console.error('Error in checkAndExpirePdoQuotas:', error.message);
    return 0;
  }
}

module.exports = {
  calculateThreeMonths,
  syncUserPdoBalance,
  topUpUserPdo,
  deductUserPdo,
  deletePdoRecord,
  checkAndExpirePdoQuotas
};
