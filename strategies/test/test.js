var inputFile = '../../profit/eth/topTrades.csv'
var fs = require('fs')
var parse = require('csv-parse')

var csvData=[];
fs.createReadStream(inputFile)
    .pipe(parse({delimiter: ','}))
    .on('end',function() {
      //do something wiht csvData
      console.log("here")
	console.log(csvData);
    });
