'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Printer } from 'lucide-react';

type IDPAction = {
  type: string;
  label?: string;
  description?: string;
  responsibility?: string;
  startDate?: string;
  endDate?: string;
};

type IDPItem = {
  developmentNeeds?: string;
  competency?: string;
  actions?: IDPAction[];
};

type ObjectiveSettingGoal = {
  no: number;
  objectiveDetails: string;
  measure: string;
  startDate: string;
  endDate: string;
  milestone: string;
};

type ObjectiveSettingData = {
  goals: ObjectiveSettingGoal[];
};

type PerformanceReviewWhatRow = {
  no: number;
  target: string;
  coworkerComment: string;
  managerComment: string;
  coworkerRating: string;
  managerRating: string;
};

type PerformanceReviewHowRow = {
  value: string;
  coworkerComment: string;
  managerComment: string;
  coworkerRating: string;
  managerRating: string;
};

type PerformanceReviewData = {
  what: {
    targets: PerformanceReviewWhatRow[];
    overallCoworkerRating: string;
    overallManagerRating: string;
  };
  how: {
    values: PerformanceReviewHowRow[];
    overallCoworkerRating: string;
    overallManagerRating: string;
  };
  overallPerformanceRating: string;
  coworkerOverallComment: string;
  managerOverallComment: string;
  potentialRating: string;
  staircaseLevel: string;
};

type CareerPreferenceData = {
  strengthDevelopmentArea: string;
  employeeCareerAspiration: string;
  managerViewOnCareer: string;
  note: string;
  mobility: {
    preferredLocations: string;
    country: string;
    period: string;
    wouldRelocate: string;
  };
};

type DraftData = {
  items: IDPItem[];
  generalNotes: string;
  objectiveSetting: ObjectiveSettingData;
  performanceReview: PerformanceReviewData;
  careerPreference: CareerPreferenceData;
};

function buildDefaultObjectiveSetting(): ObjectiveSettingData {
  return {
    goals: Array.from({ length: 5 }).map((_, i) => ({
      no: i + 1,
      objectiveDetails: '',
      measure: '',
      startDate: '',
      endDate: '',
      milestone: '',
    })),
  };
}

function buildDefaultPerformanceReview(): PerformanceReviewData {
  return {
    what: {
      targets: Array.from({ length: 5 }).map((_, i) => ({
        no: i + 1,
        target: '',
        coworkerComment: '',
        managerComment: '',
        coworkerRating: '',
        managerRating: '',
      })),
      overallCoworkerRating: '',
      overallManagerRating: '',
    },
    how: {
      values: [
        'Nurturing',
        'Authenticity',
        'Tranquility',
        'Unity',
        'Resilence',
        'Exceptional',
      ].map((name) => ({
        value: name,
        coworkerComment: '',
        managerComment: '',
        coworkerRating: '',
        managerRating: '',
      })),
      overallCoworkerRating: '',
      overallManagerRating: '',
    },
    overallPerformanceRating: '',
    coworkerOverallComment: '',
    managerOverallComment: '',
    potentialRating: '',
    staircaseLevel: '',
  };
}

function buildDefaultCareerPreference(): CareerPreferenceData {
  return {
    strengthDevelopmentArea: '',
    employeeCareerAspiration: '',
    managerViewOnCareer: '',
    note: '',
    mobility: {
      preferredLocations: '',
      country: '',
      period: '',
      wouldRelocate: '',
    },
  };
}

function buildDefaultDraft(): DraftData {
  return {
    items: [],
    generalNotes: '',
    objectiveSetting: buildDefaultObjectiveSetting(),
    performanceReview: buildDefaultPerformanceReview(),
    careerPreference: buildDefaultCareerPreference(),
  };
}

export default function IDPPrintPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = Number(params?.id);
  const useDraft = searchParams?.get('useDraft') === '1';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [idp, setIdp] = useState<any | null>(null);
  const [guidelines, setGuidelines] = useState<{ title: string; header: string; text: string } | null>(null);
  const [idpGuidelines, setIdpGuidelines] = useState<{ title: string; header: string; text: string } | null>(null);
  const [sample, setSample] = useState<any | null>(null);
  const [competencySections, setCompetencySections] = useState<any[]>([]);
  const [draft, setDraft] = useState<DraftData>(() => buildDefaultDraft());

  useEffect(() => {
    if (!id || Number.isNaN(id)) {
      setError('ID tidak valid');
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        setLoading(true);
        setError('');

        if (useDraft) {
          try {
            const raw = localStorage.getItem(`idp_print_draft_${id}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              setDraft({
                items: Array.isArray(parsed?.items) ? parsed.items : [],
                generalNotes: typeof parsed?.generalNotes === 'string' ? parsed.generalNotes : '',
                objectiveSetting: parsed?.objectiveSetting || buildDefaultObjectiveSetting(),
                performanceReview: parsed?.performanceReview || buildDefaultPerformanceReview(),
                careerPreference: parsed?.careerPreference || buildDefaultCareerPreference(),
              });
            }
          } catch {}
        }

        const [idpRes, gRes, igRes, sRes, cRes] = await Promise.all([
          api.get(`/idp/${id}`),
          api.get('/idp/reference/guidelines'),
          api.get('/idp/reference/idp-guidelines'),
          api.get('/idp/reference/sample'),
          api.get('/idp/reference/competencies'),
        ]);

        setIdp(idpRes.data);
        setGuidelines(gRes.data);
        setIdpGuidelines(igRes.data);
        setSample(sRes.data);
        setCompetencySections(cRes.data?.sections || []);
      } catch (e: any) {
        setError(e.response?.data?.message || e.message || 'Gagal memuat data');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, useDraft]);

  const effective = useMemo(() => {
    if (useDraft) return draft;
    const base = buildDefaultDraft();
    return {
      items: Array.isArray(idp?.items) ? idp.items : base.items,
      generalNotes: typeof idp?.generalNotes === 'string' ? idp.generalNotes : base.generalNotes,
      objectiveSetting: idp?.objectiveSetting || base.objectiveSetting,
      performanceReview: idp?.performanceReview || base.performanceReview,
      careerPreference: idp?.careerPreference || base.careerPreference,
    } as DraftData;
  }, [draft, idp, useDraft]);

  const printNow = () => window.print();

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-gray-500">Memuat...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-red-600">{error}</div>
      </div>
    );
  }

  const renderSectionHeader = (title: string, subtitle?: string) => (
    <div className="mb-4">
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      {subtitle ? <p className="text-sm text-gray-500 mt-1">{subtitle}</p> : null}
    </div>
  );

  const userName = idp?.user?.name || '';
  const userDept = idp?.user?.department || '';
  const userRole = idp?.user?.role || '';
  const userId = idp?.user?.id || '';
  const managerName = idp?.createdBy?.name || '';
  const year = idp?.year || '';

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 1.5cm;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print-no-border {
            border: none !important;
          }
          .print-no-shadow {
            box-shadow: none !important;
          }
          .print-p-0 {
            padding: 0 !important;
          }
          .print-mt-0 {
            margin-top: 0 !important;
          }
          body {
            background-color: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            overflow: visible !important;
            height: auto !important;
          }
          html {
            overflow: visible !important;
            height: auto !important;
          }
          /* Remove any scrollbars from containers during print */
          * {
            overflow: visible !important;
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
          }
          *::-webkit-scrollbar {
            display: none !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          .print-page-break {
            break-before: page;
            page-break-before: always;
          }
        }
        .idp-table th, .idp-table td {
          border: 1px solid #e2e8f0;
        }
        .idp-table th {
          background-color: #f8fafc;
        }
      `}</style>

      {/* Floating Action Button for Print */}
      <div className="fixed bottom-8 right-8 print:hidden flex gap-3">
        <button
          onClick={() => window.close()}
          className="bg-gray-100 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all shadow-lg"
        >
          Tutup
        </button>
        <button
          onClick={printNow}
          className="bg-[#0F4D39] text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-[#0a3628] transition-all shadow-lg"
        >
          <Printer size={20} />
          Cetak Dokumen
        </button>
      </div>

      <div className="max-w-[1000px] mx-auto p-8 print:p-0 print:max-w-none">
        {/* Document Header */}
        <div className="flex justify-between items-center border-b-2 border-[#0F4D39] pb-6 mb-8">
          <div className="flex items-center gap-4">
            <img src="/logo.png" alt="Logo" className="h-16 w-auto object-contain" />
            <div>
              <h1 className="text-2xl font-bold text-[#0F4D39]">THE LODGE MARIBAYA</h1>
              <p className="text-sm font-semibold tracking-widest text-gray-500 uppercase">Individual Development Plan</p>
            </div>
          </div>
          <div className="text-right">
            <div className="inline-block bg-[#0F4D39] text-white px-4 py-1 text-sm font-bold rounded mb-1">
              IDP YEAR: {year}
            </div>
            <p className="text-xs text-gray-400 italic">Printed on {new Date().toLocaleDateString('id-ID', { dateStyle: 'long' })}</p>
          </div>
        </div>

        {/* Co-Worker Details */}
        <div className="mb-10">
          <h2 className="text-sm font-bold text-white bg-[#0F4D39] px-4 py-1 inline-block rounded-t-lg mb-0 uppercase tracking-wider">
            Employee Information
          </h2>
          <div className="border-2 border-[#0F4D39] rounded-tr-lg rounded-b-lg p-6 grid grid-cols-2 gap-y-4 gap-x-12">
            <div className="flex border-b border-gray-100 pb-2">
              <span className="text-xs font-bold text-gray-400 w-32 uppercase">Name</span>
              <span className="text-sm font-semibold text-gray-800">: {userName}</span>
            </div>
            <div className="flex border-b border-gray-100 pb-2">
              <span className="text-xs font-bold text-gray-400 w-32 uppercase">Employee ID</span>
              <span className="text-sm font-semibold text-gray-800">: {userId}</span>
            </div>
            <div className="flex border-b border-gray-100 pb-2">
              <span className="text-xs font-bold text-gray-400 w-32 uppercase">Department</span>
              <span className="text-sm font-semibold text-gray-800">: {userDept}</span>
            </div>
            <div className="flex border-b border-gray-100 pb-2">
              <span className="text-xs font-bold text-gray-400 w-32 uppercase">Position</span>
              <span className="text-sm font-semibold text-gray-800">: {userRole}</span>
            </div>
            <div className="flex border-b border-gray-100 pb-2 col-span-2">
              <span className="text-xs font-bold text-gray-400 w-32 uppercase">Manager / Reviewer</span>
              <span className="text-sm font-semibold text-gray-800">: {managerName}</span>
            </div>
          </div>
        </div>

        {/* Section 1: Objective Setting */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#0F4D39] text-white flex items-center justify-center font-bold">1</div>
            <h2 className="text-lg font-bold text-gray-800">OBJECTIVE SETTING</h2>
          </div>
          <table className="w-full idp-table border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase w-12">No</th>
                <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase">Objective Details</th>
                <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase">Measure</th>
                <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase w-24">Start Date</th>
                <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase w-24">End Date</th>
                <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase">Milestone</th>
              </tr>
            </thead>
            <tbody>
              {(effective.objectiveSetting?.goals || buildDefaultObjectiveSetting().goals).map((g, idx) => (
                <tr key={idx}>
                  <td className="p-3 text-sm text-gray-700 text-center">{g.no || idx + 1}</td>
                  <td className="p-3 text-sm text-gray-800 font-medium whitespace-pre-wrap leading-relaxed">{g.objectiveDetails || '-'}</td>
                  <td className="p-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{g.measure || '-'}</td>
                  <td className="p-3 text-sm text-gray-700 text-center">{g.startDate || '-'}</td>
                  <td className="p-3 text-sm text-gray-700 text-center">{g.endDate || '-'}</td>
                  <td className="p-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{g.milestone || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Section 2: IDP */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-[#0F4D39] text-white flex items-center justify-center font-bold">2</div>
            <h2 className="text-lg font-bold text-gray-800">INDIVIDUAL DEVELOPMENT PLAN (IDP)</h2>
          </div>
          <table className="w-full idp-table border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase w-48">Development Needs</th>
                <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase w-40">Competency</th>
                <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase w-32">Type</th>
                <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase">Action / Description</th>
                <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase w-32">PIC</th>
                <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase w-24">Start</th>
                <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase w-24">End</th>
              </tr>
            </thead>
            <tbody>
              {(effective.items || []).flatMap((it, idx) => {
                const actions = Array.isArray(it.actions) ? it.actions : [];
                if (actions.length === 0) {
                  return [
                    <tr key={`${idx}-empty`}>
                      <td className="p-3 text-sm text-gray-800 font-medium whitespace-pre-wrap">{it.developmentNeeds || '-'}</td>
                      <td className="p-3 text-sm text-gray-700 whitespace-pre-wrap">{it.competency || '-'}</td>
                      <td colSpan={5} className="p-3 text-sm text-gray-400 italic text-center">Belum ada tindakan pengembangan</td>
                    </tr>,
                  ];
                }
                return actions.map((a, aIdx) => (
                  <tr key={`${idx}-${aIdx}`}>
                    {aIdx === 0 && (
                      <>
                        <td className="p-3 text-sm text-gray-800 font-medium whitespace-pre-wrap align-top" rowSpan={actions.length}>
                          {it.developmentNeeds || '-'}
                        </td>
                        <td className="p-3 text-sm text-gray-700 whitespace-pre-wrap align-top" rowSpan={actions.length}>
                          {it.competency || '-'}
                        </td>
                      </>
                    )}
                    <td className="p-3 text-[10px] text-gray-800 font-bold whitespace-pre-wrap leading-tight">{a.label || a.type}</td>
                    <td className="p-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{a.description || '-'}</td>
                    <td className="p-3 text-sm text-gray-700 whitespace-pre-wrap">{a.responsibility || '-'}</td>
                    <td className="p-3 text-sm text-gray-700 text-center">{a.startDate || '-'}</td>
                    <td className="p-3 text-sm text-gray-700 text-center">{a.endDate || '-'}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
          {effective.generalNotes && (
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">General Notes</p>
              <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{effective.generalNotes}</div>
            </div>
          )}
        </div>

        <div className="print-page-break" />

        {/* Section 3: Performance Review */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-[#0F4D39] text-white flex items-center justify-center font-bold">3</div>
            <h2 className="text-lg font-bold text-gray-800">PERFORMANCE REVIEW</h2>
          </div>

          <div className="mb-8">
            <h3 className="text-sm font-bold text-[#0F4D39] border-l-4 border-[#0F4D39] pl-3 mb-3 uppercase tracking-wider">The “What” - Targets</h3>
            <table className="w-full idp-table border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase">Target Description</th>
                  <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase">Co-Worker Comment</th>
                  <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase">Manager Comment</th>
                  <th className="p-3 text-center text-[10px] font-bold text-gray-500 uppercase w-16">CW</th>
                  <th className="p-3 text-center text-[10px] font-bold text-gray-500 uppercase w-16">MGR</th>
                </tr>
              </thead>
              <tbody>
                {(effective.performanceReview?.what?.targets || buildDefaultPerformanceReview().what.targets).map((row, idx) => (
                  <tr key={idx}>
                    <td className="p-3 text-sm text-gray-800 font-medium whitespace-pre-wrap leading-relaxed">{row.target || '-'}</td>
                    <td className="p-3 text-sm text-gray-600 whitespace-pre-wrap italic">{row.coworkerComment || '-'}</td>
                    <td className="p-3 text-sm text-gray-700 whitespace-pre-wrap font-medium">{row.managerComment || '-'}</td>
                    <td className="p-3 text-sm font-bold text-center text-gray-700">{row.coworkerRating || '-'}</td>
                    <td className="p-3 text-sm font-bold text-center text-[#0F4D39]">{row.managerRating || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-8">
            <h3 className="text-sm font-bold text-[#0F4D39] border-l-4 border-[#0F4D39] pl-3 mb-3 uppercase tracking-wider">The “How” - Values</h3>
            <table className="w-full idp-table border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase w-40">Value</th>
                  <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase">Co-Worker Comment</th>
                  <th className="p-3 text-left text-[10px] font-bold text-gray-500 uppercase">Manager Comment</th>
                  <th className="p-3 text-center text-[10px] font-bold text-gray-500 uppercase w-16">CW</th>
                  <th className="p-3 text-center text-[10px] font-bold text-gray-500 uppercase w-16">MGR</th>
                </tr>
              </thead>
              <tbody>
                {(effective.performanceReview?.how?.values || buildDefaultPerformanceReview().how.values).map((row, idx) => (
                  <tr key={idx}>
                    <td className="p-3 text-sm text-gray-800 font-bold uppercase">{row.value || '-'}</td>
                    <td className="p-3 text-sm text-gray-600 whitespace-pre-wrap italic">{row.coworkerComment || '-'}</td>
                    <td className="p-3 text-sm text-gray-700 whitespace-pre-wrap font-medium">{row.managerComment || '-'}</td>
                    <td className="p-3 text-sm font-bold text-center text-gray-700">{row.coworkerRating || '-'}</td>
                    <td className="p-3 text-sm font-bold text-center text-[#0F4D39]">{row.managerRating || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="p-5 border-2 border-gray-100 rounded-xl bg-gray-50/50">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-200 pb-2">Overall Co-Worker Comment</p>
              <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed italic">
                {effective.performanceReview?.coworkerOverallComment || '-'}
              </div>
            </div>
            <div className="p-5 border-2 border-[#0F4D39]/10 rounded-xl bg-[#0F4D39]/5">
              <p className="text-[10px] font-bold text-[#0F4D39] uppercase tracking-widest mb-3 border-b border-[#0F4D39]/10 pb-2">Overall Manager Comment</p>
              <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-medium">
                {effective.performanceReview?.managerOverallComment || '-'}
              </div>
            </div>
          </div>
        </div>

        <div className="print-page-break" />

        {/* Section 4: Career Preference */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-[#0F4D39] text-white flex items-center justify-center font-bold">4</div>
            <h2 className="text-lg font-bold text-gray-800">CAREER PREFERENCE</h2>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="border border-gray-200 rounded-xl p-6">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Strength & Development Area</p>
                <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {effective.careerPreference?.strengthDevelopmentArea || '-'}
                </div>
              </div>
              <div className="border border-gray-200 rounded-xl p-6">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Employee&apos;s Career Aspiration</p>
                <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {effective.careerPreference?.employeeCareerAspiration || '-'}
                </div>
              </div>
              <div className="border border-[#0F4D39]/20 rounded-xl p-6 bg-[#0F4D39]/5">
                <p className="text-[10px] font-bold text-[#0F4D39] uppercase tracking-widest mb-2">Manager View on Career</p>
                <div className="text-sm text-gray-800 font-medium whitespace-pre-wrap leading-relaxed">
                  {effective.careerPreference?.managerViewOnCareer || '-'}
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Geographic Mobility</p>
              </div>
              <div className="p-6 grid grid-cols-4 gap-8">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Preferred Locations</p>
                  <p className="text-sm font-semibold text-gray-800">{effective.careerPreference?.mobility?.preferredLocations || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Country</p>
                  <p className="text-sm font-semibold text-gray-800">{effective.careerPreference?.mobility?.country || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Period</p>
                  <p className="text-sm font-semibold text-gray-800">{effective.careerPreference?.mobility?.period || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Relocation Interest</p>
                  <p className="text-sm font-semibold text-gray-800">{effective.careerPreference?.mobility?.wouldRelocate || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Signature Section */}
        <div className="mt-20">
          <div className="grid grid-cols-2 gap-32">
            <div className="text-center">
              <p className="text-sm font-bold text-gray-800 mb-20 uppercase tracking-widest">Co-Worker / Employee</p>
              <div className="border-b-2 border-gray-300 w-full mb-2"></div>
              <p className="text-sm font-bold text-gray-800 uppercase">{userName}</p>
              <p className="text-[10px] text-gray-500 mt-1 italic">Tanggal: ___________________</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-800 mb-20 uppercase tracking-widest">Manager / Reviewer</p>
              <div className="border-b-2 border-gray-300 w-full mb-2"></div>
              <p className="text-sm font-bold text-gray-800 uppercase">{managerName}</p>
              <p className="text-[10px] text-gray-500 mt-1 italic">Tanggal: ___________________</p>
            </div>
          </div>
          <div className="mt-16 text-center">
             <div className="inline-block border-2 border-[#0F4D39] px-8 py-2">
                <p className="text-[10px] font-bold text-[#0F4D39] uppercase tracking-[0.3em]">Official IDP Document - The Lodge Ranger</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
