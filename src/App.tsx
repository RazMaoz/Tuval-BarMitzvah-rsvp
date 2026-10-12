import { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, Car, Check, Undo2 } from 'lucide-react';

type StepType = 1 | 2 | 3 | 4 | 5 | 'decline' | 'decline_sealed';

export default function App() {
  const [step, setStep] = useState<StepType>(() => {
    return (window.history.state?.step as StepType) || 1;
  });

  // Silent pre-warm ping on initial load to ensure backend container is awake immediately
  useEffect(() => {
    fetch('/api/health').catch(() => {});
  }, []);

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

  // Defense against page refresh on mid-step without a name
  useEffect(() => {
    if (step !== 1 && !formData.name.trim()) {
      goToStep(1);
    }
  }, [step, formData.name]);

  const [nameError, setNameError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Blessing state & 1-step undo
  const [blessingData, setBlessingData] = useState({
    content: '',
    isPublic: true,
  });
  const [originalDraft, setOriginalDraft] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [isAISlow, setIsAISlow] = useState(false);

  // AI loading timer: after 2 seconds display friendly status
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isAILoading) {
      timer = setTimeout(() => setIsAISlow(true), 2000);
    } else {
      setIsAISlow(false);
    }
    return () => clearTimeout(timer);
  }, [isAILoading]);

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
    sessionStorage.setItem('rsvp_name', formData.name.trim());
    goToStep(2);
  };

  // Handle Decline decision from Screen 1
  const handleSelectDecline = async () => {
    if (!validateName()) return;
    sessionStorage.setItem('rsvp_name', formData.name.trim());
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

      goToStep(5);
    } catch (err: any) {
      setSubmitError(err.message || 'אירעה שגיאה. אנא נסה שנית.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit blessing from decline screen
  const handleDeclineBlessingSubmit = async () => {
    if (!blessingData.content.trim()) {
      goToStep('decline_sealed');
      return;
    }
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
      goToStep('decline_sealed');
    } catch {
      goToStep('decline_sealed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // AI Blessing enhancement / generator with 1-step undo
  const handleAIEnhance = async () => {
    const textToEnhance = blessingData.content.trim();
    setOriginalDraft(blessingData.content);
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
    if (originalDraft !== undefined) {
      setBlessingData((prev) => ({ ...prev, content: originalDraft }));
      setOriginalDraft('');
    }
  };

  // Calendar configuration
  const eventDetails = {
    title: 'בר המצווה של תובל מעוז',
    description: 'נשמח לראותכם חוגגים איתנו בבר המצווה של תובל!',
    location: 'West Garden, רעננה',
    startDate: '20261110T140000Z', // 16:00 Israel time (UTC+2)
    endDate: '20261110T170000Z',   // 19:00 Israel time (UTC+2)
  };

  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    eventDetails.title
  )}&dates=${eventDetails.startDate}/${eventDetails.endDate}&details=${encodeURIComponent(
    eventDetails.description
  )}&location=${encodeURIComponent(eventDetails.location)}`;

  const downloadIcs = () => {
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Tuval Bar Mitzvah//RSVP//HE',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `DTSTART:${eventDetails.startDate}`,
      `DTEND:${eventDetails.endDate}`,
      `SUMMARY:${eventDetails.title}`,
      `DESCRIPTION:${eventDetails.description}`,
      `LOCATION:${eventDetails.location}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', 'tuval_bar_mitzvah.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

      {/* Main Container - Strict Zero Scroll on Screen 1 */}
      <main
        className={`flex-1 min-h-0 max-w-md w-full mx-auto px-3.5 py-2 flex flex-col justify-between ${
          step === 1 ? 'overflow-hidden' : 'overflow-y-auto'
        }`}
      >
        {/* Ultra-compact Edit Mode Indicator (Single Slim Line) */}
        {isEditMode && guestId && step !== 5 && step !== 'decline_sealed' && (
          <div className="bg-[#EBF3ED] border border-[#A6C5AB]/70 rounded-lg px-2.5 py-0.5 mb-1 flex items-center justify-center gap-1.5 text-[11px] font-medium text-[#2C352E] flex-shrink-0 shadow-2xs">
            <span>✏️</span>
            <span>מצב עריכה: מעדכן רישום עבור</span>
            <strong className="font-bold text-[#3E4E42]">{formData.name.trim() || 'אורח'}</strong>
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
                <div className="text-[16px] font-bold text-[#3E4A40] pb-1 border-b border-[#F0EBE1]">
                  אנחנו נרגשים להזמינך לבר המצווה של תובל
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#4A5D4E] flex-shrink-0" />
                  <span className="text-[16.5px] tracking-[-0.015em] text-[#2C352E] leading-snug">
                    <strong className="font-bold text-[#2C352E]">מועד:</strong> יום שלישי, 10/11/2026
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#4A5D4E] flex-shrink-0" />
                  <span className="text-[16.5px] tracking-[-0.015em] text-[#2C352E] leading-snug">
                    <strong className="font-bold text-[#2C352E]">שעות:</strong> 16:00 - 19:00
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#4A5D4E] flex-shrink-0" />
                  <span className="text-[16.5px] tracking-[-0.015em] text-[#2C352E] leading-snug">
                    <strong className="font-bold text-[#2C352E]">מיקום:</strong> West Garden, רעננה
                  </span>
                </div>
                <div className="pt-1.5 border-t border-[#F0EBE1] text-center text-[16px] text-[#526054]">
                  נשמח לראותך בשמחתנו, <span className="font-bold text-[#2C352E]">רחל, רז ותובל מעוז</span>
                </div>
              </div>

              {/* Name Input Section with Distinct Vertical Breathing Room */}
              <div className="pt-2.5 space-y-2">
                <p className="text-[14px] font-medium text-[#526054]">
                  כדי שנוכל להיערך, נתחיל בתהליך רישום קצרצר.
                </p>
                <div className="space-y-1">
                  <label htmlFor="guest-name-input" className="block text-[15px] font-bold text-[#2C352E]">
                    מה שמך?
                  </label>
                  <input
                    id="guest-name-input"
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, name: e.target.value }));
                      if (nameError) setNameError('');
                    }}
                    placeholder="שם מלא: שם פרטי + שם משפחה"
                    className={`w-full px-3.5 py-2 text-base rounded-xl border ${
                      nameError ? 'border-red-500 bg-red-50/30' : 'border-[#D5CFC3] bg-white'
                    } focus:outline-none focus:ring-2 focus:ring-[#4A5D4E] shadow-xs placeholder-[#9E9689]`}
                  />
                  {nameError && (
                    <p className="text-xs text-red-600 font-semibold mt-0.5">{nameError}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Attendance Buttons */}
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={handleSelectAttending}
                className="w-full py-2.5 px-4 bg-[#4A5D4E] hover:bg-[#3B4A3E] text-white rounded-xl text-base font-bold shadow-md transition-all active:scale-[0.98] cursor-pointer"
              >
                אגיע בשמחה
              </button>
              <button
                type="button"
                onClick={handleSelectDecline}
                className="w-full py-2 px-4 bg-transparent border border-[#9A9182] hover:bg-[#F2ECE1] text-[#554D41] rounded-xl text-sm font-semibold transition-all active:scale-[0.98] cursor-pointer"
              >
                לא מתאפשר לי להגיע
              </button>
            </div>
          </div>
        )}

        {/* ================= SCREEN 2: ATTENDING (GUEST COUNTS) ================= */}
        {step === 2 && (
          <div className="flex-1 flex flex-col justify-between min-h-full space-y-3">
            <div className="space-y-3 text-center">
              <div>
                <h2 className="text-xl font-bold text-[#2C352E]">כמה מגיעים לחגוג?</h2>
                <p className="text-xs text-[#6B786D] mt-0.5">ספירת האורחים עוזרת לנו להיערך בהתאם</p>
              </div>

              {/* Counters */}
              <div className="space-y-2.5 text-right">
                {/* Adults */}
                <div className="bg-white border border-[#E8E2D5] rounded-2xl p-3 flex items-center justify-between shadow-xs">
                  <div>
                    <div className="text-base font-bold text-[#2C352E]">מבוגרים ונוער</div>
                    <div className="text-xs text-[#7A877C]">(11+)</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="הפחת מבוגר"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          adults: Math.max(1, prev.adults - 1),
                        }))
                      }
                      className="w-9 h-9 rounded-full border border-[#D0C8B8] flex items-center justify-center text-lg font-bold text-[#4A5D4E] hover:bg-[#F4EFE6] transition-colors"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-lg font-bold text-[#2C352E]">
                      {formData.adults}
                    </span>
                    <button
                      type="button"
                      aria-label="הוסף מבוגר"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          adults: Math.min(50, prev.adults + 1),
                        }))
                      }
                      className="w-9 h-9 rounded-full border border-[#D0C8B8] flex items-center justify-center text-lg font-bold text-[#4A5D4E] hover:bg-[#F4EFE6] transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Kids */}
                <div className="bg-white border border-[#E8E2D5] rounded-2xl p-3 flex items-center justify-between shadow-xs">
                  <div>
                    <div className="text-base font-bold text-[#2C352E]">ילדים</div>
                    <div className="text-xs text-[#7A877C]">(3-11)</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="הפחת ילד"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          children: Math.max(0, prev.children - 1),
                        }))
                      }
                      className="w-9 h-9 rounded-full border border-[#D0C8B8] flex items-center justify-center text-lg font-bold text-[#4A5D4E] hover:bg-[#F4EFE6] transition-colors"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-lg font-bold text-[#2C352E]">
                      {formData.children}
                    </span>
                    <button
                      type="button"
                      aria-label="הוסף ילד"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          children: Math.min(50, prev.children + 1),
                        }))
                      }
                      className="w-9 h-9 rounded-full border border-[#D0C8B8] flex items-center justify-center text-lg font-bold text-[#4A5D4E] hover:bg-[#F4EFE6] transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Babies */}
                <div className="bg-white border border-[#E8E2D5] rounded-2xl p-3 flex items-center justify-between shadow-xs">
                  <div>
                    <div className="text-base font-bold text-[#2C352E]">תינוקות</div>
                    <div className="text-xs text-[#7A877C]">(עד גיל 3)</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="הפחת תינוק"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          babies: Math.max(0, prev.babies - 1),
                        }))
                      }
                      className="w-9 h-9 rounded-full border border-[#D0C8B8] flex items-center justify-center text-lg font-bold text-[#4A5D4E] hover:bg-[#F4EFE6] transition-colors"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-lg font-bold text-[#2C352E]">
                      {formData.babies}
                    </span>
                    <button
                      type="button"
                      aria-label="הוסף תינוק"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          babies: Math.min(50, prev.babies + 1),
                        }))
                      }
                      className="w-9 h-9 rounded-full border border-[#D0C8B8] flex items-center justify-center text-lg font-bold text-[#4A5D4E] hover:bg-[#F4EFE6] transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={() => goToStep(3)}
                className="w-full py-2.5 px-4 bg-[#4A5D4E] hover:bg-[#3B4A3E] text-white rounded-xl text-base font-bold shadow-md transition-all active:scale-[0.98] cursor-pointer"
              >
                המשך ⬅
              </button>
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="w-full py-1 text-xs text-[#7A877C] hover:text-[#2C352E] font-medium cursor-pointer transition-colors text-center"
              >
                חזור למסך הקודם →
              </button>
            </div>
          </div>
        )}

        {/* ================= SCREEN 3: ATTENDING (BLESSING & OPTIONS) ================= */}
        {step === 3 && (
          <div className="flex-1 flex flex-col justify-between min-h-full space-y-2.5">
            <div className="space-y-2.5">
              <div className="text-center">
                <h2 className="text-lg font-bold text-[#2C352E]">ברכה לתובל</h2>
                {/* Summary Badge with Edit link */}
                <div className="flex items-center justify-center gap-2 text-xs text-[#6B786D] mt-0.5">
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
                    className="text-[#4A5D4E] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                  >
                    <span>✏️</span>
                    <span>עריכה</span>
                  </button>
                </div>
              </div>

              {/* Blessing Form */}
              <div className="bg-white border border-[#E8E2D5] rounded-2xl p-3 space-y-2 shadow-xs">
                <textarea
                  rows={3}
                  value={blessingData.content}
                  onChange={(e) =>
                    setBlessingData((prev) => ({ ...prev, content: e.target.value }))
                  }
                  placeholder='אפשר לכתוב ברכה, רעיון, או לבקש מה־AI (למשל: "ברכה בחרוזים" או "שלב ציטוט יפה")...'
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#D5CFC3] bg-white focus:outline-none focus:ring-2 focus:ring-[#4A5D4E] placeholder-[#9E9689] leading-relaxed"
                />

                {/* AI & 1-Step Undo Controls */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleAIEnhance}
                      disabled={isAILoading}
                      className="flex-1 py-2 bg-gradient-to-r from-[#4A5D4E] to-[#637A68] text-white rounded-lg text-xs font-semibold shadow-2xs hover:opacity-95 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
                    >
                      <span>✨</span>
                      <span>
                        {isAILoading
                          ? isAISlow
                            ? 'העוזר החכם מתחבר ומתנסח...'
                            : 'מתחבר ל-AI...'
                          : blessingData.content.trim()
                          ? 'שדרוג ברכה עם AI'
                          : 'יצירת ברכה עם AI'}
                      </span>
                    </button>
                  </div>
                  {originalDraft && (
                    <div className="flex items-center justify-start pt-0.5">
                      <button
                        type="button"
                        onClick={handleUndo}
                        className="text-xs text-[#4A5D4E] hover:text-[#2C352E] flex items-center gap-1 font-semibold cursor-pointer transition-colors bg-[#F4EFE6] px-2.5 py-1 rounded-lg border border-[#E5DECF]"
                      >
                        <Undo2 className="w-3.5 h-3.5 text-[#4A5D4E]" />
                        <span>שחזור הנוסח המקורי שלי</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Sharing Levels */}
                <div className="pt-1.5 border-t border-[#F0EBE1] space-y-1">
                  <div className="text-xs font-bold text-[#3E4A40]">מי יכול לראות את הברכה?</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setBlessingData((prev) => ({ ...prev, isPublic: true }))}
                      className={`flex items-center gap-2 p-2 rounded-xl text-right transition-all ${
                        blessingData.isPublic
                          ? 'border-2 border-[#4A5D4E] bg-[#4A5D4E]/8 font-bold text-[#2C352E]'
                          : 'border border-[#D5CFC3] text-[#7A877C]'
                      }`}
                    >
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-[#4A5D4E] flex items-center justify-center bg-white">
                        {blessingData.isPublic && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#4A5D4E]" />
                        )}
                      </div>
                      <span>גלויה לכולם</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBlessingData((prev) => ({ ...prev, isPublic: false }))}
                      className={`flex items-center gap-2 p-2 rounded-xl text-right transition-all ${
                        !blessingData.isPublic
                          ? 'border-2 border-[#4A5D4E] bg-[#4A5D4E]/8 font-bold text-[#2C352E]'
                          : 'border border-[#D5CFC3] text-[#7A877C]'
                      }`}
                    >
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-[#4A5D4E] flex items-center justify-center bg-white">
                        {!blessingData.isPublic && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#4A5D4E]" />
                        )}
                      </div>
                      <span>פרטית לתובל</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* DUAL-FORWARD BUTTONS + BACK BUTTON */}
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={() => goToStep(4)}
                className="w-full py-2.5 px-4 bg-[#4A5D4E] hover:bg-[#3B4A3E] text-white rounded-xl text-base font-bold shadow-md cursor-pointer transition-all active:scale-[0.98]"
              >
                {blessingData.content.trim() ? 'שמירת הברכה והמשך ⬅' : 'המשך ⬅'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setBlessingData((prev) => ({ ...prev, content: '' }));
                  goToStep(4);
                }}
                className="w-full py-2 px-4 bg-transparent border border-[#9A9182] hover:bg-[#F2ECE1] text-[#554D41] rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-[0.98]"
              >
                המשך ללא ברכה ⬅
              </button>
              <button
                type="button"
                onClick={() => goToStep(2)}
                className="w-full py-1 text-xs text-[#7A877C] hover:text-[#2C352E] font-medium cursor-pointer transition-colors text-center"
              >
                חזור לעדכון כמויות →
              </button>
            </div>
          </div>
        )}

        {/* ================= SCREEN 4: ATTENDING (DETAILS, CALENDAR & APPROVAL) ================= */}
        {step === 4 && (
          <div className="flex-1 flex flex-col justify-between text-center space-y-2.5 pt-1 min-h-full">
            <div className="space-y-2 text-center">
              {/* Tuval Portrait with Checkmark */}
              <div className="relative w-16 h-16 mx-auto">
                <img
                  src="/tuval_portrait_color.jpg"
                  alt="תובל"
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#4A5D4E] shadow-sm mx-auto"
                />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#4A5D4E] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              </div>

              <div className="space-y-0.5">
                <h2 className="text-xl font-bold text-[#2C352E]">
                  תודה רבה{formData.name.trim() ? `, ${formData.name.trim()}` : ''}!
                </h2>
                <p className="text-base font-semibold text-[#4A5D4E]">
                  איזה כיף, נתראה בשמחה!
                </p>
              </div>

              {/* Event Details Card (Strictly Uniform 18px Font & Lucide Icons) */}
              <div className="bg-white border border-[#E8E2D5] rounded-2xl p-2.5 space-y-1.5 shadow-xs text-right">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#4A5D4E] flex-shrink-0" />
                  <span className="text-[16.5px] tracking-[-0.015em] text-[#2C352E] leading-snug">
                    <strong className="font-bold text-[#2C352E]">מועד:</strong> יום שלישי, 10/11/2026
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#4A5D4E] flex-shrink-0" />
                  <span className="text-[16.5px] tracking-[-0.015em] text-[#2C352E] leading-snug">
                    <strong className="font-bold text-[#2C352E]">שעות:</strong> 16:00 - 19:00
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#4A5D4E] flex-shrink-0" />
                  <span className="text-[16.5px] tracking-[-0.015em] text-[#2C352E] leading-snug">
                    <strong className="font-bold text-[#2C352E]">מיקום:</strong> West Garden, רעננה
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-[#4A5D4E] flex-shrink-0" />
                  <span className="text-[16.5px] tracking-[-0.015em] text-[#2C352E] leading-snug">
                    <strong className="font-bold text-[#2C352E]">חניה:</strong> חניה מסודרת בצמוד למתחם האירועים
                  </span>
                </div>
              </div>

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
                    className="py-2.5 px-3 bg-white border border-[#D5CFC3] hover:bg-[#EBE5D8] text-[#3E4A40] font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-2xs transition-all"
                  >
                    <Calendar className="w-4 h-4 text-[#4A5D4E]" />
                    <span>Google Calendar</span>
                  </a>
                  <button
                    type="button"
                    onClick={downloadIcs}
                    className="py-2.5 px-3 bg-white border border-[#D5CFC3] hover:bg-[#EBE5D8] text-[#3E4A40] font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-2xs transition-all"
                  >
                    <Calendar className="w-4 h-4 text-[#4A5D4E]" />
                    <span>Apple / Outlook</span>
                  </button>
                </div>
              </div>
            </div>

            {submitError && (
              <p className="text-xs text-red-500 font-medium text-center">{submitError}</p>
            )}

            {/* ACTION BUTTON (Save to DB & move to sealed final screen) */}
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-[#4A5D4E] hover:bg-[#3B4A3E] text-white rounded-xl text-base font-bold shadow-md flex items-center justify-center gap-1.5 active:scale-[0.98] cursor-pointer disabled:opacity-60"
              >
                <span>🌿</span>
                <span>{isSubmitting ? 'מעדכן פרטים...' : 'סיום ואישור'}</span>
              </button>
              <button
                type="button"
                onClick={() => goToStep(3)}
                className="w-full py-1 text-xs text-[#7A877C] hover:text-[#2C352E] font-medium cursor-pointer transition-colors text-center"
              >
                חזור למסך הקודם →
              </button>
            </div>
          </div>
        )}

        {/* ================= SCREEN 5: SEALED ATTENDING SCREEN (CALM, WARM, COMPLETE) ================= */}
        {step === 5 && (
          <div className="flex-1 flex flex-col items-center justify-center h-full text-center space-y-3.5 my-auto">
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

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[#2C352E]">
                תודה רבה{formData.name.trim() ? `, ${formData.name.trim()}` : ''}!
              </h2>
              <p className="text-base font-semibold text-[#4A5D4E]">
                איזה כיף, נתראה בשמחה!
              </p>
            </div>

            {/* Single Clean Summary Card (Lucide SVGs Matching #4A5D4E, Strictly 18px Font) */}
            <div className="bg-white border border-[#E8E2D5] rounded-2xl p-2.5 space-y-1.5 shadow-xs w-full text-right">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#4A5D4E] flex-shrink-0" />
                <span className="text-[16.5px] tracking-[-0.015em] text-[#2C352E] leading-snug">
                  <strong className="font-bold text-[#2C352E]">הרכב רשום:</strong>{' '}
                  {formData.adults} מבוגרים
                  {formData.children > 0 ? `, ${formData.children} ילדים` : ''}
                  {formData.babies > 0 ? `, ${formData.babies} תינוקות` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#4A5D4E] flex-shrink-0" />
                <span className="text-[16.5px] tracking-[-0.015em] text-[#2C352E] leading-snug">
                  <strong className="font-bold text-[#2C352E]">מועד:</strong> יום שלישי, 10/11/2026
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#4A5D4E] flex-shrink-0" />
                <span className="text-[16.5px] tracking-[-0.015em] text-[#2C352E] leading-snug">
                  <strong className="font-bold text-[#2C352E]">שעות:</strong> 16:00 - 19:00
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#4A5D4E] flex-shrink-0" />
                <span className="text-[16.5px] tracking-[-0.015em] text-[#2C352E] leading-snug">
                  <strong className="font-bold text-[#2C352E]">מיקום:</strong> West Garden, רעננה
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-[#4A5D4E] flex-shrink-0" />
                <span className="text-[16.5px] tracking-[-0.015em] text-[#2C352E] leading-snug">
                  <strong className="font-bold text-[#2C352E]">חניה:</strong> חניה מסודרת בצמוד למתחם האירועים
                </span>
              </div>
              <div className="pt-1.5 border-t border-[#F0EBE1] text-center text-xs text-[#7A877C] leading-relaxed">
                הכל שמור ומסודר.
                <br />
                אפשר לסגור חלון זה בבטחה.
              </div>
            </div>
          </div>
        )}

        {/* ================= SCREEN 'decline': DECLINE BLESSING & DUAL-FINISH ================= */}
        {step === 'decline' && (
          <div className="flex-1 flex flex-col justify-between text-center space-y-2.5 pt-1 min-h-full">
            <div className="space-y-2.5">
              {/* Tuval Portrait */}
              <div className="w-16 h-16 mx-auto rounded-full overflow-hidden border-2 border-[#4A5D4E] shadow-sm">
                <img
                  src="/tuval_portrait_color.jpg"
                  alt="תובל"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-0.5">
                <h2 className="text-xl font-bold text-[#2C352E]">
                  תודה רבה{formData.name.trim() ? `, ${formData.name.trim()}` : ''}!
                </h2>
                <p className="text-sm text-[#526054] leading-relaxed font-medium">
                  חבל שלא יתאפשר לך להגיע...
                  <br />
                  ניפגש בשמחות הבאות!
                </p>
              </div>

              {/* Optional Blessing Card */}
              <div className="bg-white border border-[#E8E2D5] rounded-2xl p-3 text-right space-y-2 shadow-xs">
                <p className="text-sm text-[#526054] font-medium text-center">
                  בכל מקרה, נשמח לברכה עבור תובל
                </p>

                <textarea
                  rows={3}
                  value={blessingData.content}
                  onChange={(e) =>
                    setBlessingData((prev) => ({ ...prev, content: e.target.value }))
                  }
                  placeholder='אפשר לכתוב ברכה, רעיון, או לבקש מה־AI (למשל: "ברכה בחרוזים" או "שלב ציטוט יפה")...'
                  className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#D5CFC3] bg-white focus:outline-none focus:ring-2 focus:ring-[#4A5D4E] placeholder-[#9E9689] leading-relaxed"
                />

                {/* AI & 1-Step Undo Controls */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleAIEnhance}
                      disabled={isAILoading}
                      className="flex-1 py-2 bg-gradient-to-r from-[#4A5D4E] to-[#637A68] text-white rounded-lg text-xs font-semibold shadow-2xs hover:opacity-95 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-1.5"
                    >
                      <span>✨</span>
                      <span>
                        {isAILoading
                          ? isAISlow
                            ? 'העוזר החכם מתחבר ומתנסח...'
                            : 'מתחבר ל-AI...'
                          : blessingData.content.trim()
                          ? 'שדרוג ברכה עם AI'
                          : 'יצירת ברכה עם AI'}
                      </span>
                    </button>
                  </div>
                  {originalDraft && (
                    <div className="flex items-center justify-start pt-0.5">
                      <button
                        type="button"
                        onClick={handleUndo}
                        className="text-xs text-[#4A5D4E] hover:text-[#2C352E] flex items-center gap-1 font-semibold cursor-pointer transition-colors bg-[#F4EFE6] px-2.5 py-1 rounded-lg border border-[#E5DECF]"
                      >
                        <Undo2 className="w-3.5 h-3.5 text-[#4A5D4E]" />
                        <span>שחזור הנוסח המקורי שלי</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Sharing Levels */}
                <div className="pt-1.5 border-t border-[#F0EBE1] space-y-1">
                  <div className="text-xs font-bold text-[#3E4A40]">מי יכול לראות את הברכה?</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setBlessingData((prev) => ({ ...prev, isPublic: true }))}
                      className={`flex items-center gap-2 p-2 rounded-xl text-right transition-all ${
                        blessingData.isPublic
                          ? 'border-2 border-[#4A5D4E] bg-[#4A5D4E]/8 font-bold text-[#2C352E]'
                          : 'border border-[#D5CFC3] text-[#7A877C]'
                      }`}
                    >
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-[#4A5D4E] flex items-center justify-center bg-white">
                        {blessingData.isPublic && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#4A5D4E]" />
                        )}
                      </div>
                      <span>גלויה לכולם</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBlessingData((prev) => ({ ...prev, isPublic: false }))}
                      className={`flex items-center gap-2 p-2 rounded-xl text-right transition-all ${
                        !blessingData.isPublic
                          ? 'border-2 border-[#4A5D4E] bg-[#4A5D4E]/8 font-bold text-[#2C352E]'
                          : 'border border-[#D5CFC3] text-[#7A877C]'
                      }`}
                    >
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-[#4A5D4E] flex items-center justify-center bg-white">
                        {!blessingData.isPublic && (
                          <div className="w-1.5 h-1.5 rounded-full bg-[#4A5D4E]" />
                        )}
                      </div>
                      <span>פרטית לתובל</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* DUAL-FINISH BUTTONS (Friendly & Clear) + BACK BUTTON */}
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={handleDeclineBlessingSubmit}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-[#4A5D4E] hover:bg-[#3B4A3E] text-white rounded-xl text-sm font-bold shadow-md cursor-pointer transition-all active:scale-[0.98] disabled:opacity-60"
              >
                {isSubmitting ? 'שומר ברכה...' : 'שליחת הברכה וסיום'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setBlessingData((prev) => ({ ...prev, content: '' }));
                  goToStep('decline_sealed');
                }}
                className="w-full py-2 px-4 bg-transparent border border-[#9A9182] hover:bg-[#F2ECE1] text-[#554D41] rounded-xl text-xs font-semibold cursor-pointer transition-all active:scale-[0.98]"
              >
                סיום ללא ברכה
              </button>
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="w-full py-1 text-xs text-[#7A877C] hover:text-[#2C352E] font-medium cursor-pointer transition-colors text-center"
              >
                חזור למסך הקודם →
              </button>
            </div>
          </div>
        )}

        {/* ================= SCREEN 'decline_sealed': HERMETICALLY SEALED DECLINE ================= */}
        {step === 'decline_sealed' && (
          <div className="flex-1 flex flex-col items-center justify-center h-full text-center space-y-4 my-auto">
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

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[#2C352E]">
                תודה רבה{formData.name.trim() ? `, ${formData.name.trim()}` : ''}!
              </h2>
              <p className="text-sm font-semibold text-[#4A5D4E]">תשובתך נשמרה במערכת</p>
            </div>

            {/* Warm Reassurance Card */}
            <div className="bg-[#F4EFE6] border border-[#E5DECF] rounded-2xl p-4 text-center space-y-2 shadow-xs w-full">
              <div className="text-[17px] font-bold text-[#3E4A40] flex items-center justify-center gap-1.5">
                <span>🌿</span>
                <span>הכל שמור ומסודר!</span>
              </div>
              <p className="text-[15px] text-[#526054] leading-relaxed">
                {blessingData.content.trim()
                  ? 'הברכה המרגשת שלך הועברה באהבה לתובל.'
                  : 'תודה רבה שהודעת לנו, זה עוזר לנו מאוד בהיערכות.'}
                <br />
                <span className="font-bold text-[#3E4A40]">נשמח להיפגש ולחגוג יחד בשמחות הבאות!</span>
                <br />
                אפשר לסגור חלון זה בבטחה.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
