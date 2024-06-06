const express = require('express');
const path = require('path');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const { createCanvas } = require('canvas');
const fs = require('fs');
const { dbPromise, initializeDB } = require('./database');
const sqlite = require('sqlite');
const sqlite3 = require('sqlite3');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config() // load environment variables

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const app = express();
const PORT = 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configure Passport
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

passport.use(new GoogleStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: `http://localhost:${PORT}/auth/google/callback`
}, (token, tokenSecret, profile, done) => {
    return done(null, profile);
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

/*
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    Handlebars Helpers

    Handlebars helpers are custom functions that can be used within the templates 
    to perform specific tasks. They enhance the functionality of templates and 
    help simplify data manipulation directly within the view files.

    In this project, two helpers are provided:
    
    1. toLowerCase:
       - Converts a given string to lowercase.
       - Usage example: {{toLowerCase 'SAMPLE STRING'}} -> 'sample string'

    2. ifCond:
       - Compares two values for equality and returns a block of content based on 
         the comparison result.
       - Usage example: 
            {{#ifCond value1 value2}}
                <!-- Content if value1 equals value2 -->
            {{else}}
                <!-- Content if value1 does not equal value2 -->
            {{/ifCond}}
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

// Set up Handlebars view engine with custom helpers
//
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
            ifContains: function (list, element, options) {
                for (let index = 0; index < list.length; index++) {
                    if (list[index] == element) {
                        return options.fn(this);
                    }
                }
                return options.inverse(this);
            }
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

// Replace any of these variables below with constants for your application. These variables
// should be used in your template files. 
// 
app.use((req, res, next) => {
    res.locals.appName = 'Court';
    res.locals.copyrightYear = 2024;
    res.locals.postNeoType = 'Event';
    res.locals.loggedIn = req.session.loggedIn || false;
    res.locals.userId = req.session.userId || '';
    next();
});

app.use(express.static(path.join(__dirname, 'public')));                  // Serve static files
app.use(express.urlencoded({ extended: true }));    // Parse URL-encoded bodies (as sent by HTML forms)
app.use(express.json());                            // Parse JSON bodies (as sent by API clients)

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Routes
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Home route: render home view with posts and user
// We pass the posts and user variables into the home
// template
//
app.get('/', async (req, res) => {
    const posts = await db.all('SELECT * FROM events ORDER BY timestamp ASC');
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.session.userId]) || {};
    let userEvents = [];
    if (user.username) {
        userEvents = await db.all('SELECT * FROM followed' + user.username);
        userEvents = userEvents.map(a => a.postId);
    }

    console.log(userEvents);
    

    res.render('home', { posts, user, userEvents });
});

app.post('/sortPosts', async (req, res) => {
    let posts = {};
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.session.userId]) || {};

    if (req.body.sortType == 'postTime') {
        posts = await db.all('SELECT * FROM events ORDER BY timestamp ASC');
    } else if (req.body.sortType == 'eventTime') {
        posts = await db.all('SELECT * FROM events ORDER BY eventTime ASC');
    } else if (req.body.sortType == 'followAmount') {
        posts = await db.all('SELECT * FROM events ORDER BY followers DESC');
    }

    const sportFilter = req.body.sportFilter;
    if (sportFilter) {
        let tempPosts = [];

        for (index = 0; index < posts.length; index++) {
            if (posts[index].sport == sportFilter) {
                tempPosts.push(posts[index]);
            }
        }

        posts = tempPosts;
    }
    
    let userEvents = [];
    if (user.username) {
        userEvents = await db.all('SELECT * FROM followed' + user.username);
        userEvents = userEvents.map(a => a.postId);
    }

    console.log(userEvents);

    res.render('home', { posts, user, userEvents });
});

// Register GET route is used for error response from registration
//
app.get('/register', (req, res) => {
    res.render('loginRegister', { regError: req.query.error });
});

// Login route GET route is used for error response from login
//
app.get('/login', (req, res) => {
    res.render('loginRegister', { loginError: req.query.error });
});

// Error route: render error page
//
app.get('/error', (req, res) => {
    res.render('error');
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Login Routes
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.get('/auth/google', passport.authenticate('google', { scope: ['profile'] }));

app.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login' }),
    async (req, res) => {
        const googleId = req.user.id;
        const hashedGoogleId = crypto.createHash('sha256', googleId).digest('hex');
        req.session.hashedGoogleId = hashedGoogleId;
        console.log(hashedGoogleId);

        // Check if user already exists
        try {
            let localUser = await db.get('SELECT * FROM users WHERE hashedGoogleId = ?', [hashedGoogleId]);
            if (localUser) {
                req.session.userId = localUser.id;
                req.session.loggedIn = true;
                res.redirect('/');
            } else {
                res.redirect('/registerUsername');
            }
        }
        catch(err){
            console.error('Error finding user:', err);
            res.redirect('/error');
        }
    }
);

app.get('/registerUsername', (req, res) => {
    res.render('registerUsername');
});

app.post('/registerUsername', async (req, res) => {
    
    let user = await findUserByUsername(req.body.uname);
    
    if (!user) {

        let date = new Date().toISOString();
        const hashedGoogleId = req.session.hashedGoogleId;

        await db.run(
            'INSERT INTO users (username, hashedGoogleID, avatar_url, memberSince) values(?,?,?,?)',
            [req.body.uname, hashedGoogleId, '', date]
        );

        let localUser = await db.get('SELECT * FROM users WHERE hashedGoogleId = ?', [hashedGoogleId]);
        req.session.userId = localUser.id;
        req.session.loggedIn = true;

        await db.run('CREATE TABLE followed' + localUser.username + ' (postId TEXT)');
        res.redirect('/');

    } else {
        res.redirect('registerUsername?error=Username is Taken');
    }
});

// Logout the user and redirect to home
app.get('/logout', (req, res) => {
    req.session.destroy(function (err) {
        if (err) {
            console.error("Error destorying session", err);
            res.redirect("/error")
        } else {
            //res.redirect('/googleLogout'); // Logs out of google
            res.redirect('/');
        }
    });
});

// Logout of google
app.get('/googleLogout', (req, res) => {
    res.render('googleLogout');
});

// Add new post and redirect to home
app.post('/posts', async (req, res) => {
    let user = await getCurrentUser(req, res);

    if (user) {
        let date = new Date().toISOString();
        console.log(date);

        await db.run('INSERT INTO events (sport, title, content, username, timestamp, eventTime) VALUES (?,?,?,?,?,?)',
                    [req.body.sport, req.body.title, req.body.content, user.username, date, req.body.eventTime]);
    }

    res.redirect("/");
});

// follow post with id
app.post('/follow/:id', async (req, res) => {
    
    const postId = req.params.id;
    const currentUser = await getCurrentUser(req);

    console.log("like before");

    await db.run('UPDATE events SET followers = followers + 1 WHERE id = ?', [postId]);

    console.log("like after");

    await db.run('INSERT INTO followed' + currentUser.username + ' (postId) VALUES (?)', [postId]);
});

// unfollow post with id
app.post('/unfollow/:id', async (req, res) => {

    const postId = req.params.id;
    const currentUser = await getCurrentUser(req);

    console.log("dislike before");

    await db.run('UPDATE events SET followers = followers - 1 WHERE id = ?', [postId]);

    console.log("dislike after");

    await db.run('DELETE FROM followed' + currentUser.username + ' WHERE postId = ?', [postId]);
});

// Render the profile page
app.get('/profile', isAuthenticated, async (req, res) => {

    const user = await getCurrentUser(req);
    const posts = await db.all('SELECT * FROM events');
    let usersPosts = await db.all('SELECT * FROM events WHERE username = ?', [user.username]);
    let userEvents = await db.all('SELECT * FROM followed' + user.username);
    userEvents = userEvents.map(a => a.postId);
    let eventPosts = [];
    for (let index = 0; index < userEvents.length; index++) {
        let event = await db.get('SELECT * FROM events WHERE id = ?', [userEvents[index]]);
        eventPosts.push(event);
    }

    res.render('profile', { user, usersPosts, userEvents, eventPosts});
});

// Serve the avatar image
app.get('/avatar/:username', async (req, res) => {

    await handleAvatar(req, res);
});

// Delete post
app.post('/delete/:id', isAuthenticated, async (req, res) => {

    await db.run('DELETE FROM events WHERE id = ?', [req.params['id']])
    res.redirect('/profile');
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Server Activation
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

let db;

async function openDatabase() {

    await initializeDB();

    db = await sqlite.open({ filename: path.resolve(__dirname, 'microblog.db'),
                            driver: sqlite3.Database });

    console.log("opened database");
}

openDatabase().catch(err => {
    console.error("failed to open database", err);
})

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Support Functions
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Function to find a user by username
async function findUserByUsername(username) {
    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);

    return user;
}

// Function to add a new user
async function addUser(username) {
    let date = new Date().toISOString();

    await db.run(
        'INSERT INTO users (username, hashedGoogleID, avatar_url, memberSince) values(?,?,?,?)',
        [username, 'testGoogleThingay2', '', date]
    );

    return await db.get('SELECT * FROM users WHERE username = ?', [username]);
}

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    console.log(req.session.userId);
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Function to handle avatar generation and serving
async function handleAvatar(req, res) {
    let user = await findUserByUsername(req.params['username']);

    if (user.avatar_url) {
        res.setHeader('avatar', 'image/png')
        res.send(user.avatar_url);
        
    } else {
        let letter = user.username.charAt(0).toLowerCase();
        let buffer = generateAvatar(letter, 100, 100);
        user.avatar_url = buffer;

        res.setHeader('avatar', 'image/png')
        res.send(buffer);
    }
}

// Function to get the current user from session
async function getCurrentUser(req) {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [req.session.userId]);

    return user;
}

// Function to generate an image avatar
function generateAvatar(letter, width = 100, height = 100) {

    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');

    let color = '#5F9EA0'
    if (letter > 'd' && letter <= 'j') {
        color = '#008B8B';
    } else if (letter > 'j' && letter <= 'n') {
        color = '#B8860B';
    } else if (letter > 'n' && letter <= 'u') {
        color = '#556B2F';
    } else if (letter > 'u' && letter <= 'z') {
        color = '#E9967A';
    }

    context.fillStyle = color;
    context.fillRect(0, 0, width, height);

    context.font = 'bold 70px Impact';
    context.textAlign = 'center';
    context.fillStyle = '#fff';
    context.fillText(letter.toUpperCase(), width / 2, height * 0.75);

    const buffer = canvas.toBuffer("image/png");

    return buffer;
}