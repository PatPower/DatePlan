const express = require('express');
const router = express.Router();
const Database = require('../database/db');

const db = Database.getInstance().getDatabase();

// Get all activity history
router.get('/', (req, res) => {
    const query = `
    SELECT ah.*, c.color as category_color
    FROM activity_history ah
    LEFT JOIN categories c ON ah.category = c.name
    ORDER BY ah.completed_date DESC
  `;

    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Get activity history by ID
router.get('/:id', (req, res) => {
    const query = `
    SELECT ah.*, c.color as category_color
    FROM activity_history ah
    LEFT JOIN categories c ON ah.category = c.name
    WHERE ah.id = ?
  `;

    db.get(query, [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'Activity history not found' });
            return;
        }
        res.json(row);
    });
});

// Create new activity history entry
router.post('/', (req, res) => {
    const {
        original_activity_id,
        title,
        description,
        category,
        location,
        duration,
        url,
        image_url,
        estimated_cost,
        rating,
        completed_date,
        event_start_date,
        event_end_date,
        event_notes
    } = req.body;

    if (!title || !completed_date || !event_start_date || !event_end_date) {
        res.status(400).json({ error: 'Title, completed_date, event_start_date, and event_end_date are required' });
        return;
    }

    const query = `
    INSERT INTO activity_history 
    (original_activity_id, title, description, category, location, duration, url, image_url, 
     estimated_cost, rating, completed_date, event_start_date, event_end_date, event_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

    const params = [
        original_activity_id || null,
        title,
        description || null,
        category || 'general',
        location || null,
        duration || 60,
        url || null,
        image_url || null,
        estimated_cost || 0,
        rating || 0,
        completed_date,
        event_start_date,
        event_end_date,
        event_notes || null
    ];

    db.run(query, params, function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        // Return the created history entry
        const selectQuery = `
      SELECT ah.*, c.color as category_color
      FROM activity_history ah
      LEFT JOIN categories c ON ah.category = c.name
      WHERE ah.id = ?
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

// Delete activity history entry
router.delete('/:id', (req, res) => {
    const query = 'DELETE FROM activity_history WHERE id = ?';

    db.run(query, [req.params.id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (this.changes === 0) {
            res.status(404).json({ error: 'Activity history not found' });
            return;
        }

        res.json({ message: 'Activity history deleted successfully' });
    });
});

// Move activity from history back to ideas (create new activity)
router.post('/:id/move-to-ideas', (req, res) => {
    // First, get the history entry
    const selectQuery = `
    SELECT * FROM activity_history WHERE id = ?
  `;

    db.get(selectQuery, [req.params.id], (err, historyRow) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (!historyRow) {
            res.status(404).json({ error: 'Activity history not found' });
            return;
        }

        // Create a new activity based on the history entry
        const insertQuery = `
      INSERT INTO activities 
      (title, description, category, location, duration, url, image_url, estimated_cost, rating, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

        const params = [
            historyRow.title,
            historyRow.description,
            historyRow.category,
            historyRow.location,
            historyRow.duration,
            historyRow.url,
            historyRow.image_url,
            historyRow.estimated_cost,
            historyRow.rating
        ];

        db.run(insertQuery, params, function (insertErr) {
            if (insertErr) {
                res.status(500).json({ error: insertErr.message });
                return;
            }

            // Return the created activity
            const selectActivityQuery = `
        SELECT * FROM activities WHERE id = ?
      `;

            db.get(selectActivityQuery, [this.lastID], (activityErr, activityRow) => {
                if (activityErr) {
                    res.status(500).json({ error: activityErr.message });
                    return;
                }
                res.status(201).json({
                    message: 'Activity moved back to ideas successfully',
                    activity: activityRow
                });
            });
        });
    });
});

module.exports = router;
