var Connection = require('../lib/tedious').Connection;
var Request = require('../lib/tedious').Request;
var fs = require('fs');

var config = JSON.parse(fs.readFileSync(require('os').homedir()+ '/.tedious/test-connection.json', 'utf8')).config;

var connection = new Connection(config);

connection.on('connect', function (err) {
  // If no error, then good to go...
  console.log('connected!')
  executeStatement();
}
);

connection.on('debug', function (text) {
  //console.log(text);
}
);

function executeStatement() {
  
  let row = 1;
  const request = new Request('select * from MyTable', function(err, rowCount) {
  // request = new Request("select 42, 'hello world'", function(err, rowCount) {
    if (err) {
      console.log('request err: ', err);
    } else {
      console.log(rowCount + ' rows');
    }

    connection.close();
  });

  // Emits a 'DoneInProc' event when completed.
  request.on('row', function(columns) {
    console.log('row: ', row)
    columns.forEach(function(column) {
      if (column.value === null) {
        console.log('NULL');
      } else {
        console.log(column);
      }
    });
    row += 1;
  });

  request.on('done', function (rowCount, more) {
    console.log(rowCount + ' rows returned');
  });

  // In SQL Server 2000 you may need: connection.execSqlBatch(request);
  connection.execSql(request);
}
