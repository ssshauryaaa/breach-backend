const db = require("../config/db");

exports.addPoints = (team_id, points) => {
  db.run("INSERT INTO scores(team_id,points) VALUES(?,?)", [team_id, points]);
};
