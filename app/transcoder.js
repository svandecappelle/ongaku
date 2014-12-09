(function(Transcoder) {
	"use strict";
	var groove = require('groove');

	Transcoder.sendVideoFile = function(params, res) {
		res.writeHead({
			'X-Content-Duration' : params.source.duration, //in seconds
			'Content-Duration'   : params.source.duration, //in seconds
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


	Transcoder.sendAudioFile = function(params, res) {
		res.writeHead({
			'X-Content-Duration' : params.source.duration,
			'Content-Duration'   : params.source.duration,
			'Content-Type'       : 'audio/mp3'
		});
		var audioConv = childProcess.spawn(__dirname + '/audioConv.sh',[
			params.location,  //first parameter is the file's location relative to the bash script
			0,                //second parameter specifies a start time offset
			3,                //third parameter specifies which variable encoding to use 0-9, with 0 being the best 9 the worst
		]);
		audioConv.stdout.pipe(res);
			res.on('close', function() {
			audioConv.kill();
		});
		audioConv.stderr.on('data', function(d) {
			console.log(d.toString());
		});
	};	

}(exports));