var express = require('express');
var app = express();
app.use(require('body-parser').urlencoded({
    extended: false
}));

const spicedPg = require('spiced-pg');
const secrets = require('./secrets.json');
const db = spicedPg(`postgres:${secrets.dbUser}:${secrets.dbPass}@localhost:5432/petition`);

var hb = require('express-handlebars');
app.engine('handlebars', hb({defaultLayout: 'main'}));
app.set('view engine', 'handlebars');

app.use(require('cookie-parser')());

app.use(function cookieCheck(req, res, next) {
    if (req.cookies.cookieTest == 'yes' && req.url == '/') {
        res.redirect('/signed');
    }  else {
        next();
    }

});

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res) {
    res.render('petition', {

    });
});

app.get('/signed', function (req, res) {
    let numSig = 0;
    if (req.cookies.cookieTest && req.cookies.cookieTest == 'yes') {
        db.query(`SELECT COUNT(*) FROM signatures`).then(function(result) {
            numSig = result.rows[0].count;
            res.render('signed', {
                numSig: numSig
            });
        }).catch(function(err) {
            console.log(err);
        });

    } else {
        res.redirect('/');
    }
});

app.get('/signers', function (req, res) {
    let list = [];
    if (req.cookies.cookieTest && req.cookies.cookieTest == 'yes') {
        db.query(`SELECT first , last FROM signatures`).then(function(result){

            list = result.rows;
            res.render('signers', {
                signers: list
            });
        }).catch(function(err) {
            console.log(err);
        });
    } else {
        res.redirect('/');
    }
});


app.post('/', (req, res) => {
    if (req.body.First.length > 0 && req.body.Last.length > 0 && req.body.sig.length > 0) {
        db.query(`INSERT INTO signatures (first, last, signature) VALUES ($1, $2, $3)`, [req.body.First, req.body.Last, req.body.sig]).then(function(log) {

            res.cookie('cookieTest', 'yes', {
                httpOnly: true
            });

            console.log(log);

            res.redirect('/signed');
        }).catch(function(err) {
            console.log(err);
        });

    } else {
        res.render('petition', {
            error: 'Oops, something went wrong. Please try again!'
        });
    }
});

app.get('/:anything', function(req,res) {
    res.redirect('/');
});

app.listen(8080, () => console.log(`I'm listening`));
