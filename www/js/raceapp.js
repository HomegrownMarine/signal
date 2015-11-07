var metrics = [{'metric':'tws', 'group':'wind'},
               {'metric':'twd', 'group':'twd'},
               {'metric':'gwd', 'group':'twd'},
               {'metric':'performance', 'group':'percent'},
               {'metric':'sog', 'group':'speed'}, 
               {'metric':'speed', 'group':'speed'},
               {'metric':'targetSpeed', 'group':'speed'}, 
               {'metric':'hdg', 'group':'heading'},
               {'metric':'cog', 'group':'heading'},
               {'metric':'aawa', 'group':'angle', 'transform':function(val) { return Math.abs(val) }},
               {'metric':'atwa', 'group':'angle', 'transform':function(val) { return Math.abs(val) }},
               {'metric':'targetAngle', 'group':'angle'}, 
               {'metric':'trim', 'group':'heel'},
               {'metric':'heel', 'group':'heel'},
               {'metric':'targetHeel', 'group':'heel'}, 
               {'metric':'vmg', 'group':'speed'} ];

var configs = {
    'wind': {showX: true},
    'percent': {rangeY: [80, 120]},
    'angle': {invertY: true}
}

var graphs = [];

function initialize() {
    showCheckboxes();
    showMap();
    showGraphs();
}

function showCheckboxes() {
    var keys = ['tws', 'sog', 'speed', 'hdg'];
    if (localStorage.race_metrics) {
        keys = JSON.parse(localStorage.race_metrics);
    }

    _(metrics).each(function(metric) {
        $('<label><input type="checkbox" class="metric">'+metric.metric+'</label>')
            .appendTo('#checkboxes')
            .find('input')
                .prop('checked', _.contains(keys, metric.metric))
                .val(metric.metric)
    })

    $('#checkboxes').on('change', '.metric', function() {
        if (this.checked) {
            keys.push(this.value);
        }
        else {
            keys = _.without(keys, this.value);
        }

        localStorage.race_metrics = JSON.stringify(keys);
        showGraphs();
    })
}

function showMap() {
    //TODO: highlight nearest data point for all series
    //TODO: map to boat

    var map = window.map = new mapView({model: window.race, el: '#map_canvas'});
    map.render();
}

function showGraphs() {

    var keys = ['tws', 'performance', 'speed', 'targetSpeed', 'atwa', 'targetAngle'];
    // if (localStorage.race_metrics) {
    //     keys = JSON.parse(localStorage.race_metrics);
    // }

    _.each(graphs, function(graph) { 
        graph.remove();
    });
    graphs = [];

    graphs = _(metrics)
                .filter(function(m){ return _.contains(keys, m.metric)})
                .groupBy(function(m) { return m.group })
                .map( function(ms, name) {
                    var graph = new graphView({race: window.race, series: _.pluck(ms, 'metric'), id: name+'_graph'}, configs[name]);
                    $('#graphs').append(graph.el);
                    graph.render();
                    return graph;
                }).value();
}                
  
//default race to example
var race_id = window.location.search.substr(1) || '2014_nas_6';

var racesPromise = $.ajax('data/races.js', {
    dataType: 'json'
}).promise();

var raceDataPromise = $.ajax('data/races/'+race_id+'.js', {
    dataType: 'json'
}).promise();

//load data  
function init() {
    Handlebars.registerHelper('fixed', function(value, precision) {
        if (!_.isNumber(value)) {
            return "NaN";
        }
        precision = _.isNumber(precision)? precision: 1;
        return value.toFixed(precision);
    });

    //build dropdown of all races, to easily navigate between them
    racesPromise.then(function(races) {
        var raceOptions = _(races)
                    .filter({"boat": "Project Mayhem"})
                    .sortBy('date')
                    .reverse()
                    .map(function(race) {
                        var date = moment(race.date, 'YYYYMMDD');
                        return '<option value="'+race.id+'">'+[date.format('YYYY'), race.regatta, 'Race', race.race].join(' ') +'</option>';
                    })
                    .value();
        $('#race_nav')
            .html(raceOptions.join())
            .change(function(a,b,c,d) {
                var race = $(this).val();
                window.location = window.location.href.split('?')[0] + '?' + race;
            }); 

    });
    Promise.all([racesPromise, raceDataPromise]).then(function(results) {
            
            var races = results[0];
            window.g_races = races;

            var raceData = results[1];

            var race = window.race = _.find(races, function(r) {
                return r.id == race_id;
            });

            $('h2').text( [race.regatta, 'Race', race.race, '-', moment(race.date, 'YYYYMMDD').format('ddd, MMM Do YYYY')].join(' ') );

            race.data = raceData;
            var start = moment(race.date+' '+race.startTime, "YYYYMMDD HH:mm");
            race.stttt = start;

            var ret = buildOutData( race.data, start.valueOf() );
            
            _.extend(window.race, ret);

            var BOARD_COLORS = {
                'D-P': '#F2E9E9',
                'D-S': '#E9F2E9',
                'U-S': '#F5FFF5',
                'U-P': '#FFF5F5',
                'PS': '#fcfcfc'
            };

            _.each(window.race.maneuvers, function(d) {
                d.color = BOARD_COLORS[d.board];
                
                var c = ['board'];

                if ( d.board.charAt(0) == 'D' )
                    c.push('downwind');

                if (d.board.charAt(2) == 'P') c.push('port');
                if (d.board.charAt(2) == 'S') c.push('starboard');

                d.className = c.join(' ');
            });

            initialize();
        });

    app.on('select-tack', function(tack, label) {
        if ( !label) return;
        
        var details = $('#graphs').empty();

        console.info(tack); window.tack = tack;

        var view = new tackView({tack: tack});
        view.render();
        view.$el.appendTo(details);
    });
}