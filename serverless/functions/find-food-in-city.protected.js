exports.handler = function(context, event, callback) {
	let memory = JSON.parse(event.Memory);
    console.log("User Identifier: "+ event.UserIdentifier);
    console.log("Task: "+ event.CurrentTask);
    console.log(event);
    let message = "I can help you find food in " + memory.twilio.collected_data.user_location.answers.city.answer;

    let responseObject = {
        "actions": [
            {
                "say": message
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
					"redirect": "https://foodbank-8297-dev.twil.io/geo/get-food-pantry"
				}
			}
            }
        ]
    };
    callback(null, responseObject);
};
