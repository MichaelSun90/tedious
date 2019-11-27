const { assert } = require('chai');
const Connection = require('../src/connection');
const Parser = require('../src/token/stream-parser');
const fs = require('fs');
const homedir = require('os').homedir();
const Request = require('../src/request');

const featureExtAckParser = require('../src/token/feature-ext-ack-parser');
const sinon = require('sinon');

describe('AE Test', function () {

    let config = JSON.parse(
        fs.readFileSync(homedir + '/.tedious/test-connection-ae.json', 'utf8')
      ).config;

    xit('should connect to TediousDB', function (done) {
        let connection = new Connection(config);

        connection.on('connect', (err) => {
            if (err) {
                console.log('connection error: ', err)
            } else {
                console.log('connected!')
                assert.isTrue(false);

            }
            connection.close();
            done();
        })

        connection.on('debug', function (text) {
            console.log(text);
        });
        connection.on('infoMessage', function (info) {
            console.log('state: ', info.state, ' | ', 'message: ', info.message)
        })
    })

    xdescribe('LOGIN7 Payload tests', function () {
        it('should send COLUMNENCRYPTION in LOGIN7', function (done) {
            const connection = new Connection(config);
            const payLoad = connection.sendLogin7PacketHelper_setupLogin7Payload();
            assert.isTrue(payLoad.colEncryption);
            done();
        })
    })

    describe('Feature-ext-ack-parser.ts test', function () {
        it('should return new FeatureExtAckToken with colEncryption = true', function (done) {
             const buf = Buffer.alloc(7);
             let offset = 0;
             offset = buf.writeUInt8(0x04, offset)
             offset = buf.writeUInt32LE(1, offset) // length (DWORD)
             offset = buf.writeUInt8(1, offset) // COLUMNENCRYPTION_VERSION (Byte)
             buf.writeUInt8(0xFF, offset); // Terminator 

             const parser = new Parser({ token() { } }, {}, {});
             parser.buffer = buf;

             featureExtAckParser(parser, [], [], (token) => {
                 assert.equal(token.colEncryption[0], 1);
                 done();
             })
        })
    })

    xdescribe('Colmetadata-token-parser.ts test', function () {
        it('should read CEK Table', function () {

        })
    })
})