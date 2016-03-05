var entrance = angular.module('entrance', ['ioService', 'directives', 'personService']);

entrance.controller('screen2', function($scope, $timeout, $location, SocketIO) {

	var dif = !!$location.search()['dif'];

	SocketIO.connect();

	SocketIO.on('init', function(list) {
		$scope.list = list;

		//add some data to persons
		var now = moment();
		for (var i = 0 ; i < $scope.list.length ; i++) {
			var person = $scope.list[i];

			for (var j = 0 ; j < person.days.length ; j++) {
				if (moment(person.days[j]).isSame(now, 'day')) {
					person.dateOk = true;
					break;
				}
			}
		}

	});

	SocketIO.on('checkin', function(person) {
		if (dif && !person.dif) return; //don't add non dif person if we filter for dif

		//remove if id already exist
		for (var i = 0 ; i < $scope.list.length ; i++) {
			if ($scope.list[i].id == person.id) {
				$scope.list.splice(i, 1);
				break;
			}
		}

		//add person on top and remove last if > 7
		var length = $scope.list.unshift(person);
		if (length > 7) $scope.list.pop();
	});

	SocketIO.on('reconnect', function() {
		SocketIO.emit('init', { dif: dif });
	});

	SocketIO.emit('init', { dif: dif });
});