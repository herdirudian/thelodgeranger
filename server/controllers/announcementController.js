const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');
const emailService = require('../services/emailService');

exports.createAnnouncement = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (user.role !== 'HR' && user.role !== 'GM') {
      return res.status(403).json({ message: 'Forbidden: Only HR and GM can create announcements' });
    }

    const { title, date, description, targetType, targetIds } = req.body;
    
    let imageUrl = null;
    let pdfUrl = null;

    if (req.files) {
      if (req.files.image) {
        imageUrl = `/uploads/${req.files.image[0].filename}`;
      }
      if (req.files.pdf) {
        pdfUrl = `/uploads/${req.files.pdf[0].filename}`;
      }
    }

    const announcement = await prisma.announcement.create({
      data: {
        title,
        date: new Date(date),
        description,
        imageUrl,
        pdfUrl,
        authorId: userId,
        targetType: targetType || 'ALL',
        targetIds: targetIds || null
      }
    });

    // Send Email Notifications
    try {
        let recipients = [];
        
        if (!targetType || targetType === 'ALL') {
            recipients = await prisma.user.findMany({
                where: { email: { not: null } },
                select: { email: true, name: true }
            });
        } else if (targetType === 'ROLE' && targetIds) {
            let roles = [];
            try {
                roles = JSON.parse(targetIds);
            } catch (e) {
                console.error("Error parsing targetIds for roles:", e);
            }

            if (Array.isArray(roles) && roles.length > 0) {
                recipients = await prisma.user.findMany({
                    where: { 
                        role: { in: roles },
                        email: { not: null }
                    },
                    select: { email: true, name: true }
                });
            }
        } else if (targetType === 'USER' && targetIds) {
            let ids = [];
            try {
                ids = JSON.parse(targetIds);
            } catch (e) {
                console.error("Error parsing targetIds for users:", e);
            }

            if (Array.isArray(ids) && ids.length > 0) {
                // Ensure IDs are integers
                const numericIds = ids.map(id => parseInt(id)).filter(id => !isNaN(id));
                recipients = await prisma.user.findMany({
                    where: { 
                        id: { in: numericIds },
                        email: { not: null }
                    },
                    select: { email: true, name: true }
                });
            }
        }

        if (recipients.length > 0) {
            const emailSubject = `Pengumuman Baru: ${title}`;
            
            // Send emails in parallel
            // We use map to create an array of promises
            recipients.forEach(recipient => {
                if (recipient.email) {
                    const emailHtml = `
                        <div style="font-family: Arial, sans-serif; color: #333;">
                            <h2 style="color: #ea580c;">${title}</h2>
                            <p>Halo <strong>${recipient.name}</strong>,</p>
                            <p>Ada pengumuman baru untuk Anda:</p>
                            <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; border-left: 4px solid #ea580c; margin: 20px 0;">
                                <p style="margin: 0 0 10px 0;"><strong>Tanggal:</strong> ${new Date(date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                <p style="margin: 0 0 10px 0;"><strong>Oleh:</strong> ${user.name} (${user.role})</p>
                                <div style="margin-top: 15px; white-space: pre-wrap;">${description.replace(/\n/g, '<br/>')}</div>
                            </div>
                            <p>Silakan login ke <a href="http://localhost:3000/dashboard" style="color: #ea580c;">The Lodge Ranger Dashboard</a> untuk melihat detail lengkap dan lampiran (jika ada).</p>
                            <br/>
                            <p style="font-size: 12px; color: #666;">Email ini dikirim secara otomatis. Mohon tidak membalas email ini.</p>
                        </div>
                    `;

                    emailService.sendEmail(recipient.email, emailSubject, emailHtml)
                        .catch(err => console.error(`Failed to send email to ${recipient.email}:`, err.message));
                }
            });
        }

    } catch (emailErr) {
        console.error("Error in email notification logic:", emailErr);
        // Don't fail the request if email fails
    }

    res.status(201).json(announcement);
  } catch (error) {
    console.error("Create Announcement Error:", error);
    res.status(500).json({ message: 'Error creating announcement', error: error.message });
  }
};

exports.getAnnouncements = async (req, res) => {
  try {
    const userId = req.userId;
    // We need user details to filter
    let user = null;
    if (userId) {
        user = await prisma.user.findUnique({ where: { id: userId } });
    }

    const announcements = await prisma.announcement.findMany({
      include: {
        author: {
          select: {
            name: true,
            role: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Filter logic
    const filtered = announcements.filter(a => {
        // If no user context (public?), only show ALL?
        // But this endpoint is protected usually. If user not found, maybe return nothing or error.
        if (!user) return false;

        // HR and GM see all announcements (or at least the ones they made + global ones)
        // Actually, HR/GM should probably see everything to manage them.
        if (user.role === 'HR' || user.role === 'GM') return true;

        if (a.targetType === 'ALL') return true;

        if (a.targetType === 'ROLE' && a.targetIds) {
            try {
                const roles = JSON.parse(a.targetIds);
                return Array.isArray(roles) && roles.includes(user.role);
            } catch (e) { return false; }
        }

        if (a.targetType === 'USER' && a.targetIds) {
             try {
                 const ids = JSON.parse(a.targetIds);
                 return Array.isArray(ids) && ids.includes(user.id);
             } catch (e) { return false; }
        }

        return false;
    });

    res.status(200).json(filtered);
  } catch (error) {
    console.error("Get Announcements Error:", error);
    res.status(500).json({ message: 'Error fetching announcements', error: error.message });
  }
};

exports.deleteAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (user.role !== 'HR' && user.role !== 'GM') {
            return res.status(403).json({ message: 'Forbidden: Only HR and GM can delete announcements' });
        }

        const announcement = await prisma.announcement.findUnique({ where: { id: parseInt(id) } });

        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }

        // Optional: Delete files from storage
        if (announcement.imageUrl) {
            const imagePath = path.join(__dirname, '..', announcement.imageUrl);
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
        }
        if (announcement.pdfUrl) {
            const pdfPath = path.join(__dirname, '..', announcement.pdfUrl);
            if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
        }

        await prisma.announcement.delete({ where: { id: parseInt(id) } });

        res.status(200).json({ message: 'Announcement deleted successfully' });
    } catch (error) {
        console.error("Delete Announcement Error:", error);
        res.status(500).json({ message: 'Error deleting announcement', error: error.message });
    }
};

exports.updateAnnouncement = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (user.role !== 'HR' && user.role !== 'GM') {
            return res.status(403).json({ message: 'Forbidden: Only HR and GM can update announcements' });
        }

        const announcement = await prisma.announcement.findUnique({ where: { id: parseInt(id) } });
        if (!announcement) {
            return res.status(404).json({ message: 'Announcement not found' });
        }

        const { title, date, description, targetType, targetIds } = req.body;
        
        let imageUrl = announcement.imageUrl;
        let pdfUrl = announcement.pdfUrl;

        if (req.files) {
            if (req.files.image) {
                // Delete old image if exists
                if (announcement.imageUrl) {
                    const oldImagePath = path.join(__dirname, '..', announcement.imageUrl);
                    if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
                }
                imageUrl = `/uploads/${req.files.image[0].filename}`;
            }
            if (req.files.pdf) {
                // Delete old pdf if exists
                if (announcement.pdfUrl) {
                    const oldPdfPath = path.join(__dirname, '..', announcement.pdfUrl);
                    if (fs.existsSync(oldPdfPath)) fs.unlinkSync(oldPdfPath);
                }
                pdfUrl = `/uploads/${req.files.pdf[0].filename}`;
            }
        }

        const updatedAnnouncement = await prisma.announcement.update({
            where: { id: parseInt(id) },
            data: {
                title,
                date: new Date(date),
                description,
                imageUrl,
                pdfUrl,
                targetType: targetType || 'ALL',
                targetIds: targetIds || null
            }
        });

        res.status(200).json(updatedAnnouncement);
    } catch (error) {
        console.error("Update Announcement Error:", error);
        res.status(500).json({ message: 'Error updating announcement', error: error.message });
    }
};
