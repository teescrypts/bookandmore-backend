const convertDurationToMinutes = (duration) => {
  const { hours, minutes } = duration;
  return (hours || 0) * 60 + (minutes || 0);
};

module.exports = convertDurationToMinutes;
