import { useEffect, useState } from 'react';

const CATEGORIES = [
  "",
  "משפחה רחלי",
  "משפחה רז",
  "חברים רחלי",
  "חברים רז",
  "חברים תובל"
];

export default function Admin() {
  const [guests, setGuests] = useState<any[]>([]);
  const [blessings, setBlessings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'guests' | 'blessings'>('guests');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'private'>('all');
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

  return (
    <div dir="rtl" className="min-h-screen w-full overflow-y-auto bg-[#FDFBF7] p-4 sm:p-8 text-[#4A5D4E] font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#4A5D4E]/15">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#2C352E]">פאנל ניהול מוזמנים וברכות</h1>
            <p className="text-sm opacity-70 mt-1">בר המצווה של תובל מעוז • {totalGuests} אורחים מגיעים בסך הכל</p>
          </div>
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="self-start sm:self-auto px-4 py-2 bg-white border border-[#4A5D4E]/30 text-sm font-semibold rounded-xl hover:bg-[#F4EFE6] transition-colors flex items-center gap-2 shadow-xs"
          >
            🔄 רענון נתונים
          </button>
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
          <div className="bg-white rounded-2xl shadow-xs border border-[#4A5D4E]/20 overflow-x-auto">
            <table className="w-full text-right min-w-[700px]">
              <thead className="bg-[#4A5D4E]/5 border-b border-[#4A5D4E]/15 text-xs text-[#2C352E]">
                <tr>
                  <th className="p-3.5 font-bold">שם האורח</th>
                  <th className="p-3.5 font-bold">מגיע?</th>
                  <th className="p-3.5 font-bold">שלב באירוע</th>
                  <th className="p-3.5 font-bold text-center">מבוגרים ונוער (11+)</th>
                  <th className="p-3.5 font-bold text-center">ילדים (3-11)</th>
                  <th className="p-3.5 font-bold text-center">תינוקות (עד גיל 3)</th>
                  <th className="p-3.5 font-bold">קטגוריה</th>
                  <th className="p-3.5 font-bold">זמן הרשמה</th>
                  <th className="p-3.5 font-bold text-center">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#4A5D4E]/10 text-sm">
                {guests.map((guest) => (
                  <tr key={guest.id} className="hover:bg-[#4A5D4E]/5 transition-colors">
                    <td className="p-3.5 font-semibold text-[#2C352E]">{guest.name}</td>
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
                {guests.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center opacity-60">
                      עדיין אין אורחים במסד הנתונים
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
