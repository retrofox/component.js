
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
  , truncate = require('truncate-component')
  , component = require('./component');

// create our job queue

var jobs = kue.createQueue();

// Create Tuiter instance

var tuitter = new Tuiter(confs.testerkeys);

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

exports.twitt = function(pck, doc, time){
  jobs.create('emit twitt', {
    title: 'Emit twitt for: `' + pck.repo,
    pck: pck,
    doc: doc
  })
  .delay(time)
  .priority('high')
  .save();

  jobs.promote();
};


/**
 * Get all components from component server
 * via REST
 */

// natch counting

var diff = 0;

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
 * Check component into db
 */

jobs.process('check component', 1, function(job, done){
  var pck = job.data.data;

  db.cmps.findOne({ repo: pck.repo }, function(err, doc){
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
    exports.twitt(pck, doc, (1000 * 60) * diff);
    diff++;
    done();
  });
});

/**
 * Update component in db
 */

jobs.process('update component', 1, function(job, done){
  var pck = job.data.pck;
  var doc = job.data.doc;

  db.cmps.update(doc._id, { $set: {
    version: pck.version,
    pck: JSON.stringify(pck)
  } }, function(err, doc){
    if (err) return error(err, done);
    done();
  });
});

jobs.process('emit twitt', 1, function(job, done){
  var pck = job.data.pck;
  var doc = job.data.doc;
  diff--;

  // check github repository
  component.shortly('https://github.com/' + pck.repo, function(err, short){
    var text = 'New component: ' + pck.repo +
          (err ? '. ' : '(' + short + '). ') +
          (pck.author ? (pck.author + '. ') : '') +
          (pck.keywords ? ('=> ' + pck.keywords.join(', ')) : '');

    text = truncate(text, 139, '…');

    tuitter.update({ text: text }, function(err, res){
      if (err) {
        error(res);
        return done('Twitt could not be sent');
      }
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
