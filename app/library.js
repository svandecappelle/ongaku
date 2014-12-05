(function(Library) {
	"use strict";

	var scan = require("./scanner");
	var library = [];

	Library.get = function(callback){
		scan.library(function(lib){
			callback(lib);
		});
	};

}(exports));