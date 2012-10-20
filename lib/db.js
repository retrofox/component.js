
/**
 * Module dependencies
 */

var monk = require('monk');

/**
 * Expose db driver
 */

exports = module.exports = function (host){
  var db = monk(host);

  /**
   * Expose collections
   */

  db.pcks = db.get('packages');
  db.pcks.index('name', { unique: true });

  module.exports = db;
  return db;
};