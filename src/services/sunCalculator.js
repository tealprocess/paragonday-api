const SunCalc = require('suncalc');

/**
 * Local sun time calculator using SunCalc library.
 * Provides ±1 minute accuracy for sunrise/sunset calculations.
 * Used as a fallback when the external sunrise-sunset.org API is unavailable.
 */

/**
 * Calculate sun times for a given location and date.
 * Returns data in the same format as the sunrise-sunset.org API.
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} date - Date string in YYYY-MM-DD format, or 'today', 'yesterday', 'tomorrow'
 * @returns {Object} Sun times in sunrise-sunset.org API format
 */
function calculateSunTimes(lat, lng, date) {
  let targetDate;

  if (date === 'today') {
    targetDate = new Date();
  } else if (date === 'yesterday') {
    targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - 1);
  } else if (date === 'tomorrow') {
    targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 1);
  } else {
    // Parse YYYY-MM-DD format
    const [year, month, day] = date.split('-').map(Number);
    targetDate = new Date(year, month - 1, day, 12, 0, 0); // Noon to avoid DST issues
  }

  const times = SunCalc.getTimes(targetDate, lat, lng);

  // Format times as ISO 8601 strings (same as sunrise-sunset.org with formatted=0)
  return {
    status: 'OK',
    results: {
      sunrise: times.sunrise.toISOString(),
      sunset: times.sunset.toISOString(),
      solar_noon: times.solarNoon.toISOString(),
      day_length: Math.round((times.sunset - times.sunrise) / 1000), // seconds
      civil_twilight_begin: times.dawn.toISOString(),
      civil_twilight_end: times.dusk.toISOString(),
      nautical_twilight_begin: times.nauticalDawn.toISOString(),
      nautical_twilight_end: times.nauticalDusk.toISOString(),
      astronomical_twilight_begin: times.nightEnd.toISOString(),
      astronomical_twilight_end: times.night.toISOString(),
    }
  };
}

/**
 * Parse query parameters and calculate sun times.
 * Accepts the same parameters as the sunrise-sunset.org API.
 *
 * @param {Object} query - Query parameters (lat, lng, date, formatted)
 * @returns {Object} Sun times response
 */
function getSunTimesFromQuery(query) {
  const lat = parseFloat(query.lat);
  const lng = parseFloat(query.lng);
  const date = query.date || 'today';

  if (isNaN(lat) || isNaN(lng)) {
    return {
      status: 'INVALID_REQUEST',
      results: null
    };
  }

  return calculateSunTimes(lat, lng, date);
}

module.exports = {
  calculateSunTimes,
  getSunTimesFromQuery
};
