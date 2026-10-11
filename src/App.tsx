import { useState, useEffect } from 'react';
import { Calendar, MapPin, Wand2, Undo2, Redo2, Check, Clock } from 'lucide-react';

type StepType = 1 | 2 | 3 | 4 | 'decline';

export default function App() {
  const [step, setStep] = useState<StepType>(() => {
    return (window.history.state?.step as StepType) || 1;
  });

  useEffect(() => {
    if (window.history.state?.step === undefined) {
      window.history.replaceState({ step: 1 }, '');
    }
    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.step !== undefined) {
        setStep(event.state.step);
      } else {
        setStep(1);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const goToStep = (newStep: StepType) => {
    window.history.pushState({ step: newStep }, '');
    setStep(newStep);
  };

  const [formData, setFormData] = useState(() => {
    const savedName = typeof window !== 'undefined' ? sessionStorage.getItem('rsvp_name') || '' : '';
    return {
      name: savedName,
      adults: 1,
      children: 0,
      babies: 0,
    };
  });

  const [guestId, setGuestId] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('rsvp_guest_id');
      return saved ? Number(saved) : null;
    }
    return null;
  });

  const [blessingId, setBlessingId] = useState<number | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('rsvp_blessing_id');
      return saved ? Number(saved) : null;
    }
    return null;
  });

  const isEditMode = Boolean(guestId);

  const handleResetGuest = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('rsvp_guest_id');
      sessionStorage.removeItem('rsvp_blessing_id');
      sessionStorage.removeItem('rsvp_name');
    }
    setGuestId(null);
    setBlessingId(null);
    setFormData({
      name: '',
      adults: 1,
      children: 0,
      babies: 0,
    });
    setBlessingData({
      content: '',
      isPublic: true,
    });
    setBlessingSubmitted(false);
    setHistory([]);
    setHistoryIndex(-1);
    goToStep(1);
  };

  // Defense against page refresh on mid-step without a name
  useEffect(() => {
    if (step !== 1 && !formData.name.trim()) {
      goToStep(1);
    }
  }, [step, formData.name]);

  const [nameError, setNameError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Blessing state
  const [blessingData, setBlessingData] = useState({
    content: '',
    isPublic: true,
  });
  const [blessingSubmitted, setBlessingSubmitted] = useState(false);
  const [isAILoading, setIsAILoading] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Validation
  const validateName = () => {
    if (!formData.name.trim()) {
      setNameError('נא להזין שם מלא כדי להמשיך');
      return false;
    }
    setNameError('');
    return true;
  };

  // Handle Attending decision from Screen 1
  const handleSelectAttending = () => {
    if (!validateName()) return;
    goToStep(2);
  };

  // Handle Decline decision from Screen 1
  const handleSelectDecline = async () => {
    if (!validateName()) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guestId,
          name: formData.name.trim(),
          attending: false,
          part: 'אינו מגיע',
          adults: 0,
          kids: 0,
          babies: 0,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.guestId) {
          setGuestId(data.guestId);
          sessionStorage.setItem('rsvp_guest_id', String(data.guestId));
        }
      }
      goToStep('decline');
    } catch {
      goToStep('decline');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit attending RSVP & Blessing
  const handleFinalSubmit = async () => {
    if (!validateName()) {
      goToStep(1);
      return;
    }
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: guestId,
          name: formData.name.trim(),
          attending: true,
          part: 'האירוע המלא',
          adults: formData.adults,
          kids: formData.children,
          children: formData.children,
          babies: formData.babies,
        }),
      });

      if (!res.ok) throw new Error('שגיאה בשמירת הנתונים');
      const data = await res.json();
      if (data.guestId) {
        setGuestId(data.guestId);
        sessionStorage.setItem('rsvp_guest_id', String(data.guestId));
      }

      // Submit blessing if entered
      if (blessingData.content.trim()) {
        const blessRes = await fetch('/api/blessings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: blessingId,
            author_name: formData.name.trim(),
            content: blessingData.content.trim(),
            is_public: blessingData.isPublic,
          }),
        });
        if (blessRes.ok) {
          const blessData = await blessRes.json();
          if (blessData.blessingId) {
            setBlessingId(blessData.blessingId);
            sessionStorage.setItem('rsvp_blessing_id', String(blessData.blessingId));
          }
        }
      }

      goToStep(4);
    } catch (err: any) {
      setSubmitError(err.message || 'אירעה שגיאה. אנא נסה שנית.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit blessing from decline screen
  const handleDeclineBlessingSubmit = async () => {
    if (!blessingData.content.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/blessings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: blessingId,
          author_name: formData.name.trim() || 'אורח',
          content: blessingData.content.trim(),
          is_public: blessingData.isPublic,
        }),
      });
      if (res.ok) {
        const blessData = await res.json();
        if (blessData.blessingId) {
          setBlessingId(blessData.blessingId);
          sessionStorage.setItem('rsvp_blessing_id', String(blessData.blessingId));
        }
      }
      setBlessingSubmitted(true);
    } catch {
      setBlessingSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // AI Blessing enhancement / generator
  const handleAIEnhance = async () => {
    const textToEnhance = blessingData.content.trim();
    if (textToEnhance.length > 0 && textToEnhance.length < 10) {
      alert('נא להזין לפחות 10 תווים לשדרוג, או להשאיר ריק לחלוטין כדי ליצור ברכה חדשה מאפס');
      return;
    }

    setIsAILoading(true);
    try {
      const response = await fetch('/api/generate-blessing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToEnhance,
          guestName: formData.name.trim(),
        }),
      });
      const data = await response.json();
      const enhanced = data.enhancedText || data.result;
      if (enhanced) {
        setHistory((prev) => [...prev.slice(0, historyIndex + 1), blessingData.content]);
        setHistoryIndex((prev) => prev + 1);
        setBlessingData((prev) => ({ ...prev, content: enhanced }));
      } else {
        throw new Error();
      }
    } catch {
      alert('מערכת השדרוג עמוסה כרגע. הברכה שלך נשמרה כפי שהיא, וניתן להמשיך בשליחה!');
    } finally {
      setIsAILoading(false);
    }
  };

  const handleUndo = () => {
    if (historyIndex >= 0) {
      setBlessingData((prev) => ({ ...prev, content: history[historyIndex] }));
      setHistoryIndex((prev) => prev - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setBlessingData((prev) => ({ ...prev, content: history[nextIndex] }));
      setHistoryIndex(nextIndex);
    }
  };

  // Calendar helpers
  const downloadIcs = () => {
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Tuval Bar Mitzvah//HE
CALSCALE:GREGORIAN
BEGIN:VEVENT
SUMMARY:בר־המצווה של תובל
DTSTART:20261110T140000Z
DTEND:20261110T170000Z
LOCATION:West Garden, רחוב ויצמן 273, רעננה
DESCRIPTION:איזה כיף, נתראה בשמחה!\\nחניה: יש לרשום בווייז "תחנת דלק מעייני שמחה, רעננה"\\nרחל, רז ותובל מעוז
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

  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    'בר־המצווה של תובל'
  )}&dates=20261110T140000Z/20261110T170000Z&ctz=Asia/Jerusalem&details=${encodeURIComponent(
    'איזה כיף, נתראה בשמחה!\nחניה: יש לרשום בווייז "תחנת דלק מעייני שמחה, רעננה"\nרחל, רז ותובל מעוז'
  )}&location=${encodeURIComponent('West Garden, ויצמן 273, רעננה')}`;

  // Waze icon SVG
  const WazeIcon = () => (
    <svg className="w-5 h-5 fill-white flex-shrink-0" viewBox="0 0 24 24">
      <path d="M13.218 0C9.915 0 6.835 1.49 4.723 4.148c-1.515 1.913-2.31 4.272-2.31 6.706v1.739c0 .894-.62 1.738-1.862 1.813-.298.025-.547.224-.547.522-.05.82.82 2.31 2.012 3.502.82.844 1.788 1.515 2.832 2.036a3 3 0 0 0 2.955 3.528 2.966 2.966 0 0 0 2.931-2.385h2.509c.323 1.689 2.086 2.856 3.974 2.21 1.64-.546 2.36-2.409 1.763-3.924a12.84 12.84 0 0 0 1.838-1.465 10.73 10.73 0 0 0 3.18-7.65c0-2.882-1.118-5.589-3.155-7.625A10.899 10.899 0 0 0 13.218 0zm0 1.217c2.558 0 4.967.994 6.78 2.807a9.525 9.525 0 0 1 2.807 6.78A9.526 9.526 0 0 1 20 17.585a9.647 9.647 0 0 1-6.78 2.807h-2.46a3.008 3.008 0 0 0-2.93-2.41 3.03 3.03 0 0 0-2.534 1.367v.024a8.945 8.945 0 0 1-2.41-1.788c-.844-.844-1.316-1.614-1.515-2.11a2.858 2.858 0 0 0 1.441-.846 2.959 2.959 0 0 0 .795-2.036v-1.789c0-2.11.696-4.197 2.012-5.861 1.863-2.385 4.62-3.726 7.6-3.726zm-2.41 5.986a1.192 1.192 0 0 0-1.191 1.192 1.192 1.192 0 0 0 1.192 1.193A1.192 1.192 0 0 0 12 8.395a1.192 1.192 0 0 0-1.192-1.192zm7.204 0a1.192 1.192 0 0 0-1.192 1.192 1.192 1.192 0 0 0 1.192 1.193 1.192 1.192 0 0 0 1.192-1.193 1.192 1.192 0 0 0-1.192-1.192zm-7.377 4.769a.596.596 0 0 0-.546.845 4.813 4.813 0 0 0 4.346 2.757 4.77 4.77 0 0 0 4.347-2.757.596.596 0 0 0-.547-.845h-.025a.561.561 0 0 0-.521.348 3.59 3.59 0 0 1-3.254 2.061 3.591 3.591 0 0 1-3.254-2.061.64.64 0 0 0-.546-.348z" />
    </svg>
  );

  return (
    <div
      className="rsvp-app min-h-[100dvh] h-[100dvh] bg-[#FDFBF7] text-[#2C352E] flex flex-col justify-between overflow-hidden"
      dir="rtl"
    >
      {/* Universal Header with Symmetric Laurel Branches */}
      <header className="bg-[#4A5D4E] text-white py-2 px-3 text-center relative shadow-sm flex-shrink-0">
        <div className="flex items-center justify-center gap-2">
          <img
            src="/laurel_branch.png"
            alt="ענף דפנה"
            className="h-5 w-auto object-contain opacity-95 transform -rotate-6"
          />
          <h1 className="text-base sm:text-lg font-bold tracking-wide text-white">בר־המצווה של תובל</h1>
          <img
            src="/laurel_branch.png"
            alt="ענף דפנה"
            className="h-5 w-auto object-contain opacity-95 transform scale-x-[-1] rotate-6"
          />
        </div>
      </header>

      {/* Main Container */}
      <main
        className={`flex-1 min-h-0 max-w-md w-full mx-auto px-3.5 py-2 flex flex-col justify-between ${
          step === 1 && !isEditMode ? 'overflow-hidden' : 'overflow-y-auto'
        }`}
      >
        {/* Edit Mode Banner (Option 3 UX) */}
        {isEditMode && guestId && step !== 4 && step !== 'decline' && (
          <div className="bg-[#EBF3ED] border border-[#A6C5AB] rounded-2xl p-2.5 px-3 mb-2 flex items-center justify-between shadow-xs text-right flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">✏️</span>
              <div>
                <div className="text-xs font-bold text-[#2C352E]">
                  מצב עריכה: מעדכן רישום
                </div>
                <div className="text-[11px] text-[#556958]">
                  מעדכן עבור: <span className="font-semibold">{formData.name || 'אורח'}</span> (ללא כפילויות)
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleResetGuest}
              className="text-xs font-bold text-[#4A5D4E] hover:text-[#2C352E] bg-white border border-[#A6C5AB] px-2.5 py-1 rounded-xl shadow-2xs hover:bg-[#F4EFE6] transition-colors whitespace-nowrap cursor-pointer"
            >
              + אורח חדש
            </button>
          </div>
        )}

        {/* ================= SCREEN 1: COMBINED LANDING (STRICT ZERO SCROLL) ================= */}
        {step === 1 && (
          <div className="flex-1 flex flex-col justify-between h-full min-h-0 space-y-2">
            <div className="space-y-2">
              {/* Compact Integrated Banner: Tuval Portrait + Quote (2 lines) */}
              <div className="flex items-center gap-2.5 bg-[#F4EFE6] border border-[#E5DECF] rounded-2xl p-2 shadow-xs">
                <img
                  src="/tuval_portrait_color.jpg"
                  alt="תובל"
                  className="w-12 h-12 rounded-full object-cover border-2 border-[#4A5D4E]/40 shadow-xs flex-shrink-0"
                />
                <p className="text-[17px] font-medium text-[#3E4A40] italic leading-tight">
                  "עוד נפגש ויהיה לנו טוב,
                  <br />
                  זה יהיה בקרוב..."
                </p>
              </div>

              {/* Event Details Card (Strictly Uniform 18px Font & Weight) */}
              <div className="bg-white border border-[#EBE6DC] rounded-2xl p-2.5 space-y-1.5 shadow-xs">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#4A5D4E] flex-shrink-0" />
                  <span className="text-[18px] text-[#2C352E] leading-snug">
                    <strong className="font-bold text-[#2C352E]">מועד:</strong> יום שלישי, 10/11/2026
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#4A5D4E] flex-shrink-0" />
                  <span className="text-[18px] text-[#2C352E] leading-snug">
                    <strong className="font-bold text-[#2C352E]">שעות:</strong> 16:00 - 19:00
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#4A5D4E] flex-shrink-0" />
                  <span className="text-[18px] text-[#2C352E] leading-snug">
                    <strong className="font-bold text-[#2C352E]">מיקום:</strong> West Garden, רעננה
                  </span>
                </div>
                <div className="pt-1.5 border-t border-[#F0EBE1] text-center text-[16px] text-[#526054]">
                  נשמח לראותך בשמחתנו,{' '}
                  <span className="font-bold text-[#2C352E]">רחל, רז ותובל מעוז</span>
                </div>
              </div>

              {/* Input Field: איך קוראים לך? (16px text-base avoids mobile iOS auto-zoom) */}
              <div className="space-y-1">
                <label className="block text-sm font-bold text-[#3E4A40]">איך קוראים לך?</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    const val = e.target.value; sessionStorage.setItem('rsvp_name', val); setFormData((prev) => ({ ...prev, name: val }));
                    if (nameError) setNameError('');
                  }}
                  placeholder="שם מלא: שם פרטי + שם משפחה"
                  className={`w-full px-3.5 py-2 text-base rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-[#4A5D4E] placeholder-[#9E9689] shadow-xs ${
                    nameError ? 'border-red-400 bg-red-50/20' : 'border-[#D5CFC3]'
                  }`}
                />
                {nameError && (
                  <p className="text-xs text-red-500 font-medium pt-0.5">{nameError}</p>
                )}
              </div>
            </div>

            {/* Action Decision Buttons */}
            <div className="space-y-1.5 pt-1 pb-1 flex-shrink-0">
              <button
                type="button"
                onClick={handleSelectAttending}
                className="w-full py-2.5 px-4 bg-[#4A5D4E] hover:bg-[#3B4A3E] text-white rounded-xl text-base font-bold shadow-md transition-all active:scale-[0.98] text-center cursor-pointer"
              >
                {isEditMode ? 'המשך לעדכון כמויות ⬅' : 'אגיע בשמחה'}
              </button>
              <button
                type="button"
                onClick={handleSelectDecline}
                disabled={isSubmitting}
                className="w-full py-2 px-4 bg-transparent border border-[#9A9182] hover:bg-[#F2ECE1] text-[#554D41] rounded-xl text-sm font-semibold transition-all active:scale-[0.98] text-center cursor-pointer"
              >
                {isSubmitting ? 'מעדכן...' : isEditMode ? 'עדכון לסטטוס לא מגיע' : 'לא מתאפשר לי להגיע'}
              </button>
            </div>
          </div>
        )}

        {/* ================= SCREEN 2: ATTENDING (GUEST COUNTS ONLY) ================= */}
        {step === 2 && (
          <div className="flex-1 flex flex-col justify-between min-h-full space-y-3">
            <div className="space-y-3">
              <div className="text-center pt-1">
                <h2 className="text-lg font-bold text-[#2C352E]">כמה מגיעים לחגוג?</h2>
                <p className="text-xs text-[#6B786D] mt-0.5">ספירת האורחים עוזרת לנו להיערך בהתאם</p>
              </div>

              {/* Guest Counters */}
              <div className="space-y-2.5">
                {/* Adults & Youth (11+) */}
                <div className="bg-white border border-[#E8E2D5] rounded-2xl p-3 flex items-center justify-between shadow-xs">
                  <div>
                    <div className="text-base font-bold text-[#2C352E]">מבוגרים ונוער</div>
                    <div className="text-xs text-[#7A877C]">(11+)</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, adults: Math.max(1, prev.adults - 1) }))
                      }
                      className="w-9 h-9 rounded-full border border-[#D0C8B8] flex items-center justify-center text-base font-bold text-[#4A5D4E] hover:bg-[#F4EFE6]"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-lg font-bold text-[#2C352E]">
                      {formData.adults}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, adults: prev.adults + 1 }))}
                      className="w-9 h-9 rounded-full border border-[#D0C8B8] flex items-center justify-center text-base font-bold text-[#4A5D4E] hover:bg-[#F4EFE6]"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Kids (3-11) */}
                <div className="bg-white border border-[#E8E2D5] rounded-2xl p-3 flex items-center justify-between shadow-xs">
                  <div>
                    <div className="text-base font-bold text-[#2C352E]">ילדים</div>
                    <div className="text-xs text-[#7A877C]">(3-11)</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, children: Math.max(0, prev.children - 1) }))
                      }
                      className="w-9 h-9 rounded-full border border-[#D0C8B8] flex items-center justify-center text-base font-bold text-[#4A5D4E] hover:bg-[#F4EFE6]"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-lg font-bold text-[#2C352E]">
                      {formData.children}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, children: prev.children + 1 }))}
                      className="w-9 h-9 rounded-full border border-[#D0C8B8] flex items-center justify-center text-base font-bold text-[#4A5D4E] hover:bg-[#F4EFE6]"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Babies (עד גיל 3) */}
                <div className="bg-white border border-[#E8E2D5] rounded-2xl p-3 flex items-center justify-between shadow-xs">
                  <div>
                    <div className="text-base font-bold text-[#2C352E]">תינוקות</div>
                    <div className="text-xs text-[#7A877C]">(עד גיל 3)</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, babies: Math.max(0, prev.babies - 1) }))
                      }
                      className="w-9 h-9 rounded-full border border-[#D0C8B8] flex items-center justify-center text-base font-bold text-[#4A5D4E] hover:bg-[#F4EFE6]"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-lg font-bold text-[#2C352E]">
                      {formData.babies}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, babies: prev.babies + 1 }))}
                      className="w-9 h-9 rounded-full border border-[#D0C8B8] flex items-center justify-center text-base font-bold text-[#4A5D4E] hover:bg-[#F4EFE6]"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => goToStep(3)}
                className="w-full py-3 px-4 bg-[#4A5D4E] hover:bg-[#3B4A3E] text-white rounded-xl text-base font-bold shadow-md transition-all active:scale-[0.98]"
              >
                המשך ←
              </button>
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="w-full py-2 px-4 text-[#666] hover:text-[#2C352E] text-sm font-semibold text-center"
              >
                חזור →
              </button>
            </div>
          </div>
        )}

        {/* ================= SCREEN 3: ATTENDING (BLESSING & SUBMIT) ================= */}
        {step === 3 && (
          <div className="flex-1 flex flex-col justify-between min-h-full space-y-3">
            <div className="space-y-3">
              {/* Summary Badge */}
              <div className="bg-white border border-[#E8E2D5] rounded-xl px-4 py-2.5 text-sm flex justify-between items-center text-[#526054] shadow-xs">
                <span>
                  הרכב:{' '}
                  <strong className="text-[#2C352E]">
                    {formData.adults} מבוגרים
                    {formData.children > 0 ? `, ${formData.children} ילדים` : ''}
                    {formData.babies > 0 ? `, ${formData.babies} תינוקות` : ''}
                  </strong>
                </span>
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="text-[#4A5D4E] underline text-xs font-semibold"
                >
                  עריכה
                </button>
              </div>

              {/* Blessing Form */}
              <div className="bg-white border border-[#E8E2D5] rounded-2xl p-3.5 space-y-2.5 shadow-xs">
                <label className="block text-sm font-bold text-[#2C352E]">
                  רוצה להשאיר ברכה לתובל? (אופציונלי)
                </label>
                <textarea
                  rows={3}
                  value={blessingData.content}
                  onChange={(e) =>
                    setBlessingData((prev) => ({ ...prev, content: e.target.value }))
                  }
                  placeholder="מזל טוב תובל היקר..."
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#D5CFC3] bg-white focus:outline-none focus:ring-2 focus:ring-[#4A5D4E] placeholder-[#9E9689]"
                />

                {/* AI & Controls */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={historyIndex < 0}
                    className="p-2.5 bg-white text-[#4A5D4E] border border-[#D5CFC3] rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-30"
                    title="חזור"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleAIEnhance}
                    disabled={isAILoading}
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#4A5D4E] to-[#637A68] text-white py-2.5 rounded-lg text-xs font-semibold shadow-xs disabled:opacity-60 whitespace-nowrap"
                  >
                    <Wand2 className={`w-4 h-4 flex-shrink-0 ${isAILoading ? 'animate-spin' : ''}`} />
                    <span className="whitespace-nowrap">
                      {isAILoading
                        ? 'הקסם קורה...'
                        : blessingData.content.trim()
                        ? 'שדרוג ברכה עם AI'
                        : 'יצירת ברכה עם AI'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={historyIndex >= history.length - 1}
                    className="p-2.5 bg-white text-[#4A5D4E] border border-[#D5CFC3] rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-30"
                    title="בצע שוב"
                  >
                    <Redo2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Sharing Levels (High-Contrast Custom Radios) */}
                <div className="pt-2 border-t border-[#F0EBE1] space-y-1.5">
                  <div className="text-xs font-bold text-[#3E4A40]">מי יכול לראות את הברכה?</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => setBlessingData((prev) => ({ ...prev, isPublic: true }))}
                      className={`flex items-center gap-2 p-2.5 rounded-xl text-right transition-all ${
                        blessingData.isPublic
                          ? 'border-2 border-[#4A5D4E] bg-[#4A5D4E]/8 shadow-xs'
                          : 'border border-[#D5CFC3] bg-white hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white flex-shrink-0 ${
                          blessingData.isPublic ? 'border-[#4A5D4E]' : 'border-[#D0C8B8]'
                        }`}
                      >
                        {blessingData.isPublic && (
                          <div className="w-2 h-2 rounded-full bg-[#4A5D4E]" />
                        )}
                      </div>
                      <span
                        className={`text-xs ${
                          blessingData.isPublic
                            ? 'font-bold text-[#2C352E]'
                            : 'font-medium text-[#7A877C]'
                        }`}
                      >
                        גלויה לכולם
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBlessingData((prev) => ({ ...prev, isPublic: false }))}
                      className={`flex items-center gap-2 p-2.5 rounded-xl text-right transition-all ${
                        !blessingData.isPublic
                          ? 'border-2 border-[#4A5D4E] bg-[#4A5D4E]/8 shadow-xs'
                          : 'border border-[#D5CFC3] bg-white hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white flex-shrink-0 ${
                          !blessingData.isPublic ? 'border-[#4A5D4E]' : 'border-[#D0C8B8]'
                        }`}
                      >
                        {!blessingData.isPublic && (
                          <div className="w-2 h-2 rounded-full bg-[#4A5D4E]" />
                        )}
                      </div>
                      <span
                        className={`text-xs ${
                          !blessingData.isPublic
                            ? 'font-bold text-[#2C352E]'
                            : 'font-medium text-[#7A877C]'
                        }`}
                      >
                        פרטית לתובל
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {submitError && (
              <p className="text-xs text-red-500 font-medium text-center">{submitError}</p>
            )}

            {/* Navigation Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="w-full py-3 px-4 bg-[#4A5D4E] hover:bg-[#3B4A3E] text-white rounded-xl text-base font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-60 cursor-pointer"
              >
                {isSubmitting ? 'מעדכן פרטים...' : isEditMode ? 'שמירת עדכון ההגעה' : 'אישור סופי ושליחה'}
              </button>
              <button
                type="button"
                onClick={() => goToStep(2)}
                className="w-full py-2 px-4 text-[#666] hover:text-[#2C352E] text-sm font-semibold text-center"
              >
                חזור →
              </button>
            </div>
          </div>
        )}

        {/* ================= SCREEN 4: SUCCESS & WAZE ================= */}
        {step === 4 && (
          <div className="flex-1 flex flex-col justify-between text-center space-y-3 pt-1 min-h-full">
            <div className="space-y-3">
              {/* Tuval Portrait with Checkmark */}
              <div className="relative w-20 h-20 mx-auto">
                <img
                  src="/tuval_portrait_color.jpg"
                  alt="תובל"
                  className="w-20 h-20 rounded-full object-cover border-2 border-[#4A5D4E] shadow-md mx-auto"
                />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#4A5D4E] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </div>

              <div className="space-y-0.5">
                <h2 className="text-lg font-bold text-[#2C352E]">איזה כיף, נתראה בשמחה!</h2>
                <p className="text-sm text-[#526054]">פרטי ההגעה שלך נשמרו בהצלחה</p>
              </div>

              {/* Event Details Card (Strictly Uniform 18px Font & Weight) */}
              <div className="bg-white border border-[#E8E2D5] rounded-2xl p-3 space-y-2 shadow-xs text-right">
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-[#4A5D4E] flex-shrink-0" />
                  <span className="text-[18px] text-[#2C352E] leading-snug">
                    <strong className="font-bold text-[#2C352E]">מועד:</strong> יום שלישי, 10/11/2026
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-[#4A5D4E] flex-shrink-0" />
                  <span className="text-[18px] text-[#2C352E] leading-snug">
                    <strong className="font-bold text-[#2C352E]">שעות:</strong> 16:00 - 19:00
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-[#4A5D4E] flex-shrink-0" />
                  <span className="text-[18px] text-[#2C352E] leading-snug">
                    <strong className="font-bold text-[#2C352E]">מיקום:</strong> West Garden, רעננה
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <svg
                    className="w-4 h-4 text-[#4A5D4E] flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                    />
                  </svg>
                  <span className="text-[18px] text-[#2C352E] leading-snug">
                    <strong className="font-bold text-[#2C352E]">חניה:</strong> חניה מסודרת בצמוד למתחם האירועים
                  </span>
                </div>
              </div>

              {/* Waze & Calendar Actions */}
              <div className="space-y-2 pt-1">
                <a
                  href="https://waze.com/ul?q=תחנת+דלק+מעייני+שמחה+רעננה"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3 px-4 bg-[#4A5D4E] hover:bg-[#3B4A3E] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2.5 shadow-md transition-all active:scale-[0.98]"
                >
                  <WazeIcon />
                  <span className="tracking-wide">ניווט עם Waze</span>
                </a>

                {/* Reassurance & Calendar Card */}
                <div className="bg-[#F4EFE6] border border-[#E5DECF] rounded-2xl p-3 text-center space-y-2 shadow-xs">
                  <div className="text-[17px] font-bold text-[#3E4A40] flex items-center justify-center gap-1.5">
                    <span>🌿</span>
                    <span>זהו לעת עתה! הכל נשמר בהצלחה.</span>
                  </div>
                  <p className="text-[15px] text-[#526054] leading-relaxed">
                    נדאג לתזכורת כמה ימים לפני השמחה.
                    <br />
                    אפשר לסגור חלון זה בבטחה,
                    <br />
                    <span className="font-bold text-[#3E4A40]">רק לפני זה יש לשמור ביומן כדי למנוע שכחה:</span>
                  </p>

                  {/* Calendar Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <a
                      href={googleCalendarUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 bg-white border border-[#D5CFC3] hover:bg-[#EBE5D8] text-[#3E4A40] font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    >
                      <Calendar className="w-4 h-4 text-[#4A5D4E]" />
                      <span>Google Calendar</span>
                    </a>
                    <button
                      type="button"
                      onClick={downloadIcs}
                      className="py-2.5 px-3 bg-white border border-[#D5CFC3] hover:bg-[#EBE5D8] text-[#3E4A40] font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                    >
                      <Calendar className="w-4 h-4 text-[#4A5D4E]" />
                      <span>Apple / Outlook</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="text-sm text-[#6B786D] underline hover:text-[#2C352E] py-1"
              >
                ← טעות? עריכת פרטי הגעה
              </button>
            </div>
          </div>
        )}

        {/* ================= SCREEN 2 (DECLINE): THANK YOU & BLESSING ================= */}
        {step === 'decline' && (
          <div className="flex-1 flex flex-col justify-between text-center space-y-3 pt-1 min-h-full">
            <div className="space-y-3">
              {/* Tuval Portrait */}
              <div className="w-16 h-16 mx-auto rounded-full overflow-hidden border-2 border-[#4A5D4E] shadow-sm">
                <img
                  src="/tuval_portrait_color.jpg"
                  alt="תובל"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-bold text-[#2C352E]">תודה רבה!</h2>
                <p className="text-sm text-[#526054] leading-relaxed font-medium">
                  חבל שלא יתאפשר לך להגיע.
                  <br />
                  ניפגש בשמחות הבאות
                </p>
              </div>

              {/* Optional Blessing Card */}
              <div className="bg-white border border-[#E8E2D5] rounded-2xl p-3.5 text-right space-y-2.5 shadow-xs">
                <p className="text-sm text-[#526054] font-medium text-center">
                  בכל מקרה, נשמח לברכה עבור תובל
                </p>

                {blessingSubmitted ? (
                  <div className="p-3 bg-[#F4EFE6] rounded-xl text-center text-sm font-bold text-[#4A5D4E]">
                    תודה רבה! הברכה נשלחה באהבה לתובל.
                  </div>
                ) : (
                  <>
                    <textarea
                      rows={3}
                      value={blessingData.content}
                      onChange={(e) =>
                        setBlessingData((prev) => ({ ...prev, content: e.target.value }))
                      }
                      placeholder="מזל טוב תובל היקר..."
                      className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#D5CFC3] bg-white focus:outline-none focus:ring-2 focus:ring-[#4A5D4E] placeholder-[#9E9689]"
                    />

                    {/* AI & Controls */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleUndo}
                        disabled={historyIndex < 0}
                        className="p-2.5 bg-white text-[#4A5D4E] border border-[#D5CFC3] rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-30"
                        title="חזור"
                      >
                        <Undo2 className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={handleAIEnhance}
                        disabled={isAILoading}
                        className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#4A5D4E] to-[#637A68] text-white py-2.5 rounded-lg text-xs font-semibold shadow-xs disabled:opacity-60 whitespace-nowrap"
                      >
                        <Wand2 className={`w-4 h-4 flex-shrink-0 ${isAILoading ? 'animate-spin' : ''}`} />
                        <span className="whitespace-nowrap">
                          {isAILoading
                            ? 'הקסם קורה...'
                            : blessingData.content.trim()
                            ? 'שדרוג ברכה עם AI'
                            : 'יצירת ברכה עם AI'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={handleRedo}
                        disabled={historyIndex >= history.length - 1}
                        className="p-2.5 bg-white text-[#4A5D4E] border border-[#D5CFC3] rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-30"
                        title="בצע שוב"
                      >
                        <Redo2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Sharing Levels */}
                    <div className="pt-2 border-t border-[#F0EBE1] space-y-1.5">
                      <div className="text-xs font-bold text-[#3E4A40]">
                        מי יכול לראות את הברכה?
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <button
                          type="button"
                          onClick={() => setBlessingData((prev) => ({ ...prev, isPublic: true }))}
                          className={`flex items-center gap-2 p-2.5 rounded-xl text-right transition-all ${
                            blessingData.isPublic
                              ? 'border-2 border-[#4A5D4E] bg-[#4A5D4E]/8 shadow-xs'
                              : 'border border-[#D5CFC3] bg-white hover:bg-[#FAF8F5]'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white flex-shrink-0 ${
                              blessingData.isPublic ? 'border-[#4A5D4E]' : 'border-[#D0C8B8]'
                            }`}
                          >
                            {blessingData.isPublic && (
                              <div className="w-2 h-2 rounded-full bg-[#4A5D4E]" />
                            )}
                          </div>
                          <span
                            className={`text-xs ${
                              blessingData.isPublic
                                ? 'font-bold text-[#2C352E]'
                                : 'font-medium text-[#7A877C]'
                            }`}
                          >
                            גלויה לכולם
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setBlessingData((prev) => ({ ...prev, isPublic: false }))}
                          className={`flex items-center gap-2 p-2.5 rounded-xl text-right transition-all ${
                            !blessingData.isPublic
                              ? 'border-2 border-[#4A5D4E] bg-[#4A5D4E]/8 shadow-xs'
                              : 'border border-[#D5CFC3] bg-white hover:bg-[#FAF8F5]'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white flex-shrink-0 ${
                              !blessingData.isPublic ? 'border-[#4A5D4E]' : 'border-[#D0C8B8]'
                            }`}
                          >
                            {!blessingData.isPublic && (
                              <div className="w-2 h-2 rounded-full bg-[#4A5D4E]" />
                            )}
                          </div>
                          <span
                            className={`text-xs ${
                              !blessingData.isPublic
                                ? 'font-bold text-[#2C352E]'
                                : 'font-medium text-[#7A877C]'
                            }`}
                          >
                            פרטית לתובל
                          </span>
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDeclineBlessingSubmit}
                      disabled={isSubmitting || !blessingData.content.trim()}
                      className="w-full py-2.5 bg-[#4A5D4E] hover:bg-[#3B4A3E] text-white rounded-xl text-sm font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmitting ? 'מעדכן ברכה...' : isEditMode && blessingId ? 'עדכון ברכה' : 'שליחת ברכה'}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="text-sm text-[#6B786D] underline hover:text-[#2C352E] py-1"
              >
                ← טעות? עדכון תשובה
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
