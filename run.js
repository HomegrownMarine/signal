

var path = require('path');
var express = require('express');
var winston = require('winston');
var fs = require('fs');

var _ = require('lodash');
var handlebars = require('handlebars');


var server = express();

server.use('/', express.static(path.join(__dirname, 'www')));

var indexTemplate = null;
fs.readFile(path.join(__dirname,'templates/index.html'), {encoding:'utf8'}, function(err, data) {
    if (err) {
        winston.error('logs: error loading template', err);
        return;
    }

    indexTemplate = handlebars.compile(data);
});

//returns current set of data for boat
server.get('/', function(req, res) {
    fs.readFile(path.join(__dirname,'data/races.js'), {encoding:'utf8'}, function(err, raceJSON) {
        if (err) {
            winston.error('logs: error loading template', err);
            return;
        }

        var races = JSON.parse(raceJSON);

        var years = _(races)
            .filter({"boat": "Project Mayhem"})
            .sortBy('date')
            .reverse()
            .groupBy(function(o) { return o.date.slice(0,4); })
            .map(function(races, year) {
                var regattas = _(races)
                    .groupBy('regatta')
                    .map(function(races, regatta) {
                        return {name:regatta,  races:_.sortBy(races, 'race')};
                    })
                    .value();
  
                return {year: year, regattas: regattas};
            })
            .sortBy(function(year) { return year.year*-1; })
            .value();

        res.send( indexTemplate({years: years}) );
    });
});

//returns current set of data for boat
server.get('/tacks.js', function(req, res) {
    res.setHeader("content-type", "application/json");
    fs.createReadStream("./data/tacks.js").pipe(res);
});

//returns current set of data for boat
server.get('/tacks_1h.js', function(req, res) {
    res.setHeader("content-type", "application/json");
    fs.createReadStream("./data/tacks_1h.js").pipe(res);
});

//returns current set of data for boat
server.get('/races.js', function(req, res) {
    res.setHeader("content-type", "application/json");
    fs.createReadStream("./data/races.js").pipe(res);
});

server.get('/races/:race.js', function(req, res) {
    var race = req.params.race;
    res.setHeader("content-type", "application/json");
    fs.createReadStream("./data/races/"+race+".js").pipe(res);
});

server.set('port', 8080);
var server = server.listen(server.get('port'), function() {
    winston.info('Express server listening on port ' + server.address().port);
});
