const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { format } = require('date-fns');
const fs = require('fs');
const path = require('path');

exports.generateRequestPDF = async (request) => {
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
          
          // Text removed as requested
      } else {
          // Fallback if logo fails
           // Text removed here too for consistency if requested to be removed
      }
  } catch (e) {
      console.error("Logo embedding failed:", e);
      // Fallback
      // Text removed here too
  }

  y -= 20; // Ensure enough spacing below header elements



  // Title Right/Center aligned effectively
  const titleX = margin + 120;
  let titleY = height - margin - 10;
  
  // "CRM Workflow" removed
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
      'RESIGNATION': 'Resign'
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
  page.drawText(summaryText, { x: margin, y, size: 10, font: boldFont, color: black, maxWidth: width - (margin * 2) });
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
          page.drawText(header, {
              x: currentX + 5,
              y: y - headerHeight + 8,
              size: 9,
              font: boldFont,
              color: black
          });
          
          // Draw vertical line after this column (except last)
          if (i < headers.length - 1) {
             // Handled by cell borders effectively if we draw cell by cell, but let's draw full table borders
          }
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
              page.drawText(String(text || ''), {
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

  // 2. Approvals (Simulated History based on current status)
  // Note: In a real system, we should query a RequestHistory table. 
  // Here we infer from flags.
  
  if (request.hodApproved) {
      historyData.push([
         format(new Date(request.updatedAt), 'yyyy-MM-dd HH:mm'), // Approx date
         'Approve',
         'Head of Dept', // We don't have the HOD name stored on request, just the flag
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
         'Reviewer', // Could be HOD, HR, or GM
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

  // GM (Only if needed or strictly for certain types, but let's add if GM approved)
  if (request.gmApproved || request.status === 'PENDING_GM') {
      // Center GM signature
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

exports.generateMonthlySchedulePDF = async (schedule, staffList) => {
    const pdfDoc = await PDFDocument.create();
    // Landscape A4
    const page = pdfDoc.addPage([841.89, 595.28]); 
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
    const margin = 30;
    let y = height - margin;
  
    // Colors
    const black = rgb(0, 0, 0);
    const gray = rgb(0.5, 0.5, 0.5);
  
    // --- Header ---
    try {
        const logoPath = path.join(__dirname, '../assets/logo.png');
        if (fs.existsSync(logoPath)) {
            const logoImageBytes = fs.readFileSync(logoPath);
            const logoImage = await pdfDoc.embedPng(logoImageBytes);
            const targetHeight = 40; 
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

    y -= 50;
    
    // Title
    const monthName = format(new Date(schedule.year, schedule.month - 1), 'MMMM yyyy');
    page.drawText(`Jadwal Kerja Departemen: ${schedule.department}`, { x: margin, y, size: 14, font: boldFont });
    y -= 15;
    page.drawText(`Periode: ${monthName}`, { x: margin, y, size: 12, font: font });
    y -= 15;
    page.drawText(`Status: ${schedule.status}`, { x: margin, y, size: 10, font: font, color: gray });
    
    y -= 20;

    // --- Grid Table ---
    // Columns: Name, 1..31
    const daysInMonth = new Date(schedule.year, schedule.month, 0).getDate();
    const colWidthName = 120;
    const colWidthDay = (width - (margin * 2) - colWidthName) / daysInMonth;
    
    const rowHeight = 15;
    const headerHeight = 20;

    // Header
    page.drawRectangle({
        x: margin,
        y: y - headerHeight,
        width: width - (margin * 2),
        height: headerHeight,
        color: rgb(0.9, 0.9, 0.9),
        borderColor: black,
        borderWidth: 0.5
    });

    page.drawText("Nama Staff", { x: margin + 5, y: y - headerHeight + 6, size: 8, font: boldFont });
    
    for (let i = 1; i <= daysInMonth; i++) {
        const xPos = margin + colWidthName + ((i - 1) * colWidthDay);
        page.drawText(String(i), { x: xPos + 2, y: y - headerHeight + 6, size: 7, font: boldFont });
        // Vertical line
        page.drawLine({
             start: { x: xPos, y },
             end: { x: xPos, y: y - headerHeight },
             thickness: 0.5,
             color: gray
        });
    }

    y -= headerHeight;

    // Data
    const scheduleData = typeof schedule.data === 'string' ? JSON.parse(schedule.data) : schedule.data;
    // scheduleData: [{ userId, shifts: { "1": "M" } }]

    for (const staff of staffList) {
        // Find shifts for this staff
        const staffShifts = scheduleData.find(s => parseInt(s.userId) === staff.id)?.shifts || {};

        // Row Border
        page.drawRectangle({
            x: margin,
            y: y - rowHeight,
            width: width - (margin * 2),
            height: rowHeight,
            borderColor: gray,
            borderWidth: 0.5
        });

        // Name
        page.drawText(staff.name, { x: margin + 5, y: y - rowHeight + 4, size: 8, font: font });

        // Shifts
        for (let i = 1; i <= daysInMonth; i++) {
            const shift = staffShifts[String(i)] || '';
            const xPos = margin + colWidthName + ((i - 1) * colWidthDay);
            
            if (shift) {
                page.drawText(shift, { x: xPos + 2, y: y - rowHeight + 4, size: 7, font: font });
            }
            
            // Vertical Divider
            page.drawLine({
                start: { x: xPos, y },
                end: { x: xPos, y: y - rowHeight },
                thickness: 0.5,
                color: gray
            });
        }
        
        y -= rowHeight;
    }

    y -= 30;

    // --- Signatures ---
    const sigY = y;
    const sigWidth = 150;
    
    // HOD
    page.drawText('Dibuat Oleh (HOD)', { x: margin, y: sigY, size: 10, font: boldFont });
    page.drawLine({ start: { x: margin, y: sigY - 40 }, end: { x: margin + sigWidth, y: sigY - 40 }, thickness: 1 });
    if (schedule.hodApproved) {
        page.drawText('Signed/Approved', { x: margin + 20, y: sigY - 30, size: 9, font: font, color: rgb(0, 0.5, 0) });
    }

    // HR
    const hrX = margin + 250;
    page.drawText('Diperiksa Oleh (HR)', { x: hrX, y: sigY, size: 10, font: boldFont });
    page.drawLine({ start: { x: hrX, y: sigY - 40 }, end: { x: hrX + sigWidth, y: sigY - 40 }, thickness: 1 });
    if (schedule.hrApproved) {
        page.drawText('Signed/Approved', { x: hrX + 20, y: sigY - 30, size: 9, font: font, color: rgb(0, 0.5, 0) });
    }

    // GM
    const gmX = margin + 500;
    page.drawText('Disetujui Oleh (GM)', { x: gmX, y: sigY, size: 10, font: boldFont });
    page.drawLine({ start: { x: gmX, y: sigY - 40 }, end: { x: gmX + sigWidth, y: sigY - 40 }, thickness: 1 });
    if (schedule.gmApproved) {
        page.drawText('Signed/Approved', { x: gmX + 20, y: sigY - 30, size: 9, font: font, color: rgb(0, 0.5, 0) });
    }

    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
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
    page.drawText(`Dicetak: ${format(new Date(), 'dd/MM/yyyy, HH.mm.ss')}`, { x: titleX, y: titleY, size: 10, font: font, color: gray });
  
    y -= 60;
  
    // --- Content ---
    const drawField = (label, value, yPos) => {
        page.drawText(label, { x: margin, y: yPos, size: 10, font: boldFont, color: black });
        page.drawText(':', { x: margin + 100, y: yPos, size: 10, font: font, color: black });
        // Handle multiline for long values like Location
        if (value && value.length > 60) {
             const words = value.split(' ');
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
             page.drawText(String(value || '-'), { x: margin + 110, y: yPos, size: 10, font: font, color: black });
             return yPos - 20;
        }
    };
  
    y = drawField('Nama', user.name, y);
    y = drawField('Departemen', user.department, y);
    y = drawField('Tanggal', format(new Date(attendance.timestamp), 'dd MMMM yyyy'), y);
    y = drawField('Jam', format(new Date(attendance.timestamp), 'HH:mm:ss'), y);
    y = drawField('Tipe', attendance.type, y);
    y = drawField('Status', attendance.status, y);
    y = drawField('Lokasi', attendance.location, y);
    if (attendance.latitude && attendance.longitude) {
        y = drawField('Koordinat', `${attendance.latitude}, ${attendance.longitude}`, y);
        // Add link
        // page.drawText('(Klik untuk lihat peta)', { x: margin + 250, y: y + 20, size: 8, font: font, color: blue });
    }
    y = drawField('Catatan', attendance.notes, y);
  
    y -= 20;
  
    // --- Photo Section ---
    if (attendance.photoUrl) {
        page.drawText('Foto Bukti:', { x: margin, y, size: 12, font: boldFont, color: black });
        y -= 20;
  
        try {
            // Check if photo exists locally
            // photoUrl might be /uploads/filename.jpg
            const photoFileName = attendance.photoUrl.split('/').pop();
            const photoPath = path.join(__dirname, '../uploads', photoFileName);
            
            if (fs.existsSync(photoPath)) {
                const imageBytes = fs.readFileSync(photoPath);
                let image;
                if (photoPath.toLowerCase().endsWith('.png')) {
                    image = await pdfDoc.embedPng(imageBytes);
                } else {
                    image = await pdfDoc.embedJpg(imageBytes);
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
