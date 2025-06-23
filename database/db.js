const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    if (Database.instance) {
      return Database.instance;
    }
    
    this.db = new sqlite3.Database(path.join(__dirname, 'planidea.db'), (err) => {
      if (err) {
        console.error('Error opening database:', err);
      } else {
        console.log('Connected to SQLite database');
        this.init();
      }
    });
    
    Database.instance = this;
  }

  init() {
    // Create tables in sequence to ensure proper initialization
    this.db.serialize(() => {
      // Create categories table first
      this.db.run(`
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          color TEXT DEFAULT '#3498db',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating categories table:', err);
        } else {
          console.log('Categories table ready');
          this.insertDefaultCategories();
        }
      });

      // Create activities table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS activities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          category TEXT DEFAULT 'general',
          location TEXT,
          duration INTEGER DEFAULT 60,
          url TEXT,
          image_url TEXT,
          estimated_cost REAL DEFAULT 0,
          rating REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating activities table:', err);
        } else {
          console.log('Activities table ready');
        }
      });

      // Create calendar events table
      this.db.run(`
        CREATE TABLE IF NOT EXISTS calendar_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          activity_id INTEGER,
          title TEXT NOT NULL,
          start_date DATETIME NOT NULL,
          end_date DATETIME NOT NULL,
          notes TEXT,
          completed BOOLEAN DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (activity_id) REFERENCES activities (id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Error creating calendar_events table:', err);
        } else {
          console.log('Calendar events table ready');
        }
      });
    });
  }
  insertDefaultCategories() {
    const defaultCategories = [
      { name: 'Date Night', color: '#e74c3c' },
      { name: 'Adventure', color: '#f39c12' },
      { name: 'Relaxation', color: '#27ae60' },
      { name: 'Food & Dining', color: '#8e44ad' },
      { name: 'Entertainment', color: '#3498db' },
      { name: 'Travel', color: '#34495e' },
      { name: 'Outdoor', color: '#16a085' },
      { name: 'Home Activities', color: '#d35400' }
    ];

    defaultCategories.forEach(category => {
      this.db.run(
        'INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)',
        [category.name, category.color],
        (err) => {
          if (err) {
            console.error('Error inserting category:', category.name, err);
          }
        }
      );
    });
  }
  getDatabase() {
    return this.db;
  }

  static getInstance() {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  close() {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = Database;
