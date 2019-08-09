const spatialite = require('spatialite');
const fs = require('fs');

let input_file = process.argv[2];
let sqlite_file = process.argv[3];

let pantries = JSON.parse(fs.readFileSync(input_file, 'utf8'));

let db = new spatialite.Database(sqlite_file);

let insert = insertPantry.bind(null, db);

db.spatialite(function() {
    db.serialize(function() {
	console.log("Inserting pantries...");
	pantries.forEach(function(pantry) { insert(pantry); });
	console.log("Done. Closing db...");
	db.close();
    });
});

//let db = new spatialite.Database(sqlite_file);


function insertPantry(db, pantry) {
    console.log("Deleting pantry...");
    let delete_pantry = `delete from pantries where id=${pantry.id}`;
    db.run(delete_pantry);
    console.log("Inserting pantry...");
    let insert_pantry = `insert into pantries (id, name, address, city, state, zip, link, phone, email, fax, coords) values (${pantry.id}, "${pantry.store}", "${pantry.address}", "${pantry.city}", "${pantry.state}", "${pantry.zip}", "${pantry.permalink}", "${pantry.phone}", "${pantry.email}", "${pantry.fax}", MakePoint(${pantry.lat}, ${pantry.lng}, 4326))`;
    console.log(insert_pantry);
    db.run(insert_pantry, function(err) {console.log(err)});
}


