const express = require('express');
const cors = require('cors');
const mongoose = require("mongoose");
const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const fs = require('fs');
const dotenv = require('dotenv');

const app = express();

// Load environment variables only in development
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Check if required environment variables are accessible
const salt = bcrypt.genSaltSync(10);
const secret = process.env.JWT_SECRET;
if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
  console.error("Environment variables MONGO_URI or JWT_SECRET are missing.");
  process.exit(1);
}

// Middleware setup
app.use(cors({ credentials: true, origin: 'http://localhost:3000' }));
app.use(express.json());
app.use(cookieParser());

// MongoDB connection with logging
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.error('MongoDB connection error:', error));

// Define file upload handler with conditional handling for Vercel
const uploadMiddleware = multer({ dest: 'uploads/' });

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
    if (userDoc && bcrypt.compareSync(password, userDoc.password)) {
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
    const { token } = req.cookies;
    const info = jwt.verify(token, secret);
    const { title, summary, content } = req.body;

    // Handle file upload only in development
    let cover = null;
    if (req.file && process.env.NODE_ENV !== 'production') {
      const { originalname, path } = req.file;
      const ext = originalname.split('.').pop();
      const newPath = `${path}.${ext}`;
      fs.renameSync(path, newPath);
      cover = newPath;
    }

    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover: cover || 'cloud-storage-url', // Replace with cloud storage if needed
      author: info.id,
    });
    res.json(postDoc);
  } catch (err) {
    console.error('Post creation error:', err);
    res.status(500).json('Internal Server Error');
  }
});

app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
  try {
    const { token } = req.cookies;
    const info = jwt.verify(token, secret);
    const { id, title, summary, content } = req.body;

    let newPath = null;
    if (req.file && process.env.NODE_ENV !== 'production') {
      const { originalname, path } = req.file;
      const ext = originalname.split('.').pop();
      newPath = `${path}.${ext}`;
      fs.renameSync(path, newPath);
    }

    const postDoc = await Post.findById(id);
    if (JSON.stringify(postDoc.author) !== JSON.stringify(info.id)) {
      return res.status(400).json('You are not the author');
    }

    await postDoc.update({
      title,
      summary,
      content,
      cover: newPath || postDoc.cover,
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
