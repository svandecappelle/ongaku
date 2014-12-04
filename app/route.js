module.exports = function (app, options) {

	var middleware = require("./middleware");
	var nconf = require("nconf");
	var authentication = require("./authentication");
	var logger = require("log4js").getLogger('route');
	var passport = require("passport");
	var library = require("./library");
	var _ = require("underscore");

	authentication.initialize(app);
	authentication.createRoutes(app);

	app.get('/', function (req, res) {
		logger.info("Client access to index ["+req.ip+"]");

		var libraryDatas = library.get();

		var grpByArtists = _.groupBy(libraryDatas, 'artist');

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

		logger.warn(groupByArtistsAndAlbum[0].albums[0]);
		middleware.render('songlist', req, res, {library: groupByArtistsAndAlbum});
	});

	app.get('/403', function (req, res){
		middleware.render('403', req, res);
	});

	app.get('/video/:video', function (req, res){
		// ".ogg": "video/ogg
		// to convert to ogv
		// ffmpeg -i demoreel.mp4 -c:v libtheora -c:a libvorbis demoreel.ogv
		
		// To webm
		// ffmpeg -i "fichier source" -codec:v libvpx -quality good -cpu-used 0 -b:v 500k -r 25 -qmin 10 -qmax 42 -maxrate 800k -bufsize 1600k -threads 4 -vf scale=-1:360 -an -pass 1 -f webm /dev/null
		// ffmpeg -i "fichier source" -codec:v libvpx -quality good -cpu-used 0 -b:v 500k -r 25 -qmin 10 -qmax 42 -maxrate 800k -bufsize 1600k -threads 4 -vf scale=-1:360 -codec:a libvorbis -b:a 128k -pass 2 -f webm sortie.webm
		middleware.getVideo(req, res, "./video/" + req.param.video);
	});

	app.get('/stream/:media', function (req, res) {
		logger.info("streaming");
		middleware.stream(req, res, nconf.get("library") + req.param.media);
	});

	if (nconf.get("uploader")){
		var fs = require('fs');
		var busboy = require('connect-busboy');
		//...
		app.use(busboy()); 
		//...
		app.get('/upload', function (req, res){
			middleware.render('upload', req, res);
		});
		
		app.post('/fileupload', function (req, res) {
			var fstream;
			req.pipe(req.busboy);
			req.busboy.on('file', function (fieldname, file, filename) {
				logger.warn("Uploading: " + filename); 
				fstream = fs.createWriteStream('./video/' + filename);
				file.pipe(fstream);
				fstream.on('close', function () {
					res.redirect('back');
				});
			});
		});
	}
};