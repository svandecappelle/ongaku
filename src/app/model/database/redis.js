'use strict';

(function (module) {

    var nconf = require('nconf'),
        path = require('path'),
        express = require('express'),
        utils = require('./../../../../public/lib/utils.js'),
        logger = require('log4js').getLogger('Database:redis'),
        redis,
        ConnectRedis,
        reds,
        redisClient,
        postSearch,
        topicSearch;

    module.questions = [{
        name: 'redis:host',
        description: 'Host IP or address of your Redis instance',
        'default': nconf.get('redis:host') || '127.0.0.1'
    }, {
        name: 'redis:port',
        description: 'Host port of your Redis instance',
        'default': nconf.get('redis:port') || 6379
    }, {
        name: 'redis:password',
        description: 'Password of your Redis database',
        hidden: true
    }, {
        name: "redis:database",
        description: "Which database to use (0..n)",
        'default': nconf.get('redis:database') || 0
    }];

    module.init = function (callback) {
        try {
            var session = require('express-session')
            redis = require('redis');
            //connectRedis = require('connect-redis')(express);
            ConnectRedis = require('connect-redis')(session);
            reds = require('reds');
        } catch (err) {
            logger.error('Unable to initialize Redis! Is Redis installed? Error :' + err.message);
            process.exit();
        }

        var redis_socket_or_host = nconf.get('redis:host');

        if (redis_socket_or_host && redis_socket_or_host.indexOf('/')>=0) {
            /* If redis.host contains a path name character, use the unix dom sock connection. ie, /tmp/redis.sock */
            redisClient = redis.createClient(nconf.get('redis:host'));
        } else {
            /* Else, connect over tcp/ip */
            redisClient = redis.createClient(nconf.get('redis:port'), nconf.get('redis:host'));
        }

        if (nconf.get('redis:password')) {
            redisClient.auth(nconf.get('redis:password'));
        } else {
            logger.warn('You have no redis password setup!');
        }

        redisClient.on('error', function (err) {
            logger.error(err.stack);
        });

        module.client = redisClient;

        module.sessionStore = new ConnectRedis({
            client: redisClient,
            ttl: 60 * 60 * 24 * 14
        });

        reds.createClient = function () {
            return reds.client || (reds.client = redisClient);
        };

        //module.postSearch = reds.createSearch('nodebbpostsearch');
        //module.topicSearch = reds.createSearch('nodebbtopicsearch');

        var db = parseInt(nconf.get('redis:database'), 10);

        if (db) {
            redisClient.select(db, function(error) {
                if (error) {
                    logger.error("NodeBB could not connect to your Redis database. Redis returned the following error: " + error.message);
                    process.exit();
                }
            });
        }

        require('./main')(redisClient, module);
        require('./hash')(redisClient, module);
        require('./sets')(redisClient, module);
        require('./sorted')(redisClient, module);
        require('./list')(redisClient, module);

        if (typeof callback === 'function') {
            callback();
        }
    };

    module.close = function () {
        redisClient.quit();
    };

    module.helpers = module.helpers || {};
    module.helpers.redis = require('./helpers');
}(exports));
