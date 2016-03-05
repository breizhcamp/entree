angular.module('personService', [])
.factory('PersonService', [
	function () {
		return {
			enhance: function(person) {
				//compute desk letter
				var desk;
				if (person.id >= 400) desk = 'E';
				else if (person.id >= 300) desk = 'D';
				else if (person.id >= 200) desk = 'C';
				else if (person.id >= 100) desk = 'B';
				else if (person.id >= 0) desk = 'A';
				else desk = 'Z';

				person.desk = desk;

				//compute day ok
				var now = moment();
				for (var i = 0 ; i < person.days.length ; i++) {
					if (moment(person.days[i]).isSame(now, 'day')) {
						person.dateOk = true;
						break;
					}
				}

				return person;
			}
		}
	}
]);