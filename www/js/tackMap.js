var variance = 0; 

var tackMap = Backbone.View.extend({
    className: 'map',
    initialize: function(options, eventlistener) {
        this.events = options.events === false ? false: true;
        this.annotations = options.annotations === false ? false: true;
        this.circles = options.circles || null;
        this.references = options.references || null;

        this.margin = {top: 0, right: 0, bottom: 0, left: 0};

        this.eventlistener = eventlistener;
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
    //target wind angle reference lines serve to give tack path context
    renderTWARefs: function(svg, targetAngle, projection) {

        

        var rad = function rad(degrees) {
            return degrees * Math.PI / 180;
        };

        var references = [];
        _.each([90-targetAngle, -1*(90-targetAngle)], function(refAngle, i) {
            var reff = _.times(30, function(n) { 
                var start = [0, -480 + 80*n];

                var ytan = Math.tan(rad(refAngle)) * 400;
                var end = [start[0] + 400, start[1] - ytan];
                return start.concat(end);
            });

            references = references.concat(reff);
        });

        svg.selectAll('line.twa-ref')
            .data(references)
            .enter().append('line')
                .attr('class', 'twa-ref')
                .attr({"x1": function(d) { return d[0]; }, "x2": function(d) { return d[2]; }, "y1": function(d) { return d[1]; }, "y2": function(d) { return d[3]; }});
    },
    render: function() {
        var view = this;

        var mapAngle = this.model.up || parseInt(refTws(this.model.data)) || 0;
        var track = {type: "LineString", coordinates: _.compact( _.map(this.model.data, function(d) { return [d.lon, d.lat] }) ) };


        var margin = this.margin;
        var width = this.$el.width() - margin.left - margin.right,
            height = this.$el.height() - margin.top - margin.bottom;

        width = width || 400;
        height = height || 400;

        // get extent of track, and make GEOJSON object
        var allTimeRange = d3.extent(this.model.data, function(d) { return d.t; });
        var lonExtent = d3.extent(this.model.data, function(d) { return d.lon; });
        var latExtent = d3.extent(this.model.data, function(d) { return d.lat; });


        

        var res = this.getProjection(track, mapAngle, width, height);
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



        // rotated and scaled world container
        var world = svg.append('g')
            .attr('class', 'world')        
            .attr('transform', function() { return "rotate(-"+mapAngle+"," + (width / 2) + "," + (height / 2) + ")" })
        
        
        this.renderTWARefs(svg, tack.targetAngle, projection);
        
        
        //draw track
        world.append('path')
            .attr('class', 'track')
            .attr('d', trackPath(track))

        // draw circles every n seconds, as tick marks on the track
        var n = 1*1000;
        if ( this.circles ) {
            var circles = _.filter(this.model.data, function(m) { return (Math.round((m.t - view.circles)/n) % 1) === 0 });    

            world.selectAll('circle.timing')
                .data(circles)
              .enter().append("circle")
                .attr('class', 'timing')
                .attr('r', '1.5')
                .attr('cx', function(d) { return projection([d.lon, d.lat])[0] })
                .attr('cy', function(d) { return projection([d.lon, d.lat])[1] })
                .style('stroke', function(d) { return (d.t - view.circles) === 0?'#f66':'#666'; });
        }


        
        
        //create boat and put at start of race
        var start = projection(track.coordinates[0]);
        var hdg = view.model.data[0].hdg || 0;
        var boat = world.append('path')
            .attr('d', 'M0,-80 C60,0 50,50 35,80 L-35,80 C-50,50 -60,0 0, -80')
            .attr('class', 'boat')
            .attr('transform', 'translate('+start[0]+','+start[1]+')scale(.06)rotate('+(hdg)+',-10,-10)');


        // //listen to app events
        this.listenTo(this.eventlistener, 'scrub', function(time) {
            var index = _.sortedIndex( view.model.data, {t: time}, function(point) { return point.t; } );
            var point = view.model.data[index];

            //TODO: cleanup
            if ( !point ) 
                return;

            var coord = projection([point.lon, point.lat]);
            
            boat.attr('transform', 'translate('+(coord[0])+","+(coord[1]) +")scale(.06)rotate("+point.hdg+",-10,-10)");
        });

    },
    onSelect: function(range) {

    },
    onScrub: function(x) {
       // this.boat.setTime(x / 1000 - this.model.view.offset);
    }
});

