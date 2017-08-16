const spicedPg = require('spiced-pg');
const secrets = require('./secrets.json');
const db = spicedPg(`postgres:${secrets.dbUser}:${secrets.dbPass}@localhost:5432/david`);

var universe = 'DC';
var id = 2;

db.query(`SELECT * FROM superheroes WHERE universe = $1 AND id = $2`, [
    universe,
    id
]).then(function(result) {
    console.log(result.rows[0]);
}).catch(function(e){
    console.log(e);
});
