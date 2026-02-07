// config/sslcommerz.js
const SSLCommerzPayment = require('sslcommerz-lts');

const store_id = process.env.SSLCOMMERZ_STORE_ID;
const store_passwd = process.env.SSLCOMMERZ_STORE_PASSWORD;
const is_live = process.env.NODE_ENV === 'production'; // true for live, false for sandbox

const sslcommerz = new SSLCommerzPayment(store_id, store_passwd, is_live);

module.exports = sslcommerz;
