const nconf = require("nconf");
const primaryDBName = nconf.get('database');
const model = require(`./database/${primaryDBName}/user`);

class UserModel extends model {

    constructor () {
        super();
    }
}

module.exports = new UserModel();