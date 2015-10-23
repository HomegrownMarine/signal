   
var graphView = Backbone.View.extend({
    tagName: 'div',
    className: "graph",
    initialize: function(options, options2) {
        this.allData = options.race.data;

        //TODO: config has series, colors, rolling?
        this.data = _.map( options.series, function(series) { return {metric: series, data: select2(options.race.data, series)}; } );

        this.showX = options2? options2.showX: false;
        this.invertY = options2? options2.invertY: false;
        if ( options2 && options2.rangeY ) {
            this.rangeY = options2.rangeY;
        }

        //set up background color blocks
        this.maneuvers = options.race.maneuvers;
        this.legs = [];

        for ( var i=0; i < options.race.maneuvers.length-1; i++ ) {
            //mark changes from UW to DW
            if ( options.race.maneuvers[i].board.charAt(0) != options.race.maneuvers[i+1].board.charAt(0) ) {
                //TODO: start and end here.
                var leg = {
                    leg: this.legs.length+2,
                    start: options.race.maneuvers[i+1].start
                };

                if ( this.legs.length > 0 && (leg.start - _.last(this.legs).start) < 60000 ) {
                    this.legs.pop(); //last leg is too short, remove it
                }

                this.legs.push(leg);
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
                d3.min( view.data, function(series) { return d3.min(series.data, function(d) { return d[1];}); } ),
                d3.max( view.data, function(series) { return d3.max(series.data, function(d) { return d[1];}); } ),
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
            .tickFormat(function(d) { return moment(d).format("h:mm"); });

        var yAxis = d3.svg.axis()
            .scale(y)
            .orient("left")
            .ticks(3);

        var line = d3.svg.line()
            .interpolate("linear")
            .x(function(d) { return x(d[0]); })
            .y(function(d) { return y(d[1]); });


        var svg = this.svg = d3.select(this.el).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
          .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

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
                .attr("fill", function(d) { return d.color; });


        //draw y grid and axis
        svg.append("g")         
            .attr("class", "grid")
            .call( d3.svg.axis()
                .scale(y)
                .orient("left")
                .ticks(height/30)
                .tickSize(-width, 0, 0)
                .tickFormat("")
            );

        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis)
          .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end");

        
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
                .tickFormat("") );

        var data = _.map(view.data, function(series){ return {metric:series.metric, data:simplify( _.filter(series.data, function(d) { return d[0] >= x.domain()[0] && d[0] <= x.domain()[1]; }), width )}; });
        
        var paths = svg.selectAll(".lines")
            .data(data)
          .enter().append("g")
            .attr("class", "lines");
            
        paths.append("path")
            .attr("class", "line")
            .style("stroke", function(d) { return color(d.metric); })
            .attr("d", function(d) { return line(d.data); });

        function draw() {
            svg.select("g.x.axis").call(xAxis);
            
            //render a smaller amount of data
            var start = x.domain()[0];
            var end = x.domain()[1];
            var data = _.map(view.data, function(series){ return {metric:series.metric, data:simplify( _.filter(series.data, function(d) { return d[0] >= start && d[0] <= end; }), width )}; });            

            svg.selectAll('path.line')
                .data(data)
                .attr('d', function(d) { return line(d.data); });

            svg.selectAll("rect.board")
                .attr("x", function(d) { return x(d.start); })
                .attr("width", function(d) { return x(d.end) - x(d.start); });
        }
        draw();

        var scrubline = svg.append("line")
                        .attr("class", "scrubline")
                        .attr('x1', -10)
                        .attr('x2', -10)
                        .attr('y1', 0)
                        .attr('y2', height);

        var legend = svg.append("text")
            .attr("y", 10)
            .attr("x", width)
            .style("text-anchor", "end")
            .style('font-size', '10px');

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
                }).join('  ');

                legend.text(text);
            }
            else {
                legend.text(' ');
                scrubline.attr('stroke-width', 0);
            }
        }

        this.listenTo(app, 'scrub', highlight);
        svg.on('mousemove', function(a,b,c,d) {
            var pos = d3.mouse(this);
            var time = x.invert(pos[0]);
            app.trigger('scrub', new Date(time), pos);
        });

        svg.on('dblclick', function(a,b,c,d) {
            zoom = !zoom;

            if ( zoom ) {
                var pos = d3.mouse(this);
                var time = new Date(x.invert(pos[0]));
                var board = _.find(view.maneuvers, function(maneuver) { return maneuver.start <= time && maneuver.end >= time; });

                app.trigger('zoom', board.start, board.end);
            }
            else {
                app.trigger('zoom', allTimeRange[0], allTimeRange[1]);
            }

        });

        this.listenTo(app, 'zoom', function(start, end) {
            console.info(start, end);

            if ( start - allTimeRange[0] !== 0 ) start -= 60000;
            if ( end - allTimeRange[1] !== 0 ) end = 60000 + end;//can't add date and int, but can subtract...
            x.domain([start, end]);

            //TODO: make efficient
            y.domain([
                d3.min( view.data, function(series) { return d3.min( _.filter(series.data, function(d) { return d[0] >= start && d[0] <= end; }), function(d) { return d[1];}); } ),
                d3.max( view.data, function(series) { return d3.max( _.filter(series.data, function(d) { return d[0] >= start && d[0] <= end; }), function(d) { return d[1];}); } ),
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


