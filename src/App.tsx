import { useState } from 'react';
import { MapPin, PartyPopper, Heart, Send, Calendar, MessageSquareHeart, Wand2, Undo2, Redo2 } from 'lucide-react';

function App() {
  const [formData, setFormData] = useState({
    name: '',
    attending: '',
    part: 'שניהם',
    babies: 0,
    children: 0,
    adults: 1,
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  const [blessingData, setBlessingData] = useState({ content: '', isPublic: true });
  const [blessingStatus, setBlessingStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [showBlessingForm, setShowBlessingForm] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    
    if (formData.attending === 'yes') {
      if (formData.adults === 0) {
        setErrorMessage('שמנו לב שסימנתם הגעה, אבל לא סומנו מבוגרים. מישהו הרי צריך להשגיח על הילדים 😉 אנא ודאו שסימנתם לפחות מבוגר אחד.');
        return;
      }
    }
    
    setStatus('submitting');
    try {
      const response = await fetch('/api/rsvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      // Even if the server doesn't exist yet, we'll assume it might work or we just handle the UI.
      if (response.ok) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  const handleBlessingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBlessingStatus('submitting');
    try {
      const response = await fetch('/api/blessings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: formData.name || 'אורח',
          content: blessingData.content,
          is_public: blessingData.isPublic
        }),
      });
      if (response.ok) {
        setBlessingStatus('success');
      } else {
        setBlessingStatus('error');
      }
    } catch (err) {
      console.error(err);
      setBlessingStatus('error');
    }
  };

  const handleAIEnhance = async () => {
    setIsAILoading(true);
    try {
      const response = await fetch('/api/generate-blessing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: blessingData.content,
          guestName: formData.name
        }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          let newHist = [...history];
          let currIdx = historyIndex;
          if (currIdx === -1 || newHist[currIdx] !== blessingData.content) {
            newHist = newHist.slice(0, currIdx + 1);
            newHist.push(blessingData.content);
            currIdx = newHist.length - 1;
          }
          newHist.push(data.result);
          setHistory(newHist);
          setHistoryIndex(newHist.length - 1);
          setBlessingData(prev => ({ ...prev, content: data.result }));
        }
      }
    } catch (err) {
      console.error("AI Generation failed", err);
    } finally {
      setIsAILoading(false);
    }
  };

  const handleUndo = () => {
    let newHist = [...history];
    let currIdx = historyIndex;
    
    // Save current typing before undoing if not already saved
    if (currIdx === -1 || newHist[currIdx] !== blessingData.content) {
      newHist = newHist.slice(0, currIdx + 1);
      newHist.push(blessingData.content);
      currIdx = newHist.length - 1;
      setHistory(newHist);
    }
    
    if (currIdx > 0) {
      const prevIdx = currIdx - 1;
      setHistoryIndex(prevIdx);
      setBlessingData(prev => ({ ...prev, content: newHist[prevIdx] }));
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setBlessingData(prev => ({ ...prev, content: history[nextIdx] }));
    }
  };

  const handleDownloadIcs = () => {
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:בר המצווה של תובל
DTSTART:20261110T140000Z
DTEND:20261110T170000Z
LOCATION:West Garden, רחוב ויצמן 273, רעננה
DESCRIPTION:\u202Bאיזה כיף\\, נשמח לראותכם!\\nהאירוע יכלול טקס עלייה לתורה (מתחילים ב־16:00)\\nחניה: יש לרשום בווייז "תחנת דלק מעייני שמחה\\, רעננה"\\n(מדובר בחנייה עירונית בתשלום)\\n\\nרחל\\, רז ותובל\u202C
END:VEVENT
END:VCALENDAR`;
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'tuval_bar_mitzvah.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const calendarDesc = '\u202Bאיזה כיף, נשמח לראותכם!\nהאירוע יכלול טקס עלייה לתורה (מתחילים ב־16:00)\nחניה: יש לרשום בווייז "תחנת דלק מעייני שמחה, רעננה"\n(מדובר בחנייה עירונית בתשלום)\n\nרחל, רז ותובל\u202C';
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent('בר המצווה של תובל')}&dates=20261110T140000Z/20261110T170000Z&details=${encodeURIComponent(calendarDesc)}&location=${encodeURIComponent('West Garden, ויצמן 273, רעננה')}`;

  const renderBlessingSection = () => (
    <>
      {!showBlessingForm && blessingStatus === 'idle' && (
        <button 
          onClick={() => setShowBlessingForm(true)}
          className="mt-6 flex items-center justify-center gap-2 bg-[#FDFBF7] text-[#4A5D4E] border border-[#4A5D4E]/30 px-6 py-3 rounded-xl font-medium hover:bg-[#4A5D4E]/5 transition-colors w-full"
        >
          <MessageSquareHeart className="w-5 h-5" />
          השארת ברכה לתובל
        </button>
      )}

      {showBlessingForm && blessingStatus !== 'success' && (
        <form onSubmit={handleBlessingSubmit} className="bg-[#FDFBF7] p-5 rounded-xl border border-[#4A5D4E]/10 space-y-4 mt-6 text-right animate-in fade-in slide-in-from-top-4">
          <div className="font-bold text-lg text-center flex items-center justify-center gap-2">
            <MessageSquareHeart className="w-5 h-5" />
            כתבו ברכה לתובל
          </div>
          <textarea
            required
            value={blessingData.content}
            onChange={(e) => setBlessingData(prev => ({ ...prev, content: e.target.value }))}
            className="w-full bg-white border border-[#4A5D4E]/30 rounded-lg p-3 min-h-[100px] focus:outline-none focus:ring-2 focus:ring-[#4A5D4E] resize-none"
            placeholder="מזל טוב תובל!..."
          />
          
          <div className="flex items-center gap-2 mt-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex <= 0 && (history.length === 0 || blessingData.content === history[0])}
              className="p-2 bg-white text-[#4A5D4E] border border-[#4A5D4E]/30 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-30 flex-shrink-0"
              title="חזור אחורה"
            >
              <Undo2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleAIEnhance}
              disabled={isAILoading}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#4A5D4E] to-[#6A7D6E] text-white py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-70"
            >
              <Wand2 className={`w-4 h-4 ${isAILoading ? 'animate-spin' : ''}`} />
              {isAILoading ? 'הקסם קורה...' : (blessingData.content.trim() ? 'שדרוג הברכה בעזרת AI' : 'כתוב לי ברכה בעזרת AI')}
            </button>

            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1 || history.length === 0}
              className="p-2 bg-white text-[#4A5D4E] border border-[#4A5D4E]/30 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-30 flex-shrink-0"
              title="בצע שוב"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div className="text-sm font-semibold">מי יכול לראות את הברכה?</div>
            <label className="flex items-center gap-3 cursor-pointer text-sm">
              <input 
                type="radio" 
                name="visibility" 
                checked={blessingData.isPublic} 
                onChange={() => setBlessingData(prev => ({ ...prev, isPublic: true }))}
                className="accent-[#4A5D4E] w-4 h-4"
              />
              גלוי לכולם באתר בר המצווה
            </label>
            <label className="flex items-center gap-3 cursor-pointer text-sm">
              <input 
                type="radio" 
                name="visibility" 
                checked={!blessingData.isPublic} 
                onChange={() => setBlessingData(prev => ({ ...prev, isPublic: false }))}
                className="accent-[#4A5D4E] w-4 h-4"
              />
              פרטי (למשפחה בלבד)
            </label>
          </div>
          <button
            type="submit"
            disabled={blessingStatus === 'submitting'}
            className="w-full bg-[#4A5D4E] text-white py-3 rounded-lg font-medium hover:bg-[#3A4A3E] transition-colors disabled:opacity-70 mt-2"
          >
            {blessingStatus === 'submitting' ? 'שולח...' : 'שליחת ברכה'}
          </button>
        </form>
      )}

      {blessingStatus === 'success' && (
        <div className="bg-[#4A5D4E]/10 text-[#4A5D4E] p-4 rounded-xl mt-6 font-medium animate-in zoom-in duration-300">
          הברכה נשלחה בהצלחה! תודה רבה 💖
        </div>
      )}
    </>
  );

  if (status === 'success') {
    return (
      <div dir="rtl" className="min-h-screen bg-[#FDFBF7] text-[#4A5D4E] flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-[#4A5D4E]/20 text-center space-y-6">
          {formData.attending === 'yes' ? (
            <>
              <PartyPopper className="w-16 h-16 mx-auto text-[#4A5D4E]" />
              <h1 className="text-3xl font-bold">איזה כיף שאתם באים!</h1>
              <p className="text-lg">התשובה שלכם התקבלה בהצלחה. נשמח לראותכם!</p>
              
              <div className="bg-[#FDFBF7] p-4 rounded-xl space-y-4 mt-6 border border-[#4A5D4E]/10">
                <div className="flex items-center justify-center gap-2 font-semibold text-lg">
                  <MapPin className="w-5 h-5" />
                  <span>דרכי הגעה וחניה</span>
                </div>
                <p className="text-md font-medium text-center">
                  חניה: "תחנת דלק מעייני שמחה, רעננה"
                </p>
                
                <div className="space-y-3 pt-2">
                  <a 
                    href="https://waze.com/ul?q=%D7%AA%D7%97%D7%A0%D7%AA+%D7%93%D7%9C%D7%A7+%D7%9E%D7%A2%D7%99%D7%99%D7%A0%D7%99+%D7%A9%D7%9E%D7%97%D7%94,+%D7%A8%D7%A2%D7%A0%D7%A0%D7%94" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-[#4A5D4E] text-white px-6 py-3 rounded-xl font-medium hover:bg-[#3A4A3E] transition-colors w-full"
                  >
                    <MapPin className="w-5 h-5" />
                    ניווט באמצעות Waze
                  </a>

                  <a 
                    href={googleCalendarUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 bg-white text-[#4A5D4E] border-2 border-[#4A5D4E] px-6 py-3 rounded-xl font-medium hover:bg-[#FDFBF7] transition-colors w-full"
                  >
                    <Calendar className="w-5 h-5" />
                    הוספה ליומן Google
                  </a>

                  <button 
                    onClick={handleDownloadIcs}
                    className="flex items-center justify-center gap-2 bg-white text-[#4A5D4E] border-2 border-[#4A5D4E]/50 px-6 py-3 rounded-xl font-medium hover:bg-[#FDFBF7] transition-colors w-full"
                  >
                    <Calendar className="w-5 h-5" />
                    הוספה ליומנים אחרים
                  </button>
                </div>
              </div>
              
              {renderBlessingSection()}
            </>
          ) : (
            <>
              <Heart className="w-16 h-16 mx-auto text-[#4A5D4E]" />
              <h1 className="text-3xl font-bold">תודה רבה!</h1>
              <div className="text-lg space-y-2">
                <p>חבל שלא תוכלו להגיע.</p>
                <p>איחולים וברכות לתובל יתקבלו בשמחה רבה 🤍✨</p>
                <p>להתראות בשמחות אחרות!</p>
              </div>

              {renderBlessingSection()}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#FDFBF7] text-[#4A5D4E] flex flex-col items-center py-12 p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#4A5D4E]/10">
        <div className="bg-[#4A5D4E] text-white text-center py-10 px-6">
          <h1 className="text-4xl font-bold mb-3 tracking-wide">בר מצווה לתוּבַל</h1>
          <p className="text-lg opacity-90">נשמח לראותכם ביום שמחתנו</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* Name */}
          <div className="space-y-2">
            <label className="block font-semibold text-lg" htmlFor="name">
              שם מלא (משפחה) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full bg-[#FDFBF7] border border-[#4A5D4E]/30 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#4A5D4E] transition-all"
              placeholder="ישראל ישראלי"
            />
          </div>

          {/* Attending */}
          <div className="space-y-3">
            <label className="block font-semibold text-lg">האם תגיעו?</label>
            <div className="flex gap-4">
              <label className="flex-1 cursor-pointer relative">
                <input
                  type="radio"
                  name="attending"
                  value="yes"
                  required
                  checked={formData.attending === 'yes'}
                  onChange={handleChange}
                  className="peer sr-only"
                />
                <div className="text-center py-3 border border-[#4A5D4E]/30 rounded-xl peer-checked:bg-[#4A5D4E] peer-checked:text-white transition-all hover:bg-[#FDFBF7] peer-checked:hover:bg-[#4A5D4E]">
                  בשמחה!
                </div>
              </label>
              <label className="flex-1 cursor-pointer relative">
                <input
                  type="radio"
                  name="attending"
                  value="no"
                  required
                  checked={formData.attending === 'no'}
                  onChange={handleChange}
                  className="peer sr-only"
                />
                <div className="text-center py-3 border border-[#4A5D4E]/30 rounded-xl peer-checked:bg-[#4A5D4E] peer-checked:text-white transition-all hover:bg-[#FDFBF7] peer-checked:hover:bg-[#4A5D4E]">
                  לא נוכל
                </div>
              </label>
            </div>
          </div>

          {/* Conditional fields if attending */}
          {formData.attending === 'yes' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
              {/* Part */}
              <div className="space-y-3">
                <label className="block font-semibold text-lg">לאיזה חלק תגיעו?</label>
                <div className="flex flex-col gap-3">
                  {[
                    { value: 'עלייה לתורה', label: 'עלייה לתורה (הטקס יחל בשעה 16:00)' },
                    { value: 'מסיבה', label: 'מסיבה (החל משעה 17:00)' },
                    { value: 'שניהם', label: 'שניהם' }
                  ].map((option) => (
                    <label key={option.value} className="cursor-pointer relative">
                      <input
                        type="radio"
                        name="part"
                        value={option.value}
                        checked={formData.part === option.value}
                        onChange={handleChange}
                        className="peer sr-only"
                      />
                      <div className="text-center py-3 border border-[#4A5D4E]/30 rounded-lg peer-checked:bg-[#4A5D4E]/10 peer-checked:border-[#4A5D4E] peer-checked:font-bold transition-all hover:bg-[#FDFBF7]">
                        {option.label}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Guests Count */}
              <div className="space-y-4">
                <label className="block font-semibold text-lg mb-4">כמה מגיעים?</label>
                
                <div className="flex items-center justify-between p-3 bg-[#FDFBF7] rounded-xl border border-[#4A5D4E]/10">
                  <div className="font-medium">מבוגרים (12+)</div>
                  <input
                    type="number"
                    name="adults"
                    min="0"
                    value={formData.adults}
                    onChange={handleChange}
                    className="w-20 text-center border border-[#4A5D4E]/30 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#4A5D4E] bg-white"
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-[#FDFBF7] rounded-xl border border-[#4A5D4E]/10">
                  <div className="font-medium">ילדים (2-12)</div>
                  <input
                    type="number"
                    name="children"
                    min="0"
                    value={formData.children}
                    onChange={handleChange}
                    className="w-20 text-center border border-[#4A5D4E]/30 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#4A5D4E] bg-white"
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-[#FDFBF7] rounded-xl border border-[#4A5D4E]/10">
                  <div className="font-medium">תינוקות (0-2)</div>
                  <input
                    type="number"
                    name="babies"
                    min="0"
                    value={formData.babies}
                    onChange={handleChange}
                    className="w-20 text-center border border-[#4A5D4E]/30 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#4A5D4E] bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {(status === 'error' || errorMessage) && (
            <div className="text-[#4A5D4E] text-sm text-center font-medium bg-[#4A5D4E]/10 p-4 rounded-xl border border-[#4A5D4E]/20 animate-in fade-in slide-in-from-top-2">
              {errorMessage || 'אירעה שגיאה בשליחת הטופס. אנא נסו שוב.'}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={status === 'submitting' || !formData.attending}
            className="w-full bg-[#4A5D4E] text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-[#3A4A3E] transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {status === 'submitting' ? 'שולח...' : 'אישור הגעה'}
            {!status && <Send className="w-5 h-5 rtl:-scale-x-100" />}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
