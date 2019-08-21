const fs = require('fs');
const admzip = require('adm-zip');
const spatialite = require('spatialite');
const stringsim = require('string-similarity');

String.prototype.capitalize = function() {
  return this.charAt(0).toUpperCase() + this.slice(1)
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


exports.handler = function(context, event, callback) {

    let memory = JSON.parse(event.Memory);
    
    let city = memory.twilio.collected_data.user_location.answers.city.answer;

    console.log(`City is ${city}`)
    
    if (!fs.existsSync('/tmp/pantries.sqlite')) {
        let file = Runtime.getAssets()['/pantries.sqlite.zip'];
        let zip = new admzip(file.path);
        let entries = zip.getEntries();
        let database = entries[0];
	fs.writeFileSync('/tmp/pantries.sqlite', database.getData());
    }

    let db = new spatialite.Database('/tmp/pantries.sqlite');

    db.spatialite(async function(err) {
	if (err) {
	    console.log(err);
	    let responseObject = {
		"actions": [
		    {
			"say": "I'm sorry, something went wrong."
		    }
		]
	    }
	    callback(null, responseObject);
	} else {
	    let matchedCity = await matchCity(db, city);
                

	    let responseObject = {
		"actions": [
		    {
			"say": `I can help you find food in ${matchedCity}`,
		    },
		    {
			"remember": {
			    matchedCity: matchedCity
			}
		    },
		    {
			"collect": {
			    "name": "user_location",
			    "questions": [
				{
				    "question": "What is your address?",
				    "name": "address"
				}
			    ],
			    "on_complete": {
				"redirect": "https://foodbank-8297-dev.twil.io/get-address"
			    }
			}
		    }
		]
	    };
	    callback(null, responseObject);
	}
    })
    
}
