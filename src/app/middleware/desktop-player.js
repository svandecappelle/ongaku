/*jslint node: true */
(function (DesktopPlayer) {
    "use strict";
    var childProcess = require("child_process"),
        ora = require("ora"),
        logger = require('log4js').getLogger("Transcoder"),
        fs = require("fs"),
        socket = require('../chat'),
        lame = require('lame'),
        Speaker = require('speaker'),
        speaking = new Speaker(),
        decoder = new lame.Decoder(),
        assert = require('assert'),
        moment = require('moment'),
        _ = require("underscore"),
        audioFlow,
        start;
    require("moment-duration-format");

    DesktopPlayer.desktop = function (req, res, media) {
      start = moment();
      audioFlow = fs.createReadStream(media)
        .pipe(decoder)
        .on('format', (format) => {
          console.log(`started desktop plays on ${media}`);
          socket.emit('desktop-playing:started', {
            'uuid': req.params.media,
            'start': start
          });
        })
        .on('data', () => {
          socket.emit('desktop-playing:playing', {
            'avancement': moment.duration(moment().diff(start)).format("mm:ss"),
            'uuid': req.params.media
          });
        })
        .pipe(speaking);
      res.json({message: 'started'});
      // TODO use socket.io to send play state
    };

    DesktopPlayer.end = function (req, res) {
      if (audioFlow){
        audioFlow.end();
      }
      res.json({message: 'stopped'});
    }

    DesktopPlayer.pause = function (req, res) {
      if (audioFlow){
        speaking.end();
      }
      res.json({message: 'paused'});
    }

    DesktopPlayer.resume = function (req, res) {
      speaking = new Speaker();
      if (audioFlow){
        decoder.pipe(speaking);
      }
      res.json({message: 'resumed'});
    }

}(exports));
