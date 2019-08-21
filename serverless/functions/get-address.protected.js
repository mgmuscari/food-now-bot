const request = require('request');

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


exports.handler = function(context, event, callback) {

    let memory = JSON.parse(event.Memory);

    console.log(memory)
    
    let address = memory.twilio.collected_data.user_location.answers.address.answer;
    let matchedCity = memory.matchedCity
    
    let addressLatLonPromise = getAddressLatLon(context, address, matchedCity, "CA");
    addressLatLonPromise.then(
	function(addressLatLon) {
	    console.log(addressLatLon);
	    
	    let address_res = addressLatLon.candidates[0]
	    let formatted_address = address.formatted_address

	    let address_geo = address_res.geometry
	    let address_lat = address_geo.location.lat
	    let address_lng = address_geo.location.lng

	    
	    let responseObject = {
		"actions": [
		    {
			"say": `Ok, let me look that up for you...`,
		    },
		    {
			"remember": {
			    "address": address,
			    "matchedCity": matchedCity,
			    "formatted_address": formatted_address,
			    "user_geo": {"lat": address_lat, "lng": address_lng}
			}
		    },
		    {
			"redirect": "https://foodbank-8297-dev.twil.io/geo/get-food-pantry"
		    }
		]
	    };
	    callback(null, responseObject);
	})
    
}
