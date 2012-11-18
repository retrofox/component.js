
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
  , wiki = require('component-wiki')
  , Octo = require('octonode')
  , jog = require('jog')
  , component = require('./component');

// create our job queue

var jobs = kue.createQueue();

// Create Tuiter instance

var tuitter = new Tuiter(confs.tkeys);

// GitHUb authenticate

var client = Octo.client({
  username: 'lauramelos',
  password: 'angelamarina'
});

// create log object
var log = jog(new jog.FileStore('/tmp/component.js-log'));

// batch counting vars

var twittsStackCounter = 0;
var componentCounter = 0;

// delay vars

var twittDelay = 1000 * 60 * 3;
var ghDelay = 1000 * 2;

/**
 * Expose `jobs`
 */

exports = module.exports = jobs;

/**
 * Add `wiking` job
 */

exports.wiking= function(){
  log.info('wiki');
  jobs.create('wiking', {
    title: 'Get all components from github components page'
  }).save();
};

/**
 * Add `twitting` job
 */

exports.twitting = function(){
  jobs.create('twitting', {
    title: 'reading untwitted registers from dB'
  }).save();
};

/**
 * Add `check package` job
 *
 * @param {Object} pkg package properties
 * @api public
 */

exports.check = function(pkg){
  jobs.create('check component', {
    title: 'check `' + pkg.repo + '` component.',
    data: pkg
  })
  .priority('high')
  .save();
};

/**
 * Add `add` job
 */

exports.addComponent = function(pkg, t){
  jobs.create('add component', {
    title: 'add new component: `' + pkg.repo,
    pkg: pkg
  })
  .delay(t)
  .priority('high')
  .save();

  jobs.promote();
};

/**
 * Add `update` job
 */

exports.updateComponent = function(pkg, doc, t){
  jobs.create('update component', {
    title: 'update component: `' + pkg.repo,
    pkg: pkg,
    doc: doc
  })
  .delay(t)
  .priority('high')
  .save();

  jobs.promote();
};

/**
 * Add `emit twitt` job
 */

exports.twitt = function(doc, pre, t){
  jobs.create('emit twitt', {
    title: 'emit twitt for: `' + doc.repo,
    pre: pre,
    doc: doc
  })
  .delay(t)
  .priority('high')
  .save();

  jobs.promote();
};


/**
 * Processing: Get all components from component server
 * via REST using wiki component
 */

jobs.process('wiking', 1, function(job, done){
  wiki(function(err, pkgs){
    if (err) return done(err);

    for (var i = 0; i < pkgs.length; i++) {
      if (pkgs[i]) {
        exports.check(pkgs[i]);
      }
    }
    exports.twitting();
    done();
  });
});

/**
 * Processing: Get all untwitted components from dB
 */

jobs.process('twitting', 1, function(job, done){
  db.components.find({
    $or: [ { twitted: 'zero' }, { twitted: 're-send' } ]
  }, function (err, data){
    if (err) return done(err);
    if (!data.length) return done();

    twittsStackCounter += (data.length - 1);
    data.forEach(function(doc, i){
      var time = twittDelay * i;
      var isNew = doc.twitted == 'zero' ? true : false;
      var set = { twitted: 'stacked' };

      db.components.update(doc._id, { $set: set }, function(err) {
        if (err) return done(err);
        exports.twitt(doc, isNew ? 'new: ' : 'upd: ', time);
        done();
      });
    });
  });
});

/**
 * Processing: Check component into db
 */

jobs.process('check component', 1, function(job, done){
  var pkg = job.data.data;

  db.components.findOne({ repo: pkg.repo }, function(err, doc){
    if (err) return done(err);
    if (!doc) {
      exports.addComponent(pkg, ghDelay * componentCounter);
      componentCounter++;
      log.info('add component', pkg);
    } else {
      if (doc.version != pkg.version) {
        log.info('update component', pkg);

        componentCounter++;
        //exports.updateComponent(pkg, doc, ghDelay * componentCounter);
      } else {
        log.info('same component', doc);
      }
    }
    done();
  });
});

/**
 * Processing: Add new component into db
 */

jobs.process('add component', 1, function(job, done){
  var pkg = job.data.pkg;
  var data = {
    name: pkg.name,
    repo: pkg.repo,
    version: pkg.version,
    twitted: 'zero',
    gh_status: 200,
    pkg: JSON.stringify(pkg)
  };

  // request repo from github
  var repo = client.repo(pkg.repo);
  repo.info(function(err, gh){
    if (err) {
      data.gh_status = 404;
      data.twitted = 'waiting';
    } else {
      data.gh = JSON.stringify(gh);
      data.stars = gh.watchers_count;
      data.forks = gh.forks_count;
    }

    componentCounter--;

    db.components.insert(data, function(err, doc){
      if (err) return done(err);
      done();
    });
  });
});

/**
 * Processing: Update component in db
 */

jobs.process('update component', 1, function(job, done){
  var pkg = job.data.pkg;
  var doc = job.data.doc;

  // request repo from github
  var repo = client.repo(pkg.repo);
  repo.info(function(err, gh){
    if (err) return done(err);

    componentCounter--;
    db.components.update(doc._id, { $set: {
      version: pkg.version,
      stars: gh.watchers_count,
      forks: gh.forks_count,
      twitted: 're-send',
      pkg: JSON.stringify(pkg),
      gh: JSON.stringify(gh)
    } }, done);
  });
});

/**
 * Processing: Emiite new twitt for a new component
 */

jobs.process('emit twitt', 1, function(job, done){
  var doc = job.data.doc;

  // check github repository
  component.shortly('https://github.com/' + doc.repo, function(err, short){
    if (err) return done(err);

    var status = twStatus(job.data.pre, doc, (err ? '' : ' - ' + short));
    tuitter.update({ status: status }, function(err, res){
      twittsStackCounter--;
      var set = {};
      var tErr = err;

      if (err) {
        log.error('twitting emision', { status: status, error: err });
        set.twitted = 'failed';
      } else {
        set.twitted = 'done';
      }

      db.components.update(doc._id, { $set: set }, function(err) {
        if (err) return done(err);
        if (tErr) return done('Twitt could not be sent');
        log.info('emit twitt', status);
        done();
      });
    });
  });
});

/**
 * twstatus
 */

function twStatus(pre, doc, short){
  var pkg = JSON.parse(doc.pkg);
  var hashes = '';

  if (pkg.keywords && pkg.keywords.length) {
     pkg.keywords.map(function(v){
      return v.replace(/\s/,'-');
    });
    hashes = ' #' + pkg.keywords.join(' #');
  }

  var summ = 'undefined' != typeof doc.stars ? ' ★' + doc.stars : '';
  summ += 'undefined' != typeof doc.forks ? ' ⑂' + doc.forks : '';
  var desc = pkg.description ? ' → ' + pkg.description : '';

  var text = '"new: '+ pkg.repo + short +
      (pkg.twitter ? (' from ' + pkg.twitter + '"') : '"') +
      (pkg.version ? (' [' + pkg.version + ']') : '') +
      desc +
      hashes;

  text = truncate(text, 140 - summ.length, '…');
  text += summ;

  return text;
}

// start the UI
kue.app.listen(3010);
console.log('UI started on port 3010');
