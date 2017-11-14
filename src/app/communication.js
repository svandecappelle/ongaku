const socketio = require('socket.io');
const logger = require('log4js').getLogger('Communication');

let instance = null;

class Communication {

	constructor () {
		if( !instance ) {
			instance = this;
		}
		return instance;
	}

	listen (server) {
		this.statuses = {};
		this.io = require('socket.io')(server);
		this.open();
	}

	open () {
		this.io.on('connection', (socket) => {
		  logger.info('a user connected');

			socket.on('room:join', (data) => {
				logger.info(`joining room: ${data}`);
				socket.join(data);
			});

			socket.on('status:change', (data) => {
				console.log(`status of ${data.user} changed to ${data.status}`);
				this.statuses[data.user] = data.status;
				this.broadcast('status:change', data);
			});
			socket.emit('notification', {'message': 'ok'});
			socket.on('chat:message', (data) => {
				this.emit(data.to, 'chat:message', data);
			});
		});
	}

	broadcast (event, data) {
		this.io.sockets.emit(event, data);
	}

	emit (room, event, data) {
		logger.info(`emit to room: ${room}`, event, data ? data.message : undefined);
		this.io.to(room).emit(event, data);
	}

	status (username) {
		return this.statuses[username] ? this.statuses[username] : 'offline';
	}

	setStatus (username, status){
		this.statuses[username] = status;
	}
}

module.exports = new Communication();
