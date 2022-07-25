const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');

require('dotenv').config();

const middlewares = require('./middlewares');
const apiv1 = require('./api/v1');

const app = express();

app.use(morgan('dev'));
app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: '🪂'
  });
});

app.use('/api/v1', apiv1);

app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

module.exports = app;
