var logger = require('log4js').getLogger("UsersRoutes");
var nconf = require("nconf");
var passport = require("passport");
var _ = require("underscore");

var authentication = require("./../../middleware/authentication");
var library = require("./../../middleware/library");
var middleware = require("./../../middleware/middleware");

logger.setLevel(nconf.get('logLevel'));


(function(UsersRoutes) {

	UsersRoutes.load = function (app) {

		authentication.initialize(app);
		authentication.createRoutes(app);


		app.get('/', function (req, res) {
			logger.info("Client access to index ["+req.ip+"]");

			var libraryDatas = library.getAudio();

			logger.debug(libraryDatas);
			middleware.render('songlist', req, res, {library: libraryDatas});

		});

		app.get('/403', function (req, res){
			middleware.render('403', req, res);
		});

		app.get('/video', function(req, res){
			logger.info("Client access to videos ["+req.ip+"]");

			var libraryDatas = library.getVideo();

			logger.debug(libraryDatas);
			middleware.render('videolist', req, res, {library: libraryDatas});
		});

		app.get('/video/stream/:media', function (req, res){
			// ".ogg": "video/ogg
			// to convert to ogv
			// ffmpeg -i demoreel.mp4 -c:v libtheora -c:a libvorbis demoreel.ogv
			
			// To webm
			// ffmpeg -i "fichier source" -codec:v libvpx -quality good -cpu-used 0 -b:v 500k -r 25 -qmin 10 -qmax 42 -maxrate 800k -bufsize 1600k -threads 4 -vf scale=-1:360 -an -pass 1 -f webm /dev/null
			// ffmpeg -i "fichier source" -codec:v libvpx -quality good -cpu-used 0 -b:v 500k -r 25 -qmin 10 -qmax 42 -maxrate 800k -bufsize 1600k -threads 4 -vf scale=-1:360 -codec:a libvorbis -b:a 128k -pass 2 -f webm sortie.webm
			logger.info("streaming video");
			middleware.stream(req, res, req.params.media, "video");
		});

		app.get('/video/library/filter/:search', function (req, res){
			logger.info("Search filtering video library");
			var libraryDatas = library.search(req.params.search, "video");
			middleware.json(req, res, libraryDatas);
		});

		app.get('/library/filter/:search', function (req, res){
			logger.info("Search filtering audio library");
			var libraryDatas = library.search(req.params.search, "audio");
			middleware.json(req, res, libraryDatas);
		});

		app.get('/stream/:media', function (req, res) {
			logger.info("streaming audio");
			middleware.stream(req, res, req.params.media, "audio");
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

		// Posts

		app.post('/playlist/add/:uid', function(req, res){
			var uidFile = req.params.uid;
			logger.info("Add file to playlist", uidFile);
			if (req.session.playlist === undefined){
				req.session.playlist = [];
			}
			var track = library.getByUid(uidFile);
			if (track !== undefined){
				req.session.playlist.push(track);
				req.session.save(function(){
					res.setHeader('Access-Control-Allow-Credentials', 'true');
					res.send({all: req.session.playlist, lastAdded: track});
				});
			}else{
				logger.warn("A playlist add request returns unknown track for: " + uidFile);
				res.send({all: req.session.playlist, lastAdded: track});				
			}
		});
		
		app.post('/playlist/remove/:id', function(req, res){
			var id = req.params.id;
			logger.info("Remove file index to playlist: ", id);
			if (req.session.playlist !== undefined){
				req.session.playlist.slice(id, 1);
			}
			
			req.session.save(function(){
				res.setHeader('Access-Control-Allow-Credentials', 'true');
				res.send({all: req.session.playlist});
			});
		});


	};
})(exports);