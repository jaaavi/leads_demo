const express = require('express');
const path = require('path');
const session = require('express-session');

const app = express();
const rootDir = path.join(__dirname, '..');

app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(rootDir, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/static', express.static(path.join(rootDir, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'demo-public-session-secret-change-in-vercel',
  resave: false,
  saveUninitialized: false,
  name: 'demoSessionId',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

app.use((req, res, next) => {
  res.locals.session = req.session;
  res.locals.demoMode = true;
  next();
});

app.use('/', require('../routes/demo'));

module.exports = app;
