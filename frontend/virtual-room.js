let Room, RoomEvent, Track;

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const apiFromQuery = params.get('api');
const API_BASE = String(window.UPTOSKILL_API_URL || apiFromQuery || location.origin).replace(/\/$/, '');
const validRoom = (value) => /^uts-[A-Za-z0-9_-]{8,100}$/.test(value || '');
const newRoom = () => `uts-${crypto.randomUUID().replace(/-/g, '')}`;
let roomCode = params.get('room') || newRoom();
if (!validRoom(roomCode)) roomCode = newRoom();
const storedSession = (() => { try { return JSON.parse(localStorage.getItem('uts_session') || 'null'); } catch { return null; } })();
const displayName = (params.get('name') || storedSession?.name || 'UpToSkill participant').trim().slice(0, 60);
const role = params.get('role') || storedSession?.role || 'participant';
$('roomCodeLabel').textContent = roomCode;
let socket = null;
let liveRoom = null;
let micOn = false;
let cameraOn = false;
let codeEditor = null;
let localIdentity = '';
let toastTimer;
const seenVideoTracks = new Set();

function toast(message) {
  const el = $('toast'); el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}
function setVideoStatus(message, bad = false) {
  $('videoStatus').textContent = message;
  $('videoStatus').style.color = bad ? '#fda4af' : '';
}
function setSyncStatus(message, bad = false) {
  $('syncStatus').textContent = message;
  $('syncStatus').style.color = bad ? '#fda4af' : '';
}
function initials(name) { return String(name || '?').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase(); }

// ---- Shared editor ----
codeEditor = CodeMirror.fromTextArea($('codeEditor'), {
  lineNumbers: true,
  mode: 'javascript',
  indentUnit: 2,
  tabSize: 2,
  lineWrapping: false,
  autofocus: false,
  theme: 'default'
});
let codeTimer;
codeEditor.on('change', () => {
  if (!socket?.connected) return;
  setSyncStatus('Syncing…');
  clearTimeout(codeTimer);
  codeTimer = setTimeout(() => socket.emit('code:change', { code: codeEditor.getValue() }), 140);
});
$('languageSelect').addEventListener('change', () => codeEditor.setOption('mode', $('languageSelect').value));

// ---- Shared whiteboard ----
const canvas = $('whiteboard');
const ctx = canvas.getContext('2d');
let drawing = false;
let currentPoints = [];
function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const old = canvas.width && canvas.height ? ctx.getImageData(0, 0, canvas.width, canvas.height) : null;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, rect.width, rect.height);
  if (old) redrawStrokes();
}
function normalizedPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
}
function drawStroke(stroke) {
  if (!stroke?.points?.length) return;
  const w = canvas.getBoundingClientRect().width, h = canvas.getBoundingClientRect().height;
  ctx.strokeStyle = stroke.color || '#2563eb'; ctx.lineWidth = stroke.width || 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h);
  for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x * w, stroke.points[i].y * h);
  if (stroke.points.length === 1) { ctx.lineTo(stroke.points[0].x * w + 0.01, stroke.points[0].y * h + 0.01); }
  ctx.stroke();
}
let boardStrokes = [];
function redrawStrokes() {
  const rect = canvas.getBoundingClientRect();
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, rect.width, rect.height);
  boardStrokes.forEach(drawStroke);
}
function pointerDown(event) {
  drawing = true; currentPoints = [normalizedPoint(event)]; canvas.setPointerCapture?.(event.pointerId); event.preventDefault();
}
function pointerMove(event) {
  if (!drawing) return;
  const point = normalizedPoint(event); currentPoints.push(point);
  const stroke = { color: $('inkColor').value, width: Number($('inkWidth').value), points: currentPoints.slice(-2) };
  drawStroke(stroke); event.preventDefault();
}
function pointerUp() {
  if (!drawing) return; drawing = false;
  if (currentPoints.length) {
    const stroke = { color: $('inkColor').value, width: Number($('inkWidth').value), points: currentPoints.slice(0, 1500) };
    boardStrokes.push(stroke); if (boardStrokes.length > 1500) boardStrokes.shift();
    socket?.emit('whiteboard:stroke', { stroke });
  }
  currentPoints = [];
}
canvas.addEventListener('pointerdown', pointerDown);
canvas.addEventListener('pointermove', pointerMove);
canvas.addEventListener('pointerup', pointerUp);
canvas.addEventListener('pointercancel', pointerUp);
$('clearBoardBtn').addEventListener('click', () => {
  if (!confirm('Clear the shared whiteboard for everyone in this room?')) return;
  boardStrokes = []; redrawStrokes(); socket?.emit('whiteboard:clear');
});
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ---- Room chat and participant list ----
function appendMessage(message) {
  const box = $('chatMessages');
  const item = document.createElement('div');
  item.className = `chat-message${message.system ? ' system' : ''}${message.name === displayName && !message.system ? ' mine' : ''}`;
  if (!message.system) {
    const head = document.createElement('span'); head.className = 'msg-head'; head.textContent = message.name || 'Participant';
    const time = document.createElement('span'); time.className = 'msg-time'; time.textContent = new Date(message.ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    head.appendChild(time); item.appendChild(head);
  }
  const text = document.createElement('span'); text.textContent = message.text || ''; item.appendChild(text);
  box.appendChild(item); box.scrollTop = box.scrollHeight;
}
$('chatForm').addEventListener('submit', (event) => {
  event.preventDefault(); const input = $('chatInput'); const text = input.value.trim();
  if (!text) return;
  if (!socket?.connected) return toast('Room chat is not connected yet.');
  socket.emit('chat:send', { text }); input.value = ''; input.focus();
});
function renderMembers(members = []) {
  $('participantCount').textContent = `${members.length} participant${members.length === 1 ? '' : 's'}`;
  $('peopleSummary').textContent = members.length ? `${members.length} participant${members.length === 1 ? '' : 's'} connected` : 'Waiting for participants…';
  const list = $('peopleList'); list.replaceChildren();
  members.forEach(member => {
    const li = document.createElement('li');
    const avatar = document.createElement('span'); avatar.className = 'person-avatar'; avatar.textContent = initials(member.name);
    const name = document.createElement('span'); name.textContent = member.name || 'Participant';
    const status = document.createElement('small'); status.textContent = member.id === socket?.id ? 'You' : 'Connected';
    li.append(avatar, name, status); list.appendChild(li);
  });
}

function connectCollaboration() {
  if (typeof window.io !== 'function') {
    setSyncStatus('Socket.IO client unavailable', true);
    toast('Could not load collaboration client. Check the network and refresh.');
    return;
  }
  socket = window.io(API_BASE, { transports: ['websocket', 'polling'], reconnection: true, timeout: 12000 });
  socket.on('connect', () => {
    socket.emit('room:join', { room: roomCode, name: displayName, role });
    setSyncStatus('Connecting…');
  });
  socket.on('connect_error', () => setSyncStatus('Realtime connection failed', true));
  socket.on('disconnect', () => setSyncStatus('Reconnecting…', true));
  socket.on('room:error', (payload) => toast(payload?.message || 'Could not join room.'));
  socket.on('room:state', (state) => {
    if (typeof state.code === 'string' && codeEditor.getValue() !== state.code) codeEditor.setValue(state.code);
    boardStrokes = Array.isArray(state.strokes) ? state.strokes : []; redrawStrokes();
    $('chatMessages').replaceChildren(); (state.chat || []).forEach(appendMessage);
    renderMembers(state.members || []); setSyncStatus('Live sync connected');
  });
  socket.on('room:members', renderMembers);
  socket.on('code:change', ({ code, by }) => {
    if (by === socket.id || typeof code !== 'string') return;
    const cursor = codeEditor.getCursor();
    if (codeEditor.getValue() !== code) codeEditor.setValue(code);
    try { codeEditor.setCursor(cursor); } catch { }
    setSyncStatus('Live sync connected');
  });
  socket.on('whiteboard:stroke', stroke => { boardStrokes.push(stroke); if (boardStrokes.length > 1500) boardStrokes.shift(); drawStroke(stroke); });
  socket.on('whiteboard:clear', () => { boardStrokes = []; redrawStrokes(); });
  socket.on('chat:message', appendMessage);
}

// ---- LiveKit video and audio ----
function tileFor(identity, name, isLocal = false) {
  let tile = document.querySelector(`[data-identity="${CSS.escape(identity)}"]`);
  if (tile) return tile;
  $('videoPlaceholder')?.remove();
  tile = document.createElement('div'); tile.className = 'video-tile'; tile.dataset.identity = identity;
  const label = document.createElement('span'); label.className = 'person-label'; label.textContent = `${name || 'Participant'}${isLocal ? ' · You' : ''}`;
  tile.appendChild(label); $('videoGrid').appendChild(tile); return tile;
}
function attachVideoTrack(track, participant, isLocal = false) {
  const key = `${participant.identity}:${track.sid || track.mediaStreamTrack?.id || 'video'}`;
  if (seenVideoTracks.has(key)) return;
  seenVideoTracks.add(key);
  const tile = tileFor(participant.identity, participant.name || participant.identity, isLocal);
  const video = track.attach(); video.autoplay = true; video.playsInline = true; video.muted = isLocal; video.className = 'participant-video';
  const existing = tile.querySelector('video'); if (existing) existing.remove();
  tile.prepend(video);
}
function attachAudioTrack(track) {
  const audio = track.attach(); audio.autoplay = true; audio.setAttribute('playsinline', ''); $('audioDock').appendChild(audio);
}
function attachParticipantTracks(participant, isLocal = false) {
  participant.trackPublications?.forEach(publication => {
    const track = publication.track;
    if (!track) return;
    if (track.kind === Track.Kind.Video) attachVideoTrack(track, participant, isLocal);
    if (track.kind === Track.Kind.Audio) attachAudioTrack(track);
  });
}
function removeParticipant(identity) {
  const tile = document.querySelector(`[data-identity="${CSS.escape(identity)}"]`); tile?.remove();
  if (!$('videoGrid').querySelector('.video-tile')) {
    const placeholder = document.createElement('div'); placeholder.className = 'video-placeholder'; placeholder.id = 'videoPlaceholder';
    placeholder.innerHTML = '<span class="placeholder-icon">◉</span><b>Camera tiles appear here</b><small>Allow camera and microphone access when prompted.</small>';
    $('videoGrid').appendChild(placeholder);
  }
}
async function connectVideo() {
  setVideoStatus('Connecting to LiveKit…');
  try {
    const response = await fetch(`${API_BASE}/virtual-room/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room: roomCode, name: displayName, role })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `Video service returned ${response.status}`);
    const sdk = await import('https://cdn.jsdelivr.net/npm/livekit-client@2.15.6/+esm');
    Room = sdk.Room; RoomEvent = sdk.RoomEvent; Track = sdk.Track;
    liveRoom = new Room({ adaptiveStream: true, dynacast: true });
    liveRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind === Track.Kind.Video) attachVideoTrack(track, participant, false);
      if (track.kind === Track.Kind.Audio) attachAudioTrack(track);
    });
    liveRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      track.detach().forEach(el => el.remove());
      if (track.kind === Track.Kind.Video) { seenVideoTracks.clear(); removeParticipant(participant.identity); }
    });
    liveRoom.on(RoomEvent.ParticipantConnected, participant => { attachParticipantTracks(participant, false); });
    liveRoom.on(RoomEvent.ParticipantDisconnected, participant => removeParticipant(participant.identity));
    liveRoom.on(RoomEvent.LocalTrackPublished, () => attachParticipantTracks(liveRoom.localParticipant, true));
    liveRoom.on(RoomEvent.LocalTrackUnpublished, (publication) => publication.track?.detach().forEach(el => el.remove()));
    await liveRoom.connect(payload.serverUrl, payload.token);
    localIdentity = liveRoom.localParticipant.identity;
    attachParticipantTracks(liveRoom.localParticipant, true);
    for (const participant of liveRoom.remoteParticipants.values()) attachParticipantTracks(participant, false);
    await liveRoom.localParticipant.setMicrophoneEnabled(true);
    micOn = true; updateMediaButtons();
    try { await liveRoom.localParticipant.setCameraEnabled(true); cameraOn = true; }
    catch { cameraOn = false; $('mediaHint').textContent = 'Camera unavailable. You can still use audio, chat, board and code.'; }
    updateMediaButtons();
    setVideoStatus('Connected. Audio and video are ready.');
  } catch (error) {
    setVideoStatus(error.message || 'Video connection failed.', true);
    $('mediaHint').textContent = 'Add LiveKit Cloud credentials to the backend environment, then redeploy the backend.';
    toast(error.message || 'Could not connect to video. Collaboration tools may still work.');
  }
}
function updateMediaButtons() {
  $('micBtn').classList.toggle('off', !micOn); $('micBtn').setAttribute('aria-pressed', String(micOn));
  $('micBtn').querySelector('b').textContent = micOn ? 'Mute mic' : 'Unmute mic';
  $('cameraBtn').classList.toggle('off', !cameraOn); $('cameraBtn').setAttribute('aria-pressed', String(cameraOn));
  $('cameraBtn').querySelector('b').textContent = cameraOn ? 'Turn camera off' : 'Turn camera on';
}
$('micBtn').addEventListener('click', async () => {
  if (!liveRoom) return toast('Video service is not connected yet.');
  try { micOn = !micOn; await liveRoom.localParticipant.setMicrophoneEnabled(micOn); updateMediaButtons(); }
  catch (error) { micOn = !micOn; updateMediaButtons(); toast(error.message || 'Could not change microphone.'); }
});
$('cameraBtn').addEventListener('click', async () => {
  if (!liveRoom) return toast('Video service is not connected yet.');
  try { cameraOn = !cameraOn; await liveRoom.localParticipant.setCameraEnabled(cameraOn); attachParticipantTracks(liveRoom.localParticipant, true); updateMediaButtons(); }
  catch (error) { cameraOn = !cameraOn; updateMediaButtons(); toast(error.message || 'Could not change camera.'); }
});

$('shareBtn').addEventListener('click', async () => {
  const invite = new URL(location.href); invite.searchParams.set('room', roomCode); invite.searchParams.delete('name'); invite.searchParams.delete('role'); if (API_BASE !== location.origin) invite.searchParams.set('api', API_BASE);
  try { await navigator.clipboard.writeText(invite.toString()); toast('Invite link copied. Send it only to the intended participants.'); }
  catch { window.prompt('Copy this room invite link:', invite.toString()); }
});
$('leaveBtn').addEventListener('click', async () => {
  if (!confirm('Leave this virtual classroom?')) return;
  try { socket?.disconnect(); await liveRoom?.disconnect(); } catch { }
  const back = role === 'tutor' ? 'tutor/app.html' : role === 'student' ? 'student/app.html' : 'index.html';
  location.href = back;
});
window.addEventListener('beforeunload', () => { socket?.disconnect(); liveRoom?.disconnect(); });

connectCollaboration();
connectVideo();
