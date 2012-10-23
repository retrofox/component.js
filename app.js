
/**
 * Globals
 */

var confs = require('./config/confs.json');
db = require('./lib/db')(confs.db);

/**
 * Module dependencies.
 */

var jobs = require('./lib/jobs');

/**
 * Polling
 */

polling();
setTimeout(polling, 1000*60);

/**
 * Twitts emition
 */

var emit = false;

function one(){
  db.components.findOne({ twitted: false }, function(err, cmp) {
    if (err) return error(err);
    if (!cmp) {
      emit = false;
      return;
    }

    db.components.update(cmp._id, { $set: { twitted: true } }, function(err){
      jobs.twitt(cmp);
      setTimeout(one, 1000 * 90);
    });
  });
}

/**
 * Polling from components server
 */

function polling(){
  if (!emit) {
    db.components.findOne({ twitted: false }, function(err, tw){
      if (err) return error(err);
      if (tw) {
        emit = true;
        one();
      }
    });
  }
  jobs.polling();
}

function error(msg){
  console.log('ERROR: `%s`', msg);
}
