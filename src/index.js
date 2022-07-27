const httpolyglot = require('httpolyglot');
const app = require('./app');

const port = process.env.PORT || 8080;
const options = {};
httpolyglot.createServer(options, app).listen(port);

// app.listen(port, () => {
//   /* eslint-disable no-console */
//   console.log(`Listening on port ${port}`);
// });
