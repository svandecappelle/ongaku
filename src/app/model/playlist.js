/*jslint node: true */
'use strict';

var logger = require('log4js').getLogger('PlaylistModel'),
    db = require('./database'),
    async = require('async');

(function (Playlist) {
  Playlist.getPlaylists = function (username, callback){
    db.getSetMembers(username + ':playlists', function(err, playlistuids){
      if (err) {
          return callback(err);
      }

      for (var i = 0; i < playlistuids.length; i++) {
        logger.info("playlist: ", playlistuids[i]);
      }
      callback(null, playlistuids);
    });
  };

  Playlist.getPlaylistContent = function (username, playlist, callback){
    db.getSetMembers(username + ':playlist:' + playlist, function(err, songuid){
      if (err) {
          return callback(err);
      }

      for (var i = 0; i < songuid.length; i++) {
        logger.info("playlist song: ", songuid[i]);
      }
      callback(null, songuid);
    });
  };

  Playlist.create = function (username, playlist, callback){
    db.setAdd(username + ':playlists', playlist, callback);
  };

  Playlist.remove = function (username, playlist, callback){
    db.setRemove(username + ':playlists', playlist, callback);
  };

  Playlist.clear = function (username, playlist, callback){
    db.delete(username + ':playlist:' + playlist, callback);
  };

  Playlist.push = function (username, playlist, tracks, callback){
    async.each(tracks, function(track, next){
      db.setAdd(username + ':playlist:' + playlist, track.uid, next);
    }, function(){
      callback();
    });
  };

  Playlist.pop = function (username, playlist, tracks, callback){
    async.each(tracks, function(track, next){
      db.setRemove(username + ':playlist:' + playlist, track.uid, next);
    }, function(){
      callback();
    });
  };

}(exports));
