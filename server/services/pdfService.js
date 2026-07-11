const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { format } = require('date-fns');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const {
  formatWibPrintStamp,
  formatWibLongDate,
  formatWibTimeHms,
  formatWibTime
} = require('../utils/wibDate');

// Helper to sanitize text for PDF (WinAnsi encoding)
const cleanText = (text) => {
    if (text == null) return '';
    return String(text)
        .replace(/[\u200B-\u200D\uFEFF\u2060]/g, '') // Remove zero-width spaces/joiners
        .replace(/[^\x20-\x7E\xA0-\xFF\n\r]/g, '') // Keep only printable ASCII and basic Latin-1 (WinAnsi approx)
        .trim();
};

exports.generateRequestPDF = async (request, attendanceInfo = null) => {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 50;
  let y = height - margin;

  // Colors
  const black = rgb(0, 0, 0);
  const darkGreen = rgb(0.06, 0.3, 0.22); // The Lodge Green
  const blue = rgb(0, 0.2, 0.6);
  const gray = rgb(0.5, 0.5, 0.5);
  const lightGray = rgb(0.95, 0.95, 0.95);

  // --- Header Section ---
  try {
      const logoPath = path.join(__dirname, '../assets/logo.png');
      if (fs.existsSync(logoPath)) {
          const logoImageBytes = fs.readFileSync(logoPath);
          const logoImage = await pdfDoc.embedPng(logoImageBytes);
          
          // Use a fixed height for the logo to ensure consistency, scale width accordingly
          const targetHeight = 50; 
          const scaleFactor = targetHeight / logoImage.height;
          const scaledDims = logoImage.scale(scaleFactor);

          // Position logo at top-left
          page.drawImage(logoImage, {
              x: margin,
              y: height - margin - targetHeight, 
              width: scaledDims.width,
              height: scaledDims.height,
          });
      }
  } catch (e) {
      console.error("Logo embedding failed:", e);
  }

  y -= 20; // Ensure enough spacing below header elements

  // Title Right/Center aligned effectively
  const titleX = margin + 120;
  let titleY = height - margin - 10;
  
  titleY -= 15;
  page.drawText('Detail Cuti / Izin / Sakit', { x: titleX, y: titleY, size: 16, font: boldFont, color: black });
  titleY -= 15;
  page.drawText(`Dicetak: ${format(new Date(), 'dd/MM/yyyy, HH.mm.ss')}`, { x: titleX, y: titleY, size: 10, font: font, color: gray });

  y -= 40; // Spacing after header

  // --- Summary Line ---
  const typeMap = {
      'LEAVE': 'Cuti',
      'PERMIT': 'Izin',
      'SICK': 'Sakit',
      'OVERTIME': 'Lembur',
      'CHANGE_SHIFT': 'Tukar Shift',
      'RESIGNATION': 'Resign',
      'LEAVE_WORKPLACE': 'Izin Meninggalkan Tempat Kerja'
  };
  
  const statusMap = {
      'PENDING_HOD': 'Menunggu HOD',
      'PENDING_HR': 'Menunggu HRD',
      'PENDING_GM': 'Menunggu GM',
      'APPROVED': 'Disetujui',
      'REJECTED': 'Ditolak',
      'CANCELED': 'Dibatalkan'
  };

  const reqType = typeMap[request.type] || request.type;
  const reqStatus = statusMap[request.status] || request.status;
  const startDate = format(new Date(request.startDate), 'yyyy-MM-dd');
  const endDate = request.endDate ? format(new Date(request.endDate), 'yyyy-MM-dd') : startDate;

  const summaryText = `Detail Request — ID: ${request.id}; Jenis: ${reqType}; Status: ${reqStatus}; Mulai: ${startDate}; Selesai: ${endDate}`;
  
  // Wrap text if too long (simple wrap)
  page.drawText(cleanText(summaryText), { x: margin, y, size: 10, font: boldFont, color: black, maxWidth: width - (margin * 2) });
  y -= 20;

  // --- Helper: Draw Table ---
  const drawTable = (headers, data, colWidths) => {
      const rowHeight = 20;
      const headerHeight = 25;
      
      // Draw Header
      page.drawRectangle({
          x: margin,
          y: y - headerHeight,
          width: width - (margin * 2),
          height: headerHeight,
          color: rgb(1, 1, 1), // White bg
          borderColor: gray,
          borderWidth: 0.5,
      });

      // Header Text & Vertical Lines
      let currentX = margin;
      headers.forEach((header, i) => {
          page.drawText(cleanText(header), {
              x: currentX + 5,
              y: y - headerHeight + 8,
              size: 9,
              font: boldFont,
              color: black
          });
          currentX += colWidths[i];
      });
      
      y -= headerHeight;

      // Draw Data
      data.forEach((row) => {
          // Row Border
          page.drawRectangle({
              x: margin,
              y: y - rowHeight,
              width: width - (margin * 2),
              height: rowHeight,
              borderColor: gray,
              borderWidth: 0.5,
          });

          let rowX = margin;
          row.forEach((text, i) => {
              page.drawText(cleanText(text || ''), {
                  x: rowX + 5,
                  y: y - rowHeight + 6,
                  size: 9,
                  font: font,
                  color: black
              });
              
              // Vertical Divider
              if (i < row.length - 1) {
                  page.drawLine({
                      start: { x: rowX + colWidths[i], y: y },
                      end: { x: rowX + colWidths[i], y: y - rowHeight },
                      thickness: 0.5,
                      color: gray
                  });
              }
              
              rowX += colWidths[i];
          });
          y -= rowHeight;
      });
      
      y -= 15; // Spacing after table
  };

  // --- Table 1: General Info ---
  const colWidths1 = [150, 345]; // Total ~495
  const table1Data = [
      ['ID', request.id],
      ['Requester', request.user.name],
      ['Departemen', request.user.department || '-'],
      ['Jenis', reqType],
      ['Mulai', startDate],
      ['Selesai', endDate],
      ['Status', reqStatus],
      ['Dibuat', format(new Date(request.createdAt), 'yyyy-MM-dd HH:mm:ss')]
  ];
  
  drawTable(['Field', 'Detail'], table1Data, colWidths1);

  // --- Table 2: Rincian Form ---
  page.drawText('Rincian Form', { x: margin, y, size: 11, font: boldFont });
  y -= 15;

  const table2Data = [];
  if (request.startTime) table2Data.push(['Jam Mulai', request.startTime]);
  if (request.endTime) table2Data.push(['Jam Selesai', request.endTime]);

  if (request.type === 'OVERTIME') {
      if (attendanceInfo) {
           const checkInStr = attendanceInfo.checkIn ? formatWibTime(attendanceInfo.checkIn) : '-';
           const checkOutStr = attendanceInfo.checkOut ? formatWibTime(attendanceInfo.checkOut) : '-';
           table2Data.push(['Jam Check-In (Log)', checkInStr]);
           table2Data.push(['Jam Check-Out (Log)', checkOutStr]);
      } else {
           table2Data.push(['Jam Check-In (Log)', '-']);
           table2Data.push(['Jam Check-Out (Log)', '-']);
      }
      
      if (request.quantity) {
          table2Data.push(['Total Jam Lembur', `${request.quantity} Jam`]);
      }

      if (request.startTime && request.endTime) {
          const [h1, m1] = request.startTime.split(':').map(Number);
          const [h2, m2] = request.endTime.split(':').map(Number);
          let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
          if (diff < 0) diff += 1440; 
          const hours = Math.floor(diff / 60);
          const mins = diff % 60;
          // Only show calculation if quantity is not present, or maybe show as "Rentang Waktu"
          if (!request.quantity) {
              table2Data.push(['Total Durasi Lembur', `${hours} Jam ${mins > 0 ? mins + ' Menit' : ''}`]);
          } else {
             // Optional: Show calculated duration as reference? Maybe not needed if user inputs it.
             // But let's keep it simple. If quantity is there, it's the official request.
          }
      }
  }

  table2Data.push(['Alasan', request.reason]);
  if (request.replacementName) table2Data.push(['Pengganti', request.replacementName]);
  if (request.newEmployeeName) table2Data.push(['Karyawan Baru', request.newEmployeeName]);
  if (request.returnDate) table2Data.push(['Tanggal Kembali', format(new Date(request.returnDate), 'yyyy-MM-dd')]);

  drawTable(['Field', 'Detail'], table2Data, colWidths1);

  // --- Table 3: Riwayat Approval ---
  page.drawText('Riwayat Approval', { x: margin, y, size: 11, font: boldFont });
  y -= 15;

  const historyData = [];
  // 1. Created
  historyData.push([
      format(new Date(request.createdAt), 'yyyy-MM-dd HH:mm:ss'),
      'Draft / Submitted',
      request.user.name,
      'Pengajuan dibuat'
  ]);

  // 2. Approvals
  if (request.hodApproved) {
      historyData.push([
         format(new Date(request.updatedAt), 'yyyy-MM-dd HH:mm'), // Approx date
         'Approve',
         'Head of Dept',
         '-'
      ]);
  }

  if (request.spvApproved) {
      historyData.push([
         format(new Date(request.updatedAt), 'yyyy-MM-dd HH:mm'),
         'Approve',
         'Supervisor Operational',
         '-'
      ]);
  }
  
  if (request.hrApproved) {
      historyData.push([
         format(new Date(request.updatedAt), 'yyyy-MM-dd HH:mm'),
         'Approve',
         'HR Manager',
         '-'
      ]);
  }
  
  if (request.gmApproved) {
      historyData.push([
         format(new Date(request.updatedAt), 'yyyy-MM-dd HH:mm'),
         'Approve',
         'General Manager',
         '-'
      ]);
  }

  if (request.status === 'REJECTED') {
      historyData.push([
         format(new Date(request.updatedAt), 'yyyy-MM-dd HH:mm'),
         'Reject',
         'Reviewer',
         request.rejectionReason || 'Tidak sesuai'
      ]);
  }

  const colWidthsHistory = [120, 100, 120, 155];
  drawTable(['Tanggal', 'Aksi', 'Oleh', 'Catatan'], historyData, colWidthsHistory);

  y -= 20;

  // --- Signatures ---
  const sigY = y - 40;
  
  // Supervisor (HOD)
  page.drawText('Supervisor', { x: margin + 40, y: sigY + 40, size: 11, font: boldFont });
  page.drawLine({ start: { x: margin, y: sigY }, end: { x: margin + 150, y: sigY }, thickness: 1, color: black });
  
  if (request.hodApproved) {
       page.drawText('Disetujui', { x: margin + 45, y: sigY - 20, size: 10, font: font, color: rgb(0, 0.5, 0) });
       // Draw box around "Disetujui"
       page.drawRectangle({ x: margin + 40, y: sigY - 25, width: 70, height: 20, borderColor: rgb(0, 0.5, 0), borderWidth: 1 });
  } else if (request.status === 'PENDING_HOD') {
      page.drawText('Menunggu', { x: margin + 45, y: sigY - 20, size: 10, font: font, color: rgb(0.5, 0.5, 0) });
  }

  // HRD
  page.drawText('HRD', { x: width - margin - 100, y: sigY + 40, size: 11, font: boldFont });
  page.drawLine({ start: { x: width - margin - 150, y: sigY }, end: { x: width - margin, y: sigY }, thickness: 1, color: black });

  if (request.hrApproved) {
       page.drawText('Disetujui', { x: width - margin - 100, y: sigY - 20, size: 10, font: font, color: rgb(0, 0.5, 0) });
       page.drawRectangle({ x: width - margin - 105, y: sigY - 25, width: 70, height: 20, borderColor: rgb(0, 0.5, 0), borderWidth: 1 });
  }

  // GM
  if (request.gmApproved || request.status === 'PENDING_GM') {
      const gmX = width / 2 - 75;
      const gmY = sigY - 80;
      page.drawText('General Manager', { x: width / 2 - 40, y: gmY + 40, size: 11, font: boldFont });
      page.drawLine({ start: { x: gmX, y: gmY }, end: { x: gmX + 150, y: gmY }, thickness: 1, color: black });
      
      if (request.gmApproved) {
           page.drawText('Disetujui', { x: width / 2 - 25, y: gmY - 20, size: 10, font: font, color: rgb(0, 0.5, 0) });
           page.drawRectangle({ x: width / 2 - 30, y: gmY - 25, width: 70, height: 20, borderColor: rgb(0, 0.5, 0), borderWidth: 1 });
      }
  }

  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
};

const isChecklistSignatureQuestion = (questionText) => {
    const lowerQuestion = String(questionText || '').toLowerCase();
    return lowerQuestion.includes('signature') || lowerQuestion.includes('tanda tangan');
};

const normalizeChecklistImage = async (imageBytes, sourceHint = '') => {
    const lowerHint = String(sourceHint || '').toLowerCase();
    
    // Resize and compress for PDF to save space and memory
    // Max 400px width/height is enough for small table images
    const compressed = await sharp(imageBytes)
        .rotate()
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 60, mozjpeg: true })
        .toBuffer();

    return { bytes: compressed, type: 'jpg' };
};

const readChecklistImageBytes = async (photoUrl) => {
    if (!photoUrl) return null;

    const source = String(photoUrl);
    if (source.startsWith('http://') || source.startsWith('https://')) {
        const response = await axios.get(source, { responseType: 'arraybuffer', timeout: 15000 });
        return Buffer.from(response.data);
    }

    const rawName = source.split('?')[0].split('/').pop() || '';
    const safeFileName = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '');
    if (!safeFileName || safeFileName.includes('..')) {
        return null;
    }

    const localPath = path.join(__dirname, '../uploads', safeFileName);
    if (!fs.existsSync(localPath)) {
        return null;
    }

    return fs.readFileSync(localPath);
};

exports.generateChecklistExportPDF = async (submissions, options = {}) => {
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageSize = [595.28, 841.89];
    const margin = 36;
    const lineGap = 4;
    let page;
    let width;
    let height;
    let y;

    const addPage = () => {
        page = pdfDoc.addPage(pageSize);
        ({ width, height } = page.getSize());
        y = height - margin;
    };

    const ensureSpace = (requiredHeight = 40) => {
        if (!page || y - requiredHeight < margin) {
            addPage();
        }
    };

    const wrapText = (text, maxWidth, activeFont, size) => {
        const safeText = cleanText(text || '');
        if (!safeText) return ['-'];

        const paragraphs = safeText.split(/\r?\n/);
        const lines = [];

        paragraphs.forEach(paragraph => {
            const words = paragraph.split(/\s+/).filter(Boolean);
            if (words.length === 0) {
                lines.push('');
                return;
            }

            let currentLine = words[0];
            for (let i = 1; i < words.length; i += 1) {
                const testLine = `${currentLine} ${words[i]}`;
                if (activeFont.widthOfTextAtSize(testLine, size) <= maxWidth) {
                    currentLine = testLine;
                } else {
                    lines.push(currentLine);
                    currentLine = words[i];
                }
            }
            lines.push(currentLine);
        });

        return lines.length > 0 ? lines : ['-'];
    };

    const drawWrappedText = (text, x, maxWidth, size = 10, activeFont = font, color = rgb(0, 0, 0)) => {
        const lines = wrapText(text, maxWidth, activeFont, size);
        lines.forEach(line => {
            ensureSpace(size + 6);
            page.drawText(line, { x, y, size, font: activeFont, color });
            y -= size + lineGap;
        });
        return lines;
    };

    const embedChecklistImage = async (photoUrl) => {
        try {
            const imageBytes = await readChecklistImageBytes(photoUrl);
            if (!imageBytes) return null;
            const normalized = await normalizeChecklistImage(imageBytes, photoUrl);

            if (normalized.type === 'png') {
                return pdfDoc.embedPng(normalized.bytes);
            }

            return pdfDoc.embedJpg(normalized.bytes);
        } catch (error) {
            console.error('Checklist export image error:', error);
            return null;
        }
    };

    const drawHeader = () => {
        ensureSpace(90);
        page.drawText('Daily Checklist Export', {
            x: margin,
            y,
            size: 18,
            font: boldFont,
            color: rgb(0.06, 0.3, 0.22)
        });
        y -= 22;

        const scopeLabel = options.scope === 'daily' ? 'Export Semua Checklist Harian' : 'Export Riwayat / Approval Checklist';
        page.drawText(cleanText(scopeLabel), {
            x: margin,
            y,
            size: 11,
            font,
            color: rgb(0.35, 0.35, 0.35)
        });
        y -= 16;

        page.drawText(`Tanggal Export: ${cleanText(options.exportDate || format(new Date(), 'yyyy-MM-dd'))}`, {
            x: margin,
            y,
            size: 10,
            font,
            color: rgb(0.35, 0.35, 0.35)
        });
        y -= 14;

        page.drawText(`Total Submission: ${submissions.length}`, {
            x: margin,
            y,
            size: 10,
            font,
            color: rgb(0.35, 0.35, 0.35)
        });
        y -= 24;
    };

    addPage();
    drawHeader();

    for (const [submissionIndex, submission] of submissions.entries()) {
        ensureSpace(120);

        page.drawRectangle({
            x: margin,
            y: y - 28,
            width: width - (margin * 2),
            height: 28,
            color: rgb(0.06, 0.3, 0.22)
        });
        page.drawText(cleanText(`${submissionIndex + 1}. ${submission.template.name}`), {
            x: margin + 10,
            y: y - 18,
            size: 12,
            font: boldFont,
            color: rgb(1, 1, 1)
        });
        y -= 42;

        const metaLines = [
            `Departemen: ${submission.template.department}`,
            `Tanggal: ${format(new Date(submission.date), 'dd MMM yyyy')}`,
            `Staff: ${submission.user.name}`,
            `Status: ${submission.status}`,
            `Approval: STAFF=Submitted | SPV=${submission.spvSigned ? 'Signed' : 'Pending'} | GM=${submission.gmSigned ? 'Signed' : 'Pending'}`
        ];

        metaLines.forEach(line => {
            drawWrappedText(line, margin, width - (margin * 2), 10, font, rgb(0.25, 0.25, 0.25));
        });

        const answerMap = new Map((submission.answers || []).map(answer => [answer.questionId, answer]));
        const orderedCategories = (submission.template.categories || [])
            .sort((a, b) => a.order - b.order)
            .map(category => ({
                ...category,
                questions: (category.questions || [])
                    .sort((a, b) => a.order - b.order)
                    .filter(question => !isChecklistSignatureQuestion(question.question))
            }))
            .filter(category => category.questions.some(question => answerMap.has(question.id)));

        for (const category of orderedCategories) {
            ensureSpace(50);
            page.drawRectangle({
                x: margin,
                y: y - 20,
                width: width - (margin * 2),
                height: 20,
                color: rgb(0.94, 0.96, 0.95)
            });
            page.drawText(cleanText(category.name.toUpperCase()), {
                x: margin + 8,
                y: y - 13,
                size: 10,
                font: boldFont,
                color: rgb(0.06, 0.3, 0.22)
            });
            y -= 30;

            // Table Header
            const colWidths = [30, 200, 60, 100, 90];
            const colStarts = [margin, margin + 35, margin + 240, margin + 305, margin + 410];
            
            page.drawText('No', { x: colStarts[0], y, size: 9, font: boldFont });
            page.drawText('Pertanyaan', { x: colStarts[1], y, size: 9, font: boldFont });
            page.drawText('Jawaban', { x: colStarts[2], y, size: 9, font: boldFont });
            page.drawText('Catatan', { x: colStarts[3], y, size: 9, font: boldFont });
            page.drawText('Foto Bukti', { x: colStarts[4], y, size: 9, font: boldFont });
            y -= 12;
            page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
            y -= 15;

            let qIndex = 1;
            for (const question of category.questions) {
                const answer = answerMap.get(question.id);
                 if (!answer) continue;
 
                 const val = answer.value;
                 const displayVal = (val === 'true' || val === true) ? 'Yes' : ((val === 'false' || val === false) ? 'No' : (val || '-'));
                 const remarks = answer.remarks || '-';
                
                const qLines = wrapText(question.question, colWidths[1] - 5, font, 9);
                const rLines = wrapText(remarks, colWidths[3] - 5, font, 9);
                
                let maxContentHeight = Math.max(qLines.length * 11, rLines.length * 11, 20);
                
                let image = null;
                let dims = null;
                if (answer.photoUrl) {
                     image = await embedChecklistImage(answer.photoUrl);
                     if (image) {
                         // Increased height limit for portrait view (from 60 to 100)
                         const scale = Math.min(80 / image.width, 100 / image.height, 1);
                         dims = image.scale(scale);
                         maxContentHeight = Math.max(maxContentHeight, dims.height + 5);
                     }
                 }

                ensureSpace(maxContentHeight + 15);
                const rowTopY = y;

                page.drawText(String(qIndex++), { x: colStarts[0], y: rowTopY - 10, size: 9, font });
                
                qLines.forEach((line, i) => {
                    page.drawText(line, { x: colStarts[1], y: rowTopY - 10 - (i * 11), size: 9, font });
                });

                page.drawText(cleanText(displayVal), { x: colStarts[2], y: rowTopY - 10, size: 9, font });

                rLines.forEach((line, i) => {
                    page.drawText(line, { x: colStarts[3], y: rowTopY - 10 - (i * 11), size: 9, font });
                });

                if (image && dims) {
                    page.drawImage(image, {
                        x: colStarts[4],
                        y: rowTopY - 10 - dims.height,
                        width: dims.width,
                        height: dims.height
                    });
                } else {
                    page.drawText(answer.photoUrl ? '(Error Photo)' : '-', { x: colStarts[4], y: rowTopY - 10, size: 9, font });
                }

                y -= maxContentHeight + 5;
                page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
                y -= 10;
            }
            y -= 10;
        }

        if (submission.notes) {
            ensureSpace(60);
            page.drawText('Kesimpulan / Notes', {
                x: margin,
                y,
                size: 10,
                font: boldFont,
                color: rgb(0.06, 0.3, 0.22)
            });
            y -= 16;
            drawWrappedText(submission.notes, margin, width - (margin * 2), 10, font);
        }

        if (submission.photoUrl) {
            ensureSpace(40);
            page.drawText('Foto Bukti Submission', {
                x: margin,
                y,
                size: 10,
                font: boldFont,
                color: rgb(0.06, 0.3, 0.22)
            });
            y -= 16;
 
            const submissionImage = await embedChecklistImage(submission.photoUrl);
            if (submissionImage) {
                // Increased height limit for portrait view (from 120 to 250)
                const maxWidth = 200;
                const maxHeight = 250;
                const scale = Math.min(maxWidth / submissionImage.width, maxHeight / submissionImage.height, 1);
                const dims = submissionImage.scale(scale);
                ensureSpace(dims.height + 10);
                page.drawImage(submissionImage, {
                    x: margin,
                    y: y - dims.height,
                    width: dims.width,
                    height: dims.height
                });
                y -= dims.height + 8;
            }
        }

        y -= 10;
        ensureSpace(18);
        page.drawLine({
            start: { x: margin, y },
            end: { x: width - margin, y },
            thickness: 1,
            color: rgb(0.86, 0.88, 0.87)
        });
        y -= 20;
    }

    return pdfDoc.save();
};

exports.generateMonthlySchedulePDF = async (schedule, staffList) => {
    console.log("Generating Schedule PDF...", { 
        id: schedule?.id, 
        month: schedule?.month, 
        year: schedule?.year,
        dataLength: schedule?.data?.length,
        staffCount: staffList?.length
    });

    try {
        const pdfDoc = await PDFDocument.create();
        // Landscape A4
        let currentPage = pdfDoc.addPage([841.89, 595.28]); 
        const { width, height } = currentPage.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
        const margin = 30;
        let y = height - margin;
      
        // Colors
        const black = rgb(0, 0, 0);
        const gray = rgb(0.5, 0.5, 0.5);
        const paletteColors = [
            rgb(0.9, 0.97, 0.9),
            rgb(0.9, 0.95, 1),
            rgb(1, 0.95, 0.9),
            rgb(0.95, 0.9, 1),
            rgb(0.9, 0.98, 0.96),
            rgb(1, 0.93, 0.95),
            rgb(1, 0.97, 0.9),
            rgb(0.95, 1, 0.9),
            rgb(0.93, 0.95, 1),
            rgb(0.9, 1, 1),
        ];
        const locationColorMap = {};
        const getLocationColor = (name) => {
            const key = String(name || '').trim().toLowerCase();
            if (!key) return null;
            if (locationColorMap[key]) return locationColorMap[key];
            const idx = Object.keys(locationColorMap).length % paletteColors.length;
            const color = paletteColors[idx];
            locationColorMap[key] = color;
            return color;
        };
      
        // --- Header ---
        const drawHeader = async (pageToDraw, currentY) => {
            try {
                const logoPath = path.join(__dirname, '../assets/logo.png');
                if (fs.existsSync(logoPath)) {
                    const logoImageBytes = fs.readFileSync(logoPath);
                    const logoImage = await pdfDoc.embedPng(logoImageBytes);
                    const targetHeight = 40; 
                    const scaleFactor = targetHeight / logoImage.height;
                    const scaledDims = logoImage.scale(scaleFactor);
          
                    pageToDraw.drawImage(logoImage, {
                        x: margin,
                        y: height - margin - targetHeight, 
                        width: scaledDims.width,
                        height: scaledDims.height,
                    });
                }
            } catch (e) {
                console.error("Logo embedding failed:", e);
            }
        
            let headerY = height - margin - 50;
            
            // Title
            const monthName = format(new Date(schedule.year, schedule.month - 1), 'MMMM yyyy');
            pageToDraw.drawText(cleanText(`Jadwal Kerja Departemen: ${schedule.department}`), { x: margin, y: headerY, size: 14, font: boldFont });
            headerY -= 15;
            pageToDraw.drawText(cleanText(`Periode: ${monthName}`), { x: margin, y: headerY, size: 12, font: font });
            headerY -= 15;
            pageToDraw.drawText(cleanText(`Status: ${schedule.status}`), { x: margin, y: headerY, size: 10, font: font, color: gray });
            
            return headerY - 20;
        };

        y = await drawHeader(currentPage, y);
    
        // --- Grid Table ---
        // Calculate Date Range: 21st (Prev) to 20th (Curr)
        const dates = [];
        const prevMonthDate = new Date(schedule.year, schedule.month - 2, 21);
        const currentMonthDate = new Date(schedule.year, schedule.month - 1, 20);
        
        let loopDate = new Date(prevMonthDate);
        while (loopDate <= currentMonthDate) {
            dates.push(new Date(loopDate));
            loopDate.setDate(loopDate.getDate() + 1);
        }
    
        const colWidthName = 100;
        const summaryWidth = 100;
        const colWidthDay = (width - (margin * 2) - colWidthName - summaryWidth) / dates.length;
        
        const rowHeight = 24; // Increased from 15 to fit multiple lines (Shift, Time, Location)
        const headerHeight = 25;

        const drawTableHeader = (pageToDraw, currentY) => {
            // Header Background
            pageToDraw.drawRectangle({
                x: margin,
                y: currentY - headerHeight,
                width: width - (margin * 2),
                height: headerHeight,
                color: rgb(0.9, 0.9, 0.9),
                borderColor: black,
                borderWidth: 0.5
            });
        
            // Header: Staff Name
            pageToDraw.drawText("Nama Staff", { x: margin + 5, y: currentY - headerHeight + 8, size: 8, font: boldFont });
            
            // Header: Dates
            dates.forEach((date, i) => {
                const xPos = margin + colWidthName + (i * colWidthDay);
                const dayStr = format(date, 'd');
                const dayName = format(date, 'EEE').toUpperCase();
                
                const isRed = date.getDay() === 0 || date.getDay() === 6; 
                const textColor = isRed ? rgb(1, 0, 0) : black;
                const bgColor = isRed ? rgb(1, 0.9, 0.9) : null;
        
                if (bgColor) {
                     pageToDraw.drawRectangle({
                        x: xPos,
                        y: currentY - headerHeight,
                        width: colWidthDay,
                        height: headerHeight,
                        color: bgColor,
                     });
                }
        
                pageToDraw.drawText(dayStr, { x: xPos + 2, y: currentY - headerHeight + 12, size: 7, font: boldFont, color: textColor });
                pageToDraw.drawText(dayName, { x: xPos + 2, y: currentY - headerHeight + 4, size: 5, font: font, color: textColor });
        
                pageToDraw.drawLine({
                     start: { x: xPos, y: currentY },
                     end: { x: xPos, y: currentY - headerHeight },
                     thickness: 0.5,
                     color: gray
                });
            });
        
            // Header: Summary
            const summaryStart = width - margin - summaryWidth;
            const summaryCols = ['M', 'OFF', 'C', 'S', 'I'];
            const subColWidth = summaryWidth / summaryCols.length;
        
            pageToDraw.drawLine({
                start: { x: summaryStart, y: currentY },
                end: { x: summaryStart, y: currentY - headerHeight },
                thickness: 0.5,
                color: gray
            });
        
            summaryCols.forEach((col, i) => {
                const xPos = summaryStart + (i * subColWidth);
                pageToDraw.drawText(col, { x: xPos + 5, y: currentY - headerHeight + 8, size: 7, font: boldFont, color: black });
                if (i > 0) {
                    pageToDraw.drawLine({
                        start: { x: xPos, y: currentY },
                        end: { x: xPos, y: currentY - headerHeight },
                        thickness: 0.5,
                        color: gray
                    });
                }
            });
            
            return currentY - headerHeight;
        };

        y = drawTableHeader(currentPage, y);
    
        // Data
        let parsedData = [];
        try {
            parsedData = typeof schedule.data === 'string' ? JSON.parse(schedule.data) : (schedule.data || []);
        } catch (e) {
            console.error("Failed to parse schedule data", e);
            parsedData = [];
        }

        if (!Array.isArray(staffList)) {
            console.warn("staffList is not an array", staffList);
            staffList = [];
        }
        
        const summaryCols = ['M', 'OFF', 'C', 'S', 'I'];
        const summaryStart = width - margin - summaryWidth;
        const subColWidth = summaryWidth / summaryCols.length;
    
        for (const staff of staffList) {
            let staffShifts = {};
            let staffLocations = {};
            let staffManualTimes = {};

            if (Array.isArray(parsedData)) {
                // Legacy / Submitted Format (Array of objects)
                const staffEntry = parsedData.find(s => parseInt(s.userId) === staff.id) || {};
                staffShifts = staffEntry.shifts || {};
                staffLocations = staffEntry.locations || {};
                staffManualTimes = staffEntry.manualTimes || {};
            } else if (parsedData && parsedData.scheduleData) {
                // Draft / New Object Format
                staffShifts = parsedData.scheduleData[staff.id] || {};
                staffLocations = parsedData.inchargePerDay?.[staff.id] || {};
                staffManualTimes = parsedData.manualTimePerDay?.[staff.id] 
                    || parsedData.manualTimes?.[staff.id] 
                    || {};
            }
    
            // New Page Check BEFORE drawing the row
            if (y < margin + 60) {
                 currentPage = pdfDoc.addPage([841.89, 595.28]);
                 y = height - margin;
                 y = await drawHeader(currentPage, y);
                 y = drawTableHeader(currentPage, y);
            }

            // Row Border
            currentPage.drawRectangle({
                x: margin,
                y: y - rowHeight,
                width: width - (margin * 2),
                height: rowHeight,
                borderColor: gray,
                borderWidth: 0.5
            });
    
            // Name
            let staffName = staff.name || 'Unknown';
            if (staffName.length > 20) staffName = staffName.substring(0, 18) + '...';
            currentPage.drawText(cleanText(staffName), { x: margin + 5, y: y - rowHeight + 4, size: 8, font: font });

            // Calculate Summary
            const counts = { M: 0, OFF: 0, C: 0, S: 0, I: 0 };
    
            // Shifts
            dates.forEach((date, i) => {
                 const dateStr = format(date, 'yyyy-MM-dd');
                 const xPos = margin + colWidthName + (i * colWidthDay);
                 
                 const shiftCode = staffShifts[dateStr] || staffShifts[date.getDate().toString()] || '';
                 const manualTime = staffManualTimes[dateStr] || staffManualTimes[date.getDate().toString()] || '';
                 const locationName = staffLocations[dateStr] || staffLocations[date.getDate().toString()] || '';
    
                 // Count summary
                 if (
                    shiftCode &&
                    (shiftCode.startsWith('M') ||
                      shiftCode.startsWith('A') ||
                      shiftCode.startsWith('N') ||
                      shiftCode === 'E' ||
                      shiftCode === 'PDO')
                  ) {
                    counts.M++;
                  }
                 else if (shiftCode === 'OFF') counts.OFF++;
                 else if (shiftCode === 'C') counts.C++;
                 else if (shiftCode === 'S') counts.S++;
                 else if (shiftCode === 'I') counts.I++; 
    
                 // Draw Location Background
                 const locColor = getLocationColor(locationName);
                 if (locColor) {
                    currentPage.drawRectangle({
                        x: xPos,
                        y: y - rowHeight,
                        width: colWidthDay,
                        height: rowHeight,
                        color: locColor,
                    });
                 }
    
                 // Draw Shift Code
                 if (shiftCode) {
                     const color = shiftCode === 'OFF' ? rgb(1, 0, 0) : black;
                     const textWidth = font.widthOfTextAtSize(shiftCode, 8); // Size 8
                     
                     // Determine vertical position:
                     // If crowded (Time or Loc exists), move Shift up. Else center it.
                     const hasOtherData = manualTime || locationName;
                     const shiftY = hasOtherData ? (y - 10) : (y - 15);

                     currentPage.drawText(cleanText(shiftCode), { 
                         x: xPos + (colWidthDay - textWidth) / 2, 
                         y: shiftY, 
                         size: 8, 
                         font: boldFont,
                         color 
                     });
    
                     if (manualTime) {
                         const timeWidth = font.widthOfTextAtSize(manualTime, 5);
                         currentPage.drawText(cleanText(manualTime), {
                             x: xPos + (colWidthDay - timeWidth) / 2,
                             y: y - 16, // Middle-low
                             size: 5,
                             font: font,
                             color
                         });
                     }
                 }
                 
                 if (locationName) {
                    const locText = String(locationName).length > 9 ? String(locationName).slice(0, 9) + '…' : String(locationName);
                    currentPage.drawText(cleanText(locText), { x: xPos + 2, y: y - 22, size: 5, font: font, color: black });
                 }
    
                 currentPage.drawLine({
                    start: { x: xPos, y: y },
                    end: { x: xPos, y: y - rowHeight },
                    thickness: 0.5,
                    color: gray
               });
            });
    
            // Draw Summary Data
            currentPage.drawLine({
                start: { x: summaryStart, y: y },
                end: { x: summaryStart, y: y - rowHeight },
                thickness: 0.5,
                color: gray
            });
    
            summaryCols.forEach((col, i) => {
                const xPos = summaryStart + (i * subColWidth);
                const countVal = counts[col] || 0;
                const textWidth = font.widthOfTextAtSize(String(countVal), 8);
                
                currentPage.drawText(String(countVal), {
                    x: xPos + (subColWidth - textWidth) / 2, 
                    y: y - rowHeight + 4, 
                    size: 8, 
                    font: font, 
                    color: black 
                });
    
                if (i > 0) {
                    currentPage.drawLine({
                        start: { x: xPos, y: y },
                        end: { x: xPos, y: y - rowHeight },
                        thickness: 0.5,
                        color: gray
                    });
                }
            });
    
            y -= rowHeight;
        }
    
        // Signatures
        // Check if there's enough space for signatures, otherwise new page
        if (y < margin + 80) {
            currentPage = pdfDoc.addPage([841.89, 595.28]);
            y = height - margin;
            y = await drawHeader(currentPage, y);
        }

        y -= 40;
        
        // Created By
        const creatorName = schedule.createdByUser?.name || "HOD";
        currentPage.drawText("Dibuat Oleh (HOD)", { x: margin, y, size: 10, font: boldFont });
        currentPage.drawLine({ start: { x: margin, y: y - 20 }, end: { x: margin + 150, y: y - 20 }, thickness: 1, color: black });
        if (schedule.hodApproved) {
            currentPage.drawText("Signed/Approved", { x: margin, y: y - 10, size: 10, font: font, color: rgb(0, 0.5, 0) });
        }
        currentPage.drawText(`( ${cleanText(creatorName)} )`, { x: margin, y: y - 35, size: 10, font: font });
    
        // HR
        const hrX = width / 2 - 50;
        currentPage.drawText("Diperiksa Oleh (HR)", { x: hrX, y, size: 10, font: boldFont });
        currentPage.drawLine({ start: { x: hrX, y: y - 20 }, end: { x: hrX + 150, y: y - 20 }, thickness: 1, color: black });
        if (schedule.hrApproved) {
            currentPage.drawText("Signed/Approved", { x: hrX, y: y - 10, size: 10, font: font, color: rgb(0, 0.5, 0) });
        }
        currentPage.drawText("( HR Manager )", { x: hrX, y: y - 35, size: 10, font: font });
    
        // GM
        const gmX = width - margin - 150;
        currentPage.drawText("Disetujui Oleh (GM)", { x: gmX, y, size: 10, font: boldFont });
        currentPage.drawLine({ start: { x: gmX, y: y - 20 }, end: { x: gmX + 150, y: y - 20 }, thickness: 1, color: black });
        if (schedule.gmApproved) {
            currentPage.drawText("Signed/Approved", { x: gmX, y: y - 10, size: 10, font: font, color: rgb(0, 0.5, 0) });
        }
        currentPage.drawText("( General Manager )", { x: gmX, y: y - 35, size: 10, font: font });
    
        const pdfBytes = await pdfDoc.save();
        return pdfBytes;
    } catch (e) {
        console.error("Critical Error generating schedule PDF:", e);
        throw e;
    }
};

exports.generateAttendancePDF = async (attendance, user) => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 Size
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
    const margin = 50;
    let y = height - margin;
  
    // Colors
    const black = rgb(0, 0, 0);
    const darkGreen = rgb(0.06, 0.3, 0.22);
    const gray = rgb(0.5, 0.5, 0.5);
  
    // --- Header Section ---
    try {
        const logoPath = path.join(__dirname, '../assets/logo.png');
        if (fs.existsSync(logoPath)) {
            const logoImageBytes = fs.readFileSync(logoPath);
            const logoImage = await pdfDoc.embedPng(logoImageBytes);
            
            const targetHeight = 50; 
            const scaleFactor = targetHeight / logoImage.height;
            const scaledDims = logoImage.scale(scaleFactor);
  
            page.drawImage(logoImage, {
                x: margin,
                y: height - margin - targetHeight, 
                width: scaledDims.width,
                height: scaledDims.height,
            });
        }
    } catch (e) {
        console.error("Logo embedding failed:", e);
    }
  
    y -= 20;
  
    // Title
    const titleX = margin + 120;
    let titleY = height - margin - 25;
    
    page.drawText('Detail Absensi / Attendance', { x: titleX, y: titleY, size: 16, font: boldFont, color: black });
    titleY -= 15;
    page.drawText(`Dicetak: ${formatWibPrintStamp(new Date())}`, { x: titleX, y: titleY, size: 10, font: font, color: gray });
  
    y -= 60;
  
    // --- Content ---
    const drawField = (label, value, yPos) => {
        page.drawText(cleanText(label), { x: margin, y: yPos, size: 10, font: boldFont, color: black });
        page.drawText(':', { x: margin + 100, y: yPos, size: 10, font: font, color: black });
        // Handle multiline for long values like Location
        if (value && value.length > 60) {
             const words = cleanText(value).split(' ');
             let line = '';
             let currentY = yPos;
             words.forEach(word => {
                 if ((line + word).length > 60) {
                     page.drawText(line, { x: margin + 110, y: currentY, size: 10, font: font, color: black });
                     line = word + ' ';
                     currentY -= 12;
                 } else {
                     line += word + ' ';
                 }
             });
             if (line) {
                 page.drawText(line, { x: margin + 110, y: currentY, size: 10, font: font, color: black });
             }
             return currentY - 20;
        } else {
             page.drawText(cleanText(value || '-'), { x: margin + 110, y: yPos, size: 10, font: font, color: black });
             return yPos - 20;
        }
    };
  
    y = drawField('Nama', user.name, y);
    y = drawField('Departemen', user.department, y);
    y = drawField('Tanggal', formatWibLongDate(attendance.timestamp), y);
    y = drawField('Jam', formatWibTimeHms(attendance.timestamp), y);
    y = drawField('Tipe', attendance.type, y);
    y = drawField('Status', attendance.status, y);
    y = drawField('Lokasi', attendance.location, y);
    if (attendance.latitude && attendance.longitude) {
        y = drawField('Koordinat', `${attendance.latitude}, ${attendance.longitude}`, y);
    }
    y = drawField('Catatan', attendance.notes, y);
  
    y -= 20;
  
    // --- Photo Section ---
    if (attendance.photoUrl) {
        page.drawText('Foto Bukti:', { x: margin, y, size: 12, font: boldFont, color: black });
        y -= 20;
  
        try {
            const rawName = String(attendance.photoUrl).split('/').pop() || '';
            const photoFileName = path.basename(rawName).replace(/[^a-zA-Z0-9._-]/g, '');
            if (!photoFileName || photoFileName.includes('..')) {
                throw new Error('Invalid filename');
            }
            const photoPath = path.join(__dirname, '../uploads', photoFileName);
            
            if (fs.existsSync(photoPath)) {
                const imageBytes = fs.readFileSync(photoPath);
                const lower = photoPath.toLowerCase();
                let image;
                if (lower.endsWith('.png')) {
                    image = await pdfDoc.embedPng(imageBytes);
                } else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
                    image = await pdfDoc.embedJpg(imageBytes);
                } else {
                    throw new Error('Unsupported image type');
                }
                
                // Scale image to fit max width/height
                const maxW = 400;
                const maxH = 300;
                const scale = Math.min(maxW / image.width, maxH / image.height, 1);
                const dims = image.scale(scale);
  
                page.drawImage(image, {
                    x: margin,
                    y: y - dims.height,
                    width: dims.width,
                    height: dims.height,
                });
            } else {
                 page.drawText('(Foto tidak ditemukan di server)', { x: margin, y, size: 10, font: font, color: gray });
            }
        } catch (e) {
            console.error("Error embedding attendance photo:", e);
            page.drawText('(Gagal memuat foto)', { x: margin, y, size: 10, font: font, color: gray });
        }
    }
  
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
};
