/*jslint node: true */
'use strict';

var logger = require('log4js').getLogger('PlaylistModel'),
    db = require('../index'),
    async = require('async');

class PlaylistRedisModel {
  getPlaylists (username, callback){
    db.getSetMembers(username + ':playlists', (err, playlistuids) => {
      if (err) {
          return callback(err);
      }

      callback(null, playlistuids);
    });
  };

  exists (username, playlist, callback){
    db.isSetMember(username + ':playlists', playlist, callback);
  };

  getPlaylistContent (username, playlist, callback){
    db.getList(username + ':playlist:' + playlist, (err, songuid) => {
      if (err) {
          return callback(err);
      }

      callback(null, songuid);
    });
  };

  create (username, playlist, callback){
    db.setAdd(username + ':playlists', playlist, callback);
  };

  remove (username, playlist, callback){
    db.setRemove(username + ':playlists', playlist, () => {
      this.clear(username, playlist, callback);
    });
  };

  clear (username, playlist, callback){
    db.delete(username + ':playlist:' + playlist, callback);
  };

  push (username, playlist, tracks, callback){
    async.forEach(tracks, (track, next) => {
      db.listAppend(username + ':playlist:' + playlist, track.uid, next);
    }, () => {
      callback();
    });
  };

  pop (username, playlist, tracks, callback){
    db.listRemoveAll(username + ':playlist:' + playlist, tracks, callback);
  };

}

module.exports = PlaylistRedisModel;
