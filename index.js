var express = require('express');
var app = express();
const router = require('./routers/router');

var hb = require('express-handlebars');
app.engine('handlebars', hb({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

var favicon = require('serve-favicon');
app.use(favicon(__dirname + '/public/images/favicon.ico'));

app.use(express.static(__dirname + '/public'));

app.use(router);

app.listen(8080, () => console.log(`I'm listening`));
// app.listen(process.env.PORT || 8080);
