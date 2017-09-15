const nconf = require("nconf");
const primaryDBName = nconf.get('database');
const model = require(`./database/${primaryDBName}/groups`);

class GroupsModel extends model {

    constructor () {
        super();
    }
}

module.exports = new GroupsModel();