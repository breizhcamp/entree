/**
 * Permet d'injecter le CSV dans ElasticSearch
 */
var DESK_NUMBER = 4;

var csv = require("fast-csv"),
	elasticsearch = require('elasticsearch');

var bulk = [];

var client = new elasticsearch.Client({
	host: 'localhost:9200'
});

//check index exists
client.indices.exists({	index: 'participants' }).then(function(data) {
	if (data) {
		return client.indices.delete({ index: 'participants' });
	}

}).then(function() {
	return client.indices.create({
		index: 'participants',
		body: {
			settings: {
				number_of_shards: 3,
				number_of_replicas : 1
			}
		}
	});

}).then(function(data) {
	if (data && !data.acknowledged) throw "Can't create index";

	//check type existance
	return client.indices.existsType({
		index: 'participants',
		type: 'participant'
	});

}).then(function(data) {
	if (data) return;

	//create type mapping
	return client.indices.putMapping({
		index: 'participants',
		type: 'participant',
		body: {
			participant: {
				properties: {
					id: {type: 'keyword'},
					nom: { type: 'text', analyzer: 'french' },
					prenom: { type: 'text', analyzer: 'french' },
					societe: { type: 'text', analyzer: 'french' },
					desk: { type: 'keyword' },
					checkin: { type: 'date' }
				}
			}
		}
	});

}).then(function() {
	console.log("ES INIT OK, let's inject documents");
	injectCSV();
});

function injectCSV() {

	csv.fromPath("inscrits.csv", { headers: true, delimiter: ',', trim: true })
		.transform(function(data) {

			if (data['Catégorie'] === "Journée" || data['Payé'] === "0" || data["noBadge"] === "1") {
				return; //not parsing ticket for days in pass
			}

			var participant = {
				id: data['id'],
				barcode: data['Codes-barres'],
				nom: data['lastname'],
				prenom: data['firstname'],
				mail: data['email'],
				type: data['ticketType']
				//mailmd5
				//societe if filled
				//days
			};
			//participant.mailmd5 = crypto.createHash('md5').update(participant.mail).digest("hex");
			if (data['company']) {
				participant.societe = data['company'];
			}

			//injecting days the participant has access
			var days;
			switch (participant.type) {
				case 'Exposant':
				case 'Staff':
				case 'Combo Sponsors (3 jours)':
				case 'Combo (3 jours)':
				case 'Speaker':
					days = ['2019-03-20', '2019-03-21', '2019-03-22'];
					break;
				case 'Conférences (jeudi et vendredi)':
					days = ['2019-03-21', '2019-03-22'];
					break;

				case 'Mercredi':
					days = ['2019-03-20'];
					break;
				case 'Jeudi':
					days = ['2019-03-21'];
					break;
				case 'Vendredi':
					days = ['2019-03-22'];
					break;

			}
			if (!days) {
				console.log("Cannot retrieve days for " + participant.nom + " " + participant.prenom
					+ " (" + participant.barcode + ") : " + participant.type);
			}
			participant.days = days;

			//shorten tickets type label
			var type = participant.type;
			switch (participant.type) {
				case 'Combo Sponsors (3 jours)': type = 'Combo Sponsors'; break;
				case 'Combo (3 jours)': type = 'Combo'; break;
				case 'Conférences (jeudi et vendredi)': type = 'Conférences'; break;
			}
			participant.type = type;

			if (type === 'Speaker') participant.speaker = true;

			return participant;
		})
		.on("data", function(data) {
			if (!data) return;

			bulk.push({ index: { _index: 'participants', _type: 'participant', _id: data.id }});
			bulk.push(data);

			if (bulk.length > 120) {
				console.log("Indexing to id " + data.id);
				var that = this;
				//pause during ES indexing
				that.pause();

				//indexing bulk
				indexBulk(function() { that.resume(); });
			}
		})
		.on("end", function() {
			indexBulk(function() {
				client.indices.refresh({ index: 'participants' }).then(function() {
					//count nb participants after refresh
					return client.count({ index: 'participants' });

				}).then(function(data) {
					console.log("Injection OVER, Nb participants: " + data.count);
					client.close();
				});
			});
		});
}


function indexBulk(callback) {
	if (bulk.length === 0) {
		callback();
		return;
	}

	client.bulk({
		body: bulk
	}, function(err, resp) {
		bulk = [];
		callback(err, resp);
	});
}
