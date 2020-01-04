require('dotenv').config();
var createError = require('http-errors');
var cookieSession = require('cookie-session');
var express = require('express');
var path = require('path');
var logger = require('morgan');
var i18n = require('i18n');
var debug = require('debug')('dwb:app');

var localeRouter = require('./routes/locale');
var indexRouter = require('./routes/index');
var noArticleRouter = require('./routes/no-article');

var app = express();

// basic setup
app.use(express.static(path.join(__dirname, 'public')));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// cookie setup
app.set('trust proxy', 1);
app.use(cookieSession({
  name: 'session',
  keys: ["dwbkey1", "dwbkey2"],
  maxAge: 24 * 60 * 60 * 1000 // 24 hours
}));

// i18n setup and redirecting
i18n.configure({
  locales: ['en-GB', 'cy'],
  defaultLocale: 'en-GB',
  autoReload: true,
  directory: path.join(__dirname, '/locales')
});

app.use(i18n.init);
app.use(localeRouter);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use('/', indexRouter);
app.use('/no-article', noArticleRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
