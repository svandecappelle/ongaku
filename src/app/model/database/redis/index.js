const redis = require("./lib");
class RedisClient {

    constructor () {

    }

    get () {
        return redis;
    }
}

module.exports = new RedisClient().get();