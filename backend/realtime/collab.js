import { query } from '../db/pool.js';

const ROOM_RE = /^uts-[A-Za-z0-9_-]{8,100}$/;
const MAX_CHAT = 100;
const MAX_PAGES = 30;            // whiteboard pages per room
const MAX_STROKES = 800;         // strokes per page
const MAX_POINTS = 400;
const LANGS = new Set(['javascript', 'python', 'text/x-java', 'text/x-csrc', 'text/x-c++src', 'htmlmixed', 'css']);
const MAX_NOTES = 30000;
const DEFAULT_CODE = '// Welcome to the shared editor\n';
const rooms = new Map();

// A room is loaded from the database the first time someone joins, so notes, code and every whiteboard page
// survive a server restart and are still there for the summary after everybody has left.
async function loadRoom(room) {
  if (rooms.has(room)) return rooms.get(room);
  const state = { code: DEFAULT_CODE, lang: 'javascript', notes: '', pages: [[]], page: 0, chat: [], members: new Map(), dirty: false, saveTimer: null };
  rooms.set(room, state);                                   // set first so two quick joins share one state
  try {
    const { rows } = await query('SELECT notes, code, lang, pages FROM room_summaries WHERE room = $1', [room]);
    if (rows[0]) {
      state.notes = rows[0].notes || ''; state.code = rows[0].code || DEFAULT_CODE; state.lang = LANGS.has(rows[0].lang) ? rows[0].lang : 'javascript';
      if (Array.isArray(rows[0].pages) && rows[0].pages.length) state.pages = rows[0].pages.slice(0, MAX_PAGES).map((p) => (Array.isArray(p) ? p : []));
      state.page = state.pages.length - 1;
    }
  } catch (err) { console.error('room load failed', err.message); }
  return state;
}
const stateOf = (room) => rooms.get(room);
function validRoom(room) { return typeof room === 'string' && ROOM_RE.test(room); }
function safeText(value, max = 500) { return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max); }

async function saveRoom(room) {
  const s = rooms.get(room);
  if (!s || !s.dirty) return;
  s.dirty = false; clearTimeout(s.saveTimer); s.saveTimer = null;
  const pages = JSON.stringify(s.pages);
  if (pages.length > 8_000_000) return;                      // absurdly big board: keep it in memory only
  try {
    await query(
      `INSERT INTO room_summaries (room, notes, code, lang, pages, updated_at) VALUES ($1,$2,$3,$4,$5::jsonb, now())
       ON CONFLICT (room) DO UPDATE SET notes = EXCLUDED.notes, code = EXCLUDED.code, lang = EXCLUDED.lang, pages = EXCLUDED.pages, updated_at = now()`,
      [room, s.notes, s.code, s.lang, pages]);
  } catch (err) { s.dirty = true; console.error('room save failed', err.message); }
}
function touch(room) {                                       // save a few seconds after the last change (not on every stroke)
  const s = rooms.get(room); if (!s) return;
  s.dirty = true;
  if (!s.saveTimer) { s.saveTimer = setTimeout(() => saveRoom(room), 4000); s.saveTimer.unref?.(); }
}

const boardView = (s) => ({ pages: s.pages, page: s.page });

export function attachCollaboration(io) {
  io.on('connection', (socket) => {
    socket.on('room:join', async (payload = {}) => {
      const room = String(payload.room || '');
      const name = safeText(payload.name, 60) || 'Participant';
      if (!validRoom(room)) return socket.emit('room:error', { message: 'Invalid room code.' });
      if (socket.data.room) socket.leave(socket.data.room);
      socket.data.room = room;
      socket.data.name = name;
      socket.join(room);
      const state = await loadRoom(room);
      state.members.set(socket.id, { id: socket.id, name });
      socket.emit('room:state', {
        code: state.code,
        lang: state.lang,
        notes: state.notes,
        board: boardView(state),
        chat: state.chat,
        members: [...state.members.values()]
      });
      io.to(room).emit('room:members', [...state.members.values()]);
      io.to(room).emit('chat:message', { id: `system-${Date.now()}-${socket.id}`, system: true, name: 'UpToSkill', text: `${name} joined the room.`, ts: Date.now() });
    });

    socket.on('code:change', (payload = {}) => {
      const room = socket.data.room;
      if (!room || !validRoom(room) || typeof payload.code !== 'string' || !stateOf(room)) return;
      const code = payload.code.slice(0, 100000);
      stateOf(room).code = code; touch(room);
      socket.to(room).emit('code:change', { code, by: socket.id });
    });

    socket.on('code:lang', (payload = {}) => {
      const room = socket.data.room;
      if (!room || !validRoom(room) || !LANGS.has(payload.lang) || !stateOf(room)) return;
      stateOf(room).lang = payload.lang; touch(room);
      socket.to(room).emit('code:lang', { lang: payload.lang, by: socket.id });
    });

    // Meeting notes: shared by everyone in the room, saved to the database a few seconds after the last change.
    socket.on('notes:change', (payload = {}, ack) => {
      const room = socket.data.room;
      if (!room || !validRoom(room) || typeof payload.text !== 'string' || !stateOf(room)) return;
      const text = payload.text.slice(0, MAX_NOTES);
      stateOf(room).notes = text; touch(room);
      socket.to(room).emit('notes:change', { text, by: socket.id });
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('whiteboard:stroke', (payload = {}) => {
      const room = socket.data.room, state = room && stateOf(room);
      if (!state || !payload.stroke || !Array.isArray(payload.stroke.points)) return;
      const page = Number.isInteger(payload.page) && payload.page >= 0 && payload.page < state.pages.length ? payload.page : state.page;
      const points = payload.stroke.points.slice(0, MAX_POINTS).filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y))
        .map(p => ({ x: Math.max(0, Math.min(1, p.x)), y: Math.max(0, Math.min(1, p.y)) }));
      if (!points.length) return;
      const stroke = { color: /^#[0-9a-f]{6}$/i.test(payload.stroke.color) ? payload.stroke.color : '#2563eb', width: Math.max(1, Math.min(60, Number(payload.stroke.width) || 3)), points };
      if (payload.stroke.eraser === true) stroke.eraser = true;
      const strokes = state.pages[page];
      strokes.push(stroke);
      if (strokes.length > MAX_STROKES) strokes.splice(0, strokes.length - MAX_STROKES);
      touch(room);
      socket.to(room).emit('whiteboard:stroke', { stroke, page });
    });

    socket.on('whiteboard:clear', (payload = {}) => {
      const room = socket.data.room, state = room && stateOf(room);
      if (!state) return;
      const page = Number.isInteger(payload.page) && payload.page >= 0 && payload.page < state.pages.length ? payload.page : state.page;
      state.pages[page] = []; touch(room);
      io.to(room).emit('whiteboard:clear', { page });
    });

    // Pages: the board is a fixed-size page. "new" saves the page you were on and opens a blank one; "goto" flips to another.
    socket.on('whiteboard:page', (payload = {}) => {
      const room = socket.data.room, state = room && stateOf(room);
      if (!state) return;
      if (payload.action === 'new') {
        if (state.pages.length >= MAX_PAGES) return socket.emit('room:error', { message: `A room can hold at most ${MAX_PAGES} whiteboard pages.` });
        state.pages.push([]); state.page = state.pages.length - 1;
      } else if (payload.action === 'goto' && Number.isInteger(payload.index) && payload.index >= 0 && payload.index < state.pages.length) {
        state.page = payload.index;
      } else return;
      touch(room);
      io.to(room).emit('whiteboard:page', { page: state.page, count: state.pages.length });
    });

    // The summary page asks for a flush first, so it always shows the very latest notes and board.
    socket.on('room:save', async (_payload, ack) => {
      const room = socket.data.room;
      if (room && validRoom(room)) await saveRoom(room);
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('chat:send', (payload = {}) => {
      const room = socket.data.room;
      const text = safeText(payload.text, 500);
      if (!room || !validRoom(room) || !text || !stateOf(room)) return;
      const message = { id: `${Date.now()}-${socket.id}`, name: socket.data.name || 'Participant', text, ts: Date.now() };
      const state = stateOf(room);
      state.chat.push(message);
      if (state.chat.length > MAX_CHAT) state.chat.shift();
      io.to(room).emit('chat:message', message);
    });

    socket.on('disconnect', () => {
      const room = socket.data.room;
      if (!room || !validRoom(room)) return;
      const state = rooms.get(room);
      if (state) {
        state.members.delete(socket.id);
        if (!state.members.size) {
          saveRoom(room);                                    // last person left: write everything now
          // forget the in-memory copy 10 minutes later (a refresh can still rejoin); the database copy stays for the summary
          setTimeout(() => { const r = rooms.get(room); if (r && !r.members.size) { saveRoom(room); rooms.delete(room); } }, 10 * 60 * 1000).unref();
        }
      }
      io.to(room).emit('room:members', state ? [...state.members.values()] : []);
      io.to(room).emit('chat:message', { id: `system-${Date.now()}-${socket.id}`, system: true, name: 'UpToSkill', text: `${socket.data.name || 'A participant'} left the room.`, ts: Date.now() });
    });
  });
}
