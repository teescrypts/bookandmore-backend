const areArraysEqual = (A, B) => {
  if (A.length !== B.length) return false;

  const urlsA = A.map((item) => item.url).sort();
  const urlsB = B.map((item) => item.url).sort();

  return urlsA.every((url, index) => url === urlsB[index]);
};

module.exports = areArraysEqual;
