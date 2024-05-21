const express = require('express');
const router = express.Router();
const { posts, users } = require('../data/sampleData');

router.get('/', (req, res) => {
    res.render('home', {
        user: req.session.user,
        posts: posts
    });
});

router.get('/profile', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    const userPosts = posts.filter(post => post.username === req.session.user.username);
    res.render('profile', {
        user: req.session.user,
        posts: userPosts
    });
});

module.exports = router;
