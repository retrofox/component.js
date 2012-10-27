
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

var qry = { $or: [ { twitted: 'zero' }, { twitted: 'stacked' }, { twitted: 'failed' } ] };
var set = { twitted: 'zero' };

db.components.find(qry, function(err, data){
  var counter = data.length;
  if (!counter) return init();
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

var countdown = 120;

function init(){
  schedule();
  setInterval(schedule, 1000 * 60 * 2);
  setInterval(function(){
    console.log('-> countdown -> ', countdown);
    countdown--;
  }, 1000);
}

/**
 *
 * Start jobs
 *
 * - wiking from components server
 * - emit twitts
 */

function schedule(){
  countdown = 120;
  jobs.wiking();
}
