import metadataParse, { Metadata } from '../metadata-parser';

import Parser from './stream-parser';
import { InternalConnectionOptions } from '../connection';
import { ColMetadataToken } from './token';

type CryptoMetaData = {
  ordinal: any,
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
  cryptoMetaData: CryptoMetaData
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

function readCryptoMetaData(parser: Parser, options: InternalConnectionOptions, index: number, metadata: Metadata, callback: (cryptoMetaData: CryptoMetaData) => void) {
  //TODO
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
  //TODO
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
