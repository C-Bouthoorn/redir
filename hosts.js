module.exports = {
  // Supports fallback
  "__fallback": "local1.dev",

  "local1.dev": {
    // Supports HTTP and HTTPS
    http: 801,
    https: 4431
  },

  // Supports aliases
  "local3.dev": "local2.dev",
  "local2.dev": {
    http: 802,
    https: 4432
  },
};
