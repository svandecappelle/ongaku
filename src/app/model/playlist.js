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

      callback(null, playlistuids);
    });
  };

  Playlist.exists = function (username, playlist, callback){
    db.isSetMember(username + ':playlists', playlist, callback);
  };

  Playlist.getPlaylistContent = function (username, playlist, callback){
    db.getList(username + ':playlist:' + playlist, function(err, songuid){
      if (err) {
          return callback(err);
      }

      callback(null, songuid);
    });
  };

  Playlist.create = function (username, playlist, callback){
    db.setAdd(username + ':playlists', playlist, callback);
  };

  Playlist.remove = function (username, playlist, callback){
    db.setRemove(username + ':playlists', playlist, function (){
      Playlist.clear(username, playlist, callback);
    });
  };

  Playlist.clear = function (username, playlist, callback){
    db.delete(username + ':playlist:' + playlist, callback);
  };

  Playlist.push = function (username, playlist, tracks, callback){
    async.forEach(tracks, function(track, next){
      db.listAppend(username + ':playlist:' + playlist, track.uid, next);
    }, function(){
      callback();
    });
  };

  Playlist.pop = function (username, playlist, tracks, callback){
    db.listRemoveAll(username + ':playlist:' + playlist, tracks, callback);
  };

}(exports));
