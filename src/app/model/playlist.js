/*jslint node: true */
'use strict';

const nconf = require("nconf");
const primaryDBName = nconf.get('database');

const model = require(`./database/${primaryDBName}/playlist`);
class PlaylistModel extends model{
    
    constructor () {
        super();
    }
}

module.exports = new PlaylistModel();
