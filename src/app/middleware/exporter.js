(function (Exporter) {
    "use strict";
    var fs = require("fs"),
      JSZip = require("jszip"),
      logger = require("log4js").getLogger("Exporter"),
      _ = require("underscore");


    Exporter.toZip = function (entries, user, callback){
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
        if (err) throw err;
        callback(filename);
      });
    };
}(exports));
