const express = require('express');
const router = express.Router();
const { posts } = require('../data/sampleData');

router.post('/posts', (req, res) => {
    if (!req.session.user) {
        return res.status(403).send('You need to log in first');
    }
    const { title, content } = req.body;
    posts.push({ id: posts.length + 1, title, content, username: req.session.user.username, timestamp: new Date().toISOString(), likes: 0 });
    res.redirect('/');
});

router.post('/like/:id', (req, res) => {
    if (!req.session.user) {
        return res.status(403).send('You need to log in first');
    }
    const post = posts.find(post => post.id === parseInt(req.params.id));
    if (post && post.username !== req.session.user.username) {
        post.likes += 1;
    }
    res.redirect('/');
});

router.post('/delete/:id', (req, res) => {
    if (!req.session.user) {
        return res.status(403).send('You need to log in first');
    }
    const postIndex = posts.findIndex(post => post.id === parseInt(req.params.id) && post.username === req.session.user.username);
    if (postIndex !== -1) {
        posts.splice(postIndex, 1);
    }
    res.redirect('/');
});

module.exports = router;
