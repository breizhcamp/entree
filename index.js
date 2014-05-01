/**
 * Interface Web de consultation
 */

var express = require('express'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
	bodyParser = require('body-parser'),
	elasticsearch = require('elasticsearch');

var client = new elasticsearch.Client({
	host: 'localhost:9200'
});

app.use(express.static(__dirname + '/static'));
app.use(bodyParser.json());

/**
 * SEARCH QUERY
 */
app.post('/s', function(req, res){
	var search = req.body.s;
	if (!search) {
		res.json([]);
	}

	var query;
	if (isNaN(search)) {
		//textual search
		query = {
			bool: {
				should: [
					{ wildcard: { "nom": { value: search + "*", boost: 5.0 } } },
					{ wildcard: { "prenom": { value: search + "*", boost: 4.0 } } },
					{
						fuzzy_like_this: {
							fields: ["id", "nom", "prenom", "societe", "mail"],
							like_text: search
						}
					}
				]
			}
		}
	} else {
		//id search
		query = {
			ids: {
				values: [search]
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
		res.json(resp.hits.hits.map(function(r) { return r._source; }));
	}, function(err) {
		res.send(500, err);
	});
});

/**
 * USER CHECK-IN
 * update user in ES and send to all second screen connected
 */
app.post('/checkin', function(req, res) {
	var person = req.body.person;
	person.checkin = new Date();
	client.update({
		index: 'participants',
		type: 'participant',
		id: person.id,
		body: {
			doc: {
				checkin: person.checkin
			}
		}
	}).then(function() {
		//dispatch event to every 2nd screen connected
		io.sockets.emit('checkin', person);
		res.send(204).end();
	});
});

/**
 * 2ND SCREEN COMMUNICATION BY SOCKET.IO
 */
io.sockets.on('connection', function (socket) {
	//send initial person list
	client.search({
		index: 'participants',
		type: 'participant',
		body: {
			query: {
				filtered: {
					query: { match_all: {} },
					filter: {
						exists: { field: 'checkin' }
					}
				}
			},
			sort: [ { checkin: { order: 'desc' } } ],
			size: 7
		}
	}).then(function(resp) {
		socket.emit('init', resp.hits.hits.map(function(r) { return r._source; }));
	});
});

server.listen(3000);
console.log("Server running on http://localhost:3000");