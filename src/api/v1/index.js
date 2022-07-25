const express = require('express');

const emojis = require('./emojis');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    message: '🪂🪂🪂'
  });
});

router.use('/emojis', emojis);

module.exports = router;
