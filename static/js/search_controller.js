var entrance = angular.module('entrance', ['personService', 'directives']);

entrance.controller('search', function($scope, $timeout, $http, PersonService) {

	var currentTimeSearch;
	$scope.qrcode = {
		active: true
	};

	/**
	 * Called when a key is pressed into the search field
	 * @param event Key pressed event containing (charCode / keyCode)
	 */
	$scope.keypress = function(event) {
		if (!event.charCode || event.charCode < 32) {
			return;
		}

		$scope.searchTime();
	};

	$scope.keydown = function(event) {
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
				$timeout(clearSearch);
				break;
		}
	};

	$scope.foundQR = function() {
		$scope.qrcode.active = false;
		$scope.s = $scope.qrcode.res;
		$scope.search($scope.s);
	};

	/** Delay called to search in order to let binding to $scope.s to be over */
	$scope.searchTime = function() {
		if (currentTimeSearch) {
			$timeout.cancel(currentTimeSearch);
		}
		currentTimeSearch = $timeout(function() {
			$scope.search($scope.s);
			currentTimeSearch = null;
		}, 150);
	};

	/**
	 * Run the search into elasticsearch and populate the scope
	 * @param input Text to search
	 */
	$scope.search = function(input) {
		$scope.selectSearch = false;

		$http.post('s', {s: input}).success(function(data) {
			resetResults();
			if (data.length === 1) {
				showPerson(data[0]);

				if (data[0].barcode === input) {
					$scope.selectSearch = true;
				}

			} else {
				//list of results
				$scope.list = data;
				$scope.active = 1;
			}
		})
	};

	/** Send current person to second screen */
	$scope.sendToSecondScreen = function() {
		$http.post('checkin', {person: $scope.person}).success(function(data) {
			resetResults();
		});
	};

	/** Clear search form and reset results */
	var clearSearch = function() {
		$scope.s = "";
		resetResults();
	};

	/** Clear scope from previous result */
	var resetResults = function() {
		$scope.toSecondScreen = false;
		delete $scope.person;
		delete $scope.list;
		delete $scope.active;
		$scope.qrcode.active = true;
	};

	/**
	 * Set a single person into the scope
	 * @param person Person to set
	 */
	var showPerson = function(person) {
		$scope.toSecondScreen = true;
		$scope.person = PersonService.enhance(person);
	}
});