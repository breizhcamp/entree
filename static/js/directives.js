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

/** qrcode scan */
entrance.directive('qrcode', function() {
	return {
		restrict: 'E',
		replace: true,
		scope: {
			model: '=',
			active: '=',
			found: '&',
			width: '@',
			height: '@'
		},
		template: '<div class="media"><video id="qr-video" autoplay width="{{ width }}" height="{{ height }}"></video><canvas id="qr-canvas" width="{{ width }}" height="{{ height }}" style="display: none;"></canvas></div>',
		link: function(scope, element, attrs) {
			var refresh = 100;
			var webkit, moz;
			var n = navigator;

			var v = document.getElementById("qr-video");
			var gCtx = document.getElementById("qr-canvas").getContext("2d");
			gCtx.clearRect(0, 0, 800, 600);

			//webcam activation
			if (n.getUserMedia) {
				n.getUserMedia({video: true, audio: false}, success, error);
			} else if (n.webkitGetUserMedia) {
				webkit=true;
				n.webkitGetUserMedia({video: true, audio: false}, success, error);
			} else if(n.mozGetUserMedia) {
				moz=true;
				n.mozGetUserMedia({video: true, audio: false}, success, error);
			}

			//called when user accept camera
			function success(stream) {
				if(webkit) {
					v.src = window.webkitURL.createObjectURL(stream);
				} else if(moz) {
					v.mozSrcObject = stream;
					v.play();
				} else {
					v.src = stream;
				}

				captureVideo();
			}

			function error() {
				alert("Can't access to webcam");
			}

			//called every "refresh"
			function captureVideo() {
				try {
					if (scope.active) {
						gCtx.drawImage(v, 0, 0);
						qrcode.decode();
					}
				} catch (e) {
				} finally {
					setTimeout(captureVideo, refresh);
				}
			}

			//called when qrcode is found
			qrcode.callback = function(res) {
				scope.model = res;
				scope.$apply();
				if (scope.found) {
					scope.$apply(scope.found);
				}
			};

		}
	};
});

