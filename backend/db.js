const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'journal.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Create table
        db.run(`CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId TEXT NOT NULL,
            ambience TEXT NOT NULL,
            text TEXT NOT NULL,
            textHash TEXT,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Caching table for LLM
        db.run(`CREATE TABLE IF NOT EXISTS llm_cache (
            textHash TEXT PRIMARY KEY,
            emotion TEXT,
            summary TEXT,
            keywords TEXT
        )`);
    }
});

module.exports = db;
