var express = require('express');
var app = express();
app.use(require('body-parser').urlencoded({
    extended: false
}));

const spicedPg = require('spiced-pg');
const secrets = require('./secrets.json');
const db = spicedPg(`postgres:${secrets.dbUser}:${secrets.dbPass}@localhost:5432/petition`);
const bcrypt = require('./bcrypt.js');

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
    if (req.session.user && req.url == '/') {
        res.redirect('/sign');
    }  else if (req.session.user && req.session.user.sigId && req.url == '/sign') {
        res.redirect('/signed');
    } else {
        next();
    }
});

app.use(express.static(__dirname + '/public'));

app.get('/', function (req, res){
    res.render('signup', {});
});

app.get('/info', function(req,res) {
    res.render('info', {});
});

app.get('/login', function(req, res) {
    if (req.session.user) {
        res.redirect('/sign');
    } else {
        res.render('login', {});
    }
});

app.get('/sign', function (req, res) {
    if (req.session.user) {
        res.render('petition', {
            name: req.session.user.first + ' ' + req.session.user.last
        });
    } else {
        res.redirect('/');
    }
});

app.get('/signed', function (req, res) {
    let numSig = 0;
    if (req.session.user.sigId) {
        db.query(`SELECT COUNT(*) FROM signatures`).then(function(result) {
            numSig = result.rows[0].count;
        }).then(function(){
            db.query(`SELECT signature FROM signatures WHERE id = $1`, [req.session.user.sigId]).then(function(result){
                res.render('signed', {
                    img: result.rows[0].signature,
                    numSig: numSig,
                    name: req.session.user.first + ' ' + req.session.user.last
                });
            });
        }).catch(function(err) {
            console.log(err);
        });
    } else {
        res.redirect('/');
    }
});

app.get('/signAgain', (req, res) => {
    let numSig = 0;
    if (req.session.user.sigId) {
        db.query(`SELECT COUNT(*) FROM signatures`).then(function(result) {
            numSig = result.rows[0].count;

        }).then(function(){

            db.query(`SELECT signature FROM signatures WHERE id = $1`, [req.session.user.sigId]).then(function(result){
                res.render('signAgain', {
                    img: result.rows[0].signature,
                    numSig: numSig,
                    name: req.session.user.first + ' ' + req.session.user.last
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
    if (req.session.user) {
        db.query(`SELECT users.first AS first , users.last AS last, user_profiles.age, user_profiles.city, user_profiles.url
        FROM signatures JOIN users ON users.id = signatures.user_id
        JOIN user_profiles ON users.id = user_profiles.user_id`).then(function(result){
            // console.log(result);
            res.render('signers', {
                signers: result.rows
            });
        }).catch(function(err) {
            console.log(err);
        });
    } else {
        res.redirect('/');
    }
});

app.get('/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

app.post('/', (req, res) => {
    if (req.body.First.length > 0 && req.body.Last.length > 0 && req.body.mail.length > 0 && req.body.pass.length > 0) {
        bcrypt.hashPassword(req.body.pass).then(function(hash){
            return db.query(`INSERT INTO users (first, last, mail, pass) VALUES ($1, $2, $3, $4) RETURNING id`, [req.body.First, req.body.Last, req.body.mail, hash]);
        }).then(function(result){
            req.session.user = {
                id: result.rows[0].id,
                first: req.body.First,
                last: req.body.Last,
            };
            res.redirect('/info');
        }).catch(function(err) {
            console.log(err);
            if (err.code == 23505) {
                res.render('signup', {
                    error: 'This Email address is already in use. Please choose a different one!'
                });
            } else {
                res.render('signup', {
                    error: 'Oops, something went wrong. Please try again!'
                });
            }
        });
    } else {
        res.render('signup', {
            error: 'Please fill out all fields!'
        });
    }
});

app.post('/info', (req,res) => {
    if(!req.body.age) {
        req.body.age = null;
    }
    db.query(`INSERT INTO user_profiles (user_id, age, city, url) VALUES ($1, $2, $3, $4)`, [req.session.user.id, req.body.age, req.body.city, req.body.homepage]).then(function() {
        res.redirect('/sign');
    }).catch(function(err) {
        console.log(err);
    });
});

app.post('/login', (req, res) => {
    if (req.body.mail.length > 0 && req.body.pass.length > 0) {
        var results;
        return db.query(`SELECT * FROM users WHERE mail = $1`, [req.body.mail]).then(function(result){
            results = result;
            return bcrypt.checkPassword(req.body.pass, result.rows[0].pass);
        }).then(function(correctPass) {
            if (correctPass) {
                req.session.user = {
                    id: results.rows[0].id,
                    first: results.rows[0].first,
                    last: results.rows[0].last
                };
                db.query(`SELECT signature, id FROM signatures WHERE user_id = $1`, [results.rows[0].id]).then(function(result){

                    if (result.rows[0].signature && result.rows[0].signature.length > 0) {
                        req.session.user.sigId = result.rows[0].id;
                        res.redirect('/signed');
                    } else { res.redirect('/sign');}
                });
            } else {
                res.render('login', {
                    error: 'Wrong mail or password, please try again!',
                });
            }
        });

    } else {
        res.render('login', {
            error: 'Please fill out both fields!',
        });
    }
});

app.post('/sign', (req, res) => {
    if (req.body.sig.length > 0) {
        db.query(`INSERT INTO signatures (user_id, signature) VALUES ($1, $2) RETURNING id`, [req.session.user.id, req.body.sig]).then(function(result) {
            req.session.user.sigId = result.rows[0].id;
            res.redirect('/signed');
        }).catch(function(err) {
            console.log(err);
        });

    } else {
        res.render('petition', {
            error: 'Oops, something went wrong. Please try again!',
            name: req.session.user.first + ' ' + req.session.user.last
        });
    }
});

app.post('/signAgain', (req, res) => {
    if (req.body.sig.length > 0) {
        db.query(`UPDATE signatures SET signature = $1 WHERE user_id = $2`, [req.body.sig, req.session.user.id]).then(function() {
            res.redirect('/signed');
        }).catch(function(err) {
            console.log(err);
        });
    } else {
        res.redirect('/signAgain');
    }
});

app.get('*', function(req,res) {
    res.redirect('/');
});

app.listen(8080, () => console.log(`I'm listening`));
