
/**
 * Config
 */

var confs = require('./config/confs.json')
  , dB = require('./lib/db');

/**
 * Module dependencies.
 */

var jobs = require('./lib/jobs');

/**
 * Reset
 */

var db = dB(confs.db);

var qry = { $or: [ { twitted: 'zero' }, { twitted: 'stacked' } ] };
var set = { twitted: 'zero' };

db.components.find(qry, function(err, data){
  var counter = data.length;
  console.log('reseting %s components', counter);
  data.forEach(function(doc, i){
    db.components.update(doc._id, { $set: set }, function(){
      console.log('reset` %s` component', doc.repo);
      --counter || init();
    });
  });
});

/**
 * Init process
 */

function init(){
  schedule();
  setTimeout(schedule, 1000*60);
}

/**
 *
 * Start jobs
 *
 * - polling from components server
 * - emit twitts
 */

function schedule(){
  jobs.polling();
}
