const fs = require('fs');
const spatialite = require('spatialite');
const request = require('request');
const md5file = require('md5-file');
const admzip = require('adm-zip');
const stringsim = require('string-similarity');
const tzjs = require('timezone-js');
const targz = require('targz');
const tzdata = require('tzdata');

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
    let query = `select *, Distance(coords, MakePoint(${lat}, ${lon})) as dist from pantries order by dist asc limit 30`
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

function nextOpenDate(pantry, hours) {
    
}

function findOpenPantries(db, lat, lon, time, city) {
    let query = "select * from pantries inner join hours on pantries.id=hours.pantry_id left outer join city_restrictions on pantries.id=city_restrictions.pantry_id where (hours.year=? or hours.year is null) and (hours.month is null or hours.month=?) and (hours.day_of_month=? or hours.day_of_month is null) and (hours.week is null or hours.week = ?) and (hours.day_of_week is null or hours.day_of_week=?) and (hours.open_time < ? and hours.close_time > ?) and (city_restrictions.city_id in (select id from cities where name=?) or city_restrictions.city_id is null)";
    let year = time.getUTCFullYear();
    let month = time.getMonth() + 1;
    let day_of_month = time.getDate();
    let week = Math.ceil(day_of_month / 7);
    let day_of_week = time.getDay();
    let time_of_day = time.toTimeString().substr(0,8);
    console.log(`I think it's ${year} ${month} ${day_of_month} ${week} ${day_of_week} ${time_of_day}`)
    return new Promise((complete, reject) => {
	db = db.all(query, [year, month, day_of_month, week, day_of_week, time_of_day, time_of_day, city], function(err, rows) {
	    if(err) {
		reject(err);
	    } else {
		complete(rows);
	    }
	});
    });
}

function getPantryHours(db, pantry_id, month, year) {
    let query = "select week, day_of_week, open_time, close_time from hours where pantry_id=? and (month is null or month=?) and (year is null or year=?) group by week, day_of_week, open_time, close_time order by week, day_of_week, open_time"
    let hoursPromise = new Promise((complete, reject) => {
	db.all(query, [pantry_id, month, year], function(err, rows) {
	    if(err) {
		reject(err);
	    } else {
		complete(rows);
	    }
	});
    });
    return hoursPromise;
}

function getHoursMessage(hours) {
    let message = "is open: "
    console.log(hours)
    hours.forEach(
	(hour) => {
	    if (hour.week) {
		message += `The ${weekStrings[hour.week]} `
	    }
	    if (hour.week && hour.day_of_week) {
		message += `${dayStrings[hour.day_of_week]} of this month `
	    } else if (hour.day_of_week) {
		message += `${dayStrings[hour.day_of_week]}s`
	    }
	    let open_hour = parseInt(hour.open_time.substr(0,2))
	    let open_minutes = parseInt(hour.open_time.substr(3,4))
	    message += ` from ${toAmPmString(open_hour, open_minutes)} to `
	    let close_hour = parseInt(hour.close_time.substr(0,2))
	    let close_minutes = parseInt(hour.close_time.substr(3,4))
	    message += `${toAmPmString(close_hour, close_minutes)}. `
	}
    )
    return message;
}

function toAmPmString(hour, minutes) {
    let hourStr = `${hour}`
    let minutesStr = ""
    let ampm = "AM"
    if ( hour > 11 ) {
	if ( hour == 12 ) {
	    hourStr = "12"
	    ampm = "PM"
	} else {
	    hourStr = `${hour - 12}`
	    ampm = "PM"
	}
    }
    if (minutes > 0) {
	minutesStr = `:${minutes}`
    }
    return `${hourStr}${minutesStr}${ampm}`
}

let weekStrings = {
    1: "first",
    2: "second",
    3: "third",
    4: "fourth",
    5: "fifth"
}

let dayStrings = {
    0: "Sunday",
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday"
}

function isValidPantryForCity(db, pantry, city) {
    let cityPromise = new Promise((complete, reject) => {
	let query = "select id from cities where name=? limit 1"
	db.all(query, [city], function(err, rows) {
	    if(err) {
		reject(err);
	    } else {
		complete(rows[0]);
	    }
	});
    });
    return cityPromise.then((city_id) => {
	let query = "select (count(1) == 0) or count(case city_id when ? then 1 else 0 end)>0 from city_restrictions  where pantry_id=?"
	return new Promise((complete, reject) =>
			   {
			       db.all(query, [city, pantry.id], function(err, rows) {
				   if(err) {
				       reject(err);
				   } else {
				       complete(rows[0]);
				   }
			       })});
    });    
}

function respondWithPantry(formatted_address, lat, lng, pantry_name, pantry_address, pantry_city, pantry_state, hours, callback) {
    let responseObject = {
	"actions": [
	    {
		"say": `I found ${pantry_name} at ${pantry_address} in ${pantry_city}, ${pantry_state}. It ${hours}`,
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

    var _tz = tzjs.timezone;
    _tz.loadingScheme = _tz.loadingSchemes.MANUAL_LOAD;
    _tz.loadZoneDataFromObject(tzdata);
    
    if (!fs.existsSync('/tmp/pantries.sqlite')) {
	let file = Runtime.getAssets()['/pantries.sqlite.zip'];
	let zip = new admzip(file.path);
	let entries = zip.getEntries();
	let database = entries[0];
	fs.writeFileSync('/tmp/pantries.sqlite', database.getData());
    }

    

    var db = new spatialite.Database('/tmp/pantries.sqlite');

    db.spatialite(async function(err) {
	let matchedCity = await matchCity(db, city);

	//let time = new Date("2019-08-16 11:00:00 PDT")

	let addressLatLon = await getAddressLatLon(context, address, matchedCity, "CA");
	console.log(addressLatLon);
	
	let address_res = addressLatLon.candidates[0]
	let formatted_address = address.formatted_address
	
	let address_geo = address_res.geometry
	let address_lat = address_geo.location.lat
	let address_lng = address_geo.location.lng

	let time = Date.now()
	time = new tzjs.Date(time, 'America/Los_Angeles');
	
	//let pantries = await findPantries(db, address_lat, address_lng);
	let pantries = await findOpenPantries(db, address_lat, address_lng, time, matchedCity);

	if (pantries.length == 0) {
	    pantries = findPantries(db, address_lat, address_lng, matchedCity)
	}
	
	
	let validPantriesPromises = pantries.map((pantry) => {return {"pantry": pantry, "valid": isValidPantryForCity(db, city, pantry.id)}});
	let validPantries = validPantriesPromises.filter(async function(pantry) {return await pantry.valid})

	console.log(validPantries)

	
	let pantry = validPantries[0].pantry

	let month = time.getMonth() + 1
	let year = time.getUTCFullYear()
	let hoursResults = await getPantryHours(db, pantry.id, month, year)

	let hoursMessage = getHoursMessage(hoursResults)
	
	respondWithPantry(formatted_address, address_lat, address_lng, pantry.name, pantry.address, pantry.city, pantry.state, hoursMessage, callback);
	
	
    });
    
};
