import metadataParse, { Metadata } from '../metadata-parser';

import Parser from './stream-parser';
import { InternalConnectionOptions } from '../connection';
import { ColMetadataToken } from './token';
import { TYPE, DataType } from '../data-type';

import { sprintf } from 'sprintf-js';

type CryptoMetaData = {
  ordinal: number,
  userType: any,
  baseTypeInfo: any,
  encryptionAlgo: any,
  algoName?: string,
  encryptionAlgoType: any,
  normVersion: any
}

type CekTableMetadata = {

}

export type ColumnMetadata = Metadata & {
  colName: string,
  tableName?: string | string[],
  cryptoMetaData: CryptoMetaData|undefined
};

function readTableName(parser: Parser, options: InternalConnectionOptions, metadata: Metadata, callback: (tableName?: string | string[]) => void) {
  if (metadata.type.hasTableName) {
    if (options.tdsVersion >= '7_2') {
      parser.readUInt8((numberOfTableNameParts) => {
        const tableName: string[] = [];

        let i = 0;
        function next(done: () => void) {
          if (numberOfTableNameParts === i) {
            return done();
          }

          parser.readUsVarChar((part) => {
            tableName.push(part);

            i++;

            next(done);
          });
        }

        next(() => {
          callback(tableName);
        });
      });
    } else {
      parser.readUsVarChar(callback);
    }
  } else {
    callback(undefined);
  }
}

function readColumnName(parser: Parser, options: InternalConnectionOptions, index: number, metadata: Metadata, callback: (colName: string) => void) {
  parser.readBVarChar((colName) => {
    if (options.columnNameReplacer) {
      callback(options.columnNameReplacer(colName, index, metadata));
    } else if (options.camelCaseColumns) {
      callback(colName.replace(/^[A-Z]/, function (s) {
        return s.toLowerCase();
      }));
    } else {
      callback(colName);
    }
  });
}

function readCryptoMetaData(parser: Parser, options: InternalConnectionOptions, index: number, metadata: Metadata, callback: (cryptoMetaData: CryptoMetaData|undefined) => void) {
  
  // Based on the TDS doc, 'fEncrypted' is at 11th bit under flags.
  // If it is set to '1', means this column is encrypted
  // If clinet side enable the encrypted feature, and current column is encrypted, then 
  // program then try to parse CryptoMetaData
  let flags = metadata.flags.toString(2);
  let encrypted = flags.charAt(flags.length - 11) == '1'
  if(options.alwaysEncrypted && encrypted){
    // Read ordinal as USHORT
    parser.readUInt16LE((ordinal) => {
      // Read userType (Changed to ULONG in TDS 7.2):
      // Depending on the TDS version that is used, valid values are USHORT/ULONG
      // Do not handle special cases for TIMESTAMP and alias types becasue Tedious 
      // currently not support this two types
      (options.tdsVersion < '7_2' ? parser.readUInt16LE : parser.readUInt32LE).call(parser, (userType) => {
        // Read BaseTypeInfo as TYPE_INFO (UInt8) 
        parser.readUInt8((typeNumber) => {
          const type: DataType = TYPE[typeNumber];
          if (!type) {
            return parser.emit('error', new Error(sprintf('Unrecognised data type 0x%02X', typeNumber)));
          }
          // Read encryptionAlgo as BYTE
          parser.readUInt8((encryptionAlgo) => {
            // Read algoName B_VARCHAR
            parser.readBVarChar((algoName) => {
              // Read encryptionAlgoType as BYTE
              parser.readUInt8((encryptionAlgoType) => {
                // Read normVersion as BYTE
                parser.readUInt8((normVersion) => {
                  callback({
                    ordinal: ordinal,
                    userType: userType,
                    baseTypeInfo: type,
                    encryptionAlgo: encryptionAlgo,
                    algoName: algoName,
                    encryptionAlgoType: encryptionAlgoType,
                    normVersion: normVersion
                  })
                })
              })
            })
          })
        })
      })
    })
  }else{
    callback( undefined )
  }  
}

// 2.2.7.4 Token Stream Definition Parser -> 'ColumnData'
function readColumnData(parser: Parser, options: InternalConnectionOptions, index: number, callback: (column: ColumnMetadata) => void) {
  metadataParse(parser, options, (metadata) => {
    readTableName(parser, options, metadata, (tableName) => {
      readCryptoMetaData(parser, options, index, metadata, (cryptoMetaData) => {
        readColumnName(parser, options, index, metadata, (colName) => {
          callback({
            userType: metadata.userType,
            flags: metadata.flags,
            type: metadata.type,
            collation: metadata.collation,
            precision: metadata.precision,
            scale: metadata.scale,
            udtInfo: metadata.udtInfo,
            dataLength: metadata.dataLength,
            schema: metadata.schema,
            colName: colName,
            tableName: tableName,
            cryptoMetaData: cryptoMetaData
          });
        });
      })
    });
  });
}

function readColumns(parser: Parser,  options: InternalConnectionOptions, columnCount: number,  callback: (token: ColMetadataToken) => void){
    const columns: ColumnMetadata[] = [];

    let i = 0;
    function next(done: () => void) {
      if (i === columnCount) {
        return done();
      }

      readColumnData(parser, options, i, (column) => {
        columns.push(column);

        i++;
        next(done);
      });
    }

    next(() => {
      callback(new ColMetadataToken(columns));
    });
}

// 2.2.7.4 Token Stream Definition Parser -> 'CekTable'
function readCekTable(parser: Parser, callback: (cekTable: CekTableMetadata) => void) {
  parser.readUInt16LE((EkValueCount) => {
    console.log('!! EkValueCount => ', EkValueCount);
  })
}


// 2.2.7.4 Token Stream Definition Parser
function colMetadataParser(parser: Parser, _colMetadata: ColumnMetadata[], options: InternalConnectionOptions, callback: (token: ColMetadataToken) => void) {
  let columnCount: number;
  let cekTableMetadata: CekTableMetadata;

  parser.readUInt16LE((count) => {
    columnCount = count;

    readCekTable(parser, (cekTable) => {
      cekTableMetadata = cekTable;

      readColumns(parser, options, columnCount, callback) //TODO: add cekTableMetada in callback
    })
  })
}

export default colMetadataParser;
module.exports = colMetadataParser;
