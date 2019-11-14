var Connection = require('../lib/tedious').Connection;
var Request = require('../lib/tedious').Request;

var config = {
  "server": "localhost",
  "authentication": {
    "type": "default",
    "options": {
      "userName": "sa",
      "password": "Password_123"
    }
  },
  "options": {
    "port": 60543,
    "database": "EmpData3"
  }

};

var connection = new Connection(config);

connection.on('connect', function (err) {
  // If no error, then good to go...
  executeStatement();
}
);

connection.on('debug', function (text) {
  //console.log(text);
}
);

function executeStatement() {
  request = new Request(`
  SELECT * FROM EmpInfo`, function (err, rowCount) {
    if (err) {
      console.log(err);
    } else {
      console.log(rowCount + ' rows');
    }

    connection.close();
  });

  request.on('row', function (columns) {
    columns.forEach(function (column) {
      if (column.value === null) {
        console.log('NULL');
      } else {
        console.log(column);
      }
    });
  });

  request.on('done', function (rowCount, more) {
    console.log(rowCount + ' rows returned');
  });

  // In SQL Server 2000 you may need: connection.execSqlBatch(request);
  connection.execSql(request);
}
