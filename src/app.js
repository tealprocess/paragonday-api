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

// Apple App Site Association for Universal Links
app.get('/.well-known/apple-app-site-association', (req, res) => {
  res.json({
    appclips: {
      apps: ['F695HM3JW7.systems.paragonday.app.Clip']
    },
    applinks: {
      details: [
        {
          appIDs: ['F695HM3JW7.systems.paragonday.app.Clip'],
          components: [{ '/': '/gather*' }]
        },
        {
          appIDs: ['F695HM3JW7.systems.paragonday.app'],
          components: [{ '/': '/gather*' }]
        }
      ]
    }
  });
});

// Gather landing page
app.get('/gather', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Paragonday Gather</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0a0a0a;
      color: #f0f0f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #1c1c1e;
      border-radius: 20px;
      padding: 28px 24px;
      max-width: 360px;
      width: 100%;
      text-align: center;
    }
    .pin { font-size: 48px; margin-bottom: 12px; }
    .place {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .para-label {
      font-size: 28px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      color: #f5c542;
      margin: 12px 0 4px;
    }
    .greg-label {
      font-size: 15px;
      color: #8e8e93;
      margin-bottom: 24px;
    }
    .cta {
      display: inline-block;
      background: #f5c542;
      color: #0a0a0a;
      font-weight: 700;
      font-size: 16px;
      padding: 14px 28px;
      border-radius: 50px;
      text-decoration: none;
    }
    .sub {
      margin-top: 14px;
      font-size: 13px;
      color: #636366;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="pin">📍</div>
    <div class="place" id="place">Loading…</div>
    <div class="para-label" id="para"></div>
    <div class="greg-label" id="greg"></div>
    <a class="cta" href="https://apps.apple.com/app/paragonday/id6450849556">
      Get Paragonday
    </a>
    <div class="sub">Open on iPhone to RSVP</div>
  </div>

  <script>
    const p = new URLSearchParams(window.location.search);
    const place = p.get('place') || 'Gather';
    const label = p.get('label') || '';
    const ts    = parseInt(p.get('time') || '0', 10);

    document.getElementById('place').textContent = place;
    document.getElementById('para').textContent  = label;

    if (ts) {
      const d = new Date(ts * 1000);
      document.getElementById('greg').textContent = d.toLocaleString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit'
      });
    }

    document.title = place + ' — Paragonday';
  </script>
</body>
</html>`);
});

app.use('/api/v1', apiv1);

app.use(middlewares.notFound);
app.use(middlewares.errorHandler);

module.exports = app;
