
//
// Todo: 
// * fix bug of time not calculating right when its close to sunset sometimes — fixed on client side for now, should fix server side as well. 
// * create route to get the time til and past solstices and equinoxes

const express = require('express');
const bent = require('bent')
const getJSON = bent('json')
const { find } = require('geo-tz')
const { DateTime } = require("luxon");
const router = express.Router();

const baseSunriseSunsetUrl = 'http://api.sunrise-sunset.org/json';
const latLons = {
  'playground': {
    lat: 40.67887649748418,
    lon: -73.90749042399337,
  },
  'quay': {
    lat: 40.7264841,
    lon: -73.9604679,
  },
  'factory': {
    lat: 40.6738201,
    lon: -73.9091468,
  },
  'index': {
    lat: 40.7176017,
    lon: -73.9997659
  },
  'temperance': {
    lat: 38.9165688,
    lon: -77.0315354
  }
}


//
// Route Definitions 
// 

router.get('/', async (req, res) => {
  try {
    let queryParams = '?' + req.url.split('?')[1]
    console.log('fetching sunrise-sunset api with: ', queryParams);
    let timeObj = await getJSON(baseSunriseSunsetUrl + queryParams)
    res.json(timeObj);
  } catch (e) {
    console.log('sunrise-sunset err', e)
    res.json({ error: e})
  }
});

router.get('/suntime', async (req, res) => {
  try {
    let { lat, lon } = parseParamsForLatLon(req.query)
    console.log('fetching suntimes for ', lat, lon);
    let trioOfTimes = await fetchSunTimes(lat, lon);
    let suntimeObj = findTheTime(trioOfTimes);
    res.json(suntimeObj);
  } catch (e) {
    console.log('suntime err', e)
    res.json({ error: e.message})
  }
});

// Return the next sun event data 
router.get('/next', async (req, res) => {
  try {
    let { lat, lon } = parseParamsForLatLon(req.query)
    let timezones = find(lat, lon); // geo-tz returns an array
    let timezone = timezones[0]; 

    let threeDates = formatThreeDatesForTimezone(timezone);
    let trioOfTimes = await fetchSunTimesByDates(lat, lon, threeDates);

    let suntimeObj = findTheTime(trioOfTimes);

    let nextEvent, nextType;
    if (suntimeObj.whereWeAre == 'before sunrise'){ // send todays sunrise
      nextEvent = trioOfTimes[1].results.sunrise;
      nextType = 'sunrise';
    } else if (suntimeObj.whereWeAre == 'after sunrise'){ // send todays sunset
      nextEvent = trioOfTimes[1].results.sunset;
      nextType = 'sunset';
    } else if (suntimeObj.whereWeAre == 'after sunset'){ // send tomorrows sunrise
      nextEvent = trioOfTimes[2].results.sunrise;
      nextType = 'sunrise';
    }

    const response = {
      nextEvent,
      nextType,
    }
    res.json(response);

  } catch (e) {
    console.log('/next err', e)
    res.json({ error: e.message})
  }
});



module.exports = router;


//
// Helper Functions 
// 

function parseParamsForLatLon(params){
  let lat, lon;
  if(params.location){
    lat = latLons[params.location].lat;
    lon = latLons[params.location].lon;
  } else {
    lat = params.lat;
    lon = params.lng;
  }

  if(lat == undefined || lon == undefined) {
    throw new Error('No location was provided.');
  }

  return { lat, lon }
}

function formatThreeDatesForTimezone(timezone){
  const today = DateTime.now().setZone(timezone).toFormat('yyyy-MM-dd');
  const yesterday = DateTime.now().setZone(timezone).minus({ days: 1 }).toFormat('yyyy-MM-dd');
  const tomorrow = DateTime.now().setZone(timezone).plus({ days: 1 }).toFormat('yyyy-MM-dd');

  return {
    today,
    yesterday,
    tomorrow
  };
}

function fetchSunTimes(lat, lon){
  let queryParams = [
    "?lat=" + lat + "&lng=" + lon + "&formatted=0&date=yesterday",
    "?lat=" + lat + "&lng=" + lon + "&formatted=0&date=today",
    "?lat=" + lat + "&lng=" + lon + "&formatted=0&date=tomorrow"
  ];

  const promises = queryParams.map(params => getJSON(baseSunriseSunsetUrl + params));
  return Promise.all(promises);
}

function fetchSunTimesByDates(lat, lon, dates){
  let queryParams = [
    "?lat=" + lat + "&lng=" + lon + "&formatted=0&date=" + dates.yesterday,
    "?lat=" + lat + "&lng=" + lon + "&formatted=0&date=" + dates.today,
    "?lat=" + lat + "&lng=" + lon + "&formatted=0&date=" + dates.tomorrow
  ];
  
  const promises = queryParams.map(params => {
    return getJSON(baseSunriseSunsetUrl + params)
      .catch(async error => {
        console.log('Error fetching sunrise-sunset API:', JSON.stringify(await error.json()));
        throw error;
      });
  });
  return Promise.all(promises);
}

function findTheTime(trioOfTimes, currentTime = new Date()) {

  // create date objects from sunrise-sunset api times
  let times = {
    yesterday: {
      sunrise: new Date(trioOfTimes[0].results.sunrise),
      sunset: new Date(trioOfTimes[0].results.sunset)
    },
    today: {
      sunrise: new Date(trioOfTimes[1].results.sunrise),
      sunset: new Date(trioOfTimes[1].results.sunset)
    },
    tomorrow: {
      sunrise: new Date(trioOfTimes[2].results.sunrise),
      sunset: new Date(trioOfTimes[2].results.sunset)
    }
  };

  let whereWeAre = findOurselves(currentTime, times);
  // sunPrint.innerText = whereWeAre;

  console.log(times);
  console.log(whereWeAre);

  let time1String, time2String;

  // Calculate necessary times
  switch(whereWeAre){
    case 'before sunrise':
      // calc pastset: time since yesterday's sunset
      let pastsetDiff = currentTime.getTime() - times.yesterday.sunset.getTime();
      time1String = formatTimeDiff(pastsetDiff, '+', 'pastset', 'Past last sunset');

      // calc tilsun: time til today's sunrise
      let tilsunDiff = times.today.sunrise.getTime() - currentTime.getTime();
      time2String = formatTimeDiff(tilsunDiff, '-', 'tilsun', 'Until next sunrise');

      // calc sunpercent: time from last sunrise to next sunrise
      sunPercent = scale( currentTime.getTime(), times.yesterday.sunrise.getTime(), times.today.sunrise.getTime(), 0, 1);

      nightStartPercent = scale( times.today.sunset.getTime(), times.yesterday.sunrise.getTime(), times.today.sunrise.getTime(), 0, 1);

      break;

    case 'after sunrise':
      // calc pastsun: time since today's sunrise
      let pastsunDiff = currentTime.getTime() - times.today.sunrise.getTime();
      time1String = formatTimeDiff(pastsunDiff, '+', 'pastsun', 'Past last sunrise');

      // calc tilset: time til today's sunset
      let tilsetDiff = times.today.sunset.getTime() - currentTime.getTime();
      time2String = formatTimeDiff(tilsetDiff, '-', 'tilset', 'Until next sunset');

      // calc sunpercent: time from this sunrise to next sunrise
      sunPercent = scale( currentTime.getTime(), times.today.sunrise.getTime(), times.tomorrow.sunrise.getTime(), 0, 1);

      nightStartPercent = scale( times.today.sunset.getTime(), times.today.sunrise.getTime(), times.tomorrow.sunrise.getTime(), 0, 1);

      break;

    case 'after sunset':
      // calc pastset: time since today's sunset
      let pastsetDiff2 = currentTime.getTime() - times.today.sunset.getTime();
      time1String = formatTimeDiff(pastsetDiff2, '+', 'pastset', 'Past last sunset');

      // calc tilsun: time til tomorrow's sunrise
      let tilsunDiff2 = times.tomorrow.sunrise.getTime() - currentTime.getTime();
      time2String = formatTimeDiff(tilsunDiff2, '-', 'tilsun', 'Until next sunrise');

      // calc sunpercent: time today's sunrise til next sunrise
      sunPercent = scale( currentTime.getTime(), times.today.sunrise.getTime(), times.tomorrow.sunrise.getTime(), 0, 1);

      nightStartPercent = scale( times.today.sunset.getTime(), times.today.sunrise.getTime(), times.tomorrow.sunrise.getTime(), 0, 1);

      break;

    default:
      // shouldn't hit this
      console.log('whereWeAre of ' + whereWeAre + ' isnt accounted for')
      break;
  }

  return {
    time1: time1String,
    time2: time2String,
    sunPercent: sunPercent,
    nightStartPercent: nightStartPercent,
    whereWeAre: whereWeAre
  }
}

// Create one string
// Currently not using description
function formatTimeDiff(timeDiff, plusOrMinus, type, description ){
  let time = parseMilliseconds(timeDiff);
  let timeStr = time.hours + ':' + time.minutes;
  let fullStr = plusOrMinus + timeStr + ' ' + type;
  return fullStr;
}

function parseMilliseconds(duration){
  var milliseconds = parseInt((duration % 1000) / 100),
    seconds = Math.floor((duration / 1000) % 60),
    minutes = Math.floor((duration / (1000 * 60)) % 60),
    hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

  hours = (hours < 10) ? "0" + hours : hours;
  minutes = (minutes < 10) ? "0" + minutes : minutes;
  seconds = (seconds < 10) ? "0" + seconds : seconds;

  //return hours + ":" + minutes + ":" + seconds + "." + milliseconds;

  return {
    hours: hours,
    minutes: minutes,
    seconds: seconds,
    milliseconds: milliseconds
  }
}

// Determine where we are in today, either
// A. before sunrise
// B. after sunrise
// C. after sunset
function findOurselves(currentTime, times) {
  let whereWeAre = null;

  if ( currentTime <= times.today.sunrise ) {
    whereWeAre = 'before sunrise';

  } else if ( currentTime > times.today.sunrise && currentTime <= times.today.sunset ) {
    whereWeAre = 'after sunrise';

  } else if ( currentTime > times.today.sunset ) {
    whereWeAre = 'after sunset';

  } else {
    whereWeAre = 'somewhere unknown';
  }

  return whereWeAre;
}

// converts from "1/1/2000" to
// new Date("dateString") is browser-dependent and discouraged, so we'll write
// a simple parse function for U.S. date format (which does no error checking)
function parseDate(str) {
    var mdy = str.split('/');
    return new Date(mdy[2], mdy[0]-1, mdy[1]);
}

function datediff(first, second) {
    // Take the difference between the dates and divide by milliseconds per day.
    // Round to nearest whole number to deal with DST.
    return Math.round((second-first)/(1000*60*60*24));
}

// as always, from the interwebs
function scale (number, inMin, inMax, outMin, outMax) {
    return (number - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}