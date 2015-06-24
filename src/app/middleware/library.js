(function(Library) {
	"use strict";

	var scan = require("./scanner");
	var _ = require("underscore"),
		logger = require("log4js").getLogger('Library'),
		nconf = require("nconf");

	Library.data  = {audio: [], video: []};
	Library.flatten = {};
	Library.scanProgress = false;

	Library.beginScan = function(callback){
		var that = this;
		scan.library(function(lib){
			that.populate("audio", lib.audio, function(){
				that.populate("video", lib.video, callback);				
			});
		});
	};

	Library.populate = function(type, lib, callback){
		Library.flatten = _.union(Library.flatten, _.map(_.groupBy(lib, 'uid'), function(track, uuid){
			return {uuid: uuid, track: track, type: type};
		}));
		
		if (type === "audio"){

			var grpByArtists = _.groupBy(lib, 'artist');
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
			Library.data[type] = groupByArtistsAndAlbum;
		}else{
			logger.info(_.map(_.groupBy(lib, 'uid'), function(track, uuid){
				return {uuid: uuid, track: track, type: type};
			}));
			Library.data[type] = lib;
		}
		callback();
	};

	Library.scanning = function(){
		return this.scanProgress !== undefined ? this.scanProgress : false;
	};

	Library.scan = function(callback){
		var that = this;
		this.scanProgress = true;
		this.beginScan(function(){
			that.scanProgress = false;
			callback();
		});
	};

	Library.getAudioRelativePath = function(uuid){
		return _.first(_.findWhere(this.flatten, {uuid: uuid}).track).relativePath;
	};

	Library.getVideoRelativePath = function(uuid){
		logger.info("search video with: " + uuid);
		_.each(this.flatten, function(element){
			if (element.type === "video"){
				logger.debug(element);	
			}
		});
		return _.first(_.findWhere(this.flatten, {uuid: uuid}).track).relativePath;
	};

	Library.getAudio = function(){
		return this.data.audio;
	};

	Library.getVideo = function(){
		return this.data.video;
	};

	Library.getByUid = function(uuid){
		return _.first(_.findWhere(this.flatten, {uuid: uuid}).track);
	};

}(exports));