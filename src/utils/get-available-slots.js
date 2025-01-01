const { DateTime, Duration } = require("luxon");

const generateAvailableSlots = (
  openingHours,
  bookedTimes,
  duration,
  increment,
  timeZone
) => {
  const resultSlots = [];

  // Step 1: Remove booked times from opening hours
  openingHours.forEach(({ from, to }) => {
    let start = DateTime.fromFormat(from, "HH:mm", { zone: timeZone });
    const end = DateTime.fromFormat(to, "HH:mm", { zone: timeZone });

    bookedTimes.forEach(({ from: bookedFrom, to: bookedTo }) => {
      const bookedStart = DateTime.fromFormat(bookedFrom, "HH:mm", {
        zone: timeZone,
      });
      const bookedEnd = DateTime.fromFormat(bookedTo, "HH:mm", {
        zone: timeZone,
      });

      // If booked times overlap with current slot
      if (bookedStart < end && start < bookedEnd) {
        // Add available slot before booked time
        if (start < bookedStart) {
          resultSlots.push({
            from: start.toFormat("HH:mm"),
            to: bookedStart.toFormat("HH:mm"),
          });
        }
        // Update start to after the booked slot
        start = bookedEnd < end ? bookedEnd : end;
      }
    });

    // Add remaining slot after all booked times
    if (start < end) {
      resultSlots.push({
        from: start.toFormat("HH:mm"),
        to: end.toFormat("HH:mm"),
      });
    }
  });

  // Step 2: Generate smaller time slots from available slots
  const timeSlots = [];
  const durationObj = Duration.fromObject({ minutes: duration });
  const incrementObj = Duration.fromObject({ minutes: increment });

  resultSlots.forEach(({ from, to }) => {
    let currentStart = DateTime.fromFormat(from, "HH:mm", { zone: timeZone });
    const end = DateTime.fromFormat(to, "HH:mm", { zone: timeZone });

    while (currentStart < end) {
      const nextTime = currentStart.plus(durationObj);

      // Check if adding duration exceeds the end
      if (nextTime <= end) {
        timeSlots.push(currentStart.toFormat("HH:mm"));
        currentStart = currentStart.plus(incrementObj);
      } else {
        break; // Exit if the duration exceeds the slot's end
      }
    }
  });

  return timeSlots;
};

module.exports = generateAvailableSlots;
