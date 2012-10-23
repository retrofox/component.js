
/**
 * Configs
 */

var confs = require('../config/confs.json');

/**
 * Module dependencies
 * */

var kue = require('kue')
  , db = require('./db')(confs.db)
  , Tuiter = require('tuiter')
  , request = require('superagent')
  , truncate = require('truncate-component')
  , https = require('https')
  , component = require('./component');

// create our job queue

var jobs = kue.createQueue();

// Create Tuiter instance

var tuitter = new Tuiter(confs.tkeys);

// batch counting var

var batchCounter = 0;

/**
 * Expose `jobs`
 */

exports = module.exports = jobs;

function jobs(){
}

/**
 * Add `polling` job
 */

exports.polling = function(){
  console.log('add polling job');
  jobs.create('polling', {
    title: 'polling data via REST from `' + confs.remote + '`'
  }).save();
};

/**
 * Add `twitting` job
 */

exports.twitting = function(){
  jobs.create('twitting', {
    title: 'twitting reading untwitted registers from dB'
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
    title: 'check `' + pck.repo + '` component.',
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
    title: 'add new component: `' + pck.repo,
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
    title: 'update component: `' + pck.repo,
    pck: pck,
    doc: doc
  })
  .priority('high')
  .save();
};

/**
 * Add `emit twitt` job
 */

exports.twitt = function(doc, time){
  jobs.create('emit twitt', {
    title: 'emit twitt for: `' + doc.repo,
    doc: doc
  })
  .delay(time)
  .priority('high')
  .save();

  jobs.promote();
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
    exports.twitting();
    done();
  });
});

/**
 * Processing: Get all untwitted components from dB
 */

var twittingCounter = 0;

jobs.process('twitting', 1, function(job, done){
  db.components.find({ twitted: 'zero' }, function (err, data){
    if (err) return done(err);
    if (!data.length) return done();

    twittingCounter += (data.length - 1);
    data.forEach(function(cmp, i){
      var time = 1000 * 60 * 3 * i;
      var set = { twitted: 'stacked' };
      db.components.update(cmp._id, { $set: set }, function(err) {
        if (err) return done(err);
        exports.twitt(cmp, time);
        done();
      });
    });
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
      console.log('add `%s` component.', pck.repo);
    } else {
      if (doc.version != pck.version) {
        console.log('update `%s` component. %s -> %s'
          , pck.repo, doc.version, pck.version);
        exports.update(pck, doc);
      } else {
        console.log('same [%s] version for `%s` component', doc.version, doc.repo);
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
    twitted: 'zero',
    pck: JSON.stringify(pck)
  };

  db.components.insert(data, function(err, doc){
    if (err) return error(err, done);
    batchCounter++;
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
    var pck =  JSON.parse(doc.pck);
    var hashes = pck.keywords && pck.keywords.length ?
                  ' #' + pck.keywords.join(' #') : '';

    var text = '"' + doc.repo + '"' +
        (err ? '' : ' ' + short) +
        (doc.author ? ('. ' + doc.author + '. ') : '') +
        (doc.twitter ? (' (' + doc.twitter + ')') : '') +
        (doc.version ? (' [' + doc.version + '] ') : '') +
        (doc.description ? (' → ' + doc.description + '. ') : '') +
        hashes;

    text = truncate(text, 138, '…');

    tuitter.update({ status: text }, function(err, res){
      twittingCounter--;

      var set = {};
      var tErr = err;

      if (err) {
        error(res);
        set.twitted = 'failed';
      } else {
        set.twitted = 'done';
      }

      db.components.update(doc._id, { $set: set }, function(err) {
        if (err) return done(err);
        if (tErr) return done('Twitt could not be sent');
        console.log('twitted: `%s`', text);
        done();
      });
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
