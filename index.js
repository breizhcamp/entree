/**
 * Interface Web de consultation
 */

var restify = require('restify'),
	socketio = require('socket.io'),
	elasticsearch = require('elasticsearch');

var client = new elasticsearch.Client({
	host: 'localhost:9201'
});

var server = restify.createServer();
var io = socketio.listen(server.server);
server.use(restify.plugins.bodyParser());

/**
 * DESK LETTER COMPUTATION FROM ID
 */
function computeDeskFromId(id) {
	var i = id < 750 ? id : 749; //force to 3 desk max

	//65 = A - 300 = nb persons per desk
	return String.fromCharCode(65 + Math.floor(i / 300));
}

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
						"prefix": {
							"prenom": search
						}
					},
					{
						"prefix": {
							"nom": search
						}
					},
					{
						"prefix": {
							"societe": search
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
		var persons = getPersonsFromES(resp);
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

function getPersonsFromES(resp) {
	return resp.hits.hits.map(function (r) {
		var p = r._source;
		p.desk = computeDeskFromId(p.id);

		return p;
	});
}

/**
 * USER CHECK-IN
 * update user in ES and send to all second screen connected
 */
server.post('/checkin', function(req, res, next) {
	checkin(req.body.id, res, next, 'post');
});
server.del('/checkin/:id', function(req, res, next) {
	checkin(req.params.id, res, next, 'delete');
});

function checkin(id, res, next, method) {
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

		var event = method === 'post' ? 'checkin' : 'remove';
		stamp(person, 'checkin', event).then(function () {
			res.send(204, "");
			return next();
		});
	});
}

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

		if (event === "remove") {
			body.doc.checkin = null;
		}
	}

	return client.update({
		index: 'participants',
		type: 'participant',
		id: person.id,
		body: body
	}).then(function() {
		//dispatch event to every 2nd screen connected
		var e = event ? event : attr;
		person.desk = computeDeskFromId(person.id);
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
				sort: [ { checkin: { order: 'asc' } } ],
				size: 1000
			}
		}).then(function(resp) {
			socket.emit('init', getPersonsFromES(resp));
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
