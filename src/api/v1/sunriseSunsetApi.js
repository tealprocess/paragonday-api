const express = require('express');
const bent = require('bent')
const getJSON = bent('json')
// const getBuffer = bent('buffer')
// let buffer = await getBuffer('http://site.com/image.png')
const baseSunriseSunsetUrl = 'http://api.sunrise-sunset.org/json';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    let queryParams = req.url.split('/')[1]
    console.log('fetching sunrise-sunset api with: ', queryParams);
    let timesObj = await getJSON(baseSunriseSunsetUrl + queryParams)
    res.json(timesObj);
  } catch (e) {
    console.log('sunrise-sunset err', e)
    res.json({ error: e})
  }
});

module.exports = router;
