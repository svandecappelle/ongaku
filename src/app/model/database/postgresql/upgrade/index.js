const fs = require('fs');
const path = require('path');
const dateFormat = require('dateformat');
const async = require('async');
const semver = require('semver');
const semverSort = require('semver-sort');

const models = require(path.resolve(__dirname, '../../../app/models'));
const version = require(path.resolve(__dirname, '../../../app/utils/version'));

class Upgrader {

  getFiles(version) {
    return fs.readdirSync(path.resolve(__dirname, version))
      .filter(function(file) {
        return file.indexOf(".sql") !== -1;
      })
  }

  getAllVersions () {
    return fs.readdirSync(__dirname, version)
      .filter(function(file) {
        return file.indexOf(".js") === -1;
      })
  }

  upgrade(opts){
    return new Promise((resolve, reject) => {
      var versionStart = opts.from;
      var versionAim = opts.to;
      console.log(`upgrade from version ${opts.from} to ${opts.to}`);
      var versions = this.getAllVersions();

      console.debug('all versions', versions);
      semverSort.asc(versions);

      async.eachSeries(versions, (upgradingVersion, nextVersion) => {
        if (semver.eq(upgradingVersion, versionAim) || (semver.gt(upgradingVersion, versionStart) && semver.lt(upgradingVersion, versionAim))) {
          console.log(`upgrading to version ${upgradingVersion}`);
          var sqlFiles = this.getFiles(upgradingVersion);
          console.debug(`all files for ${upgradingVersion}`, sqlFiles);

          async.eachSeries(sqlFiles,(file, nextFile) => {
            var sqlFileContent = fs.readFileSync(path.resolve(__dirname, `${upgradingVersion}/${file}`), 'utf8');
            console.debug("Executing: ", sqlFileContent);

            models.sequelize.query(sqlFileContent, {
              raw: true
            }).then( () => {
              console.log("** query success ** ");
              nextFile();
            }).catch ( (error) => {
              nextFile({
                msg: `error upgrading to version ${upgradingVersion}`,
                details: error
              });
            });
          }, (error) => {
            if (error) {
              console.error(error);
              return nextVersion(error);
            }

            console.log(`upgraded to version ${upgradingVersion}`, error);
            nextVersion();

          });
        } else {
          nextVersion();
        }
      }, (error) => {
        if (error){
          console.error(error);
          return reject(error);
        }
        console.log('all upgrades done', error);
        this.inserts().then(() => {
          resolve('ok');
        }).catch((error) => {
          console.error(error);
          reject(error);
        });
      });

    });
  }

  inserts () {
    return new Promise((resolve, reject) => {
      async.series({
        startInstall: function (next) {
          models.Pricing.findOne({ where: {property: 'installed_at'} }).then( (record) => {
            record.update({value: dateFormat()}).then(() => {
              next(null, 'ok');
            }).catch( (error) => {
              next(error);
            });
          }).catch( (error) => {
            next(error);
          });
        },
        history: function (next) {
          models.Installations.create({version: version.current()}).then( () => {
            next();
          }).catch( (error) => {
            next(error);
          });
        }
      }, () => {
        models.Pricing.findOne({where: { property: 'version' }}).then( (record) => {
          record.update({value: version.current()}).then( () => {
            console.log('database successfully upgraded');
            resolve(true);
          });
        });
      });
    });




  }
}

module.exports = new Upgrader();
