
/**
 * Configs
 */

var confs = require('../config/confs.json');

/**
 * Module dependencies
 * */

var kue = require('kue')
  , db = require('./db')('localhost/components')
  , component = require('./component');

// create our job queue

var jobs = kue.createQueue();

/**
 * Expose `jobs`
 */

exports = module.exports = jobs;

function jobs(){
}

/**
 * Add a new job
 */

exports.polling = function(nid, fn){
  var job = jobs.create('polling', {
    title: 'Polling data via REST from `' + confs.remote + '`'
  });

  job.save();
};

// Proccessing jobs

jobs.process('polling', 1, function(job, done){

  // get all components form server
  component.search(null, function(err, res){
    if (err) return console.error(err);

    for (var i = 0; i < res.length; i++) {
      var cmp = res[i];
      if (cmp) {
        var pid = cmp.repo + '/' + cmp.version;
        console.log('-> pid -> ', pid);
      }
    }

    db.pcks.find({}, function(err, data){
      console.log('-> err -> ', err);
      console.log('-> data -> ', data);
    });

    done();
  });
});

// start the UI
kue.app.listen(3000);
console.log('UI started on port 3000');
