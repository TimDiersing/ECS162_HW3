const express = require('express');
const expressHandlebars = require('express-handlebars');
const session = require('express-session');
const { createCanvas } = require('canvas');
const fs = require('fs');

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Configuration and Setup
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

const app = express();
const PORT = 3000;

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
// Routes
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Home route: render home view with posts and user
// We pass the posts and user variables into the home
// template
//
app.get('/', (req, res) => {
    const posts = getPosts();
    const user = getCurrentUser(req) || {};
    res.render('home', { posts, user });
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

// Additional routes that you must implement


app.post('/posts', (req, res) => {
    // TODO: Add a new post and redirect to home
    let user = getCurrentUser(req, res);

    if (user) {
        addPost(req.body.title, req.body.content, user);
    }

    res.redirect("/");
});
app.post('/like/:id', (req, res) => {
    // TODO: Update post likes
    updatePostLikes(req, res);
});
app.get('/profile', isAuthenticated, (req, res) => {
    // TODO: Render profile page
    renderProfile(req, res);
});
app.get('/avatar/:username', (req, res) => {
    // TODO: Serve the avatar image for the user
});
app.post('/register', (req, res) => {
    // TODO: Register a new user
    registerUser(req, res);
});
app.post('/login', (req, res) => {
    // TODO: Login a user
    loginUser(req, res);
});
app.get('/logout', (req, res) => {
    // TODO: Logout the user
    logoutUser(req, res);
});
app.post('/delete/:id', isAuthenticated, (req, res) => {
    // TODO: Delete a post if the current user is the owner
    console.log("feteched Id? : " + req.params['id']);
    deletePost(parseInt(req.params['id']));
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Server Activation
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Support Functions and Variables
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

// Example data for posts and users
let posts = [
    { id: 1, title: 'Sample Post', content: 'This is a sample post.', username: 'SampleUser', timestamp: '2024-01-01 10:00', likes: 0, likedBy: [] },
    { id: 2, title: 'Another Post', content: 'This is another sample post.', username: 'AnotherUser', timestamp: '2024-01-02 12:00', likes: 0, likedBy: [] },
];
let users = [
    { id: 1, username: 'SampleUser', avatar_url: undefined, memberSince: '2024-01-01 08:00', posts: [posts[0]]},
    { id: 2, username: 'AnotherUser', avatar_url: undefined, memberSince: '2024-01-02 09:00', posts: [posts[1]]},
];

// Function to find a user by username
function findUserByUsername(username) {
    // TODO: Return user object if found, otherwise return undefined
    for (let index = 0; index < users.length; index++) {
        if (users[index].username === username) {
            return users[index];
        }
    }

    return;
}

// Function to find a user by user ID
function findUserById(userId) {
    // TODO: Return user object if found, otherwise return undefined
    for (let index = 0; index < users.length; index++) {
        if (users[index].id === userId) {
            return users[index];
        }
    }

    return;
}

// Function to add a new user
function addUser(username) {
    // TODO: Create a new user object and add to users array
    let date = new Date();
    let newUser = { id: users.length+1, username: username, 
                    avatar_url: undefined, memberSince: date, posts: []};

    users.push(newUser);

    return newUser;
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

// Function to register a user
function registerUser(req, res) {
    // TODO: Register a new user and redirect appropriately
    let name = req.body.uname;
    let user = findUserByUsername(name)

    if (!user) {
        if (!req.session.active) {
            req.session.regenerate(function(err) {

            });
        }
        console.log("Registering");
        let user = addUser(name);
        req.session.userId = user.id;
        req.session.loggedIn = true;
        handleAvatar(req, res);
        res.redirect('/');
    } else {
        console.log("registration failed");
        res.redirect('register?error=Username already exists');
    }
}

// Function to login a user
function loginUser(req, res) {
    // TODO: Login a user and redirect appropriately
    let user = findUserByUsername(req.body.uname)

    if (user) {
        if (!req.session.active) {
            req.session.regenerate(function(err) {

            });
        }
        console.log("loggingIn");
        req.session.userId = user.id;
        req.session.loggedIn = true;
        handleAvatar(req, res);
        res.redirect('/');
    } else {
        console.log("log in failed");
        res.redirect('login?error=Username not found');
    }
}

// Function to logout a user
function logoutUser(req, res) {
    // TODO: Destroy session and redirect appropriately
    req.session.destroy(function (err) {

    });

    res.redirect('/');

}

// Function to render the profile page
function renderProfile(req, res) {
    // TODO: Fetch user posts and render the profile page
    let user = getCurrentUser(req);

    res.render('profile', { user });
}

function findPost(postId) {
    for (let index = 0; index < posts.length; index++) {
        if (posts[index].id === postId) {
            return posts[index];
        }
    }

    return;
}

// Function to update post likes
function updatePostLikes(req, res) {
    // TODO: Increment post likes if conditions are met
    let post = findPost(parseInt(req.params['id']));
    let user = findUserById(req.session.userId);

    for (let index = 0; index < post.likedBy.length; index++) {
        if (post.likedBy[index] === user.id) {
            console.log("Post already liked by this user");
            return;
        }
    }

    post.likedBy.push(user.id);
    post.likes++;

    res.redirect('/');
}

// Function to handle avatar generation and serving
function handleAvatar(req, res) {
    // TODO: Generate and serve the user's avatar image
    let user = findUserById(req.session.userId);
    let letter = user.username.charAt(0).toLowerCase();

    let buffer = generateAvatar(letter, 100, 100);
    fs.writeFileSync("./public/avatar/" + user.username + ".png", buffer);

}

// Function to get the current user from session
function getCurrentUser(req) {
    // TODO: Return the user object if the session user ID matches
    for (let index = 0; index < users.length; index++) {
        if (req.session.userId === users[index].id) {
            return users[index];
        }
    }
    return;
}

// Function to get all posts, sorted by latest first
function getPosts() {
    return posts.slice().reverse();
}

// Function to add a new post
function addPost(title, content, user) {
    // TODO: Create a new post object and add to posts array
    let postId = posts[posts.length - 1].id + 1;
    let newPost = {id: postId, title: title, content: content, username: user.username, timestamp: 0, likes: 0, likedBy: []};

    user.posts.push(newPost);
    posts.push(newPost);
}

function deletePost(postId) {
    for (let index = 0; index < posts.length; index++) {
        console.log("loop");
        if (posts[index].id === postId) {
            
            let user = findUserByUsername(posts[index].username);
            for ( let j = 0; j < user.posts.length; j++) {
                if (user.posts.id === postId) {
                    user.posts.splice(j, 1);
                }
            }
            posts.splice(index, 1);
            
            return;
        }
    }
}

// Function to generate an image avatar
function generateAvatar(letter, width = 100, height = 100) {
    // TODO: Generate an avatar image with a letter
    // Steps:
    // 1. Choose a color scheme based on the letter
    // 2. Create a canvas with the specified width and height
    // 3. Draw the background color
    // 4. Draw the letter in the center
    // 5. Return the avatar as a PNG buffer

    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");

    let color = "#" + letter.charCodeAt(0).toString(16) + letter.charCodeAt(0).toString(16) + letter.charCodeAt(0).toString(16);
    console.log("color: " + color);
    context.fillStyle = color;
    context.fillRect(0, 0, width, height);

    context.font = "bold 70pt 'PT sans'";
    context.textAlign = 'center';
    context.fillStyle = '#fff';
    context.fillText(letter, width / 2, height * 0.75);

    const buffer = canvas.toBuffer("image/png");

    return buffer;
}