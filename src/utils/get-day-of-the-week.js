const { DateTime } = require("luxon");

const getDayOfWeek = (dateString, timeZone = "UTC") => {
  // Parse the date string and set the time zone
  const date = DateTime.fromISO(dateString, { zone: timeZone });

  // Get the full name of the day (e.g., "Friday")
  const dayName = date.weekdayLong;

  let result;

  if (dayName) {
    result = dayName.toLowerCase();
  }

  if (result) return result;
};

module.exports = getDayOfWeek;
