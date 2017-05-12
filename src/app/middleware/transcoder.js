/*jslint node: true */
(function (Transcoder) {
    "use strict";
    var childProcess = require("child_process"),
        ora = require("ora"),
        logger = require('log4js').getLogger("Transcoder"),
        fs = require("fs"),
        assert = require('assert'),
        _ = require("underscore");

    // groove seems to be better than mm
    try {
      var groove = require('groove');
    } catch (ex){
      logger.warn("Optional dependency not installed");
    }

    Transcoder.sendVideoFile = function (params, res) {
        res.writeHead({
            'X-Content-Duration' : params.duration, //in seconds
            'Content-Duration'   : params.duration, //in seconds
            'Content-Type'       : 'video/webm'
        });
        var ffmpeg = childProcess.spawn('ffmpeg',  [
            '-i', params.location,      //location of our video file (use absolute, else you'll have a bad time)
            '-ss', '0',                 //starting time offset
            '-c:v', 'libvpx',           //video using vpx (webm) codec
            '-b:v', '1M',               //1Mb/s bitrate for the video
            '-cpu-used', '2',           //total # of cpus used
            '-threads', '4',            //number of threads shared between all cpu-used
            '-deadline', 'realtime',    //speeds up transcode time (necessary unless you want frames dropped)
            '-strict', '-2',            //ffmpeg complains about using vorbis, and wanted this param
            '-c:a', 'libvorbis',        //audio using the vorbis (ogg) codec
            "-f", "webm",               //filetype for the pipe
            'pipe:1'                    //send output to stdout
        ]);
        ffmpeg.stdout.pipe(res);
        res.on('close', function () {
            ffmpeg.kill();
        });
    };

    // TODO find if it is better to transcode on streaming or on upload.
    Transcoder.sendAudioFile = function (params, res) {
        logger.debug("sending audio file");
        var stats = fs.statSync(params.location),
            fileSizeInBytes = stats.size,
            info = {
                start: 0,
                end: parseInt(stats.size / 9) - 1,
                size: parseInt(stats.size / 9),
                modified: stats.mtime,
                length: function () {
                    return this.end - this.start + 1;
                }
            },
            header = {
                Status: "206 Partial Content",
                "Cache-Control": "public",
                Connection: "keep-alive",
                "Content-Type": info.mime,
                "Content-Disposition": "inline; filename=" + info.file + ";",
                "Accept-Ranges": "bytes",
                "Content-Range": "bytes " + info.start + "-" + info.end + "/" + info.size,
                Pragma: "public",
                "Last-Modified": info.modified.toUTCString(),
                "Content-Transfer-Encoding": "binary",
                "Content-Length": info.length
            },
            // http: partial response.
            code = 206,
            audioConv = childProcess.spawn(__dirname + '/audioConv.sh', [
                params.location,  //first parameter is the file's location relative to the bash script
                0,                //second parameter specifies a start time offset
                9,                //third parameter specifies which variable encoding to use 0-9, with 0 being the best 9 the worst
            ]);

        res.writeHead(code, header);
        logger.debug("convert audio file ", __dirname + '/audioConv.sh');

        audioConv.stdout.pipe(res);

        res.on('close', function () {
            audioConv.kill();
        });

        audioConv.stderr.on('data', function (d) {
            logger.debug(d.toString());
        });
    };

    // TODO find if it is better to transcode on streaming or on upload.
    Transcoder.transcode = function(params, req, res) {
        logger.debug("sending audio file");
        var outputFile = "/tmp/".concat(params.sessionId).concat(".mp3"),
          that = this,
          streamStarted = false;
        if (groove){
          groove.setLogging(groove.LOG_INFO);

          var playlist = groove.createPlaylist(),
              encoder = groove.createEncoder(),
              outStream = fs.createWriteStream(outputFile);
          encoder.formatShortName = "mp3";
          encoder.codecShortName = "lame";

          encoder.on('buffer', function () {
              var buffer;
              while (buffer = encoder.getBuffer()) {
                  if (buffer.buffer) {
                      outStream.write(buffer.buffer);
                  } else {
                      if (!streamStarted) {
                          streamStarted = true;
                          that.startStream(req, res, outputFile, params.sessionId);
                      }

                      that.cleanup(playlist, encoder);
                      return;
                  }
              }
          });
          encoder.attach(playlist, function (err) {
              assert.ifError(err);

              groove.open(params.location, function (err, file) {
                  assert.ifError(err);
                  playlist.insert(file, null);
              });
          });
        } else {
          var spinner = ora('Transcoding file to mp3...').start();

          exportToMp3(params, function(){

          }, function(){
            if (!streamStarted) {
              spinner.stop();
              streamStarted = true;
              that.startStream(req, res, outputFile, params.sessionId);
            }
          });
        }
    };

    function exportToMp3(file, onData, onDone){
      var childProcess = require("child_process");

    	var args = [
    		"-i", file.location,
    		"-ab", "320k",
    		"-map_metadata", "0",
    		"-id3v2_version", "3",
    		"-y",
    		"/tmp/" + file.sessionId + ".mp3"
    	]

    	var ffmpeg = childProcess.spawn("ffmpeg", args)

    	// NOTE: ffmpeg outputs to standard error - Always has, always will no doubt

    	ffmpeg.stdout.on("data", function(data) {
    		onData({out: data})
    	})

      ffmpeg.stderr.on("data", function(data) {
    		onData({err: data})
    	})

      ffmpeg.on("close", function(data) {
        onDone({out: data})
      })

      ffmpeg.on("close", function(data) {
    		onDone({err: data})
    	})
    }

    Transcoder.startStream = function (req, res, outputFile, sessionId) {
        var reqStreaming = _.clone(req),
            settings = {
                "mode": "development",
                "forceDownload": false,
                "random": false,
                "rootFolder": "/tmp/",
                "rootPath": "stream",
                "server": "VidStreamer.js/0.1.4"
            },
            vidStreamer = require("vid-streamer").settings(settings);
        reqStreaming.url = "/stream/".concat(sessionId).concat(".mp3");
        vidStreamer(reqStreaming, res);
    };

    Transcoder.cleanup = function (playlist, encoder) {
        var file = playlist.items()[0].file;
        playlist.clear();
        file.close(function (err) {
            assert.ifError(err);
            encoder.detach(function (err) {
                assert.ifError(err);
            });
        });
    };

}(exports));
