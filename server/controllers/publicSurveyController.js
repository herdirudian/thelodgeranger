const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { formatWibLongDateId } = require('../utils/wibDate');
const { sendWhatsAppMessage } = require('../services/watzapService');
const XLSX = require('xlsx');

function normalizeType(type) {
  const t = String(type || '').toUpperCase().replace(/[-\s]/g, '_');
  if (['THE_CAVE', 'THE_PINES', 'OMAH_BAMBOO', 'HOTEL_GUEST', 'WISATA'].includes(t)) return t;
  return 'UNKNOWN';
}

function buildCreatedAtFilter(startDate, endDate) {
  const hasStart = typeof startDate === 'string' && startDate.trim().length > 0;
  const hasEnd = typeof endDate === 'string' && endDate.trim().length > 0;
  if (!hasStart && !hasEnd) return null;

  let start = null;
  let end = null;

  if (hasStart) {
    const s = new Date(`${startDate}T00:00:00+07:00`);
    if (!isNaN(s.getTime())) start = s;
  }
  if (hasEnd) {
    const e = new Date(`${endDate}T23:59:59.999+07:00`);
    if (!isNaN(e.getTime())) end = e;
  }

  if (!start && !end) return null;
  if (start && end) return { gte: start, lte: end };
  if (start) return { gte: start };
  return { lte: end };
}

exports.submit = async (req, res) => {
  try {
    const type = normalizeType(req.params.type || req.body.type);
    if (type === 'UNKNOWN') {
      return res.status(400).json({ message: 'Invalid survey type' });
    }

    const { data, name, address, email, phone, wantFollowUp, privacyConsent, marketingConsent } = req.body;

    if (type === 'WISATA') {
      const requiredKeys = ['ticketEase','scenery','cleanliness','staffFriendliness','recommend','overall','priceSatisfaction'];
      const missing = requiredKeys.filter(k => !(data && typeof data[k] === 'number' && data[k] >= 1 && data[k] <= 5));
      if (missing.length > 0) {
        return res.status(400).json({ message: 'Mohon isi semua penilaian bintang (1–5).' });
      }
    }

    const payload = {
      type,
      data: data || {},
      name: name || null,
      address: address || null,
      email: email || null,
      phone: phone || null,
      wantFollowUp: !!wantFollowUp,
      privacyConsent: !!privacyConsent,
      marketingConsent: !!marketingConsent
    };

    await prisma.publicSurveyResponse.create({ data: payload });

    try {
      const infoText = `Survey ${type.replace('_',' ')} diterima (${formatWibLongDateId(new Date())}).`;
      const adminPhone = process.env.SURVEY_ADMIN_WA;
      if (adminPhone) await sendWhatsAppMessage({ to: adminPhone, message: infoText });
    } catch (e) {}

    return res.status(201).json({ message: 'Terima kasih, jawaban Anda sudah tersimpan.' });
  } catch (error) {
    console.error('PublicSurvey submit error:', error);
    return res.status(500).json({ message: 'Error submitting survey', error: error.message });
  }
};

exports.export = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;
    const where = type ? { type } : {};
    const createdAt = buildCreatedAtFilter(startDate, endDate);
    if (createdAt) where.createdAt = createdAt;
    const rows = await prisma.publicSurveyResponse.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    const labelMap = {
      discoverFrom: 'Discover From',
      checkIn: 'Check-in Experience',
      cleanliness: 'Cleanliness',
      housekeeping: 'Housekeeping',
      staffService: 'Staff Service',
      restaurantFood: 'Restaurant Food',
      amenities: 'Amenities',
      overall: 'Overall',
      otherExperience: 'Other Experience',
      ticketEase: 'Ticket Purchase Ease',
      scenery: 'Scenery',
      staffFriendliness: 'Staff Friendliness',
      recommend: 'Recommend',
      priceSatisfaction: 'Price Satisfaction',
      comment: 'Comment',
    };

    const summaryOrder = [
      'discoverFrom',
      'checkIn',
      'cleanliness',
      'housekeeping',
      'staffService',
      'restaurantFood',
      'amenities',
      'overall',
      'otherExperience',
      'ticketEase',
      'scenery',
      'staffFriendliness',
      'recommend',
      'priceSatisfaction',
    ];

    const summaryCounts = {};
    for (const r of rows) {
      const d = r.data && typeof r.data === 'object' ? r.data : {};
      for (const [k, v] of Object.entries(d)) {
        if (v === null || typeof v === 'undefined') continue;
        if (Array.isArray(v)) {
          for (const item of v) {
            if (item === null || typeof item === 'undefined') continue;
            const val = String(item);
            if (!summaryCounts[k]) summaryCounts[k] = {};
            summaryCounts[k][val] = (summaryCounts[k][val] || 0) + 1;
          }
          continue;
        }
        if (typeof v === 'object') continue;
        const val = String(v);
        if (!summaryCounts[k]) summaryCounts[k] = {};
        summaryCounts[k][val] = (summaryCounts[k][val] || 0) + 1;
      }
    }

    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

    const makeBar = (count, max, width = 20) => {
      const c = Number(count) || 0;
      const m = Number(max) || 0;
      if (c <= 0 || m <= 0) return '';
      const filled = Math.max(1, Math.round((c / m) * width));
      return '█'.repeat(Math.min(width, filled));
    };

    const summaryRows = [];
    summaryRows.push([q('SUMMARY'), q(''), q(''), q('')].join(','));
    summaryRows.push([q('Type'), q(type || 'ALL'), q(rows.length), q('')].join(','));
    summaryRows.push([q('GeneratedAt'), q(new Date().toISOString()), q(''), q('')].join(','));
    summaryRows.push('');
    summaryRows.push([q('Field'), q('Value'), q('Count'), q('Bar')].join(','));

    const keys = Object.keys(summaryCounts);
    const sortedKeys = [
      ...summaryOrder.filter((k) => keys.includes(k)),
      ...keys.filter((k) => !summaryOrder.includes(k)).sort(),
    ];

    for (const k of sortedKeys) {
      const label = labelMap[k] || k;
      const entries = Object.entries(summaryCounts[k] || {});
      entries.sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
      const maxCount = entries.reduce((m, e) => Math.max(m, Number(e[1]) || 0), 0);
      for (const [val, count] of entries) {
        summaryRows.push([q(label), q(val), q(count), q(makeBar(count, maxCount))].join(','));
      }
    }

    summaryRows.push('');

    const headers = ['Type','CreatedAt','Name','Address','Email','Phone','WantFollowUp','PrivacyConsent','MarketingConsent','DataJSON'];
    const csv = [...summaryRows, headers.join(',')];
    rows.forEach(r => {
      csv.push([
        r.type,
        r.createdAt.toISOString(),
        q((r.name || '').replace(/,/g,' ')),
        q((r.address || '').replace(/,/g,' ')),
        q(r.email || ''),
        q(r.phone || ''),
        q(r.wantFollowUp ? 'Yes' : 'No'),
        q(r.privacyConsent ? 'Yes' : 'No'),
        q(r.marketingConsent ? 'Yes' : 'No'),
        q(JSON.stringify(r.data || {}))
      ].join(','));
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="public_survey.csv"');
    return res.send(csv.join('\n'));
  } catch (error) {
    console.error('PublicSurvey export error:', error);
    return res.status(500).json({ message: 'Error exporting survey', error: error.message });
  }
};

exports.exportXlsx = async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query;
    const where = type ? { type } : {};
    const createdAt = buildCreatedAtFilter(startDate, endDate);
    if (createdAt) where.createdAt = createdAt;
    const rows = await prisma.publicSurveyResponse.findMany({
      where,
      orderBy: { createdAt: 'asc' }
    });

    const monthNames = [
      'JANUARI',
      'FEBRUARI',
      'MARET',
      'APRIL',
      'MEI',
      'JUNI',
      'JULI',
      'AGUSTUS',
      'SEPTEMBER',
      'OKTOBER',
      'NOVEMBER',
      'DESEMBER',
    ];

    const toWib = (d) => new Date(new Date(d).getTime() + 7 * 60 * 60 * 1000);
    const monthKey = (d) => {
      const w = toWib(d);
      return `${w.getFullYear()}-${String(w.getMonth() + 1).padStart(2, '0')}`;
    };

    const groups = new Map();
    for (const r of rows) {
      const k = monthKey(r.createdAt);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }

    const knownDiscoverOrder = ['Tiktok', 'Instagram', 'Google', 'Teman'];
    const ratingOrder = ['Excellent', 'Good', 'Fair', 'Poor'];
    const aspects = [
      { key: 'checkIn', label: 'Check in Express' },
      { key: 'cleanliness', label: 'Cleanliness' },
      { key: 'housekeeping', label: 'Housekeeping' },
      { key: 'staffService', label: 'Staff Service' },
      { key: 'restaurantFood', label: 'Restaurant Food' },
      { key: 'amenities', label: 'Aminities' },
      { key: 'overall', label: 'Overall Hotel Rating' },
    ];

    const countValue = (arr, key) => {
      const counts = {};
      for (const r of arr) {
        const d = r.data && typeof r.data === 'object' ? r.data : {};
        const v = d[key];
        if (v === null || typeof v === 'undefined') continue;
        if (Array.isArray(v)) {
          for (const it of v) {
            if (it === null || typeof it === 'undefined') continue;
            const s = String(it);
            counts[s] = (counts[s] || 0) + 1;
          }
        } else if (typeof v !== 'object') {
          const s = String(v);
          counts[s] = (counts[s] || 0) + 1;
        }
      }
      return counts;
    };

    const takeTopComments = (arr, rating) => {
      const out = [];
      const seen = new Set();
      for (let i = arr.length - 1; i >= 0; i--) {
        const r = arr[i];
        const d = r.data && typeof r.data === 'object' ? r.data : {};
        if (String(d.overall || '') !== rating) continue;
        const c = String(d.comment || '').trim();
        if (!c) continue;
        if (seen.has(c)) continue;
        seen.add(c);
        out.push(c);
        if (out.length >= 8) break;
      }
      return out;
    };

    const aoa = [];
    for (const [k, arr] of Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const [yy, mm] = k.split('-').map((x) => parseInt(x));
      const monthTitle = `${monthNames[(mm || 1) - 1] || ''} ${yy || ''}`.trim();
      aoa.push([monthTitle]);
      aoa.push([]);

      const wellnessCounts = countValue(arr, 'otherExperience');
      const wellnessKeys = Object.entries(wellnessCounts).sort((a, b) => b[1] - a[1]).map((e) => e[0]);
      const w1 = wellnessKeys[0] || 'Reureuh / Istirahat';
      const w2 = wellnessKeys[1] || 'Ameung / Healing';
      aoa.push(['Guest Wellnes The Lodge Maribaya']);
      aoa.push([w1, '', w2]);
      aoa.push([wellnessCounts[w1] || 0, '', wellnessCounts[w2] || 0]);
      aoa.push([]);

      const discoverCounts = countValue(arr, 'discoverFrom');
      const discoverKeys = Object.keys(discoverCounts);
      const discoverSorted = [
        ...knownDiscoverOrder.filter((x) => discoverKeys.includes(x)),
        ...discoverKeys.filter((x) => !knownDiscoverOrder.includes(x)).sort(),
      ];
      aoa.push(['Terang ti manten / Tahu dari mana TheLodge Maribaya Camp & Village']);
      aoa.push(discoverSorted);
      aoa.push(discoverSorted.map((x) => discoverCounts[x] || 0));
      aoa.push([]);

      aoa.push([`REPORT GUEST COMMENT IN FO ${yy || ''}`.trim()]);
      aoa.push(['EXPECTATION', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR']);
      for (const a of aspects) {
        const c = countValue(arr, a.key);
        aoa.push([
          a.label,
          c.Excellent || 0,
          c.Good || 0,
          c.Fair || 0,
          c.Poor || 0,
        ]);
      }
      aoa.push([]);

      const commentsByRating = {
        Excellent: takeTopComments(arr, 'Excellent'),
        Good: takeTopComments(arr, 'Good'),
        Fair: takeTopComments(arr, 'Fair'),
        Poor: takeTopComments(arr, 'Poor'),
      };
      const maxRows = Math.max(
        commentsByRating.Excellent.length,
        commentsByRating.Good.length,
        commentsByRating.Fair.length,
        commentsByRating.Poor.length
      );
      if (maxRows > 0) {
        aoa.push(['COMMENTS (by Overall Rating)', 'EXCELLENT', 'GOOD', 'FAIR', 'POOR']);
        for (let i = 0; i < maxRows; i++) {
          aoa.push([
            '',
            commentsByRating.Excellent[i] || '',
            commentsByRating.Good[i] || '',
            commentsByRating.Fair[i] || '',
            commentsByRating.Poor[i] || '',
          ]);
        }
        aoa.push([]);
      }
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = Array.from({ length: 19 }).map((_, i) => ({ wch: i === 0 ? 42 : i <= 4 ? 16 : 22 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Report Guest Comment');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=\"guest_comment_${type || 'ALL'}_${new Date().toISOString().slice(0,10)}.xlsx\"`);
    return res.send(Buffer.from(buf));
  } catch (error) {
    console.error('PublicSurvey exportXlsx error:', error);
    return res.status(500).json({ message: 'Error exporting survey (xlsx)', error: error.message });
  }
};

exports.report = async (req, res) => {
  try {
    const userId = req.userId;
    const role = req.role;
    const { type, startDate, endDate } = req.query;
    const privileged = role === 'HR' || role === 'GM' || role === 'ADMIN';
    if (!privileged) {
      const allowed = await prisma.publicSurveyAccess.findMany({
        where: {
          userId,
          OR: [
            { type: null },
            { type: 'ALL' },
            ...(type ? [{ type }] : [])
          ]
        }
      });
      if (!allowed || allowed.length === 0) {
        return res.status(403).json({ message: 'Not permitted to view survey report' });
      }
    }
    const where = type ? { type } : {};
    const createdAt = buildCreatedAtFilter(startDate, endDate);
    if (createdAt) where.createdAt = createdAt;
    const rows = await prisma.publicSurveyResponse.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    return res.json(rows);
  } catch (error) {
    console.error('PublicSurvey report error:', error);
    return res.status(500).json({ message: 'Error fetching report', error: error.message });
  }
};

exports.listAccess = async (req, res) => {
  try {
    const role = req.role;
    if (!(role === 'HR' || role === 'GM' || role === 'ADMIN')) {
      return res.status(403).json({ message: 'Require Admin/HR role' });
    }
    const rows = await prisma.publicSurveyAccess.findMany({
      include: { user: { select: { id: true, name: true, department: true, role: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(rows);
  } catch (error) {
    console.error('PublicSurvey listAccess error:', error);
    return res.status(500).json({ message: 'Error listing access', error: error.message });
  }
};

exports.allowed = async (req, res) => {
  try {
    const role = req.role;
    const userId = req.userId;
    const privileged = role === 'HR' || role === 'GM' || role === 'ADMIN';
    if (privileged) {
      return res.json({ allowedTypes: ['ALL'] });
    }
    const rows = await prisma.publicSurveyAccess.findMany({
      where: { userId },
      select: { type: true }
    });
    const types = rows.map(r => r.type || 'ALL');
    return res.json({ allowedTypes: types });
  } catch (error) {
    console.error('PublicSurvey allowed error:', error);
    return res.status(500).json({ message: 'Error checking access', error: error.message });
  }
};

exports.grantAccess = async (req, res) => {
  try {
    const role = req.role;
    if (!(role === 'HR' || role === 'GM' || role === 'ADMIN')) {
      return res.status(403).json({ message: 'Require Admin/HR role' });
    }
    const { type } = req.body;
    const userIdRaw = req.body.userId ?? req.body.id ?? req.query.userId;
    const uid = typeof userIdRaw === 'number' ? userIdRaw : parseInt(String(userIdRaw || ''));
    if (!uid || Number.isNaN(uid) || uid <= 0) return res.status(400).json({ message: 'userId required' });
    const exists = await prisma.publicSurveyAccess.findFirst({
      where: { userId: uid, type: type || null }
    });
    if (exists) return res.json({ message: 'Already granted', id: exists.id });
    const created = await prisma.publicSurveyAccess.create({
      data: { userId: uid, type: type || null }
    });
    return res.status(201).json(created);
  } catch (error) {
    console.error('PublicSurvey grantAccess error:', error);
    return res.status(500).json({ message: 'Error granting access', error: error.message });
  }
};

exports.revokeAccess = async (req, res) => {
  try {
    const role = req.role;
    if (!(role === 'HR' || role === 'GM' || role === 'ADMIN')) {
      return res.status(403).json({ message: 'Require Admin/HR role' });
    }
    const id = parseInt(req.params.id);
    if (!id) return res.status(400).json({ message: 'id required' });
    await prisma.publicSurveyAccess.delete({ where: { id } });
    return res.json({ message: 'Revoked' });
  } catch (error) {
    console.error('PublicSurvey revokeAccess error:', error);
    return res.status(500).json({ message: 'Error revoking access', error: error.message });
  }
};
