
/**
 * Configs
 */

var confs = require('../config/confs.json');

/**
 * Module dependencies
 * */

var kue = require('kue')
  , db = require('./db')(confs.db)
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

/**
 * Add check package job
 *
 * @param {Object} pck package properties
 * @api public
 */

exports.check = function(pck, delay){
  jobs.create('check component', {
    title: 'Check `' + pck.repo + '` component.',
    data: pck
  })
  .priority('high')
  .save();
};

/**
 * Add job
 */

exports.add = function(pck){
  jobs.create('add component', {
    title: 'Add new component: `' + pck.repo,
    data: pck
  })
  .priority('high')
  .save();
};

/**
exports.add = function(pck){
  jobs.create('check component', {
    title: 'Add new component: `' + pck.repo,
    data: pck
  })
  .priority('high')
  .save();
  jobs.promote();
}
*/

/**
 * Twitt job
 */

exports.twitt = function(pck, delay){
};


/**
 * Get all components from component server
 * via REST
 */

jobs.process('polling', 1, function(job, done){
  component.search(null, function(err, res){
    if (err) return error(err, done);

    for (var i = 0, pck = res[0]; i < res.length; i++, pck = res[i]) {
      if (res[i]) {
        exports.check(res[i], i * 1000);
      }
    }
    done();
  });
});

/**
 * Check component into db
 */

jobs.process('check component', 1, function(job, done){
  var pck = job.data.data;

  db.cmps.find({ repo: pck.repo }, function(err, data){
    if (err) return error(err, done);
    if (!data.length) {
      exports.add(pck);
    }
    done();
  });
});

/**
 * Add new component into db
 */

jobs.process('add component', 1, function(job, done){
  var pck = job.data.data;
  var data = {
    name: pck.name,
    repo: pck.repo,
    version: pck.version,
    pck: JSON.stringify(pck)
  };

  db.cmps.insert(data, function(err, doc){
    if (err) return error(err, done);
    done();
  });
});

/**
 * Error notificator
 *
 * @param {Object|String} err error description
 * @param {Function} done job callback (optional)
 * @api private
 */

function error(err, done){
  console.log('-> err -> ', err);
  done && done(err);
}

// start the UI
kue.app.listen(3000);
console.log('UI started on port 3000');
