const express = require('express');
const cors = require('cors');
const mongoose = require("mongoose");
const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require('bcryptjs');
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables only in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Set up salt and JWT secret
const salt = bcrypt.genSaltSync(10);
const secret = process.env.JWT_SECRET;

// Middleware setup
app.use(cors({ credentials: true, origin: 'http://localhost:3000' }));
app.use(express.json());
app.use(cookieParser());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(error => console.error('MongoDB connection error:', error));

// File upload middleware setup
const uploadMiddleware = multer({ dest: 'uploads/' });
app.use('/uploads', express.static(__dirname + '/uploads'));

// Routes
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.create({
      username,
      password: bcrypt.hashSync(password, salt),
    });
    res.json(userDoc);
  } catch (e) {
    console.error('Error creating user:', e);
    res.status(400).json(e);
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.findOne({ username });
    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (passOk) {
      jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
        if (err) throw err;
        res.cookie('token', token).json({
          id: userDoc._id,
          username,
        });
      });
    } else {
      res.status(400).json('wrong credentials');
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json('Internal Server Error');
  }
});

app.get('/profile', (req, res) => {
  const { token } = req.cookies;
  try {
    const info = jwt.verify(token, secret);
    res.json(info);
  } catch (err) {
    console.error('JWT verification failed:', err);
    res.status(500).json('Internal Server Error');
  }
});

app.post('/logout', (req, res) => {
  res.cookie('token', '').json('ok');
});

app.post('/post', uploadMiddleware.single('file'), async (req, res) => {
  try {
    const { originalname, path } = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    const newPath = path + '.' + ext;
    
    // Vercel limitations: Skip file renaming and saving for deployment
    if (process.env.NODE_ENV !== 'production') {
      fs.renameSync(path, newPath);
    }
    
    const { token } = req.cookies;
    const info = jwt.verify(token, secret);
    const { title, summary, content } = req.body;
    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover: process.env.NODE_ENV === 'production' ? 'cloud-storage-url' : newPath,
      author: info.id,
    });
    res.json(postDoc);
  } catch (err) {
    console.error('Post creation error:', err);
    res.status(500).json('Internal Server Error');
  }
});

app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
  let newPath = null;
  if (req.file) {
    const { originalname, path } = req.file;
    const parts = originalname.split('.');
    const ext = parts[parts.length - 1];
    newPath = path + '.' + ext;
    
    // Vercel limitations: Skip file renaming and saving for deployment
    if (process.env.NODE_ENV !== 'production') {
      fs.renameSync(path, newPath);
    }
  }

  try {
    const { token } = req.cookies;
    const info = jwt.verify(token, secret);
    const { id, title, summary, content } = req.body;
    const postDoc = await Post.findById(id);
    const isAuthor = JSON.stringify(postDoc.author) === JSON.stringify(info.id);
    if (!isAuthor) {
      return res.status(400).json('you are not the author');
    }
    await postDoc.update({
      title,
      summary,
      content,
      cover: newPath ? newPath : postDoc.cover,
    });
    res.json(postDoc);
  } catch (err) {
    console.error('Post update error:', err);
    res.status(500).json('Internal Server Error');
  }
});

app.get('/post', async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('author', ['username'])
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(posts);
  } catch (err) {
    console.error('Error fetching posts:', err);
    res.status(500).json('Internal Server Error');
  }
});

app.get('/post/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const postDoc = await Post.findById(id).populate('author', ['username']);
    res.json(postDoc);
  } catch (err) {
    console.error('Error fetching post by ID:', err);
    res.status(500).json('Internal Server Error');
  }
});

// Start server
app.listen(process.env.PORT || 4000, () => {
  console.log(`Server running on port ${process.env.PORT || 4000}`);
});

module.exports = app;
