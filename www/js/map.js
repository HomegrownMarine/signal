
var variance = 0; 

var mapView = Backbone.View.extend({
    className: 'map',
    initialize: function(options) {
        this.events = options.events === false ? false: true;
        this.annotations = options.annotations === false ? false: true;
        this.circles = options.circles || null;
    },
    render: function() {
        var view = this;
        
        var margin = {top: 0, right: 0, bottom: 0, left: 0};
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
        var angle = parseInt(refTws(this.model.data)) || 0;
        var refAngle = angle % 180;
        if (refAngle > 90 ) refAngle = 180 - refAngle;
        var t = refAngle * Math.PI / 180;

        var boundingX = (projectionScale * (b[1][0] - b[0][0]) * Math.cos(t) + projectionScale * (b[1][1] - b[0][1]) * Math.sin(t));
        var boundingY = (projectionScale * (b[1][0] - b[0][0]) * Math.sin(t) + projectionScale * (b[1][1] - b[0][1]) * Math.cos(t));

        var scale = .95 * Math.min( width/boundingX, height/boundingY );

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
            .attr("height", height)
            .attr("width", width);

        
        if ( this.annotations ) {
            svg.append("g")
                .attr('class', 'annotations')

            // wind
            var wind = svg.select('g.annotations')
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
            var compass = svg.select('g.annotations')
                            .append('g')
                                .attr('transform', 'translate(50, 50)')
                            .append("g")
                                .attr("class", "compass")
                                .attr('transform', 'rotate(-'+angle+')');

            compass.append("circle")
                .attr("r", 10) 

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
        }

        // track
        var world = svg.append('g')
            .attr('class', 'world')        
            .attr('transform', function() { return "rotate(-"+angle+"," + (width / 2) + "," + (height / 2) + ")" })
        
          
        world.append('path')
            .attr('class', 'track')
            .attr('d', trackPath(track))

        if ( this.circles ) {
            var circles = _.filter(this.model.data, function(m) { return (Math.round((m.t - view.circles)/1000) % 10) == 0 });    

            world.selectAll('circle.timing')
                .data(circles)
              .enter().append("circle")
                .attr('class', 'timing')
                .attr('r', '3')
                .attr('cx', function(d) { return projection([d.lon, d.lat])[0] })
                .attr('cy', function(d) { return projection([d.lon, d.lat])[1] })
        }
        


        var labels = world.append('g')
            .attr('class', 'labels');
          
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
            for (var i = 0; i < 50; ++i) force.tick();
            force.stop();

            // console.info('links', _.map())

            // var anchorNode = vis.selectAll("g.anchorNode").data(force2.nodes()).enter().append("svg:g").attr("class", "anchorNode");
            
            // anchorNode.append("svg:circle").attr("r", 0).style("fill", "#FFF");
            //     anchorNode.append("svg:text").text(function(d, i) {
            //     return i % 2 == 0 ? "" : d.node.label
            // }).style("fill", "#555").style("font-family", "Arial").style("font-size", 12);

            labels.selectAll('text.tack-label')
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

            //TODO: smooth the TWD
            wind.attr('transform', 'rotate('+ (180-angle+point.twd) +')')
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
