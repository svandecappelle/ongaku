(function (Library) {
    "use strict";

    var Latinise={};Latinise.latin_map={"Á":"A","Ă":"A","Ắ":"A","Ặ":"A","Ằ":"A","Ẳ":"A","Ẵ":"A","Ǎ":"A","Â":"A","Ấ":"A","Ậ":"A","Ầ":"A","Ẩ":"A","Ẫ":"A","Ä":"A","Ǟ":"A","Ȧ":"A","Ǡ":"A","Ạ":"A","Ȁ":"A","À":"A","Ả":"A","Ȃ":"A","Ā":"A","Ą":"A","Å":"A","Ǻ":"A","Ḁ":"A","Ⱥ":"A","Ã":"A","Ꜳ":"AA","Æ":"AE","Ǽ":"AE","Ǣ":"AE","Ꜵ":"AO","Ꜷ":"AU","Ꜹ":"AV","Ꜻ":"AV","Ꜽ":"AY","Ḃ":"B","Ḅ":"B","Ɓ":"B","Ḇ":"B","Ƀ":"B","Ƃ":"B","Ć":"C","Č":"C","Ç":"C","Ḉ":"C","Ĉ":"C","Ċ":"C","Ƈ":"C","Ȼ":"C","Ď":"D","Ḑ":"D","Ḓ":"D","Ḋ":"D","Ḍ":"D","Ɗ":"D","Ḏ":"D","ǲ":"D","ǅ":"D","Đ":"D","Ƌ":"D","Ǳ":"DZ","Ǆ":"DZ","É":"E","Ĕ":"E","Ě":"E","Ȩ":"E","Ḝ":"E","Ê":"E","Ế":"E","Ệ":"E","Ề":"E","Ể":"E","Ễ":"E","Ḙ":"E","Ë":"E","Ė":"E","Ẹ":"E","Ȅ":"E","È":"E","Ẻ":"E","Ȇ":"E","Ē":"E","Ḗ":"E","Ḕ":"E","Ę":"E","Ɇ":"E","Ẽ":"E","Ḛ":"E","Ꝫ":"ET","Ḟ":"F","Ƒ":"F","Ǵ":"G","Ğ":"G","Ǧ":"G","Ģ":"G","Ĝ":"G","Ġ":"G","Ɠ":"G","Ḡ":"G","Ǥ":"G","Ḫ":"H","Ȟ":"H","Ḩ":"H","Ĥ":"H","Ⱨ":"H","Ḧ":"H","Ḣ":"H","Ḥ":"H","Ħ":"H","Í":"I","Ĭ":"I","Ǐ":"I","Î":"I","Ï":"I","Ḯ":"I","İ":"I","Ị":"I","Ȉ":"I","Ì":"I","Ỉ":"I","Ȋ":"I","Ī":"I","Į":"I","Ɨ":"I","Ĩ":"I","Ḭ":"I","Ꝺ":"D","Ꝼ":"F","Ᵹ":"G","Ꞃ":"R","Ꞅ":"S","Ꞇ":"T","Ꝭ":"IS","Ĵ":"J","Ɉ":"J","Ḱ":"K","Ǩ":"K","Ķ":"K","Ⱪ":"K","Ꝃ":"K","Ḳ":"K","Ƙ":"K","Ḵ":"K","Ꝁ":"K","Ꝅ":"K","Ĺ":"L","Ƚ":"L","Ľ":"L","Ļ":"L","Ḽ":"L","Ḷ":"L","Ḹ":"L","Ⱡ":"L","Ꝉ":"L","Ḻ":"L","Ŀ":"L","Ɫ":"L","ǈ":"L","Ł":"L","Ǉ":"LJ","Ḿ":"M","Ṁ":"M","Ṃ":"M","Ɱ":"M","Ń":"N","Ň":"N","Ņ":"N","Ṋ":"N","Ṅ":"N","Ṇ":"N","Ǹ":"N","Ɲ":"N","Ṉ":"N","Ƞ":"N","ǋ":"N","Ñ":"N","Ǌ":"NJ","Ó":"O","Ŏ":"O","Ǒ":"O","Ô":"O","Ố":"O","Ộ":"O","Ồ":"O","Ổ":"O","Ỗ":"O","Ö":"O","Ȫ":"O","Ȯ":"O","Ȱ":"O","Ọ":"O","Ő":"O","Ȍ":"O","Ò":"O","Ỏ":"O","Ơ":"O","Ớ":"O","Ợ":"O","Ờ":"O","Ở":"O","Ỡ":"O","Ȏ":"O","Ꝋ":"O","Ꝍ":"O","Ō":"O","Ṓ":"O","Ṑ":"O","Ɵ":"O","Ǫ":"O","Ǭ":"O","Ø":"O","Ǿ":"O","Õ":"O","Ṍ":"O","Ṏ":"O","Ȭ":"O","Ƣ":"OI","Ꝏ":"OO","Ɛ":"E","Ɔ":"O","Ȣ":"OU","Ṕ":"P","Ṗ":"P","Ꝓ":"P","Ƥ":"P","Ꝕ":"P","Ᵽ":"P","Ꝑ":"P","Ꝙ":"Q","Ꝗ":"Q","Ŕ":"R","Ř":"R","Ŗ":"R","Ṙ":"R","Ṛ":"R","Ṝ":"R","Ȑ":"R","Ȓ":"R","Ṟ":"R","Ɍ":"R","Ɽ":"R","Ꜿ":"C","Ǝ":"E","Ś":"S","Ṥ":"S","Š":"S","Ṧ":"S","Ş":"S","Ŝ":"S","Ș":"S","Ṡ":"S","Ṣ":"S","Ṩ":"S","Ť":"T","Ţ":"T","Ṱ":"T","Ț":"T","Ⱦ":"T","Ṫ":"T","Ṭ":"T","Ƭ":"T","Ṯ":"T","Ʈ":"T","Ŧ":"T","Ɐ":"A","Ꞁ":"L","Ɯ":"M","Ʌ":"V","Ꜩ":"TZ","Ú":"U","Ŭ":"U","Ǔ":"U","Û":"U","Ṷ":"U","Ü":"U","Ǘ":"U","Ǚ":"U","Ǜ":"U","Ǖ":"U","Ṳ":"U","Ụ":"U","Ű":"U","Ȕ":"U","Ù":"U","Ủ":"U","Ư":"U","Ứ":"U","Ự":"U","Ừ":"U","Ử":"U","Ữ":"U","Ȗ":"U","Ū":"U","Ṻ":"U","Ų":"U","Ů":"U","Ũ":"U","Ṹ":"U","Ṵ":"U","Ꝟ":"V","Ṿ":"V","Ʋ":"V","Ṽ":"V","Ꝡ":"VY","Ẃ":"W","Ŵ":"W","Ẅ":"W","Ẇ":"W","Ẉ":"W","Ẁ":"W","Ⱳ":"W","Ẍ":"X","Ẋ":"X","Ý":"Y","Ŷ":"Y","Ÿ":"Y","Ẏ":"Y","Ỵ":"Y","Ỳ":"Y","Ƴ":"Y","Ỷ":"Y","Ỿ":"Y","Ȳ":"Y","Ɏ":"Y","Ỹ":"Y","Ź":"Z","Ž":"Z","Ẑ":"Z","Ⱬ":"Z","Ż":"Z","Ẓ":"Z","Ȥ":"Z","Ẕ":"Z","Ƶ":"Z","Ĳ":"IJ","Œ":"OE","ᴀ":"A","ᴁ":"AE","ʙ":"B","ᴃ":"B","ᴄ":"C","ᴅ":"D","ᴇ":"E","ꜰ":"F","ɢ":"G","ʛ":"G","ʜ":"H","ɪ":"I","ʁ":"R","ᴊ":"J","ᴋ":"K","ʟ":"L","ᴌ":"L","ᴍ":"M","ɴ":"N","ᴏ":"O","ɶ":"OE","ᴐ":"O","ᴕ":"OU","ᴘ":"P","ʀ":"R","ᴎ":"N","ᴙ":"R","ꜱ":"S","ᴛ":"T","ⱻ":"E","ᴚ":"R","ᴜ":"U","ᴠ":"V","ᴡ":"W","ʏ":"Y","ᴢ":"Z","á":"a","ă":"a","ắ":"a","ặ":"a","ằ":"a","ẳ":"a","ẵ":"a","ǎ":"a","â":"a","ấ":"a","ậ":"a","ầ":"a","ẩ":"a","ẫ":"a","ä":"a","ǟ":"a","ȧ":"a","ǡ":"a","ạ":"a","ȁ":"a","à":"a","ả":"a","ȃ":"a","ā":"a","ą":"a","ᶏ":"a","ẚ":"a","å":"a","ǻ":"a","ḁ":"a","ⱥ":"a","ã":"a","ꜳ":"aa","æ":"ae","ǽ":"ae","ǣ":"ae","ꜵ":"ao","ꜷ":"au","ꜹ":"av","ꜻ":"av","ꜽ":"ay","ḃ":"b","ḅ":"b","ɓ":"b","ḇ":"b","ᵬ":"b","ᶀ":"b","ƀ":"b","ƃ":"b","ɵ":"o","ć":"c","č":"c","ç":"c","ḉ":"c","ĉ":"c","ɕ":"c","ċ":"c","ƈ":"c","ȼ":"c","ď":"d","ḑ":"d","ḓ":"d","ȡ":"d","ḋ":"d","ḍ":"d","ɗ":"d","ᶑ":"d","ḏ":"d","ᵭ":"d","ᶁ":"d","đ":"d","ɖ":"d","ƌ":"d","ı":"i","ȷ":"j","ɟ":"j","ʄ":"j","ǳ":"dz","ǆ":"dz","é":"e","ĕ":"e","ě":"e","ȩ":"e","ḝ":"e","ê":"e","ế":"e","ệ":"e","ề":"e","ể":"e","ễ":"e","ḙ":"e","ë":"e","ė":"e","ẹ":"e","ȅ":"e","è":"e","ẻ":"e","ȇ":"e","ē":"e","ḗ":"e","ḕ":"e","ⱸ":"e","ę":"e","ᶒ":"e","ɇ":"e","ẽ":"e","ḛ":"e","ꝫ":"et","ḟ":"f","ƒ":"f","ᵮ":"f","ᶂ":"f","ǵ":"g","ğ":"g","ǧ":"g","ģ":"g","ĝ":"g","ġ":"g","ɠ":"g","ḡ":"g","ᶃ":"g","ǥ":"g","ḫ":"h","ȟ":"h","ḩ":"h","ĥ":"h","ⱨ":"h","ḧ":"h","ḣ":"h","ḥ":"h","ɦ":"h","ẖ":"h","ħ":"h","ƕ":"hv","í":"i","ĭ":"i","ǐ":"i","î":"i","ï":"i","ḯ":"i","ị":"i","ȉ":"i","ì":"i","ỉ":"i","ȋ":"i","ī":"i","į":"i","ᶖ":"i","ɨ":"i","ĩ":"i","ḭ":"i","ꝺ":"d","ꝼ":"f","ᵹ":"g","ꞃ":"r","ꞅ":"s","ꞇ":"t","ꝭ":"is","ǰ":"j","ĵ":"j","ʝ":"j","ɉ":"j","ḱ":"k","ǩ":"k","ķ":"k","ⱪ":"k","ꝃ":"k","ḳ":"k","ƙ":"k","ḵ":"k","ᶄ":"k","ꝁ":"k","ꝅ":"k","ĺ":"l","ƚ":"l","ɬ":"l","ľ":"l","ļ":"l","ḽ":"l","ȴ":"l","ḷ":"l","ḹ":"l","ⱡ":"l","ꝉ":"l","ḻ":"l","ŀ":"l","ɫ":"l","ᶅ":"l","ɭ":"l","ł":"l","ǉ":"lj","ſ":"s","ẜ":"s","ẛ":"s","ẝ":"s","ḿ":"m","ṁ":"m","ṃ":"m","ɱ":"m","ᵯ":"m","ᶆ":"m","ń":"n","ň":"n","ņ":"n","ṋ":"n","ȵ":"n","ṅ":"n","ṇ":"n","ǹ":"n","ɲ":"n","ṉ":"n","ƞ":"n","ᵰ":"n","ᶇ":"n","ɳ":"n","ñ":"n","ǌ":"nj","ó":"o","ŏ":"o","ǒ":"o","ô":"o","ố":"o","ộ":"o","ồ":"o","ổ":"o","ỗ":"o","ö":"o","ȫ":"o","ȯ":"o","ȱ":"o","ọ":"o","ő":"o","ȍ":"o","ò":"o","ỏ":"o","ơ":"o","ớ":"o","ợ":"o","ờ":"o","ở":"o","ỡ":"o","ȏ":"o","ꝋ":"o","ꝍ":"o","ⱺ":"o","ō":"o","ṓ":"o","ṑ":"o","ǫ":"o","ǭ":"o","ø":"o","ǿ":"o","õ":"o","ṍ":"o","ṏ":"o","ȭ":"o","ƣ":"oi","ꝏ":"oo","ɛ":"e","ᶓ":"e","ɔ":"o","ᶗ":"o","ȣ":"ou","ṕ":"p","ṗ":"p","ꝓ":"p","ƥ":"p","ᵱ":"p","ᶈ":"p","ꝕ":"p","ᵽ":"p","ꝑ":"p","ꝙ":"q","ʠ":"q","ɋ":"q","ꝗ":"q","ŕ":"r","ř":"r","ŗ":"r","ṙ":"r","ṛ":"r","ṝ":"r","ȑ":"r","ɾ":"r","ᵳ":"r","ȓ":"r","ṟ":"r","ɼ":"r","ᵲ":"r","ᶉ":"r","ɍ":"r","ɽ":"r","ↄ":"c","ꜿ":"c","ɘ":"e","ɿ":"r","ś":"s","ṥ":"s","š":"s","ṧ":"s","ş":"s","ŝ":"s","ș":"s","ṡ":"s","ṣ":"s","ṩ":"s","ʂ":"s","ᵴ":"s","ᶊ":"s","ȿ":"s","ɡ":"g","ᴑ":"o","ᴓ":"o","ᴝ":"u","ť":"t","ţ":"t","ṱ":"t","ț":"t","ȶ":"t","ẗ":"t","ⱦ":"t","ṫ":"t","ṭ":"t","ƭ":"t","ṯ":"t","ᵵ":"t","ƫ":"t","ʈ":"t","ŧ":"t","ᵺ":"th","ɐ":"a","ᴂ":"ae","ǝ":"e","ᵷ":"g","ɥ":"h","ʮ":"h","ʯ":"h","ᴉ":"i","ʞ":"k","ꞁ":"l","ɯ":"m","ɰ":"m","ᴔ":"oe","ɹ":"r","ɻ":"r","ɺ":"r","ⱹ":"r","ʇ":"t","ʌ":"v","ʍ":"w","ʎ":"y","ꜩ":"tz","ú":"u","ŭ":"u","ǔ":"u","û":"u","ṷ":"u","ü":"u","ǘ":"u","ǚ":"u","ǜ":"u","ǖ":"u","ṳ":"u","ụ":"u","ű":"u","ȕ":"u","ù":"u","ủ":"u","ư":"u","ứ":"u","ự":"u","ừ":"u","ử":"u","ữ":"u","ȗ":"u","ū":"u","ṻ":"u","ų":"u","ᶙ":"u","ů":"u","ũ":"u","ṹ":"u","ṵ":"u","ᵫ":"ue","ꝸ":"um","ⱴ":"v","ꝟ":"v","ṿ":"v","ʋ":"v","ᶌ":"v","ⱱ":"v","ṽ":"v","ꝡ":"vy","ẃ":"w","ŵ":"w","ẅ":"w","ẇ":"w","ẉ":"w","ẁ":"w","ⱳ":"w","ẘ":"w","ẍ":"x","ẋ":"x","ᶍ":"x","ý":"y","ŷ":"y","ÿ":"y","ẏ":"y","ỵ":"y","ỳ":"y","ƴ":"y","ỷ":"y","ỿ":"y","ȳ":"y","ẙ":"y","ɏ":"y","ỹ":"y","ź":"z","ž":"z","ẑ":"z","ʑ":"z","ⱬ":"z","ż":"z","ẓ":"z","ȥ":"z","ẕ":"z","ᵶ":"z","ᶎ":"z","ʐ":"z","ƶ":"z","ɀ":"z","ﬀ":"ff","ﬃ":"ffi","ﬄ":"ffl","ﬁ":"fi","ﬂ":"fl","ĳ":"ij","œ":"oe","ﬆ":"st","ₐ":"a","ₑ":"e","ᵢ":"i","ⱼ":"j","ₒ":"o","ᵣ":"r","ᵤ":"u","ᵥ":"v","ₓ":"x"};
    String.prototype.latinise=function(){return this.replace(/[^A-Za-z0-9\[\] ]/g,function(a){return Latinise.latin_map[a]||a})};
    String.prototype.latinize=String.prototype.latinise;
    String.prototype.isLatin=function(){return this==this.latinise()}

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
      //obj = _.sortBy(obj, values[0], context);
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
            });
            logger.debug("add scanned entries into library: ", groupByArtistsAndAlbum);
            logger.debug("lib: ", Library.data[type]);

        } else {
          Library.data[type] = _.union(Library.data[type], lib);
        }

        if (type === "audio" && libObject.isFinishedAll){
          logger.info("audio scanned");
          //Library.data["audio"] = _.sortBy(Library.data["audio"], DEFAULT_SORT);
          this.audioScanned = true;
        } else if(libObject.isFinishedAll) {
          logger.info("video scanned");
          this.videoScanned = true;
        }
        callback();
    };

    function getBigImage (imageList) {
      var imageSource;
      imageList.forEach(function (img) {
          if (img.size === "mega"){
            imageSource = img["#text"];
          } else if (img.size === "extralarge"){
            imageSource = img["#text"];
          }else if (img.size === "large") {
            imageSource = img["#text"];
          }
      });
      return imageSource;
    }

    Library.scanning = function () {
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
        var libElement = this.getByUid(uuid);
        return libElement.relativePath;
    };

    Library.getAudio = function (groupby, sortby) {
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
    };

    Library.getAudio = function (page, lenght, groupby, sortby) {
      var audios = this.data.audio;
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

    Library.getVideo = function () {
        return this.data.video;
    };

    Library.getVideo = function (page, lenght) {
      return _.first(_.rest(this.data.video, page * lenght), lenght);
    };

    Library.getByUid = function (uuid) {
        uuid = uuid.replace(".mp3", "");
        uuid = uuid.replace(".ogg", "");
        uuid = uuid.replace(".wav", "");

        return _.find(this.flatten, {uid: uuid});
    };

    Library.getAlbumArtImage = function (uuid) {
        uuid = uuid.replace(".mp3", "");
        uuid = uuid.replace(".ogg", "");
        uuid = uuid.replace(".wav", "");

        return Library.loadingCoverAlbums[_.find(this.flatten, {uid: uuid}).artist][_.find(this.flatten, {uid: uuid}).album];
    };

    Library.search = function (opts, fromList) {
      var filter = opts.filter, 
        type = opts.type, 
        groupby = opts.groupby,
        sortby = opts.sortby;
      var searchResultList;

      if (filter.indexOf("~") === 0){
        var filters = filter.substring(1, filter.length).split(" ");
        logger.debug("Search into any of these values: ", filters);
        _.each(filters, function(subFilter){
          if (searchResultList){
            searchResultList = Library.search({
              filter: subFilter, 
              type: type, 
              groupby: undefined
            }, searchResultList);
          } else {
            searchResultList = Library.search({
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
      }

      searchResultList =  _.filter(fromList, function (obj) {
        var filterClause = ".*".concat(filter.latinize().toLowerCase().trim().replace(/ /g, ".*")).concat(".*"),
          found = false;
        if (type === "video" && obj.type === type) {
          found = obj.name.toLowerCase().match(filterClause);
        } else if (type === "audio" && obj.type === type) {
          found = obj.title.toString().latinize().toLowerCase().match(filterClause);
          found = found ? found : obj.album.toString().latinize().toLowerCase().match(filterClause);
          found = found ? found : obj.artist.toString().latinize().toLowerCase().match(filterClause);

          if (!found) {
            _.each(obj.metadatas, function (val, key) {
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

      var arrayResults = [];

      if (type === "audio" && groupby){
        arrayResults = this.groupby(searchResultList, groupby, sortby);
      } else {
        arrayResults = searchResultList;
      }

      logger.debug(arrayResults);

      return arrayResults;
    };

    Library.groupby = function(searchResultList, groupbyClause, sortby){
      groupbyClause = groupbyClause ? groupbyClause : ['artist', 'album'];

      searchResultList = _.sortBy( searchResultList, sortby);

      var groupedResultList = _.groupByMulti(searchResultList, groupbyClause);
      
      var output = _.map(groupedResultList, function(val, groupObject) {
        var rootGroupObject = {};
        if (groupbyClause[0] === "artist"){
          rootGroupObject.image = Library.loadingCoverArtists[groupObject];
        } else if (groupbyClause[0] === "album" && Library.loadingCoverAlbums[val[0].artist]){
          rootGroupObject.cover = Library.loadingCoverAlbums[val[0].artist][groupObject];
        }

        if (groupbyClause.length > 1){
          rootGroupObject[groupbyClause[0]] = groupObject;

          var filteredTracks = _.map(val, function(album, title){
            var albumObject = {
              title: title,
              tracks: _.map(album, function(tracks, index){
                return tracks;
              })
            };

            if (groupbyClause[1] === "album" && Library.loadingCoverAlbums[groupObject]){
              albumObject.cover = Library.loadingCoverAlbums[groupObject][albumObject.title];
              if (!albumObject.cover){
                albumObject.cover = '/img/album.jpg';
              }
            } else if (groupbyClause[1] === "artist"){
              albumObject.image = Library.loadingCoverArtists[albumObject.title];
            }

            return albumObject;
          });

          if (groupbyClause[1] === "album"){
            rootGroupObject.albums = filteredTracks;
          } else {
            rootGroupObject[groupbyClause[1]] = filteredTracks;
          }

        } else {
          rootGroupObject[groupbyClause[0]] = groupObject;
          rootGroupObject.tracks = val;
        }

        return rootGroupObject;
      });

      return output;
    };

    Library.searchPage = function (opts) {
      var that = this;
      return _.first(_.rest(that.search(opts), opts.page * opts.lenght), opts.lenght);
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
              cover: Library.loadingCoverAlbums[artist][title] ? Library.loadingCoverAlbums[artist][title] : "/img/album.jpg",
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

    Library.getAlbums = function (artist){
      return this.getAlbum(artist);
    };

    Library.getAlbum = function (artist, album){
      var arrayResults;
      if (artist === "all"){
        arrayResults = this.groupby(this.flatten, ["album"]);
        arrayResults = _.where(arrayResults, {album: album});
        var albumsObject = [];
        _.each(arrayResults, function(album){
          albumsObject.push({
            artist: "",
            albums: arrayResults,
          });
        });
        logger.info(albumsObject);
        return albumsObject;
      } else {
        arrayResults = this.groupby(this.flatten);
        arrayResults = _.where(arrayResults, {artist: artist});
        var albumSearched;
        _.each(arrayResults[0].albums, function(albumObj, index){
          if(albumObj.title === album){
            albumSearched = albumObj;
          }
        });
        arrayResults.albums = albumSearched;
      }
      logger.warn(arrayResults);
      return arrayResults;
    };

    Library.getFile = function (uid){
      return this.getRelativePath(uid);
    };

    Library.getAudioFlattenById = function (ids){
      var searchResultList =  _.filter(this.flatten, function (obj) {
        return _.contains(ids, obj.uid);
      });
      return searchResultList;
    };
}(exports));
