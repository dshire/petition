var express = require('express'),
    router = express.Router();

const spicedPg = require('spiced-pg');

var redis = require('redis');
var client = redis.createClient(process.env.REDIS_URL ||
    {
        host: 'localhost',
        port: 6379
    });
client.on('error', function(err) {
    console.log(err);
});

var db;
if (process.env.DATABASE_URL) {
    db = spicedPg(process.env.DATABASE_URL);
} else {
    const secrets = require('../secrets.json');
    db = spicedPg(`postgres:${secrets.dbUser}:${secrets.dbPass}@localhost:5432/petition`);
}

var delSignerCache = function(){
    client.del('signerList', (err, data) => {
        if (err) {
            return console.log(err);
        }
    });
};


const bcrypt = require('../bcrypt.js');

var csrf = require('csurf');
var csrfProtection = csrf();

router.use(require('body-parser').urlencoded({
    extended: false
}));


router.use(function cookieCheck(req, res, next) {
    if (req.session.user && (req.url == '/' || req.url == "/login" || req.url == "/enter")) {
        res.redirect('/sign');
    } else if (req.session.user && req.session.user.sigId && req.url == '/sign') {
        res.redirect('/signed');
    } else if (!req.session.user && (req.url == '/sign' || req.url == '/edit' || req.url == '/delete' || req.url == '/info' || req.url == '/logout')) {
        res.redirect('/');
    } else {
        next();
    }
});

router.route('/enter')
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
                    csrfToken: req.csrfToken(),
                    error: 'Oops, something went wrong. Please try again!'
                });
            }
        });
    } else {
        res.render('signup', {
            csrfToken: req.csrfToken(),
            error: 'Please fill out all fields!'
        });
    }
})
;


router.get('/', (req, res) => {
    res.render('welcome', {
        layout: 'map-main'
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
            delSignerCache();
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
            var userInfo;
            return db.query(`SELECT * FROM users WHERE mail = $1`, [req.body.mail]).then(function(result){
                userInfo = result;
                return bcrypt.checkPassword(req.body.pass, result.rows[0].pass);
            }).then(function(correctPass) {
                if (correctPass) {


                    client.get(req.body.mail, (err, data) => {
                        if (err) {
                            return console.log(err);
                        }
                        if (data >= 3) {
                            var tries = data;
                            client.ttl(req.body.mail, (err, data) => {
                                if (err) {
                                    return console.log(err);
                                }
                                res.render('login', {
                                    block: true,
                                    timer: data,
                                    csrfToken: req.csrfToken(),
                                    error: 'You entered the wrong password ' + tries + ' times. Wait ' + data + ' seconds to try again.'
                                });
                            });
                        } else {

                            client.del(req.body.mail, (err, data) => {
                                if (err) {
                                    return console.log(err);
                                }
                            });
                            client.del((req.body.mail + 'Err'), (err, data) => {
                                if (err) {
                                    return console.log(err);
                                }
                            });
                            req.session.user = {
                                id: userInfo.rows[0].id,
                                first: userInfo.rows[0].first,
                                last: userInfo.rows[0].last
                            };
                            db.query(`SELECT signature, id FROM signatures WHERE user_id = $1`, [userInfo.rows[0].id]).then(function(result){
                                if (result.rows[0] && result.rows[0].signature && result.rows[0].signature.length > 0) {
                                    req.session.user.sigId = result.rows[0].id;
                                    res.redirect('/signed');
                                } else { res.redirect('/sign');}
                            });

                        }
                    });

                } else {
                    client.incr((req.body.mail + 'Err'), (err, data) => {
                        if (err) {
                            return console.log(err);
                        }
                        client.get((req.body.mail + 'Err'), (err, data) => {
                            if (err) {
                                return console.log(err);
                            }
                        });
                    });

                    client.get(req.body.mail, (err, data) => {
                        if (err) {
                            return console.log(err);
                        }
                        if (data) {
                            client.incr(req.body.mail, (err, data) => {
                                if (err) {
                                    return console.log(err);
                                }
                                if (data >= 3) {
                                    var timer = 30 + ((data - 3) * 30);

                                    client.expire(req.body.mail, timer, (err, data) => {
                                        if (err) {
                                            return console.log(err);
                                        }
                                    });

                                    res.render('login', {
                                        block: true,
                                        timer: timer,
                                        csrfToken: req.csrfToken(),
                                        error: 'You entered the wrong password ' + data + ' times. Wait ' + timer + ' seconds to try again.'
                                    });
                                } else {
                                    res.render('login', {
                                        csrfToken: req.csrfToken(),
                                        error: 'Wrong mail or password, please try again!'
                                    });
                                }
                            });
                        } else {
                            client.get((req.body.mail + 'Err'), (err, data) => {
                                if (err) {
                                    return console.log(err);
                                }

                                if (data) {
                                    client.set(req.body.mail, data, (err, data) => {
                                        if (err) {
                                            return console.log(err);
                                        }
                                        client.expire(req.body.mail, 60, (err, data) => {
                                            if (err) {
                                                return console.log(err);
                                            }
                                        });
                                        client.get(req.body.mail, (err, data) => {
                                            if (err) {
                                                return console.log(err);
                                            }
                                            if (data >= 3) {
                                                var timer = 30 + ((data - 3) * 30);

                                                client.expire(req.body.mail, timer, (err, data) => {
                                                    if (err) {
                                                        return console.log(err);
                                                    }
                                                });

                                                res.render('login', {
                                                    block: true,
                                                    timer: timer,
                                                    csrfToken: req.csrfToken(),
                                                    error: 'You entered the wrong password ' + data + ' times. Wait ' + timer + ' seconds to try again.'
                                                });

                                            } else {
                                                res.render('login', {
                                                    csrfToken: req.csrfToken(),
                                                    error: 'Wrong mail or password, please try again!'
                                                });
                                            }
                                        });


                                    });


                                } else {

                                    client.set(req.body.mail, 1, (err, data) => {
                                        if (err) {
                                            return console.log(err);
                                        }
                                        client.expire(req.body.mail, 60, (err, data) => {
                                            if (err) {
                                                return console.log(err);
                                            }
                                        });
                                    });
                                    res.render('login', {
                                        csrfToken: req.csrfToken(),
                                        error: 'Wrong mail or password, please try again!'
                                    });

                                }

                            });


                        }
                    });
                }
            }).catch(function(err) {
                console.log(err);
                res.render('login', {
                    csrfToken: req.csrfToken(),
                    error: 'Wrong mail or password, please try again!'
                });
            });
        } else {
            res.render('login', {
                csrfToken: req.csrfToken(),
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
                delSignerCache();
                req.session.user.sigId = result.rows[0].id;
                res.redirect('/signed');
            }).catch(function(err) {
                console.log(err);
            });

        } else {
            res.render('petition', {
                csrfToken: req.csrfToken(),
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

        client.get('signerList', function(err, data) {
            if (err) {
                return console.log(err);
            }
            if (data) {
                res.render('signers', {
                    layout: 'signer-main',
                    signers: JSON.parse(data)
                });
                // console.log('signers rendered from redis');
            } else {
                db.query(`SELECT users.first AS first , users.last AS last, user_profiles.age, user_profiles.city, user_profiles.url
                FROM signatures JOIN users ON users.id = signatures.user_id
                JOIN user_profiles ON users.id = user_profiles.user_id`).then(function(result){
                    // console.log(result);
                    client.set('signerList', JSON.stringify(result.rows), (err, data) => {
                        if (err) {
                            return console.log(err);
                        }
                    });
                    // console.log('signers rendered from psql');
                    res.render('signers', {
                        layout: 'signer-main',
                        signers: result.rows
                    });
                }).catch(function(err) {
                    console.log(err);
                });
            }
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
                layout: 'city-main',
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
                delSignerCache();
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
                        csrfToken: req.csrfToken(),
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
    req.session.destroy(res.redirect('/'));
    // req.session = null;
});

router.get('*', function(req,res) {
    res.redirect('/');
});

module.exports = router;
