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
            .tickFormat(function(d) { return parseInt(moment(view.tack.timing.center).diff(d)/-1000); })


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

        // var ta = line(view.data, 'targetAngle', null, null, wind[1]);
        // svg.append('path')
        //     .attr('class', 'targetAngle')
        //     .attr('fill', 'none')
        //     .attr('stroke', 'orange')
        //     .attr('d', ta[0]);

        // // console.info( _.compact(_.map( view.data, function(d) { if ('hdgDelta' in d) return d['hdgDelta'] } )) )

        // svg.append('line')
        //     .attr('class', 'timing center')
        //     .attr({"x1": 0, "x2": width, "y1": hd[1](0), "y2": hd[1](0)})
    }
});

var tackView = Backbone.Marionette.LayoutView.extend({
    className: 'tack-view',
    template: "#tackscreen",
    regions: {
        map: ".tackMap",
        graph: ".tackGraph"
    },
    templateHelpers: function() {
        var a = _.extend({}, {
            duration: (this.tack.timing.end - this.tack.timing.start)/1000,
            recovery: (this.tack.timing.recovered - this.tack.timing.end)/1000,
            press: Math.abs(this.tack.maxTwa - this.tack.recoveryTwa),
            through: (this.tack.recoveryHdg - this.tack.entryHdg)
        }, this.tack);

        a.loss = a.loss.toFixed(1);
        return a;
    },

    initialize: function(options) {
        this.tack = options.tack;

        _.each(this.tack.timing, function(time, key) {
            options.tack.timing[key] = moment(options.tack.timing[key]);
        });

        this.model = new Backbone.Model({'type':'popover'});           
    },

    onRender: function() {
        var view = this;
        
        //map
        var track = new mapView({model: {data:this.tack.data}, events: false, annotations: false, circles: this.tack.time});
        this.map.show(track);

        var graph = new tackGraphView(this.tack.data, this.tack);
        this.graph.show(graph);
    }
});

