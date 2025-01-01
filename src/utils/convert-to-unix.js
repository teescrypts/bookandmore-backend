const convertToUnixTime = (dateString) => {
  const date = new Date(dateString);

  const unixMilliseconds = date.getTime();
  const unixSeconds = Math.floor(unixMilliseconds / 1000);

  return unixSeconds;
};

module.exports = convertToUnixTime;
