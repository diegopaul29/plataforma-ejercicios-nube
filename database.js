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
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }

    let paramIndex = 1;
    const pgQuery = text.replace(/\?/g, () => `$${paramIndex++}`);

    pool.query(pgQuery, params, (err, res) => {
      if (err) {
        console.error('Error en consulta SQL (all):', err.message);
        return callback(err, null);
      }
      callback(null, res.rows);
    });
  },

  get: (text, params, callback) => {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }

    let paramIndex = 1;
    const pgQuery = text.replace(/\?/g, () => `$${paramIndex++}`);

    pool.query(pgQuery, params, (err, res) => {
      if (err) {
        console.error('Error en consulta SQL (get):', err.message);
        return callback(err, null);
      }
      callback(null, res.rows[0]);
    });
  }
};