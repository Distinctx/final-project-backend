const express = require('express');
const cors = require('cors');
const mongoose = require("mongoose");
const User = require('./models/User');
const Post = require('./models/Post');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');

const app = express();

// Load environment variables in development only
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Check environment variables
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

// MongoDB connection with error handling
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(error => console.error('MongoDB connection error:', error));

// Routes

// Registration route
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

// Login route
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

// Profile route
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

// Logout route
app.post('/logout', (req, res) => {
  res.cookie('token', '').json('ok');
});

// Post creation route (with placeholder for file URL)
app.post('/post', async (req, res) => {
  try {
    const { token } = req.cookies;
    const info = jwt.verify(token, secret);
    const { title, summary, content } = req.body;

    // Placeholder URL for cover image in serverless environment
    const cover = "https://placeholder.url"; // Replace with actual storage URL when available

    const postDoc = await Post.create({
      title,
      summary,
      content,
      cover,
      author: info.id,
    });
    res.json(postDoc);
  } catch (err) {
    console.error('Post creation error:', err);
    res.status(500).json('Internal Server Error');
  }
});

// Update post route
app.put('/post', async (req, res) => {
  try {
    const { token } = req.cookies;
    const info = jwt.verify(token, secret);
    const { id, title, summary, content } = req.body;

    const postDoc = await Post.findById(id);
    if (JSON.stringify(postDoc.author) !== JSON.stringify(info.id)) {
      return res.status(400).json('You are not the author');
    }

    await postDoc.update({
      title,
      summary,
      content,
      cover: postDoc.cover, // Using existing cover in serverless environment
    });
    res.json(postDoc);
  } catch (err) {
    console.error('Post update error:', err);
    res.status(500).json('Internal Server Error');
  }
});

// Fetch all posts
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

// Fetch post by ID
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

// Export the app for serverless function
module.exports = app;
