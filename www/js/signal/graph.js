
var BOARD_COLORS = {
    'D-P': '#F2E9E9',
    'D-S': '#E9F2E9',
    'U-S': '#F5FFF5',
    'U-P': '#FFF5F5',
    'PS': '#fcfcfc'
}
   
var graphView = Backbone.View.extend({
    tagName: 'div',
    className: "graph",
    initialize: function(options, options2) {
        this.allData = options.race.data;

        //TODO: config has series, colors, rolling?
        this.data = _.map( options.series, function(series) { return {metric: series, data: select2(options.race.data, series) }} );

        this.showX = options2? options2.showX: false;
        this.invertY = options2? options2.invertY: false;
        if ( options2 && options2.rangeY ) {
            this.rangeY = options2.rangeY;
        }

        //set up background color blocks
        var max_time = options.race.data[options.race.data.length-1].t;
        
        this.maneuvers = options.race.maneuvers;
        _.each(this.maneuvers, function(m) {
            m.color = BOARD_COLORS[m.board];
        })
        this.legs = [];

        for (var i=0; i < options.race.maneuvers.length-1; i++ ) {
            //mark changes from UW to DW
            if ( options.race.maneuvers[i].board.charAt(0) != options.race.maneuvers[i+1].board.charAt(0) ) {
                this.legs.push({
                    leg: this.legs.length+2,
                    start: options.race.maneuvers[i+1].start
                });
            }
        }

        // console.info(this.legs);
    },
    render: function() {
        var view = this;
        
        var margin = {top: 5, right: 10, bottom: 5, left: 50};

        if ( this.showX ) {
            margin.top = 30;
        }

        var width = this.$el.width() - margin.left - margin.right,
            height = this.$el.height() - margin.top - margin.bottom;

        var zoom = false;

        var allTimeRange = d3.extent(this.data[0].data, function(d) { return d[0]; });
        var x = this.x = d3.scale.linear()
            .range([0, width])
            .domain(allTimeRange);

        var y = d3.scale.linear()
            .range([height, 0])
            .domain([
                d3.min( view.data, function(series) { return d3.min(series.data, function(d) { return d[1]}) } ),
                d3.max( view.data, function(series) { return d3.max(series.data, function(d) { return d[1]}) } ),
            ]);

        if ( this.rangeY ) {
            y.domain(this.rangeY);
        }

        if ( this.invertY ) {
            y.domain( [y.domain()[1], y.domain()[0]] );
        }

        var color = d3.scale.category10();
        color.domain( _.map(this.data, function(series) { return series.metric; }) );

        var xAxis = d3.svg.axis()
            .scale(x)
            .orient("top")
            .tickValues(_.pluck(this.legs, 'start'))
            .tickFormat(function(d) { return moment(d).format("h:mm"); })

        var yAxis = d3.svg.axis()
            .scale(y)
            .orient("left")
            .ticks(3)

        var line = d3.svg.line()
            .interpolate("linear")
            .x(function(d) { return x(d[0]); })
            .y(function(d) { return y(d[1]); });


        var svg = this.svg = d3.select(this.el).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
          .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")")

        //TODO: 2: zoom
        //TODO: 4: axis labels
        //TODO: 5: zoom 1 graph. then all graphs

        // draw colored background, for stb vs port
        svg.append("g")
            .attr("class", "boards")
            .selectAll("rect.board")
                .data(this.maneuvers)
            .enter().append("rect")
                .attr('class', 'board')
                .attr("x", function(d) { return x(d.start); })
                .attr("width", function(d) { return x(d.end) - x(d.start); })
                .attr("y", 0)
                .attr("height", height)
                .attr("fill", function(d) { return d.color });


        //draw y grid and axis
        svg.append("g")         
            .attr("class", "grid")
            .call( d3.svg.axis()
                .scale(y)
                .orient("left")
                .ticks(height/30)
                .tickSize(-width, 0, 0)
                .tickFormat("")
            )

        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis)
          .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            // .text("Temperature (ºF)");

        
        //draw x axis
        if ( this.showX ) {
            svg.append("g")
                .attr("class", "x axis")
                // .attr("transform", "translate(0," + height + ")")
                .call(xAxis);
        }

        svg.append("g")         
            .attr("class", "grid")
            // .attr("transform", "translate(0," + margin.top + ")")
            .call( d3.svg.axis()
                .scale(x)
                .orient("top")
                .tickValues(_.pluck(this.legs, 'start'))
                .tickSize(-height, 0, 0)
                .tickFormat("")
            )

        var data = _.map(view.data, function(series){ return {metric:series.metric, data:simplify( _.filter(series.data, function(d) { return d[0] >= x.domain()[0] && d[0] <= x.domain()[1] }), width )} });
        
        var paths = svg.selectAll(".lines")
            .data(data)
          .enter().append("g")
            .attr("class", "lines")
            
        paths.append("path")
            .attr("class", "line")
            .style("stroke", function(d) { return color(d.metric); })
            .attr("d", function(d) { return line(d.data); })

        function draw() {
            svg.select("g.x.axis").call(xAxis);
            
            //render a smaller amount of data
            var start = x.domain()[0];
            var end = x.domain()[1];
            var data = _.map(view.data, function(series){ return {metric:series.metric, data:simplify( _.filter(series.data, function(d) { return d[0] >= start && d[0] <= end }), width )} });            

            svg.selectAll('path.line')
                .data(data)
                .attr('d', function(d) { return line(d.data); })

            svg.selectAll("rect.board")
                .attr("x", function(d) { return x(d.start); })
                .attr("width", function(d) { return x(d.end) - x(d.start); })
        }
        draw();

        var scrubline = svg.append("line")
                        .attr("class", "scrubline")
                        .attr('x1', -10)
                        .attr('x2', -10)
                        .attr('y1', 0)
                        .attr('y2', height)

        var legend = svg.append("text")
            .attr("y", 10)
            .attr("x", width)
            .style("text-anchor", "end")
            .style('font-size', '10px')
            // .text("Temperature (ºF)");

        function highlight(time, pos) {
            var xPos = x(time);

            if ( xPos > 0 ) {
                scrubline
                    .attr('x1', xPos)
                    .attr('x2', x(time))
                    .attr("stroke-width", 1)
                    .attr("stroke", "#666");

                var text = _.map(view.data, function(series) { 
                    var index = _.sortedIndex( series.data, [time], function(point) { return point[0]; } );
                    var point = series.data[index];
                    return series.metric + ': ' + point[1].toFixed(2);
                }).join('  ')

                legend.text(text)
            }
            else {
                legend.text(' ');
                scrubline.attr('stroke-width', 0)
            }
        }

        this.listenTo(app, 'scrub', highlight);
        svg.on('mousemove', function(a,b,c,d) {
            var pos = d3.mouse(this)
            var time = x.invert(pos[0])
            app.trigger('scrub', new Date(time), pos)
        })

        svg.on('dblclick', function(a,b,c,d) {
            zoom = !zoom;

            if ( zoom ) {
                var pos = d3.mouse(this);
                var time = new Date(x.invert(pos[0]));
                var board = _.find(view.maneuvers, function(maneuver) { return maneuver.start <= time && maneuver.end >= time });

                app.trigger('zoom', board.start, board.end);
            }
            else {
                app.trigger('zoom', allTimeRange[0], allTimeRange[1]);
            }

        });

        this.listenTo(app, 'zoom', function(start, end) {
            console.info(start, end);

            if ( start - allTimeRange[0] != 0 ) start -= 60000
            if ( end - allTimeRange[1] != 0 ) end = 60000 + end //can't add date and int, but can subtract...
            x.domain([start, end]);

            //TODO: make efficient
            y.domain([
                d3.min( view.data, function(series) { return d3.min( _.filter(series.data, function(d) { return d[0] >= start && d[0] <= end }), function(d) { return d[1]}) } ),
                d3.max( view.data, function(series) { return d3.max( _.filter(series.data, function(d) { return d[0] >= start && d[0] <= end }), function(d) { return d[1]}) } ),
            ]);
            if ( view.invertY ) {
                y.domain( [y.domain()[1], y.domain()[0]] );
            }

            svg.select(".x.axis").call(xAxis);
            svg.select(".y.axis").call(yAxis);

            draw();
        });
    }
});


var tackGraphView = Backbone.View.extend({
tagName: 'div',
    className: "tackGraph",
    initialize: function(data, tack) {
        this.data = data;
        this.tack = tack;
    },
    render: function() {
        var view = this;
        
        var margin = {top: 15, right: 10, bottom: 5, left: 10};

        if ( this.showX ) {
            margin.top = 30;
        }

        var width = 200 - margin.left - margin.right,
            height = 200 - margin.top - margin.bottom;

        var zoom = false;

        var x = this.x = d3.scale.linear()
            .range([0, width])
            .domain(d3.extent( view.data, function(d) { return d.t } ) );

        function line(data, metric, range, xform, scale) {
            var cleanData = _.compact(_.map( data, function(d) { if (metric in d) return [d.t, d[metric]] } ));

            var range = range || [height, 0];
            var scale = scale || (d3.scale.linear()
                .range(range)
                .domain(d3.extent( cleanData, function(d) { return d[1] } ) ));

            if (xform) xform(scale)

            var line = d3.svg.line()
                .interpolate("linear")
                .x(function(d) { return x(d[0]); })
                .y(function(d) { return scale(d[1]); });

            return [line(cleanData), scale];
        }

        
        //
        var ticks = [];
        for ( var i = -30; i < 50; i+=10 ) {
            ticks.push( moment(view.tack.timing.center).add(i, 'seconds') );
        }

        var xAxis = d3.svg.axis()
            .scale(x)
            .orient("top")
            .tickValues( ticks )
            .tickSize(3)
            .tickFormat(function(d) { return parseInt(view.tack.timing.center.diff(d)/-1000); })


        var svg = this.svg = d3.select(this.el).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
          .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")")

        svg.append("g")
            .attr("class", "x axis")
            // .attr("transform", "translate(0," + height + ")")
            .call(xAxis);

        svg.append("g")         
            .attr("class", "grid")
            // .attr("transform", "translate(0," + margin.top + ")")
            .call( d3.svg.axis()
                .scale(x)
                .orient("top")
                .tickValues( ticks )
                .tickSize(-height, 0, 0)
                .tickFormat("")
            )


        //critical points
        svg.append('line')
            .attr('class', 'timing center')
            .style('stroke', 'blue')
            .attr({"x1": x(this.tack.timing.start), "x2": x(this.tack.timing.start), "y1": 0, "y2": height})
    
        svg.append('line')
            .attr('class', 'timing center')
            .style('stroke', 'blue')
            .attr({"x1": x(this.tack.timing.end), "x2": x(this.tack.timing.end), "y1": 0, "y2": height})
        
        svg.append('line')
            .attr('class', 'timing center')
            .style('stroke', '#0a0')
            .attr({"x1": x(this.tack.timing.recovered), "x2": x(this.tack.timing.recovered), "y1": 0, "y2": height})


        //data
        var speed = line(view.data, 'speed', null, function(scale) { scale.domain([0, 7]) });
        var vmg = line(view.data, 'vmg', null, function(scale) { scale.domain([0, 7]) });

        var newRange = [
            Math.min(speed[1].domain()[0], vmg[1].domain()[0]),
            Math.max(speed[1].domain()[1], vmg[1].domain()[1])
        ];
        // speed[1].domain(newRange)
        // vmg[1].domain(newRange)

        
        svg.append('line')
            .attr('class', 'timing center')
            .attr({"x1": 0, "x2": width, "y1": vmg[1](this.tack.entryVmg), "y2": vmg[1](this.tack.entryVmg)})

        svg.append('path')
            .attr('class', 'speedLine')
            .attr('fill', 'none')
            .style('stroke', 'rgb(153,153,255)')
            // .style('stroke-width', '.5')
            .attr('d',  speed[0]);


        svg.append('path')
            .attr('class', 'vmgLine')
            .attr('fill', 'none')
            .style('stroke', 'blue')
            // .style('stroke-width', '.5')
            .attr('d', vmg[0] );

        var tvmg = line(view.data, 'targetVmg', null, null, vmg[1] );
        svg.append('path')
            .attr('class', 'windLine')
            .attr('fill', 'none')
            .attr('stroke', 'cyan')
            .attr('d', tvmg[0] );

        //relational lines
        ///
        var lastTWA = null;
        var lastHDG = null;
        var lastAWA = null;
        for ( var i=0; i < view.data.length; i++ ) {
            if ('atwa' in view.data[i] ) {
                if (lastTWA === null) lastTWA = view.data[i].atwa;

                var diff = Math.abs(view.data[i].atwa-lastTWA);
                view.data[i].windDelta = diff;

                lastTWA = view.data[i].atwa;
            }
            if ('aawa' in view.data[i] ) {
                if (lastAWA === null) lastAWA = view.data[i].aawa;

                var diff = Math.abs(view.data[i].aawa-lastAWA);
                view.data[i].awindDelta = diff;

                lastAWA = view.data[i].aawa;
            }
            if ('hdg' in view.data[i] ) {
                if (lastHDG === null) lastHDG = view.data[i].hdg;

                var diff = Math.abs(view.data[i].hdg-lastHDG);
                view.data[i].hdgDelta = diff;

                lastHDG = view.data[i].hdg;
            }
        }

        var wind = line(view.data, 'atwa', [height, height/3], function(scale) { scale.domain( [55, scale.domain()[0]] ); });
        svg.append('path')
            .attr('class', 'windLine')
            .attr('fill', 'none')
            .attr('stroke', 'red')
            .attr('d', wind[0] );

        // svg.append('path')
        //     .attr('class', 'windLine')
        //     .attr('fill', 'none')
        //     .attr('stroke-width', .5)
        //     .attr('stroke', 'red')
        //     .attr('d', line(view.data, 'aawa', [height, height/2], function(scale) { scale.domain( wind[1].domain ); })[0] );

        // svg.append('path')
        //     .attr('class', 'windLine')
        //     .attr('fill', 'none')
        //     .attr('stroke', 'black')
        //     .attr('stroke-width', .5)
        //     .attr('d', line(view.data, 'hdg')[0] );

        // var wd = line(view.data, 'windDelta');
        // svg.append('path')
        //     .attr('class', 'windDelta')
        //     .attr('fill', 'none')
        //     .attr('stroke', 'blue')
        //     .attr('d', wd[0]);

        // console.info( _.compact(_.map( view.data, function(d) { if ('windDelta' in d) return d['windDelta'] } )) )


        // var awd = line(view.data, 'awa', [height, height/3], function(scale) { scale.domain( [scale.domain()[1], scale.domain()[0]] ); });
        // svg.append('path')
        //     .attr('class', 'awindDelta')
        //     .attr('fill', 'none')
        //     .attr('stroke', 'orange')
        //     .attr('d', awd[0]);

        

        // var hd = line(view.data, 'hdgDelta');
        // svg.append('path')
        //     .attr('class', 'hdgDelta')
        //     .attr('fill', 'none')
        //     .attr('stroke', '#999')
        //     .attr('d', hd[0]);

        var ta = line(view.data, 'targetAngle', null, null, wind[1]);
        svg.append('path')
            .attr('class', 'targetAngle')
            .attr('fill', 'none')
            .attr('stroke', 'orange')
            .attr('d', ta[0]);

        // // console.info( _.compact(_.map( view.data, function(d) { if ('hdgDelta' in d) return d['hdgDelta'] } )) )

        // svg.append('line')
        //     .attr('class', 'timing center')
        //     .attr({"x1": 0, "x2": width, "y1": hd[1](0), "y2": hd[1](0)})
    }
});