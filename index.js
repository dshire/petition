var express = require('express');
var app = express();
app.use(require('body-parser').urlencoded({
    extended: false
}));

const router = require('./routers/router');
const secrets = require('./secrets.json');
var hb = require('express-handlebars');
app.engine('handlebars', hb({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

var cookieSession = require('cookie-session');

app.use(cookieSession({
    secret: secrets.sessionSecret,
    maxAge: 1000 * 60 * 60 * 24 * 14
}));

app.use(require('cookie-parser')());

app.use(function cookieCheck(req, res, next) {
    if (req.session.user && (req.url == '/' || req.url == "/login")) {
        res.redirect('/sign');
    } else if (req.session.user && req.session.user.sigId && req.url == '/sign') {
        res.redirect('/signed');
    } else if (!req.session.user && (req.url == '/sign' || req.url == '/edit' || req.url == '/delete' || req.url == '/logout')) {
        res.redirect('/');
    } else {
        next();
    }
});

app.use(express.static(__dirname + '/public'));

app.use(router);

app.listen(8080, () => console.log(`I'm listening`));
