"use strict";
var childProcess = require("child_process"),
    ora = require("ora"),
    logger = require('log4js').getLogger("Transcoder"),
    fs = require("fs"),
    assert = require('assert'),
    _ = require("underscore");

class Transcoder {
    sendVideoFile(params, res) {
        res.writeHead({
            'X-Content-Duration': params.duration, //in seconds
            'Content-Duration': params.duration, //in seconds
            'Content-Type': 'video/webm'
        });
        var ffmpeg = childProcess.spawn('ffmpeg', [
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
    sendAudioFile(params, res) {
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
    transcode(params, req, res) {
        logger.debug("sending audio file");
        var outputFile = "/tmp/ongaku/".concat(params.sessionId).concat(".mp3"),
        streamStarted = false;
        
        if (!fs.existsSync("/tmp/ongaku/")){
            fs.mkdir("/tmp/ongaku/");
        }

        /*if (fs.existsSync(outputFile)){
            return this.startStream(req, res, outputFile, params.sessionId);
        }*/

        // Testing the lame lib
        /*
        var lame = require('lame');
        logger.info(params.location);
        let reader = fs.createReadStream(params.location);
        let progress = 0;
        reader.pipe(new lame.Decoder)
            .pipe(res)
            .on('format', console.log)
            .on('close', function () {
            res.end();
            });
        */
        var spinner = ora('Transcoding file to mp3...').start();
        this.exportToMp3(params).then(() => {
            if (!streamStarted) {
                spinner.stop();
                streamStarted = true;
                this.startStream(req, res, outputFile, params.sessionId);
            }
        }, (error) => {
            logger.error(`Error transcoding file: ${params.sessionId}`, error);
        });
    };

    exportToMp3(file) {
        var childProcess = require("child_process");

        var args = [
            "-i", file.location,
            "-ab", "320k",
            "-map_metadata", "0",
            "-id3v2_version", "3",
            "-y",
            "/tmp/ongaku/" + file.sessionId + ".mp3"
        ]

        return new Promise((resolve, reject) => {
            try {   
                var ffmpeg = childProcess.spawn("ffmpeg", args)

                // NOTE: ffmpeg outputs to standard error - Always has, always will no doubt
                ffmpeg.stdout.on("data", (data) => {
                    
                });
/*
                ffmpeg.stderr.on("data", (data) => {
                    reject(data);
                });
*/
                ffmpeg.on("close", (data) => {
                    resolve(data);
                });
            } catch(error) {
                reject(error);
            }   
        });
    }

    startStream(req, res, outputFile, sessionId) {
        var reqStreaming = _.clone(req),
            settings = {
                "mode": "development",
                "forceDownload": false,
                "random": false,
                "rootFolder": "/tmp/ongaku",
                "rootPath": "stream",
                "server": "VidStreamer.js/0.1.4"
            },
            vidStreamer = require("vid-streamer").settings(settings);
        reqStreaming.url = "/stream/".concat(sessionId).concat(".mp3");
        vidStreamer(reqStreaming, res);
    };

    cleanup(playlist, encoder) {
        var file = playlist.items()[0].file;
        playlist.clear();
        file.close((err) => {
            assert.ifError(err);
            encoder.detach((err) => {
                assert.ifError(err);
            });
        });
    };
}

module.exports = new Transcoder();
