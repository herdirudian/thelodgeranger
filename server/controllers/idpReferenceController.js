const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

function getWorkbookPath() {
  const envPath = process.env.IDP_FORM_XLSX_PATH;
  if (envPath && envPath.trim()) return envPath.trim();
  return path.join(__dirname, '..', '..', 'Performance & Development Form (2).xlsx');
}

function readWorkbook() {
  const wbPath = getWorkbookPath();
  if (!fs.existsSync(wbPath)) {
    const err = new Error(`IDP Excel not found at ${wbPath}`);
    err.code = 'IDP_XLSX_NOT_FOUND';
    throw err;
  }
  return XLSX.readFile(wbPath, { cellDates: false });
}

function cellStr(ws, addr) {
  const c = ws && ws[addr];
  if (!c) return '';
  const v = c.v;
  if (v === null || typeof v === 'undefined') return '';
  return String(v);
}

function excelSerialToISODate(serial) {
  if (!serial || typeof serial !== 'number') return '';
  const parsed = XLSX.SSF.parse_date_code(serial);
  if (!parsed || !parsed.y || !parsed.m || !parsed.d) return '';
  const yyyy = String(parsed.y).padStart(4, '0');
  const mm = String(parsed.m).padStart(2, '0');
  const dd = String(parsed.d).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

exports.getGuidelines = async (req, res) => {
  try {
    return res.json({
      title: 'IDP Guidelines',
      header: 'Panduan Pengisian Performance & Development Form',
      text: `Berikut adalah panduan pengisian Performance & Development Form melalui sistem.

1) Objective Setting
Pada menu Objective Setting, karyawan diminta untuk mengisi target kerja yang akan dicapai pada periode penilaian.

Hal yang perlu diperhatikan:
- Target disusun berdasarkan hasil diskusi dengan Atasan.
- Setiap objective harus memiliki indikator keberhasilan yang jelas.
- Objective yang telah ditetapkan akan menjadi dasar dalam proses Performance Review.

2) Individual Development Plan (IDP)
Menu IDP digunakan untuk merencanakan pengembangan kompetensi yang mendukung pencapaian objective.
Rencana pengembangan ini dapat didiskusikan dengan Atasan agar selaras dengan kebutuhan pekerjaan dan pencapaian target.

Langkah pengisian:
1. Tuliskan kebutuhan pengembangan.
2. Pilih kompetensi yang ingin dikembangkan.
3. Pilih tipe pengembangan, yaitu:
- Formal Training (10%)
- Mentoring & Coaching (20%)
- On the Job Development (70%)
4. Jelaskan deskripsi kegiatan pengembangan.
5. Tentukan PIC / penanggung jawab.
6. Isi periode pelaksanaan (tanggal mulai dan selesai).

3) Performance Review
Menu Performance Review digunakan untuk melakukan evaluasi terhadap pencapaian kinerja yang nantinya akan diisi oleh User atau Manager.

Hal yang perlu diisi:
- Penilaian terhadap pencapaian objective.
- Kontribusi yang telah diberikan selama periode penilaian.
- Hasil kerja atau pencapaian yang relevan.
Evaluasi ini akan menjadi dasar dalam proses penilaian kinerja.

4) Career Preference
Pada menu Career Preference, karyawan diminta untuk menjelaskan preferensi pengembangan karier.

Informasi yang dapat diisi antara lain:
- Kekuatan (strengths)
- Area yang perlu dikembangkan
- Minat pengembangan karier ke depan

5) Summary
Menu Summary menampilkan ringkasan seluruh data yang telah diisi.
Data pada menu ini akan digunakan sebagai referensi oleh HR dalam proses evaluasi.

Area pengembangan sebaiknya berfokus pada kombinasi kompetensi fungsional dan bisnis. Anda dapat memasukkan lebih dari satu kompetensi untuk setiap area pengembangan yang relevan. Daftar kompetensi dapat dilihat pada menu Competencies namun tidak terbatas pada daftar tersebut apabila terdapat kompetensi lain yang ingin ditambahkan.

* 70% - pengalaman kerja, dalam proyek peran dan tanggung jawab tambahan
* 20% - mentoring atau pembinaan menggunakan Manajer langsung atau tidak langsung, rekan atau sumber eksternal
* 10% - program pelatihan formal, lokakarya, konferensi, atau seminar

Pastikan seluruh data telah lengkap sebelum melakukan proses Submit.

Catatan:
- Gunakan tombol Simpan untuk menyimpan data sementara.
- Gunakan tombol Submit setelah seluruh data telah diisi dengan lengkap.`,
    });
  } catch (error) {
    const status = error.code === 'IDP_XLSX_NOT_FOUND' ? 404 : 500;
    return res.status(status).json({ message: 'Error reading guidelines', error: error.message });
  }
};

exports.getIdpGuidelinesXlsx = async (req, res) => {
  try {
    const wb = readWorkbook();
    const ws = wb.Sheets['IDP-Guidelines'];
    if (!ws) return res.status(404).json({ message: 'IDP-Guidelines sheet not found' });

    const text = cellStr(ws, 'B9').replace(
      /Area Pengembangan Anda harus fokus pada campuran kompetensi Fungsional dan Bisnis\.[\s\S]*?Anda dapat memasukkan lebih dari satu kompetensi untuk setiap Area Pengembangan yang relevan\./g,
      'Area pengembangan sebaiknya berfokus pada kombinasi kompetensi fungsional dan bisnis. Anda dapat memasukkan lebih dari satu kompetensi untuk setiap area pengembangan yang relevan. Daftar kompetensi dapat dilihat pada menu Competencies namun tidak terbatas pada daftar tersebut apabila terdapat kompetensi lain yang ingin ditambahkan.'
    );
    return res.json({
      title: cellStr(ws, 'B3') || 'IDP Guidelines',
      header: cellStr(ws, 'B2') || '',
      text,
    });
  } catch (error) {
    const status = error.code === 'IDP_XLSX_NOT_FOUND' ? 404 : 500;
    return res.status(status).json({ message: 'Error reading IDP guidelines (xlsx)', error: error.message });
  }
};

exports.getSample = async (req, res) => {
  try {
    const wb = readWorkbook();
    const ws = wb.Sheets['IDP-Sample'];
    if (!ws) return res.status(404).json({ message: 'IDP-Sample sheet not found' });

    const getNum = (addr) => {
      const c = ws && ws[addr];
      if (!c) return null;
      const v = c.v;
      if (typeof v === 'number') return v;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const sample = {
      items: [
        {
          developmentNeeds: cellStr(ws, 'A12'),
          competency: [cellStr(ws, 'B13'), cellStr(ws, 'B14')].filter(Boolean).join(' - '),
          actions: [
            {
              type: 'FORMAL_TRAINING',
              label: cellStr(ws, 'C12'),
              description: cellStr(ws, 'D12'),
              responsibility: cellStr(ws, 'E12'),
              startDate: excelSerialToISODate(getNum('F12')),
              endDate: excelSerialToISODate(getNum('G12')),
            },
            {
              type: 'MENTORING_COACHING',
              label: cellStr(ws, 'C13'),
              description: cellStr(ws, 'D13'),
              responsibility: cellStr(ws, 'E13'),
              startDate: excelSerialToISODate(getNum('F13')),
              endDate: excelSerialToISODate(getNum('G13')),
            },
            {
              type: 'OJT',
              label: cellStr(ws, 'C14'),
              description: cellStr(ws, 'D14'),
              responsibility: cellStr(ws, 'E14'),
              startDate: excelSerialToISODate(getNum('F14')),
              endDate: excelSerialToISODate(getNum('G14')),
            },
          ],
        },
        {
          developmentNeeds: cellStr(ws, 'A15'),
          competency: [cellStr(ws, 'B16'), cellStr(ws, 'B17')].filter(Boolean).join(' - '),
          actions: [
            {
              type: 'FORMAL_TRAINING',
              label: cellStr(ws, 'C15'),
              description: cellStr(ws, 'D15'),
              responsibility: cellStr(ws, 'E15'),
              startDate: excelSerialToISODate(getNum('F15')),
              endDate: excelSerialToISODate(getNum('G15')),
            },
            {
              type: 'MENTORING_COACHING',
              label: cellStr(ws, 'C16'),
              description: cellStr(ws, 'D16'),
              responsibility: cellStr(ws, 'E16'),
              startDate: excelSerialToISODate(getNum('F16')),
              endDate: excelSerialToISODate(getNum('G16')),
            },
            {
              type: 'OJT',
              label: cellStr(ws, 'C17'),
              description: cellStr(ws, 'D17'),
              responsibility: cellStr(ws, 'E17'),
              startDate: excelSerialToISODate(getNum('F17')),
              endDate: excelSerialToISODate(getNum('G17')),
            },
          ],
        },
      ],
      note: cellStr(ws, 'A25'),
    };

    return res.json(sample);
  } catch (error) {
    const status = error.code === 'IDP_XLSX_NOT_FOUND' ? 404 : 500;
    return res.status(status).json({ message: 'Error reading sample', error: error.message });
  }
};

exports.getCompetencies = async (req, res) => {
  try {
    const wb = readWorkbook();
    const ws = wb.Sheets['Competencies'];
    if (!ws) return res.status(404).json({ message: 'Competencies sheet not found' });

    const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
    if (!range) return res.json({ sections: [] });

    const get = (c, r) => {
      const addr = XLSX.utils.encode_cell({ c, r });
      const v = cellStr(ws, addr).trim();
      return v;
    };

    const sections = [];
    let currentSection = null;
    let currentDepartment = '';
    let lastRow = null;

    for (let r = range.s.r; r <= range.e.r; r++) {
      const a = get(0, r);
      const b = get(1, r);
      const c = get(2, r);

      if (!a && !b && !c) continue;

      const aLower = a.toLowerCase();
      const isMetaHeader =
        aLower === 'competencies' ||
        aLower === 'talent central' ||
        aLower.startsWith('area pengembangan') ||
        aLower.startsWith('your development areas') ||
        aLower.startsWith('anda dapat memasukkan') ||
        aLower.startsWith('you may include');

      const isSectionTitle = a && !b && !c && !isMetaHeader && aLower !== 'departemen';
      if (isSectionTitle) {
        currentSection = { title: a, rows: [] };
        sections.push(currentSection);
        currentDepartment = '';
        lastRow = null;
        continue;
      }

      if (!currentSection) continue;

      if (aLower === 'departemen' && b.toLowerCase() === 'competency area') {
        currentDepartment = '';
        lastRow = null;
        continue;
      }

      if (a && aLower !== 'departemen') {
        currentDepartment = a;
      }

      if (b && c) {
        lastRow = {
          department: currentDepartment,
          competencyArea: b,
          description: c,
        };
        currentSection.rows.push(lastRow);
        continue;
      }

      if (!b && c && lastRow) {
        lastRow.description = `${lastRow.description} ${c}`.trim();
      }
    }

    return res.json({ sections });
  } catch (error) {
    const status = error.code === 'IDP_XLSX_NOT_FOUND' ? 404 : 500;
    return res.status(status).json({ message: 'Error reading competencies', error: error.message });
  }
};
