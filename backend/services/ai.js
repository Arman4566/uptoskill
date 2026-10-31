// Gemini (Google) client. The API key stays on the server (GEMINI_API_KEY in .env): the browser never sees it.
// Replaces the old Grok/xAI client. Same idea: ask for a JSON answer, get back a parsed object.
import { AppError } from '../lib/errors.js';

const base = () => (process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
const apiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
export const aiModel = () => process.env.GEMINI_MODEL || 'gemini-2.5-flash';
export const aiReady = () => Boolean(apiKey());

// Pulls a JSON value out of a model answer even if it came wrapped in ``` fences or with a sentence around it.
export function extractJson(text) {
  const s = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(s); } catch { /* try harder */ }
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* fall through */ } }
  return null;
}

// Asks Gemini for a JSON answer. `system` = rules, `user` = the data. Returns the parsed object.
export async function aiJson({ system, user, maxTokens = 8192, timeoutMs = 60_000, temperature = 0.4 }) {
  if (!aiReady()) {
    throw new AppError(503, 'AI_NOT_CONFIGURED', 'The AI is not set up on the server yet (GEMINI_API_KEY is missing in backend/.env).');
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${base()}/models/${encodeURIComponent(aiModel())}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey() },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
      }),
    });
  } catch (err) {
    throw new AppError(502, 'AI_UNREACHABLE', err.name === 'AbortError' ? 'The AI took too long to answer. Please try again.' : 'Could not reach the AI service. Please try again.');
  } finally { clearTimeout(timer); }

  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    console.error(`Gemini error ${res.status}: ${detail}`);                   // details stay in the server log
    if (res.status === 400 && /API key/i.test(detail)) throw new AppError(502, 'AI_KEY_REJECTED', 'The AI key was rejected. Check GEMINI_API_KEY in backend/.env.');
    if (res.status === 401 || res.status === 403) throw new AppError(502, 'AI_KEY_REJECTED', 'The AI key was rejected. Check GEMINI_API_KEY in backend/.env.');
    if (res.status === 404) throw new AppError(502, 'AI_MODEL_NOT_FOUND', `The AI model "${aiModel()}" was not found. Set GEMINI_MODEL in backend/.env.`);
    if (res.status === 429) throw new AppError(502, 'AI_BUSY', 'The AI is busy or out of quota. Please try again in a minute.');
    throw new AppError(502, 'AI_ERROR', 'The AI service returned an error. Please try again.');
  }
  const data = await res.json().catch(() => null);
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  const out = extractJson(text);
  if (!out || typeof out !== 'object') throw new AppError(502, 'AI_BAD_OUTPUT', 'The AI sent an answer we could not read. Please try again.');
  return out;
}
