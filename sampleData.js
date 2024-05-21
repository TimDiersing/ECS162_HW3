let users = [
    { id: 1, username: 'User1', avatar_url: undefined, memberSince: '2024-05-01T10:00:00Z' },
    { id: 2, username: 'User2', avatar_url: undefined, memberSince: '2024-05-01T11:00:00Z' }
];

let posts = [
    { id: 1, title: 'First Post', content: 'This is the first post.', username: 'User1', timestamp: '2024-05-01T12:00:00Z', likes: 0 },
    { id: 2, title: 'Second Post', content: 'This is the second post.', username: 'User2', timestamp: '2024-05-01T13:00:00Z', likes: 0 }
];

module.exports = { users, posts };

