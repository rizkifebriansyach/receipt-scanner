const knex = require("knex");
const pg = require("pg");

// Parse int8 (bigint) as JS Number. Telegram chat IDs and money fields fit
// within Number.MAX_SAFE_INTEGER. Apply before any knex instance is created.
pg.types.setTypeParser(pg.types.builtins.INT8, (val) => (val === null ? null : Number(val)));

const config = require("./knexfile");

const environment = process.env.NODE_ENV || "development";

module.exports = knex(config[environment]);
