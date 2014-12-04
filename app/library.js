(function(Library) {
	"use strict";

	var scan = require("./scanner");
	var library = [];

	scan.library(function(lib){
		library = lib;
	});

	Library.get = function(){
		return library;
	};

}(exports));