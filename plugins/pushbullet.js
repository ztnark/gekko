/**
 * Created by rocketman1337345 on 8/14/16.
 */

var pushbullet = require("pushbullet");
var _ = require('lodash');
var log = require('../core/log.js');
var util = require('../core/util.js');
var config = util.getConfig();
var pushbulletConfig = config.pushbullet;
var Manager = require('./trader/portfolioManager');
var fs = require('fs');
var inputFile='../profit/eth/target.json';

var Pushbullet = function(done) {
    _.bindAll(this);

    this.pusher;
    this.price = 'N/A';
    this.manager = new Manager(_.extend(config.trader, config.watch));
    this.manager.init(this.setup);
    this.done = done;
};

Pushbullet.prototype.setup = function(done){
    this.manager.setPortfolio(function(){
	setupPushBullet()
    });
    
    var setupPushBullet = function (err, result) {
	if(pushbulletConfig.sendMessageOnStart){
            var balance = this.balanceString();
            var title = pushbulletConfig.tag;
            var exchange = config.watch.exchange;
            var currency = config.watch.currency;
            var target = this.getTarget();
            var asset = config.watch.asset;
            var body = "Gekko has started, Ive started watching "
                +exchange
                +" "
                +currency
                +" "
                +asset
                +" target: "
                +target
                +" balance: "
                +balance;
            this.mail(title, body);
        }else{
            log.debug('Skipping Send message on startup')
        }
    }.bind(this);
};

Pushbullet.prototype.balanceString = function(){
     var string = ""
     var total = 0
     var price = this.price
     _.each(this.manager.portfolio, function(obj) {
        string +=  " " + obj.name + ": " +  parseFloat(obj.amount).toFixed(2) + " ";
	if(obj.name === "USD"){
	    total += parseFloat(obj.amount);
	}else{
	    total += parseFloat(obj.amount) * price
	}
    });
    var usd = "$" + total.toFixed(2);
    var percent = ((total/788-1)*100).toFixed(2);
    var formattedPercent = percent > 0 ? "+" + percent + "%" : "-" + percent + "%";
    return string + " (" + usd + " " + formattedPercent + ")";
}

Pushbullet.prototype.getTarget = function(){
    var obj = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    var target = obj.prediction;
    return target;
}

Pushbullet.prototype.processCandle = function(candle, done) {
    this.price = candle.close;

    done();
};

Pushbullet.prototype.processAdvice = function(advice) {
	this.manager.setPortfolio(function(){
	    sendMessage();
	})
	var sendMessage = function(){

  	    if (advice.recommendation == "soft" && pushbulletConfig.muteSoft) return;
	    var target = this.getTarget();
	    var balance = this.balanceString();
	    var text = [
            'Gekko is watching ',
            config.watch.exchange,
            ' and has detected a new trend, advice is to go ',
            advice.recommendation,
            '.\n\nThe current ',
            config.watch.asset,
            ' price is ',
            this.price,
	    ' target is ',
	    target,
            ' balance is ',
	    balance
            ].join('');

   	    var subject = pushbulletConfig.tag+' New advice: go ' + advice.recommendation;

    	    this.mail(subject, text);
	}.bind(this);
};

Pushbullet.prototype.mail = function(subject, content, done) {
    var pusher = new pushbullet(pushbulletConfig.key);
    pusher.note(pushbulletConfig.email, subject, content, function(error, response) {
        if(error || !response) {
            log.error('Pushbullet ERROR:', error)
        } else if(response && response.active){
            log.info('Pushbullet Message Sent')
        }
    });
};

Pushbullet.prototype.checkResults = function(err) {
    if(err)
        log.warn('error sending email', err);
    else
        log.info('Send advice via email.');
};

module.exports = Pushbullet;
