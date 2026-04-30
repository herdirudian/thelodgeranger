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
  const useDraft = searchParams.get('useDraft') === '1';

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
  const year = idp?.year || '';

  return (
    <div className="p-8 print:p-0">
      <style jsx global>{`
        @media print {
          .print\\:hidden {
            display: none !important;
          }
          .print\\:p-0 {
            padding: 0 !important;
          }
          .print-page-break {
            break-before: page;
            page-break-before: always;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="flex items-start justify-between gap-4 mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cetak IDP</h1>
          <p className="text-gray-500">
            {userName} {userDept ? `• ${userDept}` : ''} {year ? `• ${year}` : ''}
          </p>
        </div>
        <button
          onClick={printNow}
          className="inline-flex items-center gap-2 bg-[#0F4D39] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0a3628] transition-all"
        >
          <Printer size={18} />
          Print / Save as PDF
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {renderSectionHeader('Guideline', guidelines?.header)}
        <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{guidelines?.text || ''}</div>
      </div>

      <div className="print-page-break" />

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {renderSectionHeader('Objective Setting')}
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-12">No</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Objective</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Measure</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Start</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-28">End</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Milestone</th>
              </tr>
            </thead>
            <tbody>
              {(effective.objectiveSetting?.goals || buildDefaultObjectiveSetting().goals).map((g, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="px-3 py-2 text-sm text-gray-700">{g.no || idx + 1}</td>
                  <td className="px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">{g.objectiveDetails || ''}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{g.measure || ''}</td>
                  <td className="px-3 py-2 text-sm text-gray-700">{g.startDate || ''}</td>
                  <td className="px-3 py-2 text-sm text-gray-700">{g.endDate || ''}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{g.milestone || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="print-page-break" />

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {renderSectionHeader('Individual Development Plan (IDP)')}
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-72">Development Needs</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">Competency</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Type</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-48">Responsibility</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Start</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-28">End</th>
              </tr>
            </thead>
            <tbody>
              {(effective.items || []).flatMap((it, idx) => {
                const actions = Array.isArray(it.actions) ? it.actions : [];
                if (actions.length === 0) {
                  return [
                    <tr key={`${idx}-empty`} className="border-b border-gray-100">
                      <td className="px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">{it.developmentNeeds || ''}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{it.competency || ''}</td>
                      <td className="px-3 py-2 text-sm text-gray-700" />
                      <td className="px-3 py-2 text-sm text-gray-700" />
                      <td className="px-3 py-2 text-sm text-gray-700" />
                      <td className="px-3 py-2 text-sm text-gray-700" />
                      <td className="px-3 py-2 text-sm text-gray-700" />
                    </tr>,
                  ];
                }
                return actions.map((a, aIdx) => (
                  <tr key={`${idx}-${aIdx}`} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">{aIdx === 0 ? it.developmentNeeds || '' : ''}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{aIdx === 0 ? it.competency || '' : ''}</td>
                    <td className="px-3 py-2 text-sm text-gray-800 font-semibold whitespace-pre-wrap">{a.label || a.type}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{a.description || ''}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{a.responsibility || ''}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{a.startDate || ''}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{a.endDate || ''}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 whitespace-pre-wrap text-sm text-gray-700">{effective.generalNotes || ''}</div>
      </div>

      <div className="print-page-break" />

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {renderSectionHeader('Performance Review')}
        <h2 className="text-sm font-bold text-gray-800 mt-2 mb-2">The “What”</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Target</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Co-worker comment</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Manager comment</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-20">CW</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-20">MGR</th>
              </tr>
            </thead>
            <tbody>
              {(effective.performanceReview?.what?.targets || buildDefaultPerformanceReview().what.targets).map((row, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{row.target || ''}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{row.coworkerComment || ''}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{row.managerComment || ''}</td>
                  <td className="px-3 py-2 text-sm text-gray-700">{row.coworkerRating || ''}</td>
                  <td className="px-3 py-2 text-sm text-gray-700">{row.managerRating || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="text-sm font-bold text-gray-800 mt-6 mb-2">The “How”</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">Value</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Co-worker comment</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Manager comment</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-20">CW</th>
                <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-20">MGR</th>
              </tr>
            </thead>
            <tbody>
              {(effective.performanceReview?.how?.values || buildDefaultPerformanceReview().how.values).map((row, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="px-3 py-2 text-sm text-gray-800 font-semibold whitespace-pre-wrap">{row.value || ''}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{row.coworkerComment || ''}</td>
                  <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{row.managerComment || ''}</td>
                  <td className="px-3 py-2 text-sm text-gray-700">{row.coworkerRating || ''}</td>
                  <td className="px-3 py-2 text-sm text-gray-700">{row.managerRating || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Co-worker overall comment</p>
            <div className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
              {effective.performanceReview?.coworkerOverallComment || ''}
            </div>
          </div>
          <div className="border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Manager overall comment</p>
            <div className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
              {effective.performanceReview?.managerOverallComment || ''}
            </div>
          </div>
        </div>
      </div>

      <div className="print-page-break" />

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {renderSectionHeader('Career Preference')}
        <div className="grid grid-cols-1 gap-4">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Strength & Development Area</p>
            <div className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{effective.careerPreference?.strengthDevelopmentArea || ''}</div>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Employee&apos;s Career Aspiration</p>
            <div className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{effective.careerPreference?.employeeCareerAspiration || ''}</div>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Manager view on career</p>
            <div className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{effective.careerPreference?.managerViewOnCareer || ''}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Geographic Mobility</p>
              <div className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{effective.careerPreference?.mobility?.preferredLocations || ''}</div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Country</p>
              <div className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{effective.careerPreference?.mobility?.country || ''}</div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Period</p>
              <div className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{effective.careerPreference?.mobility?.period || ''}</div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Would you relocate?</p>
              <div className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{effective.careerPreference?.mobility?.wouldRelocate || ''}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="print-page-break" />

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {renderSectionHeader('IDP - Guidelines', idpGuidelines?.header)}
        <div className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{idpGuidelines?.text || ''}</div>
      </div>

      <div className="print-page-break" />

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {renderSectionHeader('IDP - Sample')}
        {sample ? (
          <div className="space-y-4">
            {(sample.items || []).map((it: any, idx: number) => (
              <div key={idx} className="border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Development Needs</p>
                <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{it.developmentNeeds || ''}</div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-4">Competency</p>
                <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{it.competency || ''}</div>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full border border-gray-200">
                    <thead className="bg-gray-50">
                      <tr className="border-b border-gray-200">
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">Type</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">Responsibility</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Start</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-28">End</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(it.actions || []).map((a: any, aIdx: number) => (
                        <tr key={aIdx} className="border-b border-gray-100">
                          <td className="px-3 py-2 text-sm text-gray-800 font-semibold">{a.label || a.type}</td>
                          <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{a.description || ''}</td>
                          <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{a.responsibility || ''}</td>
                          <td className="px-3 py-2 text-sm text-gray-700">{a.startDate || ''}</td>
                          <td className="px-3 py-2 text-sm text-gray-700">{a.endDate || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
            {sample.note ? <div className="whitespace-pre-wrap text-sm text-gray-700">{sample.note}</div> : null}
          </div>
        ) : (
          <div className="text-sm text-gray-500">Data tidak tersedia.</div>
        )}
      </div>

      <div className="print-page-break" />

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {renderSectionHeader('Competencies')}
        <div className="space-y-6">
          {competencySections.map((sec: any, idx: number) => (
            <div key={idx} className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <p className="font-bold text-gray-800">{sec.title}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-white">
                    <tr className="border-b border-gray-100">
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-72">Department</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-64">Competency Area</th>
                      <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sec.rows || []).map((r: any, rIdx: number) => (
                      <tr key={rIdx} className="border-b border-gray-100">
                        <td className="px-3 py-2 text-sm text-gray-800">{r.department || ''}</td>
                        <td className="px-3 py-2 text-sm text-gray-800 font-semibold">{r.competencyArea || ''}</td>
                        <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{r.description || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="print-page-break" />

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        {renderSectionHeader('Summary')}
        <div className="space-y-6">
          <div>
            <p className="text-sm font-bold text-[#0F4D39]">SUMMARY FOR HR</p>
            <p className="text-xs text-gray-500 mt-1">CO-WORKER DETAILS</p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">ID</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Position</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Manager</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 text-sm text-gray-800">{idp?.user?.name || '-'}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{idp?.user?.id || '-'}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{idp?.user?.role || '-'}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{idp?.createdBy?.name || '-'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-[#0F4D39]">OBJECTIVE SETTING</p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[320px]">Objectives</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[240px]">Measures</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Start Date</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-28">End Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(effective.objectiveSetting?.goals || buildDefaultObjectiveSetting().goals).map((g, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{g.objectiveDetails || ''}</td>
                      <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{g.measure || ''}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{g.startDate || ''}</td>
                      <td className="px-3 py-2 text-sm text-gray-700">{g.endDate || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-[#0F4D39]">INDIVIDUAL DEVELOPMENT PLAN (IDP)</p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Co-worker ID</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">Name</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[260px]">Development Needs</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">Competencies 1</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">Competencies 2</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-44">Formal Training (10%)</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">Mentoring & Coaching (20%)</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-36">OJT (70%)</th>
                  </tr>
                </thead>
                <tbody>
                  {(effective.items || []).map((it: any, idx: number) => {
                    const raw = String(it?.competency || '');
                    const parts = raw
                      .split(/\r?\n|,|;|\s+-\s+/)
                      .map((s) => s.trim())
                      .filter(Boolean);
                    const c1 = parts[0] || '';
                    const c2 = parts[1] || '';
                    const actions = Array.isArray(it?.actions) ? it.actions : [];
                    const isFilled = (a: any) =>
                      String(a?.description || '').trim() ||
                      String(a?.responsibility || '').trim() ||
                      String(a?.startDate || '').trim() ||
                      String(a?.endDate || '').trim();
                    const countType = (t: string) => actions.filter((a: any) => a?.type === t && isFilled(a)).length;

                    return (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="px-3 py-2 text-sm text-gray-700">{idp?.user?.id || ''}</td>
                        <td className="px-3 py-2 text-sm text-gray-800">{idp?.user?.name || ''}</td>
                        <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{it?.developmentNeeds || ''}</td>
                        <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{c1}</td>
                        <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{c2}</td>
                        <td className="px-3 py-2 text-sm text-gray-700">{countType('FORMAL_TRAINING') || 0}</td>
                        <td className="px-3 py-2 text-sm text-gray-700">{countType('MENTORING_COACHING') || 0}</td>
                        <td className="px-3 py-2 text-sm text-gray-700">{countType('OJT') || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-[#0F4D39]">CAREER PREFERENCE</p>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[260px]">Strength & Development Area</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[260px]">Employee&apos;s Career Aspiration</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[260px]">Manager view on career</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">Geographic Mobility</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-40">Country</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-40">Period</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">Would you be interested?</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{effective.careerPreference?.strengthDevelopmentArea || ''}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{effective.careerPreference?.employeeCareerAspiration || ''}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{effective.careerPreference?.managerViewOnCareer || ''}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{effective.careerPreference?.mobility?.preferredLocations || ''}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{effective.careerPreference?.mobility?.country || ''}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{effective.careerPreference?.mobility?.period || ''}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">{effective.careerPreference?.mobility?.wouldRelocate || ''}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
