var express = require('express');
var app = express();


const router = require('./routers/router');
const secrets = require('./secrets.json');
var hb = require('express-handlebars');
app.engine('handlebars', hb({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');


var favicon = require('serve-favicon');

app.use(favicon(__dirname + '/public/images/favicon.ico'));



// app.use(function cookieCheck(req, res, next) {
//     if (req.session.user && (req.url == '/' || req.url == "/login")) {
//         res.redirect('/sign');
//     } else if (req.session.user && req.session.user.sigId && req.url == '/sign') {
//         res.redirect('/signed');
//     } else if (!req.session.user && (req.url == '/sign' || req.url == '/edit' || req.url == '/delete' || req.url == '/logout')) {
//         res.redirect('/');
//     } else {
//         next();
//     }
// });

app.use(express.static(__dirname + '/public'));

app.use(router);

app.listen(8080, () => console.log(`I'm listening`));
