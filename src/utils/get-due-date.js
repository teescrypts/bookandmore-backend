const addDaysToEpoch = (epochSeconds, daysToAdd) => {
  const millisecondsInADay = 86400000;
  const epochMilliseconds = epochSeconds * 1000;

  const currentDate = new Date(epochMilliseconds);
  const dueDate = new Date(
    currentDate.getTime() + daysToAdd * millisecondsInADay
  );

  return Math.floor(dueDate.getTime() / 1000);
};

module.exports = addDaysToEpoch;
