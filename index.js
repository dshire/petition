var express = require('express');
var app = express();
const router = require('./routers/router');

var hb = require('express-handlebars');
app.engine('handlebars', hb({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

// var cookieSession = require('cookie-session');
// router.use(cookieSession({
//     secret: sessionSecret,
//     maxAge: 1000 * 60 * 60 * 24 * 14
// }));

var session = require('express-session'),
    Store = require('connect-redis')(session);

var sessionSecret;
if (process.env.SESSION_SECRET) {
    sessionSecret = process.env.SESSION_SECRET;
} else {
    const secrets = require('./secrets.json');
    sessionSecret = secrets.sessionSecret;
}
app.use(require('cookie-parser')());
app.use(session({
    store: new Store({
        ttl: 3600,
        host: process.env.REDIS_URL || 'localhost',
        port: 6379
    }),
    resave: false,
    saveUninitialized: true,
    secret: sessionSecret
}));

var favicon = require('serve-favicon');
app.use(favicon(__dirname + '/public/images/favicon.ico'));

app.use(express.static(__dirname + '/public'));

app.use(router);

app.listen(process.env.PORT || 8080, function() {
    console.log('Listening on port:8080');
});
