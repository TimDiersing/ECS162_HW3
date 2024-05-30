const express = require('express');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { createCanvas } = require('canvas');
const fs = require('fs');
const { dbPromise, initializeDB } = require('./database'); // Import database module
const path = require('path');
require('dotenv').config(); // Load environment variables

// Ensure the environment variables are loaded
console.log('CLIENT_ID:', process.env.CLIENT_ID);
console.log('CLIENT_SECRET:', process.env.CLIENT_SECRET);
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const app = express();
const PORT = 3000;

// Initialize the database
initializeDB().then(() => {
    console.log('Database initialized');
}).catch((err) => {
    console.error('Error initializing database:', err);
});

/*
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    Handlebars Helpers
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

// Set up Handlebars view engine with custom helpers
app.engine(
    'handlebars',
    expressHandlebars.engine({
        helpers: {
            toLowerCase: function (str) {
                return str.toLowerCase();
            },
            ifCond: function (v1, v2, options) {
                if (v1 === v2) {
                    return options.fn(this);
                }
                return options.inverse(this);
            },
        },
    })
);

app.set('view engine', 'handlebars');
app.set('views', './views');

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Middleware
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.use(
    session({
        secret: 'oneringtorulethemall',     // Secret key to sign the session ID cookie
        resave: false,                      // Don't save session if unmodified
        saveUninitialized: false,           // Don't create session until something stored
        cookie: { secure: false },          // True if using https. Set to false for development without https
    })
);

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
    res.locals.appName = 'MicroBlog';
    res.locals.copyrightYear = 2024;
    res.locals.postNeoType = 'Post';
    res.locals.loggedIn = req.session.loggedIn || false;
    res.locals.userId = req.session.userId || '';
    next();
});

app.use(express.static('public'));                  // Serve static files
app.use(express.urlencoded({ extended: true }));    // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json());                            // Parse JSON bodies (as sent by API clients)

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Passport Configuration
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback"
  },
  async (token, tokenSecret, profile, done) => {
    const db = await dbPromise;
    let user = await db.get('SELECT * FROM users WHERE hashedGoogleId = ?', [profile.id]);
    if (!user) {
        await db.run('INSERT INTO users (username, hashedGoogleId, memberSince) VALUES (?, ?, ?)', [
            profile.displayName, profile.id, new Date().toISOString()
        ]);
        user = await db.get('SELECT * FROM users WHERE hashedGoogleId = ?', [profile.id]);
    }
    return done(null, user);
  }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    const db = await dbPromise;
    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    done(null, user);
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Routes
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Home route: render home view with posts and user
app.get('/', async (req, res) => {
    const db = await dbPromise;
    const posts = await db.all('SELECT * FROM posts ORDER BY timestamp DESC');
    const user = getCurrentUser(req) || {};
    res.render('home', { posts, user });
});

// Register GET route is used for error response from registration
app.get('/register', (req, res) => {
    res.render('loginRegister', { regError: req.query.error });
});

// Login route GET route is used for error response from login
app.get('/login', (req, res) => {
    res.render('loginRegister', { loginError: req.query.error });
});

// Google authentication routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication, redirect home.
    req.session.loggedIn = true;
    res.redirect('/');
  }
);

// Error route: render error page
app.get('/error', (req, res) => {
    res.render('error');
});

// Add a new post and redirect to home
app.post('/posts', async (req, res) => {
    const db = await dbPromise;
    const user = getCurrentUser(req);
    if (user) {
        await db.run('INSERT INTO posts (title, content, username, timestamp) VALUES (?, ?, ?, ?)', [
            req.body.title, req.body.content, user.username, new Date().toISOString()
        ]);
    }
    res.redirect('/');
});

// Update post likes
app.post('/like/:id', async (req, res) => {
    const db = await dbPromise;
    await db.run('UPDATE posts SET likes = likes + 1 WHERE id = ?', [req.params.id]);
    res.redirect('/');
});

// Render profile page
app.get('/profile', isAuthenticated, async (req, res) => {
    const db = await dbPromise;
    const user = getCurrentUser(req);
    const posts = await db.all('SELECT * FROM posts WHERE username = ? ORDER BY timestamp DESC', [user.username]);
    res.render('profile', { user, posts });
});

// Serve the avatar image for the user
app.get('/avatar/:username', (req, res) => {
    const filePath = path.resolve(__dirname, 'public', 'avatar', `${req.params.username}.png`);
    res.sendFile(filePath);
});

// Register a new user
app.post('/register', async (req, res) => {
    const db = await dbPromise;
    const user = await db.get('SELECT * FROM users WHERE username = ?', [req.body.uname]);
    if (!user) {
        await db.run('INSERT INTO users (username, memberSince) VALUES (?, ?)', [
            req.body.uname, new Date().toISOString()
        ]);
        const newUser = await db.get('SELECT * FROM users WHERE username = ?', [req.body.uname]);
        req.session.userId = newUser.id;
        req.session.loggedIn = true;
        handleAvatar(req, res);
        res.redirect('/');
    } else {
        res.redirect('register?error=Username already exists');
    }
});

// Login a user
app.post('/login', async (req, res) => {
    const db = await dbPromise;
    const user = await db.get('SELECT * FROM users WHERE username = ?', [req.body.uname]);
    if (user) {
        req.session.userId = user.id;
        req.session.loggedIn = true;
        handleAvatar(req, res);
        res.redirect('/');
    } else {
        res.redirect('login?error=Username not found');
    }
});

// Logout the user
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        res.redirect('/');
    });
});

// Delete a post if the current user is the owner
app.post('/delete/:id', isAuthenticated, async (req, res) => {
    const db = await dbPromise;
    await db.run('DELETE FROM posts WHERE id = ?', [req.params.id]);
    res.redirect('/profile');
});


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Support Functions and Variables
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Get the current user from session
function getCurrentUser(req) {
    return req.session.userId ? { id: req.session.userId, username: req.session.username } : null;
}

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Handle avatar generation and serving
function handleAvatar(req, res) {
    const user = getCurrentUser(req);
    if (user) {
        const letter = user.username.charAt(0).toLowerCase();
        const buffer = generateAvatar(letter, 100, 100);
        const filePath = path.resolve(__dirname, 'public', 'avatar', `${user.username}.png`);
        fs.writeFileSync(filePath, buffer);
    }
}

// Generate an image avatar
function generateAvatar(letter, width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    context.fillStyle = '#' + letter.charCodeAt(0).toString(16).padStart(2, '0').repeat(3);
    context.fillRect(0, 0, width, height);
    context.font = 'bold 70pt sans-serif';
    context.textAlign = 'center';
    context.fillStyle = '#fff';
    context.fillText(letter, width / 2, height * 0.75);
    return canvas.toBuffer('image/png');
}
app.get('/privacy-policy', (req, res) => {
    res.sendFile(path.join(__dirname, 'privacy-policy.html'));
});
app.get('/terms-of-service', (req, res) => {
    res.sendFile(path.join(__dirname, 'terms-of-service.html'));
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Server Activation
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
