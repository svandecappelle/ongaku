const nconf = require('nconf');
const path = require('path');
const semver = require('semver');
const models = require('../model/database/postgresql');

class Version {

  current() {
    return require(path.resolve(__dirname, '../../../package')).version;
  }

  installed() {
    return new Promise((resolve, reject) => {
      models["application"].findAll().then(properties => {
        var pricing = {};
        for (var variable of properties) {
          pricing[variable.get('property')] = variable.get('value');
        }
        resolve(pricing.version);
      }).catch((error) => {
        // console.error(error);
        console.log('not installed application');
        resolve(null);
      });
    });
  }

  check() {
    return new Promise( (resolve, reject) => {
      this.installed().then( (version) => {
        if (!version){
          return resolve({
            installed: false
          });
        }
        resolve({
          installed: version,
          launched: this.current(),
          needUpgrade: semver.gt(this.current(), version),
          versionIsLower: semver.gt(version, this.current())
        });
      }).catch((err) => {
        reject(err);
      })
    });
  }
}

module.exports = new Version();
