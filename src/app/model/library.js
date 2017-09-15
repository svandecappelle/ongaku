const nconf = require("nconf");
const primaryDBName = nconf.get('database');
const model = require(`./database/${primaryDBName}/library`);

class LibraryModel {

  get (username, callback) {
    model.get(username, callback);
  };

  append (username, uid, callback) {
    model.append(username, uid, callback);
  };

  remove (username, uid, callback) {
    model.remove(username, uid, callback);
  };

  getSharedFolders (callback) {
    model.getSharedFolders(callback);
  };

}

module.exports = new LibraryModel();