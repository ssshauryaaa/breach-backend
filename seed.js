const db = require("./config/db");
const bcrypt = require("bcrypt");

async function seed() {
  const adminPass = await bcrypt.hash("admin123", 10);

  /*
 CREATE TABLES
 */

  db.serialize(() => {
    db.run(`
  CREATE TABLE IF NOT EXISTS users (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   username TEXT UNIQUE,
   password TEXT,
   role TEXT
  )
  `);

    db.run(`
  CREATE TABLE IF NOT EXISTS teams (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   name TEXT,
   role TEXT
  )
  `);

    db.run(`
  CREATE TABLE IF NOT EXISTS team_members (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   user_id INTEGER,
   team_id INTEGER
  )
  `);

    db.run(`
  CREATE TABLE IF NOT EXISTS competitions (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   status TEXT,
   start_time DATETIME
  )
  `);

    db.run(`
  CREATE TABLE IF NOT EXISTS vulnerabilities (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   name TEXT,
   severity INTEGER,
   patched INTEGER DEFAULT 0
  )
  `);

    db.run(`
  CREATE TABLE IF NOT EXISTS attacks (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   team_id INTEGER,
   ip TEXT,
   payload TEXT,
   vuln_type TEXT,
   timestamp DATETIME
  )
  `);

    db.run(`
  CREATE TABLE IF NOT EXISTS patches (
   id INTEGER PRIMARY KEY AUTOINCREMENT,
   team_id INTEGER,
   vuln_id INTEGER,
   timestamp DATETIME
  )
  `);

    db.run(`
  CREATE TABLE IF NOT EXISTS scores (
   team_id INTEGER,
   points INTEGER
  )
  `);

    /*
 SEED DATA
 */

    db.run(`
 INSERT INTO users(username,password,role)
 VALUES("admin","${adminPass}","admin")
 `);

    db.run(`
 INSERT INTO vulnerabilities(name,severity)
 VALUES
 ("SQL Injection",100),
 ("XSS",75),
 ("Auth Bypass",120)
 `);
  });

  console.log("Database seeded successfully");
}

seed();
