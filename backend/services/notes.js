import PDFDocument from 'pdfkit';
import { query } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import * as sessions from './sessions.js';

export const MAX_IMAGES = 8;
export const MAX_IMAGE_CHARS = 1_400_000; // about 1 MB of picture after base64
const IMG_RE = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/;

export function checkImages(images) {
  if (!Array.isArray(images) || images.length > MAX_IMAGES) throw new AppError(400, 'TOO_MANY_IMAGES', `at most ${MAX_IMAGES} pictures`);
  for (const im of images) {
    if (typeof im !== 'string' || im.length > MAX_IMAGE_CHARS || !IMG_RE.test(im)) {
      throw new AppError(400, 'BAD_IMAGE', 'pictures must be small JPEG or PNG files');
    }
  }
}

// The tutor's own notes while the lesson is open.
export async function getForTutor(sessionId, userId) {
  const s = await sessions.getForUser(sessionId, userId);
  if (s.mentor_id !== userId) throw new AppError(403, 'TUTOR_ONLY');
  const { rows } = await query('SELECT body, images, updated_at FROM lesson_notes WHERE session_id = $1', [sessionId]);
  return rows[0] || { body: '', images: [], updated_at: null };
}

export async function save(sessionId, userId, { body, images }) {
  const s = await sessions.getForUser(sessionId, userId);
  if (s.mentor_id !== userId) throw new AppError(403, 'TUTOR_ONLY');
  if (!['accepted', 'in_progress'].includes(s.status)) throw new AppError(409, 'NOTES_LOCKED', 'notes are locked once the lesson has ended');
  checkImages(images);
  await query(
    `INSERT INTO lesson_notes (session_id, body, images, updated_at) VALUES ($1,$2,$3::jsonb, now())
     ON CONFLICT (session_id) DO UPDATE SET body = EXCLUDED.body, images = EXCLUDED.images, updated_at = now()`,
    [sessionId, body, JSON.stringify(images)]
  );
  return { saved: true };
}

// The built-in PDF font only knows Western letters; anything else would print as garbage, so show "?" instead.
const clean = (t) => String(t ?? '').replace(/\u20B9/g, 'Rs ').replace(/[^\t\n\r\x20-\x7E\xA0-\xFF‘’“”–—•…€]/g, '?');

function render({ title, tutor, student, when, problem, body, images }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: clean(title), Author: 'UpToSkill' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fillColor('#1D4ED8').font('Helvetica-Bold').fontSize(11).text('UpToSkill  -  lesson notes');
    doc.moveDown(0.4).fillColor('#0F1B3D').fontSize(20).text(clean(title));
    doc.moveDown(0.3).font('Helvetica').fontSize(10).fillColor('#55627F')
      .text(`Tutor: ${clean(tutor)}    Student: ${clean(student)}    ${when}`);
    doc.moveDown(0.8);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#DDE6F7').stroke().moveDown(0.8);

    doc.font('Helvetica-Bold').fontSize(12).fillColor('#0F1B3D').text('The question');
    doc.font('Helvetica').fontSize(11).fillColor('#222').text(clean(problem), { lineGap: 2 });
    doc.moveDown(1);

    if (body.trim()) {
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0F1B3D').text('Notes from your tutor');
      doc.moveDown(0.3).font('Helvetica').fontSize(11).fillColor('#222').text(clean(body), { lineGap: 3 });
      doc.moveDown(1);
    }
    if (images.length) {
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#0F1B3D').text('Screenshots');
      doc.moveDown(0.4);
      for (const im of images) {
        try {
          const buf = Buffer.from(im.split(',')[1], 'base64');
          const img = doc.openImage(buf);
          const w = Math.min(495, img.width), h = img.height * (w / img.width);
          const maxH = 640;
          const fit = h > maxH ? maxH / h : 1;
          if (doc.y + h * fit > 790) doc.addPage();
          doc.image(buf, 50, doc.y, { width: w * fit });
          doc.y += h * fit + 14;
          doc.x = 50;
        } catch { /* a damaged picture is skipped, the rest of the notes still go out */ }
      }
    }
    doc.end();
  });
}

// Called when the lesson ends: builds the PDF from what the tutor wrote. Skipped when nothing was written.
export async function finalize(sessionId) {
  const { rows } = await query(
    `SELECT n.body, n.images, s.title, s.problem_text, s.ended_at, t.name AS tutor, l.name AS student
       FROM lesson_notes n JOIN sessions s ON s.id = n.session_id
       JOIN users t ON t.id = s.mentor_id JOIN users l ON l.id = s.learner_id
      WHERE n.session_id = $1`, [sessionId]);
  const r = rows[0];
  if (!r || (!r.body.trim() && !r.images.length)) return false;
  const pdf = await render({
    title: r.title, tutor: r.tutor, student: r.student, problem: r.problem_text, body: r.body, images: r.images,
    when: new Date(r.ended_at || Date.now()).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }) + ' IST',
  });
  await query('UPDATE lesson_notes SET pdf = $2, pdf_at = now() WHERE session_id = $1', [sessionId, pdf]);
  return true;
}

// Either person of a finished lesson may download it.
export async function getPdf(sessionId, userId) {
  const s = await sessions.getForUser(sessionId, userId);
  if (s.status !== 'completed') throw new AppError(409, 'LESSON_NOT_FINISHED', 'notes PDF is ready when the lesson ends');
  let { rows } = await query('SELECT pdf FROM lesson_notes WHERE session_id = $1', [sessionId]);
  if (rows[0] && !rows[0].pdf) { // lesson ended before this feature built it, or the build failed: try again now
    await finalize(sessionId).catch((e) => console.error('notes pdf failed', e));
    ({ rows } = await query('SELECT pdf FROM lesson_notes WHERE session_id = $1', [sessionId]));
  }
  if (!rows[0]?.pdf) throw new AppError(404, 'NO_NOTES', 'the tutor did not write any notes for this lesson');
  return rows[0].pdf;
}
