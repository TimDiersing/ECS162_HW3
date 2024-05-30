// database.js

const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');

// Open SQLite database
const dbPromise = sqlite.open({
    filename: path.resolve(__dirname, 'microblog.db'),
    driver: sqlite3.Database
});

// Initialize the database
async function initializeDB() {
    const db = await dbPromise;
    await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            hashedGoogleId TEXT,
            avatar_url TEXT,
            memberSince TEXT
        );

        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            username TEXT NOT NULL,
            timestamp TEXT,
            likes INTEGER DEFAULT 0
        );
    `);
}

module.exports = {
    dbPromise,
    initializeDB
};
