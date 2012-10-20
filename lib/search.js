
/**
 * Module dependencies
 * */

var remote = require('../config/confs.json').remote
  , request = require('superagent');

/**
 * Search with the given `query` and
 * callback `fn(err, components)`.
 *
 * @param {String} query
 * @param {Function} fn
 * @api public
 */

module.exports = function(query, fn){
  var url = query ? remote + '/search/' + encodeURIComponent(query)
    : remote + '/all';

  request.get(url, function(err, res){
    if (err) return fn(err);
    fn(null, res.body);
  });
};
