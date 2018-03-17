/**
 * Interface Web de consultation
 */

var restify = require('restify'),
	socketio = require('socket.io'),
	elasticsearch = require('elasticsearch');

var client = new elasticsearch.Client({
	host: 'localhost:9200'
});

var server = restify.createServer();
var io = socketio.listen(server.server);
server.use(restify.plugins.bodyParser());

/**
 * SEARCH QUERY
 */
server.post('/s', function (req, res, next) {
	var search = req.body.s;
	if (!search) {
		res.send([]);
		return next();
	}

	var query;

	if (isNaN(search)) {
		//textual search
		query = {
			"bool": {
				"should": [
					{
						"multi_match": {
							"query": search,
							"fields": [	"nom", "prenom","societe" ],
							"fuzziness": "AUTO"
						}
					},
					{
						"match_phrase_prefix": {
							"prenom": {
								"query": search
							}
						}
					},
					{
						"match_phrase_prefix": {
							"nom": {
								"query": search
							}
						}
					},
					{
						"match_phrase_prefix": {
							"societe": {
								"query": search
							}
						}
					}

				]
			}
		}
	} else {
		//id search
		if (search.length === 12) {
			search = search.substr(4, 7);
		}

		query = {
			"bool": {
				"should": [
					{ "term": { "id": search } },
					{ "term": { "barcode": search } }
				]
			}
		}
	}

	client.search({
		index: 'participants',
		type: 'participant',
		body: {
			query: query
		}
	}).then(function(resp) {
		var persons = resp.hits.hits.map(function(r) { return r._source; });
		res.send(persons);
		next();

		//only one result and it's a barcode or id, let's autocheckin
		if (persons.length === 1 && !persons[0].checkin && persons[0].barcode === search) {
			stamp(persons[0], 'checkin'); //dont wait until checkin
		}

	}, function(err) {
		next(new restify.InternalServerError(err.message));
	});
});

/**
 * USER CHECK-IN
 * update user in ES and send to all second screen connected
 */
server.post('/checkin', function(req, res, next) {
	var id = req.body.id;

	client.get({
		index: 'participants',
		type: 'participant',
		id: id
	}, function (error, response) {
		if (!response) {
			res.send(204, "");
			return next();
		}

		var person = response._source;

		stamp(person, 'checkin').then(function() {
			res.send(204, "");
			return next();
		});
	});
});

/**
 * BADGE VALIDATION
 * update user when badge is given at a desk
 */
server.post('/badge', function(req, res, next) {
	var person = req.body.person;
	stamp(person, 'badge', 'remove').then(function() {
		res.send(204, "");
		return next();
	});
});

function stamp(person, attr, event) {
	person[attr] = new Date();

	var body = { doc: {} };
	body.doc[attr] = person[attr];

	if (attr === "checkin") {
		body.doc.badge = null;
	}

	return client.update({
		index: 'participants',
		type: 'participant',
		id: person.id,
		body: body
	}).then(function() {
		//dispatch event to every 2nd screen connected
		var e = event ? event : attr;
		io.sockets.emit(e, person);
	});
}

/**
 * 2ND SCREEN COMMUNICATION BY SOCKET.IO
 */
io.sockets.on('connection', function (socket) {

	socket.on('init', function() {
		//send initial person list
		client.search({
			index: 'participants',
			type: 'participant',
			body: {
				query: {
					"bool": {
						"must": { "exists": {"field": "checkin"}},
						"must_not": {"exists": { "field": "badge"}}
					}
				},
				sort: [ { checkin: { order: 'desc' } } ],
				size: 25
			}
		}).then(function(resp) {
			socket.emit('init', resp.hits.hits.map(function(r) { return r._source; }));
		}, function(err) {
			console.log("Error when retrieving last checkin", err);
		});
	});
});

server.get('/.*', restify.plugins.serveStatic({
	directory: './static',
	default: 'index.html'
}));


// ----------------------------------    INIT    ----------------------------------------------------
process.on('message', function(message) {
	if (message === 'shutdown') {
		process.exit(0);
	}
});

server.listen(3000, function() {
	console.log('%s listening at %s', server.name, server.url);
	if (process.send) process.send('online');
});
