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

var cookieSession = require('cookie-session');

app.use(cookieSession({
    secret: secrets.sessionSecret,
    maxAge: 1000 * 60 * 60 * 24 * 14
}));

app.use(require('cookie-parser')());

app.use(function cookieCheck(req, res, next) {
    if (req.session.sigId && req.url == '/') {
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
    if (req.session.sigId) {
        db.query(`SELECT COUNT(*) FROM signatures`).then(function(result) {
            numSig = result.rows[0].count;


        }).then(function(){

            db.query(`SELECT signature FROM signatures WHERE id = ${req.session.sigId}`).then(function(result){
                res.render('signed', {
                    img: result.rows[0].signature,
                    numSig: numSig
                });
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
    if (req.session.sigId) {
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
        db.query(`INSERT INTO signatures (first, last, signature) VALUES ($1, $2, $3) RETURNING id`, [req.body.First, req.body.Last, req.body.sig]).then(function(result) {
            req.session.sigId = result.rows[0].id;

            // console.log(result);

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

app.get('/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

app.get('*', function(req,res) {
    res.redirect('/');
});

app.listen(8080, () => console.log(`I'm listening`));
