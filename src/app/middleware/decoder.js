const fs = require("fs");
const logger = require("log4js").getLogger("Decoder");
const async = require("async");
const _ = require("underscore");
const path = require("path");
const nconf = require("nconf");
const uuid = require('uuid');
const crypto = require('crypto');
const ffmetadata = require("ffmetadata");
const mm = require('musicmetadata');

class Decoder {

  constructor (type) {
    this.type = type;
  }

  decode(filePath) {
    if (this.type === 'audio') {
      return this.audio(filePath);
    } else {
      return this.video(filePath);
    }
  }

  song(file, metadatas, duration) {
    var WMATags = ['DeviceConformanceTemplate', 'IsVBR', 'DeviceConformanceTemplate', 'PeakValue', 'AverageLevel'];

    metadatas = _.omit(metadatas, (value, key) => {
      return key.indexOf("WM") === 0;
    });

    metadatas = _.omit(metadatas, ['picture', 'encoder', 'metadatas']);
    metadatas = _.omit(metadatas, WMATags);

    var durationMin = Math.floor(duration / 60),
      durationSec = Math.floor(duration % 60),
      uuid,
      shasum = crypto.createHash('sha1');
    shasum.update(file);
    if (durationSec < 10) {
      durationSec = "0".concat(durationSec);
    }

    var originalEncoding = path.extname(file.replace(nconf.get("library"), "")).replace(".", "");
    if (!_.contains(["mp3", "ogg"], originalEncoding)) {
      originalEncoding = "mp3";
    }

    if (metadatas.genre && metadatas.genre.length === 0) {
      metadatas.genre = ["Unknown"];
    }

    var artist = metadatas.artist ? metadatas.artist : metadatas.ARTIST ? metadatas.ARTIST : metadatas.artistalbum ? metadatas.artistalbum : "Unknown artist";
    if (Array.isArray(artist) && artist.length === 1) {
      artist = artist[0];
    }

    if (metadatas.ALBUM) {
      metadatas.album = metadatas.ALBUM;
    }

    if (metadatas.TITLE) {
      metadatas.title = metadatas.TITLE;
    }

    if (metadatas.disk && metadatas.disk.of > 1) {
      metadatas.album_origin = metadatas.album;
      metadatas.album = `${metadatas.album} Disk - ${metadatas.disk.no}/${metadatas.disk.of}`;
    }

    metadatas = _.orderKeysBy(metadatas);

    return {
      artist: artist,
      file: file,
      relativePath: typeof nconf.get("library") === 'String' ? file.replace(nconf.get("library"), "") : file,
      title: metadatas.title ? metadatas.title : path.basename(file.replace(nconf.get("library"), "")),
      album: metadatas.album ? metadatas.album : "Uknown album",
      metadatas: metadatas,
      duration: durationMin.toString().concat(":").concat(durationSec),
      uid: shasum.digest('hex'),
      encoding: originalEncoding,
      genre: metadatas.genre && metadatas.genre.join ? metadatas.genre.join(",") : "-"
    };
  };

  video(filePath) {
    var uuid,
      shasum = crypto.createHash('sha1');

    return new Promise((resolve, reject) => {
      if (_.contains(nconf.get('video'), path.extname(filePath).replace(".", ""))) {
        shasum.update(filePath);
        uuid = shasum.digest('hex');
        resolve({
          encoding: path.extname(filePath).replace(".", ""),
          uid: uuid.concat(".").concat(path.extname(filePath).replace(".", "")),  /*uuid.v1().concat(".").concat(path.extname(filePath).replace(".", "")),*/
          file: "/video/stream".concat(filePath.replace(nconf.get("library"), "")),
          type: "video",
          name: path.basename(filePath),
          extension: path.extname(filePath).replace(".", ""),
          relativePath: typeof nconf.get("library") === 'String' ? filePath.replace(nconf.get("library"), "") : filePath,
        });
      } else {
        reject({ "cause": 'not an video file to listen' }); // asynchronously call the loop
      }
    });
  };

  check(filePath) {
    return _.contains(nconf.get(this.type), path.extname(filePath).replace(".", ""));
  }

  audio(filePath) {
    return new Promise((resolve, reject) => {
      if (_.contains(nconf.get('audio'), path.extname(filePath).replace(".", ""))) {
        logger.debug("Loading using mm: ", filePath);
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

              resolve(this.song(filePath, metadataFFMPEG, metadata.duration));
            });
          });

        } catch (error) {
          reject(error);
        }
      } else {
        logger.error(`metadata-check: ${filePath} `)
        reject({ "cause": `Not an audio file to listen: ${filePath}` }); // asynchronously call the loop
      }
    });
  }
}

module.exports = {class: Decoder};