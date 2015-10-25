(function() {
    "use strict";

    var R = 3440.06479; //radius of earth in nautical miles

    var deg = function deg(radians) {
        return (radians*180/Math.PI + 360) % 360;
    };

    var rad = function rad(degrees) {
        return degrees * Math.PI / 180;
    };

    var lawOfCosines = function(a, b, gamma) {
        return Math.sqrt(a * a + b * b - 2 * b * a * Math.cos(rad(Math.abs(gamma))));
    };

    var calcs = {
        tws: function tws(speed, awa, aws) {
            //TODO: heel compensation
            return lawOfCosines(speed, aws, awa);
        },

        twa: function twa(speed, awa, tws) {
            var angle = deg(Math.asin(speed * Math.sin(rad(Math.abs(awa))) / tws)) + Math.abs(awa);
            if (awa < 0) angle *= -1;
            return angle;
        },

        gws: function gws(sog, awa, aws) {
            return lawOfCosines(sog, aws, awa);
        },

        gwd: function gwd(sog, cog, awa, gws) {
            var gwa = calcs.twa(sog, awa, gws);
            return (cog + gwa + 360) % 360;
        },

        vmg: function vmg(speed, twa) {
            return Math.abs(speed * Math.cos(rad(twa)));
        },

        twd: function twd(hdg, twa) {
            return (hdg + twa + 360) % 360;
        },

        //see: http://www.movable-type.co.uk/scripts/latlong.html
        distance: function distance(lat1, lon1, lat2, lon2) {
            lat1 = rad(lat1);
            lat2 = rad(lat2);
            lon1 = rad(lon1);
            lon2 = rad(lon2);

            var dLat = lat2-lat1,
                dLon = lon2-lon1;
            
            var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2) * Math.sin(dLon/2);
            var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

            return R * c;
        },

        bearing: function bearing(lat1, lon1, lat2, lon2) {
            lat1 = rad(lat1);
            lat2 = rad(lat2);
            lon1 = rad(lon1);
            lon2 = rad(lon2);
            
            var dLon = lon2-lon1;
            
            var y = Math.sin(dLon) * Math.cos(lat2);
            var x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
            
            return deg( Math.atan2(y, x) );
        },

        steer: function steer(from, to) {
            var diff = to - from;
            if ( diff > 180 ) {
                diff = 360 - diff;
            }
            else if ( diff < -180 ) {
                diff = 360 + diff;
            }

            return diff;
        },

        crossTrackError: function crossTrackError(fromLat, fromLon, lat, lon, toLat, toLan) {
            var d = distance(fromLat, fromLon, toLat, toLan);
            var b1 = bearing(fromLat, fromLon, toLat, toLan);
            var b2 = bearing(fromLat, fromLon, lat, lon);
            return Math.asin(Math.sin(d/R) * Math.sin(rad(b2-b1))) * R;
        },

        set: function set(speed, hdg, sog, cog) {
            //GM: TODO: understand 90 deg offset.
            //convert cog and hdg to radians, with north right
            hdg = rad(90.0 - hdg);
            cog = rad(90.0 - cog);

            //break out x and y components of current vector
            var current_x = sog * Math.cos(cog) - speed * Math.cos(hdg);
            var current_y = sog * Math.sin(cog) - speed * Math.sin(hdg);

            //set is the angle of the current vector (note we special case pure North or South)
            var _set = 0;
            if ( current_x === 0 ) {
                _set = current_y < 0? 180: 0;
            }
            else {
                //normalize 0 - 360
                _set = (90.0 - deg(Math.atan2(current_y, current_x)) + 360) % 360;
            }
            return _set;
        },

        drift: function drift(speed, hdg, sog, cog) {
            //GM: TODO: understand 90 deg offset.
            //convert cog and hdg to radians, with north right
            hdg = rad(90.0 - hdg);
            cog = rad(90.0 - cog);

            //break out x and y components of current vector
            var current_x = sog * Math.cos(cog) - speed * Math.cos(hdg);
            var current_y = sog * Math.sin(cog) - speed * Math.sin(hdg);

            //drift is the magnitude of the current vector
            var _drift = Math.sqrt(current_x * current_x + current_y * current_y);
            return _drift;
        },

        circularMean: function circularMean(dat) {
            var sinComp = 0, cosComp = 0;
            _.each(dat, function(angle) {
                sinComp += Math.sin(rad(angle));
                cosComp += Math.cos(rad(angle));
            });

            return (360+deg(Math.atan2(sinComp/dat.length, cosComp/dat.length)))%360;
        }
    };

    
    if (typeof exports != 'undefined') {
        exports.calcs = calcs;
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports = calcs;
    } else {
        if ( typeof homegrown == 'undefined' ) {
            window.homegrown = {};
        }
        homegrown.calculations = calcs;
    }
})();
;(function() {
    "use strict";
    var _;

    if ( typeof window != 'undefined' ) {
        _ = window._;
    }
    else if ( typeof require == 'function' ) {
        _ = require('lodash');
    }

    //from stack overflow
    var remove_comments_regex = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
    var argument_names_regex = /([^\s,]+)/g;
    function getParamNames(funct) {
      var fnStr = funct.toString().replace(remove_comments_regex, '');
      var result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(argument_names_regex);
      if ( result === null )
         result = [];
      return result;
    }

    var utilities = {
        /**
         * given a metric, will compute it's derivitive.
         * @param name - the name of the derivitive
         * @param metric - the name of the metric to calculate the derivitive from
         * @param [scaleFactor] - optional conversion factor, if the new metric should
         *                        be in different units.
         * @return 

         * Example: var acceleration = derivitive('acceleration', 'speed');
         * assert acceleration({'speed': 5, 't':1000}) == null //first execution
         * assert acceleration({'speed': 5, 't':1000}) == {'acceleration': 0}
         * assert acceleration({'speed': 6, 't':1000}) == {'acceleration': 1}
         */
        derivitive: function derivitive(name, metric, scaleFactor) {
            scaleFactor = scaleFactor || 1;
            var lastValue = null, lastTime;

            return function(args) {
                var result = null;

                if (metric in args) {
                    if (lastValue !== null) {
                        var delta = (args[metric] - lastValue) / ((args.t - lastTime)/1000) * scaleFactor;

                        result = {};
                        result[name] = delta;
                    }

                    lastValue = args[metric];
                    lastTime = args.t;
                }

                return result;
            };
        },
        average: function average(name, metric, size) {
            var rolling = 0;
            var counter = 0;
            var windowX = [];

            return function(args) {
                var result = null;

                if (metric in args) {
                    var pos = counter % size;
                    counter++;

                    if (windowX[pos]) {
                        rolling -= windowX[pos];
                    }
                    rolling += args[metric];
                    windowX[pos] = args[metric];

                    result = {};
                    result[name] = rolling / windowX.length;
                }

                return result;
            };
        },

        /**
         * Wraps function to allow it to handle streaming inputs.  
         * @param funct - the name of the function will be used to name the return value.  
         *                The name of the arguments will be used to pull the arguments out 
         *                of maps of possible arguments.
         * @return {object} - will return null if all of the arguments aren't avaible to execute the
         *                    function, or an object of the form: {function_name: result}.
         */
        delayedInputs: function delayedInputs(funct) {
            var argumentNames = getParamNames(funct);
            var runningArgs = [];

            return function(args) {
                // var presentValues = _.map(argumentNames, function(name) { return args[name]; });

                var allSet = true;
                for( var i=0; i < argumentNames.length; i++ ) {
                    if ( argumentNames[i] in args ) {
                        runningArgs[i] = args[argumentNames[i]];
                    }

                    if ( !runningArgs[i] ) {
                        allSet = false;
                    }
                }

                //if all 
                if (allSet) {
                    var result = funct.apply(this, runningArgs);
                    runningArgs = [];
                    var obj = {};
                    obj[funct.name] = result;
                    return obj;
                }

                return null;
            };
        },

        /*
            Pass in a data array, where each element has a time, t and a set of segments,
            each with a start and end time, and get back a new segment array, with each having
            a data array for points within the segments start and end time.
        */
        segmentData: function segmentData(data, segments) {
            var segs = _.clone(segments, true);
            _.each(segs, function(seg) {
                seg.data = [];
            });

            var j = 0;
            for ( var i=0; i < data.length; i++ ) {
                if ( data[i].t < segs[j].start ) {
                    continue;
                }
                else if ( data[i].t < segs[j].end ) {
                    segs[j].data.push(data[i]);
                }
                else {
                    j++;
                    if (j >= segs.length) 
                        break;
                    segs[j].data.push(data[i]);
                }
            }

            return segs;
        },

        summerizeData: function summerizeData(data, field, timeStep) {
            timeStep = timeStep || 10000; //default 10 seconds

            var segments = [];
            var sum=0, count=0;
            var startTime = data[0].t;
            
            for (var i=0; i < data.length; i++) {
                if (data[i].t > startTime + timeStep) {
                    var seg = {
                        start: startTime,
                        end: data[i].t
                    };
                    seg[field] = sum/count;
                    segments.push(seg);

                    sum = 0; count = 0;
                    startTime = data[i].t;
                }

                if ( field in data[i] ) {
                    sum += data[i][field];
                    count++;
                }
            }

            return segments;
        }
    };

    if (typeof exports != 'undefined') {
        exports.utilities = utilities;
    } else if (typeof module !== 'undefined' && module.exports) {
        module.exports.utilities = utilities;
    } else {
        if ( typeof homegrown == 'undefined' ) {
            window.homegrown = {};
        }
        homegrown.streamingUtilities = utilities;
    }
})();;(function() {
    "use strict";
    var _, moment, circularMean;

    if ( typeof window != 'undefined' ) {
        _ = window._;
        moment = window.moment;
        circularMean = homegrown.calculations.circularMean;
    }
    else if( typeof require == 'function' ) {
        _ = require('lodash');
        moment = require('moment');
        //circularMean = //TODO
    }

    //each of these functions takes a "tack" object, and 
    //a section of data around the tack and adds some specific
    //metric(s) to the tack
    var tackUtils = {
        findCenter: function findCenter(tack, data) {
            var centerIdx;

            for (var j=0; j < data.length; j++) {
                if ( tack.time.isSame(data[j].t) ) {
                    centerIdx = j-1;
                    break;
                }
            }

            tack.timing.center = centerIdx;
            tack.position = [data[centerIdx].lon, data[centerIdx].lat];
        },

        findStart: function findStart(tack, data) {
            //work backwards to start of tack
            var startIdx;
            for (var j=tack.timing.center-3; j >= 0; j--) {
                if ('rot' in data[j] ) {
                    if ( Math.abs(data[j].rot) < 2.5 ) {
                        startIdx = j;
                        break;
                    }                        
                }
            }

            //TODO, default not idx based...
            if ( startIdx )
                tack.timing.start = startIdx;
            else {
                tack.timing.start = 15;
                tack.notes.append('using default start');
            }
            tack.startPosition = [data[tack.timing.start].lon, data[tack.timing.start].lat];
        },

        calculateEntrySpeeds: function calculateEntrySpeeds(tack, tackData) {
            //then 5 seconds farther back to get starting vmg/speed
            //TODO: edge cases                
            var startTime = moment(tackData[tack.timing.start].t).subtract(6, 'seconds');
            var endTime = moment(tackData[tack.timing.start].t).subtract(2, 'seconds');
            var data = getSliceBetweenTimes(tackData, startTime, endTime);

            var speedSum = 0, vmgSum = 0;
            var speedCount = 0, vmgCount = 0;
            var twaSum=0, twaCount = 0;
            var hdgs = [];
            for (var j=0; j < data.length; j++) {
                if ( 'vmg' in data[j] ) {
                    vmgSum += data[j].vmg;
                    vmgCount++;
                }
                if ( 'speed' in data[j] ) {
                    speedSum += data[j].speed;
                    speedCount++;
                }
                if ( 'twa' in data[j] ) {
                    twaSum += data[j].twa;
                    twaCount++;
                }
                if ( 'hdg' in data[j] ) {
                    hdgs.push( data[j].hdg );
                }
            }

            tack.entryVmg = vmgSum / vmgCount;
            tack.entrySpeed = speedSum / speedCount;
            tack.entryTwa = twaSum / twaCount;
            tack.entryHdg = circularMean(hdgs);
        },

        findEnd: function findEnd(tack, data) {
            //then forwards to end of tack
            //using twa here, because it lags behind hdg and is
            //what vmg is calculated based on.
            var minIdx = tack.timing.center;
            
            var findMax = (tack.board == 'U-P')>0? true: false;
            findMax = !findMax;

            for (var j=tack.timing.center; j < tack.timing.center+12; j++) {
                if ('twa' in data[j] ) {
                    //if the center didn't have twa, then use the
                    //next available
                    if (!('twa' in data[minIdx])) {
                        minIdx = j;
                    }

                    if (findMax) {
                        if (data[j].twa > data[minIdx].twa) {
                            minIdx = j;
                        }    
                    }
                    else {
                        if (data[j].twa < data[minIdx].twa) {
                            minIdx = j;
                        }
                    }
                }
            }
            
            tack.timing.end = minIdx;
            tack.maxTwa = data[tack.timing.end].twa;
            tack.endPosition = [data[tack.timing.end].lon, data[tack.timing.end].lat];
        },

        findRecoveryTime: function findRecoveryTime(tack, data) {
            //then find recovery time
            for (var j=tack.timing.end+5; j < data.length; j++) {
                if ( 'vmg' in data[j] && tack.entryVmg <= data[j].vmg) {
                    tack.timing.recovered = j;
                    break;
                }
            }

            //TODO: find better fallback
            tack.timing.recovered = tack.timing.recovered || (tack.timing.center+30);
        },

        findRecoveryMetrics: function findRecoveryMetrics(tack, data) {
            //and find recovery speed and angles
            
            var twaSum=0, twaCount = 0;
            var hdgs = [];

            var maxIdx = Math.min(tack.timing.recovered+6, data.length);
            for (var j=tack.timing.recovered; j < maxIdx; j++) {
                if ( 'twa' in data[j] ) {
                    twaSum += data[j].twa;
                    twaCount++;
                }
                if ( 'hdg' in data[j] ) {
                    hdgs.push( data[j].hdg );
                }
            }

            tack.recoveryTwa = twaSum / twaCount;
            tack.recoveryHdg = circularMean(hdgs);
        },

        convertIndexesToTimes: function convertIndexesToTimes(tack, data) {
            tack.timing = _.mapValues(tack.timing, function(index) {
                return moment(data[index].t);
            });
        },

        calculateLoss: function calculateLoss(tack, data) {
            var lastTime = 0;
            var covered = 0;
            var recovered = tack.timing.recovered;
            
            _(data)
                .filter(function(m) { return m.t >= tack.timing.start && m.t <= recovered; } )
                .each(function(m) {
                    if ('vmg' in m) {
                        if ( lastTime ) {
                            covered += ((m.t - lastTime) / 1000) * m.vmg;
                        }
                        lastTime = m.t;                        
                    }
                });

            var ideal = tack.entryVmg * ((recovered - tack.timing.start) / 1000);
            tack.loss = - 6076.11549 / 3600.0 * (ideal - covered);
        },

        addClassificationStats: function addClassificationStats(tack, data) {
            var twsSum = 0, twsCount = 0;
            var twds = [];

            for (var j=0; j < tack.timing.start; j++) {
                if ( 'tws' in data[j] ) {
                    twsSum += data[j].tws;
                    twsCount++;
                }
                if ( 'twd' in data[j] ) {
                    twds.push(data[j].twd);
                }
            }

            tack.tws = twsSum / twsCount;
            tack.twd = circularMean(twds);
        }
    };

    /**
     * Gets a subset of the data, around the time specified.
     */
    function getSliceAroundTime(data, time, before, after) {
        var from = moment(time).subtract(before, 'seconds');
        var to = moment(time).add(after, 'seconds');

        return getSliceBetweenTimes(data, from, to);
    }

    /**
     * Gets a subset of the data, between the times specified
     */
    function getSliceBetweenTimes(data, from, to) {
        
        var fromIdx = _.sortedIndex(data, {t: from}, function(d) { return d.t; });
        var toIdx = _.sortedIndex(data, {t: to}, function(d) { return d.t; });            

        return data.slice(fromIdx, toIdx+1);
    }
     

    function findManeuvers(data) {
        var maneuvers = [];

        //fimd maneuvers
        var lastBoard = null;
        var lastBoardStart = data[0].t;
        for (var i = 0; i < data.length; i++) {
            if ( 'twa' in data[i] ) {
                var board = 'U-S';
                if (-90 <= data[i].twa && data[i].twa < 0)
                    board = 'U-P';
                else if (data[i].twa < -90)
                    board = 'D-P';
                else if (data[i].twa > 90)
                    board = 'D-S';

                if (data[i].ot < 300) {
                    board = "PS";
                }

                if (lastBoard != board) {
                    if ( lastBoard !== null ) {
                        maneuvers.push({
                            board: lastBoard,
                            start: lastBoardStart,
                            end: data[i].t
                        });
                    }
                    lastBoard = board;
                    lastBoardStart = data[i].t;
                }

            }
        }

        return maneuvers;
    }

    function analyzeTacks(maneuvers, data) {
        var tacks = [];

        //TODO: reverse order, so we can cap a maneuver at the beginning of the next tack (or turndown).
        //moment.max
        for (var i = 2; i < maneuvers.length; i++) {
            //TODO: gybes too
            if (maneuvers[i].board.charAt(0) == 'U' && maneuvers[i - 1].board.charAt(0) == 'U') {
                var centerTime = moment(maneuvers[i].start);

                if ( maneuvers[i-1].board == "PS" )
                    continue;

                if (i + 1 < maneuvers.length) {
                    var nextTime = moment(maneuvers[i + 1].start).subtract(45, 'seconds');
                    if (nextTime < centerTime)
                        continue;
                }

                var range = getSliceAroundTime(data, maneuvers[i].start, 30, 120);
                
                var tack = {
                    time: centerTime,
                    board: maneuvers[i].board,
                    timing: {},
                    notes: [],
                    data: getSliceAroundTime(data, maneuvers[i].start, 20, 40),
                    track: getSliceAroundTime(data, maneuvers[i].start, 15, 20),
                };
                
                //process tack, by running steps in this order.
                tackUtils.findCenter(tack, range);
                tackUtils.findStart(tack, range);
                tackUtils.calculateEntrySpeeds(tack, range);
                tackUtils.findEnd(tack, range);
                
                tackUtils.findRecoveryTime(tack, range);
                tackUtils.findRecoveryMetrics(tack, range);
                tackUtils.addClassificationStats(tack, range);

                tackUtils.convertIndexesToTimes(tack, range);
                tackUtils.calculateLoss(tack, range);

                tacks.push(tack);
                // break;
            }
        }

        return tacks;
    }

    var maneuverUtilities = {
        findManeuvers: findManeuvers,
        analyzeTacks: analyzeTacks,
        getSliceAroundTime: getSliceAroundTime,
        getSliceBetweenTimes: getSliceBetweenTimes
    };

    if (typeof exports != 'undefined') {
        exports.maneuvers = maneuverUtilities;
    } else if (typeof module != 'undefined' && module.exports) {
        module.exports.maneuvers = maneuverUtilities;
    } else {
        if ( typeof homegrown == 'undefined' ) {
            window.homegrown = {};
        }
        homegrown.maneuvers = maneuverUtilities;
    }
})();;//! polar-table.js
//! calculate polar targets based on tws.
//! version : 0.1
//! homegrownmarine.com



(function() {
    "use strict";

    var init = function(exports, _) {
        function PolarTable(allData, targets) {
            this.all = allData || {};
            this.targets = targets || {
                'up': {},
                'down': {}
            };
        }

        PolarTable.prototype.getInterpolatedValue = function(tws, key, upwind) {
            var appropriateTargets = this.targets[upwind ? 'up' : 'down'];
            var twspeeds = _.keys(appropriateTargets);

            var found = [0, 0];
            for (var i = 1; i < twspeeds.length; i++) {
                if (tws < twspeeds[i]) {
                    found[1] = twspeeds[i];
                    found[0] = twspeeds[i - 1];
                    break;
                }
            }

            var percentFirst = 1 - (tws - found[0]) / (found[1] - found[0]);
            var interpolatedValue = percentFirst * appropriateTargets[found[0]][key] + (1 - percentFirst) * appropriateTargets[found[1]][key];
            return interpolatedValue;
        };

        PolarTable.prototype.targetSpeed = function(tws, upwind) {
            return this.getInterpolatedValue(tws, 'speed', upwind);
        };

        PolarTable.prototype.targetAngle = function(tws, upwind) {
            return this.getInterpolatedValue(tws, 'twa', upwind);
        };

        PolarTable.prototype.targetHeel = function(tws, upwind) {
            return this.getInterpolatedValue(tws, 'heel', upwind);
        };

        exports.PolarTable = PolarTable;
        return PolarTable;
    };

    var localExports;
    if (typeof exports != 'undefined') {
        localExports = exports;
    } else if (typeof module !== 'undefined' && module.exports) {
        localExports = module.exports;
    } else {
        localExports = window;
    }


    var local_;
    if (typeof _ != 'undefined') {
        local_ = _;
    } else if (typeof require != 'undefined') {
        local_ = require('lodash');
    }

    var PolarTable = init(localExports, local_);

    // if require exists, assume we're running in node
    // and add filesystem based factory
    if (typeof require != 'undefined') {
        var fs = require('fs');
        var readline = require('readline');

        //creates polarTable from filename
        PolarTable.fromTSV = function(filename, callback) {

            var polars = new PolarTable();

            var rd = readline.createInterface({
                input: fs.createReadStream(filename),
                output: process.stdout,
                terminal: false
            });

            rd.on('line', function(line) {
                line = line.trim();
                if (line.length === 0 || line.indexOf('#') === 0) {
                    return;
                }

                // TWS TWA VMG Heel Lee
                var target = false;
                var upwind = true;

                // if the line ends in a *, it's a target
                // for this wind speed
                if (line.substring(line.length - 1) == '*') {
                    target = true;
                    line = line.substring(0, line.length - 1);
                }


                var cols = line.split(' '); //TODO: CSV
                var tws = +cols[0],
                    twa = +cols[1],
                    speed = +cols[2],
                    heel = +cols[3],
                    lee = +cols[4];


                upwind = twa < 90;
                if (!(tws in polars.all)) {
                    polars.all[tws] = {};
                }

                polars.all[tws][twa] = {
                    speed: speed,
                    heel: heel,
                    lee: lee
                };
                if (target) {
                    polars.targets[upwind ? 'up' : 'down'][tws] = {
                        twa: twa,
                        speed: speed,
                        heel: heel
                    };
                }
            });

            rd.on('close', function() {
                callback(polars);
            });
        };
    }
})();;var NM_TO_FT = 6076.11549;


function rad(deg) {
    return deg * Math.PI / 180;
}

function deg(rad) {
    return rad * 180 / Math.PI;
}

function select2(data, metric) {
    return _.compact(_.map(data, function(point) {
        if (metric in point) {
            return [point.t, point[metric]];
        } else {
            return null;
        }
    }));
}

function select3(data, metric) {
    return _.compact(_.map(data, function(point) {
        if (metric in point) {
            return _.pick(point, 't', metric);
        } else {
            return null;
        }
    }));
}

function simplify(data, size) {
    if (data.length < size * 3) {
        return data;
    }

    var out = [];
    var sum = 0;
    var count = 0;
    var index = 0;

    for (var i = 0; i < data.length; i++) {
        var targetIndex = parseInt(i * size / data.length);
        if (index != targetIndex) {
            out[index] = [data[i][0], sum / count];

            sum = 0;
            count = 0;
            index = targetIndex;
        }

        sum += data[i][1];
        count++;
    }

    return out;
}

function smooth(data, window) {

}

maneuvers = [];
var aws_offset = 1
var awa_offset = 0;

function refTws(dat, time) {
    var first10 = _.compact(_.pluck(dat.slice(0, 600), 'twd'));
    
    var sinComp = 0, cosComp = 0;
    _.each(first10, function(angle) {
        sinComp += Math.sin(rad(angle));
        cosComp += Math.cos(rad(angle));
    });

    return (360+deg(Math.atan2(sinComp/first10.length, cosComp/first10.length)))%360;
}

var g = 0;

function buildOutData(dat, offset, calibrate) {
    calibrate = (calibrate === false) ? false : true; //default to true

    var polars = window.polars = new PolarTable(mayhem_all, mayhem_targets);
    var calcs = homegrown.calculations;
    var delayedInputs = homegrown.streamingUtilities.delayedInputs;
    var derivitive = homegrown.streamingUtilities.derivitive;
    var average = homegrown.streamingUtilities.average;

    //each of these methods is applied to each stream of
    //data, and the results incorporated into the data.
    var xforms = [
        delayedInputs(calcs.tws),
        delayedInputs(calcs.twa),
        delayedInputs(calcs.twd),
        delayedInputs(calcs.gws),
        delayedInputs(calcs.gwd),
        delayedInputs(calcs.set),
        delayedInputs(calcs.drift),
        delayedInputs(calcs.vmg),
        delayedInputs(function targetSpeed(tws, twa) {
            return polars.targetSpeed(tws, Math.abs(twa) <= 90);
        }),
        delayedInputs(function targetAngle(tws, twa) {
            return polars.targetAngle(tws, Math.abs(twa) <= 90);
        }),
        delayedInputs(function targetHeel(tws, twa) {
            return polars.targetHeel(tws, Math.abs(twa) <= 90);
        }),
        delayedInputs(function targetVmg(targetSpeed, targetAngle, vmg) {
            return calcs.vmg(targetSpeed, targetAngle);
            // return (targetVmg / vmg) * 100;
        }),
        delayedInputs(function performance(targetVmg, vmg) {
            return (targetVmg / vmg) * 100;
        }),

        //TODO: smooth and filter wind vars
        //TODO: Fourier transform
        //TODO: rolling averages

        // average('tws_20', 'tws', 20),
        average('gws_20', 'gws', 5),

        // average('twd_20', 'twd', 20),
        average('gwd_20', 'gwd', 5),

        // average('set_20', 'set', 20),

        function abses(args) {
            if ('awa' in args) {
                args.aawa = Math.abs(args.awa);
            }
            if ('twa' in args) {
                args.atwa = Math.abs(args.twa);
            }
        },

        derivitive('acceleration', 'speed', (NM_TO_FT / 3600)),
        derivitive('rot', 'hdg')
    ];

    if ( calibrate ) {
        xforms.unshift( function calibrate(args) {
            if ( 'awa' in args ) {
                args.awa -= awa_offset;
                if (args.awa > 180) {
                    args.awa = -1 * (360 - args.awa);
                }
            }
            if ( 'aws' in args ) {
                args.aws *= aws_offset;
            }
        });
    }
    

    //calc missing pieces
    var last = new Date().getTime();


    for ( var i=0; i < dat.length; i++ ) {
        var pt = dat[i];
        if ('t' in pt) {
            pt.ot = pt.t;
            pt.t = pt.ot*1000 + offset;
        }

        // testing calibration approaches here
        if ( 'hdg' in pt) {
            pt.hdg = pt.hdg + 0;
        }

        if ( 'speed' in pt ) {
            pt.speed = pt.speed * 1.05;
        }
    
        for ( var x=0; x < xforms.length; x++ ) {
            var xform = xforms[x];

            var result = xform(pt);
            if (result) {
                for (var k in result) {
                    pt[k] = result[k];
                }
            }
        }
    }
    
    

    var maneuvers = homegrown.maneuvers.findManeuvers(dat);
    var tacks = homegrown.maneuvers.analyzeTacks(maneuvers, dat);

    return {
        maneuvers: maneuvers,
        tacks: tacks
    };
}

var mayhem_all = {"4":{"30":{"speed":2.483,"heel":2.4,"lee":4.1},"33":{"speed":2.788,"heel":2.7,"lee":3.58},"36":{"speed":3.069,"heel":2.9,"lee":3.2},"39":{"speed":3.327,"heel":3.1,"lee":2.9},"42":{"speed":3.563,"heel":3.3,"lee":2.67},"45":{"speed":3.776,"heel":3.4,"lee":2.48},"50":{"speed":4.091,"heel":3.6,"lee":2.22},"55":{"speed":4.351,"heel":3.8,"lee":2.01},"60":{"speed":4.56,"heel":3.8,"lee":1.83},"65":{"speed":4.72,"heel":3.7,"lee":1.68},"70":{"speed":4.833,"heel":3.6,"lee":1.55},"75":{"speed":4.898,"heel":3.5,"lee":1.43},"80":{"speed":4.928,"heel":3.2,"lee":1.31},"85":{"speed":4.914,"heel":2.9,"lee":1.21},"90":{"speed":4.978,"heel":3.8,"lee":1.35},"95":{"speed":5.048,"heel":3.6,"lee":1.28},"100":{"speed":5.083,"heel":3.6,"lee":1.22},"105":{"speed":5.064,"heel":3.4,"lee":1.14},"110":{"speed":4.999,"heel":3,"lee":1.06},"115":{"speed":4.875,"heel":2.6,"lee":0.96},"120":{"speed":4.714,"heel":2.9,"lee":1.08},"125":{"speed":4.564,"heel":2.6,"lee":0.99},"130":{"speed":4.356,"heel":2.1,"lee":0.89},"135":{"speed":4.095,"heel":1.6,"lee":0.78},"140":{"speed":3.814,"heel":1.2,"lee":0.66},"145":{"speed":3.532,"heel":0.8,"lee":0.53},"150":{"speed":3.253,"heel":0.5,"lee":0.4},"155":{"speed":2.976,"heel":0.3,"lee":0.28},"160":{"speed":2.703,"heel":0.2,"lee":0.19},"165":{"speed":2.499,"heel":0.1,"lee":0.14},"170":{"speed":2.365,"heel":0.1,"lee":0.09},"175":{"speed":2.265,"heel":0,"lee":0.04},"180":{"speed":2.18,"heel":0,"lee":0},"45.5":{"speed":3.809,"heel":3.5,"lee":2.45},"139.7":{"speed":3.83,"heel":1.2,"lee":0.66}},"5":{"30":{"speed":3.127,"heel":3.9,"lee":4.04},"33":{"speed":3.493,"heel":4.3,"lee":3.55},"36":{"speed":3.824,"heel":4.6,"lee":3.19},"39":{"speed":4.124,"heel":4.9,"lee":2.91},"42":{"speed":4.398,"heel":5.2,"lee":2.68},"45":{"speed":4.647,"heel":5.4,"lee":2.49},"50":{"speed":5.001,"heel":5.7,"lee":2.23},"55":{"speed":5.279,"heel":5.8,"lee":2.03},"60":{"speed":5.491,"heel":5.8,"lee":1.85},"65":{"speed":5.65,"heel":5.7,"lee":1.7},"70":{"speed":5.758,"heel":5.4,"lee":1.56},"75":{"speed":5.822,"heel":5,"lee":1.44},"80":{"speed":5.845,"heel":4.7,"lee":1.32},"85":{"speed":5.88,"heel":6.2,"lee":1.47},"90":{"speed":5.995,"heel":6.2,"lee":1.4},"95":{"speed":6.063,"heel":6,"lee":1.33},"100":{"speed":6.084,"heel":5.7,"lee":1.26},"105":{"speed":6.059,"heel":5,"lee":1.16},"110":{"speed":5.981,"heel":4.6,"lee":1.07},"115":{"speed":5.854,"heel":3.8,"lee":0.96},"120":{"speed":5.727,"heel":4.7,"lee":1.09},"125":{"speed":5.564,"heel":3.9,"lee":0.99},"130":{"speed":5.335,"heel":3.2,"lee":0.89},"135":{"speed":5.049,"heel":2.4,"lee":0.77},"140":{"speed":4.729,"heel":1.8,"lee":0.65},"145":{"speed":4.397,"heel":1.2,"lee":0.52},"150":{"speed":4.065,"heel":0.8,"lee":0.4},"155":{"speed":3.732,"heel":0.5,"lee":0.28},"160":{"speed":3.398,"heel":0.3,"lee":0.18},"165":{"speed":3.144,"heel":0.2,"lee":0.13},"170":{"speed":2.976,"heel":0.1,"lee":0.09},"175":{"speed":2.85,"heel":0,"lee":0.04},"180":{"speed":2.744,"heel":0,"lee":0},"44.6":{"speed":4.619,"heel":5.4,"lee":2.51},"140.9":{"speed":4.668,"heel":1.7,"lee":0.62}},"6":{"30":{"speed":3.722,"heel":5.7,"lee":4.08},"33":{"speed":4.135,"heel":6.2,"lee":3.6},"36":{"speed":4.51,"heel":6.8,"lee":3.24},"39":{"speed":4.846,"heel":7.2,"lee":2.96},"42":{"speed":5.141,"heel":7.6,"lee":2.73},"45":{"speed":5.396,"heel":7.9,"lee":2.55},"50":{"speed":5.749,"heel":8.2,"lee":2.3},"55":{"speed":6.012,"heel":8.2,"lee":2.09},"60":{"speed":6.2,"heel":8.1,"lee":1.92},"65":{"speed":6.327,"heel":7.8,"lee":1.77},"70":{"speed":6.408,"heel":7.3,"lee":1.63},"75":{"speed":6.452,"heel":6.8,"lee":1.49},"80":{"speed":6.495,"heel":8.9,"lee":1.67},"85":{"speed":6.617,"heel":9.1,"lee":1.62},"90":{"speed":6.697,"heel":9,"lee":1.55},"95":{"speed":6.736,"heel":8.5,"lee":1.46},"100":{"speed":6.738,"heel":7.8,"lee":1.35},"105":{"speed":6.702,"heel":7,"lee":1.23},"110":{"speed":6.635,"heel":6,"lee":1.1},"115":{"speed":6.576,"heel":7.3,"lee":1.27},"120":{"speed":6.488,"heel":6.5,"lee":1.15},"125":{"speed":6.344,"heel":5.5,"lee":1.02},"130":{"speed":6.139,"heel":4.4,"lee":0.89},"135":{"speed":5.87,"heel":3.5,"lee":0.77},"140":{"speed":5.555,"heel":2.5,"lee":0.64},"145":{"speed":5.209,"heel":1.8,"lee":0.52},"150":{"speed":4.843,"heel":1.2,"lee":0.39},"155":{"speed":4.461,"heel":0.7,"lee":0.28},"160":{"speed":4.074,"heel":0.4,"lee":0.18},"165":{"speed":3.777,"heel":0.2,"lee":0.13},"170":{"speed":3.579,"heel":0.1,"lee":0.09},"175":{"speed":3.43,"heel":0.1,"lee":0.04},"180":{"speed":3.304,"heel":0,"lee":0},"43.3":{"speed":5.253,"heel":7.7,"lee":2.65},"142.9":{"speed":5.356,"heel":2.1,"lee":0.57}},"7":{"30":{"speed":4.26,"heel":7.9,"lee":4.18},"33":{"speed":4.716,"heel":8.7,"lee":3.7},"36":{"speed":5.114,"heel":9.5,"lee":3.34},"39":{"speed":5.456,"heel":10.1,"lee":3.08},"42":{"speed":5.754,"heel":10.6,"lee":2.85},"45":{"speed":6.004,"heel":11,"lee":2.67},"50":{"speed":6.31,"heel":11.7,"lee":2.44},"55":{"speed":6.519,"heel":11.1,"lee":2.24},"60":{"speed":6.658,"heel":10.6,"lee":2.06},"65":{"speed":6.753,"heel":9.9,"lee":1.89},"70":{"speed":6.818,"heel":9.2,"lee":1.74},"75":{"speed":6.855,"heel":8.4,"lee":1.59},"80":{"speed":7.009,"heel":13.6,"lee":1.95},"85":{"speed":7.113,"heel":13.5,"lee":1.87},"90":{"speed":7.174,"heel":13.3,"lee":1.77},"95":{"speed":7.204,"heel":11.5,"lee":1.61},"100":{"speed":7.194,"heel":10.1,"lee":1.46},"105":{"speed":7.153,"heel":8.7,"lee":1.3},"110":{"speed":7.131,"heel":12.1,"lee":1.57},"115":{"speed":7.075,"heel":10.3,"lee":1.41},"120":{"speed":6.983,"heel":8.6,"lee":1.24},"125":{"speed":6.852,"heel":7.2,"lee":1.09},"130":{"speed":6.691,"heel":5.7,"lee":0.93},"135":{"speed":6.494,"heel":4.4,"lee":0.78},"140":{"speed":6.242,"heel":3.2,"lee":0.64},"145":{"speed":5.925,"heel":2.3,"lee":0.51},"150":{"speed":5.556,"heel":1.5,"lee":0.39},"155":{"speed":5.155,"heel":0.9,"lee":0.27},"160":{"speed":4.73,"heel":0.5,"lee":0.18},"165":{"speed":4.395,"heel":0.3,"lee":0.13},"170":{"speed":4.17,"heel":0.2,"lee":0.09},"175":{"speed":4,"heel":0.1,"lee":0.04},"180":{"speed":3.856,"heel":0,"lee":0},"42.1":{"speed":5.762,"heel":10.7,"lee":2.85},"145.6":{"speed":5.881,"heel":2.2,"lee":0.5}},"8":{"30":{"speed":4.746,"heel":10.9,"lee":4.36},"33":{"speed":5.233,"heel":12.2,"lee":3.87},"36":{"speed":5.638,"heel":13.4,"lee":3.54},"39":{"speed":5.973,"heel":14.5,"lee":3.28},"42":{"speed":6.24,"heel":15.3,"lee":3.09},"45":{"speed":6.444,"heel":15.6,"lee":2.93},"50":{"speed":6.686,"heel":15.7,"lee":2.69},"55":{"speed":6.862,"heel":14.9,"lee":2.46},"60":{"speed":6.992,"heel":13.9,"lee":2.25},"65":{"speed":7.083,"heel":13.3,"lee":2.06},"70":{"speed":7.15,"heel":11.6,"lee":1.87},"75":{"speed":7.186,"heel":10.4,"lee":1.7},"80":{"speed":7.256,"heel":15,"lee":1.98},"85":{"speed":7.371,"heel":15,"lee":1.9},"90":{"speed":7.474,"heel":15,"lee":1.81},"95":{"speed":7.566,"heel":15,"lee":1.75},"100":{"speed":7.58,"heel":13,"lee":1.57},"105":{"speed":7.54,"heel":10.8,"lee":1.38},"110":{"speed":7.473,"heel":9,"lee":1.21},"115":{"speed":7.482,"heel":14.2,"lee":1.56},"120":{"speed":7.396,"heel":11.1,"lee":1.34},"125":{"speed":7.272,"heel":8.8,"lee":1.15},"130":{"speed":7.12,"heel":7,"lee":0.98},"135":{"speed":6.941,"heel":5.4,"lee":0.82},"140":{"speed":6.734,"heel":4,"lee":0.66},"145":{"speed":6.488,"heel":2.9,"lee":0.52},"150":{"speed":6.177,"heel":1.9,"lee":0.39},"155":{"speed":5.786,"heel":1.2,"lee":0.27},"160":{"speed":5.349,"heel":0.6,"lee":0.18},"165":{"speed":4.997,"heel":0.4,"lee":0.13},"170":{"speed":4.75,"heel":0.2,"lee":0.09},"175":{"speed":4.559,"heel":0.1,"lee":0.04},"180":{"speed":4.398,"heel":0,"lee":0},"40.4":{"speed":6.104,"heel":14.8,"lee":3.19},"148.9":{"speed":6.253,"heel":2.1,"lee":0.42}},"9":{"30":{"speed":5.175,"heel":15.3,"lee":4.66},"33":{"speed":5.643,"heel":17.8,"lee":4.26},"36":{"speed":6.017,"heel":19.3,"lee":3.96},"39":{"speed":6.312,"heel":20.7,"lee":3.75},"42":{"speed":6.53,"heel":21.2,"lee":3.56},"45":{"speed":6.701,"heel":21.5,"lee":3.39},"50":{"speed":6.928,"heel":20.9,"lee":3.09},"55":{"speed":7.108,"heel":20,"lee":2.81},"60":{"speed":7.251,"heel":18.3,"lee":2.52},"65":{"speed":7.36,"heel":16.6,"lee":2.26},"70":{"speed":7.437,"heel":14.6,"lee":2.03},"75":{"speed":7.481,"heel":12.9,"lee":1.83},"80":{"speed":7.494,"heel":11.6,"lee":1.65},"85":{"speed":7.548,"heel":15,"lee":1.88},"90":{"speed":7.66,"heel":15,"lee":1.8},"95":{"speed":7.764,"heel":15,"lee":1.71},"100":{"speed":7.86,"heel":15,"lee":1.62},"105":{"speed":7.899,"heel":13.5,"lee":1.47},"110":{"speed":7.834,"heel":11,"lee":1.27},"115":{"speed":7.736,"heel":8.8,"lee":1.1},"120":{"speed":7.763,"heel":14.9,"lee":1.48},"125":{"speed":7.653,"heel":11.1,"lee":1.23},"130":{"speed":7.509,"heel":8.5,"lee":1.03},"135":{"speed":7.336,"heel":6.6,"lee":0.85},"140":{"speed":7.136,"heel":4.9,"lee":0.69},"145":{"speed":6.908,"heel":3.4,"lee":0.54},"150":{"speed":6.646,"heel":2.3,"lee":0.4},"155":{"speed":6.322,"heel":1.4,"lee":0.27},"160":{"speed":5.917,"heel":0.8,"lee":0.18},"165":{"speed":5.564,"heel":0.5,"lee":0.13},"170":{"speed":5.306,"heel":0.3,"lee":0.09},"175":{"speed":5.104,"heel":0.1,"lee":0.04},"180":{"speed":4.929,"heel":0,"lee":0},"38.6":{"speed":6.28,"heel":20.5,"lee":3.77},"151.8":{"speed":6.541,"heel":2,"lee":0.35}},"10":{"30":{"speed":5.479,"heel":19.5,"lee":4.86},"33":{"speed":5.919,"heel":21.2,"lee":4.4},"36":{"speed":6.259,"heel":22.3,"lee":4.08},"39":{"speed":6.506,"heel":22.6,"lee":3.85},"42":{"speed":6.697,"heel":23.5,"lee":3.67},"45":{"speed":6.855,"heel":23.6,"lee":3.54},"50":{"speed":7.078,"heel":24,"lee":3.35},"55":{"speed":7.269,"heel":24.3,"lee":3.18},"60":{"speed":7.436,"heel":23,"lee":2.9},"65":{"speed":7.569,"heel":20.9,"lee":2.56},"70":{"speed":7.668,"heel":18.6,"lee":2.26},"75":{"speed":7.735,"heel":16.1,"lee":1.99},"80":{"speed":7.768,"heel":13.7,"lee":1.76},"85":{"speed":7.767,"heel":11.7,"lee":1.57},"90":{"speed":7.829,"heel":15,"lee":1.78},"95":{"speed":7.948,"heel":15,"lee":1.69},"100":{"speed":8.062,"heel":15,"lee":1.58},"105":{"speed":8.171,"heel":15,"lee":1.48},"110":{"speed":8.218,"heel":13.6,"lee":1.34},"115":{"speed":8.108,"heel":10.7,"lee":1.15},"120":{"speed":7.99,"heel":15,"lee":1.45},"125":{"speed":8.029,"heel":14.2,"lee":1.33},"130":{"speed":7.88,"heel":10.4,"lee":1.09},"135":{"speed":7.702,"heel":7.8,"lee":0.89},"140":{"speed":7.504,"heel":5.8,"lee":0.72},"145":{"speed":7.279,"heel":4.1,"lee":0.55},"150":{"speed":7.023,"heel":2.7,"lee":0.41},"155":{"speed":6.73,"heel":1.7,"lee":0.28},"160":{"speed":6.398,"heel":1,"lee":0.19},"165":{"speed":6.085,"heel":0.6,"lee":0.13},"170":{"speed":5.83,"heel":0.4,"lee":0.09},"175":{"speed":5.62,"heel":0.2,"lee":0.04},"180":{"speed":5.436,"heel":0,"lee":0},"37.2":{"speed":6.369,"heel":22.6,"lee":3.97},"153.3":{"speed":6.835,"heel":2,"lee":0.32}},"11":{"30":{"speed":5.708,"heel":22.4,"lee":4.91},"33":{"speed":6.121,"heel":23.2,"lee":4.44},"36":{"speed":6.419,"heel":25.1,"lee":4.31},"39":{"speed":6.641,"heel":24.4,"lee":3.86},"42":{"speed":6.818,"heel":24.6,"lee":3.71},"45":{"speed":6.971,"heel":24.7,"lee":3.59},"50":{"speed":7.19,"heel":25.1,"lee":3.41},"55":{"speed":7.374,"heel":27.3,"lee":3.46},"60":{"speed":7.55,"heel":24.5,"lee":3.01},"65":{"speed":7.708,"heel":24.9,"lee":2.92},"70":{"speed":7.849,"heel":22.9,"lee":2.56},"75":{"speed":7.956,"heel":20,"lee":2.21},"80":{"speed":8.024,"heel":17.1,"lee":1.91},"85":{"speed":8.049,"heel":14.2,"lee":1.67},"90":{"speed":8.028,"heel":12,"lee":1.47},"95":{"speed":8.127,"heel":15,"lee":1.65},"100":{"speed":8.262,"heel":15,"lee":1.54},"105":{"speed":8.389,"heel":15,"lee":1.44},"110":{"speed":8.506,"heel":15,"lee":1.34},"115":{"speed":8.522,"heel":13.1,"lee":1.19},"120":{"speed":8.361,"heel":9.9,"lee":1.01},"125":{"speed":8.294,"heel":15,"lee":1.31},"130":{"speed":8.287,"heel":12.9,"lee":1.15},"135":{"speed":8.08,"heel":9.6,"lee":0.93},"140":{"speed":7.857,"heel":6.8,"lee":0.74},"145":{"speed":7.623,"heel":4.7,"lee":0.57},"150":{"speed":7.367,"heel":3.1,"lee":0.42},"155":{"speed":7.076,"heel":1.9,"lee":0.29},"160":{"speed":6.778,"heel":1.2,"lee":0.2},"165":{"speed":6.522,"heel":0.8,"lee":0.14},"170":{"speed":6.298,"heel":0.5,"lee":0.09},"175":{"speed":6.1,"heel":0.2,"lee":0.04},"180":{"speed":5.916,"heel":0,"lee":0},"36.2":{"speed":6.443,"heel":23.7,"lee":4.08},"154.2":{"speed":7.126,"heel":2.1,"lee":0.31}},"12":{"30":{"speed":5.884,"heel":23.5,"lee":4.91},"33":{"speed":6.266,"heel":24.6,"lee":4.46},"36":{"speed":6.538,"heel":24.9,"lee":4.16},"39":{"speed":6.743,"heel":25,"lee":3.95},"42":{"speed":6.911,"heel":25.7,"lee":3.85},"45":{"speed":7.059,"heel":25.9,"lee":3.65},"50":{"speed":7.274,"heel":26.1,"lee":3.43},"55":{"speed":7.466,"heel":26.8,"lee":3.37},"60":{"speed":7.638,"heel":25.3,"lee":3.03},"65":{"speed":7.806,"heel":25.3,"lee":2.93},"70":{"speed":7.972,"heel":25.7,"lee":2.8},"75":{"speed":8.136,"heel":24.5,"lee":2.52},"80":{"speed":8.262,"heel":21,"lee":2.12},"85":{"speed":8.331,"heel":17.5,"lee":1.8},"90":{"speed":8.341,"heel":14.2,"lee":1.54},"95":{"speed":8.302,"heel":15,"lee":1.62},"100":{"speed":8.454,"heel":15,"lee":1.51},"105":{"speed":8.596,"heel":15,"lee":1.4},"110":{"speed":8.729,"heel":15,"lee":1.3},"115":{"speed":8.852,"heel":15,"lee":1.2},"120":{"speed":8.785,"heel":11.9,"lee":1.04},"125":{"speed":8.562,"heel":9,"lee":0.87},"130":{"speed":8.627,"heel":15,"lee":1.17},"135":{"speed":8.505,"heel":11.7,"lee":0.97},"140":{"speed":8.245,"heel":7.9,"lee":0.76},"145":{"speed":7.966,"heel":5.5,"lee":0.59},"150":{"speed":7.687,"heel":3.6,"lee":0.43},"155":{"speed":7.398,"heel":2.2,"lee":0.3},"160":{"speed":7.115,"heel":1.5,"lee":0.22},"165":{"speed":6.88,"heel":1,"lee":0.15},"170":{"speed":6.683,"heel":0.6,"lee":0.1},"175":{"speed":6.51,"heel":0.3,"lee":0.05},"180":{"speed":6.343,"heel":0,"lee":0},"35.7":{"speed":6.508,"heel":25.1,"lee":4.29},"155.4":{"speed":7.371,"heel":2.2,"lee":0.29}},"13":{"30":{"speed":6.013,"heel":24.9,"lee":4.97},"33":{"speed":6.371,"heel":25.6,"lee":4.52},"36":{"speed":6.623,"heel":25.9,"lee":4.22},"39":{"speed":6.818,"heel":25.6,"lee":3.95},"42":{"speed":6.982,"heel":26.2,"lee":3.82},"45":{"speed":7.128,"heel":26.3,"lee":3.7},"50":{"speed":7.344,"heel":26.3,"lee":3.49},"55":{"speed":7.537,"heel":25.7,"lee":3.26},"60":{"speed":7.718,"heel":25.6,"lee":3.13},"65":{"speed":7.896,"heel":25.8,"lee":2.98},"70":{"speed":8.077,"heel":25.7,"lee":2.79},"75":{"speed":8.26,"heel":25.9,"lee":2.61},"80":{"speed":8.441,"heel":25.6,"lee":2.41},"85":{"speed":8.579,"heel":21.3,"lee":1.98},"90":{"speed":8.639,"heel":17.6,"lee":1.65},"95":{"speed":8.625,"heel":13.9,"lee":1.4},"100":{"speed":8.634,"heel":15,"lee":1.48},"105":{"speed":8.793,"heel":15,"lee":1.37},"110":{"speed":8.949,"heel":15,"lee":1.26},"115":{"speed":9.102,"heel":15,"lee":1.16},"120":{"speed":9.249,"heel":15,"lee":1.06},"125":{"speed":9.002,"heel":10.6,"lee":0.89},"130":{"speed":8.883,"heel":15,"lee":1.12},"135":{"speed":8.955,"heel":14,"lee":0.99},"140":{"speed":8.667,"heel":9,"lee":0.78},"145":{"speed":8.35,"heel":6.3,"lee":0.6},"150":{"speed":8.016,"heel":4.1,"lee":0.44},"155":{"speed":7.702,"heel":2.6,"lee":0.32},"160":{"speed":7.43,"heel":1.7,"lee":0.23},"165":{"speed":7.207,"heel":1.2,"lee":0.17},"170":{"speed":7.017,"heel":0.7,"lee":0.11},"175":{"speed":6.852,"heel":0.3,"lee":0.05},"180":{"speed":6.698,"heel":0,"lee":0},"34.9":{"speed":6.536,"heel":26.1,"lee":4.36},"157.5":{"speed":7.559,"heel":2.1,"lee":0.27}},"14":{"30":{"speed":6.108,"heel":25.7,"lee":4.96},"33":{"speed":6.445,"heel":25.2,"lee":4.45},"36":{"speed":6.686,"heel":26.8,"lee":4.34},"39":{"speed":6.874,"heel":26.7,"lee":4.06},"42":{"speed":7.035,"heel":26.8,"lee":3.9},"45":{"speed":7.18,"heel":26.6,"lee":3.75},"50":{"speed":7.399,"heel":26.7,"lee":3.56},"55":{"speed":7.598,"heel":25.5,"lee":3.29},"60":{"speed":7.788,"heel":25.6,"lee":3.15},"65":{"speed":7.979,"heel":25.4,"lee":2.97},"70":{"speed":8.176,"heel":25.9,"lee":2.8},"75":{"speed":8.373,"heel":24.8,"lee":2.51},"80":{"speed":8.568,"heel":25.9,"lee":2.41},"85":{"speed":8.757,"heel":26,"lee":2.24},"90":{"speed":8.907,"heel":21.4,"lee":1.8},"95":{"speed":8.952,"heel":16.9,"lee":1.47},"100":{"speed":8.891,"heel":13.1,"lee":1.24},"105":{"speed":8.99,"heel":15,"lee":1.33},"110":{"speed":9.179,"heel":15,"lee":1.22},"115":{"speed":9.366,"heel":15,"lee":1.11},"120":{"speed":9.542,"heel":15,"lee":1.01},"125":{"speed":9.544,"heel":14.1,"lee":0.9},"130":{"speed":9.177,"heel":9.2,"lee":0.75},"135":{"speed":9.31,"heel":15,"lee":0.96},"140":{"speed":9.14,"heel":10.7,"lee":0.78},"145":{"speed":8.758,"heel":7.3,"lee":0.6},"150":{"speed":8.382,"heel":4.6,"lee":0.45},"155":{"speed":8.018,"heel":3,"lee":0.33},"160":{"speed":7.731,"heel":2,"lee":0.25},"165":{"speed":7.513,"heel":1.4,"lee":0.18},"170":{"speed":7.328,"heel":0.8,"lee":0.11},"175":{"speed":7.164,"heel":0.4,"lee":0.05},"180":{"speed":7.012,"heel":0,"lee":0},"34.5":{"speed":6.576,"heel":26.8,"lee":4.46},"153.2":{"speed":8.143,"heel":3.5,"lee":0.37}},"15":{"30":{"speed":6.177,"heel":25.7,"lee":4.94},"33":{"speed":6.499,"heel":27.1,"lee":4.66},"36":{"speed":6.73,"heel":27.5,"lee":4.39},"39":{"speed":6.913,"heel":27.2,"lee":4.12},"42":{"speed":7.075,"heel":27.1,"lee":3.94},"45":{"speed":7.223,"heel":26.9,"lee":3.81},"50":{"speed":7.448,"heel":26,"lee":3.54},"55":{"speed":7.653,"heel":25.7,"lee":3.35},"60":{"speed":7.852,"heel":25.7,"lee":3.16},"65":{"speed":8.057,"heel":25.8,"lee":3.02},"70":{"speed":8.269,"heel":26,"lee":2.81},"75":{"speed":8.48,"heel":25.9,"lee":2.59},"80":{"speed":8.686,"heel":25.9,"lee":2.39},"85":{"speed":8.895,"heel":26.2,"lee":2.22},"90":{"speed":9.126,"heel":26.1,"lee":2.02},"95":{"speed":9.295,"heel":20.7,"lee":1.58},"100":{"speed":9.294,"heel":15.7,"lee":1.28},"105":{"speed":9.194,"heel":15,"lee":1.29},"110":{"speed":9.417,"heel":15,"lee":1.17},"115":{"speed":9.632,"heel":15,"lee":1.06},"120":{"speed":9.833,"heel":15,"lee":0.96},"125":{"speed":10.01,"heel":15,"lee":0.86},"130":{"speed":9.756,"heel":11,"lee":0.74},"135":{"speed":9.634,"heel":15,"lee":0.91},"140":{"speed":9.714,"heel":13.3,"lee":0.77},"145":{"speed":9.232,"heel":8.4,"lee":0.6},"150":{"speed":8.767,"heel":5.3,"lee":0.45},"155":{"speed":8.368,"heel":3.5,"lee":0.34},"160":{"speed":8.046,"heel":2.4,"lee":0.26},"165":{"speed":7.81,"heel":1.6,"lee":0.19},"170":{"speed":7.622,"heel":1,"lee":0.12},"175":{"speed":7.458,"heel":0.4,"lee":0.06},"180":{"speed":7.305,"heel":0,"lee":0},"33.8":{"speed":6.567,"heel":27.3,"lee":4.6},"151.4":{"speed":8.652,"heel":4.7,"lee":0.42}},"16":{"30":{"speed":6.224,"heel":27.5,"lee":5.22},"33":{"speed":6.534,"heel":27.7,"lee":4.74},"36":{"speed":6.759,"heel":27.5,"lee":4.42},"39":{"speed":6.943,"heel":27.8,"lee":4.25},"42":{"speed":7.109,"heel":26.6,"lee":3.97},"45":{"speed":7.26,"heel":26.8,"lee":3.86},"50":{"speed":7.489,"heel":26.1,"lee":3.63},"55":{"speed":7.701,"heel":25.8,"lee":3.4},"60":{"speed":7.911,"heel":25.9,"lee":3.23},"65":{"speed":8.129,"heel":25.9,"lee":3.03},"70":{"speed":8.354,"heel":26,"lee":2.81},"75":{"speed":8.577,"heel":25.9,"lee":2.58},"80":{"speed":8.798,"heel":26.1,"lee":2.39},"85":{"speed":9.035,"heel":26.3,"lee":2.2},"90":{"speed":9.303,"heel":26.5,"lee":2},"95":{"speed":9.583,"heel":26,"lee":1.77},"100":{"speed":9.715,"heel":19.5,"lee":1.34},"105":{"speed":9.623,"heel":14.2,"lee":1.09},"110":{"speed":9.651,"heel":15,"lee":1.13},"115":{"speed":9.893,"heel":15,"lee":1.01},"120":{"speed":10.125,"heel":15,"lee":0.91},"125":{"speed":10.331,"heel":15,"lee":0.82},"130":{"speed":10.409,"heel":13.7,"lee":0.72},"135":{"speed":9.961,"heel":15,"lee":0.85},"140":{"speed":10.186,"heel":15,"lee":0.74},"145":{"speed":9.798,"heel":9.9,"lee":0.58},"150":{"speed":9.215,"heel":6,"lee":0.45},"155":{"speed":8.736,"heel":4,"lee":0.35},"160":{"speed":8.391,"heel":2.8,"lee":0.27},"165":{"speed":8.125,"heel":1.9,"lee":0.2},"170":{"speed":7.914,"heel":1.1,"lee":0.13},"175":{"speed":7.737,"heel":0.6,"lee":0.07},"180":{"speed":7.582,"heel":0,"lee":0},"34.1":{"speed":6.624,"heel":28.2,"lee":4.69},"145.4":{"speed":9.757,"heel":9.5,"lee":0.57}},"17":{"30":{"speed":6.248,"heel":29,"lee":5.5},"33":{"speed":6.554,"heel":27.9,"lee":4.81},"36":{"speed":6.779,"heel":27.3,"lee":4.45},"39":{"speed":6.967,"heel":27.4,"lee":4.34},"42":{"speed":7.135,"heel":26,"lee":3.99},"45":{"speed":7.29,"heel":26.2,"lee":3.87},"50":{"speed":7.524,"heel":26.1,"lee":3.7},"55":{"speed":7.736,"heel":25,"lee":3.41},"60":{"speed":7.962,"heel":26,"lee":3.3},"65":{"speed":8.194,"heel":25.8,"lee":3.04},"70":{"speed":8.432,"heel":25.9,"lee":2.8},"75":{"speed":8.666,"heel":25.9,"lee":2.57},"80":{"speed":8.906,"heel":26.3,"lee":2.39},"85":{"speed":9.176,"heel":26.5,"lee":2.18},"90":{"speed":9.478,"heel":26.6,"lee":1.96},"95":{"speed":9.785,"heel":26.9,"lee":1.77},"100":{"speed":10.079,"heel":24.5,"lee":1.46},"105":{"speed":10.115,"heel":17.4,"lee":1.11},"110":{"speed":9.887,"heel":12.5,"lee":0.92},"115":{"speed":10.153,"heel":15,"lee":0.97},"120":{"speed":10.416,"heel":15,"lee":0.86},"125":{"speed":10.647,"heel":15,"lee":0.77},"130":{"speed":10.861,"heel":15,"lee":0.69},"135":{"speed":10.535,"heel":10.9,"lee":0.59},"140":{"speed":10.556,"heel":15,"lee":0.69},"145":{"speed":10.438,"heel":11.2,"lee":0.56},"150":{"speed":9.747,"heel":6.9,"lee":0.43},"155":{"speed":9.153,"heel":4.5,"lee":0.35},"160":{"speed":8.75,"heel":3.2,"lee":0.28},"165":{"speed":8.465,"heel":2.2,"lee":0.2},"170":{"speed":8.23,"heel":1.3,"lee":0.13},"175":{"speed":8.03,"heel":0.6,"lee":0.06},"180":{"speed":7.855,"heel":0,"lee":0},"33.8":{"speed":6.621,"heel":27.8,"lee":4.67},"144.4":{"speed":10.516,"heel":12,"lee":0.57}},"18":{"30":{"speed":6.258,"heel":28.3,"lee":5.42},"33":{"speed":6.566,"heel":28,"lee":4.94},"36":{"speed":6.793,"heel":27.1,"lee":4.53},"39":{"speed":6.984,"heel":26.6,"lee":4.29},"42":{"speed":7.156,"heel":26.7,"lee":4.16},"45":{"speed":7.313,"heel":26.1,"lee":3.96},"50":{"speed":7.552,"heel":25.9,"lee":3.72},"55":{"speed":7.779,"heel":25.7,"lee":3.48},"60":{"speed":8.009,"heel":25.8,"lee":3.29},"65":{"speed":8.253,"heel":26,"lee":3.06},"70":{"speed":8.502,"heel":25.9,"lee":2.81},"75":{"speed":8.748,"heel":26.2,"lee":2.6},"80":{"speed":9.011,"heel":26.4,"lee":2.38},"85":{"speed":9.316,"heel":26.7,"lee":2.16},"90":{"speed":9.645,"heel":26.7,"lee":1.92},"95":{"speed":9.982,"heel":26.9,"lee":1.71},"100":{"speed":10.325,"heel":27.2,"lee":1.52},"105":{"speed":10.577,"heel":22.1,"lee":1.17},"110":{"speed":10.455,"heel":15,"lee":0.91},"115":{"speed":10.409,"heel":15,"lee":0.93},"120":{"speed":10.699,"heel":15,"lee":0.82},"125":{"speed":10.962,"heel":15,"lee":0.73},"130":{"speed":11.213,"heel":15,"lee":0.64},"135":{"speed":11.258,"heel":13.3,"lee":0.56},"140":{"speed":10.927,"heel":15,"lee":0.64},"145":{"speed":11.129,"heel":13.7,"lee":0.53},"150":{"speed":10.342,"heel":7.9,"lee":0.41},"155":{"speed":9.645,"heel":5.1,"lee":0.34},"160":{"speed":9.155,"heel":3.6,"lee":0.28},"165":{"speed":8.818,"heel":2.4,"lee":0.21},"170":{"speed":8.563,"heel":1.5,"lee":0.14},"175":{"speed":8.344,"heel":0.7,"lee":0.07},"180":{"speed":8.145,"heel":0,"lee":0},"33.9":{"speed":6.643,"heel":27.9,"lee":4.81},"144.7":{"speed":11.178,"heel":14.5,"lee":0.54}},"19":{"30":{"speed":6.253,"heel":28.1,"lee":5.59},"33":{"speed":6.57,"heel":27.5,"lee":4.97},"36":{"speed":6.799,"heel":26.7,"lee":4.55},"39":{"speed":6.995,"heel":26.9,"lee":4.39},"42":{"speed":7.17,"heel":26.5,"lee":4.22},"45":{"speed":7.33,"heel":26.4,"lee":4.06},"50":{"speed":7.575,"heel":26.6,"lee":3.87},"55":{"speed":7.809,"heel":25.4,"lee":3.51},"60":{"speed":8.05,"heel":25.6,"lee":3.32},"65":{"speed":8.305,"heel":25.6,"lee":3.05},"70":{"speed":8.564,"heel":25.9,"lee":2.82},"75":{"speed":8.824,"heel":26.1,"lee":2.59},"80":{"speed":9.114,"heel":26.5,"lee":2.37},"85":{"speed":9.449,"heel":27.2,"lee":2.16},"90":{"speed":9.805,"heel":26.9,"lee":1.89},"95":{"speed":10.173,"heel":27.3,"lee":1.68},"100":{"speed":10.544,"heel":27.2,"lee":1.47},"105":{"speed":10.91,"heel":27,"lee":1.28},"110":{"speed":11.012,"heel":18.9,"lee":0.92},"115":{"speed":10.674,"heel":12.7,"lee":0.76},"120":{"speed":10.98,"heel":15,"lee":0.78},"125":{"speed":11.282,"heel":15,"lee":0.69},"130":{"speed":11.569,"heel":15,"lee":0.6},"135":{"speed":11.838,"heel":15,"lee":0.52},"140":{"speed":11.31,"heel":15,"lee":0.6},"145":{"speed":11.663,"heel":15,"lee":0.5},"146":{"speed":11.73,"heel":15,"lee":0.48},"150":{"speed":10.992,"heel":9.1,"lee":0.39},"155":{"speed":10.188,"heel":5.7,"lee":0.32},"160":{"speed":9.623,"heel":4,"lee":0.27},"165":{"speed":9.219,"heel":2.7,"lee":0.21},"170":{"speed":8.912,"heel":1.7,"lee":0.14},"175":{"speed":8.67,"heel":0.8,"lee":0.07},"180":{"speed":8.454,"heel":0,"lee":0},"33.8":{"speed":6.64,"heel":27.8,"lee":4.89}},"20":{"30":{"speed":6.243,"heel":28,"lee":5.61},"33":{"speed":6.566,"heel":28.5,"lee":5.25},"36":{"speed":6.801,"heel":26.9,"lee":4.72},"39":{"speed":7,"heel":27.2,"lee":4.57},"42":{"speed":7.178,"heel":26.7,"lee":4.31},"45":{"speed":7.341,"heel":25.7,"lee":4.03},"50":{"speed":7.592,"heel":26.3,"lee":3.91},"55":{"speed":7.834,"heel":25.8,"lee":3.61},"60":{"speed":8.084,"heel":25.6,"lee":3.35},"65":{"speed":8.351,"heel":26.2,"lee":3.13},"70":{"speed":8.619,"heel":26.1,"lee":2.85},"75":{"speed":8.894,"heel":26.3,"lee":2.61},"80":{"speed":9.213,"heel":26.5,"lee":2.36},"85":{"speed":9.576,"heel":26.8,"lee":2.11},"90":{"speed":9.959,"heel":27.1,"lee":1.87},"95":{"speed":10.357,"heel":27.3,"lee":1.64},"100":{"speed":10.755,"heel":27.4,"lee":1.43},"105":{"speed":11.162,"heel":27.7,"lee":1.25},"110":{"speed":11.521,"heel":24,"lee":0.97},"115":{"speed":11.331,"heel":15.3,"lee":0.74},"120":{"speed":11.262,"heel":15,"lee":0.74},"125":{"speed":11.603,"heel":15,"lee":0.65},"130":{"speed":11.928,"heel":15,"lee":0.56},"135":{"speed":12.235,"heel":15,"lee":0.48},"140":{"speed":12.073,"heel":12,"lee":0.42},"145":{"speed":12.099,"heel":15,"lee":0.45},"150":{"speed":11.723,"heel":10.5,"lee":0.36},"155":{"speed":10.778,"heel":6.4,"lee":0.3},"160":{"speed":10.133,"heel":4.5,"lee":0.26},"165":{"speed":9.673,"heel":3.1,"lee":0.2},"170":{"speed":9.315,"heel":1.9,"lee":0.14},"175":{"speed":9.02,"heel":0.9,"lee":0.07},"180":{"speed":8.773,"heel":0,"lee":0},"34.1":{"speed":6.661,"heel":27.5,"lee":4.97},"147.3":{"speed":12.285,"heel":15,"lee":0.41}},"21":{"30":{"speed":6.22,"heel":28.5,"lee":5.83},"33":{"speed":6.556,"heel":27.7,"lee":5.27},"36":{"speed":6.795,"heel":27.2,"lee":4.86},"39":{"speed":6.998,"heel":26.8,"lee":4.61},"42":{"speed":7.18,"heel":26.6,"lee":4.39},"45":{"speed":7.344,"heel":25.9,"lee":4.19},"50":{"speed":7.605,"heel":26.1,"lee":3.91},"55":{"speed":7.852,"heel":25.8,"lee":3.65},"60":{"speed":8.113,"heel":25.8,"lee":3.4},"65":{"speed":8.39,"heel":25.7,"lee":3.11},"70":{"speed":8.668,"heel":26.1,"lee":2.87},"75":{"speed":8.96,"heel":26.3,"lee":2.62},"80":{"speed":9.306,"heel":26.7,"lee":2.36},"85":{"speed":9.694,"heel":27.3,"lee":2.11},"90":{"speed":10.105,"heel":27.2,"lee":1.84},"95":{"speed":10.531,"heel":27.4,"lee":1.6},"100":{"speed":10.962,"heel":27.6,"lee":1.4},"105":{"speed":11.41,"heel":27.7,"lee":1.2},"110":{"speed":11.862,"heel":28,"lee":1.04},"115":{"speed":12.002,"heel":19.6,"lee":0.73},"120":{"speed":11.541,"heel":15,"lee":0.71},"125":{"speed":11.921,"heel":15,"lee":0.61},"130":{"speed":12.289,"heel":15,"lee":0.52},"135":{"speed":12.644,"heel":15,"lee":0.45},"140":{"speed":12.972,"heel":14.9,"lee":0.38},"145":{"speed":12.547,"heel":15,"lee":0.41},"150":{"speed":12.541,"heel":11.7,"lee":0.33},"155":{"speed":11.427,"heel":7.1,"lee":0.28},"160":{"speed":10.681,"heel":4.9,"lee":0.24},"165":{"speed":10.163,"heel":3.4,"lee":0.19},"170":{"speed":9.759,"heel":2.1,"lee":0.13},"175":{"speed":9.422,"heel":0.9,"lee":0.07},"180":{"speed":9.125,"heel":0,"lee":0},"34.4":{"speed":6.676,"heel":27.4,"lee":5.04},"148.6":{"speed":12.882,"heel":15,"lee":0.35}},"22":{"30":{"speed":6.191,"heel":28.2,"lee":6.01},"33":{"speed":6.537,"heel":27.9,"lee":5.42},"36":{"speed":6.783,"heel":27.2,"lee":4.98},"39":{"speed":6.99,"heel":26.6,"lee":4.68},"42":{"speed":7.177,"heel":26.6,"lee":4.5},"45":{"speed":7.348,"heel":26.5,"lee":4.31},"50":{"speed":7.612,"heel":25.8,"lee":3.98},"55":{"speed":7.868,"heel":26,"lee":3.74},"60":{"speed":8.137,"heel":25.8,"lee":3.45},"65":{"speed":8.422,"heel":26.2,"lee":3.19},"70":{"speed":8.709,"heel":26.2,"lee":2.89},"75":{"speed":9.02,"heel":26.4,"lee":2.63},"80":{"speed":9.393,"heel":26.8,"lee":2.36},"85":{"speed":9.804,"heel":27.1,"lee":2.08},"90":{"speed":10.243,"heel":27.3,"lee":1.81},"95":{"speed":10.695,"heel":27.5,"lee":1.57},"100":{"speed":11.164,"heel":27.7,"lee":1.36},"105":{"speed":11.653,"heel":28,"lee":1.16},"110":{"speed":12.148,"heel":28,"lee":0.98},"115":{"speed":12.597,"heel":24.8,"lee":0.75},"120":{"speed":12.251,"heel":14.9,"lee":0.57},"125":{"speed":12.238,"heel":15,"lee":0.57},"130":{"speed":12.658,"heel":15,"lee":0.49},"135":{"speed":13.077,"heel":15,"lee":0.41},"140":{"speed":13.473,"heel":15,"lee":0.34},"145":{"speed":13.021,"heel":15,"lee":0.37},"150":{"speed":13.48,"heel":14.4,"lee":0.29},"155":{"speed":12.14,"heel":8,"lee":0.25},"160":{"speed":11.272,"heel":5.4,"lee":0.22},"165":{"speed":10.685,"heel":3.7,"lee":0.18},"170":{"speed":10.236,"heel":2.3,"lee":0.13},"175":{"speed":9.856,"heel":1,"lee":0.07},"180":{"speed":9.524,"heel":0,"lee":0},"34.6":{"speed":6.673,"heel":27.5,"lee":5.12},"149.8":{"speed":13.526,"heel":15,"lee":0.3}},"23":{"30":{"speed":6.148,"heel":28.5,"lee":6.29},"33":{"speed":6.509,"heel":27.5,"lee":5.47},"36":{"speed":6.764,"heel":27.3,"lee":5.13},"39":{"speed":6.977,"heel":26.8,"lee":4.84},"42":{"speed":7.168,"heel":26.5,"lee":4.57},"45":{"speed":7.344,"heel":25.9,"lee":4.34},"50":{"speed":7.614,"heel":25.8,"lee":4.07},"55":{"speed":7.874,"heel":26.5,"lee":3.88},"60":{"speed":8.153,"heel":26.4,"lee":3.56},"65":{"speed":8.448,"heel":25.8,"lee":3.18},"70":{"speed":8.745,"heel":26.1,"lee":2.92},"75":{"speed":9.074,"heel":26.6,"lee":2.66},"80":{"speed":9.472,"heel":26.8,"lee":2.35},"85":{"speed":9.906,"heel":27,"lee":2.06},"90":{"speed":10.371,"heel":27.5,"lee":1.8},"95":{"speed":10.85,"heel":27.5,"lee":1.54},"100":{"speed":11.36,"heel":27.8,"lee":1.32},"105":{"speed":11.889,"heel":28.1,"lee":1.12},"110":{"speed":12.432,"heel":28.2,"lee":0.94},"115":{"speed":13.011,"heel":28.5,"lee":0.78},"120":{"speed":13.109,"heel":19.3,"lee":0.54},"125":{"speed":12.558,"heel":15,"lee":0.54},"130":{"speed":13.045,"heel":15,"lee":0.45},"135":{"speed":13.521,"heel":15,"lee":0.38},"140":{"speed":13.961,"heel":15,"lee":0.31},"145":{"speed":13.762,"heel":12.8,"lee":0.27},"150":{"speed":14.081,"heel":15,"lee":0.26},"151":{"speed":14.187,"heel":15,"lee":0.25},"155":{"speed":12.941,"heel":8.9,"lee":0.23},"160":{"speed":11.912,"heel":6,"lee":0.21},"165":{"speed":11.244,"heel":4,"lee":0.17},"170":{"speed":10.739,"heel":2.5,"lee":0.12},"175":{"speed":10.322,"heel":1.1,"lee":0.06},"180":{"speed":9.949,"heel":0,"lee":0},"34.9":{"speed":6.681,"heel":27.6,"lee":5.29}},"24":{"30":{"speed":6.093,"heel":27.9,"lee":6.39},"33":{"speed":6.474,"heel":28.2,"lee":5.81},"36":{"speed":6.74,"heel":27.2,"lee":5.28},"39":{"speed":6.958,"heel":27.2,"lee":4.99},"42":{"speed":7.154,"heel":26.2,"lee":4.65},"45":{"speed":7.335,"heel":26.3,"lee":4.48},"50":{"speed":7.612,"heel":26,"lee":4.15},"55":{"speed":7.877,"heel":26.2,"lee":3.93},"60":{"speed":8.166,"heel":26,"lee":3.57},"65":{"speed":8.462,"heel":26.4,"lee":3.25},"70":{"speed":8.774,"heel":26.2,"lee":2.95},"75":{"speed":9.122,"heel":26.8,"lee":2.69},"80":{"speed":9.542,"heel":26.9,"lee":2.36},"85":{"speed":9.999,"heel":27.2,"lee":2.06},"90":{"speed":10.488,"heel":27.5,"lee":1.78},"95":{"speed":10.998,"heel":27.7,"lee":1.52},"100":{"speed":11.546,"heel":28.3,"lee":1.3},"105":{"speed":12.118,"heel":28.2,"lee":1.08},"110":{"speed":12.722,"heel":28.6,"lee":0.9},"115":{"speed":13.373,"heel":28.8,"lee":0.74},"120":{"speed":13.912,"heel":24.8,"lee":0.54},"125":{"speed":13.169,"heel":13.9,"lee":0.43},"130":{"speed":13.438,"heel":15,"lee":0.42},"135":{"speed":13.962,"heel":15,"lee":0.34},"140":{"speed":14.449,"heel":15,"lee":0.28},"145":{"speed":14.812,"heel":14.5,"lee":0.23},"150":{"speed":14.618,"heel":15,"lee":0.24},"152":{"speed":14.854,"heel":15,"lee":0.21},"155":{"speed":13.845,"heel":10,"lee":0.2},"160":{"speed":12.605,"heel":6.5,"lee":0.19},"165":{"speed":11.845,"heel":4.4,"lee":0.16},"170":{"speed":11.277,"heel":2.7,"lee":0.11},"175":{"speed":10.79,"heel":1.8,"lee":0.09},"180":{"speed":10.404,"heel":0,"lee":0},"35.3":{"speed":6.683,"heel":27.4,"lee":5.36}},"25":{"30":{"speed":6.023,"heel":27.7,"lee":6.6},"33":{"speed":6.429,"heel":27.7,"lee":5.95},"36":{"speed":6.708,"heel":27.4,"lee":5.44},"39":{"speed":6.934,"heel":26.9,"lee":5.08},"42":{"speed":7.135,"heel":26.5,"lee":4.8},"45":{"speed":7.32,"heel":26.2,"lee":4.56},"50":{"speed":7.605,"heel":26.1,"lee":4.21},"55":{"speed":7.879,"heel":25.8,"lee":3.89},"60":{"speed":8.171,"heel":25.9,"lee":3.61},"65":{"speed":8.482,"heel":26.1,"lee":3.3},"70":{"speed":8.798,"heel":26.3,"lee":2.99},"75":{"speed":9.163,"heel":26.4,"lee":2.67},"80":{"speed":9.603,"heel":26.9,"lee":2.36},"85":{"speed":10.082,"heel":27.4,"lee":2.06},"90":{"speed":10.594,"heel":27.7,"lee":1.77},"95":{"speed":11.137,"heel":27.8,"lee":1.5},"100":{"speed":11.723,"heel":28.1,"lee":1.26},"105":{"speed":12.341,"heel":28.5,"lee":1.05},"110":{"speed":13.018,"heel":29,"lee":0.87},"115":{"speed":13.727,"heel":29.2,"lee":0.7},"120":{"speed":14.414,"heel":29.5,"lee":0.57},"125":{"speed":14.226,"heel":17.9,"lee":0.38},"130":{"speed":13.826,"heel":15,"lee":0.39},"135":{"speed":14.402,"heel":15,"lee":0.31},"140":{"speed":14.931,"heel":15,"lee":0.26},"145":{"speed":15.414,"heel":15,"lee":0.21},"150":{"speed":15.155,"heel":15,"lee":0.21},"153":{"speed":15.527,"heel":15,"lee":0.18},"155":{"speed":14.797,"heel":11.3,"lee":0.17},"160":{"speed":13.38,"heel":7,"lee":0.16},"165":{"speed":12.487,"heel":4.8,"lee":0.14},"170":{"speed":11.852,"heel":2.9,"lee":0.1},"175":{"speed":11.333,"heel":1.3,"lee":0.05},"180":{"speed":10.219,"heel":0,"lee":0},"35.6":{"speed":6.674,"heel":27.1,"lee":5.45}},"26":{"30":{"speed":5.942,"heel":27.8,"lee":6.97},"33":{"speed":6.375,"heel":27.9,"lee":6.15},"36":{"speed":6.669,"heel":27.2,"lee":5.58},"39":{"speed":6.903,"heel":26.5,"lee":5.19},"42":{"speed":7.109,"heel":26,"lee":4.85},"45":{"speed":7.301,"heel":26.7,"lee":4.73},"50":{"speed":7.589,"heel":26.1,"lee":4.3},"55":{"speed":7.873,"heel":25.7,"lee":3.96},"60":{"speed":8.171,"heel":26,"lee":3.69},"65":{"speed":8.489,"heel":25.9,"lee":3.32},"70":{"speed":8.815,"heel":26.2,"lee":3.02},"75":{"speed":9.197,"heel":26.9,"lee":2.74},"80":{"speed":9.655,"heel":27.3,"lee":2.4},"85":{"speed":10.156,"heel":27.3,"lee":2.06},"90":{"speed":10.69,"heel":27.7,"lee":1.76},"95":{"speed":11.266,"heel":28,"lee":1.49},"100":{"speed":11.889,"heel":28.3,"lee":1.24},"105":{"speed":12.558,"heel":28.9,"lee":1.03},"110":{"speed":13.31,"heel":28.8,"lee":0.82},"115":{"speed":14.075,"heel":29.4,"lee":0.66},"120":{"speed":14.812,"heel":29.8,"lee":0.53},"125":{"speed":15.191,"heel":22.8,"lee":0.36},"130":{"speed":14.21,"heel":15,"lee":0.36},"135":{"speed":14.833,"heel":15,"lee":0.29},"140":{"speed":15.411,"heel":15,"lee":0.23},"145":{"speed":15.93,"heel":15,"lee":0.19},"150":{"speed":15.69,"heel":15,"lee":0.19},"155":{"speed":15.793,"heel":12.2,"lee":0.15},"160":{"speed":14.2,"heel":7.6,"lee":0.14},"165":{"speed":13.194,"heel":5.1,"lee":0.13},"170":{"speed":12.461,"heel":3.1,"lee":0.09},"175":{"speed":11.887,"heel":1.4,"lee":0.05},"180":{"speed":11.387,"heel":0,"lee":0},"36.1":{"speed":6.675,"heel":27.4,"lee":5.61},"153.9":{"speed":16.195,"heel":15,"lee":0.15}},"27":{"30":{"speed":5.847,"heel":28.1,"lee":7.39},"33":{"speed":6.307,"heel":27.4,"lee":6.27},"36":{"speed":6.622,"heel":27.4,"lee":5.79},"39":{"speed":6.866,"heel":26.9,"lee":5.4},"42":{"speed":7.079,"heel":26.4,"lee":5.02},"45":{"speed":7.276,"heel":26.1,"lee":4.76},"50":{"speed":7.576,"heel":26.2,"lee":4.43},"55":{"speed":7.862,"heel":25.9,"lee":4.09},"60":{"speed":8.165,"heel":25.8,"lee":3.71},"65":{"speed":8.49,"heel":26.9,"lee":3.49},"70":{"speed":8.825,"heel":26.4,"lee":3.08},"75":{"speed":9.224,"heel":26.9,"lee":2.76},"80":{"speed":9.699,"heel":27.2,"lee":2.41},"85":{"speed":10.22,"heel":27.7,"lee":2.08},"90":{"speed":10.776,"heel":27.8,"lee":1.76},"95":{"speed":11.385,"heel":28.2,"lee":1.48},"100":{"speed":12.045,"heel":28.5,"lee":1.22},"105":{"speed":12.772,"heel":28.9,"lee":1},"110":{"speed":13.588,"heel":30,"lee":0.81},"115":{"speed":14.41,"heel":29.4,"lee":0.62},"120":{"speed":15.201,"heel":30,"lee":0.5},"125":{"speed":15.885,"heel":28.7,"lee":0.38},"130":{"speed":15.113,"heel":15.2,"lee":0.28},"135":{"speed":15.259,"heel":15,"lee":0.27},"140":{"speed":15.881,"heel":15,"lee":0.21},"145":{"speed":16.432,"heel":15,"lee":0.17},"150":{"speed":16.305,"heel":13.1,"lee":0.15},"155":{"speed":16.773,"heel":14.3,"lee":0.13},"160":{"speed":15.048,"heel":8.2,"lee":0.12},"165":{"speed":13.941,"heel":5.5,"lee":0.11},"170":{"speed":13.127,"heel":3.3,"lee":0.08},"175":{"speed":12.474,"heel":1.5,"lee":0.05},"180":{"speed":11.923,"heel":0,"lee":0},"36.4":{"speed":6.66,"heel":27.4,"lee":5.77},"154.8":{"speed":16.847,"heel":15,"lee":0.13}},"28":{"30":{"speed":5.73,"heel":27.7,"lee":7.79},"33":{"speed":6.225,"heel":27.6,"lee":6.66},"36":{"speed":6.566,"heel":27.1,"lee":5.97},"39":{"speed":6.822,"heel":26.7,"lee":5.51},"42":{"speed":7.043,"heel":26.3,"lee":5.16},"45":{"speed":7.246,"heel":26.7,"lee":4.97},"50":{"speed":7.555,"heel":26.2,"lee":4.53},"55":{"speed":7.844,"heel":26,"lee":4.14},"60":{"speed":8.154,"heel":25.9,"lee":3.82},"65":{"speed":8.486,"heel":26.2,"lee":3.46},"70":{"speed":8.829,"heel":26.4,"lee":3.14},"75":{"speed":9.242,"heel":26.9,"lee":2.8},"80":{"speed":9.732,"heel":27.4,"lee":2.44},"85":{"speed":10.273,"heel":27.4,"lee":2.07},"90":{"speed":10.851,"heel":28,"lee":1.77},"95":{"speed":11.492,"heel":28.5,"lee":1.48},"100":{"speed":12.19,"heel":28.7,"lee":1.21},"105":{"speed":12.982,"heel":29.1,"lee":0.97},"110":{"speed":13.858,"heel":29.5,"lee":0.76},"115":{"speed":14.732,"heel":29.7,"lee":0.59},"120":{"speed":15.577,"heel":30.1,"lee":0.47},"125":{"speed":16.308,"heel":30.5,"lee":0.38},"130":{"speed":16.191,"heel":19.1,"lee":0.25},"135":{"speed":15.675,"heel":15,"lee":0.25},"140":{"speed":16.334,"heel":15,"lee":0.2},"145":{"speed":16.918,"heel":15,"lee":0.16},"150":{"speed":17.304,"heel":14.3,"lee":0.13},"155":{"speed":17.41,"heel":15,"lee":0.12},"160":{"speed":15.917,"heel":8.9,"lee":0.11},"165":{"speed":14.711,"heel":5.8,"lee":0.1},"170":{"speed":13.829,"heel":3.5,"lee":0.07},"175":{"speed":13.112,"heel":1.6,"lee":0.04},"180":{"speed":11.624,"heel":0,"lee":0},"36.8":{"speed":6.642,"heel":26.9,"lee":5.76},"155.6":{"speed":17.488,"heel":15,"lee":0.11}},"29":{"30":{"speed":5.591,"heel":27.4,"lee":8.24},"33":{"speed":6.125,"heel":27.6,"lee":7.01},"36":{"speed":6.498,"heel":27.1,"lee":6.22},"39":{"speed":6.77,"heel":26.3,"lee":5.66},"42":{"speed":7,"heel":26.8,"lee":5.42},"45":{"speed":7.21,"heel":26.3,"lee":5.05},"50":{"speed":7.528,"heel":26,"lee":4.63},"55":{"speed":7.825,"heel":25.9,"lee":4.23},"60":{"speed":8.138,"heel":26,"lee":3.9},"65":{"speed":8.476,"heel":26.2,"lee":3.54},"70":{"speed":8.826,"heel":27,"lee":3.24},"75":{"speed":9.252,"heel":27,"lee":2.84},"80":{"speed":9.757,"heel":27.4,"lee":2.46},"85":{"speed":10.315,"heel":27.7,"lee":2.1},"90":{"speed":10.915,"heel":28.1,"lee":1.77},"95":{"speed":11.587,"heel":28.4,"lee":1.46},"100":{"speed":12.324,"heel":28.8,"lee":1.19},"105":{"speed":13.181,"heel":29.4,"lee":0.95},"110":{"speed":14.112,"heel":29.8,"lee":0.73},"115":{"speed":15.044,"heel":30.1,"lee":0.57},"120":{"speed":15.937,"heel":30.2,"lee":0.44},"125":{"speed":16.7,"heel":30.7,"lee":0.35},"130":{"speed":17.103,"heel":23.6,"lee":0.24},"135":{"speed":16.076,"heel":15,"lee":0.23},"140":{"speed":16.771,"heel":15,"lee":0.18},"145":{"speed":17.392,"heel":15,"lee":0.14},"150":{"speed":17.938,"heel":15,"lee":0.11},"155":{"speed":17.942,"heel":15,"lee":0.11},"160":{"speed":16.784,"heel":9.6,"lee":0.09},"165":{"speed":15.497,"heel":6.2,"lee":0.08},"170":{"speed":14.55,"heel":3.8,"lee":0.07},"175":{"speed":13.783,"heel":1.7,"lee":0.04},"180":{"speed":12.147,"heel":0,"lee":0},"37.8":{"speed":6.666,"heel":27,"lee":5.93},"156.4":{"speed":18.123,"heel":15,"lee":0.1}},"30":{"30":{"speed":5.428,"heel":27.1,"lee":8.83},"33":{"speed":6.003,"heel":27.7,"lee":7.43},"36":{"speed":6.42,"heel":27.2,"lee":6.5},"38":{"speed":6.62,"heel":27.3,"lee":6.11},"39":{"speed":6.711,"heel":26.9,"lee":5.94},"42":{"speed":6.95,"heel":26.6,"lee":5.55},"45":{"speed":7.168,"heel":26.6,"lee":5.25},"50":{"speed":7.497,"heel":26.1,"lee":4.74},"55":{"speed":7.798,"heel":25.8,"lee":4.3},"60":{"speed":8.115,"heel":26.3,"lee":4.03},"65":{"speed":8.459,"heel":26.3,"lee":3.62},"70":{"speed":8.817,"heel":26.2,"lee":3.22},"75":{"speed":9.254,"heel":26.9,"lee":2.88},"80":{"speed":9.77,"heel":27.9,"lee":2.54},"85":{"speed":10.346,"heel":27.8,"lee":2.13},"90":{"speed":10.968,"heel":28,"lee":1.78},"95":{"speed":11.669,"heel":28.7,"lee":1.48},"100":{"speed":12.446,"heel":28.9,"lee":1.18},"105":{"speed":13.364,"heel":29.4,"lee":0.92},"110":{"speed":14.349,"heel":30,"lee":0.71},"115":{"speed":15.338,"heel":30.3,"lee":0.54},"120":{"speed":16.276,"heel":30.6,"lee":0.42},"125":{"speed":17.075,"heel":30.8,"lee":0.33},"130":{"speed":17.768,"heel":29,"lee":0.25},"135":{"speed":16.788,"heel":14.9,"lee":0.18},"140":{"speed":17.194,"heel":15,"lee":0.17},"145":{"speed":17.855,"heel":15,"lee":0.13},"150":{"speed":18.44,"heel":15,"lee":0.1},"155":{"speed":18.469,"heel":15,"lee":0.1},"160":{"speed":17.653,"heel":9.9,"lee":0.08},"165":{"speed":16.288,"heel":6.6,"lee":0.07},"170":{"speed":15.286,"heel":4,"lee":0.06},"175":{"speed":14.471,"heel":1.8,"lee":0.03},"180":{"speed":12.705,"heel":0,"lee":0},"157.1":{"speed":18.755,"heel":15,"lee":0.08}},"35":{"30":{"speed":0,"heel":0,"lee":0},"33":{"speed":4.987,"heel":26.2,"lee":11.25},"36":{"speed":5.687,"heel":26.4,"lee":8.84},"39":{"speed":6.201,"heel":26.8,"lee":7.54},"42":{"speed":6.571,"heel":26.5,"lee":6.69},"45":{"speed":6.849,"heel":26.3,"lee":6.14},"50":{"speed":7.245,"heel":26.3,"lee":5.52},"55":{"speed":7.593,"heel":26.1,"lee":4.97},"60":{"speed":7.923,"heel":26.3,"lee":4.54},"65":{"speed":8.285,"heel":26.3,"lee":4.07},"70":{"speed":8.677,"heel":26.2,"lee":3.6},"75":{"speed":9.133,"heel":27.3,"lee":3.25},"80":{"speed":9.692,"heel":28.3,"lee":2.84},"85":{"speed":10.33,"heel":28.3,"lee":2.35},"90":{"speed":11.041,"heel":28.8,"lee":1.94},"95":{"speed":11.868,"heel":29.3,"lee":1.56},"100":{"speed":12.842,"heel":30,"lee":1.21},"105":{"speed":14.026,"heel":30.4,"lee":0.88},"110":{"speed":15.282,"heel":31.1,"lee":0.64},"115":{"speed":16.524,"heel":31.4,"lee":0.47},"120":{"speed":17.684,"heel":31.4,"lee":0.34},"125":{"speed":18.721,"heel":31.6,"lee":0.26},"130":{"speed":19.527,"heel":31.4,"lee":0.2},"135":{"speed":20.161,"heel":31.6,"lee":0.17},"140":{"speed":19.115,"heel":15,"lee":0.12},"145":{"speed":19.859,"heel":15,"lee":0.09},"150":{"speed":20.478,"heel":15,"lee":0.07},"155":{"speed":21.016,"heel":15,"lee":0.06},"160":{"speed":21.226,"heel":15,"lee":0.05},"165":{"speed":20.074,"heel":9.1,"lee":0.04},"170":{"speed":18.966,"heel":5.2,"lee":0.03},"175":{"speed":17.984,"heel":2.3,"lee":0.02},"180":{"speed":15.891,"heel":0,"lee":0},"160.5":{"speed":21.285,"heel":15,"lee":0.05}}};
var mayhem_targets = {"up":{"4":{"twa":45.5,"speed":3.809,"heel":3.5},"5":{"twa":44.6,"speed":4.619,"heel":5.4},"6":{"twa":43.3,"speed":5.253,"heel":7.7},"7":{"twa":42.1,"speed":5.762,"heel":10.7},"8":{"twa":40.4,"speed":6.104,"heel":14.8},"9":{"twa":38.6,"speed":6.28,"heel":20.5},"10":{"twa":37.2,"speed":6.369,"heel":22.6},"11":{"twa":36.2,"speed":6.443,"heel":23.7},"12":{"twa":35.7,"speed":6.508,"heel":25.1},"13":{"twa":34.9,"speed":6.536,"heel":26.1},"14":{"twa":34.5,"speed":6.576,"heel":26.8},"15":{"twa":33.8,"speed":6.567,"heel":27.3},"16":{"twa":34.1,"speed":6.624,"heel":28.2},"17":{"twa":33.8,"speed":6.621,"heel":27.8},"18":{"twa":33.9,"speed":6.643,"heel":27.9},"19":{"twa":33.8,"speed":6.64,"heel":27.8},"20":{"twa":34.1,"speed":6.661,"heel":27.5},"21":{"twa":34.4,"speed":6.676,"heel":27.4},"22":{"twa":34.6,"speed":6.673,"heel":27.5},"23":{"twa":34.9,"speed":6.681,"heel":27.6},"24":{"twa":35.3,"speed":6.683,"heel":27.4},"25":{"twa":35.6,"speed":6.674,"heel":27.1},"26":{"twa":36.1,"speed":6.675,"heel":27.4},"27":{"twa":36.4,"speed":6.66,"heel":27.4},"28":{"twa":36.8,"speed":6.642,"heel":26.9},"29":{"twa":37.8,"speed":6.666,"heel":27},"30":{"twa":38,"speed":6.62,"heel":27.3},"35":{"twa":42,"speed":6.571,"heel":26.5}},"down":{"4":{"twa":139.7,"speed":3.83,"heel":1.2},"5":{"twa":140.9,"speed":4.668,"heel":1.7},"6":{"twa":142.9,"speed":5.356,"heel":2.1},"7":{"twa":145.6,"speed":5.881,"heel":2.2},"8":{"twa":148.9,"speed":6.253,"heel":2.1},"9":{"twa":151.8,"speed":6.541,"heel":2},"10":{"twa":153.3,"speed":6.835,"heel":2},"11":{"twa":154.2,"speed":7.126,"heel":2.1},"12":{"twa":155.4,"speed":7.371,"heel":2.2},"13":{"twa":157.5,"speed":7.559,"heel":2.1},"14":{"twa":153.2,"speed":8.143,"heel":3.5},"15":{"twa":151.4,"speed":8.652,"heel":4.7},"16":{"twa":145.4,"speed":9.757,"heel":9.5},"17":{"twa":144.4,"speed":10.516,"heel":12},"18":{"twa":144.7,"speed":11.178,"heel":14.5},"19":{"twa":146,"speed":11.73,"heel":15},"20":{"twa":147.3,"speed":12.285,"heel":15},"21":{"twa":148.6,"speed":12.882,"heel":15},"22":{"twa":149.8,"speed":13.526,"heel":15},"23":{"twa":151,"speed":14.187,"heel":15},"24":{"twa":152,"speed":14.854,"heel":15},"25":{"twa":153,"speed":15.527,"heel":15},"26":{"twa":153.9,"speed":16.195,"heel":15},"27":{"twa":154.8,"speed":16.847,"heel":15},"28":{"twa":155.6,"speed":17.488,"heel":15},"29":{"twa":156.4,"speed":18.123,"heel":15},"30":{"twa":157.1,"speed":18.755,"heel":15},"35":{"twa":160.5,"speed":21.285,"heel":15}}};
;   
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


;
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

;var tackGraphView = Backbone.View.extend({
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

        var speedScale = d3.scale.linear()
            .range([height, 0])
            .domain([0, 7]);

        var windScale = d3.scale.linear()
            .range([height-5, 10])
            .domain([0, 90]);

        var hdgScale = d3.scale.linear()
            .range([height, 10])
            .domain([360,0]);
        
        
        //axis
        var ticks = [];
        for ( var i = -30; i < 65; i+=10 ) {
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

        
        criticalPoint( this.tack.entrySpeed, speedScale, 'blue', false);
        
        // criticalPoint( this.tack.entryHdg, hdgScale, 'rgb(153,153,153)', false)
        //     .attr('stroke-dasharray','3,3');
        
        // criticalPoint( this.tack.recoveryHdg, hdgScale, 'rgb(153,153,153)', false)
        //     .attr('stroke-dasharray','3,3');

        //lines
        graph('speed', speedScale, 'rgb(153,153,255)', 0.5);
        graph('targetSpeed', speedScale, 'rgb(153,153,255)', 0.5).attr('stroke-dasharray', '4,1');
        graph('vmg', speedScale, 'blue', 1);
        
        graph('atwa', windScale, 'red', 1);
        graph('targetAngle', windScale, 'red', 1).attr('stroke-dasharray', '4,1')

        graph('hdg', hdgScale, 'rgb(153,153,153)', 0.5);

        
        // var awd = line(view.data, 'awa', [height, height/3], function(scale) { scale.domain( [scale.domain()[1], scale.domain()[0]] ); });
        // var hd = line(view.data, 'hdgDelta');
        // var ta = line(view.data, 'targetAngle', null, null, wind[1]);
    }
});

var calibrateTackView = Backbone.View.extend({
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

        var speedScale = d3.scale.linear()
            .range([height, 0])
            .domain([0, 30]);

        var windScale = d3.scale.linear()
            .range([height-5, 10])
            .domain([0, 90]);

        var hdgScale = d3.scale.linear()
            .range([height, 10])
            .domain([360,0]);
        
        
        //axis
        var ticks = [];
        for ( var i = -30; i < 65; i+=10 ) {
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

        //lines
        graph('aawa', windScale, 'red', 1);
        graph('gwd_20', hdgScale, 'blue', 1);
        graph('aws', speedScale, 'grey', 1);
        graph('gws_20', speedScale, 'black', 1);

        
        // var awd = line(view.data, 'awa', [height, height/3], function(scale) { scale.domain( [scale.domain()[1], scale.domain()[0]] ); });
        // var hd = line(view.data, 'hdgDelta');
        // var ta = line(view.data, 'targetAngle', null, null, wind[1]);
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
            through: Math.min( (this.tack.recoveryHdg - this.tack.entryHdg + 360)%360, (this.tack.entryHdg - this.tack.recoveryHdg + 360)%360)
        }, this.tack);

        if ( _.isNull(a.loss) )
            a.loss = "NULL";
        else
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
        var refs = _.map([[this.tack.timing.start,this.tack.entryHdg], [this.tack.timing.end,this.tack.recoveryHdg]], function(p) {
            var time = p[0];
            var hdg = p[1];

            var pt = view.tack.track[_.sortedIndex(view.tack.track, {t: time}, function(d) { return d.t; })];
            return {
                lat: pt.lat,
                lon: pt.lon,
                hdg: hdg
            };
        });
        var track = new tackMapView({model: {data:this.tack.track, up: this.tack.twd}, events: false, annotations: false, circles: moment(this.tack.time), references: refs});
        this.map.show(track);

        var graph = new tackGraphView(this.tack.data, this.tack);
        this.graph.show(graph);
    }
});


//# sourceMappingURL=signal.js.map