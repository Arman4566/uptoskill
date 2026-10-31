// Quiz after a lesson, AI weak-topic analysis, AI report for the tutor, and the tutor's short remedial videos.
//   Student:  GET  /quiz/:id             open quiz (to resume) or its result
//             POST /quiz/start            make (or resume) the quiz for a finished lesson
//             POST /quiz/:id/submit       send answers -> score, credits, explanations (+ AI analysis if the score is low)
//             POST /quiz/:id/analyze      retry the AI analysis if it failed the first time
//             GET  /quiz/mine             my quizzes + the videos my tutors sent me
//             GET  /quiz/video/:id        play a video
//   Tutor:    GET  /quiz/tutor/reports    AI reports about my students (and the videos I sent)
//             GET  /quiz/tutor/summary    unread count (for the sidebar badge)
//             POST /quiz/tutor/reports/:id/read
//             PUT  /quiz/tutor/reports/:id/video?topic=..&note=..   upload a short video (raw bytes)
import express, { Router } from 'express';
import { z } from 'zod';
import { query, withTx } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { ah } from '../lib/async.js';
import { requireAuth } from '../middleware/auth.js';
import * as ledger from '../services/ledger.js';
import { aiReady } from '../services/ai.js';
import { quizConfig, clean, generateQuestions, publicQuestions, grade, analyse } from '../services/quiz.js';

const router = Router();
router.use(requireAuth);

const idParam = z.coerce.number().int().positive();
const MAX_VIDEO = Number(process.env.QUIZ_VIDEO_MAX_MB || 60) * 1024 * 1024;
const MAX_VIDEOS_PER_REPORT = 5;

const startSchema = z.object({
  sessionRef: z.string().trim().min(1).max(80),
  topic: z.string().trim().min(2).max(120),
  title: z.string().trim().max(200).optional().default(''),
  tutorEmail: z.string().trim().toLowerCase().email().max(200).optional(),
});

// What the student may see of a quiz that was already submitted.
function resultView(q) {
  return {
    id: q.id, topic: q.topic, status: q.status, score: q.score, total: q.total, pct: q.total ? Math.round((q.score / q.total) * 100) : 0,
    passed: q.total ? Math.round((q.score / q.total) * 100) >= quizConfig.passPct : false,
    creditsEarned: q.credits_awarded, review: q.review || [], analysis: q.analysis || null,
    analysisPending: Boolean(q.total && Math.round((q.score / q.total) * 100) < quizConfig.passPct && !q.analysis),
    reportSent: Boolean(q.report_sent),
  };
}

const studentQuiz = async (id, userId) => {
  const { rows } = await query(
    `SELECT q.*, EXISTS(SELECT 1 FROM student_reports r WHERE r.quiz_id = q.id) AS report_sent
       FROM quizzes q WHERE q.id = $1 AND q.student_id = $2`, [id, userId]);
  if (!rows.length) throw new AppError(404, 'QUIZ_NOT_FOUND', 'Quiz not found.');
  return rows[0];
};

router.get('/config', ah(async (req, res) => {
  res.json({ aiReady: aiReady(), questions: quizConfig.questions, passPct: quizConfig.passPct, perfectPct: quizConfig.perfectPct,
    rewardPass: quizConfig.rewardPass, rewardPerfect: quizConfig.rewardPerfect });
}));

/* ------------------------------ student ------------------------------ */

router.post('/start', ah(async (req, res) => {
  const body = startSchema.parse(req.body);
  const existing = await query('SELECT * FROM quizzes WHERE student_id = $1 AND session_ref = $2', [req.userId, body.sessionRef]);
  if (existing.rows.length) {
    const q = existing.rows[0];
    if (q.status === 'graded') return res.json({ done: true, result: resultView(await studentQuiz(q.id, req.userId)) });
    return res.json({ done: false, id: q.id, topic: q.topic, questions: publicQuestions(q.questions) });     // resume the open quiz
  }
  const { rows: today } = await query(`SELECT COUNT(*)::int AS n FROM quizzes WHERE student_id = $1 AND created_at > now() - interval '24 hours'`, [req.userId]);
  if (today[0].n >= quizConfig.dailyLimit) throw new AppError(429, 'QUIZ_LIMIT', `You can start at most ${quizConfig.dailyLimit} quizzes a day. Try again tomorrow.`);

  const topic = clean(body.topic), title = clean(body.title, 200);
  const { rows: me } = await query('SELECT level FROM users WHERE id = $1', [req.userId]);
  const questions = await generateQuestions({ topic, title, level: me[0]?.level });          // AI call (throws a readable error if not set up)
  let tutorId = null;
  if (body.tutorEmail) {
    const t = await query('SELECT id FROM users WHERE email = $1 AND id <> $2', [body.tutorEmail, req.userId]);
    tutorId = t.rows[0]?.id ?? null;
  }
  const ins = await query(
    `INSERT INTO quizzes (student_id, tutor_id, session_ref, topic, session_title, questions) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (student_id, session_ref) DO NOTHING RETURNING id, questions`,
    [req.userId, tutorId, body.sessionRef, topic, title, JSON.stringify(questions)]);
  if (!ins.rows.length) {                                                                     // a double click created it first
    const again = await query('SELECT id, questions FROM quizzes WHERE student_id = $1 AND session_ref = $2', [req.userId, body.sessionRef]);
    return res.json({ done: false, id: again.rows[0].id, topic, questions: publicQuestions(again.rows[0].questions) });
  }
  res.status(201).json({ done: false, id: ins.rows[0].id, topic, questions: publicQuestions(ins.rows[0].questions) });
}));

// Builds the AI analysis + the tutor's report for a graded, low-scoring quiz. Safe to call again: it does nothing if already done.
async function runAnalysis(quizId, userId) {
  const q = await studentQuiz(quizId, userId);
  if (q.status !== 'graded') throw new AppError(409, 'NOT_SUBMITTED', 'Submit the quiz first.');
  if (q.analysis) return q;
  const result = grade(q.questions, q.answers || []);
  if (result.passed) return q;
  const { rows: who } = await query('SELECT name FROM users WHERE id = $1', [userId]);
  const { rows: past } = await query(
    `SELECT topic, score, total, analysis FROM quizzes WHERE student_id = $1 AND status = 'graded' AND id <> $2 ORDER BY graded_at DESC LIMIT 8`, [userId, quizId]);
  const history = past.map((p) => ({ lessonTopic: p.topic, score: `${p.score}/${p.total}`, weakTopics: (p.analysis?.weakTopics || []).map((w) => w.topic) }));
  const out = await analyse({ studentName: clean(who[0]?.name, 60), topic: q.topic, result, history });

  await withTx(async (c) => {
    // The first writer wins; a second request in parallel changes nothing.
    const upd = await c.query('UPDATE quizzes SET analysis = $2 WHERE id = $1 AND analysis IS NULL RETURNING id', [quizId, JSON.stringify(out.forStudent)]);
    if (!upd.rowCount || !q.tutor_id) return;
    const report = { ...out.forTutor, quizTopic: q.topic, score: q.score, total: q.total, history: [...history].slice(0, 6) };
    await c.query('INSERT INTO student_reports (student_id, tutor_id, quiz_id, data) VALUES ($1,$2,$3,$4) ON CONFLICT (quiz_id) DO NOTHING',
      [userId, q.tutor_id, quizId, JSON.stringify(report)]);
  });
  return studentQuiz(quizId, userId);
}

router.post('/:id/submit', ah(async (req, res) => {
  const id = idParam.parse(req.params.id);
  const { answers } = z.object({ answers: z.array(z.number().int().min(-1).max(3)).min(1).max(20) }).parse(req.body);
  const q = await studentQuiz(id, req.userId);
  if (q.status === 'graded') return res.json(resultView(q));
  if (answers.length !== q.questions.length) throw new AppError(400, 'VALIDATION', 'Answer every question (or leave it blank).');

  const g = grade(q.questions, answers);
  // Claim the quiz and pay in ONE transaction: a second submit finds it already graded and pays nothing.
  const claimed = await withTx(async (c) => {
    const upd = await c.query(
      `UPDATE quizzes SET status = 'graded', answers = $2, score = $3, total = $4, credits_awarded = $5, review = $6, graded_at = now()
        WHERE id = $1 AND student_id = $7 AND status = 'open' RETURNING id`,
      [id, JSON.stringify(answers), g.score, g.total, g.credits, JSON.stringify(g.review), req.userId]);
    if (!upd.rowCount) return false;
    if (g.credits > 0) await ledger.credit(c, { userId: req.userId, amount: g.credits, reason: 'quiz_reward', refType: 'quiz', refId: id });
    return true;
  });
  if (!claimed) return res.json(resultView(await studentQuiz(id, req.userId)));

  let view = resultView(await studentQuiz(id, req.userId));
  if (!g.passed) {
    try { view = resultView(await runAnalysis(id, req.userId)); }
    catch (err) { console.error('quiz analysis failed:', err.code || err.message); view.analysisError = err.message; }   // score and credits are already saved; the app offers "Try again"
  }
  res.json(view);
}));

router.post('/:id/analyze', ah(async (req, res) => {
  res.json(resultView(await runAnalysis(idParam.parse(req.params.id), req.userId)));
}));

router.get('/mine', ah(async (req, res) => {
  const { rows: quizzes } = await query(
    `SELECT id, topic, session_title, status, score, total, credits_awarded, created_at, graded_at, analysis
       FROM quizzes WHERE student_id = $1 ORDER BY created_at DESC LIMIT 100`, [req.userId]);
  const { rows: videos } = await query(
    `SELECT v.id, v.topic, v.note, v.created_at, u.name AS tutor_name FROM remedial_videos v JOIN users u ON u.id = v.tutor_id
      WHERE v.student_id = $1 ORDER BY v.created_at DESC LIMIT 50`, [req.userId]);
  res.json({
    quizzes: quizzes.map((x) => ({ ...x, weakTopics: (x.analysis?.weakTopics || []).map((w) => w.topic), analysis: undefined })),
    videos,
  });
}));

router.get('/video/:id', ah(async (req, res) => {
  const { rows } = await query('SELECT mime, data FROM remedial_videos WHERE id = $1 AND (student_id = $2 OR tutor_id = $2)', [idParam.parse(req.params.id), req.userId]);
  if (!rows.length) throw new AppError(404, 'NO_VIDEO', 'Video not found.');
  res.set('Content-Type', rows[0].mime).set('Cache-Control', 'private, max-age=300').send(rows[0].data);
}));

/* ------------------------------ tutor ------------------------------ */

router.get('/tutor/summary', ah(async (req, res) => {
  const { rows } = await query('SELECT COUNT(*)::int AS unread FROM student_reports WHERE tutor_id = $1 AND read_at IS NULL', [req.userId]);
  res.json({ unread: rows[0].unread });
}));

router.get('/tutor/reports', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT r.id, r.data, r.created_at, r.read_at, u.id AS student_id, u.name AS student_name, u.email AS student_email
       FROM student_reports r JOIN users u ON u.id = r.student_id WHERE r.tutor_id = $1 ORDER BY r.created_at DESC LIMIT 100`, [req.userId]);
  const { rows: vids } = await query(
    `SELECT id, report_id, topic, note, created_at FROM remedial_videos WHERE tutor_id = $1 AND report_id = ANY($2::int[]) ORDER BY created_at`,
    [req.userId, rows.map((r) => r.id)]);
  // How often each topic was missed by this student across ALL their graded quizzes (counted here, not by the AI).
  const { rows: allQ } = await query(
    `SELECT student_id, analysis FROM quizzes WHERE status = 'graded' AND analysis IS NOT NULL AND student_id = ANY($1::int[])`, [[...new Set(rows.map((r) => r.student_id))]]);
  const freq = {};
  for (const x of allQ) for (const w of x.analysis?.weakTopics || []) {
    const k = String(w.topic).toLowerCase();
    ((freq[x.student_id] ||= {})[k] ||= { topic: w.topic, count: 0 }).count++;
  }
  res.json({
    reports: rows.map((r) => ({
      id: r.id, studentName: r.student_name, studentEmail: r.student_email, createdAt: r.created_at, read: Boolean(r.read_at), report: r.data,
      videos: vids.filter((v) => v.report_id === r.id),
      studentWeakTopics: Object.values(freq[r.student_id] || {}).sort((a, b) => b.count - a.count).slice(0, 6),
    })),
  });
}));

router.post('/tutor/reports/:id/read', ah(async (req, res) => {
  await query('UPDATE student_reports SET read_at = now() WHERE id = $1 AND tutor_id = $2 AND read_at IS NULL', [idParam.parse(req.params.id), req.userId]);
  res.json({ ok: true });
}));

router.put('/tutor/reports/:id/video', express.raw({ type: () => true, limit: MAX_VIDEO }), ah(async (req, res) => {
  const id = idParam.parse(req.params.id);
  const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (!/^video\/[\w.+-]+$/.test(mime)) throw new AppError(400, 'VALIDATION', 'Send a video file.');
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw new AppError(400, 'VALIDATION', 'The video is empty.');
  const { rows } = await query('SELECT student_id FROM student_reports WHERE id = $1 AND tutor_id = $2', [id, req.userId]);
  if (!rows.length) throw new AppError(404, 'REPORT_NOT_FOUND', 'Report not found.');
  const { rows: n } = await query('SELECT COUNT(*)::int AS n FROM remedial_videos WHERE report_id = $1', [id]);
  if (n[0].n >= MAX_VIDEOS_PER_REPORT) throw new AppError(400, 'TOO_MANY_VIDEOS', `At most ${MAX_VIDEOS_PER_REPORT} videos per report.`);
  const topic = clean(req.query.topic, 80) || 'Extra help', note = clean(req.query.note, 300);
  const ins = await query(
    'INSERT INTO remedial_videos (report_id, tutor_id, student_id, topic, note, mime, data) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [id, req.userId, rows[0].student_id, topic, note, mime, req.body]);
  res.status(201).json({ id: ins.rows[0].id });
}));

// One quiz: the open questions (to resume) or the finished result. Keep this LAST so it does not swallow /mine, /config ...
router.get('/:id', ah(async (req, res) => {
  const q = await studentQuiz(idParam.parse(req.params.id), req.userId);
  if (q.status === 'graded') return res.json(resultView(q));
  res.json({ id: q.id, topic: q.topic, questions: publicQuestions(q.questions) });
}));

export default router;
