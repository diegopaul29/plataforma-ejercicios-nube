const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = {
  all: (text, params, callback) => {
    pool.query(text, params, (err, res) => {
      if (err) return callback(err, null);
      callback(null, res.rows);
    });
  },
  get: (text, params, callback) => {
    pool.query(text, params, (err, res) => {
      if (err) return callback(err, null);
      callback(null, res.rows[0]);
    });
  },
  query: (text, params, callback) => {
    return pool.query(text, params, callback);
  }
};