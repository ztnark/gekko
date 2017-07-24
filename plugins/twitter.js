var _ = require('lodash');
var log = require('../core/log.js');
var util = require('../core/util.js');
var config = util.getConfig();
var twitterConfig = config.twitter;
var TwitterApi = require('twitter');
var Manager = require('./trader/portfolioManager');

require('dotenv').config()

var Twitter = function(done) {
    _.bindAll(this);

    this.twitter;
    this.price = 'N/A';
    this.manager = new Manager(_.extend(config.trader, config.watch));
    this.manager.init(this.setup);
    this.done = done;
};

Twitter.prototype.setup = function(done){
    this.manager.setPortfolio(function(){
        setupTwitter();
    });
    var setupTwitter = function (err, result) {
        this.client = new TwitterApi({
          consumer_key: process.env.TWITTER_KEY,
          consumer_secret: process.env.TWITTER_SECRET,
          access_token_key: process.env.TWITTER_ACCESS_TOKEN,
          access_token_secret: process.env.TWITTER_TOKEN_SECRET
        });
      
        if(twitterConfig.sendMessageOnStart){
            var balance = this.balanceString();
	    var exchange = config.watch.exchange;
            var currency = config.watch.currency;
            var asset = config.watch.asset;
            var body = "#Ethereum trade bot is watching "
                +exchange
                +" "
                +currency
                +" "
                +asset
		+". Current balance: "
		+balance
            this.mail(body);
        }else{
            log.debug('Skipping Send message on startup')
        }
    }.bind(this);
};

Twitter.prototype.processCandle = function(candle, done) {
    this.price = candle.close;

    done();
};

Twitter.prototype.processAdvice = function(advice) {
        this.manager.setPortfolio(function(){
            sendMessage();
        })
        var sendMessage = function(){
            if (advice.recommendation == "soft" && pushbulletConfig.muteSoft) return;
           // var target = this.getTarget();
            var balance = this.balanceString();
            var text = [
            '#Ethereum trade bot is attempting to ',
            advice.recommendation === "short" ? "sell" : "buy",
            '.\n\nThe current ',
            config.watch.asset,
            ' price is ',
            this.price,
//            ' target is ',
  //          target,
            ' balance is ',
            balance
            ].join('');
            var subject =' New advice: go ' + advice.recommendation;
            this.mail(text);
        }.bind(this);
};

Twitter.prototype.balanceString = function(){
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
    var percent = ((total/557-1)*100).toFixed(2);
    var formattedPercent = percent > 0 ? "+" + percent + "%" : "-" + percent + "%";
    return string + " (" + usd + " " + formattedPercent + ")";
}

Twitter.prototype.mail = function(content, done) {
    log.info("trying to tweet");
    this.client.post('statuses/update', {status: content},  function(error, tweet, response) {
      if(error || !response) {
         log.error('Pushbullet ERROR:', error)
      } else if(response && response.active){
          log.info('Pushbullet Message Sent')
      }
    }); 
};

Twitter.prototype.checkResults = function(err) {
    if(err)
        log.warn('error sending email', err);
    else
        log.info('Send advice via email.');
};

module.exports = Twitter;