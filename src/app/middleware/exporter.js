"use strict";
const fs = require("fs");
const JSZip = require("jszip");
const logger = require("log4js").getLogger("Exporter");
const _ = require("underscore");

  class Exporter {
    toZip (entries, user) {
      return new Promise((resolve, reject) => {
        var filename = "/tmp/".concat(user).concat(".zip");
        var zip = new JSZip();
        _.each(entries, function(entry){
          _.each(entry.albums, function(album){
            _.each(album.tracks, function(track){
              logger.info("add track to zip file export: ", track.relativePath);
              zip.file(track.relativePath, fs.readFileSync(track.file));
            });
          });
        });
        var buffer = zip.generate({type:"nodebuffer"});
        fs.writeFile(filename, buffer, function(err) {
          if (err) reject(err);
          resolve(filename);
        });
      });
    }

}

module.exports = new Exporter();
