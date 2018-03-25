angular.module('personService', [])
.factory('PersonService', [
	function () {
		return {
			enhance: function(person) {
				//compute desk letter
				person.desk = String.fromCharCode(65 + Math.floor(person.id / 250)); //65 = A - 250 = nb persons per desk

				//compute day ok
				var now = moment();
				for (var i = 0 ; i < person.days.length ; i++) {
					if (moment(person.days[i]).isSame(now, 'day')) {
						person.dateOk = true;
						break;
					}
				}

				if (person.checkin) {
					var sec = now.diff(moment(person.checkin), 'seconds');
					if (sec < 60) {
						person.age = "young";
					} else if (sec < 60 * 5) {
						person.age = "normal";
					} else {
						person.age = "old";
					}
				}

				return person;
			}
		}
	}
]);