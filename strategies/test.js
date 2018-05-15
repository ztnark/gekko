// This is a basic example strategy for Gekko.
// For more information on everything please refer
// to this document:
//
// https://gekko.wizb.it/docs/strategies/creating_a_strategy.html
//
// The example below is pretty bad investment advice: on every new candle there is
// a 10% chance it will recommend to change your position (to either
// long or short).

var Gdax = require('gdax');

// Let's create our own strat
this.ltcBtc = new Gdax.PublicClient("LTC-BTC", false ? 'https://api-public.sandbox.gdax.com' : 
undefined);
this.ltcUsd = new Gdax.PublicClient("LTC-USD", false ? 'https://api-public.sandbox.gdax.com' :
undefined);
this.btcUsd = new Gdax.PublicClient("BTC-USD", false ? 'https://api-public.sandbox.gdax.com' :
undefined);

  var ltcResult = function(err, response, data) {
    this.ltcAsk = data.ask;
    console.log("LTC: ",this.ltcAsk);
    console.log((this.ltcAsk/this.btcBid - this.pairAsk)/this.pairAsk);
  };
  var btcResult = function(err, response, data) {
        this.btcBid = data.bid;
    console.log("BTC: ", this.btcBid);
    console.log((this.ltcAsk/this.btcBid - this.pairAsk)/this.pairAsk);
  };
  var pairResult = function(err, response, data) {
    this.pairAsk = data.ask;
    console.log("Pair: ", this.pairAsk);
    console.log((this.ltcAsk/this.btcBid - this.pairAsk)/this.pairAsk);
  };
  this.ltcBtc.getProductTicker(pairResult);
  this.ltcUsd.getProductTicker(ltcResult);
  this.btcUsd.getProductTicker(btcResult);

