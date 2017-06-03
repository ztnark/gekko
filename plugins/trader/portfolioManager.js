/*

  The portfolio manager is responsible for making sure that
  all decisions are turned into orders and make sure these orders
  get executed. Besides the orders the manager also keeps track of
  the client's portfolio.

  NOTE: Execution strategy is limit orders (to not cross the book)

*/

var _ = require('lodash');
var util = require('../../core/util');
var dirs = util.dirs();
var events = require("events");
var log = require(dirs.core + 'log');
var async = require('async');
var checker = require(dirs.core + 'exchangeChecker.js');
var moment = require('moment');
var async = require('async');

var Manager = function(conf) {
  _.bindAll(this);

  var error = checker.cantTrade(conf);
  if(error)
    util.die(error);

  var exchangeMeta = checker.settings(conf);
  this.exchangeSlug = exchangeMeta.slug;

  // create an exchange
  var Exchange = require(dirs.exchanges + this.exchangeSlug);
  this.exchange = new Exchange(conf);

  this.conf = conf;
  this.portfolio = {};
  this.fee;
  this.action;

  this.marketConfig = _.find(exchangeMeta.markets, function(p) {
    return p.pair[0] === conf.currency && p.pair[1] === conf.asset;
  });
  this.minimalOrder = this.marketConfig.minimalOrder;

  this.currency = conf.currency;
  this.asset = conf.asset;


  // resets after every order
  this.orders = [];
};

// teach our trader events
util.makeEventEmitter(Manager);

Manager.prototype.init = function(callback) {
  log.debug('getting balance & fee from', this.exchange.name);
  var prepare = function() {
    this.starting = false;

    log.info('trading at', this.exchange.name, 'ACTIVE');
    log.info(this.exchange.name, 'trading fee will be:', this.fee * 100 + '%');
    this.logPortfolio();

    callback();
  };

  async.series([
    this.setPortfolio,
    this.setFee
  ], _.bind(prepare, this));
}

Manager.prototype.setPortfolio = function(callback) {
  var set = function(err, fullPortfolio) {
    if(err)
      util.die(err);

    // only include the currency/asset of this market
    const portfolio = [ this.conf.currency, this.conf.asset ]
      .map(name => {
        let item = _.find(fullPortfolio, {name});

        if(!item) {
          log.debug(`Unable to find "${name}" in portfolio provided by exchange, assuming 0.`);
          item = {name, amount: 0};
        }

        return item;
      });

    if(_.isEmpty(this.portfolio))
      this.emit('portfolioUpdate', _.clone(portfolio));

    this.portfolio = portfolio;

    if(_.isFunction(callback))
      callback();

  }.bind(this);

  this.exchange.getPortfolio(set);
};

Manager.prototype.setFee = function(callback) {
  var set = function(err, fee) {
    this.fee = fee;

    if(err)
      util.die(err);

    if(_.isFunction(callback))
      callback();
  }.bind(this);
  this.exchange.getFee(set);
};

Manager.prototype.setTicker = function(callback) {
  var set = function(err, ticker) {
    this.ticker = ticker;

    if(_.isFunction(callback))
      callback();
  }.bind(this);
  this.exchange.getTicker(set);
};

// return the [fund] based on the data we have in memory
Manager.prototype.getFund = function(fund) {
  return _.find(this.portfolio, function(f) { return f.name === fund});
};
Manager.prototype.getBalance = function(fund) {
  return this.getFund(fund).amount;
};

// This function makes sure the limit order gets submitted
// to the exchange and initiates order registers watchers.
Manager.prototype.trade = function(what) {
  // if we are still busy executing the last trade
  // cancel that one (and ignore results = assume not filled)
  if(_.size(this.orders))
    return this.cancelLastOrder(() => this.trade(what));

  this.action = what;

  var act = function() {
    var amount, price;

    if(what === 'BUY') {

      amount = this.getBalance(this.currency) / this.ticker.ask;

      price = this.ticker.bid;
      price *= 1e8;
      price = Math.floor(price);
      price /= 1e8;

      this.buy(amount, price);

    } else if(what === 'SELL') {

      price *= 1e8;
      price = Math.ceil(price);
      price /= 1e8;

      amount = this.getBalance(this.asset);
      price = this.ticker.ask;
      this.sell(amount, price);
    }
  };
  async.series([
    this.setTicker,
    this.setPortfolio,
    this.setFee
  ], _.bind(act, this));

};

Manager.prototype.getMinimum = function(price) {
  if(this.minimalOrder.unit === 'currency')
    return minimum = this.minimalOrder.amount / price;
  else
    return minimum = this.minimalOrder.amount;
};

// first do a quick check to see whether we can buy
// the asset, if so BUY and keep track of the order
// (amount is in asset quantity)
Manager.prototype.buy = function(amount, price) {

  var minimum = this.getMinimum(price);

  // if order to small
  if(amount < minimum) {
    return log.info(
      'Wanted to buy',
      this.asset,
      'but the amount is too small',
      '(' + parseFloat(amount).toFixed(12) + ')',
      'at',
      this.exchange.name
    );
  }

  amount = 10;//minimum;

  log.info(
    'Attempting to BUY',
    amount,
    this.asset,
    'at',
    this.exchange.name
  );
  this.exchange.buy(amount, price, this.noteOrder);
};

// first do a quick check to see whether we can sell
// the asset, if so SELL and keep track of the order
// (amount is in asset quantity)
Manager.prototype.sell = function(amount, price) {

  var minimum = this.getMinimum(price);

  // if order to small
  if(amount < minimum) {
    return log.info(
      'Wanted to buy',
      this.currency,
      'but the amount is too small',
      '(' + parseFloat(amount).toFixed(12) + ')',
      'at',
      this.exchange.name
    );
  }

  amount = 10;//minimum;

  log.info(
    'Attempting to SELL',
    amount,
    this.asset,
    'at',
    this.exchange.name
  );
  this.exchange.sell(amount, price, this.noteOrder);
};

Manager.prototype.noteOrder = function(err, order) {
  this.orders.push(order);
  // if after 1 minute the order is still there
  // we cancel and calculate & make a new one
  setTimeout(this.checkOrder, util.minToMs(1));
};


Manager.prototype.cancelLastOrder = function(done) {} {
  this.exchange.cancelOrder(_.last(this.orders), () => {
    this.orders = [];
    done();
  });
}

// check whether the order got fully filled
// if it is not: cancel & instantiate a new order
Manager.prototype.checkOrder = function() {
  var handleCheckResult = function(err, filled) {
    if(!filled) {
      log.info(this.action, 'order was not (fully) filled, cancelling and creating new order');
      this.exchange.cancelOrder(_.last(this.orders), _.bind(handleCancelResult, this));
      return;
    }

    log.info(this.action, 'was successfull');

    this.relayOrder();
  }

  var handleCancelResult = function() {
    this.trade(this.action);
  }

  this.exchange.checkOrder(_.last(this.orders), _.bind(handleCheckResult, this));
}

Manager.prototype.relayOrder = function() {
  // look up all executed orders and relay average.
  var process = (err, res) => {

    var price = 0;
    var amount = 0;
    var date = moment(0);

    _.each(res.filter(o => o.amount), order => {
      date = _.max([moment(order.date), date]);
      price = ((price * amount) + (order.price * order.amount)) / (order.amount + amount);
      amount += +order.amount;
    });

    async.series([
      this.setPortfolio,
      this.setTicker
    ], () => {
      var asset = _.find(this.portfolio, a => a.name === this.asset).amount;
      var currency = _.find(this.portfolio, a => a.name === this.currency).amount;

      this.emit('trade', {
        date,
        price,
        action: this.action,
        portfolio: {
          currency,
          asset,
          balance: currency + (asset * this.ticker.bid)
        },
        balance: currency + (asset * this.ticker.bid)
      });

      this.orders = [];

    });

  }

  var getOrders = _.map(
    this.orders,
    order => next => this.exchange.getOrder(order, next)
  );

  async.series(getOrders, process);
}

Manager.prototype.logPortfolio = function() {
  log.info(this.exchange.name, 'portfolio:');
  _.each(this.portfolio, function(fund) {
    log.info('\t', fund.name + ':', parseFloat(fund.amount).toFixed(12));
  });
};

module.exports = Manager;
