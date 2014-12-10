(function(Transcoder) {
	"use strict";
	var groove = require('groove');
	var childProcess = require("child_process");
	var logger = require('log4js').getLogger("Transcoder");
	var fs = require("fs");

	Transcoder.sendVideoFile = function(params, res) {
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
		res.on('close', function() {
			ffmpeg.kill();
		});
	}

	// TODO find if it is better to transcode on streaming or on upload.
	Transcoder.sendAudioFile = function(params, res) {
		logger.debug("sending audio file");
		var stats = fs.statSync(params.location)
		var fileSizeInBytes = stats["size"]

		var info = {};
		info.start = 0;
		info.end = parseInt(stats.size / 9) - 1;
		info.size = parseInt(stats.size / 9);
		info.modified = stats.mtime;
		info.length = info.end - info.start + 1;

		var header = {
			"Cache-Control": "public",
			Connection: "keep-alive",
			"Content-Type": info.mime,
			"Content-Disposition": "inline; filename=" + info.file + ";"
		};

		// Partial http response
		var code = 206;
		header.Status = "206 Partial Content";
		header["Accept-Ranges"] = "bytes";
		header["Content-Range"] = "bytes " + info.start + "-" + info.end + "/" + info.size;

		header.Pragma = "public";
		header["Last-Modified"] = info.modified.toUTCString();
		header["Content-Transfer-Encoding"] = "binary";
		header["Content-Length"] = info.length;

		res.writeHead(code, header);

		logger.debug("convert audio file ", __dirname + '/audioConv.sh');
		var audioConv = childProcess.spawn(__dirname + '/audioConv.sh',[
			params.location,  //first parameter is the file's location relative to the bash script
			0,                //second parameter specifies a start time offset
			9,                //third parameter specifies which variable encoding to use 0-9, with 0 being the best 9 the worst
		]);
		audioConv.stdout.pipe(res);

		res.on('close', function() {
			audioConv.kill();
		});
		
		audioConv.stderr.on('data', function(d) {
			logger.debug(d.toString());
		});
	};	

}(exports));