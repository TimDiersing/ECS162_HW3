const express = require('express');
const router = express.Router();
const { users } = require('../data/sampleData');

router.post('/register', (req, res) => {
    const { username } = req.body;
    if (users.find(user => user.username === username)) {
        return res.status(400).send('User already exists');
    }
    users.push({ id: users.length + 1, username, avatar_url: undefined, memberSince: new Date().toISOString() });
    res.redirect('/login');
});

router.post('/login', (req, res) => {
    const { username } = req.body;
    const user = users.find(user => user.username === username);
    if (!user) {
        return res.status(400).send('User not found');
    }
    req.session.user = user;
    res.redirect('/');
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

router.get('/login', (req, res) => {
    res.render('loginRegister', { action: 'login' });
});

router.get('/register', (req, res) => {
    res.render('loginRegister', { action: 'register' });
});

module.exports = router;
