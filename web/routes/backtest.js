// simple POST request that returns the backtest result

const _ = require('lodash');
const promisify = require('tiny-promisify');
const pipelineRunner = promisify(require('../../core/workers/pipeline/parent'));

// starts a backtest
// requires a post body with a config object
module.exports = function *() {
  var mode = 'backtest';

  var config = require('./baseConfig');

  _.merge(config, this.request.body);

  this.body = yield pipelineRunner(mode, config);
}