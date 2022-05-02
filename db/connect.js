var neo4j = require('neo4j-driver');
var cassandra = require('cassandra-driver')
var mysql = require('mysql2');
const util = require('util');


var driver = neo4j.driver('neo4j://localhost',
    neo4j.auth.basic('neo4j', 'root'));
var driverSession = driver.session();

require('dotenv').config();
const cassandraClient = new cassandra.Client({
    contactPoints: [`${process.env.CASSANDRA_HOST}`],
    localDataCenter: 'datacenter1',
    keyspace: 'social_media'
});

const connectCassandra = async () => await cassandraClient.connect().then(()=>{
    console.log("Cassandra Connected")
}).catch((err)=>{
    console.log("Cassandra Failed " + err)
});


var mysqlConnection = mysql.createConnection({
    uri:`mysql://${process.env.MYSQL_USERNAME}:${process.env.MYSQL_PASSWORD}@${process.env.MYSQL_HOST}:${process.env.MYSQL_PORT}/${process.env.MYSQL_DATABASE}`,
    Promise: true
});


const connectMySQL = async () => await mysqlConnection.connect(function(err) {
    if (err) {
        console.error('MySQL Failed: ' + err.stack);
        return;
    }
    console.log("MySQL Connected");
});


async function startDBs(){
    await connectCassandra();
    await connectMySQL();

}

const mysqlQuery = util.promisify(mysqlConnection.query).bind(mysqlConnection);

module.exports = {
    driverSession,
    cassandraClient,
    mysqlConnection,
    mysqlQuery,
    startDBs
}
