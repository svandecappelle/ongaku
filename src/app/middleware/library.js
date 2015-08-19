(function (Library) {
    "use strict";

    var scan = require("./scanner"),
        _ = require("underscore"),
        logger = require("log4js").getLogger('Library'),
        nconf = require("nconf");

    Library.data  = {audio: [], video: []};
    Library.flatten = {};
    Library.scanProgress = false;

    Library.beginScan = function (callback) {
        var that = this;
        scan.library(function (lib) {
            that.populate("audio", lib.audio, function () {
                that.populate("video", lib.video, callback);
            });
        });
    };

    Library.populate = function (type, lib, callback) {
        var LastfmAPI = require('lastfmapi');
        var lfm = new LastfmAPI({
            'api_key' : 'f21088bf9097b49ad4e7f487abab981e',
            'secret' : '7ccaec2093e33cded282ec7bc81c6fca'
        });

        Library.flatten = _.union(Library.flatten, _.map(_.groupBy(lib, 'uid'), function(track, uuid){
            return _.extend(track[0], {uuid: uuid, type: type});
        }));

        if (type === "audio") {

            var grpByArtists = _.groupBy(lib, 'artist'),
                groupByArtistsAndAlbum = [];

            _.each(grpByArtists, function (tracks, artist) {
                var albums = _.map(_.groupBy(tracks, 'album'), function (tracks, title) {
                    if (!title) {
                        title = "Unknown album";
                    }
                    return {title: title, tracks: tracks};
                });


                _.each(albums, function (album, index) {
                    logger.debug("search " + artist + " ------ " + album.title);
                    if (album !== "Unknown album") {

                        lfm.album.getInfo({
                            'artist' : artist,
                            'album' : album.title
                        }, function (err, alb) {
                            if (err) {
                                logger.warn("album not found");
                            } else if (alb.image) {
                                logger.info(alb.image);
                                alb.image.forEach(function (img) {
                                    if (img.size === "large") {
                                        album.cover = img["#text"];
                                    }
                                });
                            }
                        });
                    }
                });

                var artist = {
                    artist: artist,
                    albums: albums
                };

                /* Load some artist info. */
                logger.warn("search artist: " + artist.artist);
                lfm.artist.getInfo({
                    'artist' : artist.artist,
                }, function (err, art) {
                    if (err) {
                        logger.warn("artist not found");
                    } else if (art.image) {
                        logger.info(art.image);
                        art.image.forEach(function (img) {
                            if (img.size === "large") {
                                artist.image = img["#text"];
                                logger.debug(artist.image);
                            }
                        });
                    }
                });

                groupByArtistsAndAlbum.push(artist);
            });
            Library.data[type] = groupByArtistsAndAlbum;
        } else {
            logger.info(_.map(_.groupBy(lib, 'uid'), function (track, uuid) {
                return {uuid: uuid, track: track, type: type};
            }));
            Library.data[type] = lib;
        }
        callback();
    };

    Library.scanning = function () {
        return this.scanProgress !== undefined ? this.scanProgress : false;
    };

    Library.scan = function (callback) {
        var that = this;
        this.scanProgress = true;
        this.beginScan(function () {
            that.scanProgress = false;
            callback();
        });
    };

    Library.getRelativePath = function (uuid) {
        return this.getByUid(uuid).relativePath;
    };

    Library.getAudio = function () {
        return this.data.audio;
    };

    Library.getVideo = function () {
        return this.data.video;
    };

    Library.getByUid = function (uuid) {
        logger.debug("get by uid: " + _.find(this.flatten, {uid: uuid}));
        return _.find(this.flatten, {uid: uuid});
    };

    Library.search = function (filter, type) {
        return _.filter(this.flatten, function (obj) {

            if (type === "video" && obj.type === type) {
                return obj.name.match(filter);
            } else if (type === "audio" && obj.type === type) {
                var output = obj.title.match(filter) || obj.album.match(filter);
                if (!output) {
                    _.each(obj.metadatas, function (val, key) {
                        if (val.match(filter)) {
                            output = true;
                        }
                    });
                }

                if (output) {
                    logger.debug("Search matches for: ", obj);
                }

                return output;
            }

            return false;
        });
    };

}(exports));