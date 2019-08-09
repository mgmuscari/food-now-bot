exports.handler = function(context, event, callback) {
    const fs = require('fs');
    const spatialite = require('spatialite');
    const https = require('https');

    console.log(event.Memory);
    
    let memory = JSON.parse(event.Memory);
	
    let address = memory.twilio.collected_data.user_location.answers.address.answer;
    let city = memory.twilio.collected_data.user_location.answers.city.answer;

    let address_formatted = address.split(" ").join("%20")
    
    let location = address_formatted + ",%20" + city + ",%20CA"
    
    let google_link = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${location}&inputtype=textquery&fields=geometry,formatted_address&key=${context.GMAPS_TOKEN}`

    https.get(google_link, (resp) => {
	let data = '';
	
	// A chunk of data has been recieved.
	resp.on('data', (chunk) => {
            data += chunk;
	});

	resp.on('end', () => {
            let address_results = JSON.parse(data)  
            let address = address_results.candidates[0]
	    let address_geo = address.geometry
	    let address_lat = address_geo.location.lat
	    let address_lng = address_geo.location.lng
            let formatted_address = address.formatted_address


	    // Get the path to the Private Asset
	    let assets = Runtime.getAssets();
	    let file = Runtime.getAssets()['/pantries.sqlite'];
	    
	    let db = new spatialite.Database(file.path);

	    let query = `select *, Distance(coords, MakePoint(${address_lat}, ${address_lng})) as dist from pantries order by dist asc limit 1`
	    
	    db.spatialite(function(err) {
		db.each(query, function(err, row) {
		    console.log("Row from sqlite:" + JSON.stringify(row));

		    let responseObject = {
			"actions": [
			    {
				"say": `I found ${row.name} at ${row.address} in ${row.city}, ${row.state}`
			    },
			    {
				"remember": {
				    "user_formatted_address": formatted_address,
				    "user_geo": {"lat": address_lat, "lng": address_lng},
				    "pantry_name": row.name,
				    "pantry_address": row.address,
				    "pantry_city": row.city,
				    "pantry_state": row.state
				}
			    }
			]
		    };
		    callback(null, responseObject);
		});
	    });
	    
            
	});
	
    }).on("error", (err) => {
	console.log("Error: " + err.message);
    });
    
};
