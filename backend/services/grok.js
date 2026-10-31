// Grok (xAI) client. The API key stays on the server (XAI_API_KEY in .env): the browser never sees it.
// xAI's API is OpenAI-compatible: POST {base}/chat/completions with a Bearer key.
import { AppError } from '../lib/errors.js';

const base = () => (process.env.XAI_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, '');
export const grokModel = () => process.env.GROK_MODEL || 'grok-4';
export const grokReady = () => Boolean(process.env.XAI_API_KEY);

// Pulls a JSON object out of a model answer even if it came wrapped in ``` fences or with a sentence around it.
export function extractJson(text) {
  const s = String(text || '').trim();
  try { return JSON.parse(s); } catch { /* try harder */ }
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch { /* fall through */ } }
  return null;
}

// Asks Grok for a JSON answer. `system` = rules, `user` = the data. Returns the parsed object.
export async function grokJson({ system, user, maxTokens = 4000, timeoutMs = 60_000 }) {
  if (!grokReady()) {
    throw new AppError(503, 'AI_NOT_CONFIGURED', 'The AI is not set up on the server yet (XAI_API_KEY is missing in backend/.env).');
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(`${base()}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.XAI_API_KEY}` },
      body: JSON.stringify({
        model: grokModel(),
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        temperature: 0.4,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
    });
  } catch (err) {
    throw new AppError(502, 'AI_UNREACHABLE', err.name === 'AbortError' ? 'The AI took too long to answer. Please try again.' : 'Could not reach the AI service. Please try again.');
  } finally { clearTimeout(timer); }

  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    console.error(`Grok error ${res.status}: ${detail}`);                      // details stay in the server log
    if (res.status === 401 || res.status === 403) throw new AppError(502, 'AI_KEY_REJECTED', 'The AI key was rejected. Check XAI_API_KEY in backend/.env.');
    if (res.status === 404) throw new AppError(502, 'AI_MODEL_NOT_FOUND', `The AI model "${grokModel()}" was not found. Set GROK_MODEL in backend/.env.`);
    if (res.status === 429) throw new AppError(502, 'AI_BUSY', 'The AI is busy or out of quota. Please try again in a minute.');
    throw new AppError(502, 'AI_ERROR', 'The AI service returned an error. Please try again.');
  }
  const data = await res.json().catch(() => null);
  const out = extractJson(data?.choices?.[0]?.message?.content);
  if (!out || typeof out !== 'object') throw new AppError(502, 'AI_BAD_OUTPUT', 'The AI sent an answer we could not read. Please try again.');
  return out;
}
