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

        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sport TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            username TEXT NOT NULL,
            timestamp TEXT,
            eventTime TEXT,
            followers INTEGER DEFAULT 0
        );
    `);

    // Sample data - Replace these arrays with your own data
    const users = [
        { username: 'footballGuy', hashedGoogleId: 'hashedGoogleId1', avatar_url: '', memberSince: '2024-01-01 12:00:00' },
        { username: 'soccerLover', hashedGoogleId: 'hashedGoogleId2', avatar_url: '', memberSince: '2024-01-02 12:00:00' }
    ];

    const posts = [
        { sport: 'football',title: 'Football at the park!', content: 'We are doing a chill pickup game of football at the park. Anyone is welcome to join!', username: 'footballGuy', timestamp: '2024-05-5 8:30:00', eventTime: '2024-06-10 12:30:00'},
        { sport: 'football',title: 'Pickup game at Russel', content: 'Need at least 12 players for a pickup game at russel. follow if interested.', username: 'footballGuy', timestamp: '2024-04-5 16:40:00', eventTime: '2024-08-10 12:30:00'},
        { sport: 'soccer',title: 'Chill soccer game!', content: 'Join us for a chill game of soccer at the park!', username: 'soccerLover', timestamp: '2024-05-5 18:30:00', eventTime: '2024-06-10 8:30:00'},
        { sport: 'soccer',title: 'Soccer game at Russel', content: 'Come watch us play at russel field facing our biggest rivals!', username: 'soccerLover', timestamp: '2024-06-5 10:30:00', eventTime: '2024-11-10 15:30:00'},
    ];

    const count = await db.all('SELECT COUNT(*) AS count FROM users');

    if (count[0].count === 0) {
        // Insert sample data into the database if empty
        await Promise.all(users.map(user => {
            return db.run(
                'INSERT INTO users (username, hashedGoogleId, avatar_url, memberSince) VALUES (?, ?, ?, ?)',
                [user.username, user.hashedGoogleId, user.avatar_url, user.memberSince]
            );
        }));

        await Promise.all(posts.map(post => {
            return db.run(
                'INSERT INTO events (sport, title, content, username, timestamp, eventTime) VALUES (?, ?, ?, ?, ?, ?)',
                [post.sport, post.title, post.content, post.username, post.timestamp, post.eventTime]
            );
        }));
    }

    await db.close();
}

module.exports = {
    dbPromise,
    initializeDB
};
