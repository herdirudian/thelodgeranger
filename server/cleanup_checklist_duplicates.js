const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
    console.log('Starting cleanup of duplicate checklist templates...');

    // 1. Ambil semua template
    const templates = await prisma.checklistTemplate.findMany({
        include: {
            _count: {
                select: { categories: true }
            }
        }
    });

    // 2. Kelompokkan berdasarkan nama dan departemen
    const groups = {};
    templates.forEach(t => {
        const key = `${t.name}-${t.department}`;
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(t);
    });

    let deletedCount = 0;

    // 3. Iterasi setiap kelompok
    for (const key in groups) {
        const group = groups[key];
        if (group.length > 1) {
            // Urutkan berdasarkan jumlah kategori terbanyak (descending)
            // Jika jumlah kategori sama, pilih yang ID-nya lebih kecil (yang pertama dibuat)
            group.sort((a, b) => {
                if (b._count.categories !== a._count.categories) {
                    return b._count.categories - a._count.categories;
                }
                return a.id - b.id;
            });

            const keep = group[0];
            const toDelete = group.slice(1);

            console.log(`Keeping: "${keep.name}" (ID: ${keep.id}, Categories: ${keep._count.categories})`);
            
            for (const item of toDelete) {
                console.log(`  -> Deleting duplicate: ID ${item.id} (Categories: ${item._count.categories})`);
                await prisma.checklistTemplate.delete({
                    where: { id: item.id }
                });
                deletedCount++;
            }
        }
    }

    console.log(`Cleanup finished. Deleted ${deletedCount} duplicate templates.`);
}

cleanup()
    .then(() => process.exit(0))
    .catch(e => {
        console.error(e);
        process.exit(1);
    });
