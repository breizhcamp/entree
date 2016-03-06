var entrance = angular.module('entrance', ['ioService', 'directives', 'personService']);

entrance.controller('screen2', function($scope, $timeout, $location, SocketIO, PersonService) {

	$scope.desks = createDesks(['A', 'B', 'C', 'D', 'E']);

	$scope.$watch('desks', function(desks) {
		var activeDesks = [];
		for (var i = 0; i < desks.length; i++) {
			var d = desks[i];
			if (d.active) activeDesks.push(d.name);
		}
		$scope.activeDesks = activeDesks;
		$scope.colWidth = Math.floor(100 / activeDesks.length);
	}, true);

	SocketIO.connect();

	SocketIO.on('init', function(list) {
		$scope.list = list;

		//add some data to persons
		for (var i = 0 ; i < $scope.list.length ; i++) {
			$scope.list[i] = PersonService.enhance($scope.list[i]);
		}

	});

	SocketIO.on('checkin', function(person) {
		//remove if id already exist
		for (var i = 0 ; i < $scope.list.length ; i++) {
			if ($scope.list[i].id == person.id) {
				$scope.list.splice(i, 1);
				break;
			}
		}

		//add person on top and remove last if > 25
		var length = $scope.list.unshift(person);
		if (length > 25) $scope.list.pop();
	});

	SocketIO.on('reconnect', function() {
		SocketIO.emit('init');
	});

	SocketIO.emit('init');

	function createDesks(desksName) {
		var desks = [];
		for (var i = 0; i < desksName.length; i++) {
			var name = desksName[i];
			desks.push({ name: name, active: true });
		}
		return desks;
	}
});