var express = require('express'),
    router = express.Router();
var cookieSession = require('cookie-session');
const spicedPg = require('spiced-pg');


var db;
if (process.env.DATABASE_URL) {
    db = spicedPg(process.env.DATABASE_URL);
} else {
    const secrets = require('../secrets.json');
    db = spicedPg(`postgres:${secrets.dbUser}:${secrets.dbPass}@localhost:5432/petition`);
}

var sessionSecret;
if (process.env.SESSION_SECRET) {
    sessionSecret = process.env.SESSION_SECRET;
} else {
    const secrets = require('../secrets.json');
    sessionSecret = secrets.sessionSecret;
}

const bcrypt = require('../bcrypt.js');

var csrf = require('csurf');
var csrfProtection = csrf();

router.use(require('body-parser').urlencoded({
    extended: false
}));
router.use(require('cookie-parser')());

router.use(cookieSession({
    secret: sessionSecret,
    maxAge: 1000 * 60 * 60 * 24 * 14
}));


router.use(function cookieCheck(req, res, next) {
    if (req.session.user && (req.url == '/' || req.url == "/login")) {
        res.redirect('/sign');
    } else if (req.session.user && req.session.user.sigId && req.url == '/sign') {
        res.redirect('/signed');
    } else if (!req.session.user && (req.url == '/sign' || req.url == '/edit' || req.url == '/delete' || req.url == '/info' || req.url == '/logout')) {
        res.redirect('/');
    } else {
        next();
    }
});

router.route('/')
    .all(csrfProtection)

.get((req, res) => {
    res.render('signup', {
        csrfToken: req.csrfToken()
    });
})

.post((req, res) => {
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
})
;


router.get('/welcome', (req, res) => {
    res.render('welcome', {
        layout: 'welcome-main'
    });
});

router.route('/info')
    .all(csrfProtection)

    .get((req,res) => {
        res.render('info', {
            csrfToken: req.csrfToken()
        });
    })

    .post((req,res) => {
        if(!req.body.age) {
            req.body.age = null;
        }
        db.query(`INSERT INTO user_profiles (user_id, age, city, url) VALUES ($1, $2, $3, $4)`, [req.session.user.id, req.body.age, req.body.city, req.body.homepage]).then(function() {
            res.redirect('/sign');
        }).catch(function(err) {
            console.log(err);
        });
    })
    ;

router.route('/login')

    .all(csrfProtection)

    .get(function(req, res) {
        res.render('login', {
            csrfToken: req.csrfToken()
        });
    })

    .post((req, res) => {
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
    })
;

router.route('/sign')

    .all(csrfProtection)

    .get(function (req, res) {
        res.render('petition', {
            csrfToken: req.csrfToken(),
            name: req.session.user.first + ' ' + req.session.user.last
        });
    })

    .post((req, res) => {
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
    })
;

router.get('/signed', function (req, res) {
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

router.route('/signAgain')

    .all(csrfProtection)

    .get((req, res) => {
        let numSig = 0;
        if (req.session.user.sigId) {
            db.query(`SELECT COUNT(*) FROM signatures`).then(function(result) {
                numSig = result.rows[0].count;

            }).then(function(){

                db.query(`SELECT signature FROM signatures WHERE id = $1`, [req.session.user.sigId]).then(function(result){
                    res.render('signAgain', {
                        csrfToken: req.csrfToken(),
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
    })

    .post((req, res) => {
        if (req.body.sig.length > 0) {
            db.query(`UPDATE signatures SET signature = $1 WHERE user_id = $2`, [req.body.sig, req.session.user.id]).then(function() {
                res.redirect('/signed');
            }).catch(function(err) {
                console.log(err);
            });
        } else {
            res.redirect('/signAgain');
        }
    })
;

router.get('/signers', function (req, res) {
    if (req.session.user.sigId) {
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

router.get('/cities/:city', (req,res) => {
    if (req.session.user.sigId) {
        db.query(`SELECT users.first AS first, users.last AS last, user_profiles.age
        FROM signatures JOIN users ON users.id = signatures.user_id
        JOIN user_profiles ON users.id = user_profiles.user_id WHERE user_profiles.city = $1`, [req.params.city]).then(function(result) {
            res.render ('city', {
                city: req.params.city,
                signers: result.rows
            });
        }).catch(function(err) {
            console.log(err);
        });
    } else {
        res.redirect('/');
    }
});

router.route('/edit')

    .all(csrfProtection)

    .get((req, res) => {
        db.query(`SELECT users.first, users.last, user_profiles.age, user_profiles.url, user_profiles.city, users.mail
            FROM user_profiles JOIN users ON users.id = user_profiles.user_id WHERE users.id = $1`, [req.session.user.id]).then(function(result){
                res.render('edit', {
                    csrfToken: req.csrfToken(),
                    first:  result.rows[0].first,
                    last:  result.rows[0].last,
                    mail:  result.rows[0].mail,
                    city: result.rows[0].city,
                    age: result.rows[0].age,
                    homepage:  result.rows[0].url
                });
            }).catch(function(err){
                console.log(err);
            });
    })

    .post((req,res) =>{
        if (req.body.age == '') {
            req.body.age = null;
        }
        req.session.user.first = req.body.First;
        req.session.user.last = req.body.Last;
        if (req.body.pass.length > 0) {
            bcrypt.hashPassword(req.body.pass).then(function(hash){
                db.query(`UPDATE users SET first = $1, last = $2, mail = $3, pass = $4 WHERE id = $5`, [req.body.First, req.body.Last, req.body.mail, hash, req.session.user.id]);
            });
        } else {
            db.query(`UPDATE users SET first = $1, last = $2, mail = $3 WHERE id = $4`, [req.body.First, req.body.Last, req.body.mail, req.session.user.id]);
        }
        db.query(`UPDATE user_profiles SET age = $1, city = $2, url = $3 WHERE user_id = $4`, [req.body.age, req.body.city, req.body.homepage, req.session.user.id]).then(function(){
            res.redirect('/signed');
        }).catch(function(err){
            console.log(err);
            db.query(`SELECT users.first, users.last, user_profiles.age, user_profiles.url, user_profiles.city, users.mail
                FROM user_profiles JOIN users ON users.id = user_profiles.user_id WHERE users.id = $1`, [req.session.user.id]).then(function(result){
                    res.render('edit', {
                        first:  result.rows[0].first,
                        last:  result.rows[0].last,
                        mail:  result.rows[0].mail,
                        city: result.rows[0].city,
                        age: result.rows[0].age,
                        homepage:  result.rows[0].url,
                        error: 'Oops, something went wrong. Please try again!'
                    });
                });
        });
    })
;

router.get('/delete', (req,res) => {
    db.query(`DELETE FROM signatures WHERE id = $1`, [req.session.user.sigId]).then(function(){
        req.session.user.sigId = null;
        res.redirect('/sign');
    });
});

router.get('/logout', (req, res) => {
    req.session = null;
    res.redirect('/');
});

router.get('*', function(req,res) {
    res.redirect('/');
});

module.exports = router;
