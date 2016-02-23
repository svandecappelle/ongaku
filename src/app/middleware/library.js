(function (Library) {
    "use strict";

    var scan = require("./scanner"),
        _ = require("underscore"),
        logger = require("log4js").getLogger('Library'),
        nconf = require("nconf");

    var LastfmAPI = require('lastfmapi');
    var lfm = new LastfmAPI({
        'api_key' : 'f21088bf9097b49ad4e7f487abab981e',
        'secret' : '7ccaec2093e33cded282ec7bc81c6fca'
    });

    logger.setLevel(nconf.get('logLevel'));
    Library.data  = {audio: [], video: []};
    Library.flatten = {};

    Library.audioScanned = false;
    Library.videoScanned = false;
    Library.scanProgress = false;

    Library.loadingCoverAlbums = [];
    Library.loadingCoverArtists = [];

    _.mixin({groupByMulti: function (obj, values, context) {
      if (!values.length)
          return obj;
      var byFirst = _.groupBy(obj, values[0], context),
          rest = values.slice(1);
      for (var prop in byFirst) {
          byFirst[prop] = _.groupByMulti(byFirst[prop], rest, context);
      }
      return byFirst;
    }});

    Library.beginScan = function (callback) {
        var that = this;
        scan.library(function (lib) {
            if (lib.audio){
              that.populate("audio", lib, callback);
            }else if (lib.video){
              that.populate("video", lib, callback);
            }
        });
    };

    Library.populate = function (type, libObject, callback) {

        var lib = libObject[type];

        Library.flatten = _.union(Library.flatten, _.map(_.groupBy(lib, 'uid'), function(track, uuid){
            return _.extend(track[0], {uuid: uuid, type: type});
        }));

        if (type === "audio") {

            var grpByArtists = _.groupBy(lib, 'artist'),
                groupByArtistsAndAlbum = [];

            _.each(grpByArtists, function (tracks, artistbean) {
                var albums = _.map(_.groupBy(tracks, 'album'), function (tracks, title) {
                    if (!title) {
                        title = "Unknown album";
                    }
                    return {title: title, tracks: tracks};
                });

                var artist = {
                    artist: artistbean,
                    albums: albums
                };

                if (Library.loadingCoverAlbums[artist.artist] === undefined){
                  Library.loadingCoverAlbums[artist.artist] = {};
                }

                if (Library.loadingCoverArtists[artist.artist] === undefined){
                  lfm.artist.getInfo({
                      'artist' : artist.artist,
                  }, function (err, art) {
                      if (err) {
                          logger.warn("artist '" + artist.artist + "' not found");
                          Library.loadingCoverArtists[artist.artist] = null;
                      } else if (art.image) {
                        artist.image = getBigImage(art.image);
                        Library.loadingCoverArtists[artist.artist] = artist.image;
                        logger.debug("image artist '" + artist.artist + "': " + artist.image);
                      }
                  });
                } else {
                  logger.debug("already scanned artist '" + artist.artist + "': " + Library.loadingCoverArtists[artist.artist]);
                  artist.image = Library.loadingCoverArtists[artist.artist] = artist.image;
                }
                _.each(albums, function (album, index) {

                    if (album !== "Unknown album" && Library.loadingCoverAlbums[artist.artist][album.title] === undefined) {
                        album.cover = null;
                        lfm.album.getInfo({
                            'artist' : artist.artist,
                            'album' : album.title
                        }, function (err, alb) {
                            if (err) {
                                logger.warn("[" + artist.artist + "] -> album:: '" + album.title + "' not found");
                                Library.loadingCoverAlbums[artist.artist][album.title] = null;
                            } else if (alb.image) {
                                album.cover = getBigImage(alb.image);
                                Library.loadingCoverAlbums[artist.artist][album.title] = album.cover;
                                logger.debug("album cover '" + album.title + "': " + album.cover);
                            }
                        });
                    } else {
                      logger.debug("already scanned album '" + album.title + "': " + Library.loadingCoverAlbums[artist.artist][album.title]);
                      album.cover = Library.loadingCoverAlbums[artist.artist][album.title];
                    }
                });
                groupByArtistsAndAlbum.push(artist);
                var index = _.findIndex(Library.data[type], {artist: artist.artist});
                if (index !== -1){
                  logger.debug("found artist into index: " + index, Library.data[type][index]);
                  Library.data[type][index].albums = _.union(Library.data[type][index].albums, artist.albums);
                  logger.debug("added album into index: " + index, Library.data[type][index]);

                } else {
                  Library.data[type].push(artist);
                }
                //Library.data[type] = _.extend(Library.data[type][artist.artist], artist);
            });
            logger.debug("add scanned entries into library: ", groupByArtistsAndAlbum);
            logger.debug("lib: ", Library.data[type]);

        } else {
          Library.data[type] = _.union(Library.data[type], lib);
        }
        if (type === "audio" && libObject.isFinishedAll){
          logger.warn("audio scanned");
          this.audioScanned = true;
        } else if(libObject.isFinishedAll) {
          logger.warn("video scanned");
          this.videoScanned = true;
        }
        callback();
    };

    function getBigImage (imageList) {
      var imageSource;
      imageList.forEach(function (img) {
          if (img.size === "large") {
              imageSource = img["#text"];
          }
      });
      return imageSource;
    }

    Library.scanning = function () {
        logger.info("scan: ", this.scanProgress);
        return this.scanProgress !== undefined ? this.scanProgress : false;
    };

    Library.scan = function (callback) {
        var that = this;
        this.scanProgress = true;
        this.videoScanned = false;
        this.audioScanned = false;
        // Clear all datas.
        this.data  = {audio: [], video: []};
        this.loadingCoverAlbums = [];
        this.loadingCoverArtists = [];

        // Rescan full library.
        Library.flatten = null;
        this.beginScan(function () {

            if (that.videoScanned && that.audioScanned){
              that.scanProgress = false;
              callback();
            }
        });
    };

    Library.getRelativePath = function (uuid) {
        uuid = uuid.replace(".mp3", "");
        uuid = uuid.replace(".ogg", "");
        uuid = uuid.replace(".wav", "");

        logger.debug("getRelativePath: " + uuid);
        var libElement = this.getByUid(uuid);
        return libElement.relativePath;
    };

    Library.getAudio = function () {
        return this.data.audio;
    };

    Library.getAudio = function (page, lenght) {
        return _.first(_.rest(this.data.audio, page * lenght), lenght);
    };

    Library.getVideo = function () {
        return this.data.video;
    };

    Library.getVideo = function (page, lenght) {
      logger.info(_.first(_.rest(this.data.video, page * lenght), lenght));
      return _.first(_.rest(this.data.video, page * lenght), lenght);
    };

    Library.getByUid = function (uuid) {
        uuid = uuid.replace(".mp3", "");
        uuid = uuid.replace(".ogg", "");
        uuid = uuid.replace(".wav", "");

        return _.find(this.flatten, {uid: uuid});
    };

    Library.search = function (filter, type, fromList) {
      if (!fromList){
        fromList = this.flatten;
      }

      var searchResultList =  _.filter(fromList, function (obj) {
        if (type === "video" && obj.type === type) {
            return obj.name.toLowerCase().match(filter.toLowerCase());
        } else if (type === "audio" && obj.type === type) {
          var output = obj.title.toLowerCase().match(filter.toLowerCase()) || obj.album.toLowerCase().match(filter.toLowerCase());
          if (!output) {
            _.each(obj.metadatas, function (val, key) {
              if (val.toLowerCase().match(filter.toLowerCase())) {
                output = true;
              }
            });
          }
          return output;
        }

        return false;
      });

      var arrayResults = [];

      if (type === "audio"){
        searchResultList = _.groupByMulti(searchResultList, ['artist', 'album']);
        arrayResults = _.map(searchResultList, function(val, artist){
          var artistObject = {
            artist: artist,
            image: Library.loadingCoverArtists[artist],
            albums: _.map(val, function(album, title){
              var albumObject = {
                title: title,
                cover: Library.loadingCoverAlbums[artist][title],
                tracks: _.map(album, function(tracks, index){
                  return tracks;
                })
              };
              logger.debug(albumObject);
              return albumObject;
            })
          };

          return artistObject;
        });
      } else {
        arrayResults = searchResultList;
      }

      logger.debug(arrayResults);

      return arrayResults;
    };

    Library.getAudioById = function (ids, page, length){
      var searchResultList =  _.filter(this.flatten, function (obj) {
        return _.contains(ids, obj.uid);
      });

      searchResultList = _.groupByMulti(searchResultList, ['artist', 'album']);

      var arrayResults = [];
      arrayResults = _.map(searchResultList, function(val, artist){
        var artistObject = {
          artist: artist,
          image: Library.loadingCoverArtists[artist],
          albums: _.map(val, function(album, title){
            var albumObject = {
              title: title,
              cover: Library.loadingCoverAlbums[artist][title],
              tracks: _.map(album, function(tracks, index){
                return tracks;
              })
            };
            logger.debug(albumObject);
            return albumObject;
          })
        };

        return artistObject;
      });
      if (page){
        return _.first(_.rest(arrayResults, page * length), length);
      }
      return arrayResults;
    };

    Library.getAudioFlattenById = function (ids){
      var searchResultList =  _.filter(this.flatten, function (obj) {
        return _.contains(ids, obj.uid);
      });
      return searchResultList;
    };
}(exports));
