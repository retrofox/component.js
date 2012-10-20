
/**
 * Config
 */

var confs = require('./config/confs.json');

/**
 * Module dependencies.
 */

var Tuiter = require('tuiter');

/**
 * Twitter emitter
 */

console.log('-> confs -> ', confs);

var tuitter = new Tuiter(confs.tkeys);

tuitter.update({ status: 'TW' }, function(err, res){
  console.log('-> err -> ', err);
  console.log('-> res -> ', res);
});

tuitter.filter({ track: ['nodejs','pokemon'] }, function(stream){
  var client, temp;
  stream.on('tweet', function(data){
    console.log('-> data -> ', data);
    console.log('-----');
  });

  stream.on('error', function(err){
    console.log(err);
  });
});

process.on('uncaughtException', function(err){
  console.log(err);
});
