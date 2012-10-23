
/**
 * Config
 */

var confs = require('./config/confs.json');

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
 * Polling from components server
 */

function polling(){
  jobs.polling();
}
