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


router.route('/')
    .all(csrfProtection)

    .get((req, res) => {
        let numSig = 0;
        db.query(`SELECT COUNT(*) FROM users`).then(function(result) {
            numSig = result.rows[0].count;

            res.render('signup', {
                csrfToken: req.csrfToken(),
                numSig
            });
        });
    })

    .post((req, res) => {



        if (req.body.First.length > 0 || req.body.Last.length > 0) {
            if(!req.body.First) {
                req.body.First = null;
            }
            if(!req.body.Last) {
                req.body.Last = null;
            }
            db.query(`INSERT INTO users (first, last) VALUES ($1, $2) RETURNING id`, [req.body.First, req.body.Last])
                .then(function(result){
                    delSignerCache();
                    req.session.user = {
                        id: result.rows[0].id,
                        first: req.body.First,
                        last: req.body.Last,
                    };
                })
                .then(function(){
                    if(!req.body.sig) {
                        req.body.sig = null;
                    }
                    db.query(`INSERT INTO signatures (user_id, signature) VALUES ($1, $2) RETURNING id`, [req.session.user.id, req.body.sig]).then(function(result) {
                        req.session.user.sigId = result.rows[0].id;
                    }).catch(function(err) {
                        console.log(err);
                    });

                    if(!req.body.city) {
                        req.body.city = null;
                    }
                    db.query(`INSERT INTO user_profiles (user_id, city) VALUES ($1, $2)`, [req.session.user.id, req.body.city]);

                    res.redirect('/signers');
                })
                .catch(function(err) {
                    console.log(err);

                    res.render('signup', {
                        csrfToken: req.csrfToken(),
                        error: 'Oops, something went wrong. Please try again!'
                    });
                });
        } else {
            res.render('signup', {
                csrfToken: req.csrfToken(),
                error: 'Please enter your info!'
            });
        }
    })
;

// router.get('/signed', function (req, res) {
//     let numSig = 0;
//     if (req.session.user.sigId) {
//         db.query(`SELECT COUNT(*) FROM signatures`).then(function(result) {
//             numSig = result.rows[0].count;
//         }).then(function(){
//             db.query(`SELECT signature FROM signatures WHERE id = $1`, [req.session.user.sigId]).then(function(result){
//                 res.render('signed', {
//                     img: result.rows[0].signature,
//                     numSig: numSig,
//                     name: req.session.user.first + ' ' + req.session.user.last
//                 });
//             });
//         }).catch(function(err) {
//             console.log(err);
//         });
//     } else {
//         res.redirect('/');
//     }
// });


router.get('/signers', function (req, res) {
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
            db.query(`SELECT users.first AS first , users.last AS last, user_profiles.city
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
});

router.get('/cities/:city', (req,res) => {
    db.query(`SELECT users.first AS first, users.last AS last
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
});
//
// router.route('/edit')
//
//     .all(csrfProtection)
//
//     .get((req, res) => {
//         db.query(`SELECT users.first, users.last, user_profiles.age, user_profiles.url, user_profiles.city, users.mail
//             FROM user_profiles JOIN users ON users.id = user_profiles.user_id WHERE users.id = $1`, [req.session.user.id]).then(function(result){
//             delSignerCache();
//             res.render('edit', {
//                 csrfToken: req.csrfToken(),
//                 first:  result.rows[0].first,
//                 last:  result.rows[0].last,
//                 mail:  result.rows[0].mail,
//                 city: result.rows[0].city,
//                 age: result.rows[0].age,
//                 homepage:  result.rows[0].url
//             });
//         }).catch(function(err){
//             console.log(err);
//         });
//     })
//
//     .post((req,res) =>{
//         if (req.body.age == '') {
//             req.body.age = null;
//         }
//         req.session.user.first = req.body.First;
//         req.session.user.last = req.body.Last;
//         if (req.body.pass.length > 0) {
//             bcrypt.hashPassword(req.body.pass).then(function(hash){
//                 db.query(`UPDATE users SET first = $1, last = $2, mail = $3, pass = $4 WHERE id = $5`, [req.body.First, req.body.Last, req.body.mail, hash, req.session.user.id]);
//             });
//         } else {
//             db.query(`UPDATE users SET first = $1, last = $2, mail = $3 WHERE id = $4`, [req.body.First, req.body.Last, req.body.mail, req.session.user.id]);
//         }
//         db.query(`UPDATE user_profiles SET age = $1, city = $2, url = $3 WHERE user_id = $4`, [req.body.age, req.body.city, req.body.homepage, req.session.user.id]).then(function(){
//             res.redirect('/signed');
//         }).catch(function(err){
//             console.log(err);
//             db.query(`SELECT users.first, users.last, user_profiles.age, user_profiles.url, user_profiles.city, users.mail
//                 FROM user_profiles JOIN users ON users.id = user_profiles.user_id WHERE users.id = $1`, [req.session.user.id]).then(function(result){
//                 res.render('edit', {
//                     csrfToken: req.csrfToken(),
//                     first:  result.rows[0].first,
//                     last:  result.rows[0].last,
//                     mail:  result.rows[0].mail,
//                     city: result.rows[0].city,
//                     age: result.rows[0].age,
//                     homepage:  result.rows[0].url,
//                     error: 'Oops, something went wrong. Please try again!'
//                 });
//             });
//         });
//     })
// ;

// router.get('/delete', (req,res) => {
//     db.query(`DELETE FROM signatures WHERE id = $1`, [req.session.user.sigId]).then(function(){
//         req.session.user.sigId = null;
//         res.redirect('/sign');
//     });
// });

// router.get('/logout', (req, res) => {
//     req.session.destroy(res.redirect('/'));
//     // req.session = null;
// });

router.get('*', function(req,res) {
    res.redirect('/');
});

module.exports = router;
