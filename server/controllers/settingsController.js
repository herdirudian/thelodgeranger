const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getSettings = async (req, res) => {
    try {
        const { group } = req.query;
        const where = group ? { group } : {};
        const settings = await prisma.systemSetting.findMany({ where });
        res.status(200).json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching settings', error: error.message });
    }
};

exports.updateSettings = async (req, res) => {
    try {
        const { settings } = req.body; // Array of { key, value, group }
        
        if (!Array.isArray(settings)) {
            return res.status(400).json({ message: 'Settings must be an array' });
        }

        const updates = settings.map(setting => 
            prisma.systemSetting.upsert({
                where: { key: setting.key },
                update: { value: setting.value, group: setting.group || 'GENERAL' },
                create: { key: setting.key, value: setting.value, group: setting.group || 'GENERAL' }
            })
        );

        await prisma.$transaction(updates);
        res.status(200).json({ message: 'Settings updated successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error updating settings', error: error.message });
    }
};

exports.testWhatsApp = async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ message: 'Phone number is required' });
        }

        const { sendWhatsAppMessage } = require('../services/watzapService');
        const message = `Halo! Ini adalah pesan tes dari sistem Lodge Ranger. Jika Anda menerima ini, berarti integrasi WhatsApp Anda sudah berhasil terhubung.`;
        
        const result = await sendWhatsAppMessage({ to: phone, message });
        res.status(200).json({ message: 'Pesan tes berhasil dikirim!', result });
    } catch (error) {
        console.error("Test WA Error:", error);
        res.status(500).json({ message: 'Gagal mengirim pesan tes: ' + error.message });
    }
};
