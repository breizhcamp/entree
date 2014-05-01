var entrance = angular.module('entrance', []);

entrance.controller('search', function($scope, $timeout, $http) {

	var currentTimeSearch;

	/**
	 * Called when a key is pressed into the search field
	 * @param event Key pressed event containing (charCode / keyCode)
	 */
	$scope.keypress = function(event) {
		if (event.charCode) {
			$scope.searchTime();
			return;
		}

		//console.log(event);
		switch (event.keyCode) {
			case 13: //enter
				if (!$scope.toSecondScreen) {
					//normal search
					if ($scope.list && $scope.active) {
						$scope.s = $scope.list[$scope.active-1].id;
					}
					$scope.searchTime();
				} else {
					//send current person to second screen
					$scope.sendToSecondScreen();
				}
				break;

			case 8: //backspace
			case 46: //delete
				$scope.searchTime();
				break;

			case 38: //up
				if ($scope.active && $scope.active > 1) {
					$scope.active--;
				} else {
					$scope.active = $scope.list.length;
				}
				break;

			case 40: //bottom
				if ($scope.active && $scope.active < $scope.list.length) {
					$scope.active++;
				} else {
					$scope.active = 1;
				}
				break;

			case 27: //esc
				$scope.s = "";
				$timeout(resetResults);
				break;
		}
	};

	/** Delay called to search in order to let binding to $scope.s to be over */
	$scope.searchTime = function() {
		if (currentTimeSearch) {
			$timeout.cancel(currentTimeSearch);
		}
		currentTimeSearch = $timeout(function() {
			$scope.search($scope.s);
			currentTimeSearch = null;
		}, 50);
	};

	/**
	 * Run the search into elasticsearch and populate the scope
	 * @param input Text to search
	 */
	$scope.search = function(input) {
		$http.post('/s', {s: input}).success(function(data) {
			resetResults();
			if (data.length == 1) {
				showPerson(data[0]);

			} else {
				//list of results
				$scope.list = data;
				$scope.active = 1;
			}
		})
	};

	/** Send current person to second screen */
	$scope.sendToSecondScreen = function() {
		$http.post('/checkin', {person: $scope.person}).success(function(data) {
			resetResults();
		});
	};

	/** Clear scope from previous result */
	var resetResults = function() {
		$scope.toSecondScreen = false;
		delete $scope.person;
		delete $scope.list;
		delete $scope.active;
	};

	/**
	 * Set a single person into the scope
	 * @param person Person to set
	 */
	var showPerson = function(person) {
		$scope.toSecondScreen = true;
		if (person.type == 'Speaker') {
			person.speaker = true;
		}

		//compute day ok
		var now = moment();
		for (var i = 0 ; i < person.days.length ; i++) {
			if (moment(person.days[i]).isSame(now, 'day')) {
				person.dateOk = true;
				break;
			}
		}

		$scope.person = person;
	}
});