
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
 * Add `polling` job
 */

exports.polling = function(nid, fn){
  jobs.create('polling', {
    title: 'Polling data via REST from `' + confs.remote + '`'
  }).save();
};

/**
 * Add `check package` job
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
 * Add `add` job
 */

exports.add = function(pck){
  jobs.create('add component', {
    title: 'Add new component: `' + pck.repo,
    pck: pck
  })
  .priority('high')
  .save();
};

/**
 * Add `update` job
 */

exports.update = function(pck, pckDB){
  jobs.create('update component', {
    title: 'Update component: `' + pck.repo,
    pck: pck,
    pckDB: pckDB
  })
  .priority('high')
  .save();
};

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

  db.cmps.findOne({ repo: pck.repo }, function(err, pckDB){
    if (err) return error(err, done);
    if (!pckDB) {
      exports.add(pck);
      console.log('Add `%s` component.', pck.repo);
    } else {
      if (pckDB.version != pck.version) {
        console.log('Update `%s` component. %s -> %s'
          , pck.repo, pckDB.version, pck.version);
        exports.update(pck, pckDB);
      } else {
        console.log('Nothing was changed in `%s` component', pckDB.repo);
      }
    }

    done();
  });
});

/**
 * Add new component into db
 */

jobs.process('add component', 1, function(job, done){
  var pck = job.data.pck;
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
 * Update component in db
 */

jobs.process('update component', 1, function(job, done){
  var pck = job.data.pck;
  var pckDB = job.data.pckDB;

  db.cmps.update(pckDB._id, { $set: {
    version: pck.version,
    pck: JSON.stringify(pck)
  } }, function(err, doc){
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
  if (done) done(err);
}

// start the UI
kue.app.listen(3000);
console.log('UI started on port 3000');
