const express = require('express');

// const emojis = require('./emojis');
const sunriseSunsetApi = require('./sunriseSunsetApi');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    message: '🪂🪂🪂'
  });
});

router.use('/sunrise-sunset', sunriseSunsetApi);

//
// https://api.sunrise-sunset.org/json?lat=" + lat + "&lng=" + lon + "&formatted=0&date=yesterday",

module.exports = router;
