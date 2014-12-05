(function(Scanner) {
	"use strict";

	var fs = require("fs"),
		logger = require("log4js").getLogger("Scanner"),
		async = require("async"),
		_  = require("underscore"),
		path = require("path"),
		nconf = require("nconf"),
		mm = require('musicmetadata'),
		// groove seems to be better than mm
		groove = require('groove'),
		uuid = require('uuid');

	Scanner.library = function(callback){
		var lib = [];
		this.scan(nconf.get("library"), lib, function(){
			callback(lib);
		});
	};


	Scanner.scan = function(apath, results, callback) {
		logger.debug("Scanning directory: ".concat(apath));
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
							logger.info("File found".concat(newpath));
							var metadataParser = mm(fs.createReadStream(newpath));

							if (_.contains(nconf.get('supported-files'), path.extname(newpath).replace(".", ""))){
								groove.open(newpath, function(err, file) {
									if (err) throw err;
									var libElement = Scanner.song(newpath, file.metadata(), newpath);
									results.push(libElement);
									logger.debug(libElement);
									
									file.close(function(err) {
										if (err) throw err;
									});
									cb(null, results); // asynchronously call the loop
								});	
							}else{
								cb(null, results); // asynchronously call the loop
							}
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

	Scanner.song = function(file, metadatas, path){
		return {
			artist: metadatas.artist,
			file: file,
			title: metadatas.title,
			album: metadatas.album,
			metadatas: metadatas,
			uid: uuid.v1()
		};
	};

}(exports));