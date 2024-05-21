const express = require('express');
const session = require('express-session');
const exphbs = require('express-handlebars');
const path = require('path');
const app = express();

// set middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
}));

// set Handlebars view engine
app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

// introduce the routes
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const postsRouter = require('./routes/posts');

app.use('/', indexRouter);
app.use('/', authRouter);
app.use('/', postsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
