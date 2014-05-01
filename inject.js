/**
 * Permet d'injecter le CSV dans ElasticSearch
 */
var csv = require("fast-csv"),
	elasticsearch = require('elasticsearch'),
	crypto = require('crypto');

var client = new elasticsearch.Client({
	host: 'localhost:9200'
});

//check index exists
client.indices.exists({	index: 'participants' }).then(function(data) {
	if (data) return;
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
		.on("record", function(data){
			var participant = {
				id: data['# Code Barre'],
				nom: data['Nom participant'],
				prenom: data['Prénom participant'],
				mail: data['E-mail Participant'] ? data['E-mail Participant'] : data['E-mail Acheteur'],
				type: data['Tarif'],
				dif: !!data['utilisation du DIF']
				//mailmd5
				//societe if filled
				//days
			};
			participant.mailmd5 = crypto.createHash('md5').update(participant.mail).digest("hex");
			if (data['Societe Participant']) participant.societe = data['Societe Participant'];

			//injecting days the participant has access
			var days;
			switch (participant.type) {
				case 'combo BreizhCamp 2014':
				case 'Early Bird (-30%)':
				case 'Speaker':
				case 'Sponsor': days = ['2014-05-21', '2014-05-22', '2014-05-23']; break;
				case 'BreizhCamp conférence': days = ['2014-05-22', '2014-05-23']; break;
				case 'Hacker-space': days = ['2014-05-21']; break;
				case 'Conférence, Day 1': days = ['2014-05-22']; break;
				case 'Conférence, Day 2': days = ['2014-05-23']; break;
			}
			participant.days = days;

			var that = this;
			//pause during ES indexing
			that.pause();

			//indexing the participant
			client.index({
				index: 'participants',
				type: 'participant',
				id: participant.id,
				body: participant
			}, function() { that.resume(); });
		})
		.on("end", function() {
			client.indices.refresh({ index: 'participants' }).then(function() {
				//count nb participants after refresh
				return client.count({ index: 'participants' });

			}).then(function(data) {
				console.log("Injection OVER, Nb participants: " + data.count);
				client.close();
			});
		});
}
