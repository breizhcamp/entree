/**
 * Permet d'injecter le CSV dans ElasticSearch
 */
var csv = require("fast-csv"),
	elasticsearch = require('elasticsearch'),
	crypto = require('crypto');

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
					nom: { type: 'string', analyzer: 'french' },
					prenom: { type: 'string', analyzer: 'french' },
					societe: { type: 'string', analyzer: 'french' }
				}
			}
		}
	});

}).then(function() {
	console.log("ES INIT OK, let's inject documents");
	injectCSV();
});

function injectCSV() {

	csv.fromPath("inscrits.csv", { headers: true, delimiter: ';', trim: true })
		.transform(function(data) {

			var participant = {
				id: data['Identifiant'],
				barcode: data['Code-barres'],
				nom: data['Nom participant'],
				prenom: data['Prénom participant'],
				mail: data['E-mail Participant'],
				type: data['Tarif']
				//mailmd5
				//societe if filled
				//days
			};
			participant.mailmd5 = crypto.createHash('md5').update(participant.mail).digest("hex");
			if (data['Societe Participant']) {
				participant.societe = data['Societe Participant'];
			}

			//injecting days the participant has access
			var days;
			switch (participant.type) {
				case 'exposant':
				case 'bénévoles':
				case 'sponsor':
				case 'last minute':
				case 'Combo 3 jours':
				case 'Speaker':
				case 'Organisateur':
				case 'Fanboy (3 jours)':
					days = ['2017-04-19', '2017-04-20', '2017-04-21'];
					break;
				case 'Université (mercredi)':
					days = ['2017-04-19'];
					break;
				case 'Conférence (jeudi+vendredi)':
					days = ['2017-04-20', '2017-04-21'];
					break;
			}
			if (!days) {
				console.log("Cannot retrieve days for " + participant.nom + " " + participant.prenom + " (" + participant.barcode + ")");
			}
			participant.days = days;

			//shorten tickets type label
			var type = participant.type;
			switch (participant.type) {
				case 'exposant': type = 'Exposant'; break;
				case 'bénévoles': type = 'Bénévole'; break;
				case 'sponsor': type = 'Sponsor'; break;
				case 'last minute': type = 'Combo'; break;
				case 'Combo 3 jours': type = 'Combo'; break;
				//case 'Speaker': type = 'Speaker'; break;
				case 'Organisateur': type = 'Orga'; break;
				case 'Fanboy (3 jours)': type = 'Combo Fan'; break;
				case 'Université (mercredi)': type = 'Université'; break;
				case 'Conférence (jeudi+vendredi)': type = 'Conférence'; break;
			}
			participant.type = type;

			if (type == 'Speaker') participant.speaker = true;

			return participant;
		})
		.on("data", function(data) {
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
	if (bulk.length == 0) {
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
