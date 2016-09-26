(function (Chat) {
	var users = {};
	var checking = {};
	var statuses = {};
	var CHECK_TIME = 1000 * 60;
	var moment = require('moment'),
		_ = require("underscore"),
		logger = require("log4js").getLogger("Chat"),
		socketio = require('socket.io');

	Chat.load = function (served){
		this.io = socketio(served);
		this.start();
	}

	Chat.on = function(event, callback){
		this.io.on(event, callback);
	};

	Chat.emit = function(event, params){
		this.io.emit(event, params);
	};

	Chat.checkin = function(incoming, socket){
		var that = this;
		/* Check chat connection every minutes */
		if (checking[incoming.user]){
			checking[incoming.user] = false;
		}
		setTimeout(function () {
			that.check(incoming.user);
		}, CHECK_TIME);

		//console.log(incoming);
		//console.log("Connection to chat: " + incoming);
		users[incoming.user] = socket;
		var oldStatus = statuses[incoming.user];

		if (incoming.status){
			statuses[incoming.user] = incoming.status;
		} else if (statuses[incoming.user] === undefined){
			statuses[incoming.user] = "online";
		} else {
			statuses[incoming.user] = "online";
		}

		if (oldStatus !== statuses[incoming.user]){
			this.io.sockets.emit('statuschange', statuses);
		}
	}

	Chat.statuschange = function(incoming, socket){
		socket.reconnectionDelay /= 1;
		statuses[incoming.user] = incoming.status;
		this.io.sockets.emit('statuschange', statuses);
	}

	Chat.message = function (data) {
		try {
			if (data.to !== undefined && data.to !== "all" && data.to !== "administrators"){
				var socketid = users[data.to];
				data.date = moment().format("YYYY-MM-DD HH:mm:ss");
				//console.log("send to " + socketid);
				if (socketid !== undefined) {
					datato = _.clone(data);
					datato.format = '{"color":"green"}';
					var recipicentFromTo = {
						from: data.from,
						to: data.from
					};

					datato.from = recipicentFromTo.from;
					datato.to = recipicentFromTo.to;
					users[data.from].emit('new', data);
					socketid.emit('msg', datato);
				} else {
					users[data.from].emit('msg', data);
					users[data.from].emit('msg', {
						from: data.to,
						to: data.from,
						message: 'User is not connected',
						date: moment().format("YYYY-MM-DD HH:mm:ss"),
						format: '{"color":"grey"}'
					});
				}

			} else if (data.to === "all") {
				this.io.sockets.emit('msg', data);
			} else if (data.to === "administrators") {
				//io.sockets.emit('new', data);
			} else {
				this.io.sockets.emit('msg', data);
			}
		} catch(err) {
			logger.error(err);
		}
	}

	Chat.onConnect = function (socket) {
		socket.emit('authenticate');
		logger.warn("socket need authenticate: " + socket);
		//console.log(users);

		socket.on('checkin', function(incoming){
			Chat.checkin(incoming, socket)
		});
		socket.on('statuschange', function(incoming){
			 Chat.statuschange(incoming, socket)
		});
		socket.on('msg', function(incoming){
			Chat.message(incoming, socket);
		});
	}

	Chat.start = function(){
		this.io.sockets.on('connection', Chat.onConnect);
	};

	Chat.status = function (user) {
		var status = statuses[user];
		return status ? status : "offline";
	};

	Chat.check = function (user) {
		if (users[user]){
			var oldstatus = statuses[user];

			checking[user] = true;
			users[user].emit('checkin', {
				user: user,
				status: oldstatus
			});

			setTimeout(function(){
				if (checking[user]){
					statuses[user] = "offline";
				}
			}, 1000 * 30);
		}
	};

	Chat.authenticatedUsers = function(){
		logger.warn(_.clone(statuses));
		return _.pairs(_.clone(statuses));
	};

	Chat.disconnect = function(user){
		users[user.username] = undefined;
		statuses[user.username] = 'offline';
		this.io.sockets.emit('statuschange', statuses);
	};
}(exports));
