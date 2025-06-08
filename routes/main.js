const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const db = require('../models/db');

// ログイン状態確認ミドルウェア
function isLoggedIn(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
}

// トップページ（スレッド一覧）
router.get('/', (req, res) => {
  db.all(`SELECT threads.*, users.username 
          FROM threads 
          JOIN users ON threads.user_id = users.id 
          ORDER BY threads.created_at DESC`, [], (err, threads) => {
    res.render('index', { user: req.session.username, threads });
  });
});

// 新規登録ページ
router.get('/register', (req, res) => {
  res.render('register', { error: null });
});

// 登録処理
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashed], function (err) {
    if (err) {
      return res.render('register', { error: '登録エラー（既に存在している可能性があります）' });
    }
    req.session.userId = this.lastID;
    req.session.username = username;
    res.redirect('/');
  });
});

// ログインページ
router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

// ログイン処理
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.render('login', { error: 'ユーザー名またはパスワードが違います' });
    }
    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/');
  });
});

// ログアウト
router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// スレッド作成ページ
router.get('/thread/new', isLoggedIn, (req, res) => {
  res.render('new_thread');
});

// スレッド作成処理
router.post('/thread/new', isLoggedIn, (req, res) => {
  const { title } = req.body;
  db.run('INSERT INTO threads (title, user_id) VALUES (?, ?)', [title, req.session.userId], function () {
    res.redirect(`/thread/${this.lastID}`);
  });
});

// スレッド詳細（投稿一覧）
router.get('/thread/:id', (req, res) => {
  const threadId = req.params.id;
  db.get(`SELECT threads.*, users.username 
          FROM threads 
          JOIN users ON threads.user_id = users.id 
          WHERE threads.id = ?`, [threadId], (err, thread) => {
    if (!thread) return res.redirect('/');
    db.all(`SELECT posts.*, users.username 
            FROM posts 
            JOIN users ON posts.user_id = users.id 
            WHERE posts.thread_id = ? 
            ORDER BY posts.created_at ASC`, [threadId], (err, posts) => {
      res.render('thread', { thread, posts, user: req.session.username });
    });
  });
});

// 投稿処理
router.post('/thread/:id/post', isLoggedIn, (req, res) => {
  const { content } = req.body;
  const threadId = req.params.id;
  db.run('INSERT INTO posts (thread_id, user_id, content) VALUES (?, ?, ?)', [threadId, req.session.userId, content], () => {
    res.redirect(`/thread/${threadId}`);
  });
});

module.exports = router;
