var fs = require('fs')
var parse = require('csv-parse')
var input = '../../profit/eth/predict.csv'

fs.readFile(input, function (err, data) {
  parse(data, {delimiter: ','}, function(err, rows) {
	console.log(rows[0])
	console.log(rows[rows.length - 1][8])
	console.log(rows[rows.length - 1][9])
	console.log(rows[rows.length - 1][11])    
  })
})

