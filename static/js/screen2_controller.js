var entrance = angular.module('entrance', ['ioService']);

entrance.controller('screen2', function($scope, $timeout, SocketIO) {

	SocketIO.connect();

	SocketIO.on('init', function(list) {
		$scope.list = list;

		//add some data to persons
		var now = moment();
		for (var i = 0 ; i < $scope.list.length ; i++) {
			var person = $scope.list[i];
			if (person.type == 'Speaker') {
				person.speaker = true;
			}
			for (var j = 0 ; j < person.days.length ; j++) {
				if (moment(person.days[j]).isSame(now, 'day')) {
					person.dateOk = true;
					break;
				}
			}
		}

		console.log($scope.list);
	});

	SocketIO.on('checkin', function(person) {
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

});