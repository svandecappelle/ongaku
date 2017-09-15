const nconf = require("nconf");
const primaryDBName = nconf.get('database');
const model = require(`./database/${primaryDBName}/security`);

class SecurityModel extends model {

    constructor () {
        super();
    }
}

module.exports = new SecurityModel();