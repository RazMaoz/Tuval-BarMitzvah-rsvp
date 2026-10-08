import express from 'express';
import cors from 'cors';
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();
const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:rsvp.sqlite',
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await db.execute(`
  CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY,
    name TEXT,
    attending BOOLEAN,
    event_part TEXT,
    babies INTEGER DEFAULT 0,
    kids INTEGER DEFAULT 0,
    adults INTEGER DEFAULT 0,
    category TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Simple migration for existing databases
try {
  await db.execute(`ALTER TABLE guests ADD COLUMN category TEXT DEFAULT '';`);
} catch (err) {
  // Column likely already exists, ignore
}
  
await db.execute(`
  CREATE TABLE IF NOT EXISTS blessings (
    id INTEGER PRIMARY KEY,
    author_name TEXT,
    content TEXT,
    is_public BOOLEAN,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

app.post('/api/rsvp', async (req, res) => {
  try {
    const { name, attending, part, babies = 0, children = 0, adults = 0 } = req.body;
    
    // convert yes/no to boolean properly if it comes as string
    const isAttending = attending === 'yes' ? 1 : 0;
    
    // If not attending, zero out everything
    const finalPart = isAttending ? (part || '') : null;
    const finalBabies = isAttending ? babies : 0;
    const finalKids = isAttending ? children : 0;
    const finalAdults = isAttending ? adults : 0;
    
    await db.execute({
      sql: `INSERT INTO guests (name, attending, event_part, babies, kids, adults) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [name, isAttending, finalPart, finalBabies, finalKids, finalAdults]
    });
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/blessings', async (req, res) => {
  try {
    const { author_name, content, is_public } = req.body;
    
    await db.execute({
      sql: `INSERT INTO blessings (author_name, content, is_public) VALUES (?, ?, ?)`,
      args: [author_name, content, is_public ? 1 : 0]
    });
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/generate-blessing', async (req, res) => {
  try {
    const { text, guestName } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'חסר מפתח API. נא לעדכן בקובץ .env' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { temperature: 0.9 }
    });

    let prompt = "";
    if (!text || text.trim() === '') {
      prompt = `
      אתה עוזר וירטואלי חכם שכותב ברכות לאירועי בר מצווה.
      אנא כתוב ברכת בר מצווה מרגשת, חמה וקצרה (עד 4 משפטים) לילד בשם תובל.
      על החתום: ${guestName || 'המשפחה האוהבת'}.
      השתמש ב-2-3 אימוג'ים רלוונטיים (כמו 🎉, ❤️, ✨).
      אל תוסיף שום הקדמה מצידך, רק את הברכה עצמה שמוכנה להדפסה או שליחה.
      `;
    } else {
      prompt = `
      אתה עוזר וירטואלי חכם ועורך לשוני.
      אורח בשם "${guestName || 'אורח'}" כתב טיוטה לברכת בר מצווה לילד בשם תובל.
      הנה הטיוטה:
      """
      ${text}
      """
      המשימה שלך היא לשדרג את הברכה:
      - תפקידך הראשון: אחידות מגדרית בתוך הטקסט! קבע את מגדר הכותב לפי הפעלים בגוף הברכה (למשל 'מאחל' לעומת 'מאחלת'). אם יש סתירות בטקסט, תקן את *כל* שאר הפעלים בטקסט כך שיתאימו לאותו מגדר באופן עקבי.
      - אל תסיק שום מסקנה מגדרית מהחתימה/שם האורח, כי ייתכן שזהו טקסט בדיקה (כמו "אני לא מגיעה").
      - תקן שגיאות כתיב, העשר את השפה והצע ניסוח מלוטש וחגיגי יותר.
      - חובה עליך לנסח מחדש ולהציע סגנון שונה מעט, כדי לתת למשתמש גיוון וערך מוסף (גם אם הטקסט המקורי נראה תקין).
      - הוסף 2-3 אימוג'ים מתאימים.
      - חובה לחתום את הברכה בסוף בדיוק במילים: "${guestName || 'אורח'}". בשום אופן אל תשנה, תתקן או תטה את חתימת השם (גם אם היא נשמעת כמו פועל שגוי), השם הוא קדוש.
      אל תוסיף שום הקדמה או הערות מצידך, אלא רק את הברכה המשודרגת הסופית.
      `;
    }

    const aiResponse = await model.generateContent(prompt);
    const result = aiResponse.response.text();
    
    res.json({ result: result.trim() });
  } catch (err) {
    console.error("Gemini Error:", err);
    res.status(500).json({ error: 'AI Generation Failed' });
  }
});

app.get('/api/guests', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM guests ORDER BY created_at DESC');
    const guests = result.rows;
    res.json(guests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.patch('/api/guests/:id/category', async (req, res) => {
  try {
    const { category } = req.body;
    const { id } = req.params;
    await db.execute({
      sql: 'UPDATE guests SET category = ? WHERE id = ?',
      args: [category, id]
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update category' });
  }
});

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'dist')));

app.get(/(.*)/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

