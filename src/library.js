(function(Library) {
	"use strict";

	var scan = require("./scanner");
	var _ = require("underscore"),
		logger = require("log4js").getLogger('Library'),
		nconf = require("nconf");

	Library.data  = [];
	Library.flatten = {};


	Library.scan = function(callback){
		this.scanProgress = true;
		scan.library(function(lib){
			
			var grpByArtists = _.groupBy(lib, 'artist');
			Library.flatten = _.map(_.groupBy(lib, 'uid'), function(track, uuid){
				return {uuid: uuid, track: track};
			});
			
			var groupByArtistsAndAlbum = [];

			_.each(grpByArtists, function(tracks, artist){

				var albums = _.map(_.groupBy(tracks, 'album'), function(tracks, title){
					if (!title){
						title = "Unknown album"
					}
					return {title: title, tracks: tracks};
				});
				
				if (!artist){
					artist = "Uknown artist";
				}

				var artist = {
					artist: artist,
					albums: albums
				};

				groupByArtistsAndAlbum.push(artist);

			});

			Library.data = groupByArtistsAndAlbum;
			Library.scanProgress = false;
			callback();

		});
	};

	Library.scanning = function(){
		return this.scanProgress;
	};

	Library.getRelativePath = function(uuid){
		return _.first(_.findWhere(this.flatten, {uuid: uuid}).track).relativePath;
	};

	Library.get = function(){
		return this.data;
	};

	Library.getByUid = function(uuid){
		return _.first(_.findWhere(this.flatten, {uuid: uuid}).track);
	};

}(exports));