
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

  db.cmps = db.get('components');
  db.cmps.index('repo', { unique: true });

  db.users = db.get('users');

  module.exports = db;
  return db;
};
