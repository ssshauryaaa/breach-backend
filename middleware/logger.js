const db = require("../config/db");

module.exports = (req, res, next) => {
  const payload = JSON.stringify(req.body);

  db.run(
    "INSERT INTO attacks(ip,payload,vuln_type,timestamp) VALUES(?,?,?,datetime('now'))",
    [req.ip, payload, req.originalUrl],
  );

  next();
};
