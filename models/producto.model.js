const db = require('../config/db');

exports.getAll = (callback) => {
  db.query('SELECT * FROM productos', (err, results) => {
    if (err) return callback(err, null);
    callback(null, results);
  });
};
