const ROOM_RE = /^uts-[A-Za-z0-9_-]{8,100}$/;
const MAX_CHAT = 100;
const MAX_STROKES = 500;
const MAX_POINTS = 400;
const rooms = new Map();

function stateFor(room) {
  if (!rooms.has(room)) rooms.set(room, { code: '// Welcome to the shared editor\n', strokes: [], chat: [], members: new Map() });
  return rooms.get(room);
}
function validRoom(room) { return typeof room === 'string' && ROOM_RE.test(room); }
function safeText(value, max = 500) { return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max); }

export function attachCollaboration(io) {
  io.on('connection', (socket) => {
    socket.on('room:join', (payload = {}) => {
      const room = String(payload.room || '');
      const name = safeText(payload.name, 60) || 'Participant';
      if (!validRoom(room)) return socket.emit('room:error', { message: 'Invalid room code.' });
      if (socket.data.room) socket.leave(socket.data.room);
      socket.data.room = room;
      socket.data.name = name;
      socket.join(room);
      const state = stateFor(room);
      state.members.set(socket.id, { id: socket.id, name });
      socket.emit('room:state', {
        code: state.code,
        strokes: state.strokes,
        chat: state.chat,
        members: [...state.members.values()]
      });
      io.to(room).emit('room:members', [...state.members.values()]);
      io.to(room).emit('chat:message', { id: `system-${Date.now()}-${socket.id}`, system: true, name: 'UpToSkill', text: `${name} joined the room.`, ts: Date.now() });
    });

    socket.on('code:change', (payload = {}) => {
      const room = socket.data.room;
      if (!room || !validRoom(room) || typeof payload.code !== 'string') return;
      const code = payload.code.slice(0, 100000);
      stateFor(room).code = code;
      socket.to(room).emit('code:change', { code, by: socket.id });
    });

    socket.on('whiteboard:stroke', (payload = {}) => {
      const room = socket.data.room;
      if (!room || !validRoom(room) || !payload.stroke || !Array.isArray(payload.stroke.points)) return;
      const points = payload.stroke.points.slice(0, MAX_POINTS).filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y))
        .map(p => ({ x: Math.max(0, Math.min(1, p.x)), y: Math.max(0, Math.min(1, p.y)) }));
      if (!points.length) return;
      const stroke = { color: /^#[0-9a-f]{6}$/i.test(payload.stroke.color) ? payload.stroke.color : '#2563eb', width: Math.max(1, Math.min(20, Number(payload.stroke.width) || 3)), points };
      const state = stateFor(room);
      state.strokes.push(stroke);
      if (state.strokes.length > MAX_STROKES) state.strokes.splice(0, state.strokes.length - MAX_STROKES);
      socket.to(room).emit('whiteboard:stroke', stroke);
    });

    socket.on('whiteboard:clear', () => {
      const room = socket.data.room;
      if (!room || !validRoom(room)) return;
      stateFor(room).strokes = [];
      io.to(room).emit('whiteboard:clear');
    });

    socket.on('chat:send', (payload = {}) => {
      const room = socket.data.room;
      const text = safeText(payload.text, 500);
      if (!room || !validRoom(room) || !text) return;
      const message = { id: `${Date.now()}-${socket.id}`, name: socket.data.name || 'Participant', text, ts: Date.now() };
      const state = stateFor(room);
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
        // forget the room 10 minutes after the last person leaves (a refresh can still rejoin and keep the code / board)
        if (!state.members.size) setTimeout(() => { const r = rooms.get(room); if (r && !r.members.size) rooms.delete(room); }, 10 * 60 * 1000).unref();
      }
      io.to(room).emit('room:members', state ? [...state.members.values()] : []);
      io.to(room).emit('chat:message', { id: `system-${Date.now()}-${socket.id}`, system: true, name: 'UpToSkill', text: `${socket.data.name || 'A participant'} left the room.`, ts: Date.now() });
    });
  });
}
