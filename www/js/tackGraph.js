var tackGraph = Backbone.View.extend({
tagName: 'div',
    className: "tackGraph",
    initialize: function(data, tack, type, eventlistener) {
        this.data = data;
        this.tack = tack;
        this.type = type;
        this.eventlistener = eventlistener;
    },
    render: function() {
        var view = this;
        
        var margin = {top: 15, right: 30, bottom: 5, left: 40};

        // if ( this.showX ) {
        //     margin.top = 30;
        // }
        this.$el.addClass(this.type);

        var width = this.$el.width() - margin.left - margin.right,
            height = this.$el.height() - margin.top - margin.bottom;

        var zoom = false;

        
        var x = this.x = d3.scale.linear()
            .range([0, width])
            .domain(d3.extent( view.data, function(d) { return d.t; } ) );

        var scale;
        if (this.type == 'speed') {
            var allExtents = _.map(['speed', 'targetSpeed', 'vmg'], function(metric) { return d3.extent( view.data, function(d) { return d[metric]; }); } );
            var extent = d3.extent(_.flatten(allExtents));

            scale = d3.scale.linear()
                .range([height, 0])
                .domain(extent);
        }

        if (this.type == 'wind') {
            scale = d3.scale.linear()
                .range([0, height])
                .domain([0, 60]);
        }

        
        console.info(x.domain());

        //axis
        var ticks = [];
        for ( var i = -20; i <= 120; i+=10 ) {
            ticks.push( moment(view.tack.timing.center).add(i, 'seconds') );
        }

        var xAxis = d3.svg.axis()
            .scale(x)
            .orient("top")
            .tickValues( ticks )
            .tickSize(3)
            .tickFormat(function(d) { return parseInt(moment(view.tack.timing.center).diff(d)/-1000) +' s'; });

        var yAxis = d3.svg.axis()
            .scale(scale)
            .orient("left")
            .tickSize(3);



        var svg = this.svg = d3.select(this.el).append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
          .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")")

        if ( this.type == 'wind' ) {
            svg.append("g")
                .attr("class", "x axis") 
                .call(xAxis);            

            yAxis
                .tickValues([0, tack.targetAngle, 60])
                .tickFormat(function(d) { if (d===0) return 'high'; else if (d==60) return 'low'; else return d.toFixed(0) });
        }
        else {
            yAxis
                .ticks(4)
                .tickFormat(function(d) { return d.toFixed(1); });
        }

        svg.append("g")         
            .attr("class", "grid")
            .call( d3.svg.axis()
                .scale(x)
                .orient("top")
                .tickValues( ticks )
                .tickSize(-height, 0, 0)
                .tickFormat("")
            )

        svg.append("g")
            .attr("class", "y axis")
            .call(yAxis)
            .append('text')
                .attr('class', 'caption')
                .attr("transform", "rotate(90)")
                .attr('x', 20)
                .attr('y', -1*(width+10))
                .attr('text-anchor', 'start')
                .text(this.type);


        function criticalPoint(point, scale, color, vertical) {
             var line = svg.append('line')
                .attr('class', 'timing center')
                .style('stroke', color);
                
            if ( vertical )
                line.attr({"x1": scale(point), "x2": scale(point), "y1": 0, "y2": height})
            else
                line.attr({"x1": 0, "x2": width, "y1": scale(point), "y2": scale(point)});

            return line;
        }

        function pathData(data, metric, scale) {
            var cleanData = _.compact(_.map( data, function(d) { if (metric in d) return [d.t, d[metric]] } ));

            var line = d3.svg.line()
                .interpolate("linear")
                .x(function(d) { return x(d[0]); })
                .y(function(d) { return scale(d[1]); });

            return line(cleanData);
        }

        function graph(metric, scale, color, width) {
            width = width || 1;

            return svg.append('path')
                .attr('class', 'tackLine')
                .attr('fill', 'none')
                .style('stroke', color)
                .style('stroke-width', width)
                .attr('d',  pathData(view.data, metric, scale));
        }

        //critical points
        criticalPoint( this.tack.timing.start, x, 'blue', true);
        criticalPoint( this.tack.timing.end, x, 'blue', true);
        criticalPoint( this.tack.timing.recovered, x, '#0a0', true);

        
        if ( this.type == "speed" ) {
            criticalPoint( this.tack.entryVmg, scale, 'blue', false);        

            //lines
            graph('speed', scale, 'rgb(153,153,255)', 0.5);
            graph('targetSpeed', scale, 'rgb(153,153,255)', 0.5).attr('stroke-dasharray', '4,1');
            graph('vmg', scale, 'blue', 1);
        }

        if ( this.type == "wind" ) {
            graph('atwa', scale, 'red', 1);
            graph('targetAngle', scale, 'red', 1).attr('stroke-dasharray', '4,1')
        }

        svg.on('mousemove', function(a,b,c,d) {
            var pos = d3.mouse(this);
            var time = x.invert(pos[0]);
            view.eventlistener.trigger('scrub', new Date(time), pos);
        });
    }
});