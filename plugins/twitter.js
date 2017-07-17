var _ = require('lodash');
var log = require('../core/log.js');
var util = require('../core/util.js');
var config = util.getConfig();
var twitterConfig = config.twitter;
var TwitterApi = require('twitter');
require('dotenv').config()

var Twitter = function(done) {
    _.bindAll(this);

    this.twitter;
    this.price = 'N/A';

    this.done = done;
    this.setup();
};

Twitter.prototype.setup = function(done){

    var setupTwitter = function (err, result) {
        this.client = new TwitterApi({
          consumer_key: process.env.TWITTER_KEY,
          consumer_secret: process.env.TWITTER_SECRET,
          access_token_key: process.env.TWITTER_ACCESS_TOKEN,
          access_token_secret: process.env.TWITTER_TOKEN_SECRET
        });
      
        if(twitterConfig.sendMessageOnStart){
            var exchange = config.watch.exchange;
            var currency = config.watch.currency;
            var asset = config.watch.asset;
            var body = "Watching "
                +exchange
                +" "
                +currency
                +" "
                +asset
            this.mail(body);
        }else{
            log.debug('Skipping Send message on startup')
        }
    };
    setupTwitter.call(this)
};

Twitter.prototype.processCandle = function(candle, done) {
    this.price = candle.close;

    done();
};

Twitter.prototype.processAdvice = function(advice) {
	if (advice.recommendation == "soft" && twitterConfig.muteSoft) return;

	var text = [
        'New trend, trying to go ',
        advice.recommendation,
        '@ ',
        this.price
    ].join('');

    this.mail(text);
};

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
