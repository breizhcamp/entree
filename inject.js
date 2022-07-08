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

var indexName = 'participants';

//check index exists
client.indices.exists({	index: indexName }).then(function(data) {
	if (data) {
		return client.indices.delete({ index: indexName });
	}

}).then(function() {
	return client.indices.create({
		index: indexName,
		body: {
			settings: {
				number_of_shards: 1,
				number_of_replicas : 0
			},
//             analysis: {
//                 analyzer: {
//                     breizhcamp: { 
//                         type: "custom",
//                         tokenizer: "standard",
//                         filter: [
//                             "lowercase",
//                             "asciifolding"
//                         ]
//                     }
//                 }
//             }
		}
	});

}).then(function(data) {
	if (data && !data.acknowledged) throw "Can't create index";

	//check type existance
	return client.indices.existsType({
		index: indexName,
		type: 'participant'
	});

}).then(function(data) {
	if (data) return;

	//create type mapping
	return client.indices.putMapping({
		index: indexName,
		type: 'participant',
		body: {
			participant: {
				properties: {
					id: {type: 'keyword'},
					nom: { type: 'text'/*, analyzer: 'breizhcamp'*/ },
					prenom: { type: 'text'/*, analyzer: 'breizhcamp'*/ },
					societe: { type: 'text'/*, analyzer: 'breizhcamp'*/ },
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

	csv.fromPath("inscrits-2022.csv", { headers: true, delimiter: ',', trim: true })
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
				case 'Pass 3 jours (Sponsors)':
				case 'Pass 3 jours':
				case 'Orateur':
					days = ['2022-06-29', '2022-06-30', '2022-07-01'];
					break;
				case 'Pass 2 jours':
					days = ['2022-06-29', '2022-06-30'];
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
				case 'Pass 3 jours (Sponsors)': type = '3 jours Sponsors'; break;
				case 'Pass 3 jours': type = '3 jours'; break;
				case 'Pass 2 jours': type = '2 jours'; break;
			}
			participant.type = type;

			if (type === 'Speaker') participant.speaker = true;

			return participant;
		})
		.on("data", function(data) {
			if (!data) return;

			bulk.push({ index: { _index: indexName, _type: 'participant', _id: data.id }});
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
				client.indices.refresh({ index: indexName }).then(function() {
					//count nb participants after refresh
					return client.count({ index: indexName });

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
