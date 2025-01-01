const { DateTime, Interval } = require("luxon");

const getBookingDates = (leadTimeHours, bookingWindowDays, timeZone) => {
  // Step 1: Get today's date in the specified time zone
  const today = DateTime.now().setZone(timeZone).startOf("day");

  // Step 2: Add lead time (in hours) to today's date
  const startDate = today.plus({ hours: leadTimeHours });

  // Step 3: Add booking window (in days) to startDate
  const endDate = startDate.plus({ days: bookingWindowDays });

  // Step 4: Generate all dates between startDate and endDate (inclusive)
  const allDates = [];
  let currentDate = startDate.startOf("day"); // Normalize to the start of the day for comparison
  const endOfInterval = endDate.startOf("day");

  while (currentDate <= endOfInterval) {
    allDates.push(currentDate.toISODate()); // Push date in ISO format (YYYY-MM-DD)
    currentDate = currentDate.plus({ days: 1 }); // Move to the next day
  }

  return allDates;
};

module.exports = getBookingDates;
