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
const lessonId = (params.get('sid') || '').replace(/[^\w-]/g, '').slice(0, 40);   // the student's own lesson, so the quiz is offered when they leave
$('roomCodeLabel').textContent = roomCode;
let socket = null;
let liveRoom = null;
let micOn = false;
let cameraOn = false;
let codeEditor = null;
let localIdentity = '';
let toastTimer;

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
const LANG_LABEL = { javascript: 'JavaScript', python: 'Python', 'text/x-java': 'Java', 'text/x-csrc': 'C', 'text/x-c++src': 'C++', htmlmixed: 'HTML', css: 'CSS' };
codeEditor = CodeMirror.fromTextArea($('codeEditor'), {
  lineNumbers: true,
  mode: 'javascript',
  indentUnit: 2,
  tabSize: 2,
  indentWithTabs: false,
  lineWrapping: true,
  autoCloseBrackets: true,
  matchBrackets: true,
  extraKeys: {
    Tab: (cm) => cm.somethingSelected() ? cm.indentSelection('add') : cm.replaceSelection('  ', 'end'),
    'Shift-Tab': (cm) => cm.indentSelection('subtract'),
    'Ctrl-Enter': () => runCode(),
    'Cmd-Enter': () => runCode()
  }
});
// Remote edits must NOT be sent back to the server (that echo is what used to overwrite what you were typing).
let applyingRemote = false;
let codeDirty = false;
let codeTimer;
function sendCode() {
  codeTimer = null; codeDirty = false;
  if (socket?.connected) { socket.emit('code:change', { code: codeEditor.getValue() }); setSyncStatus('Live sync connected'); }
}
codeEditor.on('change', () => {
  if (applyingRemote) return;
  if (!socket?.connected) { setSyncStatus('Offline - changes stay here until you reconnect', true); codeDirty = true; return; }
  codeDirty = true; setSyncStatus('Syncing…');
  clearTimeout(codeTimer); codeTimer = setTimeout(sendCode, 90);
});
// Apply only the part that changed, so the cursor and scroll position of the person typing do not jump.
function applyRemoteCode(code) {
  const cur = codeEditor.getValue();
  if (cur === code) return;
  let start = 0; const max = Math.min(cur.length, code.length);
  while (start < max && cur[start] === code[start]) start++;
  let endCur = cur.length, endNew = code.length;
  while (endCur > start && endNew > start && cur[endCur - 1] === code[endNew - 1]) { endCur--; endNew--; }
  applyingRemote = true;
  try {
    codeEditor.operation(() => codeEditor.replaceRange(code.slice(start, endNew), codeEditor.posFromIndex(start), codeEditor.posFromIndex(endCur), '+remote'));
  } finally { applyingRemote = false; }
}
function setLanguage(lang) {
  if (!LANG_LABEL[lang]) return;
  $('languageSelect').value = lang; codeEditor.setOption('mode', lang);
}
$('languageSelect').addEventListener('change', () => {
  setLanguage($('languageSelect').value); socket?.emit('code:lang', { lang: $('languageSelect').value });
});
$('copyCodeBtn').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(codeEditor.getValue()); toast('Code copied.'); } catch { toast('Could not copy. Select the code and copy it manually.'); }
});

// Run: JavaScript runs in a sandboxed frame (console output shown below), HTML shows a live preview.
const runFrame = $('runFrame');
function showOutput(text, bad = false) {
  const out = $('codeOutput'); out.textContent += (out.textContent ? '\n' : '') + text; out.classList.toggle('bad', bad);
}
function runCode() {
  const mode = $('languageSelect').value, code = codeEditor.getValue();
  const out = $('codeOutput'); out.textContent = ''; out.classList.remove('bad'); $('outputWrap').hidden = false;
  if (mode === 'javascript') {
    runFrame.hidden = true; out.hidden = false;
    const safe = code.replace(/<\/script/gi, '<\\/script');
    runFrame.srcdoc = `<script>(function(){var f=function(a){return a.map(function(x){try{return typeof x==='string'?x:JSON.stringify(x)}catch(e){return String(x)}}).join(' ')};var s=function(t,a){parent.postMessage({uts:1,t:t,m:f(a)},'*')};console.log=function(){s('log',[].slice.call(arguments))};console.info=console.log;console.warn=function(){s('err',[].slice.call(arguments))};console.error=console.warn;window.onerror=function(m){s('err',[m]);return true};window.addEventListener('unhandledrejection',function(e){s('err',[String(e.reason)])})})();<\/script><script>${safe}<\/script><script>parent.postMessage({uts:1,t:'done'},'*')<\/script>`;
  } else if (mode === 'htmlmixed' || mode === 'css') {
    out.hidden = true; runFrame.hidden = false;
    runFrame.srcdoc = mode === 'css' ? `<style>${code}</style><h1>Heading</h1><p>Paragraph text <a href="#">link</a></p><button>Button</button>` : code;
  } else {
    runFrame.hidden = true; out.hidden = false;
    showOutput(`Run is available for JavaScript, HTML and CSS. ${LANG_LABEL[mode]} is for shared editing only.`);
  }
}
window.addEventListener('message', (event) => {
  if (event.source !== runFrame.contentWindow || !event.data?.uts) return;
  if (event.data.t === 'log') showOutput(event.data.m);
  else if (event.data.t === 'err') showOutput(event.data.m, true);
  else if (event.data.t === 'done' && !$('codeOutput').textContent) showOutput('(no output - use console.log to print)');
});
$('runBtn').addEventListener('click', runCode);
$('clearOutBtn').addEventListener('click', () => { $('outputWrap').hidden = true; runFrame.srcdoc = ''; });

// ---- Meeting notes (shared, saved on the server and in this browser) ----
const notesEl = $('notesText');
const NOTES_KEY = `uts_notes_${roomCode}`;
let notesTimer = null, notesFull = false;
function setNotesStatus(text, bad = false) { const el = $('notesStatus'); el.textContent = text; el.style.color = bad ? '#fda4af' : ''; }
try { notesEl.value = localStorage.getItem(NOTES_KEY) || ''; } catch { }
function saveNotesLocal() { try { localStorage.setItem(NOTES_KEY, notesEl.value); } catch { } }
function pushNotes() {
  notesTimer = null;
  if (!socket?.connected) { setNotesStatus('Saved on this device · will sync when you reconnect'); return; }
  socket.emit('notes:change', { text: notesEl.value }, () => setNotesStatus('Saved ✓ · shared with everyone in this room'));
}
notesEl.addEventListener('input', () => {
  saveNotesLocal(); setNotesStatus('Saving…');
  clearTimeout(notesTimer); notesTimer = setTimeout(pushNotes, 400);
});
function applyRemoteNotes(text) {
  if (notesTimer || notesEl.value === text) return; // never overwrite text that has not been sent yet
  const a = notesEl.selectionStart, b = notesEl.selectionEnd, focus = document.activeElement === notesEl;
  notesEl.value = text; saveNotesLocal();
  if (focus) notesEl.setSelectionRange(Math.min(a, text.length), Math.min(b, text.length));
  setNotesStatus('Updated · shared with everyone in this room');
}
$('notesDownloadBtn').addEventListener('click', () => {
  const blob = new Blob([notesEl.value], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `meeting-notes-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
function setNotesFull(on) {
  notesFull = on;
  $('notesPanel').classList.toggle('fullscreen', on); document.body.classList.toggle('notes-full', on);
  $('notesFullBtn').textContent = on ? 'Exit full screen' : 'Full screen';
  if (on) { try { document.documentElement.requestFullscreen?.().catch(() => { }); } catch { } notesEl.focus(); }
  else if (document.fullscreenElement) { try { document.exitFullscreen().catch(() => { }); } catch { } }
}
$('notesFullBtn').addEventListener('click', () => setNotesFull(!notesFull));
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && notesFull) setNotesFull(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && notesFull) setNotesFull(false); });

// ---- Mobile section tabs ----
function showTab(name) {
  document.body.dataset.tab = name;
  document.querySelectorAll('#mobileNav button').forEach((b) => b.classList.toggle('on', b.dataset.go === name));
  requestAnimationFrame(() => { codeEditor.refresh(); resizeCanvas(); redrawStrokes(); });
  window.scrollTo({ top: 0 });
}
document.querySelectorAll('#mobileNav button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.go)));
$('notesJumpBtn').addEventListener('click', () => { if (matchMedia('(max-width:980px)').matches) showTab('notes'); else { $('notesPanel').scrollIntoView({ behavior: 'smooth', block: 'center' }); notesEl.focus(); } });
document.body.dataset.tab = 'video';

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
    if (state.lang) setLanguage(state.lang);
    if (typeof state.code === 'string' && !codeDirty) applyRemoteCode(state.code);
    if (typeof state.notes === 'string') {
      if (state.notes || !notesEl.value) applyRemoteNotes(state.notes);
      else pushNotes(); // the server room is new but this browser still has the saved notes: restore them
    }
    boardStrokes = Array.isArray(state.strokes) ? state.strokes : []; redrawStrokes();
    $('chatMessages').replaceChildren(); (state.chat || []).forEach(appendMessage);
    renderMembers(state.members || []); setSyncStatus('Live sync connected');
    if (codeDirty) sendCode(); // edits made while offline are pushed after rejoining
  });
  socket.on('room:members', renderMembers);
  socket.on('code:change', ({ code, by }) => {
    if (by === socket.id || typeof code !== 'string') return;
    if (codeDirty) return; // my own edit is about to be sent and will win; applying theirs now would erase what I just typed
    applyRemoteCode(code); setSyncStatus('Live sync connected');
  });
  socket.on('code:lang', ({ lang }) => setLanguage(lang));
  socket.on('notes:change', ({ text }) => { if (typeof text === 'string') applyRemoteNotes(text); });
  socket.on('whiteboard:stroke', stroke => { boardStrokes.push(stroke); if (boardStrokes.length > 1500) boardStrokes.shift(); drawStroke(stroke); });
  socket.on('whiteboard:clear', () => { boardStrokes = []; redrawStrokes(); });
  socket.on('chat:message', appendMessage);
}

// ---- LiveKit video, audio and screen share ----
const attachedAudio = new Set();
let sharing = false;
const isScreen = (source) => source === Track?.Source?.ScreenShare;
const tileKey = (identity, screen) => `${identity}:${screen ? 'screen' : 'cam'}`;
function tileFor(identity, name, isLocal = false, screen = false) {
  const key = tileKey(identity, screen);
  let tile = document.querySelector(`[data-key="${CSS.escape(key)}"]`);
  if (tile) return tile;
  $('videoPlaceholder')?.remove();
  tile = document.createElement('div'); tile.className = `video-tile${screen ? ' screen' : ''}`; tile.dataset.key = key; tile.dataset.identity = identity;
  const label = document.createElement('span'); label.className = 'person-label';
  label.textContent = `${name || 'Participant'}${isLocal ? ' · You' : ''}${screen ? ' · Screen' : ''}`;
  tile.appendChild(label);
  if (screen) $('videoGrid').prepend(tile); else $('videoGrid').appendChild(tile);
  return tile;
}
function attachVideoTrack(track, participant, isLocal = false, source) {
  const screen = isScreen(source);
  const tile = tileFor(participant.identity, participant.name || participant.identity, isLocal, screen);
  if (tile._track === track) return; // already showing this track
  tile.querySelector('video')?.remove();
  const video = track.attach(); video.autoplay = true; video.playsInline = true; video.muted = true; video.className = 'participant-video';
  tile._track = track; tile.prepend(video);
  video.play?.().catch(() => { });
}
function attachAudioTrack(track, participant) {
  const id = track.sid || track.mediaStreamTrack?.id;
  if (attachedAudio.has(id)) return; // one element per track, otherwise voices are doubled
  attachedAudio.add(id);
  const audio = track.attach(); audio.autoplay = true; audio.setAttribute('playsinline', ''); audio.dataset.track = id;
  $('audioDock').appendChild(audio);
  audio.play?.().catch(() => { $('mediaHint').textContent = 'Tap anywhere on the page to start the sound.'; });
}
function attachParticipantTracks(participant, isLocal = false) {
  participant.trackPublications?.forEach((publication) => {
    const track = publication.track;
    if (!track) return;
    if (track.kind === Track.Kind.Video) attachVideoTrack(track, participant, isLocal, publication.source);
    // never play your own microphone back to yourself (that is the echo)
    if (track.kind === Track.Kind.Audio && !isLocal) attachAudioTrack(track, participant);
  });
}
function addPlaceholderIfEmpty() {
  if ($('videoGrid').querySelector('.video-tile') || $('videoPlaceholder')) return;
  const placeholder = document.createElement('div'); placeholder.className = 'video-placeholder'; placeholder.id = 'videoPlaceholder';
  placeholder.innerHTML = '<span class="placeholder-icon">◉</span><b>Camera tiles appear here</b><small>Allow camera and microphone access when prompted.</small>';
  $('videoGrid').appendChild(placeholder);
}
function removeTile(identity, screen) {
  document.querySelector(`[data-key="${CSS.escape(tileKey(identity, screen))}"]`)?.remove(); addPlaceholderIfEmpty();
}
function removeParticipant(identity) {
  document.querySelectorAll(`[data-identity="${CSS.escape(identity)}"]`).forEach((el) => el.remove()); addPlaceholderIfEmpty();
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
      if (track.kind === Track.Kind.Video) attachVideoTrack(track, participant, false, publication.source);
      if (track.kind === Track.Kind.Audio) attachAudioTrack(track, participant);
    });
    liveRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
      track.detach().forEach((el) => el.remove());
      attachedAudio.delete(track.sid || track.mediaStreamTrack?.id);
      if (track.kind === Track.Kind.Video) removeTile(participant.identity, isScreen(publication.source));
    });
    liveRoom.on(RoomEvent.ParticipantDisconnected, (participant) => removeParticipant(participant.identity));
    liveRoom.on(RoomEvent.LocalTrackPublished, () => attachParticipantTracks(liveRoom.localParticipant, true));
    liveRoom.on(RoomEvent.LocalTrackUnpublished, (publication) => {
      publication.track?.detach().forEach((el) => el.remove());
      if (publication.track?.kind === Track.Kind.Video) removeTile(liveRoom.localParticipant.identity, isScreen(publication.source));
      if (isScreen(publication.source)) { sharing = false; updateMediaButtons(); } // the browser's own "Stop sharing" button ends up here too
    });
    liveRoom.on(RoomEvent.Disconnected, () => setVideoStatus('Disconnected from the video call. Refresh the page to rejoin.', true));
    await liveRoom.connect(payload.serverUrl, payload.token);
    for (const participant of liveRoom.remoteParticipants.values()) attachParticipantTracks(participant, false);
    try { await liveRoom.localParticipant.setMicrophoneEnabled(true); micOn = true; } catch { micOn = false; $('mediaHint').textContent = 'Microphone blocked. Allow it in the browser address bar and refresh.'; }
    try { await liveRoom.localParticipant.setCameraEnabled(true); cameraOn = true; }
    catch { cameraOn = false; $('mediaHint').textContent = 'Camera unavailable. You can still use audio, chat, board and code.'; }
    attachParticipantTracks(liveRoom.localParticipant, true);
    updateMediaButtons();
    setVideoStatus('Connected. Audio and video are ready.');
  } catch (error) {
    setVideoStatus(error.message || 'Video connection failed.', true);
    $('mediaHint').textContent = 'Video could not connect. Chat, code, board and notes still work.';
    toast(error.message || 'Could not connect to video. Collaboration tools may still work.');
  }
}
function updateMediaButtons() {
  $('micBtn').classList.toggle('off', !micOn); $('micBtn').setAttribute('aria-pressed', String(micOn));
  $('micBtn').querySelector('b').textContent = micOn ? 'Mute mic' : 'Unmute mic';
  $('cameraBtn').classList.toggle('off', !cameraOn); $('cameraBtn').setAttribute('aria-pressed', String(cameraOn));
  $('cameraBtn').querySelector('b').textContent = cameraOn ? 'Camera off' : 'Camera on';
  document.querySelectorAll('.share-btn').forEach((btn) => {
    btn.classList.toggle('live', sharing); btn.setAttribute('aria-pressed', String(sharing));
    const label = btn.querySelector('b') || btn; label.textContent = sharing ? 'Stop sharing' : 'Share screen';
  });
}
$('micBtn').addEventListener('click', async () => {
  if (!liveRoom) return toast('Video service is not connected yet.');
  try { micOn = !micOn; await liveRoom.localParticipant.setMicrophoneEnabled(micOn); updateMediaButtons(); }
  catch (error) { micOn = !micOn; updateMediaButtons(); toast(error.message || 'Could not change microphone.'); }
});
$('cameraBtn').addEventListener('click', async () => {
  if (!liveRoom) return toast('Video service is not connected yet.');
  try { cameraOn = !cameraOn; await liveRoom.localParticipant.setCameraEnabled(cameraOn); if (cameraOn) attachParticipantTracks(liveRoom.localParticipant, true); else removeTile(liveRoom.localParticipant.identity, false); updateMediaButtons(); }
  catch (error) { cameraOn = !cameraOn; updateMediaButtons(); toast(error.message || 'Could not change camera.'); }
});
async function toggleScreenShare() {
  if (!liveRoom) return toast('Video service is not connected yet.');
  if (!navigator.mediaDevices?.getDisplayMedia) return toast('This browser cannot share the screen. On phones, use a desktop browser to share.');
  const next = !sharing;
  try {
    await liveRoom.localParticipant.setScreenShareEnabled(next, next ? { audio: true } : undefined);
    sharing = next; updateMediaButtons();
    if (next) toast('You are sharing your screen. Everyone in the room can see it.');
  } catch (error) {
    sharing = false; updateMediaButtons();
    toast(error?.name === 'NotAllowedError' ? 'Screen sharing was cancelled.' : (error.message || 'Could not share the screen.'));
  }
}
$('shareScreenBtn').addEventListener('click', toggleScreenShare);
$('notesShareBtn').addEventListener('click', toggleScreenShare);
if (!navigator.mediaDevices?.getDisplayMedia) document.querySelectorAll('.share-btn').forEach((btn) => { btn.hidden = true; }); // phones: not supported by the browser
// Browsers block sound until the first tap: start any audio that was held back.
document.addEventListener('pointerdown', () => $('audioDock').querySelectorAll('audio').forEach((a) => a.paused && a.play().catch(() => { })), { passive: true });

$('shareBtn').addEventListener('click', async () => {
  const invite = new URL(location.href); invite.searchParams.set('room', roomCode); invite.searchParams.delete('name'); invite.searchParams.delete('role'); ['ref', 'peer', 'pn', 'sid'].forEach((k) => invite.searchParams.delete(k)); if (API_BASE !== location.origin) invite.searchParams.set('api', API_BASE);
  try { await navigator.clipboard.writeText(invite.toString()); toast('Invite link copied. Send it only to the intended participants.'); }
  catch { window.prompt('Copy this room invite link:', invite.toString()); }
});
$('leaveBtn').addEventListener('click', async () => {
  if (!confirm(params.get('ref') ? 'Leave this virtual classroom? You will be asked to review the session.' : 'Leave this virtual classroom?')) return;
  try { socket?.disconnect(); await liveRoom?.disconnect(); } catch { }
  const back = role === 'tutor' ? 'tutor/app.html' : role === 'student' ? 'student/app.html' : 'index.html';
  // Both sides land on their dashboard with a review window (stars + comment) for the other person.
  // A student who leaves their own lesson also gets the optional quiz offer (shown after the review window is closed).
  const ref = params.get('ref'), q = [];
  if (ref && back !== 'index.html') q.push(`review=1&ref=${encodeURIComponent(ref)}&peer=${encodeURIComponent(params.get('peer') || '')}&pn=${encodeURIComponent(params.get('pn') || '')}`);
  if (role === 'student' && lessonId) q.push(`quiz=${encodeURIComponent(lessonId)}`);
  location.href = q.length ? `${back}?${q.join('&')}` : back;
});
window.addEventListener('beforeunload', () => { if (notesTimer) pushNotes(); socket?.disconnect(); liveRoom?.disconnect(); });

connectCollaboration();
connectVideo();
