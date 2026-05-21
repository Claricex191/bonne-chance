const express = require('express');
const { db } = require('../db/database');

const router = express.Router();

// GET /api/applications
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM applications ORDER BY created_at DESC').all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/applications
router.post('/', (req, res) => {
  try {
    const { company, role, job_id, url, status, source, notes, applied_at } = req.body;

    if (!company?.trim()) {
      return res.status(400).json({ error: 'company is required' });
    }

    const result = db.prepare(`
      INSERT INTO applications (company, role, job_id, url, status, source, notes, applied_at)
      VALUES (@company, @role, @job_id, @url, @status, @source, @notes, @applied_at)
    `).run({
      company:    company.trim(),
      role:       (role     || '').trim(),
      job_id:     (job_id   || '').trim(),
      url:        (url      || '').trim(),
      status:     status    || 'applied',
      source:     (source   || '').trim(),
      notes:      (notes    || '').trim(),
      applied_at: applied_at || new Date().toISOString().split('T')[0],
    });

    const created = db.prepare('SELECT * FROM applications WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/applications/:id
router.patch('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { company, role, job_id, url, status, source, notes, applied_at } = req.body;

    db.prepare(`
      UPDATE applications
      SET company    = @company,
          role       = @role,
          job_id     = @job_id,
          url        = @url,
          status     = @status,
          source     = @source,
          notes      = @notes,
          applied_at = @applied_at,
          updated_at = datetime('now')
      WHERE id = @id
    `).run({
      id:         existing.id,
      company:    (company    ?? existing.company).trim(),
      role:       (role       ?? existing.role).trim(),
      job_id:     (job_id     ?? existing.job_id).trim(),
      url:        (url        ?? existing.url).trim(),
      status:     status      ?? existing.status,
      source:     (source     ?? existing.source).trim(),
      notes:      (notes      ?? existing.notes).trim(),
      applied_at: applied_at  ?? existing.applied_at,
    });

    res.json(db.prepare('SELECT * FROM applications WHERE id = ?').get(existing.id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/applications/:id
router.delete('/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM applications WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    db.prepare('DELETE FROM applications WHERE id = ?').run(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/applications/stats
router.get('/stats', (req, res) => {
  try {
    const funnel = db.prepare(`
      SELECT
        COUNT(*)                                                        AS total,
        SUM(CASE WHEN status = 'applied'                    THEN 1 END) AS applied,
        SUM(CASE WHEN status IN ('submitted','interviewed','offer') THEN 1 END) AS submitted,
        SUM(CASE WHEN status IN ('interviewed','offer')     THEN 1 END) AS interviewed,
        SUM(CASE WHEN status = 'offer'                      THEN 1 END) AS offer,
        SUM(CASE WHEN status = 'rejected'                   THEN 1 END) AS rejected
      FROM applications
    `).get();

    res.json({ funnel });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;