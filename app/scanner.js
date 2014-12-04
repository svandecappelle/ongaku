(function(Scanner) {
	"use strict";

	var fs = require("fs"),
		logger = require("log4js").getLogger("Scanner"),
		async = require("async"),
		_  = require("underscore"),
		path = require("path"),
		mm = require('musicmetadata');;

	Scanner.library = function(callback){
		var lib = [];
		this.scan("/home/svandecappelle/Musique", lib, function(){
			callback(lib);
		});
	};


	Scanner.scan = function(apath, results, callback) {
		fs.readdir(apath, function(err, files) {
			var counter = 0;
			async.whilst(
				function() {
					return counter < files.length;
				},
				function(cb) {
					var file = files[counter++];
					var newpath = path.join(apath, file);
					fs.stat(newpath, function(err, stat) {
						if (err) return cb(err);
						
						if (stat.isFile()) {
							var metadataParser = mm(fs.createReadStream(newpath));

							metadataParser.on("metadata", function(metadatas){
								var libElement = Scanner.song(file, stat, newpath);
								
								libElement.metadatas = metadatas;
								results.push(libElement);
								logger.debug(libElement);
								cb(null, results); // asynchronously call the loop
							});
							
						}
						if (stat.isDirectory()) {
							Scanner.scan(newpath, results,cb); // recursion loop
						}
					});
				},
				function(err) {
					logger.info("Scan finished");
					callback(err); // loop over, come out
				}
			);
		});
	};

	Scanner.song = function(file, stats, path){
		return {
			artist: "artist",
			title: file
		};
	};

}(exports));