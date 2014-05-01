/**
 * Socket IO wrapper for Angular
 */
angular.module('ioService', [])
.factory('SocketIO', ['$rootScope', '$timeout',
	function($rootScope, $timeout) {
		var socket;

		/**
		 * Listen to a specific event on the socket
		 * @param evtName Event to listen
		 * @param callback Callback when the event is shown
		 */
		function on(evtName, callback) {
			socket.on(evtName, function() {
				var args = arguments;
				$timeout(function () {
					callback.apply(socket, args);
				}, 0);
			});
		}

		/**
		 * Emit an event on the socket
		 * @param evtName Name of the event to send
		 * @param data Data to send with the event
		 * @param callback Callback when the event has been sent
		 */
		function emit(evtName, data, callback) {
			socket.emit(evtName, data, function () {
				var args = arguments;
				$rootScope.$apply(function () {
					if (callback) {
						callback.apply(socket, args);
					}
				});
			});
		}

		/**
		 * Connect the socket to the server
		 */
		function connect() {
			if (socket) {
				socket.socket.reconnect();
			} else {
				socket = io.connect();
			}
		}

		/**
		 * Disconnect the socket from the server
		 */
		function disconnect() {
			if (socket) {
				socket.disconnect();
			}
		}

		return {
			on: on,
			emit: emit,
			connect: connect,
			disconnect: disconnect
		}
	}
]);