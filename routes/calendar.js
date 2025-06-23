const express = require('express');
const router = express.Router();
const Database = require('../database/db');

const db = Database.getInstance().getDatabase();

// Get all calendar events
router.get('/', (req, res) => {
  const { start, end } = req.query;
  
  let query = `
    SELECT ce.*, a.title as activity_title, a.category, a.location, a.duration, c.color as category_color
    FROM calendar_events ce
    LEFT JOIN activities a ON ce.activity_id = a.id
    LEFT JOIN categories c ON a.category = c.name
  `;
  
  let params = [];
  
  if (start && end) {
    query += ` WHERE ce.start_date >= ? AND ce.end_date <= ?`;
    params = [start, end];
  }
  
  query += ` ORDER BY ce.start_date ASC`;
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get calendar event by ID
router.get('/:id', (req, res) => {
  const query = `
    SELECT ce.*, a.title as activity_title, a.category, a.location, a.duration, c.color as category_color
    FROM calendar_events ce
    LEFT JOIN activities a ON ce.activity_id = a.id
    LEFT JOIN categories c ON a.category = c.name
    WHERE ce.id = ?
  `;
  
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Calendar event not found' });
      return;
    }
    res.json(row);
  });
});

// Create new calendar event
router.post('/', (req, res) => {
  const {
    activity_id,
    title,
    start_date,
    end_date,
    notes
  } = req.body;

  if (!title || !start_date || !end_date) {
    res.status(400).json({ error: 'Title, start_date, and end_date are required' });
    return;
  }

  const query = `
    INSERT INTO calendar_events 
    (activity_id, title, start_date, end_date, notes, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;

  const params = [
    activity_id || null,
    title,
    start_date,
    end_date,
    notes || null
  ];

  db.run(query, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Return the created event with activity details
    const selectQuery = `
      SELECT ce.*, a.title as activity_title, a.category, a.location, a.duration, c.color as category_color
      FROM calendar_events ce
      LEFT JOIN activities a ON ce.activity_id = a.id
      LEFT JOIN categories c ON a.category = c.name
      WHERE ce.id = ?
    `;
    
    db.get(selectQuery, [this.lastID], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(201).json(row);
    });
  });
});

// Update calendar event
router.put('/:id', (req, res) => {
  const {
    activity_id,
    title,
    start_date,
    end_date,
    notes,
    completed
  } = req.body;

  const query = `
    UPDATE calendar_events SET
    activity_id = ?, title = ?, start_date = ?, end_date = ?, 
    notes = ?, completed = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  const params = [
    activity_id,
    title,
    start_date,
    end_date,
    notes,
    completed || false,
    req.params.id
  ];

  db.run(query, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Calendar event not found' });
      return;
    }
    
    // Return the updated event with activity details
    const selectQuery = `
      SELECT ce.*, a.title as activity_title, a.category, a.location, a.duration, c.color as category_color
      FROM calendar_events ce
      LEFT JOIN activities a ON ce.activity_id = a.id
      LEFT JOIN categories c ON a.category = c.name
      WHERE ce.id = ?
    `;
    
    db.get(selectQuery, [req.params.id], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(row);
    });
  });
});

// Delete calendar event
router.delete('/:id', (req, res) => {
  db.run('DELETE FROM calendar_events WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Calendar event not found' });
      return;
    }
    
    res.json({ message: 'Calendar event deleted successfully' });
  });
});

// Mark event as completed
router.patch('/:id/complete', (req, res) => {
  const { completed } = req.body;
  
  db.run(
    'UPDATE calendar_events SET completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [completed, req.params.id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ error: 'Calendar event not found' });
        return;
      }
      
      res.json({ message: 'Event completion status updated' });
    }
  );
});

module.exports = router;
