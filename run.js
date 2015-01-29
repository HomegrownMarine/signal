

var path = require('path');
var express = require('express');
var winston = require('winston');
var fs = require('fs');

var server = express();

server.use('/', express.static(path.join(__dirname, 'www')));

//returns current set of data for boat
server.get('/races', function(req, res) {
    res.setHeader("content-type", "application/json");
    fs.createReadStream("./data/races.js").pipe(res);
});

server.get('/races/:race', function(req, res) {
    var race = req.params.race;
    res.setHeader("content-type", "application/json");
    fs.createReadStream("./data/races/"+race+".js").pipe(res);
});



server.set('port', 8080);
var server = server.listen(server.get('port'), function() {
    winston.info('Express server listening on port ' + server.address().port);
});
