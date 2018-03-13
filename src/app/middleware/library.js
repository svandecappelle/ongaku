const  scan = require("./scanner");
const _ = require("underscore");
const logger = require("log4js").getLogger('Library');
const nconf = require("nconf");
const path = require("path");
const fs = require("fs");
const async = require("async");
const library = require("../model/library");
const ffmetadata = require("ffmetadata");
const mm = require('musicmetadata');

var Decoder = require('./decoder').class;

var LastfmAPI = require('lastfmapi');
var lfm = new LastfmAPI({
  'api_key' : 'f21088bf9097b49ad4e7f487abab981e',
  'secret' : '7ccaec2093e33cded282ec7bc81c6fca'
});

function parseLastFm (imageList) {
  var imageSource;
  var sizes = ['small', 'medium', 'large', 'extralarge', 'mega'];
  var images = null;
  
  if (imageList){
    images = _.map(_.sortBy(imageList, (image) => {
      return sizes.indexOf(image.size);
    }), (image) => {
      return image['#text'] ? image['#text'] : null;
    });
  }
  images = _.compact(images);
  return images;
}

_.mixin({groupByMulti: (obj, values, context) => {
  if (!values.length)
    return obj;
  //obj = _.sortBy(obj, values[0], context);
  var byFirst = _.groupBy(obj, values[0], context),
    rest = values.slice(1);
  for (var prop in byFirst) {
    byFirst[prop] = _.groupByMulti(byFirst[prop], rest, context);
  }
  return byFirst;
}});


class Library{
  
  constructor() {
    this.data  = {audio: [], video: []};
    this.flatten = {};
  
    this.audioScanned = false;
    this.videoScanned = false;
    this.scanProgress = false;
  
    this.loadingCoverAlbums = [];
    this.loadingCoverArtists = [];
  }

  /**
   * Scan the library
   * 
   */
  beginScan () {
    return new Promise((resolve, reject) => {
      scan.library().then((lib) => {
        if (Array.isArray(lib)) {
          _.each(lib, (libFolder) => {
            if (libFolder.audio) {
              this.populate("audio", libFolder);
            }
            if (libFolder.video){
              this.populate("video", libFolder);
            }
          });
        } else {
          if (lib.audio) {
            this.populate("audio", lib);
          }
          if (lib.video){
            this.populate("video", lib);
          }
        }
        resolve(lib);
      }, (error) => {
        logger.error(`Error scanning library: `, error);
        reject(error);
      });
    });
  };

  /**
   * Add a folder to scan
   * 
   * @param {String} folder path 
   * @param {function} callback 
   */
  addFolder (folder, callback){
    var that = this;

    scan.addToScan(folder.path);
    this.removeFolder(folder);
    scan.scanFolder(folder.path).then( (folderContent) => {
      folderContent.private = folder.isPrivate

      if (folderContent.audio){
        that.populate("audio", {
          folder: folder,
          content: folderContent
        }, folder);
        
        callback({
          type: 'audio'
        });
      } else if (folderContent.video){
        callback({
          type: 'video'
        });
        // TODO desactivate at now scan video. Should be reactivated
        /*that.populate("video", {
          folder: folder,
          content: folderContent
        }, function (){
          callback({
            type: 'video'
          });
        }, folder);*/
      }
    })
  };

  /**
   * Remove folder from scanned library folders
   * 
   * @param {String} folder remove the folder from scanned library folders
   */
  removeFolder (folder){
    scan.removeToScan(folder.path);
    this.flatten = _.filter(this.flatten, (track) => {
      if (track.username && track.username === folder.username && folder.path === track.userfolder){
        return false;
      }
      return true;
    });
  }

  /**
   * Populate library with scanned elements.
   * 
   * @param {String} type type of media: audio | video
   * @param {Object} folderScanResult object of all scanned results
   * @param {Object} folder folder path and state
   */
  populate (type, folderScanResult, folder) {
    var destination = this.data;
    var flattenDestination = this.flatten;
    var lib;
    var isPrivate = false;

    if (folderScanResult.content){
      lib = folderScanResult.content[type];
      if (folderScanResult.folder.private) {
        isPrivate = true;
      }
    } else {
      lib = folderScanResult[type];
    }

    this.flatten = _.union(this.flatten, _.map(_.groupBy(lib, 'uid'), (track, uuid) => {

      var libraryElement = _.extend(track[0], {
        uuid: uuid,
        type: type,
        private: isPrivate,
        user: folderScanResult.folder ? folderScanResult.folder.username : null
      });

      if (!libraryElement.metadatas) {
        libraryElement.metadatas = {};
      }

      if (folder && folder.username){
        // library is a user private but shared folder.
        _.extend(libraryElement, {username: folder.username});
        libraryElement.metadatas.sharedBy = folder.username;
        libraryElement.userfolder = folder.path;
      }

      return libraryElement;
    }));

    if (type === "audio") {
      var grpByArtists = _.groupBy(lib, 'artist'),
        groupByArtistsAndAlbum = [];

      _.each(grpByArtists, (tracks, artistbean) => {
          var albums = _.map(_.groupBy(tracks, 'album'), (tracks, title) => {
            if (!title) {
              title = "Unknown album";
            }
            return {
              title: title,
              album_origin: tracks[0].metadatas.album_origin,
              tracks: tracks
            };
          });

          var artist = {
            artist: artistbean,
            albums: albums
          };

          if (this.loadingCoverAlbums[artist.artist] === undefined){
            this.loadingCoverAlbums[artist.artist] = {};
          }

          if (this.loadingCoverArtists[artist.artist] === undefined){
            this.getArtistCover(artist);
          } else {
            logger.debug("already scanned artist '" + artist.artist + "': " + this.loadingCoverArtists[artist.artist]);
            artist.image = this.loadingCoverArtists[artist.artist];
          }
          _.each(albums, (album, index) => {
            if (album !== "Unknown album" && this.loadingCoverAlbums[artist.artist][album.title] === undefined) {
                album.cover = null;
                this.getAlbumCover(artist, album);
            } else {
              logger.debug("already scanned album '" + album.title + "': " + this.loadingCoverAlbums[artist.artist][album.title]);
              album.cover = this.loadingCoverAlbums[artist.artist][album.title];
            }
          });
          groupByArtistsAndAlbum.push(artist);
          var index = _.findIndex(this.data[type], {artist: artist.artist});
          if (index !== -1){
            logger.debug("found artist into index: " + index, this.data[type][index]);
            this.data[type][index].albums = _.union(this.data[type][index].albums, artist.albums);
            logger.debug("added album into index: " + index, this.data[type][index]);
          } else {
            this.data[type].push(artist);
          }
      });

      logger.debug("add scanned entries into library: ", groupByArtistsAndAlbum);
      logger.debug("lib: ", this.data[type]);

    } else {
      this.data[type] = _.union(this.data[type], lib);
    }

    if (type === "audio" && (folderScanResult.isFinishedAll || (folderScanResult.content && folderScanResult.content.isFinishedAll)) ) {
      this.audioScanned = true;
    } else if (folderScanResult.isFinishedAll || (folderScanResult.content && folderScanResult.content.isFinishedAll)) {
      this.videoScanned = true;
    }
  };

  /**
   * Retrieve and populate artist photo from lastfm
   * 
   * @param {String} artist artist name
   */
  getArtistCover (artist){
    // logger.info(artist);
    lfm.artist.getInfo({
        'artist' : artist.artist.trim(),
    }, (err, art) => {
      if (err) {
        logger.warn("artist '" + artist.artist + "' not found");
        this.loadingCoverArtists[artist.artist] = null;
      } else if (art.image) {
        artist.image = parseLastFm(art.image);
        this.loadingCoverArtists[artist.artist] = artist.image;
        logger.debug("image artist '" + artist.artist + "': " + artist.image);
      }
    });
  };

  /**
   * Retrieve and populate album cover from lastfm
   * 
   * @param {String} artist artist name 
   * @param {String} album album title
   */
  getAlbumCover (artist, album){
    lfm.album.getInfo({
      'artist' : artist.artist.trim(),
      'album' : album.album_origin ? album.album_origin.trim() : album.title.trim()
    }, (err, alb) => {
      if (err) {
        logger.warn("[" + artist.artist + "] -> album:: '" + album.title + "' not found");
        this.loadingCoverAlbums[artist.artist][album.title] = null;
      } else if (alb.image) {
        album.cover = parseLastFm(alb.image);
        this.loadingCoverAlbums[artist.artist][album.title] = album.cover;
        logger.debug("album cover '" + album.title + "': " + album.cover);
      }
    });
  };

  /**
   * Check if library is scanning a folder.
   */
  scanning () {
      return this.scanProgress !== undefined ? this.scanProgress : false;
  };

  /**
   * Scan the library.
   * 
   * @param {function} callback callback function called when scan is finished 
   */
  scan (callback) {
      var that = this;
      this.scanProgress = true;
      this.videoScanned = false;
      this.audioScanned = false;
      // Clear all datas.
      this.data  = {audio: [], video: []};
      this.loadingCoverAlbums = [];
      this.loadingCoverArtists = [];

      // Rescan full library.
      this.flatten = null;
      this.beginScan().then( () => {
        if (this.videoScanned && this.audioScanned){

          library.getSharedFolders((err, folders) => {
            if (folders){
              var foldersScanning = _.map(folders, (folder) => {
                return { path: folder, scanned: 0 };
              });
              async.each(folders, (folder, next) => {
                var username = folder.split("[")[0];
                var folderObject = {
                  path: path.join( __dirname , `../../../public/user/${username}/imported/${folder.replace(username + "[", "").slice(0, -1)}`),
                  username: folder.split("[")[0]
                };
                logger.info(`adding user shared folder: ${folderObject.path} ---> ${folderObject.username}`);
                this.addFolder(folderObject, (scanResults) => {
                  var scannedFolder = _.where(foldersScanning, {
                    path: folder
                  });
                  scannedFolder.scanned += 1;

                  if (scannedFolder.scanned === 2){
                    // Audio and video are scanned.
                    next();
                  }
                });
              }, () => {
                this.scanProgress = false;
                callback();
              });
            } else {
              that.scanProgress = false;
              callback();
            }
          });
        }
      });
  };

  /**
   * Get relative path of audio file.
   * 
   * @param {String} uuid unique file identifier
   */
  getRelativePath (uuid) {
      uuid = uuid.replace(".mp3", "");
      uuid = uuid.replace(".ogg", "");
      uuid = uuid.replace(".wav", "");
      var libElement = this.getByUid(uuid);
      return libElement.relativePath;
  };

  refreshMetadatas (uuid) {
    uuid = uuid.replace(".mp3", "");
    uuid = uuid.replace(".ogg", "");
    uuid = uuid.replace(".wav", "");
    var filePath = this.getRelativePath(uuid);

    return new Promise((resolve, reject) => {
      
      try {
        // Check if ffmetadata is best than mm
        ffmetadata.read(filePath, (err, metadataFFMPEG) => {
          logger.debug(`libelement: ${filePath}`, err, metadataFFMPEG)
          if (err) {
            logger.error(`libelement: ${filePath}`, err);
            return reject(err);
          }

          var parser = mm(fs.createReadStream(filePath), { duration: true }, (err, metadata) => {
            logger.debug(`libelement: ${filePath}`, err, metadataFFMPEG)
            if (err) {
              logger.error(`libelement: ${filePath}`, err);
              return reject(err);
            }

            var element = new Decoder("audio").song(filePath, metadataFFMPEG, metadata.duration);

            this.set(uuid, element);
            resolve(element);
          });
        });

      } catch (error) {
        reject(error);
      }
    });
    
    return libElement.relativePath;
  }

/*
  getAudio (groupby, sortby) {
    if (groupby){
      return this.search({
        filter: "",
        type: "audio",
        groupby: groupby,
        sortby: sortby
      });
    } else {
      return this.data.audio;
    }
  };*/

  /**
   * Get audio contents using some filters and render properties
   * 
   * @param {*} page page number (starts from 0)
   * @param {*} lenght number of records
   * @param {*} groupby group by criterion
   * @param {*} sortby sort by criterion
   */
  getAudio (page, lenght, groupby, sortby) {
    var audios = this.search({
      filter: "",
      type: "audio"
    });


    if (groupby){
      audios = this.search({
        filter: "",
        type: "audio",
        groupby: groupby,
        sortby: sortby
      });
    }
    audios = _.first(_.rest(audios, page * lenght), lenght);
    return audios;
  };
/*
  getVideo () {
    return this.data.video;
  };
*/
  /**
   * Get video contents.
   * 
   * @param {*} page page number (starts from 0)
   * @param {*} lenght number of records
   */
  getVideo (page, lenght) {
    return _.first(_.rest(this.data.video, page * lenght), lenght);
  };

  /**
   * Get audio file properties using unique identifier.
   * 
   * @param {String} uuid unique file identifier
   */
  getByUid (uuid) {
    uuid = uuid.replace(".mp3", "");
    uuid = uuid.replace(".ogg", "");
    uuid = uuid.replace(".wav", "");

    return _.find(this.flatten, {uid: uuid});
  };

  /**
   * Set audio file properties using unique identifier.
   * 
   * @param {String} uuid unique file identifier
   */
  set (uuid, libElement) {
    uuid = uuid.replace(".mp3", "");
    uuid = uuid.replace(".ogg", "");
    uuid = uuid.replace(".wav", "");
    logger.info("Update: ", _.findIndex(this.flatten, {uid: uuid}));
    return this.flatten[_.findIndex(this.flatten, {uid: uuid})] = libElement;
  };

  /**
   * Get album cover of a track.
   * 
   * @param {String} uuid unique file identifier
   */
  getAlbumArtImage (uuid) {
    uuid = uuid.replace(".mp3", "");
    uuid = uuid.replace(".ogg", "");
    uuid = uuid.replace(".wav", "");

    return this.loadingCoverAlbums[_.find(this.flatten, {uuid: uuid}).artist][_.find(this.flatten, {uuid: uuid}).album];
  };

  /**
   * Search through an array containing the library elements.
   * 
   * @param {Object} opts search options
   * @param {Array} fromList list to filter (Optional)
   */
  search (opts, fromList) {
    var filter = opts.filter,
      type = opts.type,
      groupby = opts.groupby,
      sortby = opts.sortby;
    var searchResultList;

    if (filter.indexOf("~") === 0){
      var filters = filter.substring(1, filter.length).split(" ");
      logger.debug("Search into any of these values: ", filters);
      _.each(filters, (subFilter) => {
        if (searchResultList){
          searchResultList = this.search({
            filter: subFilter,
            type: type,
            groupby: undefined
          }, searchResultList);
        } else {
          searchResultList = this.search({
            filter: subFilter,
            type: type,
            groupby: undefined
          });
        }
      });
      return this.groupby(searchResultList, groupby);
    }

    if (!fromList){
      fromList = this.flatten;
      if (opts.user) {
        fromList = _.union(fromList, this.flattenDestination[opts.user]);
      } else {
        fromList = _.filter(fromList, (track) => {
          return track.private === undefined || !track.private;
        });
      }
    } 
    if (filter) {
      searchResultList =  _.filter(fromList, (obj) => {
        var filterClause = ".*".concat(filter.latinize().toLowerCase().trim().replace(/ /g, ".*")).concat(".*"),
          found = false;
        if (type === "video" && obj.type === type) {
          found = obj.name.toLowerCase().match(filterClause);
        } else if (type === "audio" && obj.type === type) {
          if ( !obj.title ) {
            logger.error("error checking object: ", obj);
          }
          found = obj.title.toString().latinize().toLowerCase().match(filterClause);
          found = found ? found : obj.album.toString().latinize().toLowerCase().match(filterClause);
          found = found ? found : obj.artist.toString().latinize().toLowerCase().match(filterClause);

          if (!found) {
            _.each(obj.metadatas, (val, key) => {
              if (!found){
                if (typeof val === 'String' ){
                  if (val.latinize().toLowerCase().match(filterClause)){
                    found = true;
                  }
                } else if (Array.isArray(val)){
                  for (var value of val){
                    if (value.toString().latinize().toLowerCase().match(filterClause)){
                      found = true
                      break;
                    }
                  }
                } else {
                  if (val === filterClause){
                    found = true
                  }
                }
              }
            });
          }
        }
        return found;
      });
    } else {
      searchResultList = this.flatten;
    }
    var arrayResults = [];

    if (type === "audio" && groupby){
      arrayResults = this.groupby(searchResultList, groupby, sortby);
    } else {
      arrayResults = searchResultList;
    }


    return arrayResults;
  };

  /**
   * Render library using a group by criterion.
   * 
   * @param {Array} searchResultList library list elements.
   * @param {String | Array} groupbyClause group by criterion
   * @param {String} sortby sort by criterion
   */
  groupby (searchResultList, groupbyClause, sortby){
    groupbyClause = groupbyClause ? groupbyClause : ['artist', 'album'];

    searchResultList = _.sortBy( searchResultList, sortby);

    var groupedResultList = _.groupByMulti(searchResultList, groupbyClause);

    var output = _.map(groupedResultList, (val, groupObject) => {
      var rootGroupObject = {};
      if (groupbyClause[0] === "artist"){
        rootGroupObject.image = this.loadingCoverArtists[groupObject];
      } else if (groupbyClause[0] === "album" && this.loadingCoverAlbums[val[0].artist]){
        rootGroupObject.cover = this.loadingCoverAlbums[val[0].artist][groupObject];
      }

      if (groupbyClause.length > 1){
        rootGroupObject[groupbyClause[0]] = groupObject;

        var filteredTracks = _.map(val, (album, title) => {
          var albumObject = {
            title: title,
            tracks: _.map(album, (tracks, index) => {
              return tracks;
            })
          };

          if (groupbyClause[1] === "album" && this.loadingCoverAlbums[groupObject]){
            albumObject.cover = this.loadingCoverAlbums[groupObject][albumObject.title];
            if (!albumObject.cover){
              albumObject.cover = '/img/album.jpg';
            }
          } else if (groupbyClause[1] === "artist"){
            albumObject.image = this.loadingCoverArtists[albumObject.title];
          }

          albumObject.tracks = _.sortBy( albumObject.tracks, (element) => {
            return element.metadatas && element.metadatas.track ? element.metadatas.track.no : 0;
          });

          return albumObject;
        });

        if (groupbyClause[1] === "album"){
          rootGroupObject.albums = filteredTracks;
        } else {
          rootGroupObject[groupbyClause[1]] = filteredTracks;
        }

      } else {
        rootGroupObject[groupbyClause[0]] = groupObject;

        val = _.sortBy( val, (element) => {
          return element.metadatas && element.metadatas.track ? element.metadatas.track.no : 0;
        });
        rootGroupObject.tracks = val;
      }

      return rootGroupObject;
    });

    return output;
  };

  /**
   * Search through pages
   * 
   * @param {Object} opts search options
   */
  searchPage (opts) {
    var that = this;
    return _.first(_.rest(that.search(opts), opts.page * opts.lenght), opts.lenght);
  };

  /**
   * Get user personal library.
   * 
   * @param {Array} ids 
   * @param {Number} page 
   * @param {Number} length 
   * @param {String} username 
   * @param {Object} filter 
   */
  getUserLibrary (ids, page, length, username, filter) {
    var searchResultList =  _.filter(this.flatten, (obj) => {
      return _.contains(ids, obj.uid) || (obj.private && obj.user === username);
    });

    if (filter) {
      searchResultList = this.search({
        filter: filter,
        type: 'audio'
      }, searchResultList);
    }

    searchResultList = _.groupByMulti(searchResultList, ['artist', 'album']);

    var arrayResults = [];
    arrayResults = _.map(searchResultList, (val, artist) => {
      var artistObject = {
        artist: artist,
        image: this.loadingCoverArtists[artist],
        albums: _.map(val, (album, title) => {
          var albumObject = {
            title: title,
            cover: artist && title && this.loadingCoverAlbums[artist] && this.loadingCoverAlbums[artist][title] ? this.loadingCoverAlbums[artist][title] : "/img/album.jpg",
            tracks: _.map(album, (tracks, index) => {
              return tracks;
            })
          };
          return albumObject;
        })
      };

      return artistObject;
    });
    if (page){
      return _.first(_.rest(arrayResults, page * length), length);
    }
    return arrayResults;
  }

  /**
   * Get audio files properties using a list of unique file identifier.
   * 
   * @param {Array} ids 
   * @param {Number} page 
   * @param {Number} length 
   * @param {String} username 
   * @param {Object} filter 
   */
  getAudioById (ids, page, length, username, filter) {
    var searchResultList =  _.filter(this.flatten, (obj) => {
      return _.contains(ids, obj.uid);
    });

    searchResultList = _.groupByMulti(searchResultList, ['artist', 'album']);

    var arrayResults = [];
    arrayResults = _.map(searchResultList, (val, artist) => {
      var artistObject = {
        artist: artist,
        image: this.loadingCoverArtists[artist],
        albums: _.map(val, (album, title) => {
          var albumObject = {
            title: title,
            cover: this.loadingCoverAlbums[artist][title] ? this.loadingCoverAlbums[artist][title] : "/img/album.jpg",
            tracks: _.map(album, (tracks, index) => {
              return tracks;
            })
          };
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

  /**
   * Get all albums of an artist
   * 
   * @param {String} artist artist name
   */
  getAlbums (artist){
    return this.getAlbum(artist);
  };

  /**
   * Get a specific album tracks.
   * 
   * @param {String} artist artist name
   * @param {String} album album title
   */
  getAlbum (artist, album){
    var arrayResults;
    if (artist === "all"){
      arrayResults = this.groupby(this.flatten, ["album"]);
      arrayResults = _.where(arrayResults, {album: album});
      var albumsObject = [];
      _.each(arrayResults, (album) => {
        albumsObject.push({
          artist: "",
          albums: arrayResults,
        });
      });
      return albumsObject;
    } else {
      arrayResults = this.groupby(this.flatten);
      arrayResults = _.where(arrayResults, {artist: artist});
      var albumSearched;
      _.each(arrayResults[0].albums, (albumObj, index) => {
        if(albumObj.title === album){
          albumSearched = albumObj;
        }
      });
      arrayResults.albums = albumSearched;
    }
    return arrayResults;
  };

  /**
   * Get file path.
   * 
   * @param {String} uid unique file identifier 
   */
  getFile (uid){
    return this.getRelativePath(uid);
  };

  /**
   * Get audio files in flatten representation.
   * 
   * @param {Array} ids unique file identifier
   */
  getAudioFlattenById (ids){
    var searchResultList =  _.filter(this.flatten, (obj) => {
      return _.contains(ids, obj.uid);
    });
    return searchResultList;
  };
}

module.exports = new Library();