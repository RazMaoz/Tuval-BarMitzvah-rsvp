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

// Health & Keep-Warm Endpoint (Silent pre-warm & Uptime monitor ping)
app.get(['/api/health', '/api/ping'], (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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

try {
  await db.execute(`ALTER TABLE guests ADD COLUMN updated_at DATETIME;`);
} catch (err) {
  // Column likely already exists, ignore
}

await db.execute(`
  CREATE TABLE IF NOT EXISTS blessings (
    id INTEGER PRIMARY KEY,
    author_name TEXT,
    content TEXT,
    is_public BOOLEAN,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
  );
`);

try {
  await db.execute(`ALTER TABLE blessings ADD COLUMN updated_at DATETIME;`);
} catch (err) {
  // Column likely already exists, ignore
}

app.post('/api/rsvp', async (req, res) => {
  try {
    const { id, guestId, name, attending, part } = req.body;
    const targetId = id || guestId;
    const trimmedName = (name || '').trim();
    if (!trimmedName) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Robust parsing of attending: supports boolean true, 'yes', 'true', 1, '1'
    const isAttending = (attending === true || attending === 'yes' || attending === 'true' || attending === 1 || attending === '1') ? 1 : 0;
    
    const babiesCount = Math.max(0, Math.min(50, Math.floor(Number(req.body.babies) || 0)));
    const kidsCount = Math.max(0, Math.min(50, Math.floor(Number(req.body.kids || req.body.children) || 0)));
    const adultsCount = Math.max(isAttending ? 1 : 0, Math.min(50, Math.floor(Number(req.body.adults) || (isAttending ? 1 : 0))));
    
    // If not attending, zero out everything
    const finalPart = isAttending ? (part || 'האירוע המלא') : 'אינו מגיע';
    const finalBabies = isAttending ? babiesCount : 0;
    const finalKids = isAttending ? kidsCount : 0;
    const finalAdults = isAttending ? adultsCount : 0;
    
    let existingGuestId = null;

    if (targetId) {
      const parsedId = parseInt(targetId, 10);
      if (parsedId > 0) {
        const existing = await db.execute({
          sql: 'SELECT id FROM guests WHERE id = ?',
          args: [parsedId]
        });
        if (existing.rows.length > 0) {
          existingGuestId = parsedId;
        }
      }
    }

    // Robust fallback: If no ID or ID not found, match by exact name to prevent duplicate rows
    if (!existingGuestId && trimmedName) {
      const existingByName = await db.execute({
        sql: 'SELECT id FROM guests WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) ORDER BY id DESC LIMIT 1',
        args: [trimmedName]
      });
      if (existingByName.rows.length > 0) {
        existingGuestId = existingByName.rows[0].id;
      }
    }
    
    if (existingGuestId) {
      await db.execute({
        sql: `UPDATE guests SET name = ?, attending = ?, event_part = ?, babies = ?, kids = ?, adults = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [trimmedName, isAttending, finalPart, finalBabies, finalKids, finalAdults, existingGuestId]
      });
      return res.json({ success: true, guestId: existingGuestId, isUpdate: true });
    }
    
    const result = await db.execute({
      sql: `INSERT INTO guests (name, attending, event_part, babies, kids, adults, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      args: [trimmedName, isAttending, finalPart, finalBabies, finalKids, finalAdults]
    });
    
    const newGuestId = Number(result.lastInsertRowid);
    res.json({ success: true, guestId: newGuestId, isUpdate: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/blessings', async (req, res) => {
  try {
    const { id, blessingId, author_name, content, is_public } = req.body;
    const targetId = id || blessingId;
    const trimmedAuthor = (author_name || '').trim() || 'אורח';
    const trimmedContent = (content || '').trim();
    
    if (!trimmedContent) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const isPublic = (is_public === true || is_public === 1 || is_public === '1' || is_public === 'true') ? 1 : 0;
    
    let existingBlessingId = null;

    if (targetId) {
      const parsedId = parseInt(targetId, 10);
      if (parsedId > 0) {
        const existing = await db.execute({
          sql: 'SELECT id FROM blessings WHERE id = ?',
          args: [parsedId]
        });
        if (existing.rows.length > 0) {
          existingBlessingId = parsedId;
        }
      }
    }

    // Robust fallback: match by author name to update blessing rather than duplicate
    if (!existingBlessingId && trimmedAuthor && trimmedAuthor !== 'אורח') {
      const existingByAuthor = await db.execute({
        sql: 'SELECT id FROM blessings WHERE LOWER(TRIM(author_name)) = LOWER(TRIM(?)) ORDER BY id DESC LIMIT 1',
        args: [trimmedAuthor]
      });
      if (existingByAuthor.rows.length > 0) {
        existingBlessingId = existingByAuthor.rows[0].id;
      }
    }
    
    if (existingBlessingId) {
      await db.execute({
        sql: `UPDATE blessings SET author_name = ?, content = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [trimmedAuthor, trimmedContent, isPublic, existingBlessingId]
      });
      return res.json({ success: true, blessingId: existingBlessingId, isUpdate: true });
    }
    
    const result = await db.execute({
      sql: `INSERT INTO blessings (author_name, content, is_public, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
      args: [trimmedAuthor, trimmedContent, isPublic]
    });
    
    const newBlessingId = Number(result.lastInsertRowid);
    res.json({ success: true, blessingId: newBlessingId, isUpdate: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/blessings', async (req, res) => {
  try {
    const result = await db.execute('SELECT * FROM blessings ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/api/guests/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Invalid ID' });
    }
    await db.execute({
      sql: 'DELETE FROM guests WHERE id = ?',
      args: [id]
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete guest' });
  }
});

app.delete('/api/blessings/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Invalid ID' });
    }
    await db.execute({
      sql: 'DELETE FROM blessings WHERE id = ?',
      args: [id]
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete blessing' });
  }
});

app.patch('/api/blessings/:id/visibility', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Invalid ID' });
    }
    const { is_public } = req.body;
    const isPublic = (is_public === true || is_public === 1 || is_public === '1' || is_public === 'true') ? 1 : 0;
    await db.execute({
      sql: 'UPDATE blessings SET is_public = ? WHERE id = ?',
      args: [isPublic, id]
    });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update blessing visibility' });
  }
});

app.post(['/api/generate-blessing', '/api/ai/enhance-blessing'], async (req, res) => {
  try {
    const { text, guestName } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'חסר מפתח API. נא לעדכן בקובץ .env' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.8-flash",
      generationConfig: { temperature: 0.7 }
    });

    const prompt = `אתה עוזר וירטואלי חכם, עורך לשוני וסופר צללים עבור אירוע בר המצווה של נער בשם תובל.
האורח שכותב את הברכה הוא: "${guestName || 'אורח'}".

הטקסט שהזין האורח בתיבת הברכה (או טיוטה / הנחיה):
"""
${(text || '').trim()}
"""

משימתך היא לנתח את כוונת הכותב (Intent) ולסנתז את הברכה המושלמת לתובל:

1. אם הטקסט ריק לחלוטין (או רווחים בלבד):
   - כתוב ברכת בר מצווה חמה, מרגשת, אישית וקצרה (3-4 משפטים) לתובל, המאחלת לו צמיחה, שמחה והצלחה בדרכו החדשה.

2. אם הטקסט מהווה הנחיה או בקשה ל-AI (למשל: "כתוב בחרוזים", "שלב ציטוט יפה", "ברכה קצרה ומצחיקה", "ציטוט מן המקורות", "שיר ישראלי"):
   - זהה שזוהי הוראה לביצוע ולא תוכן הברכה עצמו!
   - בצע את ההוראה באופן מלא ומקצועי: חבר ברכה לתובל העונה בדיוק לבקשה (למשל חרוזים מושלמים, או שילוב ציטוט אותנטי ומעורר השראה, וכו').

3. אם הטקסט מהווה טיוטה, רעיון, התחלה של ברכה, שיר, או ציטוט שהאורח התחיל לכתוב בעצמו:
   - כבד ושמור על קולו האישי של הכותב! אל תדרוס ואל תמחק את מה שהוא יצר.
   - אם האורח התחיל לכתוב בחרוזים או כשיר - המשך את קו החריזה והסגנון שלו ושדרג אותו.
   - אם האורח שילב בדיחה פנימית, שמות חיבה, או סלנג אישי - שמור עליהם באהבה והשתלב איתם בטבעיות, אל תהפוך את הברכה לגנרית ויבשה.
   - תקן בעדינות שגיאות כתיב או תחביר אם ישנן, אך שמור על האותנטיות של הטקסט המקורי.

כללי ברזל מחייבים לכל המקרים:
- אחידות מגדרית עקבית: קבע את מגדר הכותב אך ורק לפי הפעלים בגוף הברכה (כגון 'מאחל' לעומת 'מאחלת'). אם יש סתירה, שמור על אחידות לכל אורך הברכה. (אל תסיק מגדר משם האורח).
- אימוג'ים: הוסף 1-2 אימוג'ים עדינים ומתאימים בלבד (כגון ✨, ❤️, 🎉) שלא יחרגו מהסגנון החגיגי.
- חתימה מדויקת בסוף: יש לחתום את הברכה בסוף בשורה נפרדת בדיוק בשם: "${guestName || 'המשפחה והחברים'}". אל תשנה את השם בשום צורה.
- ללא פטפוטים: פלוט אך ורק את טקסט הברכה הסופי עצמו! ללא הקדמות (בלי "הנה הברכה המשודרגת:"), ללא הסברים, וללא תגיות Markdown.`;

    const aiResponse = await model.generateContent(prompt);
    const result = aiResponse.response.text();
    
    res.json({ result: result.trim(), enhancedText: result.trim() });
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
    const id = parseInt(req.params.id, 10);
    if (!id || id <= 0) {
      return res.status(400).json({ error: 'Invalid ID' });
    }
    const { category } = req.body;
    await db.execute({
      sql: 'UPDATE guests SET category = ? WHERE id = ?',
      args: [category || '', id]
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

app.use(express.static(path.join(__dirname, 'dist'), { dotfiles: 'allow' }));

app.get(/(.*)/, (req, res, next) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'), { dotfiles: 'allow' }, (err) => {
    if (err) {
      if (!res.headersSent) {
        res.status(err.status || 500).end();
      }
    }
  });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

