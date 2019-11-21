const { assert } = require('chai');
const Login7Payload = require('../src/login7-payload');
const Connection = require('../src/connection');
const Request = require('../src/request');

describe('AE Test', function () {

    let config = {
        "server": "192.168.226.175",
        "authentication": {
            "type": "default",
            "options": {
                "userName": "sa",
                "password": "Moonshine4me"
            }
        },
        "options": {
            "port": 1433,
            "database": "TediousDB",
            "encrypt": false,
            "alwaysEncrypted": true,
            "debug": {
                "packet" : true,
                "data": true,
                "payload": true,
            }
        }
    }

    it('should connect to TediousDB', function (done) {
        let connection = new Connection(config);

        connection.on('connect', (err) => {
            console.log('connected!!')
            if (err) {
                console.log('connection error: ', err)
            } else {
                console.log('connected!')
                assert.isTrue(false);
                done();
            }

            connection.close();
        })

        connection.on('debug', function (text) {
            console.log(text);
        }
        );

        connection.on('infoMessage', function(info){
            console.log('state: ', info.state, ' | ', 'message: ', info.message)
        })
    })

    xit('should send COLUMNENCRYPTION in LOGIN7', function (done) {
        let connection = new Connection(config);

        console.log('new connection established')

        connection.on('connect', (err) => {
            if (err) {
                console.log('connection error: ', err)
            } else {
                console.log('connected!');
            }

            let request = new Request('SELECT * FROM MyTable', (err, rowCount) => {
                if (err) {
                    console.log('Request error: ', err)
                } else {
                    connection.close();
                }
            })

            request.on('row', function (columns) {
                columns.forEach(function (column) {
                    if (column.value === null) {
                        console.log('NULL');
                    } else {
                        console.log(column);
                    }
                });
            });

            connection.execSql(request);
        })
    })
})