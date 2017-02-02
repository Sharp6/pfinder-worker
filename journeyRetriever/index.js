var firebase = require('firebase');
var moment = require('moment');

// Initialize Firebase
var config = {
    apiKey: "AIzaSyCUNeg0ChfojGipxBEAvojLADh6Lj6xHms",
    authDomain: "pfinder-9e493.firebaseapp.com",
    databaseURL: "https://pfinder-9e493.firebaseio.com",
    storageBucket: "pfinder-9e493.appspot.com",
    messagingSenderId: "271451534038"
};

firebase.initializeApp(config);


function getJourneys() {
    return new Promise(function(resolve,reject) {
        firebase.database().ref('/events').once('value', function(snap) {
            var journeysByDate = Object.keys(snap.val())
                .map(function(eventKey) {
                    return snap.val()[eventKey].message
                })
                .map(parseEvent)
                .reduce(groupEventsByJourney, [])
                .map(addJourneyMetrics)
                .map(validateJourney)
                .reduce(function(journeysByDate, journey) {
                    const dateKey = journey.events[0].timeMoment.format('DD-MM-YYYY');
                    var currDate = journeysByDate[dateKey] || [];
                    currDate.push(journey);
                    journeysByDate[dateKey] = currDate;
                    return journeysByDate;
                }, {});

            resolve(journeysByDate);
        });
    });

    /*
    Validations which could be added:

    In order to be "valid"
    - No event should have a negative duration
    - no duplicate sets of location/state can occur

    In order to be "complete"
    - A journey should have an even amount of events
    - A journey should start with an exit an end with an enter
    */


    function validateJourney(journey) {
        var validErrors = [];
        var completeErrors = [];

        // No event should have a negative duration
        var negativeDuration = journey.events.reduce(function(result, event){
            return result || (event.duration && event.duration < 0)
        }, false);
        if(negativeDuration) { validErrors.push("Negative duration"); }

        // No duplicate sets of location/state can occur
        var duplicates = journey.events.reduce(function(result, event, index, array) {
            var numberOfSimilarEvents = array.filter(function(otherEvent) {
                return event.location === otherEvent.location && event.status === otherEvent.status;
            });
            console.log(numberOfSimilarEvents.length);
            return result || numberOfSimilarEvents.length > 1;
        }, false);
        if(duplicates) { validErrors.push("Duplicate locations/status events"); }

        // A journey should have an even amount of events
        var unEvenEvents = journey.events.length % 2 !== 0;
        if(unEvenEvents) { completeErrors.push("No even number of events"); }

        // A journey should start with an exit an end with an enter
        var exitEnter = journey.events[0].status === "exited" 
            && journey.events[journey.events.length-1].status === "entered" 
            && journey.events[0].location !== journey.events[journey.events.length-1].location;
        if(!exitEnter) { completeErrors.push("Journey does not start with an exit or does not end with an enter at different locations"); }

        if(validErrors.length === 0) {
            if(completeErrors.length === 0) {
                journey.valid = "complete";
            } else {
                journey.valid = "incomplete";
                journey.completeErrors = completeErrors;
            } 
        } else {
            journey.valid = "invalid";
            journey.validErrors = validErrors;
        }

        return journey;
    }

    function addJourneyMetrics(journey) {
        // total duration
        journey.totalDuration = journey.events[journey.events.length-1].timeMoment.diff(journey.events[0].timeMoment) / (1000 * 60);
        
        // time in creche
        var crecheEvents = journey.events
            .filter(function(event) {
                return event.location === "creche";
            });
        if(crecheEvents.length === 2) {
            journey.timeInCreche = crecheEvents[1].timeMoment.diff(crecheEvents[0].timeMoment) / (1000*60);
        }

        // total travel time
        if(journey.totalDuration && journey.timeInCreche) {
            journey.totalTravelTime = journey.totalDuration - journey.timeInCreche;
        }

        if(journey.events[0].location === "home" && journey.events[0].status === "exited"
            && journey.events[journey.events.length-1].location === "work" && journey.events[journey.events.length-1].status === "entered") {
                journey.label = "workCommute";
            }

        if(journey.events[0].location === "work" && journey.events[0].status === "exited"
            && journey.events[journey.events.length-1].location === "home" && journey.events[journey.events.length-1].status === "entered") {
                journey.label = "homeCommute"; 
            }

        return journey;
    }

    function groupEventsByJourney(journeys, event, index, arr) {
        var prevEvent;
        var duration;
        var journey;

        // determine if a previous event is available
        if(index > 0) {
            prevEvent = arr[index-1];
            // calculate time duration
            duration = event.timeMoment.diff(prevEvent.timeMoment) / (1000 * 60);
        }

        // if duration < 1h, select last journey
        if(duration && duration < 60) {
            event.duration = duration;
            journey = journeys[journeys.length - 1];
        } else {
            journey = { events: [] };
            journeys.push(journey);
        }
        journey.events.push(event);
        return journeys;
    }

    function parseEvent(event) {
        const data = event.split('---');
        return {
            location: data[0].trim(),
            status: data[1].trim(),
            timeString: data[2].trim(),
            timeMoment: moment(data[2].trim(), "MMMM DD, YYYY at hh:mma")
        }
    }
}

module.exports = getJourneys;