var neo4j = require('neo4j-driver');
var cassandra = require('cassandra-driver')
var mysql = require('mysql2');
const util = require('util');
require('dotenv').config();

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.MYSQL_DATABASE, process.env.MYSQL_USERNAME, process.env.MYSQL_PASSWORD, {
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT,
    dialect: 'mysql'
});

const connectSequelize = async () => {
    try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

var driver = neo4j.driver('neo4j://localhost',
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD));

var driverSession = driver.session({database: 'neo4j'});

const cassandraClient = new cassandra.Client({
    contactPoints: [`${process.env.CASSANDRA_HOST}`],
    localDataCenter: 'datacenter1',
    keyspace: 'social_media',
    queryOptions: {
        consistency: cassandra.types.consistencies.quorum
    }
});

const connectCassandra = async () => await cassandraClient.connect().then(()=>{
    console.log("Cassandra Connected")
}).catch((err)=>{
    console.log("Cassandra Failed " + err)
});


async function startDBs(){
    await connectCassandra();
    await connectSequelize();
}

module.exports = {
    sequelize,
    driverSession,
    cassandraClient,
    neo4j,
    startDBs
}
