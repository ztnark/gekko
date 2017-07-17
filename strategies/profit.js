//
// https://github.com/askmike/gekko/blob/stable/docs/trading_methods.md
//
var fs = require('fs');
var parse = require('csv-parse');
var inputFile='../profit/eth/price.csv';
var config = require('../core/util.js').getConfig();
var settings = config.profit;

var strat = {};
var target;
// Prepare everything our method needs
strat.init = function() {
  this.currentTrend;
  this.requiredHistory = 0;
}

// What happens on every new candle?
strat.update = function(candle) {

  fs.readFile(inputFile, function (err, data) {
    parse(data, {delimiter: ','}, function(err, rows) {
          target = rows[0][11]
//          console.log(rows[rows.length - 1][8])
//          console.log(rows[rows.length - 1][9])
//          console.log(rows[rows.length - 1][11])
    })
  })
  this.toUpdate = this.lastPrice > target && this.currentTrend != 'short' || this.lastPrice < target && this.currentTrend != 'long';

  console.log("target:  " + target + " last: " + this.lastPrice)	
}

// For debugging purposes.
strat.log = function() {
  log.write('calculated random number:');
  log.write('\t', this.randomNumber.toFixed(3));
}

// Based on the newly calculated
// information, check if we should
// update or not.
strat.check = function() {

  // Only continue if we have a new update.
  if(!this.toUpdate)
    return;

  if(this.currentTrend != 'short' && this.lastPrice > target) {

    // If it was long, set it to short
    this.currentTrend = 'short';
    this.advice('short');

  } else if(this.currentTrend != "long" && this.lastPrice < target * 0.99){

    // If it was short, set it to long
    this.currentTrend = 'long';
    this.advice('long');

  }
}

module.exports = strat;
