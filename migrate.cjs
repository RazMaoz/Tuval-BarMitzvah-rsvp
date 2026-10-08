const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf-8');

code = code.replace("import Database from 'better-sqlite3';", "import { createClient } from '@libsql/client';");

const old_init = "const db = new Database('rsvp.sqlite');";
const new_init = `const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:rsvp.sqlite',
  authToken: process.env.TURSO_AUTH_TOKEN,
});`;
code = code.replace(old_init, new_init);

code = code.replace(/db\.exec\(\`/g, "await db.execute(`");

const old_rsvp_db = `    const stmt = db.prepare(\`
      INSERT INTO guests (name, attending, event_part, babies, kids, adults)
      VALUES (?, ?, ?, ?, ?, ?)
    \`);
    
    stmt.run(name, isAttending, finalPart, finalBabies, finalKids, finalAdults);`;
const new_rsvp_db = `    await db.execute({
      sql: \`INSERT INTO guests (name, attending, event_part, babies, kids, adults) VALUES (?, ?, ?, ?, ?, ?)\`,
      args: [name, isAttending, finalPart, finalBabies, finalKids, finalAdults]
    });`;
code = code.replace(old_rsvp_db, new_rsvp_db);
code = code.replace("app.post('/api/rsvp', (req, res) => {", "app.post('/api/rsvp', async (req, res) => {");

const old_bless_db = `    const stmt = db.prepare(\`
      INSERT INTO blessings (author_name, content, is_public)
      VALUES (?, ?, ?)
    \`);
    
    stmt.run(author_name, content, is_public ? 1 : 0);`;
const new_bless_db = `    await db.execute({
      sql: \`INSERT INTO blessings (author_name, content, is_public) VALUES (?, ?, ?)\`,
      args: [author_name, content, is_public ? 1 : 0]
    });`;
code = code.replace(old_bless_db, new_bless_db);
code = code.replace("app.post('/api/blessings', (req, res) => {", "app.post('/api/blessings', async (req, res) => {");

const old_get_db = `    const stmt = db.prepare('SELECT * FROM guests');
    const guests = stmt.all();`;
const new_get_db = `    const result = await db.execute('SELECT * FROM guests ORDER BY created_at DESC');
    const guests = result.rows;`;
code = code.replace(old_get_db, new_get_db);
code = code.replace("app.get('/api/guests', (req, res) => {", "app.get('/api/guests', async (req, res) => {");

const old_patch_db = `    const stmt = db.prepare('UPDATE guests SET category = ? WHERE id = ?');
    stmt.run(category, id);`;
const new_patch_db = `    await db.execute({
      sql: 'UPDATE guests SET category = ? WHERE id = ?',
      args: [category, id]
    });`;
code = code.replace(old_patch_db, new_patch_db);
code = code.replace("app.patch('/api/guests/:id/category', (req, res) => {", "app.patch('/api/guests/:id/category', async (req, res) => {");

fs.writeFileSync('server.js', code);
