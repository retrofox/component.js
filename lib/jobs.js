
var confs = require('../config/confs.json');

/**
 * Module dependencies
 * */

var kue = require('kue')
  , Tuiter = require('tuiter')
  , request = require('superagent')
  , truncate = require('truncate-component')
  , https = require('https')
  , component = require('./component');

// create our job queue

var jobs = kue.createQueue();

// Create Tuiter instance

var tuitter = new Tuiter(confs.tkeys);

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

exports.check = function(pck){
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

exports.update = function(pck, doc){
  jobs.create('update component', {
    title: 'Update component: `' + pck.repo,
    pck: pck,
    doc: doc
  })
  .priority('high')
  .save();
};

/**
 * Add `emit twitt` job
 */

exports.twitt = function(doc){
  jobs.create('emit twitt', {
    title: 'Emit twitt for: `' + doc.repo,
    doc: doc
  })
  .save();
};


/**
 * Processing: Get all components from component server via REST
 */

jobs.process('polling', 1, function(job, done){
  component.search(null, function(err, res){
    if (err) return error(err, done);

    for (var i = 0, pck = res[0]; i < res.length; i++, pck = res[i]) {
      if (res[i]) {
        exports.check(res[i]);
      }
    }
    done();
  });
});

/**
 * Processing: Check component into db
 */

jobs.process('check component', 1, function(job, done){
  var pck = job.data.data;

  db.components.findOne({ repo: pck.repo }, function(err, doc){
    if (err) return error(err, done);
    if (!doc) {
      exports.add(pck);
      console.log('Add `%s` component.', pck.repo);
    } else {
      if (doc.version != pck.version) {
        console.log('Update `%s` component. %s -> %s'
          , pck.repo, doc.version, pck.version);
        exports.update(pck, doc);
      } else {
        console.log('Nothing was changed in `%s` component', doc.repo);
      }
    }

    done();
  });
});

/**
 * Processing: Add new component into db
 */

jobs.process('add component', 1, function(job, done){
  var pck = job.data.pck;
  var data = {
    name: pck.name,
    repo: pck.repo,
    version: pck.version,
    description: pck.description,
    twitted: false,
    pck: JSON.stringify(pck)
  };

  db.components.insert(data, function(err, doc){
    if (err) return error(err, done);
    done();
  });
});

/**
 * Processing: Update component in db
 */

jobs.process('update component', 1, function(job, done){
  var pck = job.data.pck;
  var doc = job.data.doc;

  db.components.update(doc._id, { $set: {
    version: pck.version,
    pck: JSON.stringify(pck)
  } }, function(err, doc){
    if (err) return error(err, done);
    done();
  });
});

/**
 * Processing: Emiite new twitt for a new component
 */

jobs.process('emit twitt', 1, function(job, done){
  var doc = job.data.doc;

  // check github repository
  component.shortly('https://github.com/' + doc.repo, function(err, short){
    var text = 'New: "' + doc.repo + '"' +
          (err ? '' : ' ' + short) +
          (doc.author ? ('. ' + doc.author + '. ') : '') +
          (doc.version ? (' [' + doc.version + '] ') : '') +
          (doc.description ? (' → ' + doc.description + '. ') : '');

    text = truncate(text, 139, '…');

    tuitter.update({ status: text }, function(err, res){
      if (err) {
        error(res);
        return done('Twitt could not be sent');
      }
      console.log('Twitt: `%`', text);
      done();
    });
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
