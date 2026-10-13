import { useEffect, useState, useMemo } from 'react';

const CATEGORIES = [
  "",
  "משפחה רחלי",
  "משפחה רז",
  "חברים רחלי",
  "חברים רז",
  "חברים תובל"
];

type SortKey =
  | 'name'
  | 'attending'
  | 'event_part'
  | 'adults'
  | 'kids'
  | 'babies'
  | 'category'
  | 'created_at';

type SortDirection = 'asc' | 'desc';

interface SortRule {
  key: SortKey;
  direction: SortDirection;
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'שם האורח' },
  { key: 'attending', label: 'מגיע?' },
  { key: 'event_part', label: 'שלב באירוע' },
  { key: 'adults', label: 'מבוגרים ונוער (11+)' },
  { key: 'kids', label: 'ילדים (3-11)' },
  { key: 'babies', label: 'תינוקות (עד גיל 3)' },
  { key: 'category', label: 'קטגוריה' },
  { key: 'created_at', label: 'זמן הרשמה' },
];

export default function Admin() {
  const [guests, setGuests] = useState<any[]>([]);
  const [blessings, setBlessings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'guests' | 'blessings'>('guests');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
  const [attendanceFilter, setAttendanceFilter] = useState<'all' | 'attending' | 'declined' | 'duplicates'>('all');
  const [primarySort, setPrimarySort] = useState<SortRule | null>(null);
  const [secondarySort, setSecondarySort] = useState<SortRule | null>(null);
  const [showMultiSortPanel, setShowMultiSortPanel] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [guestsRes, blessingsRes] = await Promise.all([
        fetch('/api/guests'),
        fetch('/api/blessings')
      ]);
      const [guestsData, blessingsData] = await Promise.all([
        guestsRes.json(),
        blessingsRes.json()
      ]);
      setGuests(Array.isArray(guestsData) ? guestsData : []);
      setBlessings(Array.isArray(blessingsData) ? blessingsData : []);
    } catch (err) {
      console.error('Error fetching admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCategoryChange = async (id: number, newCategory: string) => {
    setGuests(prev => prev.map(g => g.id === id ? { ...g, category: newCategory } : g));
    try {
      await fetch(`/api/guests/${id}/category`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory })
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteGuest = async (id: number, name: string) => {
    if (!window.confirm(`האם למחוק את האורח "${name}"?`)) return;
    setGuests(prev => prev.filter(g => g.id !== id));
    try {
      await fetch(`/api/guests/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error(err);
      fetchData();
    }
  };

  const handleDeleteBlessing = async (id: number, author: string) => {
    if (!window.confirm(`האם למחוק את הברכה מאת "${author}"?`)) return;
    setBlessings(prev => prev.filter(b => b.id !== id));
    try {
      await fetch(`/api/blessings/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.error(err);
      fetchData();
    }
  };

  const handleToggleVisibility = async (id: number, currentIsPublic: any) => {
    const isCurrentlyPublic = Boolean(Number(currentIsPublic));
    const newIsPublic = !isCurrentlyPublic;
    
    // Optimistic UI update
    setBlessings(prev => prev.map(b => b.id === id ? { ...b, is_public: newIsPublic ? 1 : 0 } : b));
    
    try {
      await fetch(`/api/blessings/${id}/visibility`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: newIsPublic })
      });
    } catch (err) {
      console.error(err);
      fetchData();
    }
  };

  const attendingGuests = guests.filter(g => g.attending);
  const totalAdults = attendingGuests.reduce((sum, g) => sum + (g.adults || 0), 0);
  const totalKids = attendingGuests.reduce((sum, g) => sum + (g.kids || 0), 0);
  const totalBabies = attendingGuests.reduce((sum, g) => sum + (g.babies || 0), 0);
  const totalGuests = totalAdults + totalKids + totalBabies;

  const publicBlessingsCount = blessings.filter(b => Boolean(Number(b.is_public))).length;
  const privateBlessingsCount = blessings.length - publicBlessingsCount;

  const filteredBlessings = blessings.filter(b => {
    const isPub = Boolean(Number(b.is_public));
    if (visibilityFilter === 'public') return isPub;
    if (visibilityFilter === 'private') return !isPub;
    return true;
  });

  const handleColumnHeaderClick = (key: SortKey) => {
    if (primarySort?.key === key) {
      if (primarySort.direction === 'asc') {
        setPrimarySort({ key, direction: 'desc' });
      } else {
        setPrimarySort(null);
        setSecondarySort(null);
      }
    } else {
      const defaultDir: SortDirection = (key === 'created_at' || key === 'attending') ? 'desc' : 'asc';
      setPrimarySort({ key, direction: defaultDir });
    }
  };

  const handleSwapSortHierarchy = () => {
    if (!primarySort && !secondarySort) return;
    const temp = primarySort;
    setPrimarySort(secondarySort);
    setSecondarySort(temp);
  };

  const handleResetSort = () => {
    setPrimarySort(null);
    setSecondarySort(null);
  };

  const compareValues = (a: any, b: any, key: SortKey, direction: SortDirection): number => {
    const multiplier = direction === 'asc' ? 1 : -1;
    const valA = a[key];
    const valB = b[key];

    if (key === 'attending') {
      const numA = a.attending ? 1 : 0;
      const numB = b.attending ? 1 : 0;
      return (numA - numB) * multiplier;
    }

    if (key === 'adults' || key === 'kids' || key === 'babies') {
      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return (numA - numB) * multiplier;
    }

    if (key === 'created_at') {
      const dateA = valA ? new Date(valA.includes('Z') ? valA : valA + 'Z').getTime() : 0;
      const dateB = valB ? new Date(valB.includes('Z') ? valB : valB + 'Z').getTime() : 0;
      return (dateA - dateB) * multiplier;
    }

    const strA = (valA ?? '').toString().trim();
    const strB = (valB ?? '').toString().trim();

    if (!strA && strB) return 1;
    if (strA && !strB) return -1;

    return strA.localeCompare(strB, 'he', { numeric: true, sensitivity: 'base' }) * multiplier;
  };

  const nameCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    guests.forEach(g => {
      const n = (g.name || '').trim().toLowerCase();
      if (n) {
        counts[n] = (counts[n] || 0) + 1;
      }
    });
    return counts;
  }, [guests]);

  const duplicateNamesCount = useMemo(() => {
    return Object.values(nameCounts).filter(c => c > 1).length;
  }, [nameCounts]);

  const sortedGuests = useMemo(() => {
    let list = [...guests];

    if (attendanceFilter === 'attending') {
      list = list.filter(g => g.attending);
    } else if (attendanceFilter === 'declined') {
      list = list.filter(g => !g.attending);
    } else if (attendanceFilter === 'duplicates') {
      list = list.filter(g => (nameCounts[(g.name || '').trim().toLowerCase()] || 0) > 1);
    }

    if (!primarySort) {
      return list;
    }

    return list.sort((a, b) => {
      const diff1 = compareValues(a, b, primarySort.key, primarySort.direction);
      if (diff1 !== 0) return diff1;

      if (secondarySort && secondarySort.key !== primarySort.key) {
        const diff2 = compareValues(a, b, secondarySort.key, secondarySort.direction);
        if (diff2 !== 0) return diff2;
      }

      return (a.name || '').localeCompare(b.name || '', 'he');
    });
  }, [guests, attendanceFilter, primarySort, secondarySort]);

  const handleExportCSV = () => {
    const headers = [
      'מזהה',
      'שם האורח',
      'סטטוס הגעה',
      'שלב באירוע',
      'מבוגרים ונוער (11+)',
      'ילדים (3-11)',
      'תינוקות (עד גיל 3)',
      'סה"כ מגיעים',
      'קטגוריה',
      'זמן הרשמה',
      'זמן עדכון אחרון'
    ];

    const rows = sortedGuests.map(g => {
      const total = g.attending ? ((g.adults || 0) + (g.kids || 0) + (g.babies || 0)) : 0;
      return [
        g.id,
        `"${(g.name || '').replace(/"/g, '""')}"`,
        g.attending ? 'מגיע' : 'לא מגיע',
        `"${(g.event_part || '').replace(/"/g, '""')}"`,
        g.attending ? (g.adults ?? 0) : 0,
        g.attending ? (g.kids ?? 0) : 0,
        g.attending ? (g.babies ?? 0) : 0,
        total,
        `"${(g.category || '').replace(/"/g, '""')}"`,
        `"${g.created_at ? new Date(g.created_at.includes('Z') ? g.created_at : g.created_at + 'Z').toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : ''}"`,
        `"${g.updated_at ? new Date(g.updated_at.includes('Z') ? g.updated_at : g.updated_at + 'Z').toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }) : ''}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tuval_bar_mitzvah_guests_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const renderSortIndicator = (key: SortKey) => {
    if (primarySort?.key === key) {
      return (
        <span className="inline-flex items-center gap-0.5 bg-[#4A5D4E] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-2xs">
          <span>{primarySort.direction === 'asc' ? '▲' : '▼'}</span>
          {secondarySort && <span className="text-[9px] opacity-80">1</span>}
        </span>
      );
    }
    if (secondarySort?.key === key) {
      return (
        <span className="inline-flex items-center gap-0.5 bg-[#7A877C] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold shadow-2xs">
          <span>{secondarySort.direction === 'asc' ? '▲' : '▼'}</span>
          <span className="text-[9px] opacity-80">2</span>
        </span>
      );
    }
    return (
      <span className="text-[11px] opacity-25 group-hover:opacity-70 transition-opacity">↕</span>
    );
  };

  return (
    <div dir="rtl" className="min-h-screen w-full overflow-y-auto bg-[#FDFBF7] p-4 sm:p-8 text-[#4A5D4E] font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#4A5D4E]/15">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#2C352E]">פאנל ניהול מוזמנים וברכות</h1>
            <p className="text-sm opacity-70 mt-1">בר המצווה של תובל מעוז • {totalGuests} אורחים מגיעים בסך הכל</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-[#4A5D4E] hover:bg-[#3E4E42] text-white text-sm font-semibold rounded-xl transition-all flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer"
              title="ייצוא כל רשימת האורחים לקובץ אקסל (CSV בקידוד עברי מלא)"
            >
              <span>📥</span>
              <span>ייצוא לאקסל</span>
            </button>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="px-3.5 py-2 bg-white border border-[#4A5D4E]/30 text-sm font-semibold rounded-xl hover:bg-[#F4EFE6] transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <span>🔄</span>
              <span>רענון נתונים</span>
            </button>
          </div>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-[#4A5D4E]/20 shadow-xs flex flex-col items-center">
            <span className="text-4xl sm:text-5xl font-black text-[#2C352E]">{totalAdults}</span>
            <span className="text-xs sm:text-sm font-semibold opacity-75 mt-2 text-center">מבוגרים ונוער (11+)</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#4A5D4E]/20 shadow-xs flex flex-col items-center">
            <span className="text-4xl sm:text-5xl font-black text-[#2C352E]">{totalKids}</span>
            <span className="text-xs sm:text-sm font-semibold opacity-75 mt-2 text-center">ילדים (3-11)</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#4A5D4E]/20 shadow-xs flex flex-col items-center">
            <span className="text-4xl sm:text-5xl font-black text-[#2C352E]">{totalBabies}</span>
            <span className="text-xs sm:text-sm font-semibold opacity-75 mt-2 text-center">תינוקות (עד גיל 3)</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#4A5D4E]/20 shadow-xs flex flex-col items-center">
            <span className="text-4xl sm:text-5xl font-black text-[#4A5D4E]">{blessings.length}</span>
            <span className="text-xs sm:text-sm font-semibold opacity-75 mt-2 text-center">ברכות לתובל 💌</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#4A5D4E]/20 gap-2">
          <button
            onClick={() => setActiveTab('guests')}
            className={`py-3 px-5 text-base font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'guests'
                ? 'border-[#4A5D4E] text-[#2C352E]'
                : 'border-transparent text-[#7A877C] hover:text-[#2C352E]'
            }`}
          >
            👥 מוזמנים ({guests.length})
          </button>
          <button
            onClick={() => setActiveTab('blessings')}
            className={`py-3 px-5 text-base font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'blessings'
                ? 'border-[#4A5D4E] text-[#2C352E]'
                : 'border-transparent text-[#7A877C] hover:text-[#2C352E]'
            }`}
          >
            💌 ברכות ({blessings.length})
          </button>
        </div>

        {/* TAB 1: GUESTS TABLE */}
        {activeTab === 'guests' && (
          <div className="space-y-3">
            {/* Top Toolbar: Attendance Filter & Multi-sort Hierarchy */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#4A5D4E]/15 shadow-2xs">
              {/* Attendance Quick Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#2C352E]">סינון הגעה:</span>
                <button
                  onClick={() => setAttendanceFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    attendanceFilter === 'all'
                      ? 'bg-[#4A5D4E] text-white shadow-xs'
                      : 'bg-[#FDFBF7] text-[#555] hover:bg-[#F4EFE6]'
                  }`}
                >
                  הכל ({guests.length})
                </button>
                <button
                  onClick={() => setAttendanceFilter('attending')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    attendanceFilter === 'attending'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-[#FDFBF7] text-[#555] hover:bg-[#F4EFE6]'
                  }`}
                >
                  ✅ מגיעים ({attendingGuests.length})
                </button>
                <button
                  onClick={() => setAttendanceFilter('declined')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    attendanceFilter === 'declined'
                      ? 'bg-rose-700 text-white shadow-xs'
                      : 'bg-[#FDFBF7] text-[#555] hover:bg-[#F4EFE6]'
                  }`}
                >
                  ❌ לא מגיעים ({guests.length - attendingGuests.length})
                </button>
                {duplicateNamesCount > 0 && (
                  <button
                    onClick={() => setAttendanceFilter(attendanceFilter === 'duplicates' ? 'all' : 'duplicates')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border cursor-pointer ${
                      attendanceFilter === 'duplicates'
                        ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                        : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                    }`}
                    title="הצגת כל הרשומות שבהן שם האורח מופיע יותר מפעם אחת"
                  >
                    ⚠️ שמות כפולים ({duplicateNamesCount})
                  </button>
                )}
              </div>

              {/* Multi-sort status & toggle button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowMultiSortPanel(!showMultiSortPanel)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                    showMultiSortPanel || secondarySort
                      ? 'bg-[#4A5D4E] text-white border-[#4A5D4E]'
                      : 'bg-white text-[#2C352E] border-[#4A5D4E]/25 hover:bg-[#F4EFE6]'
                  }`}
                  title="פתיחת סרגל לקביעת מיון לפי מדרג (למשל מגיע ואז קטגוריה)"
                >
                  <span>📊</span>
                  <span>מיון לפי מדרג</span>
                  {secondarySort && <span className="bg-white/20 text-white px-1 rounded text-[10px]">פעיל</span>}
                </button>

                {(primarySort || secondarySort) && (
                  <button
                    onClick={handleResetSort}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                    title="איפוס כל המיונים לסדר המקורי"
                  >
                    ✖ איפוס מיון
                  </button>
                )}
              </div>
            </div>

            {/* Multi-Level Sort Hierarchy Drawer */}
            {showMultiSortPanel && (
              <div className="bg-[#F8F5EE] border border-[#4A5D4E]/25 rounded-2xl p-3.5 space-y-3 transition-all">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#2C352E] flex items-center gap-1.5">
                    <span>🎯</span>
                    <span>קביעת מדרג מיון משולב (רמה 1 ורמה 2):</span>
                  </span>
                  <button
                    onClick={handleSwapSortHierarchy}
                    disabled={!primarySort && !secondarySort}
                    className="px-2.5 py-1 bg-white hover:bg-[#EAE4D7] border border-[#4A5D4E]/25 rounded-lg text-xs font-bold text-[#4A5D4E] flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer shadow-2xs"
                    title="החלף בין המיון הראשי למיון המשני בלחיצה אחת"
                  >
                    <span>⇄</span>
                    <span>החלף סדר מדרג (ראשי ↔ משני)</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* Primary Sort Selector */}
                  <div className="bg-white p-2.5 rounded-xl border border-[#4A5D4E]/15 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-[#2C352E]">
                      <span className="flex items-center gap-1">
                        <span className="bg-[#4A5D4E] text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px]">1</span>
                        <span>מיון ראשי (קודם לפי):</span>
                      </span>
                      {primarySort && (
                        <button
                          onClick={() => setPrimarySort(prev => prev ? { ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : null)}
                          className="text-[11px] text-[#4A5D4E] font-bold hover:underline cursor-pointer"
                        >
                          {primarySort.direction === 'asc' ? '▲ סדר עולה' : '▼ סדר יורד'}
                        </button>
                      )}
                    </div>
                    <select
                      value={primarySort?.key || ''}
                      onChange={(e) => {
                        const val = e.target.value as SortKey | '';
                        if (!val) setPrimarySort(null);
                        else setPrimarySort({ key: val, direction: primarySort?.direction || 'asc' });
                      }}
                      className="w-full bg-[#FDFBF7] border border-[#4A5D4E]/25 rounded-lg py-1.5 px-2 text-xs focus:ring-1 focus:ring-[#4A5D4E] outline-none"
                    >
                      <option value="">ללא מיון ראשי (ברירת מחדל)</option>
                      {SORT_OPTIONS.map(opt => (
                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Secondary Sort Selector */}
                  <div className="bg-white p-2.5 rounded-xl border border-[#4A5D4E]/15 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-[#2C352E]">
                      <span className="flex items-center gap-1">
                        <span className="bg-[#7A877C] text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px]">2</span>
                        <span>מיון משני (ואז לפי):</span>
                      </span>
                      {secondarySort && (
                        <button
                          onClick={() => setSecondarySort(prev => prev ? { ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' } : null)}
                          className="text-[11px] text-[#7A877C] font-bold hover:underline cursor-pointer"
                        >
                          {secondarySort.direction === 'asc' ? '▲ סדר עולה' : '▼ סדר יורד'}
                        </button>
                      )}
                    </div>
                    <select
                      value={secondarySort?.key || ''}
                      onChange={(e) => {
                        const val = e.target.value as SortKey | '';
                        if (!val) setSecondarySort(null);
                        else setSecondarySort({ key: val, direction: secondarySort?.direction || 'asc' });
                      }}
                      className="w-full bg-[#FDFBF7] border border-[#4A5D4E]/25 rounded-lg py-1.5 px-2 text-xs focus:ring-1 focus:ring-[#4A5D4E] outline-none"
                    >
                      <option value="">ללא מיון משני</option>
                      {SORT_OPTIONS.filter(opt => opt.key !== primarySort?.key).map(opt => (
                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Table Container */}
            <div className="bg-white rounded-2xl shadow-xs border border-[#4A5D4E]/20 overflow-x-auto">
              <table className="w-full text-right min-w-[700px]">
                <thead className="bg-[#4A5D4E]/5 border-b border-[#4A5D4E]/15 text-xs text-[#2C352E]">
                  <tr>
                    <th
                      onClick={() => handleColumnHeaderClick('name')}
                      className="p-3.5 font-bold cursor-pointer select-none hover:bg-[#4A5D4E]/10 transition-colors group text-right"
                      title="לחץ למיון לפי שם האורח (עולה / יורד)"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <span className={primarySort?.key === 'name' ? 'text-[#4A5D4E] font-black' : ''}>שם האורח</span>
                        {renderSortIndicator('name')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleColumnHeaderClick('attending')}
                      className="p-3.5 font-bold cursor-pointer select-none hover:bg-[#4A5D4E]/10 transition-colors group text-right"
                      title="לחץ למיון לפי סטטוס הגעה (מגיעים ראשונים / לא מגיעים ראשונים)"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <span className={primarySort?.key === 'attending' ? 'text-[#4A5D4E] font-black' : ''}>מגיע?</span>
                        {renderSortIndicator('attending')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleColumnHeaderClick('event_part')}
                      className="p-3.5 font-bold cursor-pointer select-none hover:bg-[#4A5D4E]/10 transition-colors group text-right"
                      title="לחץ למיון לפי שלב באירוע"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <span className={primarySort?.key === 'event_part' ? 'text-[#4A5D4E] font-black' : ''}>שלב באירוע</span>
                        {renderSortIndicator('event_part')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleColumnHeaderClick('adults')}
                      className="p-3.5 font-bold text-center cursor-pointer select-none hover:bg-[#4A5D4E]/10 transition-colors group"
                      title="לחץ למיון לפי כמות מבוגרים ונוער"
                    >
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <span className={primarySort?.key === 'adults' ? 'text-[#4A5D4E] font-black' : ''}>מבוגרים ונוער (11+)</span>
                        {renderSortIndicator('adults')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleColumnHeaderClick('kids')}
                      className="p-3.5 font-bold text-center cursor-pointer select-none hover:bg-[#4A5D4E]/10 transition-colors group"
                      title="לחץ למיון לפי כמות ילדים"
                    >
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <span className={primarySort?.key === 'kids' ? 'text-[#4A5D4E] font-black' : ''}>ילדים (3-11)</span>
                        {renderSortIndicator('kids')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleColumnHeaderClick('babies')}
                      className="p-3.5 font-bold text-center cursor-pointer select-none hover:bg-[#4A5D4E]/10 transition-colors group"
                      title="לחץ למיון לפי כמות תינוקות"
                    >
                      <div className="inline-flex items-center justify-center gap-1.5">
                        <span className={primarySort?.key === 'babies' ? 'text-[#4A5D4E] font-black' : ''}>תינוקות (עד גיל 3)</span>
                        {renderSortIndicator('babies')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleColumnHeaderClick('category')}
                      className="p-3.5 font-bold cursor-pointer select-none hover:bg-[#4A5D4E]/10 transition-colors group text-right"
                      title="לחץ למיון לפי קטגוריה"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <span className={primarySort?.key === 'category' ? 'text-[#4A5D4E] font-black' : ''}>קטגוריה</span>
                        {renderSortIndicator('category')}
                      </div>
                    </th>
                    <th
                      onClick={() => handleColumnHeaderClick('created_at')}
                      className="p-3.5 font-bold cursor-pointer select-none hover:bg-[#4A5D4E]/10 transition-colors group text-right"
                      title="לחץ למיון לפי זמן הרשמה (חדשים ראשונים / ישנים ראשונים)"
                    >
                      <div className="inline-flex items-center gap-1.5">
                        <span className={primarySort?.key === 'created_at' ? 'text-[#4A5D4E] font-black' : ''}>זמן הרשמה</span>
                        {renderSortIndicator('created_at')}
                      </div>
                    </th>
                    <th className="p-3.5 font-bold text-center">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#4A5D4E]/10 text-sm">
                {sortedGuests.map((guest) => (
                  <tr key={guest.id} className="hover:bg-[#4A5D4E]/5 transition-colors">
                    <td className="p-3.5 font-semibold text-[#2C352E]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span>{guest.name}</span>
                        {(nameCounts[(guest.name || '').trim().toLowerCase()] || 0) > 1 && (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded-full border border-amber-300 shadow-2xs"
                            title={`השם "${guest.name}" מופיע ${nameCounts[(guest.name || '').trim().toLowerCase()]} פעמים ברשימה`}
                          >
                            <span>⚠️</span>
                            <span>כפול ({nameCounts[(guest.name || '').trim().toLowerCase()]})</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      {guest.attending ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                          ✅ מגיע
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
                          ❌ לא מגיע
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-xs text-[#555]">{guest.event_part || '-'}</td>
                    <td className="p-3.5 text-center font-bold">{guest.attending ? (guest.adults ?? 0) : '-'}</td>
                    <td className="p-3.5 text-center font-bold">{guest.attending ? (guest.kids ?? 0) : '-'}</td>
                    <td className="p-3.5 text-center font-bold">{guest.attending ? (guest.babies ?? 0) : '-'}</td>
                    <td className="p-3.5">
                      <select
                        value={guest.category || ''}
                        onChange={(e) => handleCategoryChange(guest.id, e.target.value)}
                        className="bg-white border border-[#4A5D4E]/30 rounded-lg py-1 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#4A5D4E]"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat === '' ? 'ללא קטגוריה' : cat}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3.5 text-xs opacity-65" dir="ltr">
                      {guest.created_at
                        ? new Date(guest.created_at.includes('Z') ? guest.created_at : guest.created_at + 'Z').toLocaleString('en-GB', {
                            timeZone: 'Asia/Jerusalem',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })
                        : '-'}
                      {guest.updated_at && guest.updated_at !== guest.created_at && (
                        <div className="text-[11px] text-emerald-800 font-bold mt-0.5" dir="rtl">
                          ✏️ עודכן:{' '}
                          <span dir="ltr">
                            {new Date(guest.updated_at.includes('Z') ? guest.updated_at : guest.updated_at + 'Z').toLocaleTimeString('en-GB', {
                              timeZone: 'Asia/Jerusalem',
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            })}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        onClick={() => handleDeleteGuest(guest.id, guest.name)}
                        title="מחק אורח"
                        className="text-rose-600 hover:text-rose-800 p-1 rounded hover:bg-rose-50 transition-colors text-sm"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
                {sortedGuests.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center opacity-60">
                      {guests.length === 0 ? 'עדיין אין אורחים במסד הנתונים' : 'אין אורחים התואמים את הסינון שנבחר'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

        {/* TAB 2: BLESSINGS LIST */}
        {activeTab === 'blessings' && (
          <div className="space-y-4">
            
            {/* Blessings Sub-filter */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#4A5D4E]/15">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#2C352E]">סינון חשיפה:</span>
                <button
                  onClick={() => setVisibilityFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    visibilityFilter === 'all'
                      ? 'bg-[#4A5D4E] text-white shadow-xs'
                      : 'bg-[#FDFBF7] text-[#555] hover:bg-[#F4EFE6]'
                  }`}
                >
                  הכל ({blessings.length})
                </button>
                <button
                  onClick={() => setVisibilityFilter('public')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    visibilityFilter === 'public'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-[#FDFBF7] text-[#555] hover:bg-[#F4EFE6]'
                  }`}
                >
                  🌐 גלויות לכולם ({publicBlessingsCount})
                </button>
                <button
                  onClick={() => setVisibilityFilter('private')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    visibilityFilter === 'private'
                      ? 'bg-amber-700 text-white shadow-xs'
                      : 'bg-[#FDFBF7] text-[#555] hover:bg-[#F4EFE6]'
                  }`}
                >
                  🔒 פרטיות לתובל ({privateBlessingsCount})
                </button>
              </div>

              <span className="text-xs text-[#7A877C]">
                מוצגות {filteredBlessings.length} מתוך {blessings.length} ברכות
              </span>
            </div>

            {filteredBlessings.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-[#4A5D4E]/20 text-[#7A877C]">
                אין ברכות התואמות את הסינון הנבחר
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredBlessings.map((blessing) => {
                  const isPublic = Boolean(Number(blessing.is_public));
                  return (
                    <div
                      key={blessing.id}
                      className="bg-white rounded-2xl p-5 border border-[#4A5D4E]/20 shadow-xs flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-base text-[#2C352E]">
                            {blessing.author_name || 'אורח'}
                          </span>
                          <div className="flex items-center gap-2">
                            {/* Clickable Visibility Toggle Badge */}
                            <button
                              type="button"
                              onClick={() => handleToggleVisibility(blessing.id, blessing.is_public)}
                              title="לחץ כאן כדי לשנות סטטוס חשיפה (גלויה/פרטית)"
                              className={`text-xs px-2.5 py-1 rounded-full font-bold cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center gap-1 ${
                                isPublic
                                  ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                              }`}
                            >
                              {isPublic ? '🌐 גלויה לכולם' : '🔒 פרטית לתובל'}
                              <span className="text-[10px] opacity-60">⇄ שַׁנֵּה</span>
                            </button>

                            <button
                              onClick={() => handleDeleteBlessing(blessing.id, blessing.author_name)}
                              title="מחק ברכה"
                              className="text-rose-600 hover:text-rose-800 p-1 text-sm rounded hover:bg-rose-50"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>

                        <p className="text-sm text-[#3C473E] whitespace-pre-line leading-relaxed bg-[#FDFBF7] p-3.5 rounded-xl border border-[#E8E2D5] break-words">
                          {blessing.content}
                        </p>
                      </div>

                      <div className="text-xs text-[#8A958C] pt-1 border-t border-[#4A5D4E]/10 flex items-center justify-between" dir="ltr">
                        <span>
                          {blessing.created_at
                            ? new Date(blessing.created_at.includes('Z') ? blessing.created_at : blessing.created_at + 'Z').toLocaleString('en-GB', {
                                timeZone: 'Asia/Jerusalem',
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                              })
                            : ''}
                        </span>
                        <span className="text-[11px] opacity-70">ID: {blessing.id}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
