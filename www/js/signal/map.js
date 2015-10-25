
var variance = 0; 

var mapView = Backbone.View.extend({
    className: 'map',
    initialize: function(options) {
        this.events = options.events === false ? false: true;
        this.annotations = options.annotations === false ? false: true;
        this.circles = options.circles || null;
        this.references = options.references || null;

        this.margin = {top: 0, right: 0, bottom: 0, left: 0};
    },
    getProjection: function(track, angle, width, height) {
        //create 'unit' projection
        var projection = d3.geo.mercator()
            .scale(1)
            .translate([0, 0]);

        var trackPath = d3.geo.path()
            .projection(projection)
            .pointRadius(3.5);

        //use unit projection to calculate scale factor for track
        var b = trackPath.bounds(track);
        var projectionScale = 1 / Math.max((b[1][0] - b[0][0]) / width, (b[1][1] - b[0][1]) / height);


        // calculate bounding rect for current track rotated
        // and scale so it fits in current rect        
        var refAngle = angle % 180;
        if (refAngle > 90 ) refAngle = 180 - refAngle;
        var t = refAngle * Math.PI / 180;

        var boundingX = (projectionScale * (b[1][0] - b[0][0]) * Math.cos(t) + projectionScale * (b[1][1] - b[0][1]) * Math.sin(t));
        var boundingY = (projectionScale * (b[1][0] - b[0][0]) * Math.sin(t) + projectionScale * (b[1][1] - b[0][1]) * Math.cos(t));

        var scale = 0.95 * Math.min( width/boundingX, height/boundingY );

        var projectionTranslation = [(width - projectionScale*scale * (b[1][0] + b[0][0])) / 2, (height - projectionScale*scale * (b[1][1] + b[0][1])) / 2];

        projection
            .scale(projectionScale*scale)
            .translate(projectionTranslation);

        return [projection, trackPath];
    },
    renderAnnotations: function(svg, angle) {
        var annotationsLayer= svg.append("g")
                .attr('class', 'annotations')

            // wind
            var wind = annotationsLayer
                        .append("g")
                            .attr('transform', 'translate(500, 50)')
                        .append("g")
                            .attr("class", "wind")
                            .attr('transform', 'rotate(180)')

            wind.append("line")
                .attr({"x1": 0, "x2": 0, "y1": 10, "y2": -10});

            wind.append("line")
                .attr({"x1": 0, "x2": -4, "y1": -10, "y2": -6});

            wind.append("line")
                .attr({"x1": 0, "x2": 4, "y1": -10, "y2": -6});

            // compass
            var compass = annotationsLayer
                            .append('g')
                                .attr('transform', 'translate(50, 50)')
                            .append("g")
                                .attr("class", "compass")
                                .attr('transform', 'rotate(-'+angle+')');

            // compass.append("circle")
            //     .attr("r", 20) 

            compass.append("path")
                .attr('class', 'ew')
                .attr("d", "M17,0 L0,3 L-17,0 L0,-3 L17,0")

            compass.append("path")
                .attr("d", "M0,-18 L3,0 L0,18 L-3,0 L0,-18")

            compass.append("path")
                .attr("d", "M4,4 L4,-4 L-4,-4 L-4,4 L4,4")

            compass.append('text')
                .attr('dy', -20)
                .attr('dx', -4)
                .text('N')
                
            // compass.append("circle")
            //     .attr('class', 'ew')
            //     .attr("r", 4) 
    },
    renderTackLabels: function(world, view, projection, angle, width, height) {
        var tackCosts = world.append('g')
            .attr('class', 'layer tack-costs');
          
        if ('tacks' in view.model) {
            var nodes = [];
            var links = [];

            for (var i=0; i < view.model.tacks.length; i++) {
                var d = view.model.tacks[i];
                var pos = projection(d.position);

                var l = {
                    tack: d,
                    x: pos[0],
                    y: pos[1]
                }
                var p = {
                    fixed: true,
                    x: pos[0],
                    y: pos[1]
                }

                nodes.push(l,p)
                links.push({
                    source: p,
                    target: l,
                    weight: 1
                })
            }

            var force = d3.layout.force()
                            .nodes(nodes)
                            .links(links)
                            .gravity(0)
                            .linkDistance(1)
                            .linkStrength(4)
                            .charge(-50)
                            .size([width, height]);
            force.start();
            for (var n = 0; n < 50; ++n) force.tick();
            force.stop();

            // console.info('links', _.map())

            // var anchorNode = vis.selectAll("g.anchorNode").data(force2.nodes()).enter().append("svg:g").attr("class", "anchorNode");
            
            // anchorNode.append("svg:circle").attr("r", 0).style("fill", "#FFF");
            //     anchorNode.append("svg:text").text(function(d, i) {
            //     return i % 2 == 0 ? "" : d.node.label
            // }).style("fill", "#555").style("font-family", "Arial").style("font-size", 12);

            tackCosts.selectAll('text.tack-label')
                .data(_.filter(nodes, function(d) { return 'tack' in d }))
              .enter().append("text")
                .attr("class", 'tack-label')

                .attr('transform', function(d) { return 'translate('+ d.x + "," + d.y + ')rotate(' + angle +')' })
                // .attr('dx', function(d) { return d.tack.board == 'U-P'?-5:5 })
                .attr('dy', '.35em')
                .attr('text-anchor', function(d) { return d.tack.board == 'U-P'?'end':null })
                .text(function(d) { return (d.tack.loss>0?"+":"")+d.tack.loss.toFixed(0); })
                .on('click', function(d) {
                    app.trigger('select-tack', d.tack, this);
                })

            app.trigger('select-tack', view.model.tacks[0]);
        }
    },
    render: function() {
        var view = this;
        
        var margin = this.margin;
        var width = this.$el.width() - margin.left - margin.right,
            height = this.$el.height() - margin.top - margin.bottom;

        width = width || 200;
        height = height || 200;

        // get extent of track, and make GEOJSON object
        var allTimeRange = d3.extent(this.model.data, function(d) { return d.t; });
        var lonExtent = d3.extent(this.model.data, function(d) { return d.lon; });
        var latExtent = d3.extent(this.model.data, function(d) { return d.lat; });

        var track = {type: "LineString", coordinates: _.compact( _.map(this.model.data, function(d) { return [d.lon, d.lat] }) ) };
        // make the TWD at the start "UP"
        var angle = this.model.up || parseInt(refTws(this.model.data)) || 0;
        var res = this.getProjection(track, angle, width, height);
        var projection = res[0];
        var trackPath = res[1];
        


        // svg container
        var svg = this.svg = d3.select(this.el).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)

        // background
        svg.append("g")
          .append("rect")
            .attr("class", "water")
            .attr("height", height + margin.top + margin.bottom)
            .attr("width", width + margin.left + margin.right);

        
        if ( this.annotations ) {
            this.renderAnnotations(svg, angle);
        }

        // world
        var world = svg.append('g')
            .attr('class', 'world')        
            .attr('transform', function() { return "rotate(-"+angle+"," + (width / 2) + "," + (height / 2) + ")" });


        //performance underlay
        var perfScale = d3.scale.threshold()
            .domain([50, 90, 100, 110])
            .range(["black", "red", "pink", "white", "yellow"]);

        var legend = {
            "red": "< 90% Target VMG",
            "pink": "between 90% and 100%",
            "white": "between 100% and 110%",
            "yellow": "> 110% Target VMG"
        };


        svg.append("g")
            .attr("class", "layer performance")
            .selectAll("text.legend")
            .data(perfScale.range().slice(1))
            .enter()
                .append("text")
                    .attr("class", function(d) { return "legend "+d; })
                    .style("fill", function(d) { return d; })
                    .attr("x", 20)
                    .attr("y", function(d, i) { return 400 + 20*i; })
                    .text(function(d) { return legend[d]; })


        var polars = _(homegrown.streamingUtilities.summerizeData(this.model.data, 'performance', 10000))
                        .filter(function(d) { return d.performance > 50 && d.performance < 151 })
                        .each(function(d) { d.color = perfScale(d.performance); })
                        .value();
        
        var polarTracks = homegrown.streamingUtilities.segmentData(this.model.data, polars);
        _.each(polarTracks, function(seg) {
            seg.track = {type: "LineString", coordinates: _.compact( _.map(seg.data, function(d) { return [d.lon, d.lat] }) )};
        });

        var polarHighlights = world.append('g')
                .attr('class', 'layer performance');
        
        polarHighlights.selectAll("path.highlight")
              .data(polarTracks)
            .enter()
              .append("path")
                .attr('class', 'highlight')
                .style('stroke', function(d) { return d.color; })
                .attr("d", function(d) { return trackPath(d.track) });


        //track
        world.append('path')
            .attr('class', 'track')
            .attr('d', trackPath(track))


        
        this.renderTackLabels(world, view, projection, angle, width, height);


        
        //create boat and put at start of race
        var start = projection(track.coordinates[0]);
        var hdg = view.model.data[0].hdg || 0;
        var boat = world.append('path')
            .attr('d', 'M0,-80 C60,0 50,50 35,80 L-35,80 C-50,50 -60,0 0, -80')
            .attr('class', 'boat')
            .attr('transform', 'translate('+start[0]+','+start[1]+')scale(.06)rotate('+(hdg)+',-10,-10)')

        if ( !this.events ) {
            return;
        }

        // //listen to app events
        this.listenTo(app, 'scrub', function(time) {
            var index = _.sortedIndex( view.model.data, {t: time}, function(point) { return point.t; } );
            var point = view.model.data[index];

            var coord = projection([point.lon, point.lat]);
            
            boat.attr('transform', 'translate('+(coord[0])+","+(coord[1]) +")scale(.06)rotate("+point.hdg+",-10,-10)");

            //TODO: smooth the TWD
            if ( 'twd' in point ) {
                svg.select('g.wind').attr('transform', 'rotate('+ (180-angle+point.twd) +')');
            }
        });

        this.renderLayerToggles();
        this.renderScrubber(width, height);

    },
    renderLayerToggles: function() {
        $('<div class="layers"><a class="button" href="#tack-costs">Tacks</a><a class="button" href="#performance">Performance</a><a class="button" href="#clear">Clear</a></div>').appendTo(this.el);
        
        $('.layers .button', this.el).click(function() {
            $('.layer').hide();
            var layerName = this.getAttribute('href').slice(1);
            console.info('layer', layerName, this);
            $('.layer.'+layerName).show();
        })
            .eq(1).click(); //select performance
    },
    renderScrubber: function(width, height) {
        //set up background color blocks
        var maneuvers = this.model.maneuvers;
        this.legs = [];

        for ( var i=0; i < maneuvers.length-1; i++ ) {
            //mark changes from UW to DW
            if ( maneuvers[i].board.charAt(0) != maneuvers[i+1].board.charAt(0) ) {
                //TODO: start and end here.
                var leg = {
                    leg: this.legs.length+2,
                    start: maneuvers[i+1].start
                };

                if ( this.legs.length > 0 && (leg.start - _.last(this.legs).start) < 60000 ) {
                    this.legs.pop(); //last leg is too short, remove it
                }

                this.legs.push(leg);
            }
        }


        var allTimeRange = [this.model.data[0].t, _.last(this.model.data).t];
        var x = d3.scale.linear()
            .range([0, width - 80])
            .domain(allTimeRange);

        var xAxis = d3.svg.axis()
            .scale(x)
            .orient("bottom")
            .tickSize(20)
            .tickValues(_.pluck(this.legs, 'start'))
            .tickFormat(function(d) { return moment(d).format("h:mm"); });



        var classes = function(d) {
            var c = ['board'];

            if ( d.board.charAt(0) == 'D' )
                c.push('downwind');

            if (d.board.charAt(2) == 'P') c.push('port');
            if (d.board.charAt(2) == 'S') c.push('starboard');

            return c.join(' ');
        }


        var brush = d3.svg.brush()
            .x(x)
            .extent([0, 0])
            .on("brush", brushed);

        var scrubSvg = d3.select(this.el).append("svg")
            .attr("width", width)
            .attr("height", 60)
            .attr("class", "scrubber")
        .append("g")
            .attr("transform", "translate(40, 10)");

        

        
        scrubSvg.append("g")
            .attr("class", "boards")
            .selectAll("rect.board")
                .data(maneuvers)
            .enter().append("rect")
                .attr('class', classes) 
                .attr("x", function(d) { return x(d.start); })
                .attr("width", function(d) { return x(d.end) - x(d.start); })
                .attr("y", 0)
                .attr("height", 10)
                // .attr("fill", function(d) { return d.color; });

        var axis = scrubSvg.append("g")
                .attr("class", "scrub axis")
                .attr("transform", "translate(0,-10)")
                .call(xAxis);

        scrubSvg.append('path')
            .attr('d', 'M0,-80 C60,0 50,50 35,80 L-35,80 C-50,50 -60,0 0, -80')
            .attr('class', 'boat')
            .attr('transform', 'scale(.12)');
                

        scrubSvg.on('mousemove', function(a,b,c,d) {
            var pos = d3.mouse(this);
            var time = x.invert(pos[0]);
            app.trigger('scrub', new Date(time), pos);
        });

        function brushed() {
            if (d3.event.sourceEvent) { // not a programmatic event
                if (d3.event.sourceEvent.target.parentNode === this) { // clicked on the brush
                    playButton.text("Play");
                    targetValue = x.invert(d3.mouse(this)[0]);
                    move();
                }
            } else {
                currentValue = brush.extent()[0];
                handle.attr("cx", x(currentValue));
                var i = Math.round(currentValue) + indexOffset;
                gate.classed("g-course-crossed", function(d) { return currentValue >= d.properties.time; });
                boat.attr("transform", function(d) { return "translate(" + projection(d.coordinates[i]) + ")"; });
                track.attr("d", function(d) { return path({type: "LineString", coordinates: d.coordinates.slice(0, i + 1)}); });
                trail.attr("d", function(d) { return path({type: "LineString", coordinates: d.coordinates.slice(Math.max(0, i - trailLength), i + 1)}); });
                wind.select(".g-speed").text(function(d) { return windFormat(d[i][3]) + " knots"; });
                compass.attr("transform", function(d) { return "rotate(" + (180 + d[i][4]) + ")"; });
            }
        }
    },
    onSelect: function(range) {

    },
    onScrub: function(x) {
       // this.boat.setTime(x / 1000 - this.model.view.offset);
    }
});



var variance = 0; 

var tackMapView = Backbone.View.extend({
    className: 'map',
    initialize: function(options) {
        this.events = options.events === false ? false: true;
        this.annotations = options.annotations === false ? false: true;
        this.circles = options.circles || null;
        this.references = options.references || null;

        this.margin = {top: 0, right: 0, bottom: 0, left: 0};
    },
    getProjection: function() {

    },
    render: function() {
        var view = this;
        
        var margin = this.margin;
        var width = this.$el.width() - margin.left - margin.right,
            height = this.$el.height() - margin.top - margin.bottom;

        width = width || 200;
        height = height || 200;

        // get extent of track, and make GEOJSON object
        var allTimeRange = d3.extent(this.model.data, function(d) { return d.t; });
        var lonExtent = d3.extent(this.model.data, function(d) { return d.lon; });
        var latExtent = d3.extent(this.model.data, function(d) { return d.lat; });

        var track = {type: "LineString", coordinates: _.compact( _.map(this.model.data, function(d) { return [d.lon, d.lat] }) ) };


        //create 'unit' projection
        var projection = d3.geo.mercator()
            .scale(1)
            .translate([0, 0]);

        var trackPath = d3.geo.path()
            .projection(projection)
            .pointRadius(3.5);

        //use unit projection to calculate scale factor for track
        var b = trackPath.bounds(track);
        var projectionScale = 1 / Math.max((b[1][0] - b[0][0]) / width, (b[1][1] - b[0][1]) / height);


        // make the TWD at the start "UP"
        // calculate bounding rect for current track rotated
        // and scale so it fits in current rect
        var angle = this.model.up || parseInt(refTws(this.model.data)) || 0;
        var refAngle = angle % 180;
        if (refAngle > 90 ) refAngle = 180 - refAngle;
        var t = refAngle * Math.PI / 180;

        var boundingX = (projectionScale * (b[1][0] - b[0][0]) * Math.cos(t) + projectionScale * (b[1][1] - b[0][1]) * Math.sin(t));
        var boundingY = (projectionScale * (b[1][0] - b[0][0]) * Math.sin(t) + projectionScale * (b[1][1] - b[0][1]) * Math.cos(t));

        var scale = 0.95 * Math.min( width/boundingX, height/boundingY );

        var projectionTranslation = [(width - projectionScale*scale * (b[1][0] + b[0][0])) / 2, (height - projectionScale*scale * (b[1][1] + b[0][1])) / 2];

        projection
            .scale(projectionScale*scale)
            .translate(projectionTranslation)


        // svg container
        var svg = this.svg = d3.select(this.el).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)

        // background
        svg.append("g")
          .append("rect")
            .attr("class", "water")
            .attr("height", height + margin.top + margin.bottom)
            .attr("width", width + margin.left + margin.right);


        // track
        var world = svg.append('g')
            .attr('class', 'world')        
            .attr('transform', function() { return "rotate(-"+angle+"," + (width / 2) + "," + (height / 2) + ")" })
        
          
        world.append('path')
            .attr('class', 'track')
            .attr('d', trackPath(track))

        // draw circles every 10 seconds, as tick marks on the track
        if ( this.circles ) {
            var circles = _.filter(this.model.data, function(m) { return (Math.round((m.t - view.circles)/1000) % 1) === 0 });    

            world.selectAll('circle.timing')
                .data(circles)
              .enter().append("circle")
                .attr('class', 'timing')
                .attr('r', '1.5')
                .attr('cx', function(d) { return projection([d.lon, d.lat])[0] })
                .attr('cy', function(d) { return projection([d.lon, d.lat])[1] })
                .style('stroke', function(d) { return (d.t - view.circles) === 0?'#f66':'#666'; });
        }

        function proj(φ1, λ1, hdg) {
            var d = 1;
            var R = 3440.06479;
            var brng = hdg * Math.PI / 180;
            φ1 = φ1 * Math.PI / 180;
            λ1 = λ1 * Math.PI / 180;
            var φ2 = Math.asin( Math.sin(φ1)*Math.cos(d/R) +
                    Math.cos(φ1)*Math.sin(d/R)*Math.cos(brng) );
            var λ2 = λ1 + Math.atan2(Math.sin(brng)*Math.sin(d/R)*Math.cos(φ1),
                         Math.cos(d/R)-Math.sin(φ1)*Math.sin(φ2));

            return [(λ2*180/Math.PI + 360) % 360, (φ2*180/Math.PI + 360) % 360];
        }

        if ( this.references ) {

            var lines = _.map(this.references, function(ref) {
                var start = proj(ref.lat, ref.lon, ref.hdg);
                var s = projection(start);
                var end = proj(ref.lat, ref.lon, ref.hdg+180);
                var e = projection(end);
                return s.concat(e);
            });

            world.selectAll('line.hdg')
                .data(lines)
                .enter().append('line')
                    .attr('class', 'hdg')
                    .attr({"x1": function(d) { return d[0]; }, "x2": function(d) { return d[2]; }, "y1": function(d) { return d[1]; }, "y2": function(d) { return d[3]; }})
                    .style('stroke', '#666')
                    .style('stroke-width', 0.25);

            world.selectAll('circle.timing2')
                .data(this.references)
            .enter().append("circle")
                .attr('class', 'timing')
                .attr('r', '3')
                .attr('cx', function(d) { return projection([d.lon, d.lat])[0] })
                .attr('cy', function(d) { return projection([d.lon, d.lat])[1] })
                .style('stroke', 'blue')
                .style('stroke-width', 1);
        }


        //create boat and put at start of race
        var start = projection(track.coordinates[0]);
        var hdg = view.model.data[0].hdg || 0;
        var boat = world.append('path')
            .attr('d', 'M0,-80 C60,0 50,50 35,80 L-35,80 C-50,50 -60,0 0, -80')
            .attr('class', 'boat')
            .attr('transform', 'translate('+start[0]+','+start[1]+')scale(.06)rotate('+(hdg)+',-10,-10)')

        if ( !this.events ) {
            return;
        }

        // //listen to app events
        this.listenTo(app, 'scrub', function(time) {
            var index = _.sortedIndex( view.model.data, {t: time}, function(point) { return point.t; } );
            var point = view.model.data[index];

            var coord = projection([point.lon, point.lat]);
            
            boat.attr('transform', 'translate('+(coord[0])+","+(coord[1]) +")scale(.06)rotate("+point.hdg+",-10,-10)")
        });

        this.listenTo(app, 'zoom', function(start, end) {
            // if ( start - allTimeRange[0] != 0 ) start -= 60000
            // if ( end - allTimeRange[1] != 0 ) end = 60000 + end.getTime() //can't add date and int, but can subtract...
            
            // var trackPart = {type: "LineString", coordinates: _.compact( _.map(this.model.data, function(d) { if(d.t >= start && d.t <= end) return [d.lon, d.lat] }) ) };
            
            // var center = trackPath.centroid(trackPart);
            // var partBounds = trackPath.bounds(trackPart);
            // var bounds = trackPath.bounds(track);

            // var scale = Math.max( Math.abs((bounds[1][0] - bounds[0][0])/(partBounds[1][0] - partBounds[0][0])), Math.abs((bounds[1][1] - bounds[0][1])/(partBounds[0][1] - partBounds[1][1])) );
            // console.info('scale', scale, (bounds[1][0] - bounds[0][0]), (partBounds[1][0] - partBounds[0][0]), (bounds[1][1] - bounds[0][1]), (partBounds[0][1] - partBounds[1][1]));

            // center[0] = (width/2 - center[0]) / scale;
            // center[1] = (height/2 - center[1]) / scale;
            // svg.selectAll('.world')
            //     .attr('transform', "rotate(-"+angle+"," + (width / 2) + "," + (height / 2) + ")translate("+center[0]+","+center[1]+")scale("+scale+")" )

            
        });
    },
    onSelect: function(range) {

    },
    onScrub: function(x) {
       // this.boat.setTime(x / 1000 - this.model.view.offset);
    }
});

