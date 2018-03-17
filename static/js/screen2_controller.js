var entrance = angular.module('entrance', ['ioService', 'directives', 'personService', 'angularMoment']);

entrance.run(function (amMoment) {
	amMoment.changeLocale('fr');
});

entrance.controller('screen2', function($scope, $interval, $http, SocketIO, PersonService) {

	$scope.desks = createDesks(['A', 'B', 'C', 'D']);
	$scope.list = [];

	$scope.$watch('desks', function(desks) {
		var activeDesks = [];
		for (var i = 0; i < desks.length; i++) {
			var d = desks[i];
			if (d.active) activeDesks.push(d.name);
		}
		$scope.activeDesks = activeDesks;
		$scope.colWidth = Math.floor(100 / activeDesks.length);
	}, true);

	$interval(enhancePersonList, 10000);

	SocketIO.connect();

	SocketIO.on('init', function(list) {
		$scope.list = list;

		//add some data to persons
		enhancePersonList();
	});

	SocketIO.on('checkin', function(person) {
		//remove if id already exist
		removePersonFromList(person.id);

		//add person on top and remove last if > 25
		PersonService.enhance(person);
		var length = $scope.list.unshift(person);
		if (length > 25) $scope.list.pop();
	});

	SocketIO.on('reconnect', function() {
		SocketIO.emit('init');
	});

	SocketIO.emit('init');

	$scope.badge = function(person) {
		removePersonFromList(person.id);
		$http.post('badge', { person: person });
	};

	function createDesks(desksName) {
		var desks = [];
		for (var i = 0; i < desksName.length; i++) {
			var name = desksName[i];
			desks.push({ name: name, active: true });
		}
		return desks;
	}

	function enhancePersonList() {
		for (var i = 0; i < $scope.list.length; i++) {
			$scope.list[i] = PersonService.enhance($scope.list[i]);
		}
	}

	function removePersonFromList(id) {
		for (var i = 0; i < $scope.list.length; i++) {
			if ($scope.list[i].id === id) {
				$scope.list.splice(i, 1);
				break;
			}
		}
	}
});