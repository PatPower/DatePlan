const express = require('express');
const router = express.Router();
const Database = require('../database/db');

const db = Database.getInstance().getDatabase();

// Get all activities
router.get('/', (req, res) => {
  const query = `
    SELECT a.*, c.color as category_color 
    FROM activities a 
    LEFT JOIN categories c ON a.category = c.name 
    ORDER BY a.created_at DESC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get activity by ID
router.get('/:id', (req, res) => {
  const query = `
    SELECT a.*, c.color as category_color 
    FROM activities a 
    LEFT JOIN categories c ON a.category = c.name 
    WHERE a.id = ?
  `;
  
  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }
    res.json(row);
  });
});

// Create new activity
router.post('/', (req, res) => {
  const {
    title,
    description,
    category,
    location,
    duration,
    url,
    image_url,
    estimated_cost,
    excitement
  } = req.body;

  if (!title) {
    res.status(400).json({ error: 'Title is required' });
    return;
  }

  const query = `
    INSERT INTO activities 
    (title, description, category, location, duration, url, image_url, estimated_cost, excitement, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `;

  const params = [
    title,
    description || null,
    category || 'general',
    location || null,
    duration || 60,
    url || null,
    image_url || null,
    estimated_cost || 0,
    excitement || 5
  ];

  db.run(query, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    // Return the created activity
    db.get('SELECT * FROM activities WHERE id = ?', [this.lastID], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.status(201).json(row);
    });
  });
});

// Update activity
router.put('/:id', (req, res) => {
  const {
    title,
    description,
    category,
    location,
    duration,
    url,
    image_url,
    estimated_cost,
    excitement
  } = req.body;

  const query = `
    UPDATE activities SET
    title = ?, description = ?, category = ?, location = ?, 
    duration = ?, url = ?, image_url = ?, estimated_cost = ?, 
    excitement = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  const params = [
    title,
    description,
    category,
    location,
    duration,
    url,
    image_url,
    estimated_cost,
    excitement,
    req.params.id
  ];

  db.run(query, params, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }
    
    // Return the updated activity
    db.get('SELECT * FROM activities WHERE id = ?', [req.params.id], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json(row);
    });
  });
});

// Delete activity
router.delete('/:id', (req, res) => {
  db.run('DELETE FROM activities WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ error: 'Activity not found' });
      return;
    }
    
    res.json({ message: 'Activity deleted successfully' });
  });
});

// Get all categories
router.get('/categories/all', (req, res) => {
  db.all('SELECT * FROM categories ORDER BY name', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

module.exports = router;
