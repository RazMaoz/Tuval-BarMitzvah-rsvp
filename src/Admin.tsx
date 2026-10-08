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

  useEffect(() => {
    fetch('/api/guests')
      .then(res => res.json())
      .then(data => setGuests(data))
      .catch(console.error);
  }, []);

  const handleCategoryChange = async (id: number, newCategory: string) => {
    // Optimistic UI update
    setGuests(prev => prev.map(g => g.id === id ? { ...g, category: newCategory } : g));
    
    // API call
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

  const attendingGuests = guests.filter(g => g.attending);
  const totalAdults = attendingGuests.reduce((sum, g) => sum + (g.adults || 0), 0);
  const totalKids = attendingGuests.reduce((sum, g) => sum + (g.kids || 0), 0);
  const totalBabies = attendingGuests.reduce((sum, g) => sum + (g.babies || 0), 0);

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFBF7] p-8 text-[#4A5D4E] font-sans">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">פאנל ניהול מוזמנים</h1>
        <p className="opacity-70 mb-8">בר המצווה של תובל</p>
        
        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl border border-[#4A5D4E]/20 shadow-sm flex flex-col items-center">
            <span className="text-5xl font-bold">{totalAdults}</span>
            <span className="opacity-70 mt-2 font-medium">מבוגרים (12+)</span>
          </div>
          <div className="bg-white p-6 rounded-xl border border-[#4A5D4E]/20 shadow-sm flex flex-col items-center">
            <span className="text-5xl font-bold">{totalKids}</span>
            <span className="opacity-70 mt-2 font-medium">ילדים (2-12)</span>
          </div>
          <div className="bg-white p-6 rounded-xl border border-[#4A5D4E]/20 shadow-sm flex flex-col items-center">
            <span className="text-5xl font-bold">{totalBabies}</span>
            <span className="opacity-70 mt-2 font-medium">תינוקות (עד 2)</span>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-[#4A5D4E]/20 overflow-hidden">
          <table className="w-full text-right">
            <thead className="bg-[#4A5D4E]/5 border-b border-[#4A5D4E]/20 text-sm">
              <tr>
                <th className="p-4 font-bold">שם האורח</th>
                <th className="p-4 font-bold">מגיע?</th>
                <th className="p-4 font-bold">שלב באירוע</th>
                <th className="p-4 font-bold text-center">מבוגרים</th>
                <th className="p-4 font-bold text-center">ילדים</th>
                <th className="p-4 font-bold text-center">תינוקות</th>
                <th className="p-4 font-bold">קטגוריה</th>
                <th className="p-4 font-bold">זמן הרשמה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#4A5D4E]/10">
              {guests.map(guest => (
                <tr key={guest.id} className="hover:bg-[#4A5D4E]/5 transition-colors">
                  <td className="p-4 font-medium">{guest.name}</td>
                  <td className="p-4">{guest.attending ? '✅ כן' : '❌ לא'}</td>
                  <td className="p-4">{guest.event_part || '-'}</td>
                  <td className="p-4 text-center">{guest.attending ? guest.adults || 0 : '-'}</td>
                  <td className="p-4 text-center">{guest.attending ? guest.kids || 0 : '-'}</td>
                  <td className="p-4 text-center">{guest.attending ? guest.babies || 0 : '-'}</td>
                  <td className="p-4">
                    <select 
                      value={guest.category || ""} 
                      onChange={(e) => handleCategoryChange(guest.id, e.target.value)}
                      className="bg-white border border-[#4A5D4E]/30 rounded-lg py-1.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A5D4E] min-w-[140px]"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat === "" ? "ללא קטגוריה" : cat}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4 text-sm opacity-60" dir="ltr">
                    {new Date(guest.created_at + 'Z').toLocaleString('en-GB', {
                      timeZone: 'Asia/Jerusalem',
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false
                    })}
                  </td>
                </tr>
              ))}
              {guests.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center opacity-60">עדיין אין אורחים במסד הנתונים</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
