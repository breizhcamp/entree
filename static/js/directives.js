/** Select text on input field when enter is pressed */
entrance.directive('selectOnEnter', function () {
	return {
		restrict: 'A',
		link: function (scope, element, attrs) {
			element.on('keypress', function (event) {
				if (event.keyCode == 13 || event.keyCode == 38 || event.keyCode == 40) {
					this.select();
				}
			});
		}
	};
});

/** Display gravatar icon */
entrance.directive('gravatar', function() {
	return {
		restrict: 'AE',
		replace: true,
		scope: {
			name: '@',
			size: '@',
			emailHash: '@'
		},
		template: '<img alt="{{ name }}" src="https://secure.gravatar.com/avatar/{{ emailHash }}.jpg?s={{ size }}&d=blank">'
	};
});