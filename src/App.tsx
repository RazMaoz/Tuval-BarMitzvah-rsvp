import { useState, useEffect } from 'react';
import { MapPin, PartyPopper, Heart, Send, Calendar, MessageSquareHeart, Wand2, Undo2, Redo2, ChevronLeft, ChevronRight } from 'lucide-react';

function App() {
  const [step, setStep] = useState(() => {
    return window.history.state?.step || 0;
  }); // Wizard step
  
  useEffect(() => {
    if (window.history.state?.step === undefined) {
      window.history.replaceState({ step: 0 }, '');
    }
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.step !== undefined) {
        setStep(event.state.step);
      } else {
        setStep(0);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const goToStep = (newStep: number) => {
    window.history.pushState({ step: newStep }, '');
    setStep(newStep);
  };

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

  const handleNext = () => {
    if (step === 1 && !formData.name.trim()) return;
    if (step === 2 && !formData.attending) return;
    if (step === 2 && formData.attending === 'no') {
      goToStep(5);
      return;
    }
    goToStep(step + 1);
  };

  const handlePrev = () => {
    window.history.back();
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    
    if (formData.attending === 'yes') {
      if (formData.adults === 0) {
        setErrorMessage('אנא ודאו שסימנתם לפחות מבוגר אחד.');
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
    const textLen = blessingData.content.trim().length;
    if (textLen > 0 && textLen < 10) {
      alert("אם התחלתם לכתוב, אנא כתבו לפחות 10 תווים (כמה מילים) כדי שהבינה המלאכותית תוכל להבין את כוונתכם ולשדרג את הברכה, או השאירו ריק כדי שנייצר ברכה מאפס.");
      return;
    }
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
      } else {
        alert("מערכת השדרוג עמוסה כרגע. תוכלו לנסות שוב בעוד מספר דקות, או לשלוח את הברכה המקורית כפי שהיא.");
      }
    } catch (err) {
      console.error("AI Generation failed", err);
      alert("מערכת השדרוג עמוסה כרגע. תוכלו לנסות שוב בעוד מספר דקות, או לשלוח את הברכה המקורית כפי שהיא.");
    } finally {
      setIsAILoading(false);
    }
  };

  const handleUndo = () => {
    let newHist = [...history];
    let currIdx = historyIndex;
    
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
    if (historyIndex >= 0 && historyIndex < history.length - 1) {
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

  const renderBlessingSection = (isAttending = true) => (
    <>
      {!showBlessingForm && blessingStatus === 'idle' && (
        <div className="mt-8 animate-in fade-in slide-in-from-bottom-2">
          {!isAttending && (
            <div className="text-[#4A5D4E] font-medium text-md mb-3 bg-[#FDFBF7] p-3 rounded-lg border border-[#4A5D4E]/10">
              בכל מקרה, נשמח לקבל ברכה קטנה לתובל. אפשר להשאיר אותה ממש כאן:
            </div>
          )}
          <button 
            onClick={() => setShowBlessingForm(true)}
            className={`flex items-center justify-center gap-2 w-full px-6 py-4 rounded-xl font-bold transition-all shadow-sm ${!isAttending ? 'bg-[#4A5D4E] text-white hover:bg-[#3A4A3E]' : 'bg-[#FDFBF7] text-[#4A5D4E] border border-[#4A5D4E]/30 hover:bg-[#4A5D4E]/5'}`}
          >
            <MessageSquareHeart className="w-5 h-5" />
            {isAttending ? 'השארת ברכה לתובל' : 'כתיבת ברכה לתובל ✍️'}
          </button>
        </div>
      )}

      {showBlessingForm && blessingStatus !== 'success' && (
        <form onSubmit={handleBlessingSubmit} className="bg-[#FDFBF7] p-5 rounded-xl border border-[#4A5D4E]/10 space-y-4 mt-6 text-right animate-in fade-in slide-in-from-top-4">
          <div className="font-bold text-lg text-center flex items-center justify-center gap-2">
            <MessageSquareHeart className="w-5 h-5" />
            כתבו ברכה לתובל
          </div>
          <textarea
            required
            minLength={10}
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
              גלוי לכולם באתר
            </label>
            <label className="flex items-center gap-3 cursor-pointer text-sm">
              <input 
                type="radio" 
                name="visibility" 
                checked={!blessingData.isPublic} 
                onChange={() => setBlessingData(prev => ({ ...prev, isPublic: false }))}
                className="accent-[#4A5D4E] w-4 h-4"
              />
              פרטי
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
    if (formData.attending === 'no') {
      return (
        <div dir="rtl" className="h-[100dvh] bg-[#FDFBF7] text-[#4A5D4E] flex flex-col items-center justify-center p-4 font-sans overflow-hidden">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 border border-[#4A5D4E]/20 text-center flex flex-col justify-center">
            <Heart className="w-12 h-12 mx-auto text-[#4A5D4E] mb-4" />
            <h1 className="text-2xl font-bold mb-2">תודה רבה!</h1>
            <p className="text-md mb-6">חבל שלא תוכלו להגיע. להתראות בשמחות אחרות!</p>
            {renderBlessingSection(false)}
          </div>
        </div>
      );
    }
    return (
      <div dir="rtl" className="h-[100dvh] bg-[#FDFBF7] text-[#4A5D4E] flex flex-col items-center justify-center p-4 font-sans overflow-hidden">
        <div className="max-w-md w-full h-[90dvh] overflow-y-auto bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-[#4A5D4E]/20 text-center">
          <PartyPopper className="w-16 h-16 mx-auto text-[#4A5D4E] mb-4" />
          <h1 className="text-3xl font-bold mb-2">איזה כיף שאתם באים!</h1>
          <p className="text-lg">התשובה התקבלה בהצלחה.</p>
          
          <div className="bg-[#FDFBF7] p-4 rounded-xl space-y-4 mt-6 border border-[#4A5D4E]/10 text-right">
            <div className="flex items-center gap-2 font-semibold text-lg text-center justify-center">
              <MapPin className="w-5 h-5" />
              <span>הגעה וחניה</span>
            </div>
            <p className="text-md font-medium text-center">
              "תחנת דלק מעייני שמחה, רעננה"
            </p>
            
            <div className="space-y-3 pt-2">
              <a 
                href="https://waze.com/ul?q=%D7%AA%D7%97%D7%A0%D7%AA+%D7%93%D7%9C%D7%A7+%D7%9E%D7%A2%D7%99%D7%99%D7%A0%D7%99+%D7%A9%D7%9E%D7%97%D7%94,+%D7%A8%D7%A2%D7%A0%D7%A0%D7%94" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-[#4A5D4E] text-white px-4 py-3 rounded-xl font-medium hover:bg-[#3A4A3E]"
              >
                <MapPin className="w-5 h-5" /> ניווט ב-Waze
              </a>
              <a 
                href={googleCalendarUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 bg-white text-[#4A5D4E] border border-[#4A5D4E] px-4 py-3 rounded-xl font-medium"
              >
                <Calendar className="w-5 h-5" /> יומן Google
              </a>
              <button 
                onClick={handleDownloadIcs}
                className="flex items-center justify-center gap-2 bg-white text-[#4A5D4E] border border-[#4A5D4E]/50 px-4 py-3 rounded-xl font-medium w-full"
              >
                <Calendar className="w-5 h-5" /> הוספה ליומנים אחרים
              </button>
            </div>
          </div>
          {renderBlessingSection(true)}
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="h-[100dvh] bg-[#FDFBF7] text-[#4A5D4E] flex flex-col items-center justify-center p-4 font-sans overflow-hidden">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-[#4A5D4E]/10 flex flex-col max-h-[90dvh]">
        <div className="bg-[#4A5D4E] text-white text-center py-6 px-6 shrink-0">
          <h1 className="text-2xl font-bold tracking-wide">בר מצווה לתוּבַל</h1>
          <div className="flex items-center justify-center gap-1 mt-2">
            {[0,1,2,3,4,5].map(i => (
              <div key={i} className={`h-1.5 rounded-full transition-all ${i <= step ? 'w-4 bg-white' : 'w-2 bg-white/30'}`} />
            ))}
          </div>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto">
          {step === 0 && (
            <div className="text-center space-y-6 animate-in slide-in-from-left-4">
              <PartyPopper className="w-16 h-16 mx-auto text-[#4A5D4E]/80" />
              <h2 className="text-2xl font-bold">איזה כיף, נשמח לראותכם!</h2>
              <p className="text-lg opacity-90">האירוע יתקיים ב-10.11.2026<br/>ב-West Garden, רעננה</p>
              <button onClick={handleNext} className="mt-8 w-full bg-[#4A5D4E] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#3A4A3E]">
                בואו נתחיל
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-left-4">
              <h2 className="text-2xl font-bold text-center mb-8">איך קוראים לכם?</h2>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full bg-[#FDFBF7] border border-[#4A5D4E]/30 rounded-xl px-4 py-4 text-center text-lg focus:outline-none focus:ring-2 focus:ring-[#4A5D4E]"
                placeholder="שם משפחה / מלא"
                autoFocus
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-left-4">
              <h2 className="text-2xl font-bold text-center mb-8">האם תגיעו לחגוג איתנו?</h2>
              <div className="flex flex-col gap-4">
                <label className="cursor-pointer relative">
                  <input type="radio" name="attending" value="yes" checked={formData.attending === 'yes'} onChange={handleChange} className="peer sr-only" />
                  <div className="text-center py-4 text-lg border border-[#4A5D4E]/30 rounded-xl peer-checked:bg-[#4A5D4E] peer-checked:text-white transition-all hover:bg-[#FDFBF7]">
                    ברור, נגיע בשמחה!
                  </div>
                </label>
                <label className="cursor-pointer relative">
                  <input type="radio" name="attending" value="no" checked={formData.attending === 'no'} onChange={handleChange} className="peer sr-only" />
                  <div className="text-center py-4 text-lg border border-[#4A5D4E]/30 rounded-xl peer-checked:bg-[#4A5D4E] peer-checked:text-white transition-all hover:bg-[#FDFBF7]">
                    לצערנו לא נוכל
                  </div>
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-left-4">
              <h2 className="text-2xl font-bold text-center mb-8">לאיזה חלק תגיעו?</h2>
              <div className="flex flex-col gap-3">
                {[
                  { value: 'עלייה לתורה', label: 'רק לעלייה לתורה (16:00)' },
                  { value: 'מסיבה', label: 'רק למסיבה (17:00)' },
                  { value: 'שניהם', label: 'מגיעים להכל!' }
                ].map((option) => (
                  <label key={option.value} className="cursor-pointer relative">
                    <input type="radio" name="part" value={option.value} checked={formData.part === option.value} onChange={handleChange} className="peer sr-only" />
                    <div className="text-center py-4 text-lg border border-[#4A5D4E]/30 rounded-xl peer-checked:bg-[#4A5D4E]/10 peer-checked:border-[#4A5D4E] peer-checked:font-bold transition-all">
                      {option.label}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6 animate-in slide-in-from-left-4">
              <h2 className="text-2xl font-bold text-center mb-8">כמה מגיעים?</h2>
              <div className="space-y-4">
                {[
                  { id: 'adults', label: 'מבוגרים (12+)', val: formData.adults },
                  { id: 'children', label: 'ילדים (2-12)', val: formData.children },
                  { id: 'babies', label: 'תינוקות (0-2)', val: formData.babies }
                ].map(field => (
                  <div key={field.id} className="flex items-center justify-between p-4 bg-[#FDFBF7] rounded-xl border border-[#4A5D4E]/10">
                    <div className="font-medium text-lg">{field.label}</div>
                    <div className="flex items-center gap-4">
                      <button onClick={() => setFormData(p => ({...p, [field.id]: Math.max(0, p[field.id as keyof typeof formData] as number - 1)}))} className="w-8 h-8 rounded-full bg-white border border-[#4A5D4E] text-[#4A5D4E] flex items-center justify-center font-bold">-</button>
                      <span className="w-4 text-center font-bold text-lg">{field.val}</span>
                      <button onClick={() => setFormData(p => ({...p, [field.id]: (p[field.id as keyof typeof formData] as number) + 1}))} className="w-8 h-8 rounded-full bg-[#4A5D4E] text-white flex items-center justify-center font-bold">+</button>
                    </div>
                  </div>
                ))}
              </div>
              {errorMessage && <div className="text-red-500 text-center font-medium mt-2">{errorMessage}</div>}
            </div>
          )}
          
          {step === 5 && (
            <div className="space-y-6 text-center animate-in zoom-in-95">
              <h2 className="text-2xl font-bold mb-4">מוכנים לשלוח?</h2>
              <div className="bg-[#FDFBF7] p-6 rounded-xl border border-[#4A5D4E]/20 space-y-2 text-right">
                <p><strong>שם:</strong> {formData.name}</p>
                <p><strong>הגעה:</strong> {formData.attending === 'yes' ? 'מגיעים בשמחה' : 'לא מגיעים'}</p>
                {formData.attending === 'yes' && (
                  <>
                    <p><strong>חלק:</strong> {formData.part}</p>
                    <p><strong>הרכב:</strong> {formData.adults} מבוגרים, {formData.children} ילדים, {formData.babies} תינוקות</p>
                  </>
                )}
              </div>
              <button
                onClick={() => handleSubmit()}
                disabled={status === 'submitting'}
                className="w-full bg-[#4A5D4E] text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-[#3A4A3E] disabled:opacity-70"
              >
                {status === 'submitting' ? 'שולח...' : 'אישור סופי'}
                {!status && <Send className="w-5 h-5 rtl:-scale-x-100" />}
              </button>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        {step > 0 && step <= 5 && (
          <div className="p-4 border-t border-[#4A5D4E]/10 flex items-center justify-between bg-gray-50 shrink-0">
            <button onClick={handlePrev} className="p-2 text-[#4A5D4E] hover:bg-gray-200 rounded-lg flex items-center gap-1">
              <ChevronRight className="w-5 h-5" /> חזור
            </button>
            {step < 5 && (
              <button 
                onClick={handleNext} 
                disabled={
                  (step === 1 && !formData.name.trim()) || 
                  (step === 2 && !formData.attending)
                }
                className="px-6 py-2 bg-[#4A5D4E] text-white rounded-lg font-medium hover:bg-[#3A4A3E] disabled:opacity-50 flex items-center gap-1"
              >
                המשך <ChevronLeft className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
