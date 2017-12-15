var _ = require('lodash');
var log = require('../core/log.js');
var util = require('../core/util.js');
var config = util.getConfig();
var fs = require('fs');
var Gdax = require('gdax');
var inputFile='../profit/eth/target.json';
var cors = require('cors');
var Manager = require('./trader/portfolioManager');
var express = require('express'),
    app = express(),
    server = require('http').createServer(app);

app.use(cors());

var Api = function(done) {
    _.bindAll(this);

    this.api;
    this.price = 'N/A';
    this.fills = [];
    var key = process.env.GDAX_KEY;
    var secret = process.env.GDAX_SECRET;
    var passphrase = process.env.GDAX_PASSPHRASE;
    var apiURI = 'https://api.gdax.com';
    this.authedClient = new Gdax.AuthenticatedClient(key, secret, passphrase, apiURI);
    this.manager = new Manager(_.extend(config.trader, config.watch));
    this.manager.init(this.setup);
    this.done = done;
};

Api.prototype.setup = function(done){
    server.listen(3000,'0.0.0.0', function(){
        console.log('listening on port 3000');
    })

    app.get('/', function(req, res){
	this.fills = [];
	var balance = this.getBalance();
        this.getTrades(function(trades){
	    res.json({
    	        price: this.price,
	        target: this.getTarget(),
		trades: trades,
	        portfolio: this.manager.portfolio,
	        balance: balance,
	        roi: ((balance/557-1)*100).toFixed(2)
	     });
        }.bind(this));
    }.bind(this));
}

Api.prototype.processCandle = function(candle, done) {
    this.price = candle.close;

    done();
};


Api.prototype.getTarget = function(){
    var obj = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    var target = obj.prediction;
    return target;
}

Api.prototype.getTrades = function(callback, after){
    var params = {product_id: "ETH-USD"}
    if(after){
    	_.extend(params,{after:after});
    }
    this.authedClient.getFills(params,function(err,res){
        _.each(JSON.parse(res.body), function(fill){
		fill["price"] = +fill["price"];
		fill["size"] = +fill["size"];
		this.fills.push(fill);
	}.bind(this));
    	
	if(res.headers['cb-after']){
		this.getTrades(callback,res.headers['cb-after'])
	}else{
		var orderedFills = _.sortBy(this.fills, function(fill){ return fill["created_at"]; }).reverse();
		callback(orderedFills);
	}
    }.bind(this));   
}

Api.prototype.getBalance = function(){
    var total = 0;
    _.each(this.manager.portfolio, function(obj) {
        if(obj.name === "USD"){
            total += parseFloat(obj.amount);
        }else{
            total += parseFloat(obj.amount) * this.price
        }
    }.bind(this));
    return total;
}

module.exports = Api;
