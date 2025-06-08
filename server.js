// server.js

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB接続
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('✅ Connected to MongoDB');
}).catch((err) => {
  console.error('❌ MongoDB connection error:', err);
});

// スキーマ定義
const userSchema = new mongoose.Schema({
  username: String,
  password: String
});

const threadSchema = new mongoose.Schema({
  title: String,
  author: String,
  createdAt: { type: Date, default: Date.now }
});

const postSchema = new mongoose.Schema({
  threadId: mongoose.Schema.Types.ObjectId,
  content: String,
  author: String,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Thread = mongoose.model('Thread', threadSchema);
const Post = mongoose.model('Post', postSchema);

// ミドルウェア
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false
}));

// ログインチェック
function isAuthenticated(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

// ルート：トップページ（スレッド一覧）
app.get('/', async (req, res) => {
  const threads = await Thread.find().sort({ createdAt: -1 });
  res.render('index', { threads, user: req.session.user });
});

// スレッドページ
app.get('/thread/:id', async (req, res) => {
  const thread = await Thread.findById(req.params.id);
  const posts = await Post.find({ threadId: req.params.id }).sort({ createdAt: 1 });
  res.render('thread', { thread, posts, user: req.session.user });
});

// 投稿処理
app.post('/thread/:id/post', isAuthenticated, async (req, res) => {
  await Post.create({
    threadId: req.params.id,
    content: req.body.content,
    author: req.session.user.username
  });
  res.redirect(`/thread/${req.params.id}`);
});

// スレッド作成ページ
app.get('/new-thread', isAuthenticated, (req, res) => {
  res.render('new-thread', { user: req.session.user });
});

app.post('/new-thread', isAuthenticated, async (req, res) => {
  const thread = await Thread.create({
    title: req.body.title,
    author: req.session.user.username
  });
  res.redirect(`/thread/${thread._id}`);
});

// ユーザー登録
app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', async (req, res) => {
  const hashed = await bcrypt.hash(req.body.password, 10);
  await User.create({
    username: req.body.username,
    password: hashed
  });
  res.redirect('/login');
});

// ログイン
app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const user = await User.findOne({ username: req.body.username });
  if (user && await bcrypt.compare(req.body.password, user.password)) {
    req.session.user = { id: user._id, username: user.username };
    res.redirect('/');
  } else {
    res.send('❌ ログイン失敗');
  }
});

// ログアウト
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
