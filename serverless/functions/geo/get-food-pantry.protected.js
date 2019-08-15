const fs = require('fs');
const spatialite = require('spatialite');
const request = require('request');
const md5file = require('md5-file');
const admzip = require('adm-zip');
const stringsim = require('string-similarity');

String.prototype.capitalize = function() {
  return this.charAt(0).toUpperCase() + this.slice(1)
}

function getAddressLatLon(context, address, city, state) {
    let address_formatted = encodeURI(address);
    let location = `${address_formatted},%20${city},%20${state}`;
    let google_link = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${location}&inputtype=textquery&fields=geometry,formatted_address&key=${context.GMAPS_TOKEN}`;
    console.log(`Google link: ${google_link}`);
    return new Promise(
	function(resolve, reject) {
	    request.get({"url": google_link}, (err, resp, body) => {
		if(err) {
		    console.log(`Got error from google: ${err}`);
		    reject(console.log(err));
		} else {
		    console.log(`Got result from google: ${body}`);
		    resolve(JSON.parse(body));
		}
		
	    })
	});
}

function matchCity(db, city) {
    return matchedCityPromise = new Promise(function(complete, reject) {
	db = db.all("select lower(name) as name from cities", function(err, rows) {
	    if(err) {
		reject(err);
	    } else {
		let matchedCity = stringsim.findBestMatch(city.toLowerCase(), rows.map(r => r['name']))['bestMatch']['target'].capitalize();
		complete(matchedCity);
	    }
	});
    });
}

function findPantries(db, lat, lon) {
    let query = `select *, Distance(coords, MakePoint(${lat}, ${lon})) as dist from pantries order by dist asc`
    return new Promise((complete, reject) => {
	db = db.all(query, function(err, rows) {
	    if(err) {
		reject(err);
	    } else {
		complete(rows);
	    }
	});
    });
}

function respondWithPantry(formatted_address, lat, lng, pantry_name, pantry_address, pantry_city, pantry_state, callback) {
    let responseObject = {
	"actions": [
	    {
		"say": `I found ${pantry_name} at ${pantry_address} in ${pantry_city}, ${pantry_state}`
	    },
	    {
		"remember": {
		    "user_formatted_address": formatted_address,
		    "user_geo": {"lat": lat, "lng": lng},
		    "pantry_name": pantry_name,
		    "pantry_address": pantry_address,
		    "pantry_city": pantry_city,
		    "pantry_state": pantry_state
		}
	    }
	]
    };
    callback(null, responseObject);
}

exports.handler = function(context, event, callback) {

    let contextChain = {};
    
    let memory = JSON.parse(event.Memory);

    let address = memory.twilio.collected_data.user_location.answers.address.answer;
    let city = memory.twilio.collected_data.user_location.answers.city.answer;

    // Get the path to the Private Asset
    let assets = Runtime.getAssets();
    
    if (!fs.existsSync('/tmp/pantries.sqlite')) {
	let file = Runtime.getAssets()['/pantries.sqlite.zip'];
	let zip = new admzip(file.path);
	let entries = zip.getEntries();
	let database = entries[0];
	fs.writeFileSync('/tmp/pantries.sqlite', database.getData());
    }

    var db = new spatialite.Database('/tmp/pantries.sqlite');

    let address_res
    let formatted_address
    let address_geo
    let address_lat
    let address_lng
    
    
    db.spatialite(function(err) {
	let matchedCityPromise = matchCity(db, city);
	let addressLatLonPromise = matchedCityPromise.then( (matchedCity) => getAddressLatLon(context, address, matchedCity, "CA"));
	let dbResult = addressLatLonPromise.then((addressLatLon) => {
	    console.log(addressLatLon);
	    
	    address_res = addressLatLon.candidates[0]
	    formatted_address = address.formatted_address
	    
	    address_geo = address_res.geometry
	    address_lat = address_geo.location.lat
	    address_lng = address_geo.location.lng
           
	    console.log("Querying sqlite database...");
	    return pantriesPromise = findPantries(db, address_lat, address_lng);
	});
	    
	dbResult.then((pantries) => {
	    let row = pantries[0];
	    respondWithPantry(formatted_address, address_lat, address_lng, row.name, row.address, row.city, row.state, callback);
	});
	
    });
    
};
