/*jslint node: true */
const fs = require("fs");
const logger = require("log4js").getLogger("Scanner");
const async = require("async");
const _  = require("underscore");
const communication = require('../communication');
const path = require("path");
const nconf = require("nconf");
const uuid = require('uuid');
const crypto = require('crypto');
const ProgressBar = require('progress');
const events = require("events");

var Decoder = require('./decoder').class;

_.mixin({
  'orderKeysBy': function (obj, comparator, order) {
    if (_.isString(comparator) && _.isEmpty(order)) {
      order = comparator;
      comparator = null;
    }
    var keys = _.sortBy(_.keys(obj), function (key) {
      return comparator ? comparator(obj[key], key) : key;
    }, order);

    var values = _.map(keys, function (key) {
      return obj[key];
    });

    return _.object(keys, values);
  }
});

const walkSync = (dir, filelist) => {
  if ( ! filelist ){
    filelist = [];
  }
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(file => {
      filelist = filelist.concat(path.join(dir, file));
      
      if (fs.statSync(path.join(dir, file)).isDirectory()){
        filelist = walkSync(path.join(dir, file), filelist);
      }
    });
  }
  return filelist;
}

class Scanner extends events.EventEmitter {
  
  constructor () {
    super();
    this.all_files_count = 0;
    this.scanned_files_count = 0;  
  }

  status () {
    return this.scanned_files_count * 100 / this.all_files_count;
  };

  addToScan (folder){
    this.all_files_count += walkSync(folder).length;
  }

  removeToScan (folder){
    this.all_files_count -= walkSync(folder).length;
  }

  library () {
    this.all_files_count = 0;
    this.scanned_files_count = 0;

    var audio = [],
        video = [];
    logger.info("loading new entries into library.");

    if (Array.isArray(nconf.get("library"))){
      var folders = nconf.get("library");
      var i = folders.length;

      var scanned = {
        audio: [],
        video: []
      }
      
      return new Promise((resolve, reject) => {
        async.map(folders, (folder, next) => {
          this.scanFolder(folder).then( (ret) => {
            var finishedType;

            logger.debug("directory scanned", folder);
            scanned.audio.push(folder);
            scanned.video.push(folder)
            logger.debug(scanned);
            ret.isFinishedAll = true;
            console.log('');

            delete scanned.video[scanned.video.indexOf(folder)];
            delete scanned.audio[scanned.audio.indexOf(folder)];

            next(null, ret);        
          });
        }, function(error, ret){
          if (error) {
            logger.error("Directories scanned with error", error);
            return reject(error);
          }

          logger.info("all directories scanned");
          resolve(ret);
        });
      });
    } else {
      var folder = nconf.get("library");
      logger.debug('scan unique folder:', folder);

      return this.scanFolder(folder);
    }
  };

  scanFolder (folder) {

    return new Promise((resolve, reject) => {
      logger.debug(`scanFolder: ${folder}`);
      if (fs.existsSync(folder)) {
        async.parallel({
          audio: (next) => {
            this.scanAudio(folder).then((res) => {
              logger.debug(`Callback scan audio folder: ${folder}`, res.length);
              next(null, res);
            });
          },
          video: (next) => {
            this.scanVideo(folder).then((res) => {
              logger.debug(`Callback scan video folder: ${folder}`, res.length);
              next(null,  res);
            });
          }
        }, function(err, scanned){
          logger.info(`Adding ${scanned.audio.length} audio files and ${scanned.video.length} video files to library.`);
          resolve(scanned);
        });
      } else{
        reject(`Folder ${folder} does not exists`);
      }
    });
  };

  scanVideo (apath) {
      return this.scan(apath, new Decoder("video"));
  };

  scanAudio (apath, callback) {
      return this.scan(apath, new Decoder("audio"));
  };

  scan (apath, appender) {
    return new Promise((resolve, reject) => {

      logger.debug("Scanning " + appender.type + " directory: ".concat(apath));
      var files = walkSync(apath);
      files = _.filter(files, (file) => {
        return appender.check(file);
      });
      this.all_files_count += files.length;
      logger.debug(`${this.all_files_count} files to scan on ${apath}`);

      var bar = new ProgressBar('  "Scanning ' + apath + '" [:bar] :rate/bps :percent :etas', {
        complete: '=',
        incomplete: ' ',
        width: 20,
        total: files.length
      });

      async.mapLimit(files, 25, (file, next) => {
        bar.tick(1);

        this.scanned_files_count += 1;
        logger.debug(`${this.all_files_count}/${this.scanned_files_count} left to scan on ${apath}`);
        logger.debug(`${this.status()} elapsed on ${apath}`);

        setTimeout( () => {
          var message = `<div class="progress" style="min-width: 300px; height: 10px;"><div class="progress-bar progress-bar-info progress-bar-striped active" style="width:${this.status()}%"></div></div>`;

          communication.broadcast("library:scanner:progress", {
            close: false,
            message: message,
            value: this.status()
          });
        }, 250);

        appender.decode(file).then((song) => {
          logger.debug("decoded", song);
          this.emit('decoded', song, appender.type);
          next(null, song);
        }, (e) => {
          logger.error(e);
          next(null, null);
        }).catch((error) => {
          next(null, null);
        });
      }, (err, results) => {
        results = _.compact(results);
        logger.debug("scanned files: ", results.length);
        resolve(results);
      });
    });
  };
}

module.exports = new Scanner();
