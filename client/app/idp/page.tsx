'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Target, Plus, Save, Send, Search, Filter, Printer } from 'lucide-react';

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

const IDP_ACTION_TEMPLATES: Array<{ type: string; label: string }> = [
  { type: 'FORMAL_TRAINING', label: 'Formal Training (10%)' },
  { type: 'MENTORING_COACHING', label: 'Mentoring & Coaching (20%)' },
  { type: 'OJT', label: 'OJT (70%)' },
];

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

function isManagerRole(role?: string) {
  if (!role) return false;
  return [
    'GM',
    'HR',
    'HOD',
    'ADMIN',
    'SUPERVISOR',
    'PHOTOGRAPHER_HOD',
    'MERCHANDISE_HOD',
    'MERCHANDISE_SPV',
  ].includes(role);
}

function buildDefaultItems() {
  return Array.from({ length: 4 }).map(() => ({
    developmentNeeds: '',
    competency: '',
    actions: IDP_ACTION_TEMPLATES.map((a) => ({
      type: a.type,
      label: a.label,
      description: '',
      responsibility: '',
      startDate: '',
      endDate: '',
    })),
  }));
}

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

function buildEmptyItem(): IDPItem {
  return {
    developmentNeeds: '',
    competency: '',
    actions: IDP_ACTION_TEMPLATES.map((a) => ({
      type: a.type,
      label: a.label,
      description: '',
      responsibility: '',
      startDate: '',
      endDate: '',
    })),
  };
}

function getCurrentYear() {
  return new Date().getFullYear();
}

const IDPItemGroup = memo(function IDPItemGroup({
  item,
  index,
  readOnly,
  onNeedsChange,
  onCompetencyChange,
  onActionChange,
}: {
  item: IDPItem;
  index: number;
  readOnly: boolean;
  onNeedsChange: (idx: number, value: string) => void;
  onCompetencyChange: (idx: number, value: string) => void;
  onActionChange: (itemIdx: number, actionIdx: number, field: keyof IDPAction, value: string) => void;
}) {
  const initialActions = Array.isArray(item.actions) ? item.actions : [];

  const actions = initialActions;

  return (
    <>
      {actions.map((action, aIdx) => (
        <tr key={`${index}-${aIdx}`} className="border-b border-gray-100">
          {aIdx === 0 && (
            <>
              <td className="px-4 py-3 align-top" rowSpan={actions.length}>
                <textarea
                  name={`needs-${index}`}
                  defaultValue={item.developmentNeeds || ''}
                  onChange={(e) => onNeedsChange(index, e.target.value)}
                  className="w-full min-h-[104px] px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all"
                  placeholder="Isi kebutuhan pengembangan..."
                  disabled={readOnly}
                />
              </td>
              <td className="px-4 py-3 align-top" rowSpan={actions.length}>
                <input
                  type="text"
                  name={`competency-${index}`}
                  defaultValue={item.competency || ''}
                  onChange={(e) => onCompetencyChange(index, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all"
                  placeholder="Pilih / isi kompetensi..."
                  disabled={readOnly}
                />
                <p className="text-xs text-gray-400 mt-2">Berdasarkan Profil Kompetensi Anda.</p>
              </td>
            </>
          )}

          <td className="px-4 py-3 align-top">
            <div className="text-sm font-semibold text-gray-700">{action.label || action.type}</div>
          </td>
          <td className="px-4 py-3 align-top">
            <textarea
              name={`desc-${index}-${aIdx}`}
              defaultValue={action.description || ''}
              onChange={(e) => onActionChange(index, aIdx, 'description', e.target.value)}
              className="w-full min-h-[72px] px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all"
              placeholder="Deskripsi tindakan pengembangan..."
              disabled={readOnly}
            />
          </td>
          <td className="px-4 py-3 align-top">
            <input
              type="text"
              name={`resp-${index}-${aIdx}`}
              defaultValue={action.responsibility || ''}
              onChange={(e) => onActionChange(index, aIdx, 'responsibility', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all"
              placeholder="PIC / tanggung jawab..."
              disabled={readOnly}
            />
          </td>
          <td className="px-4 py-3 align-top">
            <input
              type="date"
              name={`start-${index}-${aIdx}`}
              defaultValue={action.startDate || ''}
              onChange={(e) => onActionChange(index, aIdx, 'startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all"
              disabled={readOnly}
            />
          </td>
          <td className="px-4 py-3 align-top">
            <input
              type="date"
              name={`end-${index}-${aIdx}`}
              defaultValue={action.endDate || ''}
              onChange={(e) => onActionChange(index, aIdx, 'endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all"
              disabled={readOnly}
            />
          </td>
        </tr>
      ))}
    </>
  );
});

export default function IDPPage() {
  const { user } = useAuth();
  const canManage = isManagerRole(user?.role);

  const [activeTab, setActiveTab] = useState<'my' | 'manage'>(canManage ? 'manage' : 'my');

  const [myIDPs, setMyIDPs] = useState<any[]>([]);
  const [manageIDPs, setManageIDPs] = useState<any[]>([]);
  const [loadingMy, setLoadingMy] = useState(false);
  const [loadingManage, setLoadingManage] = useState(false);

  const [selectedIdp, setSelectedIdp] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [manageDept, setManageDept] = useState('');
  const [manageYear, setManageYear] = useState(String(getCurrentYear()));
  const [manageStatus, setManageStatus] = useState('');
  const [manageSearch, setManageSearch] = useState('');

  const draftRef = useRef<{
    items: IDPItem[];
    generalNotes: string;
    objectiveSetting: ObjectiveSettingData;
    performanceReview: PerformanceReviewData;
    careerPreference: CareerPreferenceData;
  }>({
    items: buildDefaultItems(),
    generalNotes: '',
    objectiveSetting: buildDefaultObjectiveSetting(),
    performanceReview: buildDefaultPerformanceReview(),
    careerPreference: buildDefaultCareerPreference(),
  });

  const [editorSeed, setEditorSeed] = useState<{
    key: number;
    items: IDPItem[];
    generalNotes: string;
    objectiveSetting: ObjectiveSettingData;
    performanceReview: PerformanceReviewData;
    careerPreference: CareerPreferenceData;
  }>({
    key: 0,
    items: buildDefaultItems(),
    generalNotes: '',
    objectiveSetting: buildDefaultObjectiveSetting(),
    performanceReview: buildDefaultPerformanceReview(),
    careerPreference: buildDefaultCareerPreference(),
  });

  const [editorSection, setEditorSection] = useState<
    'OBJECTIVE' | 'IDP' | 'REVIEW' | 'CAREER' | 'SUMMARY' | 'GUIDELINES' | 'IDP_GUIDELINES' | 'SAMPLE' | 'COMPETENCIES'
  >('OBJECTIVE');

  const [guidelines, setGuidelines] = useState<{ title: string; header: string; text: string } | null>(null);
  const [idpGuidelines, setIdpGuidelines] = useState<{ title: string; header: string; text: string } | null>(null);
  const [sample, setSample] = useState<any | null>(null);
  const [competencySections, setCompetencySections] = useState<any[]>([]);
  const [competencySearch, setCompetencySearch] = useState('');
  const [loadingGuidelines, setLoadingGuidelines] = useState(false);
  const [loadingIdpGuidelines, setLoadingIdpGuidelines] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [loadingCompetencies, setLoadingCompetencies] = useState(false);

  const years = useMemo(() => {
    const y = getCurrentYear();
    return [y - 1, y, y + 1].map(String);
  }, []);

  const filteredCompetencySections = useMemo(() => {
    const q = competencySearch.trim().toLowerCase();
    if (!q) return competencySections;
    return competencySections
      .map((s: any) => {
        const rows = Array.isArray(s.rows) ? s.rows : [];
        const filteredRows = rows.filter((r: any) => {
          const dep = String(r.department || '').toLowerCase();
          const area = String(r.competencyArea || '').toLowerCase();
          const desc = String(r.description || '').toLowerCase();
          return dep.includes(q) || area.includes(q) || desc.includes(q);
        });
        return { ...s, rows: filteredRows };
      })
      .filter((s: any) => Array.isArray(s.rows) && s.rows.length > 0);
  }, [competencySearch, competencySections]);

  useEffect(() => {
    fetchMy();
    if (canManage) fetchManage();
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!selectedIdp) return;

      if (editorSection === 'GUIDELINES' && !guidelines && !loadingGuidelines) {
        try {
          setLoadingGuidelines(true);
          const res = await api.get('/idp/reference/guidelines');
          setGuidelines(res.data);
        } catch (e: any) {
          alert('Gagal memuat IDP Guidelines: ' + (e.response?.data?.error || e.response?.data?.message || e.message));
        } finally {
          setLoadingGuidelines(false);
        }
      }

      if (editorSection === 'IDP_GUIDELINES' && !idpGuidelines && !loadingIdpGuidelines) {
        try {
          setLoadingIdpGuidelines(true);
          const res = await api.get('/idp/reference/idp-guidelines');
          setIdpGuidelines(res.data);
        } catch (e: any) {
          alert('Gagal memuat IDP - Guidelines: ' + (e.response?.data?.error || e.response?.data?.message || e.message));
        } finally {
          setLoadingIdpGuidelines(false);
        }
      }

      if (editorSection === 'SAMPLE' && !sample && !loadingSample) {
        try {
          setLoadingSample(true);
          const res = await api.get('/idp/reference/sample');
          setSample(res.data);
        } catch (e: any) {
          alert('Gagal memuat IDP Sample: ' + (e.response?.data?.error || e.response?.data?.message || e.message));
        } finally {
          setLoadingSample(false);
        }
      }

      if (editorSection === 'COMPETENCIES' && competencySections.length === 0 && !loadingCompetencies) {
        try {
          setLoadingCompetencies(true);
          const res = await api.get('/idp/reference/competencies');
          setCompetencySections(res.data?.sections || []);
        } catch (e: any) {
          alert('Gagal memuat Competencies: ' + (e.response?.data?.error || e.response?.data?.message || e.message));
        } finally {
          setLoadingCompetencies(false);
        }
      }
    };

    load();
  }, [
    editorSection,
    selectedIdp,
    guidelines,
    idpGuidelines,
    sample,
    competencySections.length,
    loadingGuidelines,
    loadingIdpGuidelines,
    loadingSample,
    loadingCompetencies,
  ]);

  const fetchMy = async () => {
    try {
      setLoadingMy(true);
      const res = await api.get('/idp/me');
      setMyIDPs(res.data || []);
    } catch (e: any) {
      alert('Gagal memuat IDP: ' + (e.response?.data?.error || e.response?.data?.message || e.message));
    } finally {
      setLoadingMy(false);
    }
  };

  const fetchManage = async () => {
    try {
      setLoadingManage(true);
      const params: any = {};
      if (manageDept) params.department = manageDept;
      if (manageYear) params.year = manageYear;
      if (manageStatus) params.status = manageStatus;
      if (manageSearch) params.search = manageSearch;
      const res = await api.get('/idp/manage', { params });
      setManageIDPs(res.data || []);
    } catch (e: any) {
      alert('Gagal memuat IDP (manage): ' + (e.response?.data?.error || e.response?.data?.message || e.message));
    } finally {
      setLoadingManage(false);
    }
  };

  const openIDP = async (id: number) => {
    try {
      const res = await api.get(`/idp/${id}`);
      const idp = res.data;
      setSelectedIdp(idp);
      const items = Array.isArray(idp?.items) ? idp.items : buildDefaultItems();
      const generalNotes = typeof idp?.generalNotes === 'string' ? idp.generalNotes : '';
      const objectiveSetting: ObjectiveSettingData = idp?.objectiveSetting || buildDefaultObjectiveSetting();
      const performanceReview: PerformanceReviewData = idp?.performanceReview || buildDefaultPerformanceReview();
      const careerPreference: CareerPreferenceData = idp?.careerPreference || buildDefaultCareerPreference();

      draftRef.current = {
        items: JSON.parse(JSON.stringify(items)),
        generalNotes,
        objectiveSetting: JSON.parse(JSON.stringify(objectiveSetting)),
        performanceReview: JSON.parse(JSON.stringify(performanceReview)),
        careerPreference: JSON.parse(JSON.stringify(careerPreference)),
      };
      setEditorSeed({
        key: idp.id,
        items,
        generalNotes,
        objectiveSetting,
        performanceReview,
        careerPreference,
      });
      setEditorSection('IDP');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e: any) {
      alert('Gagal membuka IDP: ' + (e.response?.data?.error || e.response?.data?.message || e.message));
    }
  };

  const createNewIDP = async () => {
    try {
      const res = await api.post('/idp', { year: getCurrentYear() });
      await fetchMy();
      if (canManage) await fetchManage();
      await openIDP(res.data.id);
    } catch (e: any) {
      alert('Gagal membuat IDP: ' + (e.response?.data?.error || e.response?.data?.message || e.message));
    }
  };

  const setNeeds = useCallback((idx: number, value: string) => {
    const items = draftRef.current.items;
    if (!items[idx]) items[idx] = buildEmptyItem();
    items[idx].developmentNeeds = value;
  }, []);

  const setCompetency = useCallback((idx: number, value: string) => {
    const items = draftRef.current.items;
    if (!items[idx]) items[idx] = buildEmptyItem();
    items[idx].competency = value;
  }, []);

  const setActionField = useCallback((itemIdx: number, actionIdx: number, field: keyof IDPAction, value: string) => {
    const items = draftRef.current.items;
    if (!items[itemIdx]) items[itemIdx] = buildEmptyItem();
    if (!Array.isArray(items[itemIdx].actions)) items[itemIdx].actions = buildEmptyItem().actions;
    const actions = items[itemIdx].actions as IDPAction[];
    if (!actions[actionIdx]) actions[actionIdx] = { ...((buildEmptyItem().actions as IDPAction[])[actionIdx] || { type: '', label: '' }) };
    (actions[actionIdx] as any)[field] = value;
  }, []);

  const setObjectiveGoalField = useCallback((goalIdx: number, field: keyof Omit<ObjectiveSettingGoal, 'no'>, value: string) => {
    const os = draftRef.current.objectiveSetting;
    if (!os.goals[goalIdx]) os.goals[goalIdx] = { ...buildDefaultObjectiveSetting().goals[goalIdx] };
    (os.goals[goalIdx] as any)[field] = value;
  }, []);

  const setPerformanceWhat = useCallback((rowIdx: number, field: keyof Omit<PerformanceReviewWhatRow, 'no'>, value: string) => {
    const pr = draftRef.current.performanceReview;
    if (!pr.what.targets[rowIdx]) pr.what.targets[rowIdx] = { ...buildDefaultPerformanceReview().what.targets[rowIdx] };
    (pr.what.targets[rowIdx] as any)[field] = value;
  }, []);

  const setPerformanceHow = useCallback((rowIdx: number, field: keyof Omit<PerformanceReviewHowRow, 'value'>, value: string) => {
    const pr = draftRef.current.performanceReview;
    if (!pr.how.values[rowIdx]) pr.how.values[rowIdx] = { ...buildDefaultPerformanceReview().how.values[rowIdx] };
    (pr.how.values[rowIdx] as any)[field] = value;
  }, []);

  const setPerformanceMeta = useCallback((field: keyof Omit<PerformanceReviewData, 'what' | 'how'>, value: string) => {
    (draftRef.current.performanceReview as any)[field] = value;
  }, []);

  const setPerformanceWhatOverall = useCallback((field: 'overallCoworkerRating' | 'overallManagerRating', value: string) => {
    (draftRef.current.performanceReview.what as any)[field] = value;
  }, []);

  const setPerformanceHowOverall = useCallback((field: 'overallCoworkerRating' | 'overallManagerRating', value: string) => {
    (draftRef.current.performanceReview.how as any)[field] = value;
  }, []);

  const setCareerField = useCallback((field: keyof Omit<CareerPreferenceData, 'mobility'>, value: string) => {
    (draftRef.current.careerPreference as any)[field] = value;
  }, []);

  const setMobilityField = useCallback((field: keyof CareerPreferenceData['mobility'], value: string) => {
    (draftRef.current.careerPreference.mobility as any)[field] = value;
  }, []);

  const saveIDP = async () => {
    if (!selectedIdp?.id) return;
    try {
      setSaving(true);
      const res = await api.put(`/idp/${selectedIdp.id}`, {
        items: draftRef.current.items,
        generalNotes: draftRef.current.generalNotes,
        objectiveSetting: draftRef.current.objectiveSetting,
        performanceReview: draftRef.current.performanceReview,
        careerPreference: draftRef.current.careerPreference,
      });
      const savedItems = Array.isArray(res.data?.items) ? res.data.items : draftRef.current.items;
      const savedNotes = typeof res.data?.generalNotes === 'string' ? res.data.generalNotes : draftRef.current.generalNotes;
      const savedObjective = res.data?.objectiveSetting ?? draftRef.current.objectiveSetting;
      const savedReview = res.data?.performanceReview ?? draftRef.current.performanceReview;
      const savedCareer = res.data?.careerPreference ?? draftRef.current.careerPreference;

      draftRef.current = {
        items: JSON.parse(JSON.stringify(savedItems)),
        generalNotes: savedNotes,
        objectiveSetting: JSON.parse(JSON.stringify(savedObjective)),
        performanceReview: JSON.parse(JSON.stringify(savedReview)),
        careerPreference: JSON.parse(JSON.stringify(savedCareer)),
      };

      setEditorSeed((prev) => ({
        ...prev,
        key: prev.key + 1, // Increment key to force remount and show saved data
        items: savedItems,
        generalNotes: savedNotes,
        objectiveSetting: savedObjective,
        performanceReview: savedReview,
        careerPreference: savedCareer,
      }));

      setSelectedIdp({ ...selectedIdp, ...res.data });
      await fetchMy();
      if (canManage) await fetchManage();
      alert('IDP berhasil disimpan');
    } catch (e: any) {
      alert('Gagal menyimpan IDP: ' + (e.response?.data?.error || e.response?.data?.message || e.message));
    } finally {
      setSaving(false);
    }
  };

  const printIDP = () => {
    if (!selectedIdp?.id) return;
    try {
      localStorage.setItem(`idp_print_draft_${selectedIdp.id}`, JSON.stringify(draftRef.current));
    } catch {}
    window.open(`/idp/print/${selectedIdp.id}?useDraft=1`, '_blank');
  };

  const submitIDP = async () => {
    if (!selectedIdp?.id) return;
    try {
      setSubmitting(true);
      // Ensure data is saved along with submission
      await api.post(`/idp/${selectedIdp.id}/submit`, {
        items: draftRef.current.items,
        generalNotes: draftRef.current.generalNotes,
        objectiveSetting: draftRef.current.objectiveSetting,
        performanceReview: draftRef.current.performanceReview,
        careerPreference: draftRef.current.careerPreference,
      });
      await openIDP(selectedIdp.id);
      await fetchMy();
      if (canManage) await fetchManage();
      alert('IDP berhasil dikirim');
    } catch (e: any) {
      alert('Gagal mengirim IDP: ' + (e.response?.data?.error || e.response?.data?.message || e.message));
    } finally {
      setSubmitting(false);
    }
  };

  const Editor = () => {
    if (!selectedIdp) return null;

    const isOwner = selectedIdp?.userId ? selectedIdp.userId === user?.id : selectedIdp?.user?.id === user?.id;
    const canEdit = isOwner || canManage;
    const readOnly = !canEdit || selectedIdp.status === 'APPROVED';

    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-[#0F4D39]/10 text-[#0F4D39] rounded-xl">
              <Target size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Individual Development Plan (IDP)</h2>
              <p className="text-gray-500 text-sm">
                Tahun {selectedIdp.year} • Status: {selectedIdp.status}
              </p>
              {selectedIdp.user?.name && (
                <p className="text-gray-500 text-sm">
                  {selectedIdp.user.name} • {selectedIdp.user.department || '-'}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={printIDP}
              className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all"
            >
              <Printer size={18} />
              Cetak PDF
            </button>
            <button
              onClick={saveIDP}
              disabled={saving || readOnly}
              className="inline-flex items-center gap-2 bg-[#0F4D39] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0a3628] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save size={18} />
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
            {isOwner && selectedIdp.status !== 'APPROVED' && (
              <button
                onClick={submitIDP}
                disabled={submitting}
                className="inline-flex items-center gap-2 bg-white border border-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={18} />
                {submitting ? 'Mengirim...' : 'Submit'}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setEditorSection('OBJECTIVE')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
              editorSection === 'OBJECTIVE'
                ? 'bg-[#0F4D39] text-white border-[#0F4D39]'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Objective Setting
          </button>
          <button
            onClick={() => setEditorSection('IDP')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
              editorSection === 'IDP'
                ? 'bg-[#0F4D39] text-white border-[#0F4D39]'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            IDP
          </button>
          <button
            onClick={() => setEditorSection('CAREER')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
              editorSection === 'CAREER'
                ? 'bg-[#0F4D39] text-white border-[#0F4D39]'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Career Preference
          </button>
          <button
            onClick={() => setEditorSection('SUMMARY')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
              editorSection === 'SUMMARY'
                ? 'bg-[#0F4D39] text-white border-[#0F4D39]'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Summary
          </button>
        </div>

        {editorSection === 'GUIDELINES' && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5" key={`guidelines-${editorSeed.key}`}>
            {loadingGuidelines ? (
              <div className="text-gray-500">Memuat...</div>
            ) : !guidelines ? (
              <div className="text-gray-500">Data tidak tersedia.</div>
            ) : (
              <>
                <p className="text-sm text-gray-500">{guidelines.header}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{guidelines.title}</p>
                <div className="mt-4 whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">
                  {guidelines.text}
                </div>
              </>
            )}
          </div>
        )}

        {editorSection === 'IDP_GUIDELINES' && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5" key={`idp-guidelines-${editorSeed.key}`}>
            {loadingIdpGuidelines ? (
              <div className="text-gray-500">Memuat...</div>
            ) : !idpGuidelines ? (
              <div className="text-gray-500">Data tidak tersedia.</div>
            ) : (
              <>
                <p className="text-sm text-gray-500">{idpGuidelines.header}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{idpGuidelines.title}</p>
                <div className="mt-4 whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">
                  {idpGuidelines.text}
                </div>
              </>
            )}
          </div>
        )}

        {editorSection === 'SAMPLE' && (
          <div className="space-y-4" key={`sample-${editorSeed.key}`}>
            {loadingSample ? (
              <div className="text-gray-500">Memuat...</div>
            ) : !sample ? (
              <div className="text-gray-500">Data tidak tersedia.</div>
            ) : (
              <>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="font-bold text-gray-800 mb-3">Contoh IDP</p>
                  <div className="space-y-4">
                    {(sample.items || []).map((it: any, idx: number) => (
                      <div key={idx} className="border border-gray-200 rounded-xl p-4">
                        <p className="text-sm font-bold text-gray-800 mb-1">Kebutuhan Pengembangan</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{it.developmentNeeds || '-'}</p>
                        <p className="text-sm font-bold text-gray-800 mt-3 mb-1">Kompetensi</p>
                        <p className="text-sm text-gray-700">{it.competency || '-'}</p>
                        <div className="mt-3 overflow-x-auto">
                          <table className="min-w-full border border-gray-200 rounded-xl overflow-hidden">
                            <thead className="bg-gray-50">
                              <tr className="border-b border-gray-200">
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">Tipe</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[320px]">Deskripsi</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">Tanggung Jawab</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-44">Mulai</th>
                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-44">Selesai</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(it.actions || []).map((a: any, aIdx: number) => (
                                <tr key={aIdx} className="border-b border-gray-100">
                                  <td className="px-4 py-3 text-sm text-gray-800 font-semibold">{a.label || a.type}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{a.description || '-'}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{a.responsibility || '-'}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700">{a.startDate || '-'}</td>
                                  <td className="px-4 py-3 text-sm text-gray-700">{a.endDate || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                {sample.note && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap">
                    {sample.note}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {editorSection === 'COMPETENCIES' && (
          <div className="space-y-4" key={`competencies-${editorSeed.key}`}>
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  value={competencySearch}
                  onChange={(e) => setCompetencySearch(e.target.value)}
                  placeholder="Cari competency / deskripsi / department..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                />
              </div>
              <div className="text-sm text-gray-500">
                {loadingCompetencies ? 'Memuat...' : `${filteredCompetencySections.reduce((n: number, s: any) => n + (s.rows?.length || 0), 0)} hasil`}
              </div>
            </div>

            {loadingCompetencies ? (
              <div className="text-gray-500">Memuat...</div>
            ) : filteredCompetencySections.length === 0 ? (
              <div className="text-gray-500">Tidak ada data.</div>
            ) : (
              <div className="space-y-6">
                {filteredCompetencySections.map((sec: any, sIdx: number) => (
                  <div key={sIdx} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
                      <p className="font-bold text-gray-800">{sec.title}</p>
                      <p className="text-xs text-gray-500">{sec.rows?.length || 0} item</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead>
                          <tr className="border-b border-gray-100 bg-white">
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-80">Departemen</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-72">Competency Area</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[420px]">Deskripsi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(sec.rows || []).slice(0, 500).map((r: any, rIdx: number) => (
                            <tr key={rIdx} className="border-b border-gray-100">
                              <td className="px-4 py-3 text-sm text-gray-800">{r.department || '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-800 font-semibold">{r.competencyArea || '-'}</td>
                              <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{r.description || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {editorSection === 'OBJECTIVE' && (
          <div className="space-y-4" key={`objective-${editorSeed.key}`}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-lg font-bold text-[#0F4D39]">OBJECTIVE SETTING</p>
                <p className="text-base font-semibold text-gray-800 mt-1">Penetapan Target</p>
                <div className="mt-3 text-sm text-gray-700">
                  <p className="font-semibold">Tujuan:</p>
                  <p className="mt-1">
                    Dokumentasikan apa yang harus Anda fokuskan selama tahun yang akan datang (dalam bingkai profil kompetensi Anda) untuk berkontribusi pada kebutuhan bisnis tim Anda, function atau unit.
                  </p>
                  <p className="mt-3 italic text-gray-500">
                    Purpose: Document what you should focus on during the coming year (within the frame of your competence profile) to contribute to the business needs of your team, function or unit.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-bold text-gray-800">Jumlah Target:</p>
                <p className="text-sm text-gray-700 mt-2">
                  Direkomendasikan untuk menentukan 2-3 tujuan untuk dikerjakan di tahun yang akan datang.
                </p>
                <p className="text-sm text-gray-700 mt-2">
                  Tuliskan tujuan Anda sesuai dengan kriteria SMART. Anda dapat bertanya kepada diri sendiri pertanyaan-pertanyaan berikut untuk setiap tujuan:
                </p>
                <div className="mt-3 italic text-gray-500 text-sm">
                  <p className="font-semibold">Number of Goals:</p>
                  <p className="mt-1">
                    It is recommended to define 2-3 goals to work with the coming year. Write your goals according to the SMART criteria. You can ask yourself the following questions for each goal:
                  </p>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="text-sm font-bold text-gray-800">SMART Criteria</p>
                <div className="mt-2 text-sm text-gray-700 space-y-1">
                  <p><span className="font-semibold">Spesifik</span> Apakah tujuan menentukan dengan tepat apa yang harus dicapai?</p>
                  <p><span className="font-semibold">Measurable</span> Dapatkah saya mengukur kemajuan dan jika saya telah mencapai tujuan dengan sukses?</p>
                  <p><span className="font-semibold">Setuju</span> Apakah setiap orang yang terlibat memahami dan menyetujui tujuan?</p>
                  <p><span className="font-semibold">Realistis</span> Apakah tujuan itu menantang tetapi masih mungkin untuk dicapai?</p>
                  <p><span className="font-semibold">Terikat waktu</span> Apakah waktu yang jelas ditetapkan kapan tujuan harus dicapai?</p>
                </div>
                <div className="mt-4 text-sm text-gray-600 space-y-1 italic">
                  <p><span className="font-semibold not-italic">Specific</span> Does the goal define exactly what should be achieved?</p>
                  <p><span className="font-semibold not-italic">Measurable</span> Can I measure progress and if I have achieved the goal successfully?</p>
                  <p><span className="font-semibold not-italic">Agreed</span> Does everyone involved understand and agree upon the goal?</p>
                  <p><span className="font-semibold not-italic">Realistic</span> Is the goal challenging but still possible to achieve?</p>
                  <p><span className="font-semibold not-italic">Time bound</span> Does it say when the goal should be achieved?</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-16">No</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[320px]">
                      Detil Target / Objective Details
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-64">
                      Ukuran / Measure
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-44">
                      Mulai / Start
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-44">
                      Selesai / End
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[260px]">
                      Milestone
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(editorSeed.objectiveSetting?.goals || buildDefaultObjectiveSetting().goals).map((g, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="px-4 py-3 text-sm text-gray-700 font-semibold align-top">{g.no || idx + 1}</td>
                      <td className="px-4 py-3 align-top">
                        <textarea
                          defaultValue={g.objectiveDetails || ''}
                          onChange={(e) => setObjectiveGoalField(idx, 'objectiveDetails', e.target.value)}
                          className="w-full min-h-[72px] px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all"
                          disabled={readOnly}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <input
                          type="text"
                          defaultValue={g.measure || ''}
                          onChange={(e) => setObjectiveGoalField(idx, 'measure', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all"
                          disabled={readOnly}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <input
                          type="date"
                          defaultValue={g.startDate || ''}
                          onChange={(e) => setObjectiveGoalField(idx, 'startDate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all"
                          disabled={readOnly}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <input
                          type="date"
                          defaultValue={g.endDate || ''}
                          onChange={(e) => setObjectiveGoalField(idx, 'endDate', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all"
                          disabled={readOnly}
                        />
                      </td>
                      <td className="px-4 py-3 align-top">
                        <textarea
                          defaultValue={g.milestone || ''}
                          onChange={(e) => setObjectiveGoalField(idx, 'milestone', e.target.value)}
                          className="w-full min-h-[72px] px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all"
                          disabled={readOnly}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {editorSection === 'IDP' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5" key={`development-talk-${editorSeed.key}`}>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-lg font-bold text-[#0F4D39]">DEVELOPMENT TALK</p>
                <p className="text-base font-semibold text-gray-800 mt-1">Individual Development Plan (IDP)</p>
                <div className="mt-3 text-sm text-gray-700">
                  <p className="font-semibold">Tujuan:</p>
                  <p className="mt-1">
                    Dokumentasikan diskusi tentang masa depan Anda dan tentukan kompetensi apa yang akan Anda kembangkan tahun yang akan datang untuk mencapai tujuan Anda dan mengejar langkah selanjutnya dalam karier Anda.
                  </p>
                  <p className="mt-3 italic text-gray-500">
                    Purpose: Document the discussion about your future and define which competence you will develop the coming year to achieve your goals and pursue the next steps(s) in your career.
                  </p>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-bold text-gray-800">Development Plan:</p>
                <p className="text-sm text-gray-700 mt-2">
                  Disarankan untuk menetapkan 2–3 bidang kompetensi untuk dikembangkan di tahun mendatang.
                </p>
                <div className="mt-3 italic text-gray-500 text-sm">
                  <p className="font-semibold">Development Plan:</p>
                  <p className="mt-1">
                    It is recommended to define 2–3 competence areas to develop the coming year.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-bold text-gray-800">Beberapa pertanyaan untuk memulai diskusi:</p>
                <div className="mt-2 text-sm text-gray-700 space-y-1">
                  <p>- Apa yang menantang? Apa yang membuat bangga?</p>
                  <p>- Apa yang sudah kamu capai? Apa yang sudah kamu pelajari?</p>
                  <p>- Apa yang sudah kamu rasakan? Apa yang sudah kamu alami?</p>
                  <p>- Apa yang sudah kamu kuasai selama yang berbeda dari hari ini?</p>
                  <p>- Apa yang paling memotivasi Anda (job) Anda? Jelaskan hubungan antara Anda dan tim kamu.</p>
                  <p>- Seperti apa kerja sama antara Anda dan manager Anda?</p>
                  <p>- Bagaimana hubungan Anda dengan kehidupan kerja Anda?</p>
                </div>
                <div className="mt-4 text-sm text-gray-600 space-y-1 italic">
                  <p className="font-semibold not-italic">A couple of questions to start the discussion:</p>
                  <p>- What has been challenging? What are you proud of?</p>
                  <p>- What have you achieved? What have you learned?</p>
                  <p>- Do you do anything differently today?</p>
                  <p>- What motivates you most/least in your job? Describe the relationship between you and your team. What does co-operation look like between you and your manager?</p>
                  <p>- How is your work-life balance?</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto" key={`idp-${editorSeed.key}`}>
              <table className="min-w-full border border-gray-200 rounded-xl overflow-hidden">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-72">
                      Kebutuhan Pengembangan
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-64">
                      Kompetensi
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-52">
                      Tipe
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[320px]">
                      Deskripsi
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-60">
                      Tanggung Jawab
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-44">
                      Mulai
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-44">
                      Selesai
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {editorSeed.items.map((item, idx) => (
                    <IDPItemGroup
                      key={idx}
                      item={item}
                      index={idx}
                      readOnly={readOnly}
                      onNeedsChange={setNeeds}
                      onCompetencyChange={setCompetency}
                      onActionChange={setActionField}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6" key={`notes-${editorSeed.key}`}>
              <label className="block text-sm font-medium text-gray-700 mb-2">Catatan</label>
              <textarea
                defaultValue={editorSeed.generalNotes}
                onChange={(e) => {
                  draftRef.current.generalNotes = e.target.value;
                }}
                className="w-full min-h-[96px] px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] transition-all"
                placeholder="Tambahkan catatan jika diperlukan..."
                disabled={readOnly}
              />
              <div className="mt-3 text-xs text-gray-500">
                Kompetensi pengembangan harus berdasarkan Profil Kompetensi Anda saat ini dan kebutuhan pengembangan langkah selanjutnya.
              </div>
            </div>
          </>
        )}

        {editorSection === 'REVIEW' && (
          <div className="space-y-6" key={`review-${editorSeed.key}`}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-lg font-bold text-[#0F4D39]">PERFORMANCE REVIEW</p>
                <p className="text-base font-semibold text-gray-800 mt-1">Penilaian Kinerja</p>
                <div className="mt-3 text-sm text-gray-700">
                  <p className="font-semibold">Tujuan:</p>
                  <p className="mt-1">
                    Dokumentasikan evaluasi kinerja Anda tahun lalu. Kinerja Anda dievaluasi sebagai kombinasi dari tujuan, rencana pengembangan, dan perilaku Anda (melalui The Lodge Value dan, jika berlaku, kemampuan kepemimpinan).
                  </p>
                  <p className="mt-3 italic text-gray-500">
                    Purpose: Document the evaluation of your performance the past year. Your performance is evaluated as a combination of your goals, Development Plan and behaviours (through the The Lodge Values and, if applicable, Leadership Capabilities).
                  </p>
                </div>
                <div className="mt-3 text-sm text-gray-700">
                  <p>
                    Form ini harus digunakan untuk menyelesaikan proses Penilaian Kinerja Akhir Tahun. Form ini mencakup ulasan mengenai “WHAT” dan “HOW” dan Overall Performance Rating (“WHAT” + “HOW”).
                  </p>
                  <p className="mt-2 italic text-gray-500">
                    This form should be used to complete the Year End Performance Review process. The form covers a review of both “WHAT” and “HOW” and the Overall Performance Rating (“WHAT” + “HOW”) will then feed into the annual performance and compensation review cycle.
                  </p>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="text-sm font-bold text-gray-800">Performance Rating Scales</p>
                <p className="text-sm text-gray-700 mt-2">
                  Rating scale ini dirancang untuk membantu Anda menilai dan dinilai atas performa Anda.
                </p>
                <div className="mt-3 text-sm text-gray-700 space-y-2">
                  <p><span className="font-semibold">(5) Significantly Above Target (SAT)</span> Sering melampaui ekspektasi.</p>
                  <p><span className="font-semibold">(4) Above Target (AT)</span> Konsisten memenuhi ekspektasi dan sesekali melampaui.</p>
                  <p><span className="font-semibold">(3) On Target (OT)</span> Konsisten memenuhi ekspektasi.</p>
                  <p><span className="font-semibold">(2) Below Target (BT)</span> Perlu pengembangan lebih lanjut.</p>
                  <p><span className="font-semibold">(1) Significantly Below Target (SBT)</span> Perlu perbaikan signifikan.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="font-bold text-gray-800 mb-3">The “What”</p>
                <div className="space-y-3">
                  {(editorSeed.performanceReview?.what?.targets || buildDefaultPerformanceReview().what.targets).map((row, idx) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="font-semibold text-gray-800">No. {row.no || idx + 1}</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            defaultValue={row.coworkerRating || ''}
                            onChange={(e) => setPerformanceWhat(idx, 'coworkerRating', e.target.value)}
                            className="w-20 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                            placeholder="CW"
                            disabled={readOnly}
                          />
                          <input
                            type="text"
                            defaultValue={row.managerRating || ''}
                            onChange={(e) => setPerformanceWhat(idx, 'managerRating', e.target.value)}
                            className="w-20 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                            placeholder="MGR"
                            disabled={readOnly}
                          />
                        </div>
                      </div>
                      <textarea
                        defaultValue={row.target || ''}
                        onChange={(e) => setPerformanceWhat(idx, 'target', e.target.value)}
                        className="w-full min-h-[56px] px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                        placeholder="Target / Objective"
                        disabled={readOnly}
                      />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                        <textarea
                          defaultValue={row.coworkerComment || ''}
                          onChange={(e) => setPerformanceWhat(idx, 'coworkerComment', e.target.value)}
                          className="w-full min-h-[56px] px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                          placeholder="Komentar Co-worker"
                          disabled={readOnly}
                        />
                        <textarea
                          defaultValue={row.managerComment || ''}
                          onChange={(e) => setPerformanceWhat(idx, 'managerComment', e.target.value)}
                          className="w-full min-h-[56px] px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                          placeholder="Komentar Manager"
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <input
                    type="text"
                    defaultValue={editorSeed.performanceReview?.what?.overallCoworkerRating || ''}
                    onChange={(e) => setPerformanceWhatOverall('overallCoworkerRating', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                    placeholder="Overall “WHAT” Rating oleh Co-worker"
                    disabled={readOnly}
                  />
                  <input
                    type="text"
                    defaultValue={editorSeed.performanceReview?.what?.overallManagerRating || ''}
                    onChange={(e) => setPerformanceWhatOverall('overallManagerRating', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                    placeholder="Overall “WHAT” Rating oleh Manager"
                    disabled={readOnly}
                  />
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="font-bold text-gray-800 mb-3">The “How” (The Lodge Values)</p>
                <div className="space-y-3">
                  {(editorSeed.performanceReview?.how?.values || buildDefaultPerformanceReview().how.values).map((row, idx) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <p className="font-semibold text-gray-800">{row.value}</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            defaultValue={row.coworkerRating || ''}
                            onChange={(e) => setPerformanceHow(idx, 'coworkerRating', e.target.value)}
                            className="w-20 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                            placeholder="CW"
                            disabled={readOnly}
                          />
                          <input
                            type="text"
                            defaultValue={row.managerRating || ''}
                            onChange={(e) => setPerformanceHow(idx, 'managerRating', e.target.value)}
                            className="w-20 px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                            placeholder="MGR"
                            disabled={readOnly}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <textarea
                          defaultValue={row.coworkerComment || ''}
                          onChange={(e) => setPerformanceHow(idx, 'coworkerComment', e.target.value)}
                          className="w-full min-h-[56px] px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                          placeholder="Komentar Co-worker"
                          disabled={readOnly}
                        />
                        <textarea
                          defaultValue={row.managerComment || ''}
                          onChange={(e) => setPerformanceHow(idx, 'managerComment', e.target.value)}
                          className="w-full min-h-[56px] px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                          placeholder="Komentar Manager"
                          disabled={readOnly}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <input
                    type="text"
                    defaultValue={editorSeed.performanceReview?.how?.overallCoworkerRating || ''}
                    onChange={(e) => setPerformanceHowOverall('overallCoworkerRating', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                    placeholder="Overall “HOW” Rating oleh Co-worker"
                    disabled={readOnly}
                  />
                  <input
                    type="text"
                    defaultValue={editorSeed.performanceReview?.how?.overallManagerRating || ''}
                    onChange={(e) => setPerformanceHowOverall('overallManagerRating', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                    placeholder="Overall “HOW” Rating oleh Manager"
                    disabled={readOnly}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="font-bold text-gray-800 mb-3">Overall</p>
                <div className="space-y-3">
                  <input
                    type="text"
                    defaultValue={editorSeed.performanceReview?.overallPerformanceRating || ''}
                    onChange={(e) => setPerformanceMeta('overallPerformanceRating', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                    placeholder="Overall Performance Rating"
                    disabled={readOnly}
                  />
                  <input
                    type="text"
                    defaultValue={editorSeed.performanceReview?.potentialRating || ''}
                    onChange={(e) => setPerformanceMeta('potentialRating', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                    placeholder="Potential Rating"
                    disabled={readOnly}
                  />
                  <input
                    type="text"
                    defaultValue={editorSeed.performanceReview?.staircaseLevel || ''}
                    onChange={(e) => setPerformanceMeta('staircaseLevel', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                    placeholder="Staircase Level"
                    disabled={readOnly}
                  />
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="font-bold text-gray-800 mb-3">Komentar Co-worker</p>
                <textarea
                  defaultValue={editorSeed.performanceReview?.coworkerOverallComment || ''}
                  onChange={(e) => setPerformanceMeta('coworkerOverallComment', e.target.value)}
                  className="w-full min-h-[120px] px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                  disabled={readOnly}
                />
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="font-bold text-gray-800 mb-3">Komentar Manager</p>
                <textarea
                  defaultValue={editorSeed.performanceReview?.managerOverallComment || ''}
                  onChange={(e) => setPerformanceMeta('managerOverallComment', e.target.value)}
                  className="w-full min-h-[120px] px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                  disabled={readOnly}
                />
              </div>
            </div>
          </div>
        )}

        {editorSection === 'CAREER' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" key={`career-${editorSeed.key}`}>
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Strength & Development Area</label>
                <textarea
                  defaultValue={editorSeed.careerPreference?.strengthDevelopmentArea || ''}
                  onChange={(e) => setCareerField('strengthDevelopmentArea', e.target.value)}
                  className="w-full min-h-[120px] px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Employee's Career Aspiration</label>
                <textarea
                  defaultValue={editorSeed.careerPreference?.employeeCareerAspiration || ''}
                  onChange={(e) => setCareerField('employeeCareerAspiration', e.target.value)}
                  className="w-full min-h-[120px] px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Manager view on career</label>
                <textarea
                  defaultValue={editorSeed.careerPreference?.managerViewOnCareer || ''}
                  onChange={(e) => setCareerField('managerViewOnCareer', e.target.value)}
                  className="w-full min-h-[120px] px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Note</label>
                <textarea
                  defaultValue={editorSeed.careerPreference?.note || ''}
                  onChange={(e) => setCareerField('note', e.target.value)}
                  className="w-full min-h-[96px] px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                  disabled={readOnly}
                />
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
              <p className="font-bold text-gray-800">Mobilitas / Mobility</p>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Preferred Location(s)</label>
                <input
                  type="text"
                  defaultValue={editorSeed.careerPreference?.mobility?.preferredLocations || ''}
                  onChange={(e) => setMobilityField('preferredLocations', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Country</label>
                <input
                  type="text"
                  defaultValue={editorSeed.careerPreference?.mobility?.country || ''}
                  onChange={(e) => setMobilityField('country', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Period</label>
                <input
                  type="text"
                  defaultValue={editorSeed.careerPreference?.mobility?.period || ''}
                  onChange={(e) => setMobilityField('period', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">Would you be interested to relocate?</label>
                <select
                  defaultValue={editorSeed.careerPreference?.mobility?.wouldRelocate || ''}
                  onChange={(e) => setMobilityField('wouldRelocate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] bg-white"
                  disabled={readOnly}
                >
                  <option value="">-</option>
                  <option value="YES">YES</option>
                  <option value="NO">NO</option>
                  <option value="MAYBE">MAYBE</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {editorSection === 'SUMMARY' && (
          <div className="space-y-6" key={`summary-${editorSeed.key}`}>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-bold text-[#0F4D39]">SUMMARY FOR HR</p>
              <p className="text-xs text-gray-500 mt-1">CO-WORKER DETAILS</p>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-xl overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Position</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Manager</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-3 text-sm text-gray-800">{selectedIdp?.user?.name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{selectedIdp?.user?.id || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{selectedIdp?.user?.role || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{selectedIdp?.createdBy?.name || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-bold text-[#0F4D39]">OBJECTIVE SETTING</p>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-xl overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[280px]">
                        Objectives
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[220px]">
                        Measures
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-44">
                        Start Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-44">
                        End Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(draftRef.current.objectiveSetting?.goals || buildDefaultObjectiveSetting().goals).map((g, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap">{g.objectiveDetails || ''}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{g.measure || ''}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{g.startDate || ''}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{g.endDate || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-bold text-[#0F4D39]">INDIVIDUAL DEVELOPMENT PLAN (IDP)</p>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-xl overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Co-worker ID</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[260px]">Development Needs</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">Competencies 1</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">Competencies 2</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-44">Formal Training (10%)</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">Mentoring & Coaching (20%)</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-36">OJT (70%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(draftRef.current.items || buildDefaultItems()).map((it: any, idx: number) => {
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
                          <td className="px-4 py-3 text-sm text-gray-700">{selectedIdp?.user?.id || ''}</td>
                          <td className="px-4 py-3 text-sm text-gray-800">{selectedIdp?.user?.name || ''}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{it?.developmentNeeds || ''}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{c1}</td>
                          <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{c2}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{countType('FORMAL_TRAINING') || 0}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{countType('MENTORING_COACHING') || 0}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{countType('OJT') || 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-bold text-[#0F4D39]">CAREER PREFERENCE</p>
              <div className="mt-3 overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-xl overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[260px]">
                        Strength & Development Area
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[260px]">
                        Employee&apos;s Career Aspiration
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[260px]">
                        Manager view on career
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">
                        Geographic Mobility
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-40">
                        Country
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-40">
                        Period
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">
                        Would you be interested?
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
                        {draftRef.current.careerPreference?.strengthDevelopmentArea || ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
                        {draftRef.current.careerPreference?.employeeCareerAspiration || ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
                        {draftRef.current.careerPreference?.managerViewOnCareer || ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
                        {draftRef.current.careerPreference?.mobility?.preferredLocations || ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
                        {draftRef.current.careerPreference?.mobility?.country || ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
                        {draftRef.current.careerPreference?.mobility?.period || ''}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">
                        {draftRef.current.careerPreference?.mobility?.wouldRelocate || ''}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-sm font-bold text-[#0F4D39]">PERFORMANCE REVIEW</p>

              <div className="mt-4">
                <p className="text-sm font-bold text-gray-800 mb-2">“What”</p>
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 rounded-xl overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[260px]">Target</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[260px]">Co-worker&apos;s comment</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[260px]">Manager&apos;s comment</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-44">Co-worker&apos;s “What” rating</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-44">Manager&apos;s “What” rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(draftRef.current.performanceReview?.what?.targets || buildDefaultPerformanceReview().what.targets).map(
                        (row: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-100">
                            <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{row.target || ''}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{row.coworkerComment || ''}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{row.managerComment || ''}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{row.coworkerRating || ''}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{row.managerRating || ''}</td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-sm font-bold text-gray-800 mb-2">“How”</p>
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 rounded-xl overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-72">The Lodge Value</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[260px]">Co-worker&apos;s comment</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[260px]">Manager&apos;s comment</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-44">Co-worker&apos;s “How” rating</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-44">Manager&apos;s “How” rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(draftRef.current.performanceReview?.how?.values || buildDefaultPerformanceReview().how.values).map(
                        (row: any, idx: number) => (
                          <tr key={idx} className="border-b border-gray-100">
                            <td className="px-4 py-3 text-sm text-gray-800 font-semibold whitespace-pre-wrap">{row.value || ''}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{row.coworkerComment || ''}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{row.managerComment || ''}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{row.coworkerRating || ''}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{row.managerRating || ''}</td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-sm font-bold text-gray-800 mb-2">Overall Performance Review</p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Co-worker&apos;s overall comment</p>
                    <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                      {draftRef.current.performanceReview?.coworkerOverallComment || ''}
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Manager&apos;s overall comment</p>
                    <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                      {draftRef.current.performanceReview?.managerOverallComment || ''}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-xl overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-28">Co-worker ID</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">Name</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">
                        “What” rating from Manager
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">
                        “How” rating from Manager
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-56">
                        Overall Performance Rating
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-44">Potential Rating</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-44">Staircase Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="px-4 py-3 text-sm text-gray-700">{selectedIdp?.user?.id || ''}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{selectedIdp?.user?.name || ''}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{draftRef.current.performanceReview?.what?.overallManagerRating || ''}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{draftRef.current.performanceReview?.how?.overallManagerRating || ''}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{draftRef.current.performanceReview?.overallPerformanceRating || ''}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{draftRef.current.performanceReview?.potentialRating || ''}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{draftRef.current.performanceReview?.staircaseLevel || ''}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div className="flex items-start gap-3">
          <div className="p-3 bg-[#0F4D39]/10 text-[#0F4D39] rounded-xl">
            <Target size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Individual Development Plan (IDP)</h1>
            <p className="text-gray-500">Form pengembangan individu berdasarkan template IDP</p>
          </div>
        </div>

        <button
          onClick={createNewIDP}
          className="inline-flex items-center gap-2 bg-[#0F4D39] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0a3628] transition-all"
        >
          <Plus size={18} />
          Buat IDP Baru
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('my')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
            activeTab === 'my' ? 'bg-[#0F4D39] text-white border-[#0F4D39]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          My IDP
        </button>
        {canManage && (
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${
              activeTab === 'manage' ? 'bg-[#0F4D39] text-white border-[#0F4D39]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            Manage
          </button>
        )}
      </div>

      <Editor />

      {activeTab === 'my' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Daftar IDP Saya</h3>
          {loadingMy ? (
            <div className="text-gray-500">Memuat...</div>
          ) : myIDPs.length === 0 ? (
            <div className="text-gray-500">Belum ada IDP.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tahun</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Updated</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {myIDPs.map((idp) => (
                    <tr key={idp.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 text-sm text-gray-800 font-semibold">{idp.year}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{idp.status}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {idp.updatedAt ? new Date(idp.updatedAt).toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openIDP(idp.id)}
                          className="text-[#0F4D39] font-semibold hover:underline text-sm"
                        >
                          Buka
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'manage' && canManage && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4 mb-5">
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  value={manageSearch}
                  onChange={(e) => setManageSearch(e.target.value)}
                  placeholder="Cari nama karyawan / catatan..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
                />
              </div>
            </div>
            <div className="w-full sm:w-56">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Department</label>
              <input
                value={manageDept}
                onChange={(e) => setManageDept(e.target.value)}
                placeholder="All Departments"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39]"
              />
            </div>
            <div className="w-full sm:w-40">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Year</label>
              <select
                value={manageYear}
                onChange={(e) => setManageYear(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] bg-white"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-44">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Status</label>
              <select
                value={manageStatus}
                onChange={(e) => setManageStatus(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0F4D39]/20 focus:border-[#0F4D39] bg-white"
              >
                <option value="">All</option>
                <option value="DRAFT">DRAFT</option>
                <option value="SUBMITTED">SUBMITTED</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
              </select>
            </div>
            <button
              onClick={fetchManage}
              className="inline-flex items-center justify-center gap-2 bg-[#0F4D39] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0a3628] transition-all w-full sm:w-auto"
            >
              <Filter size={18} />
              Apply
            </button>
          </div>

          <h3 className="text-lg font-bold text-gray-800 mb-4">Daftar IDP (Manage)</h3>
          {loadingManage ? (
            <div className="text-gray-500">Memuat...</div>
          ) : manageIDPs.length === 0 ? (
            <div className="text-gray-500">Tidak ada data.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Year</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {manageIDPs.map((idp) => (
                    <tr key={idp.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 text-sm text-gray-800 font-semibold">{idp.user?.name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{idp.user?.department || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{idp.year}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{idp.status}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openIDP(idp.id)}
                          className="text-[#0F4D39] font-semibold hover:underline text-sm"
                        >
                          Buka
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
